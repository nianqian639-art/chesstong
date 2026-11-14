// Parent, class and open matchmaking workflows share the existing account and API client.
const manageEl = id => document.getElementById(id);
const emptyRecords = () => `<div class="feed">${t("noRecords")}</div>`;
const failAt = (id, e) => { const el = manageEl(id); if (el) el.textContent = e.message || t("requestFailed"); };
const dateNow = () => new Date().toISOString().slice(0,10);
const childStatsText = c => t("childStats", {attempts:c.totalAttempts,accuracy:c.accuracy,solve:c.todaySolve,battle:c.todayBattle});
const beijingInputToIso = value => {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return "";
  const [, y, mo, d, h, mi] = match;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 8, +mi)).toISOString();
};
const isoToBeijingInput = value => {
  if (!value) return "";
  const shifted = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000).toISOString();
  return shifted.slice(0, 16);
};
const beijingLabel = value => value ? new Intl.DateTimeFormat(getLang()==="zh"?"zh-CN":getLang(), { timeZone:"Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }).format(new Date(value)) : "";
const beijingDateOnly = value => value ? new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
let arenaTimer = null, arenaPolling = false, arenaBusy = false;
let editPlanId = "", loadedPlans = [], loadedChildren = [], loadedParentTasks = [], selectedChildId = "", selectedStudentClass = "";
let editorDraft = {title:"",solutions:"",due:""};

function ensureArenaView(){
  if (manageEl("view-arena")) return;
  manageEl("view-pvp").insertAdjacentHTML("afterend", `<div id="view-arena" class="panel" style="display:none"></div>`);
}
function renderArena(){
  ensureArenaView();
  const time = manageEl("arenaTime")?.value || localStorage.getItem("ct.arenaTime") || "10+0";
  manageEl("view-arena").innerHTML=`<h2>${t("arenaTitle")}</h2><p>${t("arenaHelp")}</p><div class="row"><label>${t("pvpTime")} <select id="arenaTime">${PVP_TIME_CONTROLS.map(v=>`<option>${v}</option>`).join("")}</select></label><button class="btn btn-primary" id="arenaStart" onclick="joinArena()">${t("startMatching")}</button><button class="btn btn-ghost" id="arenaCancel" onclick="cancelArena()">${t("cancelMatching")}</button></div><p id="arenaStatus" role="status"></p><h3>${t("arenaScores")}</h3><div id="arenaStats"></div>`;
  manageEl("arenaTime").value=time;
  manageEl("arenaTime").onchange=()=>localStorage.setItem("ct.arenaTime",manageEl("arenaTime").value);
}
async function applyArenaState(d){
  if(d.matched){ clearInterval(arenaTimer); arenaTimer=null; await joinAcceptedGame(d.roomId,d.roomNumber); return; }
  if(!manageEl("arenaStatus")) return;
  manageEl("arenaStatus").textContent=t(d.inQueue?"queueWaiting":"queueIdle");
  manageEl("arenaStart").disabled=d.inQueue;
  manageEl("arenaTime").disabled=d.inQueue;
  manageEl("arenaCancel").disabled=!d.inQueue;
  if(d.time) manageEl("arenaTime").value=d.time;
}
async function pollArena(){
  if(arenaPolling) return; arenaPolling=true;
  try{await applyArenaState(await API.req("/arena/status"));}catch(e){failAt("arenaStatus",e);}finally{arenaPolling=false;}
}
async function showArena(){
  renderArena(); await pollArena();
  if(currentView==="arena" && !arenaTimer) arenaTimer=setInterval(pollArena,2000);
  try{const d=await API.req("/arena/stats");manageEl("arenaStats").innerHTML=(d.items||[]).map(s=>`<div class="list-item"><b>${s.rank}. ${esc(s.name)}</b><span>${t("recordLine",s)}</span></div>`).join("")||emptyRecords();}catch(e){failAt("arenaStats",e);}
}
async function joinArena(){
  if(currentView!=="arena") {navTo("arena");return;}
  if(arenaBusy)return; arenaBusy=true;
  try{await applyArenaState(await API.req("/arena/join","POST",{timeControl:selectedPvpTimeControl("arenaTime")}));}catch(e){failAt("arenaStatus",e);}finally{arenaBusy=false;}
}
async function cancelArena(){try{await applyArenaState(await API.req("/arena/leave","POST",{}));}catch(e){failAt("arenaStatus",e);}}

async function bindChild(){
  const code=manageEl("bindCode").value.trim();
  if(!/^\d{6}$/.test(code)){manageEl("bindResult").textContent=t("codeInvalid");return;}
  try{await API.req("/parent/bind-child","POST",{code});manageEl("bindResult").textContent=t("bound");manageEl("bindCode").value="";await loadMyChildren();}catch(e){failAt("bindResult",e);}
}
async function loadMyChildren(){
  try{
    const d=await API.req("/parent/my-children");loadedChildren=d.children||[];
    manageEl("childrenList").innerHTML=loadedChildren.map(c=>`<div class="list-item"><span><b>${esc(c.childName)}</b> · ${getRank(c.points).title} · ${c.points} ${t("points")}<br><small>${childStatsText(c)}</small></span><button class="btn btn-ghost" onclick="showChildDetail('${c.childId}')">${t("details")}</button></div>`).join("")||`<p>${t("noChildren")}</p>`;
    for(const id of ["planChildSelect","reportChildSelect","parentTaskChildSelect"]){const old=manageEl(id).value;manageEl(id).innerHTML=`<option value="">${t("chooseChild")}</option>`+loadedChildren.map(c=>`<option value="${c.childId}">${esc(c.childName)}</option>`).join("");manageEl(id).value=loadedChildren.some(c=>c.childId===old)?old:loadedChildren.length===1?loadedChildren[0].childId:"";}
    if(selectedChildId) await showChildDetail(selectedChildId);
    await Promise.all([loadStudyPlans(),loadParentTasks()]);
  }catch(e){failAt("childrenList",e);}
}
function renderParentTaskRow(task){
  const state=t(task.status==="completed"?"parentTaskDone":task.status==="expired"?"parentTaskExpired":"parentTaskActive");
  return `<div class="list-item parent-task-admin"><span><b>${esc(task.childName)}</b> · ${esc(task.title)}<br><small>${state} · ${t("parentTaskPoints",{points:10})} · ${t("parentTaskDeadlineValue",{time:beijingLabel(task.deadlineAt)})}</small></span><button class="btn btn-ghost" onclick="deleteParentTask('${task.id}')">${t("deleteTask")}</button></div>`;
}
async function loadParentTasks(){
  try{const d=await API.req("/parent/tasks");loadedParentTasks=d.tasks||[];manageEl("parentTaskList").innerHTML=loadedParentTasks.map(renderParentTaskRow).join("")||emptyRecords();}
  catch(e){failAt("parentTaskList",e);}
}
async function createParentTask(){
  const childId=manageEl("parentTaskChildSelect").value,title=manageEl("parentTaskTitle").value.trim(),deadlineAt=beijingInputToIso(manageEl("parentTaskDeadlineAt").value);
  if(!childId){toast(t("chooseChild"));return;}
  if(!title||!deadlineAt){toast(t("parentTaskMissing"));return;}
  const button=document.querySelector('[onclick="createParentTask()"]');if(button)button.disabled=true;
  try{await API.req("/parent/task","POST",{childId,title,deadlineAt});manageEl("parentTaskTitle").value="";manageEl("parentTaskDeadlineAt").value="";toast(t("parentTaskCreated"));await loadParentTasks();}
  catch(e){toast(e.message);}
  finally{if(button)button.disabled=false;}
}
async function deleteParentTask(id){
  if(!confirm(t("confirmDeleteTask")))return;
  try{await API.req(`/parent/task/${id}`,"DELETE");await loadParentTasks();}catch(e){toast(e.message);}
}
async function showChildDetail(cid){
  selectedChildId=cid;
  try{const d=await API.req(`/parent/child/${cid}/detail`);
    manageEl("childDetail").innerHTML=`<h3>${esc(d.childName)}</h3><p>${childStatsText(d)}</p><h4>${t("recentPuzzles")}</h4>`+
      (d.recentAttempts.map(a=>`<div class="list-item"><span>${esc(a.problemId)} · ${esc(a.answer)} · ${t(a.isCorrect?"correct":"incorrect")}</span><small>${esc(a.submittedAt.slice(0,10))}</small></div>`).join("")||emptyRecords())+
      `<h4>${t("recentGames")}</h4>`+(d.recentMatches.map(m=>`<div class="list-item">${t(m.result==="win"?"victory":m.result==="lose"?"defeat":"drawn")} · ${esc(m.createdAt.slice(0,10))}</div>`).join("")||emptyRecords())+
      `<h4>${t("homeworks")}</h4>`+(d.homeworkAttempts.map(a=>`<div class="list-item">${esc(a.homeworkTitle)} · ${esc(a.answer)} · ${t(a.isCorrect?"correct":"incorrect")} · ${esc(a.submittedAt.slice(0,10))}</div>`).join("")||emptyRecords());
    manageEl("reportChildSelect").value=cid;manageEl("planChildSelect").value=cid;
  }catch(e){failAt("childDetail",e);}
}
function renderWeeklyReport(r){
  const bestDay=r.bestDay||"—";
  return `<div class="weekly-report-card"><div class="weekly-report-head"><div><h4>${t("weeklyReport")}</h4><p>${esc(beijingDateOnly(r.weekStart))} — ${esc(beijingDateOnly(r.weekEnd))} · ${t("reportLifetime",{points:r.currentPoints||0})}</p></div><span class="tag gold">${esc(r.currentRank||getRank(r.currentPoints).title)}</span></div><div class="weekly-highlight"><b>${t("reportFocus")}</b><span>${t("reportFocusLine",{days:r.activeDays||0,accuracy:r.weeklyAccuracy||"0%",best:bestDay})}</span></div><div class="weekly-metrics"><div><b>${r.solveCount||0}</b><small>${t("weeklySolved")}</small></div><div><b>${r.battleCount||0}</b><small>${t("weeklyBattles")}</small></div><div><b>${r.weeklyAccuracy||"0%"}</b><small>${t("weeklyAccuracy")}</small></div><div><b>${r.pointsGained>=0?"+":""}${r.pointsGained||0}</b><small>${t("weeklyPoints")}</small></div></div><p>${t("reportAttempts",{attempts:r.weeklyAttempts||0,correct:r.weeklyCorrect||0,allAttempts:r.totalAttempts||0,allAccuracy:r.totalAccuracy||"0%"})}</p><p>${t("recordLine",{wins:r.pvpWins,losses:r.pvpLosses,draws:r.pvpDraws})} · ${t("homeworkTotals",{done:r.homeworkDone||0,total:r.homeworkTotal||0})} · ${t("parentTaskTotals",{done:r.parentTaskDone||0,total:r.parentTaskTotal||0})}</p><h4>${t("dailyStats")}</h4><div class="weekly-days">`+
    (r.dailyBreakdown||[]).map(d=>`<div><b>${esc(d.date.slice(5))}</b><span>✅ ${d.solve}</span><span>⚔ ${d.battle}</span></div>`).join("")+`</div><div class="weekly-commentary"><b>${t("reportCommentary")}</b><p>${esc(r.aiCommentary||t("reportNoCommentary"))}</p></div><h4>${t("suggestions")}</h4><ul>`+(r.suggestions||[]).map(s=>`<li>${esc(s)}</li>`).join("")+`</ul></div>`;
}
async function genReport(force){
  const cid=manageEl("reportChildSelect").value;if(!cid){toast(t("chooseChild"));return;}
  const reportLanguage=getLang();manageEl("reportResult").innerHTML=aiLoadingMarkup(t("generating"));
  try{const d=await API.req(`/parent/child/${cid}/generate-report${force?"?force=true":""}`,"POST",{});if(manageEl("reportChildSelect").value!==cid || getLang()!==reportLanguage)return;manageEl("reportResult").innerHTML=renderWeeklyReport(d.report)+`<button class="btn btn-ghost" onclick="genReport(true)">${t("refreshReport")}</button>`;}catch(e){failAt("reportResult",e);}
}
async function viewReports(){
  const cid=manageEl("reportChildSelect").value;if(!cid){toast(t("chooseChild"));return;}
  try{const d=await API.req(`/parent/child/${cid}/reports`);const reports=(d.items||[]).filter(r=>(r.language||"zh")===getLang());manageEl("reportResult").innerHTML=`<h4>${t("historyReports")}</h4>`+(reports.map(renderWeeklyReport).join("")||emptyRecords());}catch(e){failAt("reportResult",e);}
}
function resetPlanEditor(){editPlanId="";manageEl("planSave").textContent=t("createPlan");if(manageEl("cancelPlanEdit"))manageEl("cancelPlanEdit").hidden=true;manageEl("planChildSelect").disabled=false;manageEl("planSolve").value=5;manageEl("planBattle").value=1;const nowBj=isoToBeijingInput(new Date().toISOString());const end=new Date(Date.now()+6*86400000);manageEl("planStart").value=nowBj.slice(0,10);manageEl("planEnd").value=isoToBeijingInput(end.toISOString()).slice(0,10);manageEl("planDeadlineAt").value=isoToBeijingInput(end.toISOString());}
function editStudyPlan(id){const p=loadedPlans.find(p=>p.id===id);if(!p)return;editPlanId=id;manageEl("planSave").textContent=t("save");manageEl("cancelPlanEdit").hidden=false;manageEl("planChildSelect").value=p.childId;manageEl("planChildSelect").disabled=true;for(const [field,value] of Object.entries({planSolve:p.dailySolveTarget,planBattle:p.dailyBattleTarget,planStart:p.startDate,planEnd:p.endDate}))manageEl(field).value=value;manageEl("planDeadlineAt").value=isoToBeijingInput(p.deadlineAt);manageEl("planChildSelect").scrollIntoView({block:"center"});}
async function createStudyPlan(){
  const childId=manageEl("planChildSelect").value;if(!childId){toast(t("chooseChild"));return;}
  const deadlineAt=beijingInputToIso(manageEl("planDeadlineAt").value);
  const body={childId,dailySolveTarget:+manageEl("planSolve").value,dailyBattleTarget:+manageEl("planBattle").value,startDate:manageEl("planStart").value,endDate:manageEl("planEnd").value,...(deadlineAt?{deadlineAt}:{})};
  try{await API.req(editPlanId?`/parent/study-plan/${editPlanId}`:"/parent/study-plan",editPlanId?"PUT":"POST",body);toast(t("saved"));resetPlanEditor();await loadStudyPlans();}catch(e){toast(e.message);}
}
async function deleteStudyPlan(id){if(!confirm(t("confirmDeletePlan")))return;try{await API.req(`/parent/study-plan/${id}`,"DELETE");if(editPlanId===id)resetPlanEditor();await loadStudyPlans();}catch(e){toast(e.message);}}
async function loadStudyPlans(){
  try{const d=await API.req("/parent/study-plans");loadedPlans=d.plans||[];
    manageEl("planList").innerHTML=`<p>${t("dateHelp")}</p><button class="btn btn-ghost" id="cancelPlanEdit" ${editPlanId?"":"hidden"} onclick="resetPlanEditor()">${t("cancelEdit")}</button>`+loadedPlans.map(p=>`<div class="list-item"><span><b>${esc(p.childName)}</b> · ${t({active:"planActive",upcoming:"planUpcoming",ended:"planEnded"}[p.status])}<br>${t("planProgress",{solve:p.todaySolve,solveTarget:p.dailySolveTarget,battle:p.todayBattle,battleTarget:p.dailyBattleTarget})}<br>${esc(p.startDate)} — ${esc(p.endDate)}<br><small>${t("planDeadlineValue",{time:beijingLabel(p.deadlineAt)})}</small></span><span><button class="btn btn-ghost" onclick="editStudyPlan('${p.id}')">${t("editPlan")}</button><button class="btn btn-ghost" onclick="deleteStudyPlan('${p.id}')">${t("deletePlan")}</button></span></div>`).join("");
  }catch(e){failAt("planList",e);}
}
async function loadChildPlans(){
  if(!API.user || API.user.role!=="student"||window.ctTrialMode)return;
  let el=manageEl("childPlans");if(!el){el=document.createElement("div");el.id="childPlans";manageEl("view-dashboard").appendChild(el);}
  const taskEl=manageEl("parentTaskCards");
  try{
    const [plans,tasks]=await Promise.all([API.req("/student/study-plans"),API.req("/student/parent-tasks")]);
    const planItems=plans.plans||[], taskItems=tasks.tasks||[];
    el.innerHTML=planItems.length?`<div class="study-plan-student"><h3>${t("yourPlans")}</h3>`+planItems.map(p=>`<div class="list-item"><span>${t("planProgress",{solve:p.todaySolve,solveTarget:p.dailySolveTarget,battle:p.todayBattle,battleTarget:p.dailyBattleTarget})}<br><small>${t("planDeadlineValue",{time:beijingLabel(p.deadlineAt)})}</small></span><span class="tag ${p.status==="expired"?"red":""}">${t(p.status==="expired"?"planExpired":p.status==="upcoming"?"planUpcoming":"planActive")}</span></div>`).join("")+`</div>`:"";
    if(taskEl) taskEl.innerHTML=taskItems.length?`<div class="parent-task-card"><div class="parent-task-heading"><h3>${t("parentTasks")}</h3><span class="tag purple">${t("parentTaskPoints",{points:10})}</span></div><p class="form-help">${t("parentTaskStudentHelp")}</p>`+taskItems.map(task=>`<div class="parent-task-row ${task.status!=="active"?"completed":""}"><div><b>${esc(task.title)}</b><small>${t("parentTaskDeadlineValue",{time:beijingLabel(task.deadlineAt)})} · ${task.status==="completed"?t("parentTaskDone"):task.status==="expired"?t("parentTaskExpired"):t("parentTaskPoints",{points:10})}</small></div>${task.status==="completed"?`<span class="tag green">✓</span>`:task.status==="expired"?`<span class="tag red">${t("parentTaskExpired")}</span>`:`<button class="btn btn-primary" onclick="completeParentTask('${task.id}')">${t("completeParentTask")}</button>`}</div>`).join("")+`</div>`:"";
  }catch(e){failAt("childPlans",e);if(taskEl)taskEl.innerHTML="";}
}
async function completeParentTask(id){
  try{const d=await API.req(`/student/parent-task/${id}/complete`,"POST",{});if(d.pointsAwarded){API.user.points=(API.user.points||0)+d.pointsAwarded;updateRankDisplay();toast(t("parentTaskReward",{points:d.pointsAwarded}));}await loadChildPlans();}
  catch(e){toast(e.message);}
}

async function createClass(){
  const name=manageEl("clsName").value.trim(),code=manageEl("clsCode").value.trim();
  try{const d=await API.req("/class/create","POST",{name,...(code?{inviteCode:code}:{})});manageEl("createResult").textContent=t("classCreated",{code:d.inviteCode});await loadTeacherClasses();manageEl("clsSelect").value=d.class.id;await showClassDetail(d.class.id);}catch(e){failAt("createResult",e);}
}
async function loadTeacherClasses(){
  try{const d=await API.req("/class/my-classes");const old=manageEl("clsSelect").value||sessionStorage.getItem("ct.teacherClass");const items=d.items.filter(c=>c.teacherId===API.user.id);manageEl("clsSelect").innerHTML=`<option value="">${t("chooseClass")}</option>`+items.map(c=>`<option value="${c.id}">${esc(c.name)} (${c.memberCount})</option>`).join("");if(items.some(c=>c.id===old)){manageEl("clsSelect").value=old;await showClassDetail(old);}}catch(e){failAt("classTeacherDetail",e);}
}
function progressHtml(d){return `<h4>${t("studentProgress")}</h4>`+(d.students.map(s=>`<div class="class-card"><b>${esc(s.childName)}</b> · ${s.points} ${t("points")} · ${t("practiceStats",{attempts:s.totalAttempts,accuracy:s.accuracy})}`+s.homeworks.map(h=>`<div>${esc(h.title)} · ${t(h.solved?"doneWork":"pendingWork")} · ${t("submissionCount",{count:h.attempts})}</div>`).join("")+`</div>`).join("")||emptyRecords());}
async function showClassDetail(cid){
  currentClassId=cid;sessionStorage.setItem("ct.teacherClass",cid);if(!cid){manageEl("classTeacherDetail").innerHTML="";return;}
  try{const [d,p]=await Promise.all([API.req(`/class/${cid}`),API.req(`/class/${cid}/progress`)]);
    manageEl("classTeacherDetail").innerHTML=`<h3>${esc(d.name)}</h3><p>${t("inviteCode")}: ${esc(d.inviteCode)} · ${t("students")}: ${d.memberCount}</p><div class="row"><input id="noticeMsg" placeholder="${t("notices")}" maxlength="300"><button class="btn btn-ghost" onclick="sendNotice()">${t("send")}</button></div><div id="noticeResult"></div><h4>${t("notices")}</h4>`+(d.notices.map(n=>`<p>${esc(n.creatorName)}: ${esc(n.message)}</p>`).join("")||emptyRecords())+progressHtml(p)+`<h4>${t("homeworks")}</h4>`+(d.homeworks.map(h=>`<p>${esc(h.title)} · ${t("due")} ${esc(h.dueDate)} · ${t("submissionCount",{count:h.submitCount})}</p>`).join("")||emptyRecords())+`<button class="btn btn-primary" onclick="editorDraft={title:'',solutions:'',due:''};showBoardEditor()">${t("createHomework")}</button>`;
  }catch(e){failAt("classTeacherDetail",e);}
}
async function sendNotice(){const message=manageEl("noticeMsg").value.trim();if(!message)return;try{await API.req(`/class/${currentClassId}/notice`,"POST",{message});toast(t("noticeSent"));await showClassDetail(currentClassId);}catch(e){failAt("noticeResult",e);}}
async function loadStudentClasses(){
  try{const d=await API.req("/class/my-classes");manageEl("joinCode").parentElement.style.display=API.user.role==="student"?"":"none";
    if(selectedStudentClass && d.items.some(c=>c.id===selectedStudentClass)){await showStudentClass(selectedStudentClass);return;}
    manageEl("classStudentContent").innerHTML=`<h4>${t("myClass")}</h4>`+(d.items.map(c=>`<div class="list-item"><span>${esc(c.name)} (${c.memberCount})</span><button class="btn btn-ghost" onclick="showStudentClass('${c.id}')">${t("view")}</button></div>`).join("")||t("noClasses"));
  }catch(e){failAt("classStudentContent",e);}
}
async function showStudentClass(cid){
  selectedStudentClass=cid;sessionStorage.setItem("ct.studentClass",cid);
  try{const d=await API.req(`/class/${cid}`);let html=`<button class="btn btn-ghost" onclick="selectedStudentClass='';sessionStorage.removeItem('ct.studentClass');loadStudentClasses()">${t("backClasses")}</button><h3>${esc(d.name)}</h3><h4>${t("notices")}</h4>`+(d.notices.map(n=>`<p>${esc(n.creatorName)}: ${esc(n.message)}</p>`).join("")||emptyRecords());
    if(API.user.role==="parent"){html+=progressHtml(await API.req(`/class/${cid}/progress`));}
    else{html+=`<h4>${t("homeworks")}</h4>`+(d.homeworks.map(h=>`<div class="list-item"><span>${esc(h.title)} · ${t("due")} ${esc(h.dueDate)} · ${t(h.solved?"doneWork":h.dueDate<dateNow()?"expiredWork":"pendingWork")}</span><button class="btn btn-ghost" data-hw="${h.id}">${t("view")}</button></div>`).join("")||emptyRecords());}
    manageEl("classStudentContent").innerHTML=html+`<div id="homeworkWork"></div>`;
    manageEl("classStudentContent").querySelectorAll("[data-hw]").forEach(b=>b.onclick=()=>openHomework(cid,d.homeworks.find(h=>h.id===b.dataset.hw)));
  }catch(e){failAt("classStudentContent",e);}
}
function openHomework(cid,h){
  cancelPromotion();
  let selected="";manageEl("homeworkWork").innerHTML=`<h4>${esc(h.title)}</h4><p>${t("answerHelp")}</p><div id="homeworkBoard" class="board-wrap"></div><div class="row"><input id="homeworkAnswer" aria-label="${t("submitWork")}"><button class="btn btn-primary" id="submitHomework">${t("submitWork")}</button></div><div id="homeworkFeedback" role="status"></div>`;
  const board=manageEl("homeworkBoard"),answer=manageEl("homeworkAnswer");
  const draw=()=>renderBoard(board,h.fen,selected,async(sq)=>{
    if(pendingPromotion)return;
    if(!selected){selected=sq;draw();}
    else{
      const from=selected;selected="";draw();
      const move=await chooseBoardMove(h.fen,from,sq);
      if(move&&board.isConnected)answer.value=move;
    }
  },h.fen.split(" ")[1]==="b"?"black":"white");draw();
  manageEl("submitHomework").disabled=h.dueDate<dateNow();
  manageEl("submitHomework").onclick=async()=>{const button=manageEl("submitHomework");button.disabled=true;try{const d=await API.req(`/class/${cid}/homework/${h.id}/submit`,"POST",{answer:manageEl("homeworkAnswer").value.trim()});manageEl("homeworkFeedback").textContent=t(d.isCorrect?"correct":"incorrect");if(d.isCorrect)h.solved=true;}catch(e){failAt("homeworkFeedback",e);}finally{button.disabled=false;}};
}
function saveEditorDraft(){if(manageEl("hwTitle"))editorDraft={title:manageEl("hwTitle").value,solutions:manageEl("hwSolutions").value,due:manageEl("hwDue").value};}
function showBoardEditor(){
  manageEl("classTeacherDetail").innerHTML=`<button class="btn btn-ghost" onclick="showClassDetail(currentClassId)">${t("backClasses")}</button><h4>${t("createHomework")}</h4><div class="piece-palette">${["K","Q","R","B","N","P","k","q","r","b","n","p","."].map(p=>`<button class="btn btn-ghost" data-piece="${p}">${PIECES_FULL[p]}</button>`).join("")}</div><p>${t("fenHelp")}</p><div class="row"><input id="editorFenInput" aria-label="FEN" style="flex:1"><button class="btn btn-ghost" id="applyFen">${t("applyPosition")}</button><button class="btn btn-ghost" id="clearEditorBoard" onclick="clearBoardEditorPosition()">${t("clearBoard")}</button></div><div id="editorBoard" class="board-wrap"></div><div id="editorFenDisplay" style="overflow-wrap:anywhere"></div><div class="row"><input id="hwTitle" placeholder="${t("homeworkTitle")}" maxlength="60"><input id="hwSolutions" placeholder="${t("solutions")}"><input type="date" id="hwDue"></div><button class="btn btn-primary" onclick="saveCustomHomework()">${t("save")}</button><div id="hwSaveResult" role="status"></div>`;
  manageEl("editorFenInput").value=editorFen;manageEl("hwTitle").value=editorDraft.title;manageEl("hwSolutions").value=editorDraft.solutions;manageEl("hwDue").value=editorDraft.due||new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  document.querySelectorAll("[data-piece]").forEach(b=>{b.style.outline=b.dataset.piece===selectedPiece?"2px solid var(--gold)":"";b.onclick=()=>{saveEditorDraft();selectedPiece=b.dataset.piece;showBoardEditor();};});
  manageEl("applyFen").onclick=()=>{const fen=manageEl("editorFenInput").value.trim();if(!/^(?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+ [wb] /.test(fen)){toast(t("requestFailed"));return;}editorFen=fen;renderEditorBoard();};
  renderEditorBoard();
}
function clearBoardEditorPosition(){
  const side=editorFen.split(" ")[1]==="b"?"b":"w";
  editorFen=`8/8/8/8/8/8/8/8 ${side} - - 0 1`;
  selectedPiece=".";
  manageEl("editorFenInput").value=editorFen;
  document.querySelectorAll("[data-piece]").forEach(button=>{button.style.outline=button.dataset.piece==="."?"2px solid var(--gold)":"";});
  renderEditorBoard();
}
async function saveCustomHomework(){saveEditorDraft();try{await API.req(`/class/${currentClassId}/homework`,"POST",{title:editorDraft.title.trim(),fen:editorFen,solutions:editorDraft.solutions.split(",").map(s=>s.trim()).filter(Boolean),dueDate:editorDraft.due});editorDraft={title:"",solutions:"",due:""};toast(t("saved"));await showClassDetail(currentClassId);}catch(e){failAt("hwSaveResult",e);}}

// Extend navigation without duplicating its event handlers.
const previousNavTo=navTo;
navTo=function(view){
  if(window.ctTrialMode && ["arena","parent","classTeacher","classStudent"].includes(view)) view="dashboard";
  if(view==="parent" && API.user.role!=="parent")view="dashboard";
  if(view==="classTeacher" && API.user.role!=="teacher")view="dashboard";
  if(currentView==="arena" && view!=="arena" && arenaTimer){clearInterval(arenaTimer);arenaTimer=null;API.req("/arena/leave","POST",{}).then(d=>{if(d.matched&&pvpRoomId!==d.roomId)joinAcceptedGame(d.roomId,d.roomNumber);}).catch(()=>{});}
  if(view==="arena"){
    ensureArenaView();currentView=view;sessionStorage.setItem("ct.currentView",view);document.querySelectorAll("[id^='view-']").forEach(el=>el.style.display=el.id==="view-arena"?"":"none");showArena();return;
  }
  previousNavTo(view);if(view==="dashboard")loadChildPlans();
};
const previousRefreshI18n=refreshI18n;
refreshI18n=function(){previousRefreshI18n();manageEl("createResult").textContent="";manageEl("bindResult").textContent="";if(currentView==="parent"){manageEl("reportResult").innerHTML="";loadMyChildren();}if(currentView==="classTeacher")loadTeacherClasses();if(currentView==="arena")showArena();if(currentView==="dashboard")loadChildPlans();};
selectedStudentClass=sessionStorage.getItem("ct.studentClass")||"";
manageEl("reportChildSelect").onchange=()=>{manageEl("reportResult").innerHTML="";};
manageEl("clsSelect").onchange=()=>showClassDetail(manageEl("clsSelect").value);
resetPlanEditor();ensureArenaView();loadChildPlans();
