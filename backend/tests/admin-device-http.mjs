import http from 'node:http';
import {mkdtemp,copyFile,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const dir=await mkdtemp('/tmp/ct-admin-http test-');
for(const f of ['bridge.mjs','index.html','admin.js','style.css','archive.cjs'])await copyFile('tools/admin-device/'+f,dir+'/'+f);
await writeFile(dir+'/config.json',JSON.stringify({host:'127.0.0.1',port:19382}));
const server=spawn(process.execPath,[dir+'/bridge.mjs'],{env:{...process.env,CT_ADMIN_NO_OPEN:'1',CT_ADMIN_DISABLE_ARCHIVE:'1'},stdio:'pipe'});
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('startup '+code)));});
 const origin='http://127.0.0.1:19382',url=await readFile(dir+'/start-url','utf8');
 assert.equal((await fetch(origin)).status,403);
 const started=await fetch(url,{redirect:'manual'});assert.equal(started.status,303);
 const cookie=started.headers.get('set-cookie').split(';')[0];assert.match(started.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 assert.equal((await fetch(origin,{headers:{cookie}})).status,200);
 assert.equal((await fetch(url)).status,403);
 const post=(originValue,action)=>fetch(origin+'/api/read',{method:'POST',headers:{cookie,Origin:originValue,'Content-Type':'application/json','X-Device-Request':'1'},body:JSON.stringify({action})});
 assert.equal((await post('https://stranger.invalid','summary')).status,403);
 assert.equal((await post(origin,'archive-status')).status,200);
 assert.equal((await post(origin,'execute')).status,400);
 assert.equal((await fetch(origin+'/api/read',{headers:{cookie}})).status,404);
 const raw=(headers)=>new Promise((resolve,reject)=>http.get(origin,{headers},r=>{r.resume();resolve(r.statusCode)}).on('error',reject));
 assert.equal(await raw({Host:'stranger.invalid',cookie}),403);
 assert.equal(await raw({cookie:'ct_device='+('é'.repeat(64))}),403);
 assert.equal((await fetch(origin)).status,403);
 assert.equal((await fetch(origin,{headers:{cookie}})).status,200);
 console.log('PASS admin HTTP: one-use launch, local session, forged Host/Origin and writes denied, malformed cookie safe, independent session denied.');
}finally{server.kill();}
