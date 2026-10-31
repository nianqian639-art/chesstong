import { randomInt } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { addPoints, db, getRank } from "../services/db.js";
import { getUserById, nowIso, requireUserId } from "../services/common.js";
import { generateWeeklyCommentary } from "../services/ai.js";

// ── schemas ─────────────────────────────────────────────────────

const bindChildBody = z.object({
  code: z.string().regex(/^\d{6}$/)
});

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "日期无效");
const exactDateTime = z.string().datetime({ offset: true });
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

const beijingToday = (date = new Date()): string =>
  new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);

const beijingDayStart = (date: string): number => Date.parse(`${date}T00:00:00+08:00`);

const beijingDayBounds = (date: string) => {
  const start = beijingDayStart(date);
  return { start: new Date(start).toISOString(), end: new Date(start + 24 * 60 * 60 * 1000).toISOString() };
};
const beijingDeadlineForDate = (date: string): string => new Date(beijingDayStart(date) + 24 * 60 * 60 * 1000 - 1).toISOString();

const isDeadlineInsidePlan = (deadlineAt: string | null | undefined, startDate: string, endDate: string): boolean => {
  if (!deadlineAt) return true;
  const deadline = Date.parse(deadlineAt);
  return Number.isFinite(deadline) && deadline >= beijingDayStart(startDate) && deadline <= beijingDayStart(endDate) + 24 * 60 * 60 * 1000 - 1;
};

const studyPlanBody = z.object({
  childId: z.string().min(1),
  dailySolveTarget: z.number().int().min(0).max(100),
  dailyBattleTarget: z.number().int().min(0).max(50),
  startDate: dateOnly,
  endDate: dateOnly,
  deadlineAt: exactDateTime.optional()
});

const studyPlanUpdateBody = z.object({
  dailySolveTarget: z.number().int().min(0).max(100).optional(),
  dailyBattleTarget: z.number().int().min(0).max(50).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  deadlineAt: exactDateTime.nullable().optional()
});

const parentTaskBody = z.object({
  childId: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  deadlineAt: exactDateTime
});

// ── helpers ─────────────────────────────────────────────────────

const generateBindingCode = (): string => {
  let code: string;
  do { code = String(randomInt(100000, 1000000)); } while (db.bindingCodes.some(b => b.code === code));
  return code;
};

const getTodayProgress = (userId: string, date: string) => {
  const { start, end } = beijingDayBounds(date);
  const solveCount = new Set(
    db.attempts
      .filter((a) => a.userId === userId && a.isCorrect && a.submittedAt >= start && a.submittedAt < end)
      .map((a) => a.problemId)
  ).size;
  const battleCount = db.matches.filter(
    (m) => m.userId === userId && (!m.fen || !!m.finishedAt) && m.createdAt >= start && m.createdAt < end
  ).length;
  return { solveCount, battleCount };
};

// ── Weekly Report Generator ─────────────────────────────────────

function getWeekRange(date: Date): { start: string; end: string } {
  const beijing = new Date(date.getTime() + BEIJING_OFFSET_MS);
  const weekday = beijing.getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  const mondayUtc = Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate() - daysFromMonday) - BEIJING_OFFSET_MS;
  return { start: new Date(mondayUtc).toISOString(), end: new Date(mondayUtc + 7 * 24 * 60 * 60 * 1000 - 1).toISOString() };
}

