import { Chess } from "chess.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── helpers ────────────────────────────────────────────────────

interface Issue {
  id: string;
  severity: "error" | "warn" | "info";
  message: string;
  detail?: string;
}

function pieceCounts(fen: string) {
  const board = fen.split(" ")[0];
  const counts: Record<string, number> = {};
  for (const ch of board) {
    if (/[a-zA-Z]/.test(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
  }
  return counts;
}

function kingSquare(boardPart: string, king: "K" | "k"): [number, number] | null {
  const ranks = boardPart.split("/");
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const ch of ranks[rank]) {
      if (/\d/.test(ch)) {
        file += Number(ch);
      } else {
        if (ch === king) return [file, rank];
        file++;
      }
    }
  }
  return null;
}

function squaresAdjacent(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
}

function pawnRank(fen: string): Issue[] {
  const issues: Issue[] = [];
  const board = fen.split(" ")[0];
  const ranks = board.split("/");

  // pawns on rank 1 or 8 (index 0 or 7)
  const backRankWhite = ranks[7]; // rank 1 in FEN (white's back rank)
  const backRankBlack = ranks[0]; // rank 8 in FEN (black's back rank)

  for (const ch of backRankWhite) {
    if (ch === "P") {
      issues.push({
        id: "pawn-on-backrank",
        severity: "error",
        message: "白兵出现在第1排（底线），这是不合法位置。",
        detail: `FEN 底线段: ${backRankWhite}`,
      });
    }
  }
  for (const ch of backRankBlack) {
    if (ch === "p") {
      issues.push({
        id: "pawn-on-backrank",
        severity: "error",
        message: "黑兵出现在第8排（底线），这是不合法位置。",
        detail: `FEN 底线段: ${backRankBlack}`,
      });
    }
  }
  return issues;
}

function kingCounts(fen: string): Issue[] {
  const issues: Issue[] = [];
  const counts = pieceCounts(fen);
  if ((counts["K"] ?? 0) !== 1) {
    issues.push({
      id: "king-count",
      severity: "error",
      message: `白王应有1个，实际${counts["K"] ?? 0}个。`,
    });
  }
  if ((counts["k"] ?? 0) !== 1) {
    issues.push({
      id: "king-count",
      severity: "error",
      message: `黑王应有1个，实际${counts["k"] ?? 0}个。`,
    });
  }
  return issues;
}

function pieceLimits(fen: string): Issue[] {
  const issues: Issue[] = [];
  const counts = pieceCounts(fen);

  // Starting max per piece type: 1 king, 1 queen, 2 rooks, 2 bishops, 2 knights, 8 pawns
  // With promotions you can exceed these (e.g. 9 queens), but more than 10 of anything is suspicious
  const limits: Record<string, [number, string]> = {
    Q: [9, "白后"],
    R: [10, "白车"],
    B: [10, "白象"],
    N: [10, "白马"],
    P: [8, "白兵"],
    q: [9, "黑后"],
    r: [10, "黑车"],
    b: [10, "黑象"],
    n: [10, "黑马"],
    p: [8, "黑兵"],
  };

  for (const [piece, [limit, label]] of Object.entries(limits)) {
    const c = counts[piece] ?? 0;
    if (c > limit) {
      issues.push({
        id: "piece-limit",
        severity: "warn",
        message: `${label}数量为${c}，超过合理上限${limit}。`,
      });
    }
  }

  const totalWhite = Object.entries(counts)
    .filter(([k]) => k === k.toUpperCase())
    .reduce((s, [, v]) => s + v, 0);
  const totalBlack = Object.entries(counts)
    .filter(([k]) => k === k.toLowerCase())
    .reduce((s, [, v]) => s + v, 0);
  if (totalWhite > 16) {
    issues.push({
      id: "piece-limit",
      severity: "error",
      message: `白方总棋子${totalWhite}个，超过16个上限。`,
    });
  }
  if (totalBlack > 16) {
    issues.push({
      id: "piece-limit",
      severity: "error",
      message: `黑方总棋子${totalBlack}个，超过16个上限。`,
    });
  }
  return issues;
}

