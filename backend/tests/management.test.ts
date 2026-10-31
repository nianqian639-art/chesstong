import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("../src/services/ai.js", () => ({ generateWeeklyCommentary: async ({ language }: any) => ({ text: language === "zh" ? "根据记录安排练习。" : "Review the recorded games.", source: "fallback" }) }));
import { buildServer } from "../src/server.js";
import { db } from "../src/services/db.js";
const app=buildServer();
afterAll(()=>app.close());
let n=0;
async function user(role="student") {const r=await app.inject({method:"POST",url:"/auth/register",payload:{account:`audit_${Date.now()}_${n++}`,password:"test123456",displayName:`Audit ${n}`,role}});expect(r.statusCode).toBe(200);return r.json();}
async function req(u:any,url:string,method:any="GET",payload?:any,language="zh"){return app.inject({method,url,payload,headers:{authorization:`Bearer ${u.token}`,"x-app-language":language}});}
const fen="6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1";

describe("class and parent authorization and workflows",()=>{
 it("binds a child once, rejects expired and regenerated codes, and isolates private records",async()=>{
  const child=await user(),p=await user("parent"),other=await user("parent");
  const c=(await req(child,"/student/my-code")).json();
  expect((await req(child,"/student/my-code")).json().code).toBe(c.code);
  const regenerated=(await req(child,"/student/regenerate-code","POST",{})).json();
  expect((await req(p,"/parent/bind-child","POST",{code:c.code})).statusCode).toBe(404);
  expect((await req(p,"/parent/bind-child","POST",{code:regenerated.code})).statusCode).toBe(200);
  expect((await req(other,"/parent/bind-child","POST",{code:regenerated.code})).statusCode).toBe(404);
  expect((await req(p,"/parent/my-children")).json().children[0].childId).toBe(child.user.id);
  expect((await req(other,`/parent/child/${child.user.id}/detail`)).statusCode).toBe(403);
  expect((await req(other,`/parent/child/${child.user.id}/generate-report`,"POST",{})).statusCode).toBe(403);
  const expired=(await req(child,"/student/regenerate-code","POST",{})).json();db.bindingCodes.find(c=>c.code===expired.code)!.expiresAt=new Date(0).toISOString();
  expect((await req(other,"/parent/bind-child","POST",{code:expired.code})).statusCode).toBe(400);
  expect((await req(child,"/parent/my-children")).statusCode).toBe(403);
 });
 it("runs teacher → student homework → parent progress without exposing answers or other children",async()=>{
  const teacher=await user("teacher"),teacher2=await user("teacher"),child=await user(),child2=await user(),parent=await user("parent"),outsider=await user("parent");
  const cls=(await req(teacher,"/class/create","POST",{name:"Class <script>"})).json().class;
  const other=(await req(teacher2,"/class/create","POST",{name:"Other"})).json().class;
  for(const u of [child,child2])expect((await req(u,"/class/join","POST",{inviteCode:cls.inviteCode})).statusCode).toBe(200);
  expect((await req(parent,"/class/join","POST",{inviteCode:cls.inviteCode})).statusCode).toBe(403);
  expect((await req(child,"/class/join","POST",{inviteCode:cls.inviteCode})).statusCode).toBe(400);
  const payload={title:"Mate",fen,solutions:["Ra8#"],dueDate:"2099-01-01"};
  expect((await req(teacher2,`/class/${cls.id}/homework`,"POST",payload)).statusCode).toBe(403);
  expect((await req(teacher,`/class/${cls.id}/homework`,"POST",{...payload,fen:"invalid"})).statusCode).toBe(400);
  expect((await req(teacher,`/class/${cls.id}/homework`,"POST",{...payload,solutions:["e4"]})).statusCode).toBe(400);
  const hw=(await req(teacher,`/class/${cls.id}/homework`,"POST",payload)).json().homework;
  const past=(await req(teacher,`/class/${cls.id}/homework`,"POST",{...payload,title:"Past",dueDate:"2020-01-01"})).json().homework;
  expect((await req(child,`/class/${cls.id}/homework/${past.id}/submit`,"POST",{answer:"a1a8"})).statusCode).toBe(400);
  const foreign=(await req(teacher2,`/class/${other.id}/homework`,"POST",payload)).json().homework;
  const detail=(await req(child,`/class/${cls.id}`)).json();expect(detail.homeworks[0]).not.toHaveProperty("acceptedAnswers");expect(detail.memberCount).toBe(2);
  expect((await req(child,`/class/${cls.id}/homework`)).json().items[0]).not.toHaveProperty("acceptedAnswers");
  expect((await req(child,`/class/${cls.id}/homework/${foreign.id}/submit`,"POST",{answer:"a1a8"})).statusCode).toBe(404);
  expect((await req(child,`/class/${cls.id}/homework/${hw.id}/submit`,"POST",{answer:"a1a2"})).json().isCorrect).toBe(false);
  expect((await req(child,`/class/${cls.id}/homework/${hw.id}/submit`,"POST",{answer:"a1a8"})).json().isCorrect).toBe(true);
  expect((await req(child,`/class/${cls.id}/homework/${hw.id}/submit`,"POST",{answer:"Ra8#"})).json().isCorrect).toBe(true);
  const code=(await req(child,"/student/my-code")).json().code;await req(parent,"/parent/bind-child","POST",{code});
  expect((await req(parent,"/class/my-classes")).json().items[0].id).toBe(cls.id);
  expect((await req(parent,`/class/${cls.id}`)).json().members.map((m:any)=>m.id)).toEqual([child.user.id]);
  const progress=(await req(teacher,`/class/${cls.id}/progress`)).json();expect(progress.students.length).toBe(2);expect(progress.students[0].homeworks.find((h:any)=>h.id===hw.id)).toMatchObject({solved:true,attempts:3});
  expect((await req(parent,`/class/${cls.id}/progress`)).json().students.map((s:any)=>s.childId)).toEqual([child.user.id]);
  expect((await req(outsider,`/class/${cls.id}/progress`)).statusCode).toBe(403);
  for(const u of [outsider,teacher2,parent]){
   expect((await req(u,`/class/${cls.id}/notice`,"POST",{message:"No"})).statusCode).toBe(403);
   expect((await req(u,"/class/notice/publish","POST",{classId:cls.id,message:"No"})).statusCode).toBe(403);
   expect((await req(u,"/class/task/create","POST",{classId:cls.id,title:"No",requiredSolveCount:2,dueDate:"2099-01-01"})).statusCode).toBe(403);
  }
  expect((await req(teacher,`/class/${cls.id}/notice`,"POST",{message:"Lesson on Monday"})).statusCode).toBe(200);
  expect((await req(child,`/class/${cls.id}`)).json().notices[0].message).toBe("Lesson on Monday");
 });
 it("validates plans, exposes active plans to the right child, and preserves complete reports by language",async()=>{
  const child=await user(),parent=await user("parent"),other=await user("parent");
  const code=(await req(child,"/student/my-code")).json().code;await req(parent,"/parent/bind-child","POST",{code});
  const localDeadline=new Date(Math.floor((Date.now()+60*60*1000)/1000)*1000);
  const beijingDeadline=new Date(localDeadline.getTime()+8*60*60*1000).toISOString().slice(0,19)+"+08:00";
  const data={childId:child.user.id,dailySolveTarget:3,dailyBattleTarget:1,startDate:"2020-01-01",endDate:"2099-01-01",deadlineAt:beijingDeadline};
  for(const invalid of [{...data,endDate:"2019-01-01"},{...data,startDate:"2026-02-30"},{...data,dailySolveTarget:1.5}])expect((await req(parent,"/parent/study-plan","POST",invalid)).statusCode).toBe(400);
  expect((await req(other,"/parent/study-plan","POST",data)).statusCode).toBe(403);
  const plan=(await req(parent,"/parent/study-plan","POST",data)).json().plan;
  expect(plan.deadlineAt).toBe(localDeadline.toISOString());
  expect((await req(child,"/student/study-plans")).json().plans[0]).toMatchObject({id:plan.id,deadlineAt:localDeadline.toISOString(),status:"active"});
  expect((await req(other,`/parent/study-plan/${plan.id}`,"PUT",{dailySolveTarget:7})).statusCode).toBe(403);
  expect((await req(parent,`/parent/study-plan/${plan.id}`,"PUT",{dailySolveTarget:7})).statusCode).toBe(200);
  expect((await req(parent,"/parent/study-plans")).json().plans[0]).toMatchObject({dailySolveTarget:7,status:"active"});
  expect((await req(parent,`/parent/study-plan/${plan.id}`,"PUT",{deadlineAt:new Date(Date.now()-1000).toISOString()})).statusCode).toBe(200);
  expect((await req(child,"/student/study-plans")).json().plans[0].status).toBe("expired");
  db.attempts.push({id:crypto.randomUUID(),userId:child.user.id,problemId:"starter-001",answer:"a1a8",isCorrect:true,submittedAt:new Date().toISOString()});
  const zh=(await req(parent,`/parent/child/${child.user.id}/generate-report`,"POST",{},"zh")).json();
  const en=(await req(parent,`/parent/child/${child.user.id}/generate-report`,"POST",{},"en")).json();expect(en.cached).toBe(false);expect(en.report.id).not.toBe(zh.report.id);expect(en.report.language).toBe("en");expect(en.report.suggestions.join("")).not.toMatch(/[\u3400-\u9fff]/);
  const cached=(await req(parent,`/parent/child/${child.user.id}/generate-report`,"POST",{},"en")).json();expect(cached.cached).toBe(true);expect(cached.report).toMatchObject({totalAttempts:1,solveCount:1,homeworkDone:0,homeworkTotal:0,weeklyAttempts:1,weeklyCorrect:1,weeklyAccuracy:"100.0%",activeDays:1});expect(cached.report.dailyBreakdown).toHaveLength(7);
  expect((await req(parent,`/parent/child/${child.user.id}/reports`)).json().items).toHaveLength(2);
  expect((await req(other,`/parent/study-plan/${plan.id}`,"DELETE")).statusCode).toBe(403);
  expect((await req(parent,`/parent/study-plan/${plan.id}`,"DELETE")).statusCode).toBe(200);
  expect((await req(child,"/student/study-plans")).json().plans).toHaveLength(0);
 });
 it("limits parent tasks, awards ten points once, and exposes expiry",async()=>{
  const child=await user(),parent=await user("parent"),other=await user("parent"),outsider=await user();
  const code=(await req(child,"/student/my-code")).json().code;await req(parent,"/parent/bind-child","POST",{code});
  const deadlineAt=new Date(Date.now()+60000).toISOString();
  expect((await req(other,"/parent/task","POST",{childId:child.user.id,title:"Unbound",deadlineAt})).statusCode).toBe(403);
  const created:any[]=[];
  for(let i=0;i<5;i++){const response=await req(parent,"/parent/task","POST",{childId:child.user.id,title:`Task ${i+1}`,deadlineAt});expect(response.statusCode).toBe(200);created.push(response.json().task);}
  expect((await req(parent,"/parent/task","POST",{childId:child.user.id,title:"Sixth",deadlineAt})).statusCode).toBe(400);
  expect((await req(child,"/student/parent-tasks")).json().tasks).toHaveLength(5);
  expect((await req(outsider,`/student/parent-task/${created[0].id}/complete`,"POST",{})).statusCode).toBe(404);
  const done=(await req(child,`/student/parent-task/${created[0].id}/complete`,"POST",{})).json();expect(done.pointsAwarded).toBe(10);expect(done.task.status).toBe("completed");
  expect((await req(child,`/student/parent-task/${created[0].id}/complete`,"POST",{})).json().pointsAwarded).toBe(0);
  expect(db.users.find(u=>u.id===child.user.id)?.points).toBe(10);
  expect((await req(other,`/parent/task/${created[1].id}`,"DELETE")).statusCode).toBe(403);
  const expired=db.parentTasks.find(task=>task.id===created[1].id)!;expired.deadlineAt=new Date(Date.now()-1).toISOString();
  expect((await req(child,"/student/parent-tasks")).json().tasks.find((task:any)=>task.id===expired.id).status).toBe("expired");
  expect((await req(child,`/student/parent-task/${expired.id}/complete`,"POST",{})).statusCode).toBe(400);
 });
 it("keeps unfinished AI games out of a parent's results and progress",async()=>{
  const child=await user(),parent=await user("parent");
  const code=(await req(child,"/student/my-code")).json().code;
  await req(parent,"/parent/bind-child","POST",{code});
  const started=(await req(child,"/match/start","POST",{mode:"standard",difficulty:1})).json();
  const detailUrl=`/parent/child/${child.user.id}/detail`;
  expect((await req(parent,detailUrl)).json()).toMatchObject({todayBattle:0,recentMatches:[]});
  const match=db.matches.find(m=>m.id===started.matchId)!;
  match.finishedAt=new Date().toISOString();match.result="win";
  const detail=(await req(parent,detailUrl)).json();
  expect(detail.todayBattle).toBe(1);expect(detail.recentMatches).toHaveLength(1);
  expect(detail.recentMatches[0]).toMatchObject({id:started.matchId,result:"win"});
 });
});

