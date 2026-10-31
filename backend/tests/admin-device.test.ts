import {describe,it,expect,afterAll} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildServer} from '../src/server.js';
import {db} from '../src/services/db.js';
const require=createRequire(import.meta.url);
const {readData,TABLES}=require('../tools/admin-device/reader.cjs');
const Database=require('better-sqlite3');
const dir=mkdtempSync(join(tmpdir(),'ct-admin-reader-')),file=join(dir,'test.db');
const data=new Database(file);
for(const [table,[,cols]] of Object.entries(TABLES) as any){data.exec(`CREATE TABLE "${table}" (${cols.split(' ').map((c:string)=>`"${c}" TEXT`).join(',')})`);}
data.exec('ALTER TABLE users ADD COLUMN passwordHash TEXT');
data.exec('CREATE TABLE sessions (token TEXT)');data.exec('CREATE TABLE sms_codes (phone TEXT, code TEXT)');data.exec('CREATE TABLE binding_codes (code TEXT)');
data.prepare('INSERT INTO users (id, username, displayName, role, childIds, passwordHash) VALUES (?, ?, ?, ?, ?, ?)').run('user-1','example','<script>alert(1)</script>','parent','["child-1"]','secret-hash');
data.prepare('INSERT INTO users (id, username, displayName, role) VALUES (?, ?, ?, ?)').run('user-2','second','Student','student');
data.prepare('INSERT INTO sessions VALUES (?)').run('secret-token');data.close();
const app=buildServer();afterAll(()=>app.close());
describe('device only data access',()=>{
 it('rejects public routes even for the previous admin account and expired sessions',async()=>{
  const id=crypto.randomUUID();db.users.push({id,username:"former-admin",phone:process.env.ADMIN_PHONE||'15320935015',displayName:'Former admin',role:'parent',childIds:[],classIds:[],points:0,level:1,streakDays:0,createdAt:new Date().toISOString()});
  for(const expiresAt of [new Date(Date.now()+60000).toISOString(),new Date(0).toISOString()]){
   const token=crypto.randomUUID();db.sessions.push({token,userId:id,createdAt:new Date().toISOString(),expiresAt});
   for(const url of ['/admin/overview','/admin/ai-status']){const r=await app.inject({method:'GET',url,headers:{authorization:`Bearer ${token}`}});expect(r.statusCode).toBe(403);expect(r.headers['cache-control']).toBe('no-store');expect(r.json()).not.toHaveProperty('data');}
  }
  expect((await app.inject({method:'GET',url:'/admin/overview'})).statusCode).toBe(403);
 });
 it('lists all business tables without credentials, hashes, sessions or active binding codes',()=>{
  const summary=readData(file,{action:'summary'});expect(summary.tables).toHaveLength(20);expect(summary.readOnly).toBe(true);
  expect(summary.tables.map((t:any)=>t.key)).not.toEqual(expect.arrayContaining(['sessions','sms_codes','binding_codes']));
  const result=readData(file,{action:'rows',table:'users'});expect(result.total).toBe(2);expect(result.rows.find((r:any)=>r.id==='user-1').childIds).toEqual(['child-1']);expect(JSON.stringify(result)).not.toMatch(/secret-hash|passwordHash/);
 });
 it('paginates and searches using parameters and preserves records unchanged',()=>{
  const first=readData(file,{action:'rows',table:'users',page:1,limit:1});const second=readData(file,{action:'rows',table:'users',page:2,limit:1});expect(first.rows[0].id).not.toBe(second.rows[0].id);
  expect(readData(file,{action:'rows',table:'users',q:'example'}).rows[0].id).toBe('user-1');
  expect(readData(file,{action:'rows',table:'users',q:"' OR 1=1 --"}).rows).toHaveLength(0);
  for(const input of [{action:'execute',sql:'DELETE FROM users'},{action:'rows',table:'users;DROP TABLE users'},{action:'rows',table:'sessions'},{action:'rows',table:'sms_codes'},{action:'rows',table:'binding_codes'},{action:'rows',table:'__proto__'},{action:'rows',table:'users',limit:1000},{action:'rows',table:'users',page:-1}])expect(()=>readData(file,input)).toThrow();
  expect(readData(file,{action:'rows',table:'users'}).total).toBe(2);
 });
});
