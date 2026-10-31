// Real browser actions against the built release, with a disposable database.
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
process.env.CHESSTONG_DATA_DIR=mkdtempSync(join(tmpdir(),'ct-game-actions-'));
const {buildServer}=await import('../dist/server.js');
const {db,closeDatabase}=await import('../dist/services/db.js');
const app=buildServer(),base=await app.listen({host:'127.0.0.1',port:0});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
const fen='6k1/Pp6/8/8/8/8/2P4p/2K5 w - - 0 1';
let count=0;
async function req(user,url,body){
 const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(user?{authorization:'Bearer '+user.auth.token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal(response.status,200,url+': '+await response.clone().text());return response.json();
}
async function account(role){
 const auth=await req(null,'/auth/register',{account:'actions_'+count++,password:'test123456',role,displayName:'Actions '+role+count});
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(auth=>{localStorage.setItem('ct_token',auth.token);localStorage.setItem('ct_user',JSON.stringify(auth.user));},auth);
 await page.goto(base+'/app');await page.waitForFunction(()=>typeof ws!=='undefined'&&ws?.readyState===1);
 return {auth,context,page};
}
async function enter(user,number){
 await user.page.evaluate(async number=>{navTo('pvp');document.getElementById('joinRoomCode').value=number;await joinPvpRoom();},number);
}
async function start(a,b,position){
 const created=await req(a,'/room/create',{timeControl:{initialMinutes:10,incrementSeconds:0},asColor:'white'});
 const room=db.gameRooms.find(r=>r.id===created.roomId);
 if(position){room.fen=position;room.pgn='';room.turn='w';}
 await enter(b,created.roomNumber);await enter(a,created.roomNumber);
 await Promise.all([a,b].map(u=>u.page.waitForFunction(id=>latestPvpState?.roomId===id&&latestPvpState.status==='playing',room.id)));
 return room;
}
async function exit(...players){
 for(const p of players)await p.page.evaluate(async()=>{closeGameResult();await exitPvpRoom();});
}
try{
 const anonymous=await browser.newPage();anonymous.on('pageerror',e=>errors.push(e.message));
 await anonymous.goto(base+'/app');await anonymous.waitForURL(base+'/');
 for(const lang of ['zh','en','ja','fr','es']){
  await anonymous.evaluate(lang=>setLang(lang),lang);
  const labels=await anonymous.locator('[data-i18n-placeholder]').evaluateAll(nodes=>nodes.map(n=>n.placeholder));
  assert.ok(labels.length>=3&&labels.every(Boolean));
  if(['en','fr','es'].includes(lang))assert.ok(labels.every(v=>!/[\u3400-\u9fff]/.test(v)),lang+' placeholders');
 }
 console.log('CHECK PASS: anonymous app redirects cleanly; five-language login placeholders');
 const a=await account('student'),b=await account('student');
 const draw=await start(a,b);
 await a.page.locator('#offerDrawButton').click();await b.page.locator('#pvpDrawOffer').waitFor({state:'visible'});
 await b.page.reload();await b.page.waitForFunction(()=>latestPvpState?.drawOfferFrom);
 await b.page.locator('#pvpDrawOffer button').nth(1).click();await a.page.waitForFunction(()=>!latestPvpState?.drawOfferFrom);
 await a.page.locator('#offerDrawButton').click();await b.page.locator('#pvpDrawOffer').waitFor({state:'visible'});
 await b.page.evaluate(async()=>{const socket=ws;socket.close();await new Promise(resolve=>socket.addEventListener('close',resolve,{once:true}));clearTimeout(wsReconnectTimer);wsReconnectTimer=null;});
 await b.page.locator('#pvpDrawOffer button').first().click();
 await Promise.all([a,b].map(u=>u.page.waitForFunction(()=>latestPvpState?.status==='finished'&&latestPvpState.result==='draw')));
 assert.equal(draw.result,'draw');
 console.log('CHECK PASS: browser draw offer, refresh, reject, accept while socket disconnected');
 await exit(a,b);await b.page.evaluate(()=>connectWs());await b.page.waitForFunction(()=>ws?.readyState===1);
 const promotion=await start(a,b,fen);
 const clickPromotion=async(u,from,to)=>{await u.page.locator('#pvpBoard [data-square="'+from+'"]').click();await u.page.locator('#pvpBoard [data-square="'+to+'"]').click();await u.page.locator('#promotionOverlay').waitFor();};
 await clickPromotion(a,'a7','a8');
 assert.equal(await a.page.locator('[data-promotion="q"]').evaluate(el=>el===document.activeElement),true);
 await a.page.keyboard.press('Shift+Tab');assert.equal(await a.page.locator('#cancelPromotion').evaluate(el=>el===document.activeElement),true);
 await a.page.keyboard.press('Escape');await a.page.locator('#promotionOverlay').waitFor({state:'detached'});assert.equal(promotion.fen,fen);
 await clickPromotion(a,'a7','a8');await a.page.locator('[data-promotion="n"]').click();
 await b.page.waitForFunction(()=>latestPvpState?.fen.startsWith('N5k1'));
 await clickPromotion(b,'h2','h1');await b.page.locator('[data-promotion="r"]').click();
 await a.page.waitForFunction(()=>latestPvpState?.fen.includes('2K4r'));
 assert.ok(promotion.pgn.includes('a8=N')&&promotion.pgn.includes('h1=R'));
 a.page.on('dialog',d=>d.accept());await a.page.evaluate(()=>resignPvp());await b.page.waitForFunction(()=>latestPvpState?.status==='finished');
 console.log('CHECK PASS: actual white and black underpromotion, keyboard focus and Escape cancellation, full PGN');
 await exit(a,b);
 const stale=await start(a,b,fen);await clickPromotion(a,'a7','a8');
 await req(b,'/room/'+stale.id+'/resign',{});await a.page.locator('#promotionOverlay').waitFor({state:'detached'});assert.equal(stale.fen,fen);
 console.log('CHECK PASS: a finished game cancels pending promotion without sending a stale move');
 const teacher=await account('teacher');
 const cls=(await req(teacher,'/class/create',{name:'Promotion class'})).class;
 await req(a,'/class/join',{inviteCode:cls.inviteCode});
 await req(teacher,'/class/'+cls.id+'/homework',{title:'Choose a rook',fen,solutions:['a7a8r'],dueDate:'2099-01-01'});
 await a.page.evaluate(()=>{closeGameResult();navTo('classStudent');});
 await a.page.locator('#classStudentContent button').first().click();await a.page.locator('[data-hw]').first().click();
 await a.page.locator('#homeworkBoard [data-square="a7"]').click();await a.page.locator('#homeworkBoard [data-square="a8"]').click();
 await a.page.locator('[data-promotion="r"]').click();assert.equal(await a.page.locator('#homeworkAnswer').inputValue(),'a7a8r');
 await a.page.locator('#submitHomework').click();await a.page.waitForFunction(()=>document.getElementById('homeworkFeedback').textContent==='正确');
 console.log('CHECK PASS: homework promotion selection and five-character answer submission');
 assert.deepEqual(errors,[]);
 console.log('GAME ACTIONS COMPLETE: 5 groups; no browser errors; isolated database.');
}catch(error){console.error(error);process.exitCode=1;}
finally{db.gameRooms.filter(r=>r.status==='playing').forEach(r=>{r.status='finished';});await browser.close();await app.close();closeDatabase();}
