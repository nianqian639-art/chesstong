import Fastify from "fastify";
import { Chess } from "chess.js";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

if (existsSync(".env")) {
  process.loadEnvFile?.(".env");
}

const app = Fastify({ logger: true });
const STOCKFISH_TIMEOUT_MS = Number(process.env.STOCKFISH_TIMEOUT_MS ?? 3000);
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

const bestMoveBody = z.object({
  fen: z.string(),
  difficulty: z.number().min(1).max(20).default(8)
});

interface DifficultyProfile {
  depth: number;
  skillLevel: number;
  forceWeakMode: boolean;
}

const clampDifficulty = (difficulty: number): number => Math.max(1, Math.min(20, Math.round(difficulty)));

const getDifficultyProfile = (difficulty: number): DifficultyProfile => {
  const value = clampDifficulty(difficulty);
  if (value <= 3) return { depth: 1, skillLevel: 0, forceWeakMode: true };
  if (value <= 6) return { depth: 2, skillLevel: 1, forceWeakMode: true };
  if (value <= 9) return { depth: 3, skillLevel: 3, forceWeakMode: false };
  if (value <= 12) return { depth: 5, skillLevel: 6, forceWeakMode: false };
  if (value <= 16) return { depth: 7, skillLevel: 10, forceWeakMode: false };
  return { depth: 10, skillLevel: 16, forceWeakMode: false };
};

const scoreMove = (move: ReturnType<Chess["moves"]>[number] & { captured?: string; promotion?: string; san: string }): number => {
  const captureScore = move.captured ? 12 : 0;
  const checkScore = move.san.includes("#") ? 30 : move.san.includes("+") ? 8 : 0;
  const promotionScore = move.promotion ? 20 : 0;
  const centerBonus = ["d4", "e4", "d5", "e5"].includes(move.to) ? 2 : 0;
  return captureScore + checkScore + promotionScore + centerBonus;
};

const stockfishCandidates = (): string[] => {
  const configured = process.env.STOCKFISH_BIN?.trim();
  const roots = [
    resolve(process.cwd(), STOCKFISH_DIR),
    resolve(process.cwd(), "..", STOCKFISH_DIR),
    resolve(MODULE_DIR, "..", "..", STOCKFISH_DIR),
    resolve(MODULE_DIR, "..", "..", "..", STOCKFISH_DIR)
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

const fallbackMove = (fen: string, difficulty = 8): string | null => {
  try {
    const chess = new Chess(fen);
    const legal = chess.moves({ verbose: true });
    if (legal.length === 0) return null;
    const profile = getDifficultyProfile(difficulty);
    const sorted = [...legal].sort((a, b) => scoreMove(b) - scoreMove(a));
    if (profile.forceWeakMode) {
      const weakPool = sorted
        .slice()
        .reverse()
        .filter((move) => !move.san.includes("#"))
        .filter((move) => !move.captured && !move.san.includes("+"));
      const pool = weakPool.length > 0 ? weakPool : sorted.slice().reverse();
      const window = pool.slice(0, Math.min(pool.length, Math.max(4, Math.ceil(pool.length / 2))));
      return window[Math.floor(Math.random() * window.length)]?.san ?? pool[0]?.san ?? null;
    }
    return legal[0]?.san ?? null;
  } catch {
    return null;
  }
};

const queryStockfish = (fen: string, difficulty: number): Promise<string | null> => {
  return new Promise((resolve) => {
    const profile = getDifficultyProfile(difficulty);
    if (profile.forceWeakMode) {
      resolve(null);
      return;
    }

    const stockfishBin = resolveStockfishBin();
    if (!stockfishBin) {
      app.log.warn({ candidates: stockfishCandidates() }, "Stockfish binary is not executable; using fallback move");
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

    const depth = profile.depth;

    const done = (move: string | null) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeout);
      proc.kill("SIGKILL");
      resolve(move);
    };

    timeout = setTimeout(() => {
      done(null);
    }, STOCKFISH_TIMEOUT_MS);

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

    proc.on("error", () => {
      done(null);
    });

    proc.stdin.write("uci\n");
  });
};

app.get("/health", async () => ({ status: "ok" }));

app.post("/best-move", async (request) => {
  const body = bestMoveBody.parse(request.body);
  const uciMove = await queryStockfish(body.fen, body.difficulty);

  let chess: Chess;
  try {
    chess = new Chess(body.fen);
  } catch {
    return { move: null, source: "fallback", message: "invalid fen" };
  }
  if (uciMove) {
    const move = chess.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove[4] as "q" | "r" | "b" | "n" | undefined
    });
    if (move) {
      return { move: move.san, source: "stockfish" };
    }
  }

  return { move: fallbackMove(body.fen, body.difficulty), source: "fallback" };
});

const port = Number(process.env.PORT ?? 8081);
const host = process.env.HOST ?? "0.0.0.0";
const stockfishBin = resolveStockfishBin();

if (stockfishBin) {
  app.log.info({ stockfishBin }, "Stockfish binary ready");
} else {
  app.log.warn({ candidates: stockfishCandidates() }, "Stockfish binary not executable; fallback engine will be used");
}

const start = async () => {
  try {
    await app.listen({ port, host });
    app.log.info(`Engine service listening on ${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  // ── Graceful shutdown ──────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      app.log.info("Engine service closed successfully.");
      process.exit(0);
    } catch (err) {
      app.log.error(err, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGUSR2", () => shutdown("SIGUSR2"));
};

start();
