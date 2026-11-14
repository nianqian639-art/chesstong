import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Chess } from "chess.js";
import { authGuard } from "../middleware/auth.js";
import { analyzePgn, checkVariantWin, playMove, startMatch, suggestMove, VARIANTS } from "../services/chess.js";
import { generatePgnAnalysis } from "../services/ai.js";
import { addPoints, db } from "../services/db.js";
import { getUserById, nowIso, requireUserId } from "../services/common.js";

const startBody = z.object({
  mode: z.enum(["standard", "teaching"]),
  difficulty: z.number().min(1).max(20),
  variant: z.string().refine(v => Object.hasOwn(VARIANTS, v), "未知棋种").optional()
});

const moveBody = z.object({
  matchId: z.string(),
  fen: z.string(),
  move: z.string(),
  difficulty: z.number().min(1).max(20),
  previousEngineMove: z.string().nullable().optional(),
  variant: z.string().optional()
});

const analyzeBody = z.object({
  pgn: z.string().min(1)
});

const suggestBody = z.object({
  fen: z.string(),
  difficulty: z.number().min(1).max(20)
});
const pendingMoves = new Set<string>();
const requestLanguage = (request: { headers: Record<string, string | string[] | undefined> }) => {
  const language = request.headers["x-app-language"];
  return typeof language === "string" && ["zh", "en", "ja", "fr", "es"].includes(language) ? language as "zh" | "en" | "ja" | "fr" | "es" : "zh";
};

export const matchRoutes: FastifyPluginAsync = async (app) => {
  // Get available battle variants
  app.get("/match/variants", { preHandler: [authGuard] }, async () => {
    return { items: Object.values(VARIANTS) };
  });

  // Get match history for current user
  app.get("/match/history", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);
    const items = db.matches
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    return { items };
  });

  app.post("/match/start", { preHandler: [authGuard] }, async (request) => {
    const body = startBody.parse(request.body);
    const userId = requireUserId(request);
    const state = startMatch({ mode: body.mode, difficulty: body.difficulty, variant: body.variant });
    const matchId = crypto.randomUUID();
    db.matches.push({
      id: matchId,
      userId,
      mode: body.mode,
      difficulty: body.difficulty,
      pgn: "",
      result: "draw",
      createdAt: nowIso(),
      fen: state.matchState,
      variant: body.variant || "standard",
      finishedAt: null
    });
    return {
      matchId,
      ...state,
      variant: body.variant || "standard"
    };
  });

  app.post("/match/move", { preHandler: [authGuard] }, async (request, reply) => {
    const body = moveBody.parse(request.body);
    const userId = requireUserId(request);
    const match = db.matches.find(m => m.id === body.matchId && m.userId === userId);
    if (!match) return reply.code(404).send({ message: "对局不存在" });
    // Legacy records have no authoritative board and must not be used to award points.
    if (!match.fen || match.finishedAt) return reply.code(409).send({ message: "对局已结束，请开始新对局" });
    if (body.fen !== match.fen || pendingMoves.has(match.id)) {
      return reply.code(409).send({ message: "棋盘状态已改变，请等待当前走子完成" });
    }
    pendingMoves.add(match.id);
    try {
      const history = new Chess(VARIANTS[match.variant || "standard"].fen);
      if (match.pgn) history.loadPgn(match.pgn);
      const result = await playMove({ fen: match.fen, move: body.move, difficulty: match.difficulty,
        previousEngineMove: history.history().at(-1) ?? null });
      if (!result.playerMoveAccepted) return reply.code(400).send({ message: "非法走子" });
      if (result.playerMove) history.move(result.playerMove);
      if (result.engineMove) history.move(result.engineMove);
      const variantCheck = checkVariantWin(result.fenAfter, match.variant || "standard");
      const isGameOver = result.gameOver || variantCheck.over;
      match.fen = result.fenAfter;
      match.pgn = history.pgn();
      let awardedPoints = 0;
      if (isGameOver) {
        match.result = variantCheck.result || result.gameResult || "draw";
        match.finishedAt = nowIso();
        awardedPoints = match.result === "win" ? 20 : 10;
        addPoints(userId, awardedPoints, "完成人机对战:" + match.id);
      }
      return { ...result, gameOver: isGameOver, gameResult: isGameOver ? match.result : null,
        variantWin: variantCheck.over, pgn: match.pgn, awardedPoints,
        points: getUserById(userId)?.points };
    } finally {
      pendingMoves.delete(match.id);
    }
  });

  app.post("/match/suggest", { preHandler: [authGuard] }, async (request) => {
    const body = suggestBody.parse(request.body);
    const user = getUserById(requireUserId(request));
    return suggestMove({
      fen: body.fen,
      difficulty: body.difficulty,
      language: requestLanguage(request),
      audience: user?.role === "student" ? "child" : "general"
    });
  });

  app.post("/match/analyze", { preHandler: [authGuard] }, async (request) => {
    const body = analyzeBody.parse(request.body);
    const user = getUserById(requireUserId(request));
    const audience = user?.role === "student" ? "child" : "general";
    const local = await analyzePgn(body.pgn, audience, "w");
    const ai = await generatePgnAnalysis({
      pgn: body.pgn,
      localSummary: local.summary,
      keyMoves: local.keyMoves,
      movesWithActors: local.movesWithActors,
      playerColor: "w",
      audience,
      language: requestLanguage(request)
    });

    return {
      ...local,
      summary: ai.summary,
      source: ai.source
    };
  });
};
