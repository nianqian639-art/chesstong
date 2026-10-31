import { Chess } from "chess.js";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chessCopy, type ChessLanguage } from "./chess-copy.js";

const STOCKFISH_SERVICE_URL = process.env.STOCKFISH_SERVICE_URL ?? "http://localhost:8081";
const ENGINE_TIMEOUT_MS = Number(process.env.ENGINE_TIMEOUT_MS ?? 3000);
const STOCKFISH_TIMEOUT_MS = Number(process.env.STOCKFISH_TIMEOUT_MS ?? 3500);
const STOCKFISH_DIR = "tools/stockfish/stockfish";
const STOCKFISH_BIN_NAMES = [
  "src/stockfish",
  "stockfish",
  "stockfish-macos-m1-apple-silicon",
  "stockfish-macos-x86-64",
  "stockfish-ubuntu-x86-64",
  "stockfish-windows-x86-64-avx2.exe"
];
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

type EngineSource = "stockfish" | "fallback";

interface EngineMoveResult {
  move: string | null;
  source: EngineSource;
}

export interface StartMatchInput {
  mode: "standard" | "teaching";
  difficulty: number;
  variant?: string;
}

export interface MoveInput {
  fen: string;
  move: string;
  difficulty: number;
  previousEngineMove?: string | null;
}

export interface SuggestInput {
  fen: string;
  difficulty: number;
  audience?: "child" | "general";
  language?: ChessLanguage;
}

interface DifficultyProfile {
  depth: number;
  skillLevel: number;
  candidateSpan: number;
  blunderChance: number;
  preferQuietMoves: boolean;
  forceWeakMode: boolean;
}

interface WeakMoveContext {
  previousEngineMove: string | null;
}

// ── Chess Variants ──────────────────────────────────────────────

export interface VariantDef {
  key: string;
  title: string;
  desc: string;
  fen: string;
}

export const VARIANTS: Record<string, VariantDef> = {
  standard: { key:"standard", title:"标准对战", desc:"完整棋盘，所有棋子正常对弈", fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
  pawns:    { key:"pawns",    title:"♟ 兵战",   desc:"双方只有王+8个兵。吃掉对方全部子或兵冲到底线升变即获胜", fen:"4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1" },
  knights:  { key:"knights",  title:"♞ 马战",   desc:"兵战基础上双方各加2匹马。练习马的跳跃与捉双", fen:"2n1k1n1/pppppppp/8/8/8/8/PPPPPPPP/2N1K1N1 w - - 0 1" },
  bishops:  { key:"bishops",  title:"♝ 象战",   desc:"兵战基础上双方各加2头象。练习斜线攻击与牵制", fen:"2b1k1b1/pppppppp/8/8/8/8/PPPPPPPP/2B1K1B1 w - - 0 1" },
  rooks:    { key:"rooks",    title:"♜ 车战",   desc:"兵战基础上双方各加2座车。练习直线控制与底线杀", fen:"2r1k1r1/pppppppp/8/8/8/8/PPPPPPPP/2R1K1R1 w - - 0 1" },
  queen:    { key:"queen",    title:"♛ 后战",   desc:"兵战基础上双方各加1个后。练习后的全能走法与配合", fen:"3qk3/pppppppp/8/8/8/8/PPPPPPPP/3QK3 w - - 0 1" },
  full:     { key:"full",     title:"⚔ 全能战", desc:"标准完整棋盘对局，检验综合棋力", fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
};

// Check custom win conditions for variants
export const checkVariantWin = (fen: string, variantKey: string): { over: boolean; result: "win" | "lose" | "draw" | null } => {
  if (variantKey === "standard" || variantKey === "full") return { over: false, result: null };
  try {
    const chess = new Chess(fen);
    // Check: all opponent pieces (except king) captured?
    const b = fen.split(" ")[0];
    const whitePieces = (b.match(/[PNBRQ]/g) || []).length;
    const blackPieces = (b.match(/[pnbrq]/g) || []).length;
    if (blackPieces === 0 && whitePieces > 0) return { over: true, result: "win" };    // white wins
    if (whitePieces === 0 && blackPieces > 0) return { over: true, result: "lose" };    // black wins (from white's perspective)
    // Check: pawn or promoted piece reached last rank
    const rows = b.split("/");
    // White piece (pawn or promoted) on 8th rank = white wins
    if (/[PNBRQ]/.test(rows[0])) return { over: true, result: "win" };
    // Black piece (pawn or promoted) on 1st rank = black wins
    if (/[pnbrq]/.test(rows[7])) return { over: true, result: "lose" };
    // Also check chess.js game over
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) return { over: true, result: chess.turn() === "w" ? "lose" : "win" };
      return { over: true, result: "draw" };
    }
    return { over: false, result: null };
  } catch { return { over: false, result: null }; }
};

