import { FastifyPluginAsync } from "fastify";
import { Chess } from "chess.js";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { db } from "../services/db.js";
import { getUserById, nowIso, requireUserId } from "../services/common.js";

// ── schemas ─────────────────────────────────────────────────────

const createClassBody = z.object({
  name: z.string().trim().min(1).max(30),
  inviteCode: z.string().length(6).optional()
});

const joinClassBody = z.object({
  inviteCode: z.string().length(6)
});

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "日期无效");

const homeworkBody = z.object({
  title: z.string().min(1).max(60),
  fen: z.string().min(1),
  solutions: z.array(z.string()).optional(),
  dueDate: dateOnly
});

const submitBody = z.object({
  answer: z.string().min(1)
});

const noticeBody = z.object({
  message: z.string().min(1).max(300)
});

const taskBody = z.object({
  classId: z.string(),
  title: z.string().min(1).max(40),
  requiredSolveCount: z.number().int().min(1).max(50),
  dueDate: dateOnly
});

const publishBody = z.object({
  classId: z.string(),
  message: z.string().min(1).max(200)
});

// ── helpers ─────────────────────────────────────────────────────

const generateInviteCode = (): string => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const isClassMember = (classId: string, userId: string): boolean => {
  const cls = db.classes.find((c) => c.id === classId);
  const user = getUserById(userId);
  return !!cls && (user?.role === "parent" ? user.childIds.some(id => cls.memberIds.includes(id)) : cls.memberIds.includes(userId));
};

