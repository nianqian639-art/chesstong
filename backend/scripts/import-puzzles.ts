import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Chess } from "chess.js";
import { Problem } from "../src/models/types.js";

const preferredThemes = new Set([
  "mateIn1",
  "backRankMate",
  "fork",
  "pin",
  "skewer",
  "hangingPiece",
  "promotion",
  "capturingDefender"
]);

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
};

const toUci = (move: { from: string; to: string; promotion?: string }) => `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();

const makeQuestion = (themes: string[], solution: string): string => {
  if (themes.includes("mateIn1") || solution.includes("#")) {
    return "找到一步将死。";
  }
  if (themes.includes("fork")) {
    return "找到双攻的关键一步。";
  }
  if (themes.includes("pin")) {
    return "利用牵制找到最佳走法。";
  }
  if (themes.includes("skewer")) {
    return "利用串击找到最佳走法。";
  }
  if (themes.includes("promotion")) {
    return "找到正确的升变或通兵推进。";
  }
  return "找到当前局面的最佳战术走法。";
};

const themeLabel = (themes: string[]): string => {
  if (themes.includes("mateIn1")) return "一步将杀";
  if (themes.includes("backRankMate")) return "后排将杀";
  if (themes.includes("fork")) return "双攻";
  if (themes.includes("pin")) return "牵制";
  if (themes.includes("skewer")) return "串击";
  if (themes.includes("hangingPiece")) return "吃无保护子";
  if (themes.includes("promotion")) return "升变";
  return "基础战术";
};

const usage = () => {
  console.log("Usage: npm run import:puzzles -- <lichess_db_puzzle.csv> [limit]");
};

const csvPath = process.argv[2];
const limit = Number(process.argv[3] ?? 30);
if (!csvPath) {
  usage();
  process.exit(1);
}

const raw = readFileSync(resolve(csvPath), "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines.shift() ?? "");
const indexOf = (name: string) => headers.indexOf(name);

const selected: Problem[] = [];
for (const line of lines) {
  if (selected.length >= limit) {
    break;
  }

  const row = parseCsvLine(line);
  const puzzleId = row[indexOf("PuzzleId")];
  const fen = row[indexOf("FEN")];
  const moves = row[indexOf("Moves")]?.split(/\s+/).filter(Boolean) ?? [];
  const rating = Number(row[indexOf("Rating")] ?? 0);
  const popularity = Number(row[indexOf("Popularity")] ?? 0);
  const themes = row[indexOf("Themes")]?.split(/\s+/).filter(Boolean) ?? [];

  if (!puzzleId || !fen || moves.length < 2) continue;
  if (rating < 600 || rating > 1200 || popularity < 70) continue;
  if (!themes.some((theme) => preferredThemes.has(theme))) continue;

  try {
    const chess = new Chess(fen);
    const setupMove = moves[0];
    const setup = chess.move({
      from: setupMove.slice(0, 2),
      to: setupMove.slice(2, 4),
      promotion: setupMove[4] as "q" | "r" | "b" | "n" | undefined
    });
    if (!setup) continue;

    const displayFen = chess.fen();
    const solutionUci = moves[1];
    const solution = chess.move({
      from: solutionUci.slice(0, 2),
      to: solutionUci.slice(2, 4),
      promotion: solutionUci[4] as "q" | "r" | "b" | "n" | undefined
    });
    if (!solution) continue;

    selected.push({
      id: `lichess-${puzzleId}`,
      gradeBand: rating < 800 ? "15" : rating < 1000 ? "14" : "13",
      type: themes[0] ?? "tactic",
      difficulty: rating < 800 ? 1 : rating < 1000 ? 2 : 3,
      knowledgePoint: themeLabel(themes),
      fen: displayFen,
      question: makeQuestion(themes, solution.san),
      solution: solution.san,
      solutionUci: toUci(solution),
      acceptedAnswers: [solution.san, toUci(solution)],
      hints: ["先找将军、吃子、威胁", `主题：${themeLabel(themes)}`],
      rating,
      themes,
      source: {
        name: "Lichess Puzzle Database (CC0)",
        id: puzzleId,
        url: "https://database.lichess.org/"
      }
    });
  } catch {
    continue;
  }
}

const content = [
  'import { Problem } from "../models/types.js";',
  "",
  `export const seededProblems: Problem[] = ${JSON.stringify(selected, null, 2)};`,
  ""
].join("\n");

writeFileSync(resolve("src/data/puzzles.ts"), content);
console.log(`Imported ${selected.length} puzzles into src/data/puzzles.ts`);
