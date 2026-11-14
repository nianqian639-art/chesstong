import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../services/db.js";
import { analyzePgn, analyzePuzzleMove, playMove, startMatch, suggestMove, VARIANTS } from "../services/chess.js";
import { generateExplanation, generatePgnAnalysis, generatePuzzleFollowup } from "../services/ai.js";
import { judgeAnswer } from "./problems.js";

const language = (request: { headers: Record<string, string | string[] | undefined> }) => {
  const value = request.headers["x-app-language"];
  return typeof value === "string" && ["zh", "en", "ja", "fr", "es"].includes(value) ? value as "zh" | "en" | "ja" | "fr" | "es" : "zh";
};
const problemBody = z.object({ problemId: z.string(), answer: z.string().min(1) });
const explainBody = problemBody.extend({ language: z.enum(["zh", "en", "ja", "fr", "es"]).optional() });
const askBody = problemBody.extend({ question: z.string().trim().min(1).max(500), history: z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(500)})).max(6).optional(), language: z.enum(["zh", "en", "ja", "fr", "es"]).optional() });
const moveBody = z.object({ fen: z.string(), move: z.string(), difficulty: z.number().min(1).max(20), previousEngineMove: z.string().nullable().optional() });
const suggestBody = z.object({ fen: z.string(), difficulty: z.number().min(1).max(20) });

export const trialRoutes: FastifyPluginAsync = async (app) => {
  const listProblems = async () => {
    const items = db.problems.slice(0, 30).map(({ solution: _solution, solutionUci: _solutionUci, acceptedAnswers: _acceptedAnswers, ...problem }) => problem);
    return { items };
  };
  app.get("/trial/problems", listProblems);
  app.get("/trial/problems/list", listProblems);

  app.post("/trial/problems/submit", async (request, reply) => {
    const body = problemBody.parse(request.body);
    const problem = db.problems.find((item) => item.id === body.problemId);
    if (!problem) return reply.code(404).send({ message: "题目不存在" });
    return { isCorrect: judgeAnswer(problem, body.answer), correctAnswer: problem.solution, correctUci: problem.solutionUci ?? null, awardedPoints: 0, points: 0, level: 1 };
  });

  app.post("/trial/problems/explain", async (request, reply) => {
    const body = explainBody.parse(request.body);
    const problem = db.problems.find((item) => item.id === body.problemId);
    if (!problem) return reply.code(404).send({ message: "题目不存在" });
    const stockfish = await analyzePuzzleMove(problem.fen);
    const explain = await generateExplanation({ question: problem.question, answer: problem.solution, answerUci: problem.solutionUci, learnerAnswer: body.answer, fen: problem.fen, isCorrect: judgeAnswer(problem, body.answer), knowledgePoint: problem.knowledgePoint, audience: "child", language: body.language ?? language(request), stockfish });
    return { explanation: explain.text, source: explain.source, engineFeedback: explain.engineFeedback };
  });

  app.post("/trial/problems/ask", async (request, reply) => {
    const body = askBody.parse(request.body);
    const problem = db.problems.find((item) => item.id === body.problemId);
    if (!problem) return reply.code(404).send({ message: "题目不存在" });
    const stockfish = await analyzePuzzleMove(problem.fen);
    const result = await generatePuzzleFollowup({ question: problem.question, answer: problem.solution, answerUci: problem.solutionUci, learnerAnswer: body.answer, fen: problem.fen, isCorrect: judgeAnswer(problem, body.answer), knowledgePoint: problem.knowledgePoint, learnerQuestion: body.question, conversationHistory: body.history, audience: "child", language: body.language ?? language(request), stockfish });
    return { answer: result.text, source: result.source };
  });

  app.get("/trial/match/variants", async () => ({ items: Object.values(VARIANTS) }));

  app.post("/trial/match/start", async (request) => {
    const body = z.object({ mode: z.enum(["standard", "teaching"]), difficulty: z.number().min(1).max(20), variant: z.string().optional() }).parse(request.body);
    return { matchId: "trial", ...startMatch({ mode: body.mode, difficulty: body.difficulty, variant: body.variant }), variant: body.variant || "standard" };
  });

  app.post("/trial/match/move", async (request, reply) => {
    const body = moveBody.parse(request.body);
    const result = await playMove({ fen: body.fen, move: body.move, difficulty: body.difficulty, previousEngineMove: body.previousEngineMove ?? null });
    if (!result.playerMoveAccepted) return reply.code(400).send({ message: "非法走子" });
    return result;
  });

  app.post("/trial/match/suggest", async (request) => {
    const body = suggestBody.parse(request.body);
    return suggestMove({ ...body, audience: "child", language: language(request) });
  });

  app.post("/trial/match/analyze", async (request) => {
    const body = z.object({ pgn: z.string().min(1) }).parse(request.body);
    const local = await analyzePgn(body.pgn, "child", "w");
    const ai = await generatePgnAnalysis({ pgn: body.pgn, localSummary: local.summary, keyMoves: local.keyMoves, movesWithActors: local.movesWithActors, playerColor: "w", audience: "child", language: language(request) });
    return { ...local, summary: ai.summary, source: ai.source };
  });
};
