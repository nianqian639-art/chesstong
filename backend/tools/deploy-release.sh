#!/usr/bin/env bash
set -Eeuo pipefail
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${CT_APP_DIR:-/opt/chesstong/backend}"
BACKUP_ROOT="${CT_BACKUP_ROOT:-/opt/chesstong/backups}"
NODE_BIN="${CT_NODE_BIN:-/usr/bin/node}"
BACKUP_DIR="$BACKUP_ROOT/parent1-$(date +%Y%m%d-%H%M%S)-$$"
[[ "$APP_DIR" = /* && "$APP_DIR" != / && -d "$APP_DIR/node_modules" ]]
[[ -f "$APP_DIR/.env.production" && -x "$NODE_BIN" ]]
cd "$PATCH_DIR"
sha256sum -c SHA256SUMS
# The manifest is a fixed list of program files; data and configuration never enter it.
while IFS= read -r file; do
  case "$file" in src/*|public/*|tools/*|package.json|tsconfig.json) ;; *) exit 2 ;; esac
  [[ "$file" != *..* && -f "$PATCH_DIR/$file" && ! -L "$PATCH_DIR/$file" ]]
done < FILES
mkdir -p "$BACKUP_DIR/candidate"
CANDIDATE="$BACKUP_DIR/candidate"
while IFS= read -r file; do
  mkdir -p "$CANDIDATE/$(dirname "$file")"
  cp "$PATCH_DIR/$file" "$CANDIDATE/$file"
done < FILES
ln -s "$APP_DIR/node_modules" "$CANDIDATE/node_modules"
# Changing production dependencies requires a separate installation step.
"$NODE_BIN" --input-type=commonjs - "$APP_DIR/package.json" "$CANDIDATE/package.json" <<'NODE'
const fs=require('node:fs'),assert=require('node:assert/strict');
const [installed,release]=process.argv.slice(2).map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
assert.deepEqual(installed.dependencies,release.dependencies,'Installed dependencies differ from the release');
NODE
cd "$CANDIDATE"
npm run build > "$BACKUP_DIR/build.log" 2>&1
# The checker creates its own database/audio directory and never registers real users.
RELEASE_LIVE_MODELS="${CT_LIVE_MODELS:-1}" "$NODE_BIN" --env-file="$APP_DIR/.env.production" tools/release-check.mjs > "$BACKUP_DIR/release-check.log" 2>&1
grep -E 'CHECK PASS|TTS |CHECK COMPLETE' "$BACKUP_DIR/release-check.log"
cd "$APP_DIR"
CT_BACKUP_PATH="$BACKUP_DIR/chesstong.db" "$NODE_BIN" --env-file=.env.production --input-type=commonjs <<'NODE'
const D=require('better-sqlite3'),path=require('node:path');
const file=path.resolve(process.env.CHESSTONG_DATA_DIR||'data','chesstong.db');
const d=new D(file,{fileMustExist:true,readonly:true});
d.backup(process.env.CT_BACKUP_PATH).then(()=>d.close()).catch(e=>{console.error(e.message);process.exitCode=1;d.close();});
NODE
: > "$BACKUP_DIR/existing-files"
: > "$BACKUP_DIR/added-files"
while IFS= read -r file; do
  if [ -f "$APP_DIR/$file" ]; then
    mkdir -p "$BACKUP_DIR/program/$(dirname "$file")"
    cp -a "$APP_DIR/$file" "$BACKUP_DIR/program/$file"
    printf '%s\n' "$file" >> "$BACKUP_DIR/existing-files"
  else
    printf '%s\n' "$file" >> "$BACKUP_DIR/added-files"
  fi
done < "$PATCH_DIR/FILES"
if [ -d "$APP_DIR/dist" ]; then cp -a "$APP_DIR/dist" "$BACKUP_DIR/dist"; fi
rollback() {
  status=$?
  trap - ERR
  set +e
  echo "Release validation failed. Restoring previous program; live data is retained."
  while IFS= read -r file; do
    mkdir -p "$APP_DIR/$(dirname "$file")"
    cp -a "$BACKUP_DIR/program/$file" "$APP_DIR/$file"
  done < "$BACKUP_DIR/existing-files"
  while IFS= read -r file; do rm -f "$APP_DIR/$file"; done < "$BACKUP_DIR/added-files"
  rm -rf "$APP_DIR/dist"
  if [ -d "$BACKUP_DIR/dist" ]; then cp -a "$BACKUP_DIR/dist" "$APP_DIR/dist"; fi
  systemctl restart chesstong-backend
  echo "Rollback backup: $BACKUP_DIR"
  exit "$status"
}
trap rollback ERR
while IFS= read -r file; do
  mkdir -p "$APP_DIR/$(dirname "$file")"
  cp "$CANDIDATE/$file" "$APP_DIR/$file"
done < "$PATCH_DIR/FILES"
rm -rf "$APP_DIR/dist"
cp -a "$CANDIDATE/dist" "$APP_DIR/dist"
systemctl restart chesstong-backend
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8080/health > "$BACKUP_DIR/health.json" 2>/dev/null; then break; fi
  sleep 1
done
systemctl is-active --quiet chesstong-backend
curl -fsS --max-time 5 http://127.0.0.1:8080/health
test "$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/admin/overview)" = 403
curl -fsS --max-time 5 http://127.0.0.1:8080/app > "$BACKUP_DIR/app.html"
grep -q '20261025-parent1' "$BACKUP_DIR/app.html"
trap - ERR
echo "Parent-task and weekly-report update deployed. Backup: $BACKUP_DIR"
if curl -fsS --max-time 10 https://chesstong.top/health > "$BACKUP_DIR/https-health.json" 2>/dev/null; then
  echo 'Public HTTPS health check passed.'
else
  echo 'Public HTTPS is not ready. Configure the domain certificate before public launch.'
fi
