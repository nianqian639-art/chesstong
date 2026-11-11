import http from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {spawn,execFile} from 'node:child_process';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(readFileSync(path.join(dir,'config.json'),'utf8'));
const {createArchiveManager}=await import(path.join(dir,'archive.cjs'));
const host='127.0.0.1',port=config.port||19381,origin=`http://${host}:${port}`;
const session=randomBytes(32).toString('hex'),boot=randomBytes(32).toString('hex');
let bootUsed=false,pending=0;
function equals(a,b){return typeof a==='string'&&/^[a-f0-9]{64}$/.test(a)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function sshRead(query){return new Promise((resolve,reject)=>{
 const args=['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o',`UserKnownHostsFile="${path.join(dir,'known_hosts')}"`,'-o','ConnectTimeout=10','-o','ServerAliveInterval=5','-o','ServerAliveCountMax=2','-i',path.join(dir,'device_key'),`root@${config.host}`,'read-data'];
 const child=spawn('/usr/bin/ssh',args,{stdio:['pipe','pipe','pipe']});let out=[],size=0,done=false;
 const timer=setTimeout(()=>{child.kill();finish(new Error('连接超时，请重试'));},20000);
 function finish(err,value){if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(value);}
 child.on('error',()=>finish(new Error('无法启动设备连接')));
 child.stdout.on('data',b=>{size+=b.length;if(size>8*1024*1024){child.kill();finish(new Error('结果过大，请缩小查询范围'));}else out.push(b);});
 child.stderr.resume();
 child.on('close',code=>{if(code!==0)return finish(new Error('设备连接失败，请检查网络或设备授权'));try{finish(null,JSON.parse(Buffer.concat(out).toString('utf8')));}catch{finish(new Error('服务器返回格式无效'));}});
 child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(query));
});}
async function loadSnapshot(){
 const overview=await sshRead({action:'summary'}),tables=[];let recordCount=0;
 for(const table of overview.tables){
  const first=await sshRead({action:'rows',table:table.key,page:1,limit:100,q:''});
  const rows=[...first.rows];
  for(let page=2;page<=Math.ceil(first.total/100);page++)rows.push(...(await sshRead({action:'rows',table:table.key,page,limit:100,q:''})).rows);
  tables.push({key:table.key,label:table.label,total:first.total,columns:first.columns,rows});recordCount+=rows.length;
 }
 return {source:'chesstong-production-read-only-business-records',recordCount,tables};
}
const archive=createArchiveManager({directory:path.join(dir,'用户数据归档'),loadSnapshot});
if(process.env.CT_ADMIN_DISABLE_ARCHIVE!=='1'){
 const timer=setInterval(()=>archive.run().catch(()=>{}),60*60*1000);timer.unref();
 const initial=setTimeout(()=>archive.run().catch(()=>{}),10000);initial.unref();
}
const assets={'/':['index.html','text/html; charset=utf-8'],'/admin.js':['admin.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
const server=http.createServer(async(req,res)=>{
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
 const send=(code,data,type='application/json; charset=utf-8')=>{res.writeHead(code,{...headers,'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
 if(req.headers.host!==`${host}:${port}` || req.socket.remoteAddress!==host)return send(403,{message:'仅限本机访问'});
 const url=new URL(req.url,origin);
 if(req.method==='GET' && url.pathname===`/start/${boot}`&&!bootUsed){bootUsed=true;res.writeHead(303,{...headers,Location:'/', 'Set-Cookie':`ct_device=${session}; HttpOnly; SameSite=Strict; Path=/`});return res.end();}
 const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('ct_device='))?.slice(10);
 if(!equals(cookie,session))return send(403,'请从这台电脑桌面的“棋童数据管理”重新打开。','text/plain; charset=utf-8');
 if(req.method==='GET'&&assets[url.pathname]){const [file,type]=assets[url.pathname];return send(200,readFileSync(path.join(dir,file)),type);}
if(req.method!=='POST'||url.pathname!=='/api/read')return send(404,{message:'页面不存在'});
 if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'||req.headers['x-device-request']!=='1')return send(403,{message:'请求来源无效'});
 if(pending>=3)return send(429,{message:'正在读取数据，请稍后重试'});
 let raw='';try{
  for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)return send(413,{message:'请求过长'});}
  const body=JSON.parse(raw);
  if(!body||!['summary','rows','archive-status','archive-start'].includes(body.action))return send(400,{message:'仅支持只读查询或本机归档'});
  if(body.action==='archive-status')return send(200,archive.status());
  if(body.action==='archive-start'){
   if(archive.status().running)return send(202,{...archive.status(),message:'归档正在进行'});
   archive.run().catch(()=>{});
   return send(202,{...archive.status(),message:'已开始归档'});
  }
  pending++;try{send(200,await sshRead(body));}finally{pending--;}
 }catch{send(502,{message:'数据读取失败，请检查设备连接后重试'});}
});
server.requestTimeout=25000;server.headersTimeout=10000;
server.on('error',e=>{if(e.code==='EADDRINUSE'){if(process.env.CT_ADMIN_NO_OPEN!=='1')execFile('/usr/bin/open',['-a','Google Chrome',origin],()=>{});console.log('管理服务已在运行，已重新打开本机页面。');}else{process.stderr.write('本机管理服务启动失败。\n');process.exitCode=1;}});
server.listen(port,host,()=>{
 const url=`${origin}/start/${boot}`;
 // The one-time launch URL is not logged; supervised checks can save it in this private directory.
 if(process.env.CT_ADMIN_NO_OPEN==='1') {writeFileSync(path.join(dir,'start-url'),url,{mode:0o600});chmodSync(path.join(dir,'start-url'),0o600);} else execFile('/usr/bin/open',['-a','Google Chrome',url],()=>{});
 console.log('棋童数据管理已启动，仅本机可访问。关闭此终端可锁定管理入口。');
});
