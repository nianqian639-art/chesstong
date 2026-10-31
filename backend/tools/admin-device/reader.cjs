'use strict';
// Invoked only by a forced SSH command. No HTTP route exposes this reader.
const Database = require('better-sqlite3');
const path = require('node:path');
const TABLES = Object.freeze({
 users:['用户与家长绑定','id username phone displayName role childIds classIds points level streakDays createdAt'],
 problems:['题库','id gradeBand type difficulty knowledgePoint fen question solution solutionUci acceptedAnswers hints rating themes source'],
 attempts:['答题记录','id userId problemId answer isCorrect submittedAt'],
 missions:['每日任务','id name description pointsReward condition'],
 mission_claims:['任务领取','missionId userId date claimedAt'],
 point_ledger:['积分流水','id userId change reason createdAt'],
 shop_items:['奖励商品','id kind name price'],
 inventory:['奖励领取','userId itemId acquiredAt'],
 matches:['对局记录','id userId mode difficulty pgn result createdAt fen variant finishedAt'],
 class_tasks:['班级任务','id classId creatorId title requiredSolveCount dueDate createdAt'],
 class_notices:['班级公告','id classId creatorId message createdAt'],
 classes:['班级与成员','id name teacherId inviteCode memberIds createdAt'],
 homeworks:['班级作业','id classId creatorId title fen acceptedAnswers requiredSolveCount dueDate createdAt'],
 homework_attempts:['作业提交','id homeworkId userId answer isCorrect submittedAt'],
 study_plans:['学习计划','id parentId childId dailySolveTarget dailyBattleTarget startDate endDate createdAt'],
 game_rooms:['实时房间与公开赛','id roomNumber creatorId timeControl players fen pgn turn status result resultReason drawOfferFrom lastMoveTimestamp createdAt'],
 friend_relations:['好友关系','id fromUserId toUserId status createdAt'],
 chat_messages:['聊天记录','id fromUserId toUserId message read createdAt'],
 game_requests:['对战邀请','id fromUserId toUserId timeControl status roomId createdAt'],
 weekly_reports:['学习周报','id studentId parentId weekStart weekEnd solveCount battleCount pvpWins pvpLosses pvpDraws pointsGained currentPoints currentRank aiCommentary suggestions createdAt language totalAttempts totalAccuracy homeworkDone homeworkTotal dailyBreakdown']
});
const JSON_COLUMNS = new Set('childIds classIds acceptedAnswers hints themes source condition memberIds timeControl players suggestions dailyBreakdown'.split(' '));
const quoted = name => '"'+name+'"';
function readData(dbPath, input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('请求无效');
 if (!['summary','rows'].includes(input.action)) throw new Error('只允许读取统计或数据列表');
 const db = new Database(dbPath, {readonly:true,fileMustExist:true,timeout:5000});
 try {
  db.pragma('query_only = ON');
  if(input.action==='summary') {
   return {generatedAt:new Date().toISOString(),readOnly:true,tables:Object.entries(TABLES).map(([key,[label]])=>({key,label,count:db.prepare(`SELECT COUNT(*) AS count FROM ${quoted(key)}`).get().count}))};
  }
  if (typeof input.table!=='string' || !Object.hasOwn(TABLES,input.table)) throw new Error('不允许读取此数据项');
  const table=input.table;
  const available=new Set(db.prepare(`PRAGMA table_info(${quoted(table)})`).all().map(c=>c.name));
  const columns=TABLES[table][1].split(' ').filter(c=>available.has(c));
  const page=input.page??1, limit=input.limit??50, q=input.q??'';
  if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(limit)||limit<1||limit>100||typeof q!=='string'||q.length>200)throw new Error('分页或搜索条件无效');
  const where=q?' WHERE '+columns.map(c=>`instr(lower(CAST(${quoted(c)} AS TEXT)),lower(@q)) > 0`).join(' OR '):'';
  const params=q?{q}:{};
  const count=db.prepare(`SELECT COUNT(*) AS count FROM ${quoted(table)}${where}`).get(params).count;
  const order=columns.includes('createdAt')?'"createdAt" DESC, rowid DESC':columns.includes('submittedAt')?'"submittedAt" DESC, rowid DESC':'rowid DESC';
  const rows=db.prepare(`SELECT ${columns.map(quoted).join(',')} FROM ${quoted(table)}${where} ORDER BY ${order} LIMIT @limit OFFSET @offset`).all({...params,limit,offset:(page-1)*limit}).map(row=>{
   for(const key of columns)if(JSON_COLUMNS.has(key)&&typeof row[key]==='string'){try{row[key]=JSON.parse(row[key]);}catch{}}
   return row;
  });
  return {table,label:TABLES[table][0],columns,rows,total:count,page,limit};
 }finally{db.close();}
}
module.exports={readData,TABLES};
if(require.main===module){
 let input='',ended=false;
 const timer=setTimeout(()=>{process.stderr.write('请求超时\n');process.exit(1);},10000);
 process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{input+=chunk;if(Buffer.byteLength(input)>4096){ended=true;clearTimeout(timer);process.stderr.write('请求过长\n');process.exit(1);}});
 process.stdin.on('end',()=>{if(ended)return;clearTimeout(timer);try{
  const dbPath=path.resolve(process.env.CHESSTONG_ADMIN_DB||'/opt/chesstong/backend/data/chesstong.db');
  process.stdout.write(JSON.stringify(readData(dbPath,JSON.parse(input))));
 }catch{process.stderr.write('读取失败，请检查连接或查询条件\n');process.exitCode=1;}});
}