async function generateWeeklyReport(
  studentId: string,
  parentId: string,
  language: "zh" | "en" | "ja" | "fr" | "es" = "zh"
): Promise<{
  solveCount: number; battleCount: number;
  pvpWins: number; pvpLosses: number; pvpDraws: number;
  pointsGained: number; currentPoints: number; currentRank: string;
  totalAttempts: number; totalAccuracy: string;
  homeworkDone: number; homeworkTotal: number;
  dailyBreakdown: { date: string; solve: number; battle: number }[];
  weeklyAttempts: number; weeklyCorrect: number; weeklyAccuracy: string;
  activeDays: number; bestDay: string;
  parentTaskDone: number; parentTaskTotal: number;
  aiCommentary: string; suggestions: string[];
}> {
  const { start, end } = getWeekRange(new Date());
  const weekStartDate = beijingToday(new Date(start));
  // Derive the inclusive date from the Monday in Beijing time. The interval
  // end is one millisecond before next Monday and may display as the wrong day.
  const weekEndDate = beijingToday(new Date(beijingDayStart(weekStartDate) + 6 * 24 * 60 * 60 * 1000));
  const student = getUserById(studentId);
  if (!student) throw new Error("学生不存在");

  // Weekly stats
  const weekAttempts = db.attempts.filter((a) => a.userId === studentId && a.submittedAt >= start && a.submittedAt <= end);
  const weeklyAttempts = weekAttempts.length;
  const weeklyCorrect = weekAttempts.filter((a) => a.isCorrect).length;
  const weeklyAccuracy = weeklyAttempts > 0 ? ((weeklyCorrect / weeklyAttempts) * 100).toFixed(1) + "%" : "0%";
  const solveCount = new Set(
    db.attempts.filter((a) => a.userId === studentId && a.isCorrect && a.submittedAt >= start && a.submittedAt <= end).map((a) => a.problemId)
  ).size;
  const weekMatches = db.matches.filter((m) => m.userId === studentId && (!m.fen || !!m.finishedAt) && m.createdAt >= start && m.createdAt <= end);
  const battleCount = weekMatches.length;
  const pvpWins = weekMatches.filter((m) => m.result === "win").length;
  const pvpLosses = weekMatches.filter((m) => m.result === "lose").length;
  const pvpDraws = weekMatches.filter((m) => m.result === "draw").length;
  const pointsGained = db.pointLedger.filter((e) => e.userId === studentId && e.createdAt >= start && e.createdAt <= end).reduce((sum, e) => sum + e.change, 0);

  // All-time accuracy
  const allAttempts = db.attempts.filter((a) => a.userId === studentId);
  const allCorrect = allAttempts.filter((a) => a.isCorrect).length;
  const totalAttempts = allAttempts.length;
  const totalAccuracy = totalAttempts > 0 ? ((allCorrect / totalAttempts) * 100).toFixed(1) + "%" : "0%";

  // Homework
  const studentClasses = db.classes.filter((c) => c.memberIds.includes(studentId));
  let homeworkDone = 0, homeworkTotal = 0;
  for (const cls of studentClasses) {
    const hws = db.homeworks.filter((h) => h.classId === cls.id && h.createdAt <= end && h.dueDate >= weekStartDate && h.dueDate <= weekEndDate);
    homeworkTotal += hws.length;
    for (const hw of hws) {
      if (db.homeworkAttempts.some((a) => a.homeworkId === hw.id && a.userId === studentId && a.isCorrect)) homeworkDone++;
    }
  }

  const parentTasks = db.parentTasks.filter((task) => task.parentId === parentId && task.childId === studentId && task.createdAt <= end && task.deadlineAt >= start);
  const parentTaskTotal = parentTasks.length;
  const parentTaskDone = parentTasks.filter((task) => !!task.completedAt).length;

  // Daily breakdown
  const dailyBreakdown: { date: string; solve: number; battle: number }[] = [];
  const weekStart = new Date(start);
  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart);
    date.setTime(date.getTime() + d * 24 * 60 * 60 * 1000);
    const ds = beijingToday(date);
    const bounds = beijingDayBounds(ds);
    dailyBreakdown.push({
      date: ds,
      solve: new Set(db.attempts.filter((a) => a.userId === studentId && a.isCorrect && a.submittedAt >= bounds.start && a.submittedAt < bounds.end).map((a) => a.problemId)).size,
      battle: db.matches.filter((m) => m.userId === studentId && (!m.fen || !!m.finishedAt) && m.createdAt >= bounds.start && m.createdAt < bounds.end).length,
    });
  }

  const activeDays = dailyBreakdown.filter((day) => day.solve > 0 || day.battle > 0).length;
  const bestDay = [...dailyBreakdown].sort((a, b) => (b.solve + b.battle) - (a.solve + a.battle))[0]?.date || "";

  const rank = getRank(student.points);

  // Generate AI commentary
  let aiCommentary = "";
  let suggestions: string[] = [];
  try {
    const result = await generateWeeklyCommentary({
      studentName: student.displayName,
      weekRange: `${weekStartDate} 至 ${weekEndDate}`,
      solveCount, battleCount, pvpWins, pvpLosses, pvpDraws,
      pointsGained, currentPoints: student.points,
      currentRank: rank.piece + rank.title,
      language,
    });
    aiCommentary = result.text || "";
    suggestions = result.text
      ? result.text.split(/[。！\n]/).filter((s: string) => s.includes("建议") || s.includes("可以") || s.includes("多") || s.includes("尝试")).slice(0, 4)
      : [];
  } catch {
    aiCommentary = "";
  }

  const localized = {
    zh: ["安排固定练习时间，并根据孩子精力调整题量。", "复盘本周的关键局面，先理解原因再继续练习。", "在班级页面查看作业截止时间和完成状态。"],
    en: ["Set a regular practice time and adjust the workload to your child's energy.", "Review key positions and understand mistakes before moving on.", "Check homework deadlines and completion in the class page."],
    ja: ["練習時間を決め、子どもの体調に合わせて量を調整しましょう。", "重要な局面を振り返り、ミスの理由を理解しましょう。", "クラス画面で宿題の締め切りと進捗を確認しましょう。"],
    fr: ["Fixez un horaire régulier et adaptez la charge à l'énergie de l'enfant.", "Revoyez les positions clés pour comprendre les erreurs.", "Vérifiez les échéances et les devoirs terminés dans la classe."],
    es: ["Fija un horario regular y adapta la carga a la energía del niño.", "Revisa posiciones clave para comprender los errores.", "Consulta los plazos y las tareas completadas en la clase."]
  };
  suggestions = localized[language];

  return {
    solveCount, battleCount, pvpWins, pvpLosses, pvpDraws,
    pointsGained, currentPoints: student.points,
    currentRank: rank.piece + " " + rank.title,
    totalAttempts, totalAccuracy,
    homeworkDone, homeworkTotal,
    dailyBreakdown,
    weeklyAttempts, weeklyCorrect, weeklyAccuracy,
    activeDays, bestDay,
    parentTaskDone, parentTaskTotal,
    aiCommentary, suggestions,
  };
}

