import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, statSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { createArchiveManager } = require('../tools/admin-device/archive.cjs');
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('local user data archive', () => {
 it('creates compressed, private snapshots and reports their status', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ct-admin-archive-')); dirs.push(dir);
  const manager = createArchiveManager({ directory: join(dir, 'archive'), loadSnapshot: async () => ({ recordCount: 1, tables: [{ key: 'attempts', rows: [{ answer: 'e4' }] }] }), now: () => new Date('2026-11-08T10:00:00.000Z') });
  const result = await manager.run();
  expect(result.records).toBe(1);
  expect(result.latest).toBe('chesstong-users-20261108.json.gz');
  const target = join(dir, 'archive', result.latest!);
  expect(JSON.parse(gunzipSync(readFileSync(target)).toString()).tables[0].rows[0].answer).toBe('e4');
  expect(statSync(join(dir, 'archive')).mode & 0o077).toBe(0);
  expect(statSync(target).mode & 0o077).toBe(0);
 });

 it('removes snapshots older than the retention window', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ct-admin-archive-retention-')); dirs.push(dir);
  const archiveDir = join(dir, 'archive');
  const manager = createArchiveManager({ directory: archiveDir, loadSnapshot: async () => ({ tables: [] }), retentionDays: 30, now: () => new Date('2026-11-08T10:00:00.000Z') });
  await manager.run();
  const expired = join(archiveDir, 'chesstong-users-20260901.json.gz');
  const fs = await import('node:fs/promises');
  await fs.writeFile(expired, 'old');
  utimesSync(expired, new Date('2026-09-01T00:00:00.000Z'), new Date('2026-09-01T00:00:00.000Z'));
  await manager.run();
  expect(readdirSync(archiveDir)).not.toContain('chesstong-users-20260901.json.gz');
 });
});