export const startMatch = (input: StartMatchInput): { matchState: string; mode: string; difficulty: number } => {
  const variant = VARIANTS[input.variant || "standard"] || VARIANTS.standard;
  const chess = new Chess(variant.fen);
  return {
    matchState: chess.fen(),
    mode: input.mode,
    difficulty: input.difficulty
  };
};

const clampDifficulty = (difficulty: number): number => Math.max(1, Math.min(20, Math.round(difficulty)));

const getDifficultyProfile = (difficulty: number): DifficultyProfile => {
  const value = clampDifficulty(difficulty);
  if (value <= 3) {
    return { depth: 1, skillLevel: 0, candidateSpan: 18, blunderChance: 0.92, preferQuietMoves: true, forceWeakMode: true };
  }
  if (value <= 6) {
    return { depth: 2, skillLevel: 1, candidateSpan: 14, blunderChance: 0.75, preferQuietMoves: true, forceWeakMode: true };
  }
  if (value <= 9) {
    return { depth: 3, skillLevel: 3, candidateSpan: 9, blunderChance: 0.45, preferQuietMoves: false, forceWeakMode: false };
  }
  if (value <= 12) {
    return { depth: 5, skillLevel: 6, candidateSpan: 5, blunderChance: 0.18, preferQuietMoves: false, forceWeakMode: false };
  }
  if (value <= 16) {
    return { depth: 7, skillLevel: 10, candidateSpan: 3, blunderChance: 0.08, preferQuietMoves: false, forceWeakMode: false };
  }
  return { depth: 10, skillLevel: 16, candidateSpan: 2, blunderChance: 0.03, preferQuietMoves: false, forceWeakMode: false };
};

const scoreMove = (move: ReturnType<Chess["moves"]>[number] & { captured?: string; promotion?: string; san: string }): number => {
  const captureScore = move.captured ? 12 : 0;
  const checkScore = move.san.includes("#") ? 30 : move.san.includes("+") ? 8 : 0;
  const promotionScore = move.promotion ? 20 : 0;
  const centerBonus = ["d4", "e4", "d5", "e5"].includes(move.to) ? 2 : 0;
  return captureScore + checkScore + promotionScore + centerBonus;
};

const weakMoveScore = (
  move: ReturnType<Chess["moves"]>[number] & { captured?: string; promotion?: string; san: string; piece: string; from: string; to: string },
  context: WeakMoveContext
): number => {
  let score = 0;
  const fromFile = move.from[0];
  const toFile = move.to[0];
  const isEdgeFile = toFile === "a" || toFile === "h";
  const isEdgePawn = move.piece === "p" && (fromFile === "a" || fromFile === "h");
  const repeatsLane = context.previousEngineMove ? context.previousEngineMove[0] === fromFile : false;

  if (move.piece === "p") score += 8;
  if (isEdgeFile) score += 12;
  if (isEdgePawn) score += 16;
  if (repeatsLane) score += 12;
  if (["a6", "h6", "a3", "h3", "a5", "h5", "a4", "h4"].includes(move.to)) score += 7;
  if (move.san.startsWith("K") || move.san.startsWith("N")) score += 2;

  if (move.captured) score -= 34;
  if (move.san.includes("+")) score -= 32;
  if (move.san.includes("#")) score -= 60;
  if (["d4", "e4", "d5", "e5"].includes(move.to)) score -= 10;
  if (move.promotion) score -= 18;

  return score;
};

const chooseWeakMove = (
  moves: Array<ReturnType<Chess["moves"]>[number] & { captured?: string; promotion?: string; san: string; piece: string; from: string; to: string }>,
  context: WeakMoveContext
): string | null => {
  if (moves.length === 0) return null;
  const sorted = [...moves].sort((a, b) => weakMoveScore(b, context) - weakMoveScore(a, context));
  const quietPool = sorted.filter((move) => !move.captured && !move.san.includes("+") && !move.san.includes("#"));
  const pool = quietPool.length > 0 ? quietPool.slice(0, Math.min(8, quietPool.length)) : sorted.slice(0, Math.min(8, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)]?.san ?? sorted[0]?.san ?? null;
};

