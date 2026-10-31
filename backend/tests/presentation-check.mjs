import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:18880';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
async function player(suffix){
  const r=await fetch(base+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account:'visual_'+Date.now()+suffix,password:'test123456',displayName:'Player '+suffix,role:'student'})});
  assert.equal(r.status,200);const auth=await r.json();
  const context=await browser.newContext({viewport:{width:1280,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(auth=>{localStorage.setItem('ct_token',auth.token);localStorage.setItem('ct_user',JSON.stringify(auth.user));},auth);
  await page.goto(base+'/app');await page.waitForFunction(()=>typeof ws!=='undefined' && ws?.readyState===1);
  return {page,auth,context};
}
try{
 const white=await player('white'),black=await player('black');
 await white.page.evaluate(async()=>{navTo('pvp');await createPvpRoom();});
 await white.page.waitForFunction(()=>latestPvpState?.status==='waiting');
 const number=await white.page.evaluate(()=>latestPvpState.roomNumber);
 await black.page.evaluate(async(number)=>{navTo('pvp');document.getElementById('joinRoomCode').value=number;await joinPvpRoom();},number);
 await Promise.all([white.page.waitForFunction(()=>latestPvpState?.status==='playing'),black.page.waitForFunction(()=>latestPvpState?.status==='playing')]);
 assert.equal(await black.page.locator('#pvpBoard .cell').first().getAttribute('data-square'),'h1');
 assert.equal(await white.page.locator('#pvpBoard .cell').first().getAttribute('data-square'),'a8');
 assert.equal(await black.page.locator('#pvpBoard .board-files-top').innerText(),'h\ng\nf\ne\nd\nc\nb\na');
 for(const [p,from,to,turn] of [[white,'f2','f3','b'],[black,'e7','e5','w'],[white,'g2','g4','b'],[black,'d8','h4','w']]){
   await p.page.locator(`#pvpBoard [data-square="${from}"]`).click();await p.page.locator(`#pvpBoard [data-square="${to}"]`).click();
   await white.page.waitForFunction(turn=>latestPvpState?.turn===turn,turn);
 }
 await Promise.all([white.page.waitForSelector('#gameResultOverlay'),black.page.waitForSelector('#gameResultOverlay')]);
 assert.equal(await white.page.locator('#pvpBoard [data-square="h4"] .piece').innerText(),'♛');
 assert.equal(await black.page.locator('#pvpBoard [data-square="h4"] .piece').innerText(),'♛');
 assert.equal(await white.page.locator('#gameResultTitle').innerText(),'惜败');assert.equal(await black.page.locator('#gameResultTitle').innerText(),'胜利');
 await black.page.evaluate(async()=>{await document.fonts.load('80px CTBrush');});
 await black.page.screenshot({path:'/tmp/ct-mate-brush.png'});
 for(const lang of ['en','fr','es','ja','zh']){
  await black.page.evaluate(lang=>setLang(lang),lang);
  assert.equal(await black.page.locator('#gameResultTitle').innerText(),({en:'Victory',fr:'Victoire',es:'Victoria',ja:'勝利',zh:'胜利'})[lang]);
 }
 await black.page.evaluate(()=>closeGameResult());
 for(const lang of ['en','fr','es']){
  await black.page.evaluate(lang=>setLang(lang),lang);
  for(const view of ['pvp','friends','dashboard','classStudent','rankings','learn','battle']){
   await black.page.evaluate(v=>navTo(v),view);await black.page.waitForTimeout(250);
   const body=await black.page.locator('body').innerText();
   const chinese=body.split('\n').filter(line=>/[\u3400-\u9fff]/.test(line) && !/中文|日本語|棋童/.test(line));
   assert.deepEqual(chinese,[],`Untranslated UI in ${lang}/${view}`);
  }
  await black.page.evaluate(()=>{showLearnSection('principles');});
  assert.ok(!/[\u3400-\u9fff]/.test(await black.page.locator('#learnContent').innerText()));
 }
 await black.page.evaluate(()=>{setLang('en');navTo('pvp');setInterfaceFont('serif');setResultFont('brush');showGameResult('victory','checkmate');});
 await black.page.waitForSelector('#gameResultOverlay');await black.page.evaluate(async()=>{await document.fonts.load('80px CTHand');});
 await black.page.screenshot({path:'/tmp/ct-mate-english.png'});
 await black.page.setViewportSize({width:390,height:844});
 await black.page.evaluate(()=>{setLang('zh');setInterfaceFont('default');showGameResult('victory','checkmate');});
 await black.page.waitForSelector('#gameResultOverlay');
 await black.page.waitForTimeout(500);
 await black.page.screenshot({path:'/tmp/ct-mate-mobile.png'});
 const bounds=await black.page.locator('.game-result-card').boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390);
 await black.page.evaluate(()=>setInterfaceFont('serif'));
 await black.page.reload();await black.page.waitForSelector('#interfaceFont');assert.equal(await black.page.locator('#interfaceFont').inputValue(),'serif');
 await black.page.evaluate(()=>setLang('en'));
 assert.equal(await black.page.locator('#resultFont').inputValue(),'brush');
 assert.deepEqual(errors,[]);console.log('PASS: black orientation and legal click mapping, mate final board, both results, five languages, font persistence.');
}finally{await browser.close();}