function kingsAdjacent(fen: string): Issue[] {
  const issues: Issue[] = [];
  const board = fen.split(" ")[0];
  const wk = kingSquare(board, "K");
  const bk = kingSquare(board, "k");
  if (wk && bk && squaresAdjacent(wk, bk)) {
    issues.push({
      id: "kings-adjacent",
      severity: "error",
      message: "白王与黑王相邻，这是不合法局面。",
      detail: `白王: ${String.fromCharCode(97 + wk[0])}${8 - wk[1]}, 黑王: ${String.fromCharCode(97 + bk[0])}${8 - bk[1]}`,
    });
  }
  return issues;
}

function opponentInCheck(fen: string): Issue[] {
  // The side NOT to move must not be in check.
  // (They just moved and can't leave their own king in check.)
  const issues: Issue[] = [];
  const active = fen.split(" ")[1]; // 'w' or 'b'
  const opponent = active === "w" ? "b" : "w";

  try {
    // Check if opponent king is in check in the current position
    const chess = new Chess(fen);
    const opponentKing = opponent === "w" ? "K" : "k";

    // We can check by seeing if any piece of the active side attacks the opponent's king
    const moves = chess.moves({ verbose: true });
    const checksOpponent = moves.some((m) => m.san.includes("+") || m.san.includes("#"));

    // A more direct check: can the active side capture the opponent's king?
    // In chess.js, isCheck for opponent means opponent is in check
    // But chess.js reports isCheck() for the current side to move
    // If it's white's turn, chess.isCheck() means white's king is in check

    // Actually, let me use a different approach.
    // Temporarily flip the turn and see if the current side (which would be the opponent)
    // has their king in check
    const fenParts = fen.split(" ");
    fenParts[1] = opponent;
    const flippedFen = fenParts.join(" ");
    const flipped = new Chess(flippedFen);
    if (flipped.isCheck()) {
      // The opponent's king is in check, which means they ended their turn in check
      issues.push({
        id: "opponent-in-check",
        severity: "error",
        message: `对方（${opponent === "w" ? "白方" : "黑方"}）的王正在被将军——上一步走完后不应被将军。`,
      });
    }
  } catch {
    // Already caught by FEN validity check
  }
  return issues;
}

function validateFenSyntax(fen: string): Issue[] {
  const issues: Issue[] = [];
  try {
    new Chess(fen);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    issues.push({
      id: "fen-syntax",
      severity: "error",
      message: `FEN 字符串格式不合法: ${msg}`,
    });
  }
  return issues;
}

function validateSolution(fen: string, solutionUci: string, acceptedAnswers: string[]): Issue[] {
  const issues: Issue[] = [];
  try {
    const chess = new Chess(fen);

    // Check the primary solution UCI
    const from = solutionUci.slice(0, 2);
    const to = solutionUci.slice(2, 4);
    const promotion = solutionUci[4] as "q" | "r" | "b" | "n" | undefined;

    const move = chess.move({ from, to, promotion });
    if (!move) {
      issues.push({
        id: "solution-invalid",
        severity: "error",
        message: `解答 ${solutionUci} 在当前局面不合法。`,
      });
      return issues;
    }

    // Check each accepted answer
    const chess2 = new Chess(fen);
    for (const ans of acceptedAnswers) {
      try {
        const m = chess2.move(ans, { strict: false });
        if (!m) {
          issues.push({
            id: "accepted-answer-invalid",
            severity: "warn",
            message: `备选答案 "${ans}" 在当前局面不合法。`,
          });
        }
        // Reset for next check
        chess2.undo();
        if (m) chess2.undo();
      } catch {
        issues.push({
          id: "accepted-answer-invalid",
          severity: "warn",
          message: `备选答案 "${ans}" 解析失败。`,
        });
      }
    }
  } catch {
    // FEN error already reported
  }
  return issues;
}

