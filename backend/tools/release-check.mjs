// Run against the built application with an isolated database, never production records.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
process.env.CHESSTONG_DATA_DIR=mkdtempSync(path.join(tmpdir(),'chesstong-release-check-'));
const {buildServer}=await import('../dist/server.js');
const {db,closeDatabase}=await import('../dist/services/db.js');
const app=buildServer(),checks=[],sockets=[];
const pass=name=>{checks.push(name);console.log('CHECK PASS: '+name);};
const req=async(u,url,method='GET',payload,status=200)=>{
 const r=await app.inject({method,url,headers:u?{authorization:'Bearer '+u.token}:{},...(payload===undefined?{}:{payload})});
 assert.equal(r.statusCode,status,url+': '+r.body.slice(0,180));return r.json();
};
const account=async(role,n)=>req(null,'/auth/register','POST',{account:'release_'+n,password:'ReleaseCheck2026',role,displayName:'Release check '+n});
try{
 await req(null,'/health');
 for(const url of ['/admin/overview','/admin/ai-status'])await req(null,url,'GET',undefined,403);
 for(const url of ['/friends/list','/class/my-classes','/parent/my-children','/points/ledger','/rankings/global'])await req(null,url,'GET',undefined,401);
 pass('health, public administration closed, authenticated feature boundaries');
 const a=await account('student','child'),b=await account('student','friend'),t=await account('teacher','teacher'),p=await account('parent','parent'),x=await account('parent','other');
 await req(null,'/auth/login','POST',{account:'release_child',password:'incorrect'},400);
 await req(null,'/auth/login','POST',{account:'release_child',password:'ReleaseCheck2026'});
 const before=db.attempts.length,trial=await req(null,'/trial/problems/submit','POST',{problemId:'starter-001',answer:'a1a8'});
 assert.equal(trial.awardedPoints,0);assert.equal(db.attempts.length,before);
 await req(a,'/problems/submit','POST',{problemId:'starter-001',answer:'a1a8'});
 assert.equal((await req(a,'/problems/submit','POST',{problemId:'starter-001',answer:'a1a8'})).awardedPoints,0);
 const missions=await req(a,'/missions/today');const daily=missions.missions.find(m=>m.condition.type==='login');
 await req(a,'/missions/claim','POST',{missionId:daily.id});await req(a,'/missions/claim','POST',{missionId:daily.id},400);
 for(const url of ['/rankings/global','/rankings/puzzle','/rankings/battle','/points/ledger','/match/history'])await req(a,url);
 pass('account login, trial isolation, puzzle answer, no duplicate rewards, rankings');
 const cls=(await req(t,'/class/create','POST',{name:'Release check class'})).class;
 await req(a,'/class/join','POST',{inviteCode:cls.inviteCode});
 await req(t,`/class/${cls.id}/notice`,'POST',{message:'Release check notice'});
 const hw=(await req(t,`/class/${cls.id}/homework`,'POST',{title:'Release check mate',fen:'6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1',solutions:['Ra8#'],dueDate:'2099-01-01'})).homework;
 assert.equal((await req(a,`/class/${cls.id}`)).homeworks[0].acceptedAnswers,undefined);
 assert.equal((await req(a,`/class/${cls.id}/homework/${hw.id}/submit`,'POST',{answer:'a1a8'})).isCorrect,true);
 const old=(await req(a,'/student/my-code')).code;
 const fresh=(await req(a,'/student/regenerate-code','POST',{})).code;
 await req(p,'/parent/bind-child','POST',{code:old},404);await req(p,'/parent/bind-child','POST',{code:fresh});
 await req(x,`/parent/child/${a.user.id}/detail`,'GET',undefined,403);
 await req(p,`/parent/child/${a.user.id}/detail`);await req(t,`/class/${cls.id}/progress`);await req(p,`/class/${cls.id}/progress`);
 const deadline=new Date(Math.floor((Date.now()+60*60*1000)/1000)*1000),beijingDeadline=new Date(deadline.getTime()+8*60*60*1000).toISOString().slice(0,19)+'+08:00';
 await req(p,'/parent/study-plan','POST',{childId:a.user.id,dailySolveTarget:3,dailyBattleTarget:1,startDate:'2026-01-01',endDate:'2099-01-01',deadlineAt:beijingDeadline});
 const plan=db.studyPlans.find(v=>v.childId===a.user.id);
 assert.equal(plan.deadlineAt,deadline.toISOString());assert.equal((await req(a,'/student/study-plans')).plans[0].status,'active');
 await req(p,'/parent/study-plan/'+plan.id,'PUT',{dailySolveTarget:4,deadlineAt:new Date(Date.now()-1000).toISOString()});assert.equal((await req(a,'/student/study-plans')).plans[0].status,'expired');
 await req(p,'/parent/study-plan/'+plan.id,'DELETE');
 const taskDeadline=new Date(Date.now()+60000).toISOString(),tasks=[];
 for(let i=0;i<5;i++)tasks.push((await req(p,'/parent/task','POST',{childId:a.user.id,title:'Release task '+i,deadlineAt:taskDeadline})).task);
 await req(p,'/parent/task','POST',{childId:a.user.id,title:'Release task 6',deadlineAt:taskDeadline},400);
 const pointsBefore=db.users.find(v=>v.id===a.user.id).points;
 assert.equal((await req(a,'/student/parent-task/'+tasks[0].id+'/complete','POST',{})).pointsAwarded,10);
 assert.equal((await req(a,'/student/parent-task/'+tasks[0].id+'/complete','POST',{})).pointsAwarded,0);
 assert.equal(db.users.find(v=>v.id===a.user.id).points-pointsBefore,10);
 db.parentTasks.find(v=>v.id===tasks[1].id).deadlineAt=new Date(Date.now()-1000).toISOString();
 assert.equal((await req(a,'/student/parent-tasks')).tasks.find(v=>v.id===tasks[1].id).status,'expired');
 pass('teacher class and homework, child submission, parent binding, progress, plan lifecycle and isolation');
 await req(a,'/friends/request','POST',{toUserId:b.user.id});await req(b,'/friends/request','POST',{toUserId:a.user.id});
 assert.ok((await req(a,'/friends/search?q=release_friend')).results.some(r=>r.userId===b.user.id));
 await req(a,'/chat/send','POST',{toUserId:b.user.id,message:'Release check message'});
 assert.equal((await req(b,'/chat/unread')).total,1);assert.equal((await req(b,'/chat/history/'+a.user.id)).messages.length,1);
 const invite=await req(a,'/game-request/send','POST',{toUserId:b.user.id,timeControl:{initialMinutes:3,incrementSeconds:2}});
 const room=await req(b,'/game-request/'+invite.requestId+'/accept','POST',{});
 await req(a,'/room/'+room.roomId);await req(b,'/room/'+room.roomId);
 const address=await app.listen({host:'127.0.0.1',port:0});
 function connect(user){const socket=new WebSocket(address.replace(/^http/,'ws')+'/ws?token='+user.token),messages=[];sockets.push(socket);socket.addEventListener('message',e=>messages.push(JSON.parse(String(e.data))));return{socket,send:(type,payload)=>socket.send(JSON.stringify({type,payload})),next:async(type,predicate=()=>true)=>{const until=Date.now()+5000;while(Date.now()<until){const i=messages.findIndex(m=>m.type===type&&predicate(m.payload));if(i>=0)return messages.splice(i,1)[0].payload;await new Promise(r=>setTimeout(r,30));}throw Error('Timeout '+type);}};}
 const wa=connect(a),wb=connect(b);await Promise.all([wa.next('auth_ok'),wb.next('auth_ok')]);
 wa.send('join_room',{roomId:room.roomId});wb.send('join_room',{roomId:room.roomId});await Promise.all([wa.next('game_state'),wb.next('game_state')]);
 wa.send('move',{roomId:room.roomId,move:'e2e4'});await wb.next('game_state',v=>v.turn==='b');
 wb.send('move',{roomId:room.roomId,move:'e7e5'});await wa.next('game_state',v=>v.turn==='w');
 wa.socket.close();const restored=connect(a);await restored.next('auth_ok');restored.send('join_room',{roomId:room.roomId});assert.match((await restored.next('game_state')).fen,/4p3\/4P3/);
 restored.send('chat_send',{toUserId:x.user.id,message:'must not send'});await restored.next('error');
 await req(a,'/room/'+room.roomId+'/leave','POST',{resign:true});await wb.next('game_over');
 pass('friend search, chat delivery, challenge room, real two-player sockets, moves, reconnect, exit');
 for(const control of ['1+0','3+2','5+3','10+0','15+10','30+10','120+15']){
  const [initialMinutes,incrementSeconds]=control.split('+').map(Number);const payload={timeControl:{initialMinutes,incrementSeconds}};
  await req(a,'/arena/join','POST',payload);await req(b,'/arena/join','POST',payload);
  const aa=await req(a,'/arena/status'),bb=await req(b,'/arena/status');assert.ok(aa.roomId);assert.equal(aa.roomId,bb.roomId);
  await req(a,'/room/'+aa.roomId+'/leave','POST',{resign:true});
 }
 pass('public matchmaking with all seven time controls');
 if(process.env.RELEASE_LIVE_MODELS==='1'){
  const suggestion=await req(null,'/trial/match/suggest','POST',{fen:new (await import('chess.js')).Chess().fen(),difficulty:10});assert.equal(suggestion.source,'stockfish');
  const explanation=await req(null,'/trial/problems/explain','POST',{problemId:'starter-001',answer:'a1a8',isCorrect:true,language:'en'});assert.equal(explanation.source,'qwen');assert.ok(!/[\u3400-\u9fff]/.test(explanation.explanation));
  pass('live Stockfish and Qwen English output');
  for(const language of ['zh','en']){const voice=await req(a,'/tts','POST',{text:language==='zh'?'我们开始学习国际象棋。':'Let us learn chess together.',preset:'story',language});assert.ok(voice.url);assert.ok(['dashscope','dashscope-direct'].includes(voice.source));console.log('TTS '+language+': '+voice.source);}
  pass('live Chinese and English voice generation');
 }
 await req(a,'/auth/logout','POST',{});await req(a,'/friends/list','GET',undefined,401);
 pass('logout invalidation');
 writeFileSync(path.join(process.env.CHESSTONG_DATA_DIR,'report.json'),JSON.stringify({passed:checks,date:new Date().toISOString()},null,2));
 console.log('RELEASE CHECK COMPLETE: '+checks.length+' groups; production database untouched.');
}finally{sockets.forEach(s=>s.close());await app.close();closeDatabase();}
