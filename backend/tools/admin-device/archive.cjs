'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const gzip = promisify(zlib.gzip);

function createArchiveManager({ directory, loadSnapshot, retentionDays = 30, now = () => new Date() }) {
 fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
 fs.chmodSync(directory, 0o700);
 let running = false;
 let lastError = '';

 function files() {
  return fs.readdirSync(directory).filter(name => /^chesstong-users-\d{8}\.json\.gz$/.test(name))
   .map(name => ({ name, path: path.join(directory, name), mtimeMs: fs.statSync(path.join(directory, name)).mtimeMs }))
   .sort((a, b) => b.mtimeMs - a.mtimeMs);
 }

 function status() {
  const saved = files();
  return { running, lastError, latest: saved[0]?.name || null, count: saved.length, directory };
 }

 async function run() {
  if (running) return { ...status(), started: false };
  running = true;
  lastError = '';
  try {
   const snapshot = await loadSnapshot();
   const stamp = now();
   const name = `chesstong-users-${stamp.toISOString().slice(0, 10).replaceAll('-', '')}.json.gz`;
   const target = path.join(directory, name);
   const temporary = `${target}.${process.pid}.tmp`;
   const body = Buffer.from(JSON.stringify({ generatedAt: stamp.toISOString(), ...snapshot }));
   const compressed = await gzip(body, { level: 6 });
   fs.writeFileSync(temporary, compressed, { mode: 0o600, flag: 'wx' });
   fs.chmodSync(temporary, 0o600);
   fs.renameSync(temporary, target);
   const cutoff = stamp.getTime() - retentionDays * 24 * 60 * 60 * 1000;
   for (const file of files()) if (file.mtimeMs < cutoff) fs.unlinkSync(file.path);
   return { ...status(), started: true, records: snapshot.recordCount || 0 };
  } catch {
   lastError = '归档失败，请检查设备网络和服务器连接。';
   throw new Error(lastError);
  } finally {
   running = false;
  }
 }

 return { status, run };
}

module.exports = { createArchiveManager };