function puzzleTypeSpecificChecks(fen: string, type: string, solutionUci: string): Issue[] {
  const issues: Issue[] = [];
  try {
    const from = solutionUci.slice(0, 2);
    const to = solutionUci.slice(2, 4);
    const promotion = solutionUci[4] as "q" | "r" | "b" | "n" | undefined;

    // Make the solution move and capture the move result
    const chessCopy = new Chess(fen);
    const solutionMove = chessCopy.move({ from, to, promotion });
    if (!solutionMove) return issues; // solution validity is checked elsewhere

    if (type === "mate_in_1") {
      if (!chessCopy.isCheckmate()) {
        issues.push({
          id: "not-mate",
          severity: "error",
          message: `题目类型为 mate_in_1，但解答 ${solutionUci} 并未将死对方。`,
          detail: `走完后局面: ${chessCopy.fen()}`,
        });
      }
    }

    if (type === "promotion") {
      if (!promotion) {
        issues.push({
          id: "no-promotion",
          severity: "warn",
          message: `题目类型为 promotion，但解答 ${solutionUci} 没有升变。`,
        });
      }
    }

    if (type === "fork") {
      // A fork should deliver check AND attack another valuable enemy piece
      if (!chessCopy.isCheck()) {
        issues.push({
          id: "weak-fork",
          severity: "warn",
          message: `题目类型为 fork，但解答 ${solutionUci} 没有将军。`,
        });
      } else {
        // After the move, flip turn back to check the moved piece's attacks
        const fenParts = chessCopy.fen().split(" ");
        fenParts[1] = fenParts[1] === "w" ? "b" : "w";
        const flipped = new Chess(fenParts.join(" "));
        const attacks = flipped.moves({ verbose: true });
        const forkCaptures = attacks.filter(
          (m) => m.from === solutionMove.to && m.captured,
        );
        if (forkCaptures.length === 0) {
          issues.push({
            id: "weak-fork",
            severity: "warn",
            message: `题目类型为 fork，解答 ${solutionUci} 将军但移动的子没有同时攻击其他敌方棋子。`,
          });
        }
      }
    }

    if (type === "hanging_piece") {
      if (!solutionMove.captured) {
        issues.push({
          id: "no-capture",
          severity: "warn",
          message: `题目类型为 hanging_piece，但解答 ${solutionUci} 没有吃子。`,
        });
      }
    }
  } catch {
    // FEN/solution errors already reported
  }
  return issues;
}

// ── main validators ─────────────────────────────────────────────

interface ValidationResult {
  fen: string;
  valid: boolean;
  issues: Issue[];
}

