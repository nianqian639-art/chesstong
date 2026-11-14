"""Exercise release deployment and rollback against a disposable app/database."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

backend = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1]).resolve()
area = Path(tempfile.mkdtemp(prefix='ct-deploy-check-'))
with zipfile.ZipFile(archive) as z:
    z.extractall(area / 'release')
release = next((area / 'release').iterdir())
fakebin = area / 'bin'
fakebin.mkdir()
(fakebin / 'systemctl').write_text('''#!/bin/sh
printf '%s\n' "$*" >> "$CT_FAKE_SYSTEMCTL_LOG"
''')
(fakebin / 'curl').write_text('''#!/usr/bin/env python3
import os,sys
url=sys.argv[-1]
if url.startswith('https:'): sys.exit(7)
if url.endswith('/admin/overview'): print('403',end='')
elif url.endswith('/app'): print('old marker' if os.environ.get('CT_FAKE_BAD_MARKER') else '20261114-puzzle-qwen-evidence-2')
elif url.endswith('/health'): print('{"status":"ok"}')
else: sys.exit(22)
''')
for file in fakebin.iterdir():
    file.chmod(0o755)
node = shutil.which('node')
assert node
for mode in ['success', 'rollback']:
    app = area / mode / 'app'
    app.mkdir(parents=True)
    (app / 'node_modules').symlink_to(backend / 'node_modules', target_is_directory=True)
    shutil.copy2(backend / 'package.json', app / 'package.json')
    (app / 'src').mkdir()
    (app / 'src/server.ts').write_text('// original server preserved by rollback\n')
    (app / 'dist').mkdir()
    (app / 'dist/old-only.js').write_text('old-only marker\n')
    (app / 'data').mkdir()
    envfile = app / '.env.production'
    envfile.write_text('CHESSTONG_DATA_DIR=' + str(app / 'data') + '\n')
    subprocess.run([node, '--input-type=commonjs', '-e',
        "const d=new(require('better-sqlite3'))('data/chesstong.db');d.exec(\"CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES ('real data untouched')\");d.close()"], cwd=app, check=True)
    datafile = app / 'data/chesstong.db'
    before = hashlib.sha256(datafile.read_bytes()).hexdigest()
    original_env = envfile.read_bytes()
    systemlog = area / mode / 'systemctl.log'
    env = dict(os.environ, CT_APP_DIR=str(app), CT_BACKUP_ROOT=str(area / mode / 'backups'),
               CT_NODE_BIN=node, CT_LIVE_MODELS='0', CT_FAKE_SYSTEMCTL_LOG=str(systemlog),
               PATH=str(fakebin) + os.pathsep + os.environ['PATH'])
    if mode == 'rollback': env['CT_FAKE_BAD_MARKER'] = '1'
    with (area / (mode + '.log')).open('w') as log:
        result = subprocess.run(['bash', str(release / 'deploy.sh')], env=env, stdout=log, stderr=subprocess.STDOUT)
    backup = next((area / mode / 'backups').iterdir())
    assert hashlib.sha256(datafile.read_bytes()).hexdigest() == before, 'live database was modified'
    assert envfile.read_bytes() == original_env, 'environment was modified'
    assert (backup / 'chesstong.db').exists(), 'database backup absent'
    subprocess.run([node, '--input-type=commonjs', '-e',
        "const d=new(require('better-sqlite3'))(process.argv[1],{readonly:true});require('assert/strict').equal(d.prepare('SELECT value FROM sentinel').get().value,'real data untouched');d.close()", str(backup / 'chesstong.db')], cwd=app, check=True)
    assert '6 groups' in (backup / 'release-check.log').read_text(), 'candidate checks incomplete'
    if mode == 'success':
        assert result.returncode == 0, (area / 'success.log').read_text()[-2000:]
        assert 'buildServer' in (app / 'src/server.ts').read_text()
        assert (app / 'dist/index.js').exists()
        assert not (app / 'dist/old-only.js').exists(), 'old compiled file survived successful rollout'
        assert (app / 'public/js/app.js').exists()
        assert systemlog.read_text().count('restart') == 1
        print('PASS: candidate build and six isolated API groups; update and database backup; configuration/data preserved.')
    else:
        assert result.returncode != 0, 'bad deployed version was accepted'
        assert (app / 'src/server.ts').read_text() == '// original server preserved by rollback\n'
        assert not (app / 'public/js/app.js').exists(), 'new file survived rollback'
        assert not (app / 'dist/index.js').exists(), 'new compiled file survived rollback'
        assert (app / 'dist/old-only.js').read_text() == 'old-only marker\n'
        assert systemlog.read_text().count('restart') == 2
        print('PASS: failed version check restores old program, removes new files and compiled output, restarts service, retains live database.')
print('DEPLOYMENT CHECK COMPLETE:', area)
