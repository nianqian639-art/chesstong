import { expect, it, vi } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { buildServer } from '../src/server.js';
import { db } from '../src/services/db.js';
import { Chess } from 'chess.js';

it('synchronizes two players, moves, and a reconnect over real sockets', async () => {
  const app = buildServer();
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const sockets: WebSocket[] = [];
  let roomId = '';
  const connect = (token: string) => {
    const socket = new WebSocket(address.replace('http:', 'ws:') + '/ws?token=' + token);
    sockets.push(socket);
    const messages: any[] = [];
    socket.addEventListener('message', e => messages.push(JSON.parse(String(e.data))));
    return {
      socket,
      send: (type: string, payload = {}) => socket.send(JSON.stringify({ type, payload })),
      next: async (type: string, predicate = (_: any) => true) => {
        let found: any;
        await expect.poll(() => {
          const index = messages.findIndex(m => m.type === type && predicate(m.payload));
          if (index < 0) return false;
          found = messages.splice(index, 1)[0];
          return true;
        }, { timeout: 2000, interval: 20 }).toBe(true);
        return found.payload;
      }
    };
  };
  try {
    const register = async (suffix: string) => {
      const response = await app.inject({ method: 'POST', url: '/auth/register', payload: {
        account: 'ws_' + Date.now() + suffix, password: 'test123456', role: 'student', displayName: '联机测试' + suffix
      }});
      expect(response.statusCode).toBe(200);
      return response.json().token;
    };
    const whiteToken = await register('w');
    const blackToken = await register('b');
    const white = connect(whiteToken), black = connect(blackToken);
    await Promise.all([white.next('auth_ok'), black.next('auth_ok')]);
    const created = await app.inject({ method: 'POST', url: '/room/create', headers: { authorization: 'Bearer ' + whiteToken }, payload: { timeControl: { initialMinutes: 3, incrementSeconds: 2 }, asColor: 'white' }});
    expect(created.statusCode).toBe(200);
    const room = created.json(); roomId = room.roomId;
    white.send('join_room', { roomId });
    await white.next('game_state', p => p.status === 'waiting');
    const joined = await app.inject({ method: 'POST', url: '/room/join', headers: { authorization: 'Bearer ' + blackToken }, payload: { roomNumber: room.roomNumber }});
    expect(joined.statusCode).toBe(200);
    black.send('join_room', { roomId });
    await Promise.all([white.next('game_state', p => p.status === 'playing'), black.next('game_state', p => p.status === 'playing')]);
    const started = new Date(db.gameRooms.find(r => r.id === roomId)!.lastMoveTimestamp).getTime();
    await new Promise(resolve => setTimeout(resolve, 2100));
    white.send('move', { roomId, move: 'e2e4' });
    const [wa, ba] = await Promise.all([white.next('game_state', p => p.turn === 'b'), black.next('game_state', p => p.turn === 'b')]);
    expect(wa.fen).toBe(ba.fen);
    expect(wa.timeControl).toEqual({ initialMinutes: 3, incrementSeconds: 2 });
    const expectedWhiteMs = 180000 + 2000 - (Date.now() - started);
    expect(Math.abs(wa.white.timeRemainingMs - expectedWhiteMs)).toBeLessThan(500);
    expect(ba.white.timeRemainingMs).toBe(wa.white.timeRemainingMs);
    black.send('move', { roomId, move: 'e7e5' });
    await Promise.all([white.next('game_state', p => p.turn === 'w'), black.next('game_state', p => p.turn === 'w')]);
    white.socket.close();
    const reconnected = connect(whiteToken);
    await reconnected.next('auth_ok');
    reconnected.send('join_room', { roomId });
    const recovered = await reconnected.next('game_state');
    expect(recovered.fen).toContain('4p3/4P3');
    reconnected.send('ping');
    await reconnected.next('pong');
    const leave = (token: string, id: string, resign = false) => app.inject({ method: 'POST', url: '/room/' + id + '/leave', headers: { authorization: 'Bearer ' + token }, payload: { resign } });
    expect((await leave(whiteToken, roomId)).statusCode).toBe(409);
    expect(db.gameRooms.find(r => r.id === roomId)!.status).toBe('playing');
    expect((await leave(whiteToken, roomId, true)).statusCode).toBe(200);
    await black.next('game_over');
    expect(db.gameRooms.find(r => r.id === roomId)!.result).toBe('black');
    expect((await leave(whiteToken, roomId)).statusCode).toBe(200);
    const waiting = await app.inject({ method: 'POST', url: '/room/create', headers: { authorization: 'Bearer ' + whiteToken }, payload: { timeControl: { initialMinutes: 120, incrementSeconds: 15 }, asColor: 'white' }});
    const waitingId = waiting.json().roomId;
    expect((await leave(blackToken, waitingId)).statusCode).toBe(403);
    const matchCount = db.matches.length;
    expect((await leave(whiteToken, waitingId)).statusCode).toBe(200);
    expect(db.gameRooms.find(r => r.id === waitingId)!.status).toBe('finished');
    expect(db.matches.length).toBe(matchCount);
    const active = await app.inject({ method: 'GET', url: '/rooms/active', headers: { authorization: 'Bearer ' + whiteToken } });
    expect(active.json().rooms.some((r: any) => r.roomId === waitingId)).toBe(false);
  } finally {
    const room = db.gameRooms.find(r => r.id === roomId);
    if (room) room.status = 'finished';
    sockets.forEach(s => s.close());
    await app.close();
  }
});