const localEngineMove = (fen: string, difficulty: number, context: WeakMoveContext = { previousEngineMove: null }): string | null => {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return null;
  }
  const profile = getDifficultyProfile(difficulty);
  const sorted = [...moves].sort((a, b) => scoreMove(b) - scoreMove(a));
  const candidateSpan = Math.min(sorted.length, profile.candidateSpan);
  const candidates = sorted.slice(0, candidateSpan);

  if (profile.forceWeakMode) {
    return chooseWeakMove(sorted, context) ?? sorted.at(-1)?.san ?? sorted[0].san;
  }

  if (Math.random() < profile.blunderChance) {
    const softChoices = profile.preferQuietMoves
      ? sorted.filter((move) => !move.captured && !move.san.includes("+") && !move.san.includes("#"))
      : sorted.slice(Math.max(0, candidateSpan - 1));
    const pool = softChoices.length > 0 ? softChoices : sorted.slice(Math.floor(sorted.length / 2));
    return pool[Math.floor(Math.random() * pool.length)]?.san ?? sorted.at(-1)?.san ?? sorted[0].san;
  }

  const topWindow = candidates.slice(0, Math.max(1, Math.ceil(candidateSpan / 2)));
  return topWindow[Math.floor(Math.random() * topWindow.length)]?.san ?? sorted[0].san;
};

const stockfishCandidates = (): string[] => {
  const configured = process.env.STOCKFISH_BIN?.trim();
  const roots = [
    resolve(process.cwd(), STOCKFISH_DIR),
    resolve(process.cwd(), "..", STOCKFISH_DIR),
    resolve(MODULE_DIR, "..", "..", "..", STOCKFISH_DIR),
    resolve(MODULE_DIR, "..", "..", STOCKFISH_DIR)
  ];
  return [
    ...(configured ? [resolve(process.cwd(), configured)] : []),
    ...roots.flatMap((root) => STOCKFISH_BIN_NAMES.map((name) => resolve(root, name)))
  ];
};

const resolveStockfishBin = (): string | null => {
  for (const candidate of stockfishCandidates()) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }
  return null;
};

const uciToSan = (fen: string, uciMove: string): string | null => {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove[4] as "q" | "r" | "b" | "n" | undefined
    });
    return move?.san ?? null;
  } catch {
    return null;
  }
};

const requestLocalStockfishMove = (fen: string, difficulty: number): Promise<string | null> => {
  return new Promise((resolve) => {
    const stockfishBin = resolveStockfishBin();
    if (!stockfishBin) {
      resolve(null);
      return;
    }

    let proc: ChildProcessWithoutNullStreams;
    try {
      proc = spawn(stockfishBin, [], { cwd: dirname(stockfishBin), stdio: "pipe" });
    } catch {
      resolve(null);
      return;
    }

    let output = "";
    let resolved = false;
    let readyRequested = false;
    let searchStarted = false;
    let timeout: NodeJS.Timeout;
    const profile = getDifficultyProfile(difficulty);
    const depth = profile.depth;

    const done = (move: string | null) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeout);
      proc.kill();
      resolve(move);
    };

    timeout = setTimeout(() => done(null), STOCKFISH_TIMEOUT_MS);

    proc.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/bestmove\s+(\S+)/);
      if (match?.[1]) {
        done(match[1] === "(none)" ? null : match[1]);
        return;
      }
      if (output.includes("uciok") && !readyRequested) {
        readyRequested = true;
        proc.stdin.write(`setoption name Skill Level value ${profile.skillLevel}\n`);
        proc.stdin.write("isready\n");
        return;
      }
      if (output.includes("readyok") && !searchStarted) {
        searchStarted = true;
        proc.stdin.write(`position fen ${fen}\n`);
        proc.stdin.write(`go depth ${depth}\n`);
      }
    });

    proc.on("error", () => done(null));
    proc.stdin.write("uci\n");
  });
};