// ── routes ──────────────────────────────────────────────────────

export const parentRoutes: FastifyPluginAsync = async (app) => {
  const bindAttempts = new Map<string, { count: number; until: number }>();


  // ── Binding Code (6-digit, 5-min expiry) ────────────────────

  // Student: get or create their 6-digit binding code (valid 5 min)
  app.get("/student/my-code", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "student") {
      return reply.code(403).send({ message: "仅学生可查看绑定码" });
    }
    // Remove expired codes for this student
    db.bindingCodes = db.bindingCodes.filter(
      (b) => !(b.studentId === userId && new Date(b.expiresAt) < new Date())
    );
    const existing = db.bindingCodes.find(b => b.studentId === userId);
    if (existing) return { code: existing.code, expiresAt: existing.expiresAt, expiresInSeconds: Math.max(0, Math.ceil((Date.parse(existing.expiresAt) - Date.now()) / 1000)) };
    // Create one active code per child.
    const code = generateBindingCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
    const bc = { code, studentId: userId, expiresAt, createdAt: nowIso() };
    db.bindingCodes.push(bc);
    return {
      code: bc.code,
      expiresAt: bc.expiresAt,
      expiresInSeconds: 300,
      message: "请在5分钟内让家长输入此码完成绑定"
    };
  });

  // Student: regenerate their binding code
  app.post("/student/regenerate-code", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "student") {
      return reply.code(403).send({ message: "仅学生可重新生成绑定码" });
    }
    db.bindingCodes = db.bindingCodes.filter((b) => b.studentId !== userId);
    const code = generateBindingCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    db.bindingCodes.push({ code, studentId: userId, expiresAt, createdAt: nowIso() });
    return {
      code,
      expiresAt,
      expiresInSeconds: 300,
      message: "新绑定码已生成，5分钟内有效"
    };
  });

  // Parent: bind a child using the 6-digit code
  app.post("/parent/bind-child", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") {
      return reply.code(403).send({ message: "仅家长可绑定孩子" });
    }
    for (const [key, attempt] of bindAttempts) if (attempt.until < Date.now()) bindAttempts.delete(key);
    const attempts = bindAttempts.get(userId) || { count: 0, until: Date.now() + 300000 };
    attempts.count++; bindAttempts.set(userId, attempts);
    if (attempts.count > 10) return reply.code(429).send({ message: "尝试次数过多，请5分钟后再试" });
    const body = bindChildBody.parse(request.body);
    if (body.code.length !== 6) {
      return reply.code(400).send({ message: "绑定码为6位数字" });
    }
    const bc = db.bindingCodes.find((b) => b.code === body.code);
    if (!bc) {
      return reply.code(404).send({ message: "绑定码无效，请让学生重新生成" });
    }
    // Check expiry
    if (new Date(bc.expiresAt) < new Date()) {
      db.bindingCodes = db.bindingCodes.filter((b) => b.code !== body.code);
      return reply.code(400).send({ message: "绑定码已过期（5分钟有效），请让学生重新生成" });
    }
    const child = getUserById(bc.studentId);
    if (!child || child.role !== "student") {
      return reply.code(404).send({ message: "学生不存在" });
    }
    if (user.childIds.includes(child.id)) {
      return reply.code(400).send({ message: "已经绑定过该学生" });
    }
    user.childIds.push(child.id);
    // Clean up used code
    db.bindingCodes = db.bindingCodes.filter((b) => b.studentId !== child.id);
    return { message: `成功绑定「${child.displayName}」`, childId: child.id, childName: child.displayName };
  });

  // ── My Children ────────────────────────────────────────────

  app.get("/parent/my-children", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") {
      return reply.code(403).send({ message: "仅家长可查看" });
    }
    const date = beijingToday();
    const children = (user.childIds as string[])
      .map((id: string) => db.users.find((u: any) => u.id === id))
      .filter(Boolean)
      .map((child: any) => {
        const attempts = db.attempts.filter((a: any) => a.userId === child.id);
        const correct = attempts.filter((a: any) => a.isCorrect).length;
        const todayStats = getTodayProgress(child.id, date);
        const rank = getRank(child.points);
        return {
          childId: child.id,
          childName: child.displayName,
          totalAttempts: attempts.length,
          accuracy: attempts.length ? Number(((correct / attempts.length) * 100).toFixed(1)) : 0,
          points: child.points,
          level: child.level,
          rankTitle: rank.piece + " " + rank.title,
          todaySolve: todayStats.solveCount,
          todayBattle: todayStats.battleCount
        };
      });
    return { children };
  });

  // Parent: child detail page
  app.get("/parent/child/:id/detail", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") {
      return reply.code(403).send({ message: "仅家长可查看" });
    }
    const { id } = request.params as { id: string };
    if (!user.childIds.includes(id)) {
      return reply.code(403).send({ message: "未绑定该学生" });
    }
    const child = getUserById(id);
    if (!child) return reply.code(404).send({ message: "学生不存在" });

    const date = beijingToday();
    const attempts = db.attempts.filter((a) => a.userId === id);
    const correctAttempts = attempts.filter((a) => a.isCorrect);
    const recentAttempts = attempts.slice(-20).reverse();
    const recentMatches = db.matches
      .filter((m) => m.userId === id && (!m.fen || !!m.finishedAt))
      .slice(-10)
      .reverse()
      .map((m) => ({
        id: m.id, mode: m.mode, difficulty: m.difficulty,
        result: m.result, createdAt: m.createdAt
      }));

    const homeworkAttempts = db.homeworkAttempts
      .filter((a) => a.userId === id)
      .slice(-20).reverse()
      .map((a) => {
        const hw = db.homeworks.find((h) => h.id === a.homeworkId);
        return {
          id: a.id, homeworkId: a.homeworkId,
          homeworkTitle: hw?.title ?? "未知作业",
          answer: a.answer, isCorrect: a.isCorrect,
          submittedAt: a.submittedAt
        };
      });

    const todayStats = getTodayProgress(id, date);
    const rank = getRank(child.points);

    return {
      childId: child.id,
      childName: child.displayName,
      points: child.points,
      level: child.level,
      rankTitle: rank.piece + " " + rank.title,
      totalAttempts: attempts.length,
      accuracy: attempts.length ? Number(((correctAttempts.length / attempts.length) * 100).toFixed(1)) : 0,
      todaySolve: todayStats.solveCount,
      todayBattle: todayStats.battleCount,
      recentAttempts: recentAttempts.map((a) => ({
        id: a.id, problemId: a.problemId, answer: a.answer,
        isCorrect: a.isCorrect, submittedAt: a.submittedAt
      })),
      recentMatches,
      homeworkAttempts
    };
  });

  // ── Weekly Reports ─────────────────────────────────────────

  // Parent: get weekly reports for a child
  app.get("/parent/child/:id/reports", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") {
      return reply.code(403).send({ message: "仅家长可查看" });
    }
    const { id } = request.params as { id: string };
    if (!user.childIds.includes(id)) {
      return reply.code(403).send({ message: "未绑定该学生" });
    }
    const reports = db.weeklyReports
      .filter((r) => r.studentId === id && r.parentId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);
    return { items: reports };
  });

  // Parent: generate/refresh a weekly report for a child
  app.post("/parent/child/:id/generate-report", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") {
      return reply.code(403).send({ message: "仅家长可生成报告" });
    }
    const { id } = request.params as { id: string };
    if (!user.childIds.includes(id)) {
      return reply.code(403).send({ message: "未绑定该学生" });
    }

    const rawLanguage = request.headers["x-app-language"];
    const language = typeof rawLanguage === "string" && ["zh", "en", "ja", "fr", "es"].includes(rawLanguage) ? rawLanguage as "zh" | "en" | "ja" | "fr" | "es" : "zh";
    const force = (request.query as any).force === "true";
    const { start } = getWeekRange(new Date());
    const existing = db.weeklyReports.find(
      (r) => r.studentId === id && r.parentId === userId && r.weekStart === start && (r.language || "zh") === language
    );
    // Return cached if exists and not forcing refresh
    if (existing && !force && existing.dailyBreakdown?.length && typeof existing.weeklyAttempts === "number" && typeof existing.weeklyAccuracy === "string" && typeof existing.activeDays === "number") return { report: existing, cached: true };


    try {
      const data = await generateWeeklyReport(id, userId, language);
      const { end } = getWeekRange(new Date());
      const report = {
        id: crypto.randomUUID(),
        studentId: id,
        parentId: userId,
        language,
        weekStart: start,
        weekEnd: end,
        ...data,
        createdAt: nowIso(),
      };
      db.weeklyReports = db.weeklyReports.filter(r => !(r.studentId === id && r.parentId === userId && r.weekStart === start && (r.language || "zh") === language));
      db.weeklyReports.push(report);
      return { report, cached: false, refreshed: !!existing };
    } catch (e: any) {
      return reply.code(500).send({ message: "生成报告失败：" + (e.message || "未知错误") });
    }
  });

  // ── Parent-assigned tasks ──────────────────────────────────

  const serializeParentTask = (task: any) => {
    const now = Date.now();
    const deadline = Date.parse(task.deadlineAt);
    const status = task.completedAt ? "completed" : (Number.isFinite(deadline) && now >= deadline ? "expired" : "active");
    return {
      id: task.id,
      childId: task.childId,
      childName: getUserById(task.childId)?.displayName ?? "未知",
      title: task.title,
      points: 10,
      deadlineAt: task.deadlineAt,
      completedAt: task.completedAt || null,
      createdAt: task.createdAt,
      status,
    };
  };

  app.post("/parent/task", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") return reply.code(403).send({ message: "仅家长可以布置任务" });
    const body = parentTaskBody.parse(request.body);
    if (!user.childIds.includes(body.childId)) return reply.code(403).send({ message: "未绑定该学生" });
    const deadline = Date.parse(body.deadlineAt);
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return reply.code(400).send({ message: "截止时间必须晚于当前北京时间" });
    const openCount = db.parentTasks.filter((task) => task.parentId === userId && task.childId === body.childId && !task.completedAt && Date.parse(task.deadlineAt) > Date.now()).length;
    if (openCount >= 5) return reply.code(400).send({ message: "每个孩子最多同时布置5项家长任务" });
    const task = { id: crypto.randomUUID(), parentId: userId, childId: body.childId, title: body.title, deadlineAt: new Date(deadline).toISOString(), completedAt: null, createdAt: nowIso() };
    db.parentTasks.push(task);
    return { task: serializeParentTask(task) };
  });

  app.get("/parent/tasks", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") return reply.code(403).send({ message: "仅家长可以查看任务" });
    return { tasks: db.parentTasks.filter((task) => task.parentId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(serializeParentTask) };
  });

  app.delete("/parent/task/:id", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const task = db.parentTasks.find((item) => item.id === (request.params as { id: string }).id);
    if (!task) return reply.code(404).send({ message: "任务不存在" });
    if (task.parentId !== userId) return reply.code(403).send({ message: "无权删除" });
    db.parentTasks = db.parentTasks.filter((item) => item.id !== task.id);
    return { success: true };
  });

  app.get("/student/parent-tasks", { preHandler: [authGuard] }, async request => {
    const userId = requireUserId(request);
    return { tasks: db.parentTasks.filter((task) => task.childId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(serializeParentTask) };
  });

  app.post("/student/parent-task/:id/complete", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const task = db.parentTasks.find((item) => item.id === (request.params as { id: string }).id);
    if (!task || task.childId !== userId) return reply.code(404).send({ message: "任务不存在" });
    if (task.completedAt) return { task: serializeParentTask(task), pointsAwarded: 0 };
    if (Date.now() >= Date.parse(task.deadlineAt)) return reply.code(400).send({ message: "任务已过期" });
    task.completedAt = nowIso();
    addPoints(userId, 10, `完成家长任务:${task.title}`);
    return { task: serializeParentTask(task), pointsAwarded: 10 };
  });

  app.get("/student/study-plans", { preHandler: [authGuard] }, async request => {
    const id = requireUserId(request);
    const date = beijingToday();
    const progress = getTodayProgress(id, date);
    const now = Date.now();
    return { plans: db.studyPlans.filter(p => p.childId === id).map(p => {
      const startAt = beijingDayBounds(p.startDate).start;
      const deadlineAt = p.deadlineAt || beijingDeadlineForDate(p.endDate);
      return { id: p.id, dailySolveTarget: p.dailySolveTarget, dailyBattleTarget: p.dailyBattleTarget, startDate: p.startDate, endDate: p.endDate, deadlineAt, status: now < Date.parse(startAt) ? "upcoming" : now >= Date.parse(deadlineAt) ? "expired" : "active", todaySolve: progress.solveCount, todayBattle: progress.battleCount };
    }) };
  });

  // ── Study Plans ────────────────────────────────────────────

  app.post("/parent/study-plan", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") {
      return reply.code(403).send({ message: "仅家长可创建学习计划" });
    }
    const body = studyPlanBody.parse(request.body);
    if (!user.childIds.includes(body.childId)) {
      return reply.code(403).send({ message: "未绑定该学生" });
    }
    if (body.startDate > body.endDate) return reply.code(400).send({ message: "结束日期不能早于开始日期" });
    const deadlineAt = body.deadlineAt ? new Date(Date.parse(body.deadlineAt)).toISOString() : beijingDeadlineForDate(body.endDate);
    if (!isDeadlineInsidePlan(deadlineAt, body.startDate, body.endDate) || Date.parse(deadlineAt) <= beijingDayStart(body.startDate)) return reply.code(400).send({ message: "截止时间必须位于计划日期范围内" });
    const plan = {
      id: crypto.randomUUID(),
      parentId: userId,
      childId: body.childId,
      dailySolveTarget: body.dailySolveTarget,
      dailyBattleTarget: body.dailyBattleTarget,
      startDate: body.startDate,
      endDate: body.endDate,
      deadlineAt,
      createdAt: nowIso()
    };
    db.studyPlans.push(plan);
    return { plan };
  });

  app.get("/parent/study-plans", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "parent") {
      return reply.code(403).send({ message: "仅家长可查看" });
    }
    const date = beijingToday();
    const now = Date.now();
    const plans = db.studyPlans
      .filter((p) => p.parentId === userId)
      .map((p) => {
        const child = getUserById(p.childId);
        const progress = getTodayProgress(p.childId, date);
        return {
          id: p.id,
          childId: p.childId,
          childName: child?.displayName ?? "未知",
          dailySolveTarget: p.dailySolveTarget,
          dailyBattleTarget: p.dailyBattleTarget,
          startDate: p.startDate,
          endDate: p.endDate,
          createdAt: p.createdAt,
          deadlineAt: p.deadlineAt || beijingDeadlineForDate(p.endDate),
          status: now < Date.parse(beijingDayBounds(p.startDate).start) ? "upcoming" : now >= Date.parse(p.deadlineAt || beijingDeadlineForDate(p.endDate)) ? "ended" : "active",
          todaySolve: progress.solveCount,
          todayBattle: progress.battleCount,
          solveProgress: p.dailySolveTarget > 0
            ? Number(((progress.solveCount / p.dailySolveTarget) * 100).toFixed(0))
            : 100,
          battleProgress: p.dailyBattleTarget > 0
            ? Number(((progress.battleCount / p.dailyBattleTarget) * 100).toFixed(0))
            : 100
        };
      });
    return { plans };
  });

  app.put("/parent/study-plan/:id", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    const plan = db.studyPlans.find((p) => p.id === id);
    if (!plan) return reply.code(404).send({ message: "学习计划不存在" });
    if (plan.parentId !== userId) {
      return reply.code(403).send({ message: "无权修改" });
    }
    const body = studyPlanUpdateBody.parse(request.body);
    const nextStartDate = body.startDate ?? plan.startDate;
    const nextEndDate = body.endDate ?? plan.endDate;
    if (nextStartDate > nextEndDate) return reply.code(400).send({ message: "结束日期不能早于开始日期" });
    const nextDeadlineAt = body.deadlineAt !== undefined
      ? (body.deadlineAt ? new Date(Date.parse(body.deadlineAt)).toISOString() : beijingDeadlineForDate(nextEndDate))
      : (isDeadlineInsidePlan(plan.deadlineAt, nextStartDate, nextEndDate) ? plan.deadlineAt : beijingDeadlineForDate(nextEndDate));
    if (!isDeadlineInsidePlan(nextDeadlineAt, nextStartDate, nextEndDate) || Date.parse(nextDeadlineAt || "") <= beijingDayStart(nextStartDate)) return reply.code(400).send({ message: "截止时间必须位于计划日期范围内" });
    if (body.dailySolveTarget !== undefined) plan.dailySolveTarget = body.dailySolveTarget;
    if (body.dailyBattleTarget !== undefined) plan.dailyBattleTarget = body.dailyBattleTarget;
    if (body.startDate !== undefined) plan.startDate = body.startDate;
    if (body.endDate !== undefined) plan.endDate = body.endDate;
    plan.deadlineAt = nextDeadlineAt;
    return { plan };
  });

  app.delete("/parent/study-plan/:id", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    const plan = db.studyPlans.find((p) => p.id === id);
    if (!plan) return reply.code(404).send({ message: "学习计划不存在" });
    if (plan.parentId !== userId) {
      return reply.code(403).send({ message: "无权删除" });
    }
    db.studyPlans = db.studyPlans.filter((p) => p.id !== id);
    return { success: true };
  });
};
