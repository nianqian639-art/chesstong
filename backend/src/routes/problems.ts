import { FastifyPluginAsync } from "fastify";
import { Chess } from "chess.js";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { db, addPoints } from "../services/db.js";
import { generateExplanation, generatePuzzleFollowup } from "../services/ai.js";
import { analyzePuzzleMove } from "../services/chess.js";
import { getUserById, nowIso, requireUserId } from "../services/common.js";
import type { Problem } from "../models/types.js";

const listQuery = z.object({
  gradeBand: z.string().optional(),
  difficulty: z.coerce.number().min(1).max(5).optional()
});

const submitBody = z.object({
  problemId: z.string(),
  answer: z.string().min(1)
});

const explainBody = z.object({
  problemId: z.string(),
  answer: z.string().min(1),
  language: z.enum(["zh", "en", "ja", "fr", "es"]).optional()
});
const askBody = z.object({ problemId: z.string(), answer: z.string().min(1), question: z.string().trim().min(1).max(500), history: z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(500)})).max(6).optional(), language: z.enum(["zh", "en", "ja", "fr", "es"]).optional() });

type AppLanguage = "zh" | "en" | "ja" | "fr" | "es";

const requestLanguage = (request: { headers: Record<string, string | string[] | undefined> }): AppLanguage => {
  const value = request.headers["x-app-language"];
  return typeof value === "string" && ["zh", "en", "ja", "fr", "es"].includes(value) ? value as AppLanguage : "zh";
};

const puzzleCopy: Record<Exclude<AppLanguage, "zh">, { question: string; hint: string; points: Record<string, string> }> = {
  en: { question: "Find the best move in this position.", hint: "Look for checks, captures, and threats.", points: { "后排将杀": "Back-rank mate", "皇后后排将杀": "Queen back-rank mate", "升变": "Promotion", "皇后与王配合": "Queen and king", "车与王配合": "Rook and king", "骑士双攻": "Knight fork", "吃无保护子": "Capture an undefended piece", "后吃无保护子": "Queen captures an undefended piece", "象吃无保护子": "Bishop captures an undefended piece" } },
  ja: { question: "この局面で最善手を見つけましょう。", hint: "チェック、駒取り、脅威を探しましょう。", points: { "后排将杀": "バックランクメイト", "皇后后排将杀": "クイーンによるバックランクメイト", "升变": "昇格", "皇后与王配合": "クイーンとキング", "车与王配合": "ルークとキング", "骑士双攻": "ナイトフォーク", "吃无保护子": "守られていない駒を取る", "后吃无保护子": "クイーンで守られていない駒を取る", "象吃无保护子": "ビショップで守られていない駒を取る" } },
  fr: { question: "Trouvez le meilleur coup dans cette position.", hint: "Cherchez les échecs, les prises et les menaces.", points: { "后排将杀": "Mat de la dernière rangée", "皇后后排将杀": "Mat de la dernière rangée avec la dame", "升变": "Promotion", "皇后与王配合": "Dame et roi", "车与王配合": "Tour et roi", "骑士双攻": "Fourchette de cavalier", "吃无保护子": "Prendre une pièce non protégée", "后吃无保护子": "La dame prend une pièce non protégée", "象吃无保护子": "Le fou prend une pièce non protégée" } },
  es: { question: "Encuentra la mejor jugada en esta posición.", hint: "Busca jaques, capturas y amenazas.", points: { "后排将杀": "Mate de la última fila", "皇后后排将杀": "Mate de la última fila con dama", "升变": "Promoción", "皇后与王配合": "Dama y rey", "车与王配合": "Torre y rey", "骑士双攻": "Doble ataque de caballo", "吃无保护子": "Capturar una pieza sin defensa", "后吃无保护子": "La dama captura una pieza sin defensa", "象吃无保护子": "El alfil captura una pieza sin defensa" } }
};

const localizeProblem = (problem: Problem, language: AppLanguage): Problem => {
  if (language === "zh") return problem;
  const copy = puzzleCopy[language];
  return { ...problem, knowledgePoint: copy.points[problem.knowledgePoint] ?? copy.question, question: copy.question, hints: problem.hints.map(() => copy.hint) };
};