it('validates draw responses, synchronizes HTTP/socket actions, preserves history and permits underpromotion', async () => {
  const app = buildServer();
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const sockets: WebSocket[] = [];
  const rooms: string[] = [];
  const register = async (suffix: string) => (await app.inject({ method:'POST', url:'/auth/register', payload:{account:'rules_'+Date.now()+suffix,password:'test123456',role:'student',displayName:'Rules '+suffix} })).json();
  const req = (u:any, url:string, payload?:any) => app.inject({method:payload===undefined?'GET':'POST',url,headers:{authorization:'Bearer '+u.token},...(payload===undefined?{}:{payload})});
  const connect = (u:any) => {
    const socket = new WebSocket(address.replace('http:','ws:')+'/ws?token='+u.token), messages:any[]=[];
    sockets.push(socket);socket.addEventListener('message',e=>messages.push(JSON.parse(String(e.data))));
    return { socket, send:(type:string,payload={})=>socket.send(JSON.stringify({type,payload})), next:async(type:string,predicate=(p:any)=>true)=>{
      let found:any;
      await expect.poll(()=>{const i=messages.findIndex(m=>m.type===type&&predicate(m.payload));if(i<0)return false;found=messages.splice(i,1)[0].payload;return true;},{timeout:2500,interval:20}).toBe(true);return found;
    }};
  };
  try {
    const a=await register('a'),b=await register('b'),outside=await register('x');
    const wa=connect(a),wb=connect(b),wx=connect(outside);
    await Promise.all([wa.next('auth_ok'),wb.next('auth_ok'),wx.next('auth_ok')]);
    const start=async()=>{
      const created=(await req(a,'/room/create',{timeControl:{initialMinutes:10,incrementSeconds:0},asColor:'white'})).json();rooms.push(created.roomId);
      expect((await req(b,'/room/join',{roomNumber:created.roomNumber})).statusCode).toBe(200);
      wa.send('join_room',{roomId:created.roomId});wb.send('join_room',{roomId:created.roomId});
      await Promise.all([wa.next('game_state',p=>p.roomId===created.roomId),wb.next('game_state',p=>p.roomId===created.roomId)]);
      return db.gameRooms.find(r=>r.id===created.roomId)!;
    };
    const room=await start(),url='/room/'+room.id+'/draw';
    for(const action of ['offer','accept','reject'])expect((await req(outside,url,{action})).statusCode).toBe(403);
    expect((await req(b,url,{action:'accept'})).statusCode).toBe(400);
    expect((await req(a,url,{action:'offer'})).statusCode).toBe(200);
    await wb.next('draw_offered',p=>p.roomId===room.id);
    await wb.next('game_state',p=>p.drawOfferFrom===a.user.id);
    expect((await req(a,url,{action:'accept'})).statusCode).toBe(400);
    expect((await req(a,url,{action:'reject'})).statusCode).toBe(400);
    expect((await req(b,url,{action:'offer'})).statusCode).toBe(409);
    wx.send('draw_offer',{roomId:room.id,action:'accept'});
    wx.send('ping');await wx.next('pong');expect(room.status).toBe('playing');
    expect(room.drawOfferFrom).toBe(a.user.id);
    wb.send('draw_offer',{roomId:room.id,action:'reject'});
    await wa.next('draw_rejected');expect(room.drawOfferFrom).toBeNull();
    wa.send('draw_offer',{roomId:room.id,action:'offer'});await wb.next('draw_offered');
    wa.send('move',{roomId:room.id,move:'e2e4'});await wb.next('game_state',p=>p.turn==='b');expect(room.drawOfferFrom).toBeNull();
    wb.send('move',{roomId:room.id,move:'e7e5'});await wa.next('game_state',p=>p.roomId===room.id&&p.fen.includes('4p3/4P3'));
    expect(room.pgn).toContain('1. e4 e5');
    expect((await req(a,url,{action:'offer'})).statusCode).toBe(200);
    expect((await req(b,'/room/'+room.id)).json().drawOfferFrom).toBe(a.user.id);
    const count=db.matches.length;
    expect((await req(b,url,{action:'accept'})).statusCode).toBe(200);
    await Promise.all([wa.next('game_over',p=>p.roomId===room.id),wb.next('game_over',p=>p.roomId===room.id)]);
    expect(room.status).toBe('finished');expect(room.result).toBe('draw');expect(db.matches.length).toBe(count+2);
    expect((await req(b,url,{action:'accept'})).statusCode).toBe(400);expect(db.matches.length).toBe(count+2);
    const promote=await start();promote.fen='6k1/Pp6/8/8/8/8/2P4p/2K5 w - - 0 1';promote.pgn='';promote.turn='w';
    wa.send('move',{roomId:promote.id,move:'a7a8n'});
    expect((await wb.next('game_state',p=>p.roomId===promote.id&&p.turn==='b')).fen).toMatch(/^N5k1/);
    wb.send('move',{roomId:promote.id,move:'h2h1n'});
    expect((await wa.next('game_state',p=>p.roomId===promote.id&&p.fen.includes('2K4n')&&p.turn==='w')).fen).toContain('2K4n');
    expect(promote.pgn).toContain('a8=N');expect(promote.pgn).toContain('h1=N');
    expect((await req(outside,'/room/'+promote.id+'/resign',{})).statusCode).toBe(403);
    expect((await req(a,'/room/'+promote.id+'/resign',{})).statusCode).toBe(200);
    await wb.next('game_over',p=>p.roomId===promote.id&&p.reason==='resign');
    const repetition=await start();
    const expected=new Chess();
    for(const [sender,move,turn] of [[wa,'g1f3','b'],[wb,'g8f6','w'],[wa,'f3g1','b'],[wb,'f6g8','w'],[wa,'g1f3','b'],[wb,'g8f6','w'],[wa,'f3g1','b'],[wb,'f6g8','w']] as const){
      expected.move(move);
      sender.send('move',{roomId:repetition.id,move});await wa.next('game_state',p=>p.roomId===repetition.id&&p.fen===expected.fen()&&p.turn===turn);
    }
    await wb.next('game_over',p=>p.roomId===repetition.id);expect(repetition.result).toBe('draw');
    expect(repetition.pgn).toContain('4. Ng1 Ng8');
    const timeout=await start(),beforeTimeout=db.matches.length;
    timeout.players.white!.timeRemainingMs=1;timeout.lastMoveTimestamp=new Date(Date.now()-100).toISOString();
    wa.send('move',{roomId:timeout.id,move:'e2e4'});
    await wb.next('game_state',p=>p.roomId===timeout.id&&p.status==='finished');
    await wb.next('game_over',p=>p.roomId===timeout.id&&p.reason==='timeout');
    expect(timeout.drawOfferFrom).toBeNull();expect(db.matches.length).toBe(beforeTimeout+2);
    expect(db.matches.slice(-2).map(m=>m.result)).toEqual(['lose','win']);
    const disconnected=await start(),beforeDisconnect=db.matches.length;
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
    wa.socket.close();await delay(50);
    await vi.advanceTimersByTimeAsync(60001);
    vi.useRealTimers();
    await wb.next('game_state',p=>p.roomId===disconnected.id&&p.status==='finished');
    await wb.next('game_over',p=>p.roomId===disconnected.id&&p.reason==='disconnect');
    expect(disconnected.resultReason).toBe('disconnect');expect(db.matches.length).toBe(beforeDisconnect+2);
  } finally {
    vi.useRealTimers();
    rooms.forEach(id=>{const r=db.gameRooms.find(r=>r.id===id);if(r)r.status='finished';});
    sockets.forEach(s=>s.close());await app.close();
  }
});
