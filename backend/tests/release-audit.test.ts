import {afterAll,expect,it} from 'vitest';
import {buildServer} from '../src/server.js';
import {db} from '../src/services/db.js';
import {Chess} from 'chess.js';

const app=buildServer();
afterAll(()=>app.close());
const register=async(suffix:string)=>{
 const account='release_'+Date.now()+'_'+suffix;
 const r=await app.inject({method:'POST',url:'/auth/register',payload:{account,password:'test123456',displayName:'Audit '+suffix,role:'student'}});
 expect(r.statusCode).toBe(200);return {...r.json(),account};
};
const req=(u:any,url:string,method:any='GET',payload?:any)=>app.inject({method,url,headers:{authorization:'Bearer '+u.token},...(payload===undefined?{}:{payload})});

it('uses account passwords, invalidates logout and expired sessions, and isolates trial data',async()=>{
 const u=await register('login');
 expect((await app.inject({method:'POST',url:'/auth/login',payload:{account:u.account,password:'wrong12345'}})).statusCode).toBe(400);
 expect((await app.inject({method:'POST',url:'/auth/login',payload:{account:u.account,password:'test123456'}})).statusCode).toBe(200);
 const before=db.attempts.length;
 const trial=await app.inject({method:'POST',url:'/trial/problems/submit',payload:{problemId:'starter-001',answer:'a1a8'}});
 expect(trial.json().awardedPoints).toBe(0);expect(db.attempts.length).toBe(before);
 await req(u,'/auth/logout','POST',{});expect((await req(u,'/missions/today')).statusCode).toBe(401);
 const v=await register('expiry');db.sessions.find(s=>s.token===v.token)!.expiresAt=new Date(0).toISOString();
 expect((await req(v,'/missions/today')).statusCode).toBe(401);
});

it('finds friends by account and preserves HTTP chat, unread state and challenge rooms for all seven controls',async()=>{
 const a=await register('friends_a'),b=await register('friends_b'),other=await register('outsider');
 const search=await req(a,'/friends/search?q='+b.account);expect(search.json().results.some((r:any)=>r.userId===b.user.id)).toBe(true);
 expect((await req(a,'/chat/send','POST',{toUserId:b.user.id,message:'before friendship'})).statusCode).toBe(403);
 expect((await req(a,'/friends/request','POST',{toUserId:b.user.id})).statusCode).toBe(200);
 const invite=(await req(b,'/friends/requests')).json().incoming.find((r:any)=>r.userId===a.user.id);
 expect((await req(other,'/friends/accept','POST',{requestId:invite.requestId})).statusCode).toBe(404);
 await req(b,'/friends/accept','POST',{requestId:invite.requestId});
 await req(a,'/chat/send','POST',{toUserId:b.user.id,message:'HTTP delivery audit'});
 expect((await req(b,'/chat/unread')).json().total).toBe(1);
 expect((await req(b,'/chat/history/'+a.user.id)).json().messages[0].message).toBe('HTTP delivery audit');
 expect((await req(b,'/chat/unread')).json().total).toBe(0);
 for(const time of ['1+0','3+2','5+3','10+0','15+10','30+10','120+15']){
  const [initialMinutes,incrementSeconds]=time.split('+').map(Number),timeControl={initialMinutes,incrementSeconds};
  const sent=(await req(a,'/game-request/send','POST',{toUserId:b.user.id,timeControl})).json();
  expect((await req(other,`/game-request/${sent.requestId}/accept`,'POST',{})).statusCode).toBe(404);
  const accepted=await req(b,`/game-request/${sent.requestId}/accept`,'POST',{});expect(accepted.statusCode).toBe(200);
  const room=accepted.json();
  expect((await req(a,'/room/'+room.roomId)).json().timeControl).toEqual(timeControl);
  expect((await req(b,'/room/'+room.roomId)).statusCode).toBe(200);
  expect((await req(a,'/game-request/outgoing')).json().requests.find((r:any)=>r.requestId===sent.requestId).roomId).toBe(room.roomId);
  expect((await req(b,`/game-request/${sent.requestId}/accept`,'POST',{})).statusCode).toBe(404);
  await req(b,'/room/'+room.roomId+'/leave','POST',{resign:true});
 }
});

it('enforces friendship and revoked-session checks on real WebSocket chat',async()=>{
 const address=await app.listen({host:'127.0.0.1',port:0});
 const a=await register('ws_a'),b=await register('ws_b');
 const socket=new WebSocket(address.replace(/^http/,'ws')+'/ws?token='+a.token);
 const messages:any[]=[];socket.addEventListener('message',e=>messages.push(JSON.parse(String(e.data))));
 const take=async(type:string)=>{await expect.poll(()=>messages.some(m=>m.type===type)).toBe(true);return messages.splice(messages.findIndex(m=>m.type===type),1)[0];};
 try{
  await take('auth_ok');const before=db.chatMessages.length;
  socket.send(JSON.stringify({type:'chat_send',payload:{toUserId:b.user.id,message:'blocked'}}));await take('error');expect(db.chatMessages.length).toBe(before);
  await req(a,'/friends/request','POST',{toUserId:b.user.id});await req(b,'/friends/request','POST',{toUserId:a.user.id});
  socket.send(JSON.stringify({type:'chat_send',payload:{toUserId:b.user.id,message:'delivered'}}));await take('chat_receive');expect(db.chatMessages.length).toBe(before+1);
  await req(a,'/auth/logout','POST',{});
  socket.send(JSON.stringify({type:'chat_send',payload:{toUserId:b.user.id,message:'after logout'}}));await take('error');expect(db.chatMessages.length).toBe(before+1);
 }finally{socket.close();}
});

it('rejects foreign and forged AI games, saves the final mate and awards points once',async()=>{
 const a=await register('match_a'),b=await register('match_b');
 const start=(await req(a,'/match/start','POST',{mode:'standard',difficulty:1})).json();
 const payload={matchId:start.matchId,fen:start.matchState,move:'e2e4',difficulty:1};
 expect((await req(b,'/match/move','POST',payload)).statusCode).toBe(404);
 expect((await req(a,'/match/move','POST',{...payload,fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',move:'g6g7'})).statusCode).toBe(409);
 expect((await req(a,'/match/move','POST',{...payload,move:'e2e5'})).statusCode).toBe(400);
 // Seed a legitimate near-mate server state; the client cannot choose this board.
 const match=db.matches.find(m=>m.id===start.matchId)!;const board=new Chess('7k/8/5KQ1/8/8/8/8/8 w - - 0 1');
 match.fen=board.fen();match.pgn=board.pgn();
 const mate={...payload,fen:match.fen,move:'g6g7'};
 const outcomes=await Promise.all([req(a,'/match/move','POST',mate),req(a,'/match/move','POST',mate)]);
 expect(outcomes.map(r=>r.statusCode).sort()).toEqual([200,409]);
 expect(db.users.find(u=>u.id===a.user.id)!.points).toBe(20);
 expect(db.matches.find(m=>m.id===start.matchId)!.pgn).toContain('Qg7#');
 expect((await req(a,'/match/move','POST',mate)).statusCode).toBe(409);
 expect(db.pointLedger.filter(l=>l.userId===a.user.id)).toHaveLength(1);
});