const normalizeAnswer = (text: string): string => text.replace(/\s+/g, "").replace(/[+#?!]/g, "").toLowerCase();

const moveToUci = (move: { from: string; to: string; promotion?: string }): string => {
  return `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();
};

const answerCandidates = (answers: Array<string | undefined>): string[] => {
  return answers
    .filter((item): item is string => Boolean(item))
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
};

const parsePuzzleMove = (chess: Chess, answer: string) => {
  const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(answer.trim());
  if (!uci) return chess.move(answer, { strict: false });

  const from = uci[1].toLowerCase();
  const to = uci[2].toLowerCase();
  const piece = chess.get(from as any);
  const promotes = piece?.type === "p" && ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));
  return chess.move({ from: from as any, to: to as any, promotion: (uci[3]?.toLowerCase() ?? (promotes ? "q" : undefined)) as any });
};

const buildAcceptedAnswerSet = (fen: string, answers: Array<string | undefined>): Set<string> => {
  const accepted = new Set<string>();

  for (const answer of answerCandidates(answers)) {
    try {
      const chess = new Chess(fen);
      const move = parsePuzzleMove(chess, answer);
      if (move) {
        accepted.add(normalizeAnswer(move.san));
        accepted.add(moveToUci(move));
      }
    } catch {
      // Invalid puzzle answers are ignored; they cannot make a learner's move correct.
    }
  }

  return accepted;
};

const isMateInOneProblem = (problem: (typeof db.problems)[number]): boolean => {
  return problem.type === "mate_in_1" || problem.question.includes("一步将死");
};

export const judgeAnswer = (problem: (typeof db.problems)[number], answer: string): boolean => {
  try {
    const chess = new Chess(problem.fen);
    const move = parsePuzzleMove(chess, answer);
    if (!move) {
      return false;
    }
    if (isMateInOneProblem(problem)) return chess.isCheckmate();

    const accepted = buildAcceptedAnswerSet(problem.fen, [problem.solution, problem.solutionUci, ...(problem.acceptedAnswers ?? [])]);
    return accepted.has(normalizeAnswer(move.san)) || accepted.has(moveToUci(move));
  } catch {
    return false;
  }
};

const withoutPuzzleSolutions = (problem: Problem): Omit<Problem, "solution" | "solutionUci" | "acceptedAnswers"> => {
  const publicProblem = { ...problem } as Partial<Problem>;
  delete publicProblem.solution;
  delete publicProblem.solutionUci;
  delete publicProblem.acceptedAnswers;
  return publicProblem as Omit<Problem, "solution" | "solutionUci" | "acceptedAnswers">;
};

export const problemRoutes: FastifyPluginAsync = async (app) => {
  app.get("/problems/list", { preHandler: [authGuard] }, async (request) => {
    const language = requestLanguage(request);
    const query = listQuery.parse(request.query);
    const list = db.problems.filter((problem) => {
      if (query.gradeBand && problem.gradeBand !== query.gradeBand) {
        return false;
      }
      if (query.difficulty && problem.difficulty !== query.difficulty) {
        return false;
      }
      return true;
    });
    return { items: list.map((problem) => withoutPuzzleSolutions(localizeProblem(problem, language))) };
  });

  app.post("/problems/submit", { preHandler: [authGuard] }, async (request, reply) => {
    const body = submitBody.parse(request.body);
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user) {
      return reply.code(404).send({ message: "用户不存在" });
    }

    const problem = db.problems.find((item) => item.id === body.problemId);
    if (!problem) {
      return reply.code(404).send({ message: "题目不存在" });
    }

    const isCorrect = judgeAnswer(problem, body.answer);
    const alreadySolved = db.attempts.some((attempt) => attempt.userId === userId && attempt.problemId === problem.id && attempt.isCorrect);

    db.attempts.push({
      id: crypto.randomUUID(),
      userId,
      problemId: problem.id,
      answer: body.answer,
      isCorrect,
      submittedAt: nowIso()
    });

    const awardedPoints = isCorrect && !alreadySolved ? 15 : 0;
    if (awardedPoints > 0) {
      addPoints(userId, 15, "答题正确");
    }

    return {
      isCorrect,
      correctAnswer: problem.solution,
      correctUci: problem.solutionUci ?? null,
      alreadySolved: isCorrect ? alreadySolved : false,
      awardedPoints,
      points: user.points,
      level: user.level
    };
  });

  app.post("/problems/explain", { preHandler: [authGuard] }, async (request, reply) => {
    const body = explainBody.parse(request.body);
    const problem = db.problems.find((item) => item.id === body.problemId);
    if (!problem) {
      return reply.code(404).send({ message: "题目不存在" });
    }
    const user = getUserById(requireUserId(request));

    const language = body.language ?? requestLanguage(request);
    const localizedProblem = localizeProblem(problem, language);
    const stockfish = await analyzePuzzleMove(problem.fen);
    const explain = await generateExplanation({
      question: localizedProblem.question,
      answer: problem.solution,
      answerUci: problem.solutionUci,
      fen: problem.fen,
      isCorrect: judgeAnswer(problem, body.answer),
      learnerAnswer: body.answer,
      knowledgePoint: localizedProblem.knowledgePoint,
      audience: user?.role === "student" ? "child" : "general",
      language,
      stockfish
    });

    return {
      explanation: explain.text,
      source: explain.source,
      engineFeedback: explain.engineFeedback
    };
  });

  app.post("/problems/ask", { preHandler: [authGuard] }, async (request, reply) => {
    const body = askBody.parse(request.body);
    const problem = db.problems.find((item) => item.id === body.problemId);
    if (!problem) return reply.code(404).send({ message: "题目不存在" });
    const user = getUserById(requireUserId(request));
    const stockfish = await analyzePuzzleMove(problem.fen);
    const result = await generatePuzzleFollowup({ question: problem.question, answer: problem.solution, answerUci: problem.solutionUci, learnerAnswer: body.answer, fen: problem.fen, isCorrect: judgeAnswer(problem, body.answer), knowledgePoint: problem.knowledgePoint, learnerQuestion: body.question, conversationHistory: body.history, audience: user?.role === "student" ? "child" : "general", language: body.language ?? requestLanguage(request), stockfish });
    return { answer: result.text, source: result.source };
  });
};