describe("open matchmaking",()=>{
 it("returns the same game and correct colors to both queued players, with refresh recovery and clock isolation",async()=>{
  const a=await user(),b=await user(),c=await user();
  const join=(u:any,time:string)=>req(u,"/arena/join","POST",{timeControl:{initialMinutes:+time.split("+")[0],incrementSeconds:+time.split("+")[1]}});
  expect((await join(a,"3+2")).json().inQueue).toBe(true);
  expect((await join(a,"3+2")).statusCode).toBe(200);
  expect((await join(c,"5+3")).json().matched).toBe(false);
  const match=(await join(b,"3+2")).json();expect(match.matched).toBe(true);
  const first=(await req(a,"/arena/status")).json();expect(first.roomId).toBe(match.roomId);expect(first.yourColor).not.toBe(match.yourColor);
  expect((await req(a,"/room/join","POST",{roomNumber:first.roomNumber})).json().yourColor).toBe(first.yourColor);
  expect((await req(c,"/arena/leave","POST",{})).json().inQueue).toBe(false);
  expect((await req(c,"/arena/leave","POST",{})).statusCode).toBe(200);
  const room=db.gameRooms.find(r=>r.id===match.roomId)!;room.status="finished";room.result="white";
  const stats=(await req(a,"/arena/stats")).json();expect(stats.items).toHaveLength(2);expect(stats.items.find((s:any)=>s.userId===room.players.white?.userId).wins).toBe(1);
  for(const time of ["1+0","3+2","5+3","10+0","15+10","30+10","120+15"]){expect((await join(a,time)).statusCode).toBe(200);await req(a,"/arena/leave","POST",{});}
  expect((await join(a,"10+10")).statusCode).toBe(400);
 });
 it("expires abandoned queues and rejects unauthenticated users",async()=>{
  const a=await user();await req(a,"/arena/join","POST",{});vi.useFakeTimers();vi.setSystemTime(Date.now()+46000);
  expect((await req(a,"/arena/status")).json().inQueue).toBe(false);vi.useRealTimers();
  expect((await app.inject({method:"GET",url:"/arena/status"})).statusCode).toBe(401);
 });
});
