import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:18880';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];let count=0;
async function account(role){
 const response=await fetch(base+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account:`manage_${Date.now()}_${count++}`,password:'test123456',displayName:`Audit ${role} ${count}`,role})});assert.equal(response.status,200);const auth=await response.json();
 const context=await browser.newContext({viewport:{width:1280,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(auth=>{localStorage.setItem('ct_token',auth.token);localStorage.setItem('ct_user',JSON.stringify(auth.user));},auth);await page.goto(base+'/app');await page.waitForFunction(()=>typeof manageEl==='function');return {auth,page,context};
}
try{
 const teacher=await account('teacher'),student=await account('student'),parent=await account('parent'),opponent=await account('student');
 await teacher.page.locator('#navClassTeacher').click();await teacher.page.locator('#clsName').fill('Audit Class');await teacher.page.getByRole('button',{name:'创建',exact:true}).click();await teacher.page.waitForSelector('#noticeMsg');
 const classId=await teacher.page.locator('#clsSelect').inputValue();const invite=(await teacher.page.locator('#createResult').innerText()).match(/\d{6}/)[0];
 await student.page.locator('#navClassStudent').click();await student.page.locator('#joinCode').fill(invite);await student.page.getByRole('button',{name:'加入班级',exact:true}).click();await student.page.locator('#classStudentContent button').first().waitFor();
 await teacher.page.locator('#noticeMsg').fill('Practice this position');await teacher.page.locator('#classTeacherDetail button').filter({hasText:'发送'}).click();await teacher.page.waitForFunction(()=>document.getElementById('classTeacherDetail').innerText.includes('Practice this position'));
 await teacher.page.getByRole('button',{name:'布置棋盘作业',exact:true}).click();await teacher.page.locator('#hwTitle').fill('Rook mate');await teacher.page.locator('#hwSolutions').fill('Ra8#');await teacher.page.locator('[data-piece="Q"]').click();assert.equal(await teacher.page.locator('#hwTitle').inputValue(),'Rook mate');
 await teacher.page.locator('#editorFenInput').fill('6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1');await teacher.page.getByRole('button',{name:'应用局面',exact:true}).click();await teacher.page.getByRole('button',{name:'保存',exact:true}).click();await teacher.page.waitForSelector('#noticeMsg');
 await student.page.locator('#classStudentContent button').first().click();await student.page.locator('[data-hw]').first().click();await student.page.locator('#homeworkBoard [data-square="a1"]').click();await student.page.locator('#homeworkBoard [data-square="a8"]').click();assert.equal(await student.page.locator('#homeworkAnswer').inputValue(),'a1a8');await student.page.locator('#submitHomework').click();await student.page.waitForFunction(()=>document.getElementById('homeworkFeedback').textContent==='正确');
 await teacher.page.evaluate(id=>showClassDetail(id),classId);assert.ok((await teacher.page.locator('#classTeacherDetail').innerText()).includes('已完成'));
 await student.page.evaluate(()=>generateBindCode());await student.page.waitForFunction(()=>/^\d{6}$/.test(document.getElementById('bindCodeDisplay').textContent));const previousCode=await student.page.locator('#bindCodeDisplay').innerText();await student.page.locator('#btnRegenCode').click();await student.page.waitForFunction(previous=>document.getElementById('bindCodeDisplay').textContent!==previous,previousCode);const code=await student.page.locator('#bindCodeDisplay').innerText();await student.page.evaluate(()=>closeBindModal());
 await parent.page.locator('#navParent').click();await parent.page.locator('#bindCode').fill(code);await parent.page.getByRole('button',{name:'确认绑定',exact:true}).click();await parent.page.locator('#childrenList button').waitFor();await parent.page.locator('#childrenList button').click();await parent.page.waitForFunction(()=>document.getElementById('childDetail').textContent.includes('Rook mate'));
 await parent.page.locator('#planSolve').fill('8');await parent.page.getByRole('button',{name:'创建计划',exact:true}).click();await parent.page.waitForFunction(()=>document.getElementById('planList').textContent.includes('0/8'));
 await parent.page.getByRole('button',{name:'编辑计划',exact:true}).click();await parent.page.locator('#planSolve').fill('9');await parent.page.getByRole('button',{name:'保存',exact:true}).click();await parent.page.waitForFunction(()=>document.getElementById('planList').textContent.includes('0/9'));
 await parent.page.reload();await parent.page.waitForFunction(()=>document.getElementById('planList').textContent.includes('0/9'));
 await student.page.evaluate(()=>navTo('dashboard'));await student.page.waitForFunction(()=>document.getElementById('childPlans').textContent.includes('0/9'));
 await parent.page.locator('#navClassStudent').click();await parent.page.locator('#classStudentContent button').first().click();await parent.page.waitForFunction(()=>document.getElementById('classStudentContent').textContent.includes('已完成'));
 for(const lang of ['en','ja','fr','es']){
  await parent.page.evaluate(lang=>{setLang(lang);navTo('parent');},lang);await parent.page.waitForTimeout(200);await parent.page.evaluate(()=>showChildDetail(loadedChildren[0].childId));
  if(lang!=='ja') {const text=await parent.page.locator('#view-parent').innerText();assert.ok(!/[\u3400-\u9fff]/.test(text),`${lang} parent contains Chinese: ${text}`);}
  await teacher.page.evaluate(lang=>setLang(lang),lang);await teacher.page.waitForTimeout(200);if(lang!=='ja')assert.ok(!/[\u3400-\u9fff]/.test(await teacher.page.locator('#classTeacherDetail').innerText()));
 }
 await parent.page.evaluate(()=>{setLang('en');navTo('parent');});await parent.page.waitForFunction(()=>loadedChildren.length===1);
 await parent.page.evaluate(()=>genReport());await parent.page.waitForFunction(()=>document.getElementById('reportResult').textContent.includes('This week:'),{},{timeout:60000});
 assert.ok(!/[\u3400-\u9fff]/.test(await parent.page.locator('#reportResult').innerText()));await parent.page.evaluate(()=>viewReports());assert.ok((await parent.page.locator('#reportResult').innerText()).includes('Daily totals'));
 await parent.page.setViewportSize({width:390,height:844});await parent.page.evaluate(()=>setLang('zh'));await parent.page.screenshot({path:'/tmp/ct-parent-management-mobile.png',fullPage:true});
 await parent.page.on('dialog',d=>d.accept());await parent.page.getByRole('button',{name:'删除计划',exact:true}).click();await parent.page.waitForFunction(()=>loadedPlans.length===0);
 await teacher.page.screenshot({path:'/tmp/ct-teacher-management.png',fullPage:true});
 await student.page.locator('[data-nav="arena"]').click();await student.page.locator('#arenaTime').selectOption('3+2');await student.page.locator('#arenaStart').click();await student.page.waitForFunction(()=>document.getElementById('arenaStart').disabled);
 await student.page.reload();await student.page.waitForFunction(()=>document.getElementById('arenaStart')?.disabled);assert.equal(await student.page.locator('#arenaTime').inputValue(),'3+2');
 await opponent.page.locator('[data-nav="arena"]').click();await opponent.page.locator('#arenaTime').selectOption('3+2');await opponent.page.locator('#arenaStart').click();
 await Promise.all([student.page.waitForFunction(()=>latestPvpState?.status==='playing'),opponent.page.waitForFunction(()=>latestPvpState?.status==='playing')]);
 const a=await student.page.evaluate(()=>({id:pvpRoomId,color:pvpMyColor})),b=await opponent.page.evaluate(()=>({id:pvpRoomId,color:pvpMyColor}));assert.equal(a.id,b.id);assert.notEqual(a.color,b.color);
 const white=a.color==='white'?student:opponent,black=a.color==='black'?student:opponent;
 black.page.on('dialog',d=>d.accept());
 await white.page.locator('#pvpBoard [data-square="e2"]').click();await white.page.locator('#pvpBoard [data-square="e4"]').click();await black.page.waitForFunction(()=>latestPvpState.turn==='b');await black.page.evaluate(()=>resignPvp());await white.page.waitForFunction(()=>latestPvpState.status==='finished');
 assert.deepEqual(errors,[]);console.log('PASS: teacher class/notice/homework editor, student submit, parent binding/details/plan edit/refresh, child plan view, parent class progress, four-language management, arena queue refresh and both players live game.');
}finally{await browser.close();}