const requestEngineMove = async (fen: string, difficulty: number, context: WeakMoveContext = { previousEngineMove: null }): Promise<EngineMoveResult> => {
  const profile = getDifficultyProfile(difficulty);
  if (profile.forceWeakMode) {
    return {
      move: localEngineMove(fen, difficulty, context),
      source: "fallback"
    };
  }

  try {
    const response = await fetch(`${STOCKFISH_SERVICE_URL}/best-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, difficulty }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS)
    });

    if (response.ok) {
      const data = (await response.json()) as { move?: string | null; source?: string };
      if (data.move) {
        return {
          move: data.move,
          source: data.source === "stockfish" ? "stockfish" : "fallback"
        };
      }
    }
  } catch {
    // Keep the app usable even if the Stockfish service is down.
  }

  const localStockfishMove = await requestLocalStockfishMove(fen, difficulty);
  if (localStockfishMove) {
    const san = uciToSan(fen, localStockfishMove);
    if (san) {
      return {
        move: san,
        source: "stockfish"
      };
    }
  }

  return {
    move: localEngineMove(fen, difficulty, context),
    source: "fallback"
  };
};

export const playMove = async (input: MoveInput): Promise<{
  playerMoveAccepted: boolean;
  playerMove: string | null;
  engineMove: string | null;
  engineSource: EngineSource;
  fenAfter: string;
  gameOver: boolean;
  pgn: string;
  gameResult: "win" | "lose" | "draw" | null;
}> => {
  let chess: Chess;
  try {
    chess = new Chess(input.fen);
  } catch {
    return { playerMoveAccepted: false, playerMove: null, engineMove: null, engineSource: "fallback", fenAfter: input.fen, gameOver: false, pgn: "", gameResult: null };
  }
  let player;
  try { player = chess.move(input.move, { strict: false }); } catch { player = null; }
  if (!player) {
    return { playerMoveAccepted: false, playerMove: null, engineMove: null, engineSource: "fallback", fenAfter: input.fen, gameOver: false, pgn: "", gameResult: null };
  }

  let engineResult: EngineMoveResult = { move: null, source: "fallback" };
  if (!chess.isGameOver()) {
    engineResult = await requestEngineMove(chess.fen(), input.difficulty, {
      previousEngineMove: input.previousEngineMove ?? null
    });
    if (engineResult.move) {
      chess.move(engineResult.move, { strict: false });
    }
  }

  const isOver = chess.isGameOver();
  let gameResult: "win" | "lose" | "draw" | null = null;
  if (isOver) {
    if (chess.isCheckmate()) gameResult = chess.turn() === player.color ? "lose" : "win";
    else if (chess.isDraw() || chess.isStalemate()) gameResult = "draw";
  }

  return {
    playerMoveAccepted: true,
    playerMove: player.san,
    engineMove: engineResult.move ? chess.history().at(-1) ?? null : null,
    engineSource: engineResult.source,
    fenAfter: chess.fen(),
    gameOver: isOver,
    pgn: chess.pgn(),
    gameResult,
  };
};

export const suggestMove = async (input: SuggestInput): Promise<{
  move: string | null;
  source: EngineSource;
  reason: string;
  plan: string[];
}> => {
  const copy = chessCopy(input.language);
  let chess: Chess;
  try {
    chess = new Chess(input.fen);
  } catch {
    return {
      move: null,
      source: "fallback",
      reason: copy.invalid,
      plan: []
    };
  }
  if (chess.isGameOver()) return {move: null, source: "fallback", reason: copy.ended, plan: []};
  const engineResult = await requestEngineMove(input.fen, input.difficulty);
  const move = engineResult.move;
  if (!move) {
    return {
      move: null,
      source: "fallback",
      reason: copy.ended,
      plan: []
    };
  }

  const moveObj = chess.moves({ verbose: true }).find((m) => m.san === move);
  const reason = moveObj?.san.includes("#") ? copy.mate
    : moveObj?.san.includes("+") ? copy.check
    : moveObj?.captured ? copy.capture : copy.quiet;

  return {
    move,
    source: engineResult.source,
    reason,
    plan: [...copy.plan]
  };
};

export const analyzePgn = async (
  pgn: string,
  audience: "child" | "general" = "general"
): Promise<{ summary: string; keyMoves: Array<{ ply: number; san: string; tag: string }> }> => {
  const trimmed = pgn.trim();
  if (!trimmed) {
    return {
      summary: "暂无对局数据可复盘。",
      keyMoves: []
    };
  }

  const chess = new Chess();
  try {
    chess.loadPgn(trimmed);
  } catch {
    return {
      summary: "PGN 格式解析失败，请检查走法记录。",
      keyMoves: []
    };
  }

  const history = chess.history({ verbose: true });
  const keyMoves = history
    .map((move, index) => {
      let tag = "";
      if (move.san.includes("#")) {
        tag = "将杀";
      } else if (move.san.includes("+")) {
        tag = "将军";
      } else if (move.captured) {
        tag = "吃子";
      } else if (move.promotion) {
        tag = "升变";
      }
      return { ply: index + 1, san: move.san, tag };
    })
    .filter((item) => item.tag.length > 0)
    .slice(0, 8);

  const captureCount = history.filter((h) => Boolean(h.captured)).length;
  const checkCount = history.filter((h) => h.san.includes("+") || h.san.includes("#")).length;
  const summary = [
    audience === "child" ? "这盘棋大概是这样：" : "复盘结论：",
    audience === "child"
      ? `一共下了 ${history.length} 手，吃子 ${captureCount} 次，有 ${checkCount} 次将军或将杀。`
      : `全局共 ${history.length} 手，战术交换（吃子）${captureCount} 次，形成将军/将杀威胁 ${checkCount} 次。`,
    audience === "child"
      ? "下次先看王安不安全，再找能吃子的小机会。"
      : "建议优先检查关键着法前后的王安全、子力协调和中心控制。"
  ].join("");

  return { summary, keyMoves };
};