function validatePosition(fen: string): ValidationResult {
  const issues: Issue[] = [
    ...validateFenSyntax(fen),
    ...pawnRank(fen),
    ...kingCounts(fen),
    ...pieceLimits(fen),
    ...kingsAdjacent(fen),
    ...opponentInCheck(fen),
  ];

  return {
    fen,
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}

function validatePuzzle(puzzle: {
  id: string;
  fen: string;
  type?: string;
  solutionUci?: string;
  acceptedAnswers?: string[];
}): { puzzleId: string; fen: string; issues: Issue[] } {
  const posIssues = validatePosition(puzzle.fen).issues;

  const solIssues: Issue[] = [];
  if (puzzle.solutionUci) {
    solIssues.push(
      ...validateSolution(puzzle.fen, puzzle.solutionUci, puzzle.acceptedAnswers ?? []),
    );
    if (puzzle.type) {
      solIssues.push(...puzzleTypeSpecificChecks(puzzle.fen, puzzle.type, puzzle.solutionUci));
    }
  }

  return {
    puzzleId: puzzle.id,
    fen: puzzle.fen,
    issues: [...posIssues, ...solIssues],
  };
}

// ── output formatters ───────────────────────────────────────────

const COLOR_RESET = "\x1b[0m";
const COLOR_RED = "\x1b[31m";
const COLOR_YELLOW = "\x1b[33m";
const COLOR_CYAN = "\x1b[36m";
const COLOR_GREEN = "\x1b[32m";
const COLOR_BOLD = "\x1b[1m";

function formatSingleResult(result: ValidationResult): string {
  const lines: string[] = [];
  const sev = result.issues.length
    ? result.issues.some((i) => i.severity === "error")
      ? "❌ 不合法"
      : "⚠️ 有警告"
    : "✅ 合法";

  lines.push(`${COLOR_BOLD}FEN: ${result.fen}${COLOR_RESET}`);
  lines.push(`结果: ${sev}`);
  if (result.issues.length === 0) {
    lines.push(`${COLOR_GREEN}未发现任何问题。${COLOR_RESET}`);
  }
  for (const issue of result.issues) {
    const c = issue.severity === "error" ? COLOR_RED : issue.severity === "warn" ? COLOR_YELLOW : COLOR_CYAN;
    const tag = issue.severity === "error" ? "ERR" : issue.severity === "warn" ? "WRN" : "INF";
    lines.push(`  ${c}[${tag}]${COLOR_RESET} ${issue.message}`);
    if (issue.detail) lines.push(`       ${issue.detail}`);
  }
  return lines.join("\n");
}

function formatPuzzleResults(results: ReturnType<typeof validatePuzzle>[]): string {
  const lines: string[] = [];
  const withIssues = results.filter((r) => r.issues.length > 0);
  const withErrors = withIssues.filter((r) => r.issues.some((i) => i.severity === "error"));
  const withWarnings = withIssues.filter(
    (r) => !r.issues.some((i) => i.severity === "error") && r.issues.some((i) => i.severity === "warn"),
  );

  lines.push(`${COLOR_BOLD}═══════════════════════════════════════${COLOR_RESET}`);
  lines.push(`${COLOR_BOLD}  棋盘局面校验报告${COLOR_RESET}`);
  lines.push(`${COLOR_BOLD}═══════════════════════════════════════${COLOR_RESET}`);
  lines.push(`总题目数: ${results.length}`);
  lines.push(`有错误: ${COLOR_RED}${withErrors.length}${COLOR_RESET}`);
  lines.push(`有警告: ${COLOR_YELLOW}${withWarnings.length}${COLOR_RESET}`);
  lines.push(`完全通过: ${COLOR_GREEN}${results.length - withIssues.length}${COLOR_RESET}`);
  lines.push("");

  for (const result of results) {
    if (result.issues.length === 0) continue;
    lines.push(`${COLOR_BOLD}── ${result.puzzleId} ──${COLOR_RESET}`);
    lines.push(`  FEN: ${result.fen}`);
    for (const issue of result.issues) {
      const c = issue.severity === "error" ? COLOR_RED : issue.severity === "warn" ? COLOR_YELLOW : COLOR_CYAN;
      const tag = issue.severity === "error" ? "ERR" : issue.severity === "warn" ? "WRN" : "INF";
      lines.push(`  ${c}[${tag}]${COLOR_RESET} ${issue.message}`);
      if (issue.detail) lines.push(`       ${issue.detail}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── load puzzles ────────────────────────────────────────────────

async function loadProjectPuzzles(): Promise<
  { id: string; fen: string; type?: string; solutionUci?: string; acceptedAnswers?: string[] }[]
> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const puzzlesPath = resolve(scriptDir, "..", "src", "data", "puzzles.ts");
  try {
    // Dynamic import the TS file (tsx supports this)
    const mod = await import(puzzlesPath);
    return (mod.seededProblems as any[]).map((p: any) => ({
      id: p.id,
      fen: p.fen,
      type: p.type,
      solutionUci: p.solutionUci,
      acceptedAnswers: p.acceptedAnswers ?? [],
    }));
  } catch (e) {
    console.error("无法加载题目文件:", e);
    return [];
  }
}

// ── CLI entry ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${COLOR_BOLD}棋盘局面校验工具 (FEN Validator)${COLOR_RESET}

用法:
  npx tsx scripts/validate-fen.ts                   校验所有内置题目
  npx tsx scripts/validate-fen.ts "<FEN>"            校验单个FEN字符串
  npx tsx scripts/validate-fen.ts --json             以JSON格式输出所有题目校验结果
  npx tsx scripts/validate-fen.ts --help             显示此帮助

校验项目:
  1. FEN语法合法性（通过 chess.js）
  2. 双方各恰好1个王
  3. 兵不能在第1排或第8排
  4. 两王不能相邻
  5. 非行棋方不能被将军（刚走完棋不能将自己的王留在被将军状态）
  6. 棋子数量合理性（单方不超过16子，单兵种不超过合理上限）
  7. 解答合法性（solution 是否能在当前局面走出）
  8. 题目类型匹配（mate_in_1 必须将死、promotion 必须升变等）
`);
    return;
  }

  if (args.length === 0 || args.includes("--json")) {
    const puzzles = await loadProjectPuzzles();
    if (puzzles.length === 0) {
      console.log(`${COLOR_RED}未找到任何题目。${COLOR_RESET}`);
      process.exit(1);
    }

    const results = puzzles.map((p) => validatePuzzle(p));

    if (args.includes("--json")) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(formatPuzzleResults(results));
    }

    const hasErrors = results.some((r) => r.issues.some((i) => i.severity === "error"));
    process.exit(hasErrors ? 1 : 0);
  }

  // Single FEN mode
  const fen = args[0];
  const result = validatePosition(fen);
  console.log(formatSingleResult(result));
  process.exit(result.valid ? 0 : 1);
}

main();
