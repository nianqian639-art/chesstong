import { Chess } from "chess.js";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ───────────────────────────────────────────────────────

interface PuzzleOut {
  id: string;
  gradeBand: string;
  type: string;
  difficulty: number;
  knowledgePoint: string;
  fen: string;
  question: string;
  solution: string;
  solutionUci: string;
  acceptedAnswers: string[];
  hints: string[];
  rating: number;
  themes: string[];
}

interface Template {
  fen: string;
  type: string;
  question: string;
  hints: string[];
  themes: string[];
  knowledgePoint: string;
  difficulty: number;
  gradeBand: string;
  rating: number;
}

// ── Validation ──────────────────────────────────────────────────

function resolvePuzzle(tmpl: Template): PuzzleOut | null {
  let chess: Chess;
  try { chess = new Chess(tmpl.fen); } catch { return null; }

  // Side not to move must not be in check
  try {
    const p = tmpl.fen.split(" ");
    p[1] = p[1] === "w" ? "b" : "w";
    if (new Chess(p.join(" ")).isCheck()) return null;
  } catch { return null; }

  let san = "", uci = "";

  try {
    if (tmpl.type === "mate_in_1") {
      for (const m of chess.moves({ verbose: true })) {
        const c = new Chess(tmpl.fen);
        c.move(m.san);
        if (c.isCheckmate()) { san = m.san; uci = m.from + m.to + (m.promotion ?? ""); break; }
      }
    } else if (tmpl.type === "promotion") {
      const promo = chess.moves({ verbose: true }).find((m) => m.promotion);
      if (!promo) return null;
      san = promo.san; uci = promo.from + promo.to + promo.promotion;
    } else if (tmpl.type === "hanging_piece") {
      const vals: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
      const caps = chess.moves({ verbose: true }).filter((m) => m.captured);
      caps.sort((a, b) => (vals[b.captured!] ?? 0) - (vals[a.captured!] ?? 0));
      if (!caps[0]) return null;
      san = caps[0].san; uci = caps[0].from + caps[0].to + (caps[0].promotion ?? "");
    } else if (tmpl.type === "fork") {
      let found = false;
      for (const m of chess.moves({ verbose: true }).filter((x) => x.piece === "n")) {
        const c = new Chess(tmpl.fen);
        c.move(m.san);
        if (!c.isCheck()) continue;
        const fp = c.fen().split(" ");
        fp[1] = fp[1] === "w" ? "b" : "w";
        if (new Chess(fp.join(" ")).moves({ verbose: true }).some((a) => a.from === m.to && a.captured)) {
          san = m.san; uci = m.from + m.to + (m.promotion ?? ""); found = true; break;
        }
      }
      if (!found) return null;
    }
  } catch { return null; }

  if (!san) return null;

  const acc = [san, san.replace(/[+#]$/, "")];
  if (san.includes("=")) acc.push(san.replace(/=Q$/, "Q").replace(/#/g, ""));

  return {
    id: "", gradeBand: tmpl.gradeBand, type: tmpl.type, difficulty: tmpl.difficulty,
    knowledgePoint: tmpl.knowledgePoint, fen: tmpl.fen, question: tmpl.question,
    solution: san, solutionUci: uci, acceptedAnswers: [...new Set(acc)],
    hints: tmpl.hints, rating: tmpl.rating, themes: tmpl.themes,
  };
}

// ── Collect puzzles ─────────────────────────────────────────────

const puzzles: PuzzleOut[] = [];
let failures = 0;

function add(tmpl: Template): boolean {
  const p = resolvePuzzle(tmpl);
  if (!p) { failures++; return false; }
  puzzles.push(p);
  return true;
}

// ══════════════════════════════════════════════════════════════════
// 10 CATEGORIES x 20 PUZZLES EACH = 200
// ══════════════════════════════════════════════════════════════════

console.log("Generating 200 chess puzzles...\n");

// ── Cat 1: 一步杀·后排将杀 (Back Rank Mate) ── 20 puzzles ─────

{
  let r = 620, count = 0;
  // Black king on back rank, pawns block escape on rank 7, white rook/queen on rank 1
  // Rook/queen file must differ from king file AND pawn files (to not be blocked or check king)
  const cfgs: [string, string, string[]][] = [
    ["g", "fgh", ["a","b","c","d","e"]],
    ["f", "efg", ["a","b","c","d","h"]],
    ["e", "def", ["a","b","c","g","h"]],
    ["d", "cde", ["a","b","f","g","h"]],
  ];
  let i = 0;
  for (const [kf, pf, ff] of cfgs) {
    for (const rf of ff) {
      if (count >= 15) break;
      const fen = buildBackRankFEN(kf, pf, rf, "R");
      if (add({
        fen, type: "mate_in_1", knowledgePoint: "后排将杀", difficulty: 1, gradeBand: "15", rating: r,
        question: `白${rf}车如何利用后排弱点一步将死？`,
        hints: ["车到第八排横向攻击黑王", "黑王被自己的兵挡住逃跑路线"],
        themes: ["mateIn1", "backRankMate"],
      })) { count++; r += 20; i++; }
    }
  }
  // Fill remaining with queen variants
  for (const [kf, pf, ff] of [[["g","fgh",["a","b","d","e","c"]]] as any]) {
    // Use queen on files a,b,d,e
  }
  const qFiles: [string, string, string[]][] = [
    ["g", "fgh", ["a","b","d","e","c"]],
    ["f", "efg", ["a","b","c","h"]],
  ];
  for (const [kf, pf, ff] of qFiles) {
    for (const qf of ff) {
      if (count >= 20) break;
      const fen = buildBackRankFEN(kf, pf, qf, "Q");
      if (add({
        fen, type: "mate_in_1", knowledgePoint: "后排将杀", difficulty: 1, gradeBand: "15", rating: r,
        question: `白后如何从${qf}线一步将死？`,
        hints: ["皇后控制横线", "走到第八排将杀黑王"],
        themes: ["mateIn1", "backRankMate"],
      })) { count++; r += 20; }
    }
  }
  console.log(`Cat 1 (Back Rank Mate): ${count}`);
}

// ── Cat 2: 一步杀·后王配合 (Queen+King Mate) ── 20 puzzles ──
{
  let r = 900, count = 0, f = 0;
  // Corner h1: queen must not attack h1 before move, king covers escapes
  const h1q = ["a2","b2","c2","d2","e2","f2","g2"]; // on 2nd rank, goes to h2
  for (const q of h1q) {
    if (count >= 7) break;
    const fen = queenKingFEN("h1", q, "f3");
    if (add({
      fen, type: "mate_in_1", knowledgePoint: "皇后与王配合", difficulty: 2, gradeBand: "14", rating: r,
      question: "白后如何与白王配合一步将死？",
      hints: ["白王控制逃跑格", "后沿横线贴近黑王将杀"],
      themes: ["mateIn1", "queenMate"],
    })) { count++; r += 20; }
  }
  // Corner a1: queen on 2nd rank (b2-h2), king on c3, Qa2#
  const a1q = ["b2","c2","d2","e2","f2","g2","h2"];
  for (const q of a1q) {
    if (count >= 14) break;
    const fen = queenKingFEN("a1", q, "c3");
    if (add({
      fen, type: "mate_in_1", knowledgePoint: "皇后与王配合", difficulty: 2, gradeBand: "14", rating: r,
      question: "白后如何与白王配合一步将死？",
      hints: ["后走到a2将杀", "白王在c3保护关键格"],
      themes: ["mateIn1", "queenMate"],
    })) { count++; r += 20; }
  }
  // Corner h8: queen on rank 7 (a7-g7), king on f6, Qh7#
  for (const q of ["a7","b7","c7","d7","e7","f7","g7"]) {
    if (count >= 20) break;
    const fen = queenKingFEN("h8", q, "f6");
    if (add({
      fen, type: "mate_in_1", knowledgePoint: "皇后与王配合", difficulty: 2, gradeBand: "14", rating: r,
      question: "白后如何与白王配合一步将死？",
      hints: ["后走到h7将杀", "白王保护关键格"],
      themes: ["mateIn1", "queenMate"],
    })) { count++; r += 20; }
  }
  console.log(`Cat 2 (Queen+King Mate): ${count}`);
}

// ── Cat 3: 一步杀·车王配合 (Rook+King Mate) ── 20 puzzles ──
{
  let r = 920, count = 0;
  // Rook on 2nd rank (a2-g2) → Rh2#, king on f3 covers escapes
  for (const rf of ["a2","b2","c2","d2","e2","f2","g2"]) {
    if (count >= 7) break;
    const fen = rookKingFEN("h1", rf, "f3");
    if (add({
      fen, type: "mate_in_1", knowledgePoint: "车与王配合", difficulty: 2, gradeBand: "14", rating: r,
      question: "白车如何与白王配合一步将死？",
      hints: ["车沿横线走到h线将杀", "白王控制逃跑格"],
      themes: ["mateIn1", "rookMate"],
    })) { count++; r += 20; }
  }
  for (const rf of ["b2","c2","d2","e2","f2","g2","h2"]) {
    if (count >= 14) break;
    const fen = rookKingFEN("a1", rf, "c3");
    if (add({
      fen, type: "mate_in_1", knowledgePoint: "车与王配合", difficulty: 2, gradeBand: "14", rating: r,
      question: "白车如何与白王配合一步将死？",
      hints: ["车横线走到a2将杀", "白王控制b1和b2"],
      themes: ["mateIn1", "rookMate"],
    })) { count++; r += 20; }
  }
  for (const rf of ["a7","b7","c7","d7","e7","f7","g7"]) {
    if (count >= 20) break;
    const fen = rookKingFEN("h8", rf, "f6");
    if (add({
      fen, type: "mate_in_1", knowledgePoint: "车与王配合", difficulty: 2, gradeBand: "14", rating: r,
      question: "白车如何与白王配合一步将死？",
      hints: ["车走到h7将杀", "白王保护关键格"],
      themes: ["mateIn1", "rookMate"],
    })) { count++; r += 20; }
  }
  console.log(`Cat 3 (Rook+King Mate): ${count}`);
}

// ── Cat 4: 吃子·后吃无保护子 (Queen capture hanging piece) ── 20 puzzles ──
{
  let r = 1000, count = 0;
  // Place queen + enemy piece at distance, verify with chess.js
  const queenSquares = ["e2","d2","e3","d3","a1","h1","a3","h3","c2","f2","b3","g3","a4","h4","e1","d1","b2","g2","c5","f5","a6","h6"];
  const targets: [string, string][] = [
    ["e5","n"],["d5","n"],["e4","b"],["d4","b"],["c5","n"],["f5","b"],
    ["c4","r"],["f4","r"],["b5","n"],["g5","b"],["b4","r"],["g4","r"],
    ["e6","b"],["d6","b"],["e3","n"],["d3","n"],["c6","r"],["f6","r"],
    ["a5","b"],["h5","n"],["a4","n"],["h4","r"],["b6","r"],["g6","b"],
  ];

  for (const [tSq, tPiece] of targets) {
    if (count >= 20) break;
    for (const qSq of queenSquares) {
      if (count >= 20) break;
      const fen = twoPieceFEN("Q", qSq, tPiece, tSq);
      if (add({
        fen, type: "hanging_piece", knowledgePoint: "后吃无保护子", difficulty: 3, gradeBand: "13", rating: r,
        question: "白后如何吃掉黑方的无保护子？",
        hints: ["寻找黑方无人保护的棋子", "后可以直接吃掉它获得优势"],
        themes: ["hangingPiece", "capture"],
      })) { count++; r += 20; }
    }
  }
  console.log(`Cat 4 (Queen Capture): ${count}`);
}

// ── Cat 5: 吃子·车吃无保护子 (Rook capture) ── 20 puzzles ──
{
  let r = 1000, count = 0;
  const rookFENs = [
    "8/8/8/8/3n4/8/8/R3K2k w - - 0 1", "8/8/8/8/4b3/8/8/R4K1k w - - 0 1",
    "8/8/8/8/5n2/8/8/R5K1k w - - 0 1", "8/8/8/8/6b1/8/8/R6Kk w - - 0 1",
    "8/8/8/8/2r5/8/8/1R4K1k w - - 0 1", "8/8/8/8/3b4/8/8/2R3K1k w - - 0 1",
    "8/8/8/8/4n3/8/8/3R2K2k w - - 0 1", "8/8/8/8/5b2/8/8/4R1K2k w - - 0 1",
    "8/8/2b5/8/2R5/8/8/6Kk w - - 0 1", "8/8/3n4/8/3R4/8/8/6K1k w - - 0 1",
    "8/8/4b3/8/4R3/8/8/5K1k w - - 0 1", "8/8/5n2/8/5R2/8/8/4K2k w - - 0 1",
    "8/8/8/8/n2R4/8/8/6Kk w - - 0 1", "8/8/8/8/b3R3/8/8/6K1k w - - 0 1",
    "8/8/8/8/4Rn2/8/8/6K1k w - - 0 1", "8/8/8/8/5R1b/8/8/5K2k w - - 0 1",
    "8/8/3r4/8/3R4/8/8/6K1k w - - 0 1", "8/8/8/8/2b1R3/8/8/1K4k1 w - - 0 1",
    "8/8/4n3/8/4R3/2K5/8/7k w - - 0 1", "8/8/8/3b4/3R4/8/2K5/6k1 w - - 0 1",
  ];
  for (const f of rookFENs) {
    if (count >= 20) break;
    if (add({
      fen: f, type: "hanging_piece", knowledgePoint: "车吃无保护子", difficulty: 3, gradeBand: "13", rating: r,
      question: "白车如何吃掉黑方的无保护子？",
      hints: ["寻找横线或竖线上无保护的黑子", "车沿直线吃掉即可"],
      themes: ["hangingPiece", "capture"],
    })) { count++; r += 20; }
  }
  console.log(`Cat 5 (Rook Capture): ${count}`);
}

// ── Cat 6: 吃子·象吃无保护子 (Bishop capture) ── 20 puzzles ──
{
  let r = 1000, count = 0;
  const sqColor = (s: string) => ((s.charCodeAt(0)-97) + (parseInt(s[1])-1)) % 2;
  const bSquares = ["c1","f1","a1","h1","d2","e2","c3","f3","a3","h3","b2","g2","d4","e4","c5","f5","a5","h5","b4","g4","b6","g6","a7","h7"];
  const targets: [string, string][] = [
    ["e5","r"],["d5","r"],["e4","n"],["d4","n"],["c5","n"],["f5","n"],
    ["c4","r"],["f4","r"],["b5","r"],["g5","r"],["b4","n"],["g4","n"],
    ["a5","r"],["h5","r"],["a4","n"],["h4","n"],["e6","n"],["d6","n"],
    ["c6","r"],["f6","r"],["b6","n"],["g6","n"],["a3","r"],["h3","r"],
  ];

  for (const [tSq, tPiece] of targets) {
    if (count >= 20) break;
    for (const bSq of bSquares) {
      if (count >= 20) break;
      if (sqColor(bSq) !== sqColor(tSq)) continue;
      if (bSq === tSq) continue;
      const fen = twoPieceFEN("B", bSq, tPiece, tSq);
      if (add({
        fen, type: "hanging_piece", knowledgePoint: "象吃无保护子", difficulty: 3, gradeBand: "13", rating: r,
        question: "白象如何吃掉黑方的无保护子？",
        hints: ["寻找斜线上无保护的黑子", "象沿斜线吃掉它"],
        themes: ["hangingPiece", "capture"],
      })) { count++; r += 20; }
    }
  }
  console.log(`Cat 6 (Bishop Capture): ${count}`);
}

// ── Cat 7: 吃子·马吃无保护子 (Knight capture) ── 20 puzzles ──
{
  let r = 1000, count = 0;
  const knightReach = (f: string, t: string) => {
    const df = Math.abs(f.charCodeAt(0) - t.charCodeAt(0));
    const dr = Math.abs(parseInt(f[1]) - parseInt(t[1]));
    return (df === 1 && dr === 2) || (df === 2 && dr === 1);
  };
  const nSquares = ["b1","g1","c3","f3","d4","e4","b5","g5","a3","h3","c5","f5","d2","e2","a4","h4","c1","f1","b3","g3","a6","h6","c7","f7"];
  const targets: [string, string][] = [
    ["e5","q"],["d5","r"],["e4","r"],["d4","q"],["c5","r"],["f5","q"],
    ["c4","q"],["f4","r"],["b5","q"],["g5","r"],["b4","r"],["g4","q"],
    ["a5","r"],["h5","q"],["a4","q"],["h4","r"],["e6","r"],["d6","q"],
    ["e3","q"],["d3","r"],["c6","q"],["f6","r"],["c3","r"],["f3","q"],
  ];

  for (const [tSq, tPiece] of targets) {
    if (count >= 20) break;
    for (const nSq of nSquares) {
      if (count >= 20) break;
      if (!knightReach(nSq, tSq)) continue;
      const fen = twoPieceFEN("N", nSq, tPiece, tSq);
      if (add({
        fen, type: "hanging_piece", knowledgePoint: "马吃无保护子", difficulty: 3, gradeBand: "13", rating: r,
        question: "白马如何吃掉黑方的无保护子？",
        hints: ["马可以跳过其他棋子吃子", "寻找马能攻击到的无保护黑子"],
        themes: ["hangingPiece", "capture"],
      })) { count++; r += 20; }
    }
  }
  console.log(`Cat 7 (Knight Capture): ${count}`);
}

// ── Cat 8: 兵升变 (Pawn Promotion) ── 20 puzzles ──
{
  let r = 800, count = 0;
  const promoFENs = [
    "8/4P3/8/8/8/8/6K1/5k2 w - - 0 1", "8/3P4/8/8/8/8/6K1/5k2 w - - 0 1",
    "8/2P5/8/8/8/8/6K1/5k2 w - - 0 1", "8/1P6/8/8/8/8/6K1/5k2 w - - 0 1",
    "8/P7/8/8/8/8/6K1/5k2 w - - 0 1", "8/5P2/8/8/8/8/6K1/5k2 w - - 0 1",
    "8/6P1/8/8/8/8/6K1/5k2 w - - 0 1", "8/7P/8/8/8/8/6K1/5k2 w - - 0 1",
    "8/4P3/8/8/8/8/1K6/6k1 w - - 0 1", "8/3P4/8/8/8/8/1K6/6k1 w - - 0 1",
    "8/2P5/8/8/8/8/1K6/6k1 w - - 0 1", "8/1P6/8/8/8/8/1K6/6k1 w - - 0 1",
    "8/P7/8/8/8/8/1K6/6k1 w - - 0 1", "8/5P2/8/8/8/8/1K6/6k1 w - - 0 1",
    "8/6P1/8/8/8/8/1K6/6k1 w - - 0 1", "8/7P/8/8/8/8/1K6/6k1 w - - 0 1",
    "7k/4P3/8/8/8/8/6K1/8 w - - 0 1", "7k/3P4/8/8/8/8/6K1/8 w - - 0 1",
    "7k/2P5/8/8/8/8/6K1/8 w - - 0 1", "7k/1P6/8/8/8/8/6K1/8 w - - 0 1",
  ];
  for (const f of promoFENs) {
    if (count >= 20) break;
    if (add({
      fen: f, type: "promotion", knowledgePoint: "兵升变", difficulty: 2, gradeBand: "14", rating: r,
      question: "白兵到达底线应该如何升变？",
      hints: ["兵走到第八排必须升变", "升变为皇后是最强的选择"],
      themes: ["promotion"],
    })) { count++; r += 20; }
  }
  console.log(`Cat 8 (Promotion): ${count}`);
}

// ── Cat 9: 马叉子 (Knight Fork) ── 20 puzzles ──
{
  let r = 1000, count = 0;
  const forkFENs = [
    "8/4k3/8/8/5q2/2N5/8/4K3 w - - 0 1", "8/2q1k3/8/8/8/2N5/8/4K3 w - - 0 1",
    "8/4k3/8/8/1q6/2N5/8/4K3 w - - 0 1", "8/3k4/8/8/5q2/5N2/8/4K3 w - - 0 1",
    "8/3k4/8/8/8/5N2/5r2/4K3 w - - 0 1", "8/4k3/8/8/8/6N1/4r3/4K3 w - - 0 1",
    "4k3/8/8/8/3q4/3N4/8/4K3 w - - 0 1", "4k3/8/8/8/4r3/2N5/8/4K3 w - - 0 1",
    "8/4k3/8/3r4/8/2N5/8/4K3 w - - 0 1", "8/5k2/8/8/6q1/2N5/8/4K3 w - - 0 1",
    "8/6k1/8/8/5q2/6N1/8/4K3 w - - 0 1", "8/4k3/8/8/5r2/2N5/8/4K3 w - - 0 1",
    "8/3k4/8/8/3q4/2N5/8/4K3 w - - 0 1", "8/3k4/8/8/5q2/3N4/8/4K3 w - - 0 1",
    "8/2k5/8/8/4r3/3N4/8/4K3 w - - 0 1", "8/2k5/8/8/3q4/5N2/8/4K3 w - - 0 1",
    "3k4/8/8/8/4q3/3N4/8/4K3 w - - 0 1", "4k3/8/8/8/5q2/3N4/8/4K3 w - - 0 1",
    "8/4k3/8/8/8/2N1r3/8/4K3 w - - 0 1", "8/4k3/8/8/8/6N1/3q4/4K3 w - - 0 1",
  ];
  for (const f of forkFENs) {
    if (count >= 20) break;
    if (add({
      fen: f, type: "fork", knowledgePoint: "马叉子", difficulty: 3, gradeBand: "13", rating: r,
      question: "白马跳到哪里能将军并同时攻击另一个棋子？",
      hints: ["骑士可以同时攻击王和另一个棋子", "先将军，然后吃掉被攻击的另一个棋子"],
      themes: ["fork", "check"],
    })) { count++; r += 20; }
  }
  console.log(`Cat 9 (Knight Fork): ${count}`);
}

// ── Cat 10: 一步杀·综合 (Mixed Mate) ── 20 puzzles ──
{
  let r = 900, count = 0;
  const mixedFENs = [
    // Two rooks
    "8/8/8/8/8/5K2/5R2/6Rk w - - 0 1", "8/8/8/8/8/2K5/2R5/k3R3 w - - 0 1",
    // Queen + rook
    "8/8/8/8/8/6K1/5Q2/5R1k w - - 0 1",
    // Queen + bishop
    "8/8/8/8/5B2/6K1/5Q2/7k w - - 0 1",
    "8/8/8/8/3B4/2K5/2Q5/k7 w - - 0 1",
    // Queen + knight
    "8/8/8/8/8/4N1K1/6Q1/7k w - - 0 1",
    // Smothered mate
    "6k1/6p1/6N1/8/8/8/8/6K1 w - - 0 1",
    // Pawn promotes to queen for mate
    "6k1/5P2/6K1/8/8/8/8/8 w - - 0 1",
    "4k3/3P4/6K1/8/8/8/8/8 w - - 0 1",
    // Back rank with queen
    "6k1/5ppp/8/8/8/8/6K1/Q7 w - - 0 1",
    "6k1/5ppp/8/8/8/8/1K6/1Q6 w - - 0 1",
    // Queen + pawn support
    "8/8/8/8/8/3PK3/2Q5/4k3 w - - 0 1",
    // Bishop + king coordination
    "8/8/8/8/3B4/6K1/8/5k2 w - - 0 1",
    // Knight + king
    "8/8/8/8/8/5N2/6K1/7k w - - 0 1",
    // Queen on file (protected by king)
    "3k4/8/3K4/8/8/8/8/4Q3 w - - 0 1",
    // Two queens (pawn promoted one)
    "6k1/5P2/6Q1/8/8/8/6K1/8 w - - 0 1",
    // Rook + knight
    "8/8/8/8/8/4N1K1/6R1/7k w - - 0 1",
    // Queen on diagonal protected by bishop
    "8/8/8/8/4B3/6K1/6Q1/7k w - - 0 1",
    // Back rank rook mate variation
    "4k3/3ppp2/8/8/8/8/6K1/3R4 w - - 0 1",
    // Rook on file, king covering escapes
    "8/8/2K5/8/2k5/8/8/2R5 w - - 0 1",
  ];
  for (const f of mixedFENs) {
    if (count >= 20) break;
    if (add({
      fen: f, type: "mate_in_1", knowledgePoint: "综合将杀", difficulty: 2, gradeBand: "14", rating: r,
      question: "白方一步将死。",
      hints: ["仔细观察所有白子的攻击范围", "黑王有哪些逃跑格？哪些被白方控制？"],
      themes: ["mateIn1"],
    })) { count++; r += 20; }
  }
  console.log(`Cat 10 (Mixed Mate): ${count}`);
}

// ══════════════════════════════════════════════════════════════════
// FEN BUILDER HELPERS
// ══════════════════════════════════════════════════════════════════

function compressRank(s: string): string {
  let out = "", n = 0;
  for (const ch of s) { if (ch === "1") n++; else { if (n) { out += n; n = 0; } out += ch; } }
  if (n) out += n;
  return out;
}

function rankFrom(pieces: Record<string, string>): string {
  let s = "";
  for (let f = 0; f < 8; f++) s += pieces[String.fromCharCode(97 + f)] ?? "1";
  return compressRank(s);
}

function buildFEN(ranks: string[], active = "w"): string {
  return ranks.join("/") + ` ${active} - - 0 1`;
}

function buildBackRankFEN(kFile: string, pawnFiles: string, pieceFile: string, pieceType: string): string {
  const r8: Record<string, string> = {}; r8[kFile] = "k";
  const r7: Record<string, string> = {}; for (const f of pawnFiles) r7[f] = "p";
  const r2: Record<string, string> = {}; r2["g"] = "K";
  const r1: Record<string, string> = {}; r1[pieceFile] = pieceType;
  return buildFEN([rankFrom(r8), rankFrom(r7), "8", "8", "8", "8", rankFrom(r2), rankFrom(r1)]);
}

function queenKingFEN(corner: string, queenSq: string, wkSq: string): string {
  const rs: Record<number, Record<string, string>> = {};
  for (let i = 1; i <= 8; i++) rs[i] = {};
  rs[parseInt(corner[1])][corner[0]] = "k";
  rs[parseInt(queenSq[1])][queenSq[0]] = "Q";
  rs[parseInt(wkSq[1])][wkSq[0]] = "K";
  return buildFEN([rankFrom(rs[8]), rankFrom(rs[7]), rankFrom(rs[6]), rankFrom(rs[5]),
                    rankFrom(rs[4]), rankFrom(rs[3]), rankFrom(rs[2]), rankFrom(rs[1])]);
}

function rookKingFEN(corner: string, rookSq: string, wkSq: string): string {
  const rs: Record<number, Record<string, string>> = {};
  for (let i = 1; i <= 8; i++) rs[i] = {};
  rs[parseInt(corner[1])][corner[0]] = "k";
  rs[parseInt(rookSq[1])][rookSq[0]] = "R";
  rs[parseInt(wkSq[1])][wkSq[0]] = "K";
  return buildFEN([rankFrom(rs[8]), rankFrom(rs[7]), rankFrom(rs[6]), rankFrom(rs[5]),
                    rankFrom(rs[4]), rankFrom(rs[3]), rankFrom(rs[2]), rankFrom(rs[1])]);
}

function twoPieceFEN(wPiece: string, wSq: string, bPiece: string, bSq: string): string {
  const rs: Record<number, Record<string, string>> = {};
  for (let i = 1; i <= 8; i++) rs[i] = {};
  rs[parseInt(wSq[1])][wSq[0]] = wPiece;
  rs[parseInt(bSq[1])][bSq[0]] = bPiece;
  rs[2]["g"] = "K";
  rs[8]["g"] = "k";
  return buildFEN([rankFrom(rs[8]), rankFrom(rs[7]), rankFrom(rs[6]), rankFrom(rs[5]),
                    rankFrom(rs[4]), rankFrom(rs[3]), rankFrom(rs[2]), rankFrom(rs[1])]);
}

// ══════════════════════════════════════════════════════════════════
// OUTPUT
// ══════════════════════════════════════════════════════════════════

puzzles.forEach((p, i) => { p.id = `gen-${String(i + 1).padStart(3, "0")}`; });

console.log(`\n=== TOTAL: ${puzzles.length} puzzles ===`);

const tsLines: string[] = [];
tsLines.push(`import { Problem } from "../models/types.js";`);
tsLines.push("");
tsLines.push(`const source = {`);
tsLines.push(`  name: "Yuzhong Chess Keep - beginner puzzle set",`);
tsLines.push(`  url: "https://lichess.org/"`);
tsLines.push(`};`);
tsLines.push("");
tsLines.push(`const problem = (input: Omit<Problem, "source">): Problem => ({ ...input, source });`);
tsLines.push("");
tsLines.push(`// 200 beginner puzzles across 10 categories`);
tsLines.push(`export const generatedProblems: Problem[] = [`);

for (const p of puzzles) {
  tsLines.push(`  problem({`);
  tsLines.push(`    id: "${p.id}",`);
  tsLines.push(`    gradeBand: "${p.gradeBand}",`);
  tsLines.push(`    type: "${p.type}",`);
  tsLines.push(`    difficulty: ${p.difficulty},`);
  tsLines.push(`    knowledgePoint: "${p.knowledgePoint}",`);
  tsLines.push(`    fen: "${p.fen}",`);
  tsLines.push(`    question: "${p.question}",`);
  tsLines.push(`    solution: "${p.solution}",`);
  tsLines.push(`    solutionUci: "${p.solutionUci}",`);
  tsLines.push(`    acceptedAnswers: [${p.acceptedAnswers.map((a) => `"${a}"`).join(", ")}],`);
  tsLines.push(`    hints: [${p.hints.map((h) => `"${h}"`).join(", ")}],`);
  tsLines.push(`    rating: ${p.rating},`);
  tsLines.push(`    themes: [${p.themes.map((t) => `"${t}"`).join(", ")}],`);
  tsLines.push(`  }),`);
}

tsLines.push(`];`);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(scriptDir, "generated-puzzles.ts");
writeFileSync(outPath, tsLines.join("\n"), "utf-8");
console.log(`Written: ${outPath}`);

// Category breakdown
const cats: Record<string, number> = {};
for (const p of puzzles) { cats[p.knowledgePoint] = (cats[p.knowledgePoint] ?? 0) + 1; }
console.log("\nCategory breakdown:");
for (const [k, v] of Object.entries(cats)) console.log(`  ${k}: ${v}`);