const normalizeAnswer = (text: string): string =>
  text.replace(/\s+/g, "").replace(/[+#?!]/g, "").toLowerCase();

const moveToUci = (move: { from: string; to: string; promotion?: string }): string =>
  `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();

const answerCandidates = (answers: string[]): string[] => {
  return answers
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildAcceptedAnswerSet = (fen: string, answers: string[]): Set<string> => {
  const accepted = new Set<string>();

  for (const answer of answerCandidates(answers)) {
    accepted.add(normalizeAnswer(answer));

    try {
      const chess = new Chess(fen);
      const move = chess.move(answer, { strict: false });
      if (move) {
        accepted.add(normalizeAnswer(move.san));
        accepted.add(moveToUci(move));
      }
    } catch {
      // The answer may be a teacher-entered text key rather than a parseable move.
    }
  }

  return accepted;
};

// ── routes ──────────────────────────────────────────────────────

export const classRoutes: FastifyPluginAsync = async (app) => {

  // ── Class CRUD ──────────────────────────────────────────────

  app.post("/class/create", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "teacher") {
      return reply.code(403).send({ message: "仅老师可以创建班级" });
    }

    const body = createClassBody.parse(request.body);

    let inviteCode: string;
    if (body.inviteCode) {
      if (db.classes.some((c) => c.inviteCode === body.inviteCode)) {
        return reply.code(400).send({ message: "该邀请码已被使用，请换一个" });
      }
      inviteCode = body.inviteCode;
    } else {
      inviteCode = generateInviteCode();
      while (db.classes.some((c) => c.inviteCode === inviteCode)) {
        inviteCode = generateInviteCode();
      }
    }

    const cls = {
      id: crypto.randomUUID(),
      name: body.name,
      teacherId: userId,
      inviteCode,
      memberIds: [userId],
      createdAt: nowIso()
    };
    db.classes.push(cls);

    if (!user.classIds.includes(cls.id)) {
      user.classIds.push(cls.id);
    }

    return { class: cls, inviteCode };
  });

  app.post("/class/join", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user) return reply.code(404).send({ message: "用户不存在" });

    if (user.role !== "student") return reply.code(403).send({ message: "仅学生可使用邀请码加入班级，家长请先绑定孩子" });
    const body = joinClassBody.parse(request.body);
    const cls = db.classes.find((c) => c.inviteCode === body.inviteCode);
    if (!cls) return reply.code(404).send({ message: "邀请码无效" });

    if (cls.memberIds.includes(userId)) {
      return reply.code(400).send({ message: "你已在这个班级中" });
    }

    cls.memberIds.push(userId);
    if (!user.classIds.includes(cls.id)) {
      user.classIds.push(cls.id);
    }

    return { message: `成功加入「${cls.name}」`, classId: cls.id, className: cls.name };
  });

  app.get("/class/my-classes", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);
    const items = db.classes
      .filter((c) => getUserById(userId)?.role === "parent" ? getUserById(userId)!.childIds.some(id => c.memberIds.includes(id)) : c.memberIds.includes(userId))
      .map((c) => ({
        id: c.id,
        name: c.name,
        inviteCode: c.inviteCode,
        teacherId: c.teacherId,
        memberCount: c.memberIds.filter(id => getUserById(id)?.role === "student").length,
        createdAt: c.createdAt
      }));
    return { items };
  });

  app.get("/class/:id", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    const cls = db.classes.find((c) => c.id === id);
    if (!cls) return reply.code(404).send({ message: "班级不存在" });
    const viewer = getUserById(userId);
    const linkedChildren = viewer?.role === "parent" ? viewer.childIds.filter(cid => cls.memberIds.includes(cid)) : [];
    if (viewer?.role === "parent" ? !linkedChildren.length : !cls.memberIds.includes(userId)) {
      return reply.code(403).send({ message: "你不在这个班级中" });
    }

    const members = (cls.memberIds as string[])
      .map((mid: string) => db.users.find((u: any) => u.id === mid))
      .filter(Boolean)
      .map((u: any) => ({ id: u.id, displayName: u.displayName, role: u.role, points: u.points, level: u.level }));

    const homeworks = db.homeworks
      .filter((h) => h.classId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const notices = db.classNotices
      .filter((n) => n.classId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      id: cls.id,
      name: cls.name,
      inviteCode: cls.inviteCode,
      teacherId: cls.teacherId,
      isTeacher: cls.teacherId === userId,
      memberCount: members.filter(m => m.role === "student").length,
      members: viewer?.role === "parent" ? members.filter(m => linkedChildren.includes(m.id)) : members,
      homeworks: homeworks.map((h) => ({
        id: h.id, title: h.title, fen: h.fen,
        ...(cls.teacherId === userId ? { acceptedAnswers: h.acceptedAnswers } : {}),
        solved: db.homeworkAttempts.some(a => a.homeworkId === h.id && a.userId === userId && a.isCorrect),
        dueDate: h.dueDate, createdAt: h.createdAt,
        submitCount: db.homeworkAttempts.filter((a) => a.homeworkId === h.id).length
      })),
      notices: notices.map((n) => ({
        id: n.id, message: n.message, createdAt: n.createdAt,
        creatorName: db.users.find((u) => u.id === n.creatorId)?.displayName ?? "未知"
      }))
    };
  });

  // ── Homework ────────────────────────────────────────────────

  app.post("/class/:id/homework", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || user.role !== "teacher") {
      return reply.code(403).send({ message: "仅老师可以布置作业" });
    }
    const { id } = request.params as { id: string };
    const cls = db.classes.find((c) => c.id === id);
    if (!cls) return reply.code(404).send({ message: "班级不存在" });
    if (cls.teacherId !== userId) {
      return reply.code(403).send({ message: "仅本班老师可以布置作业" });
    }

    const body = homeworkBody.parse(request.body);
    try { new Chess(body.fen); } catch { return reply.code(400).send({ message: "棋盘局面无效，请检查双方国王和棋子位置" }); }
    if (!body.solutions?.length || body.solutions.some(answer => { try { return !new Chess(body.fen).move(answer, { strict: false }); } catch { return true; } })) return reply.code(400).send({ message: "请填写该局面下合法的标准答案" });
    const hw = {
      id: crypto.randomUUID(),
      classId: id,
      creatorId: userId,
      title: body.title,
      fen: body.fen,
      acceptedAnswers: body.solutions || [],
      requiredSolveCount: 1,
      dueDate: body.dueDate,
      createdAt: nowIso()
    };
    db.homeworks.push(hw);
    return { homework: hw };
  });

  app.get("/class/:id/homework", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    if (!isClassMember(id, userId)) {
      return reply.code(403).send({ message: "你不在这个班级中" });
    }

    const items = db.homeworks
      .filter((h) => h.classId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((h) => {
        const myAttempts = db.homeworkAttempts.filter(
          (a) => a.homeworkId === h.id && a.userId === userId
        );
        const solved = myAttempts.some((a) => a.isCorrect);
        return {
          id: h.id, title: h.title, fen: h.fen,
          ...(db.classes.find(c => c.id === id)?.teacherId === userId ? { acceptedAnswers: h.acceptedAnswers } : {}),
          dueDate: h.dueDate, createdAt: h.createdAt,
          solved, totalAttempts: db.homeworkAttempts.filter((a) => a.homeworkId === h.id).length,
          myAttemptCount: myAttempts.length
        };
      });

    return { items };
  });

  app.post("/class/:id/homework/:hid/submit", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id, hid } = request.params as { id: string; hid: string };
    if (!isClassMember(id, userId)) {
      return reply.code(403).send({ message: "你不在这个班级中" });
    }

    if (getUserById(userId)?.role !== "student") return reply.code(403).send({ message: "仅学生可提交作业" });
    const hw = db.homeworks.find((h) => h.id === hid && h.classId === id);
    if (!hw) return reply.code(404).send({ message: "作业不存在" });

    if (new Date().toISOString().slice(0, 10) > hw.dueDate.slice(0, 10)) return reply.code(400).send({ message: "作业已截止" });
    const body = submitBody.parse(request.body);

    let isCorrect = false;

    if (hw.acceptedAnswers && hw.acceptedAnswers.length > 0) {
      const accepted = buildAcceptedAnswerSet(hw.fen, hw.acceptedAnswers as string[]);
      isCorrect = accepted.has(normalizeAnswer(body.answer));

      if (!isCorrect) {
        try {
          const chess = new Chess(hw.fen);
          const move = chess.move(body.answer, { strict: false });
          if (move) {
            isCorrect = accepted.has(normalizeAnswer(move.san)) || accepted.has(moveToUci(move));
          }
        } catch { /* keep false */ }
      }
    } else {
      // No answer key — accept any legal move
      try {
        const chess = new Chess(hw.fen);
        isCorrect = !!chess.move(body.answer, { strict: false });
      } catch { isCorrect = false; }
    }

    const attempt = {
      id: crypto.randomUUID(),
      homeworkId: hid,
      userId,
      answer: body.answer,
      isCorrect,
      submittedAt: nowIso()
    };
    db.homeworkAttempts.push(attempt);

    return { isCorrect, submittedAt: attempt.submittedAt };
  });

  // ── Notices ─────────────────────────────────────────────────

  app.post("/class/:id/notice", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || (user.role !== "teacher" && user.role !== "parent")) {
      return reply.code(403).send({ message: "无权限发布公告" });
    }
    const { id } = request.params as { id: string };
    if (db.classes.find(c => c.id === id)?.teacherId !== userId) return reply.code(403).send({ message: "仅本班老师可以发布公告" });

    const body = noticeBody.parse(request.body);
    const notice = {
      id: crypto.randomUUID(),
      classId: id,
      creatorId: userId,
      message: body.message,
      createdAt: nowIso()
    };
    db.classNotices.push(notice);
    return { notice };
  });

  app.get("/class/:id/notices", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    if (!isClassMember(id, userId)) {
      return reply.code(403).send({ message: "你不在这个班级中" });
    }

    const items = db.classNotices
      .filter((n) => n.classId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((n) => ({
        id: n.id, message: n.message, createdAt: n.createdAt,
        creatorName: db.users.find((u) => u.id === n.creatorId)?.displayName ?? "未知"
      }));
    return { items };
  });

  app.get("/class/:id/progress", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params as { id: string };
    const cls = db.classes.find(c => c.id === id);
    if (!cls) return reply.code(404).send({ message: "班级不存在" });
    const viewer = getUserById(userId);
    const owned = cls.teacherId === userId && viewer?.role === "teacher";
    const children = viewer?.role === "parent" ? viewer.childIds : [];
    if (!owned && !children.some(cid => cls.memberIds.includes(cid))) return reply.code(403).send({ message: "无权限查看学生进度" });
    const hws = db.homeworks.filter(h => h.classId === id);
    return { students: cls.memberIds.filter(cid => getUserById(cid)?.role === "student" && (owned || children.includes(cid))).map(cid => {
      const child = getUserById(cid)!;
      const attempts = db.attempts.filter(a => a.userId === cid);
      return { childId: cid, childName: child.displayName, points: child.points, totalAttempts: attempts.length,
        accuracy: attempts.length ? Math.round(100 * attempts.filter(a => a.isCorrect).length / attempts.length) : 0,
        homeworks: hws.map(hw => { const submitted = db.homeworkAttempts.filter(a => a.homeworkId === hw.id && a.userId === cid);
          return { id: hw.id, title: hw.title, dueDate: hw.dueDate, solved: submitted.some(a => a.isCorrect), attempts: submitted.length, lastSubmittedAt: submitted.at(-1)?.submittedAt || null };
        }) };
    }) };
  });

  // ── Legacy compat ───────────────────────────────────────────

  app.get("/parent/child-progress", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || (user.role !== "parent" && user.role !== "teacher")) {
      return reply.code(403).send({ message: "无权限访问" });
    }

    const childIds = user.role === "teacher"
      ? db.classes
          .filter((c) => c.teacherId === userId)
          .flatMap((c) => c.memberIds)
          .filter((id) => id !== userId)
      : user.childIds;

    const children = [...new Set(childIds as string[])]
      .map((id: string) => db.users.find((u: any) => u.id === id))
      .filter(child => child?.role === "student")
      .map((child: any) => {
        const attempts = db.attempts.filter((a) => a.userId === child.id);
        const correct = attempts.filter((a) => a.isCorrect).length;
        return {
          childId: child.id, childName: child.displayName,
          totalAttempts: attempts.length,
          accuracy: attempts.length ? Number(((correct / attempts.length) * 100).toFixed(1)) : 0,
          points: child.points, level: child.level
        };
      });

    return { children };
  });

  app.post("/class/task/create", { preHandler: [authGuard] }, async (request, reply) => {
    const body = taskBody.parse(request.body);
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || (user.role !== "parent" && user.role !== "teacher")) {
      return reply.code(403).send({ message: "无权限发布任务" });
    }

    if (db.classes.find(c => c.id === body.classId)?.teacherId !== userId) return reply.code(403).send({ message: "仅本班老师可以发布任务" });
    const task = {
      id: crypto.randomUUID(),
      classId: body.classId,
      creatorId: userId,
      title: body.title,
      requiredSolveCount: body.requiredSolveCount,
      dueDate: body.dueDate,
      createdAt: nowIso()
    };
    db.classTasks.push(task);
    return { success: true, task };
  });

  app.post("/class/notice/publish", { preHandler: [authGuard] }, async (request, reply) => {
    const body = publishBody.parse(request.body);
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user || (user.role !== "parent" && user.role !== "teacher")) {
      return reply.code(403).send({ message: "无权限发布公告" });
    }

    if (db.classes.find(c => c.id === body.classId)?.teacherId !== userId) return reply.code(403).send({ message: "仅本班老师可以发布公告" });
    const notice = {
      id: crypto.randomUUID(),
      classId: body.classId,
      creatorId: userId,
      message: body.message,
      createdAt: nowIso()
    };
    db.classNotices.push(notice);
    return { success: true, notice };
  });
};
