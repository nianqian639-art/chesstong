import { Chess } from "chess.js";

export const resolveQwenApiKey = (qwenKey?: string, dashScopeKey?: string): string =>
  qwenKey?.trim() || dashScopeKey?.trim() || "";

const QWEN_API_KEY = resolveQwenApiKey(process.env.QWEN_API_KEY, process.env.DASHSCOPE_API_KEY);
const AI_PROVIDER = process.env.AI_PROVIDER ?? "ollama";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const QWEN_BASE_URL = process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_MODEL = process.env.QWEN_MODEL ?? "qwen-plus-latest";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20000);
const PUZZLE_AI_PROVIDER = QWEN_API_KEY ? "qwen" : AI_PROVIDER;

const bannedKeywords = ["政治敏感", "暴力鼓动", "不良引导"];
type AppLanguage = "zh" | "en" | "ja" | "fr" | "es";
const languageName = (language: AppLanguage = "zh") => ({ zh: "Chinese", en: "English", ja: "Japanese", fr: "French", es: "Spanish" })[language];

interface ExplainInput {
  question: string;
  answer: string;
  answerUci?: string | null;
  learnerAnswer?: string;
  fen?: string | null;
  isCorrect: boolean;
  knowledgePoint: string;
  audience?: "child" | "general";
  language?: "zh" | "en" | "ja" | "fr" | "es";
  stockfish?: { move: string | null; source: "stockfish" | "fallback" };
}

export interface PuzzlePositionFacts {
  fenBefore: string;
  fenAfter: string | null;
  bestMoveSan: string | null;
  bestMoveUci: string | null;
  isCheck: boolean;
  isCheckmate: boolean;
  legalReplies: string[];
  legalMovesBefore: string[];
}

const moveToUci = (move: { from: string; to: string; promotion?: string }): string =>
  `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();

/**
 * Derive all board facts locally before asking a language model to explain a
 * puzzle. The model receives these facts as constraints; it never has to
 * reconstruct the board from prose or guess legal replies.
 */
export const derivePuzzlePositionFacts = (input: {
  fen: string;
  answer: string;
  answerUci?: string | null;
}): PuzzlePositionFacts => {
  const initial = new Chess(input.fen);
  const legalMovesBefore = initial.moves();
  const moveInput = input.answerUci
    ? {
        from: input.answerUci.slice(0, 2),
        to: input.answerUci.slice(2, 4),
        promotion: input.answerUci[4] as "q" | "r" | "b" | "n" | undefined
      }
    : input.answer;
  const move = initial.move(moveInput, { strict: false });
  if (!move) {
    return {
      fenBefore: input.fen,
      fenAfter: null,
      bestMoveSan: null,
      bestMoveUci: null,
      isCheck: false,
      isCheckmate: false,
      legalReplies: [],
      legalMovesBefore
    };
  }

  return {
    fenBefore: input.fen,
    fenAfter: initial.fen(),
    bestMoveSan: move.san,
    bestMoveUci: moveToUci(move),
    isCheck: initial.isCheck(),
    isCheckmate: initial.isCheckmate(),
    legalReplies: initial.moves(),
    legalMovesBefore
  };
};

const safePuzzleFacts = (input: ExplainInput): PuzzlePositionFacts | undefined => {
  if (!input.fen) return undefined;
  try {
    return derivePuzzlePositionFacts({ fen: input.fen, answer: input.answer, answerUci: input.answerUci });
  } catch {
    return undefined;
  }
};

const notationTokens = (text: string): string[] => {
  const matches = text.match(/\b(?:O-O-O|O-O|(?:[KQRBN])?(?:[a-h]|[1-8])?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8][a-h][1-8][qrbn]?)\b/gi) ?? [];
  return matches.map((token) => token.replace(/[+#]/g, "").toLowerCase());
};

/** Reject any generated variation containing a move that is not legal in the
 * supplied position or immediately after the reference move. */
const explanationUsesOnlyLegalMoves = (text: string, facts?: PuzzlePositionFacts, allowedMoves?: string[]): boolean => {
  if (!facts) return true;
  const allowed = new Set<string>((allowedMoves ?? [
    ...facts.legalMovesBefore,
    ...facts.legalReplies,
    ...(facts.bestMoveSan ? [facts.bestMoveSan] : [])
  ]).map((move) => move.replace(/[+#]/g, "").toLowerCase()));
  for (const file of "abcdefgh") for (let rank = 1; rank <= 8; rank += 1) allowed.add(`${file}${rank}`);
  const allowedUci = new Set<string>(facts.bestMoveUci ? [facts.bestMoveUci.toLowerCase()] : []);
  for (const token of notationTokens(text)) {
    if (!allowed.has(token) && !allowedUci.has(token)) return false;
  }
  return true;
};

const puzzleClaimsMatchFacts = (text: string, input: ExplainInput, facts: PuzzlePositionFacts): boolean => {
  const saysCorrect = /你(?:这一步|这步|的答案|的走法|的着法)?(?:是)?(?:答对|正确|对了)|答案是正确|your answer is (?:correct|right)|you are correct|you got it right|正解です|votre réponse est correcte|tu as trouvé la bonne réponse/i.test(text);
  const saysIncorrect = /还不是本题标准答案|不是本题答案|没有答对|答案不正确|答错|not (?:the )?(?:expected|correct) solution|your answer is incorrect|your answer is wrong|標準解ではありません|正解ではありません|n'est pas la solution attendue|no es la solución esperada/i.test(text);
  if (!input.isCorrect && saysCorrect) return false;
  if (input.isCorrect && saysIncorrect) return false;
  if (!facts.isCheckmate && /将杀|checkmate|échec et mat|jaque mate|チェックメイト/i.test(text)) return false;
  if (input.fen) {
    const board = boardFactsFromFen(input.fen);
    const hasPiece = (color: "White" | "Black", piece: string) => board.some((item) => item.color === color && item.piece === piece);
    const colorPieceClaims = [
      { pattern: /white\s+(pawn|knight|bishop|rook|queen|king)/i, color: "White" as const },
      { pattern: /black\s+(pawn|knight|bishop|rook|queen|king)/i, color: "Black" as const },
      { pattern: /白(?:方(?:的)?|色)?(兵|卒|马|象|车|后|王)/, color: "White" as const },
      { pattern: /黑(?:方(?:的)?|色)?(兵|卒|马|象|车|后|王)/, color: "Black" as const },
      { pattern: /白の(ポーン|ナイト|ビショップ|ルーク|クイーン|キング)/, color: "White" as const },
      { pattern: /黒の(ポーン|ナイト|ビショップ|ルーク|クイーン|キング)/, color: "Black" as const },
      { pattern: /(pion|cavalier|fou|tour|dame|roi) blanc/i, color: "White" as const },
      { pattern: /(pion|cavalier|fou|tour|dame|roi) noir/i, color: "Black" as const },
      { pattern: /(peón|caballo|alfil|torre|dama|rey) blanco/i, color: "White" as const },
      { pattern: /(peón|caballo|alfil|torre|dama|rey) negro/i, color: "Black" as const }
    ];
    const pieceMap: Record<string, string> = { pawn: "pawn", knight: "knight", bishop: "bishop", rook: "rook", queen: "queen", king: "king", "兵": "pawn", "卒": "pawn", "马": "knight", "象": "bishop", "车": "rook", "后": "queen", "王": "king", "ポーン": "pawn", "ナイト": "knight", "ビショップ": "bishop", "ルーク": "rook", "クイーン": "queen", "キング": "king", pion: "pawn", cavalier: "knight", fou: "bishop", tour: "rook", dame: "queen", roi: "king", peón: "pawn", caballo: "knight", alfil: "bishop", torre: "rook", dama: "queen", rey: "king" };
    for (const claim of colorPieceClaims) {
      const match = text.match(claim.pattern);
      if (match) {
        const label = (match[1] || match[0].split(/\s+/)[1] || "").toLowerCase();
        const piece = pieceMap[label];
        if (piece && !hasPiece(claim.color, piece)) return false;
      }
    }
    const turn = input.fen.split(/\s+/)[1] === "b" ? "Black" : "White";
    const wrongTurnClaim = turn === "White"
      ? /black (?:to move|moves first|plays first)|黑方(?:走棋|先走)|黒の番です|les noirs jouent|juegan las negras/i.test(text)
      : /white (?:to move|moves first|plays first)|白方(?:走棋|先走)|白の番です|les blancs jouent|juegan las blancas/i.test(text);
    if (wrongTurnClaim) return false;
  }
  return true;
};

const boardFactsFromFen = (fen: string): Array<{ color: string; piece: string; square: string }> => {
  const chess = new Chess(fen);
  const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;
  return chess.board().flatMap((row, rank) => row.flatMap((piece, file) => piece ? [{ color: piece.color === "w" ? "White" : "Black", piece: names[piece.type], square: `${"abcdefgh"[file]}${8-rank}` }] : []));
};

export const serverLearnerMoveSan = (fen: string, rawMove?: string): string | null => {
  if (!rawMove) return null;
  try {
    const chess = new Chess(fen);
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(rawMove);
    const from = uci?.[1].toLowerCase();
    const to = uci?.[2].toLowerCase();
    const piece = from ? chess.get(from as any) : undefined;
    const promotes = piece?.type === "p" && to !== undefined &&
      ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));
    const move = uci
      ? chess.move({ from: from as any, to: to as any, promotion: (uci[3]?.toLowerCase() ?? (promotes ? "q" : undefined)) as any })
      : chess.move(rawMove, { strict: false });
    return move?.san ?? null;
  } catch {
    return null;
  }
};

const fallbackExplain = (input: ExplainInput): string => {
  const facts = safePuzzleFacts(input);
  if (facts?.isCheckmate && facts.bestMoveSan) {
    return ({
      zh: `${input.isCorrect ? "你找到的" : "标准答案"} ${facts.bestMoveSan} 是将杀。走完后，对方没有任何合法应手，无法解除对王的将军。`,
      en: `${input.isCorrect ? "Your move" : "The reference move"} ${facts.bestMoveSan} is checkmate. The opponent has no legal move that can get the king out of check.`,
      ja: `${facts.bestMoveSan} はチェックメイトです。相手には王手を防ぐ合法な手がありません。`,
      fr: `${facts.bestMoveSan} est un échec et mat. L'adversaire n'a aucun coup légal pour sortir le roi de l'échec.`,
      es: `${facts.bestMoveSan} es jaque mate. El rival no tiene ninguna jugada legal para sacar al rey del jaque.`
    } as Record<string, string>)[input.language || "zh"];
  }
  const localized: string[] | undefined = ({
    en: ["Start by finding the most important pieces and threats.", "Check your opponent's reply before deciding on a move.", "Try another puzzle with the same idea.", `Your answer was ${input.isCorrect ? "correct" : "not the expected solution"}. Reference answer: ${input.answer}`],
    ja: ["まず重要な駒と脅威を探しましょう。", "1手だけで止まらず、相手の応手も確認しましょう。", "同じテーマの問題をもう1問解いてみましょう。", `あなたの答えは${input.isCorrect ? "正解" : "標準解ではありません"}。正解：${input.answer}`],
    fr: ["Commencez par repérer les pièces et les menaces importantes.", "Ne vous arrêtez pas au premier coup : vérifiez la réponse adverse.", "Essayez un autre exercice sur le même thème.", `Votre réponse est ${input.isCorrect ? "correcte" : "différente de la solution attendue"}. Réponse : ${input.answer}`],
    es: ["Empieza por identificar las piezas y amenazas más importantes.", "No te detengas tras una jugada; comprueba la respuesta rival.", "Prueba otro ejercicio del mismo tema.", `Tu respuesta fue ${input.isCorrect ? "correcta" : "distinta de la solución esperada"}. Respuesta: ${input.answer}`]
  } as Record<string, string[]>)[input.language || "zh"];
  if (localized) return localized.join("\n");
  const childStyle = input.audience === "child";
  return [
    childStyle
      ? `先找出最重要的棋子和对方王附近的威胁。这个局面要记住【${input.knowledgePoint}】：答案之所以好，是因为它能直接利用这个机会。`
      : `先识别关键子力和对方的主要威胁，再计算一到两步强制变化。本题的重点是【${input.knowledgePoint}】，这个走法正好抓住了局面的弱点。`,
    `走完后别急着移开视线，看看对方最有力的应对，以及自己的棋子是否仍然安全。你的答案${input.isCorrect ? "正确" : "还没有命中标准解"}，参考走法是${input.answer}。`,
    childStyle ? "再练习几道同主题的小题，每次都先找将军、吃子和威胁。" : "接下来练习几道同主题的题目，并复盘自己漏看的对方应手。"
  ].join("\n\n");
};

const safeText = (text: string): boolean => {
  return !bannedKeywords.some((item) => text.includes(item));
};

// Models occasionally ignore a language instruction. Do not expose that response
// in a non-Chinese UI: use the localized fallback instead.
const matchesRequestedLanguage = (text: string, language: AppLanguage = "zh"): boolean => {
  if (language === "zh") return true;
  if (language === "ja") return /[\u3040-\u30ff]/.test(text);
  return !/[\u3400-\u9fff]/.test(text);
};

// Keep the coach's internal teaching plan out of the learner-facing response.
// Models sometimes add headings or Markdown even when asked not to.
const cleanLearnerExplanation = (text: string): string => {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*{1,3}|_{1,3}|`/g, "")
    .replace(/^\s*(?:教学方式|教学方法|讲解方式|核心要点|关键要点|常见错误|常见误区|下次练习|类似题建议|approach|key idea|common mistake|next practice)\s*[:：]?\s*/gim, "")
    .replace(/^\s*(?:\d+\s*[.)、]|[-•])\s*/gm, "")
    .replace(/\b(?:FEN|JSON|PGN)\s*[:：][^\n]*/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const callQwen = async (systemPrompt: string, userPrompt: string): Promise<string | null> => {
  if (!QWEN_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${QWEN_API_KEY}`
      },
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        model: QWEN_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text || !safeText(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
};

const callOllama = async (prompt: string): Promise<string | null> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        think: false,
        options: {
          temperature: 0.35,
          num_predict: 360
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { response?: string };
    const text = data.response?.trim() ?? "";
    if (!text || !safeText(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
};

export const generateExplanation = async (
  input: ExplainInput
): Promise<{ text: string; source: "qwen" | "ollama" | "verified"; engineFeedback: string }> => {
  const language = input.language || "zh";
  const facts = input.fen ? safePuzzleFacts(input) : undefined;
  const engineFeedback = input.stockfish?.source === "stockfish" && input.stockfish.move
    ? input.stockfish.move
    : "unavailable";
  if (!facts?.bestMoveSan || !input.fen) return { text: fallbackExplain(input), source: "verified", engineFeedback };

  const chess = new Chess(input.fen);
  const from = facts.bestMoveUci?.slice(0, 2) ?? "";
  const to = facts.bestMoveUci?.slice(2, 4) ?? "";
  const piece = chess.get(from as any);
  const pieceName = piece
    ? ({ p: { zh: "兵", en: "pawn", ja: "ポーン", fr: "pion", es: "peón" }, n: { zh: "马", en: "knight", ja: "ナイト", fr: "cavalier", es: "caballo" }, b: { zh: "象", en: "bishop", ja: "ビショップ", fr: "fou", es: "alfil" }, r: { zh: "车", en: "rook", ja: "ルーク", fr: "tour", es: "torre" }, q: { zh: "后", en: "queen", ja: "クイーン", fr: "dame", es: "dama" }, k: { zh: "王", en: "king", ja: "キング", fr: "roi", es: "rey" } } as const)[piece.type][language]
    : "";
  const moveInput = input.answerUci
    ? { from, to, promotion: input.answerUci[4] as "q" | "r" | "b" | "n" | undefined }
    : input.answer;
  const move = chess.move(moveInput, { strict: false });
  const learnerMove = serverLearnerMoveSan(input.fen, input.learnerAnswer);
  const opponent = (input.fen.split(/\s+/)[1] || "w") === "w"
    ? ({ zh: "黑方", en: "Black", ja: "黒", fr: "les Noirs", es: "las negras" } as const)[language]
    : ({ zh: "白方", en: "White", ja: "白", fr: "les Blancs", es: "las blancas" } as const)[language];
  const checkedResult = facts.isCheckmate
    ? ({ zh: `走完后${opponent}没有任何合法应手，这是将杀。`, en: `After this move, ${opponent} has no legal reply; it is checkmate.`, ja: `この手の後、${opponent}には合法な応手がなく、チェックメイトです。`, fr: `Après ce coup, ${opponent} n'a aucune réponse légale : c'est échec et mat.`, es: `Después de esta jugada, ${opponent} no tiene respuesta legal: es jaque mate.` } as const)[language]
    : facts.isCheck
      ? ({ zh: "这步将军了；接下来检查对方有哪些合法应手。", en: "This move gives check; now look at the opponent's legal replies.", ja: "この手はチェックです。相手の合法な応手を確認しましょう。", fr: "Ce coup donne échec ; vérifiez les réponses légales de l'adversaire.", es: "Esta jugada da jaque; comprueba las respuestas legales del rival." } as const)[language]
      : ({ zh: "走完后轮到对方行动。可以继续检查对方的合法应手。", en: "It is now the opponent's turn. Check their legal replies on the board.", ja: "次は相手の番です。盤上で合法な応手を確認しましょう。", fr: "C'est maintenant au tour de l'adversaire. Vérifiez ses réponses légales.", es: "Ahora le toca al rival. Comprueba sus respuestas legales en el tablero." } as const)[language];
  const capture = move?.captured ? ({ zh: `，并吃掉了对方的${({ p: "兵", n: "马", b: "象", r: "车", q: "后", k: "王" } as const)[move.captured]}`, en: ", capturing an opposing piece", ja: "。相手の駒を取りました", fr: " et prend une pièce adverse", es: " y captura una pieza rival" } as const)[language] : "";
  const explanation = language === "zh"
    ? `${input.isCorrect ? "你这一步答对了。" : `这一步还不是本题标准答案${learnerMove ? `（${learnerMove}）` : ""}。`}标准走法是 ${facts.bestMoveSan}：${pieceName}从 ${from} 走到 ${to}${capture}。${checkedResult}`
    : language === "en"
      ? `${input.isCorrect ? "Your answer is correct. " : `That is not the expected solution${learnerMove ? ` (${learnerMove})` : ""}. `}The reference move is ${facts.bestMoveSan}: the ${pieceName} moves from ${from} to ${to}${capture}. ${checkedResult}`
      : language === "ja"
        ? `${input.isCorrect ? "正解です。" : `この手は標準解ではありません${learnerMove ? `（${learnerMove}）` : ""}。`}標準手は ${facts.bestMoveSan} です。${pieceName}を${from}から${to}へ動かします${capture}。${checkedResult}`
        : language === "fr"
          ? `${input.isCorrect ? "Votre réponse est correcte. " : `Ce n'est pas la solution attendue${learnerMove ? ` (${learnerMove})` : ""}. `}Le coup de référence est ${facts.bestMoveSan} : la ${pieceName} va de ${from} à ${to}${capture}. ${checkedResult}`
          : `${input.isCorrect ? "Tu respuesta es correcta. " : `No es la solución esperada${learnerMove ? ` (${learnerMove})` : ""}. `}La jugada de referencia es ${facts.bestMoveSan}: ${pieceName} se mueve de ${from} a ${to}${capture}. ${checkedResult}`;
  const sideToMove = input.fen.split(/\s+/)[1] === "b" ? "Black" : "White";
  const engineFacts = engineFeedback !== "unavailable"
    ? derivePuzzlePositionFacts({ fen: input.fen, answer: engineFeedback })
    : undefined;
  const learnerBoard = boardFactsFromFen(input.fen);
  const prompt = [
    `Reply entirely in ${({ zh: "Simplified Chinese", en: "English", ja: "Japanese", fr: "French", es: "Spanish" } as const)[language]}.`,
    "You are explaining one chess puzzle to a beginner. The server-verified facts below are authoritative. Do not infer another position, swap White and Black, invent a piece or move, or claim an unverified continuation. Do not judge or restate whether the submitted move is correct; the interface displays the server's verdict. Write two or three short learner-facing sentences; do not show internal reasoning, teaching plans, headings, or raw FEN/JSON.",
    `Puzzle prompt: ${input.question}`,
    `Position FEN: ${input.fen}`,
    `Side to move (the solver's side for this puzzle): ${sideToMove}`,
    `Pieces and squares before the move: ${JSON.stringify(learnerBoard)}`,
    `Student move submitted: ${learnerMove ?? "not a legal move in this position"}`,
    `Server judgment of the submitted move against accepted puzzle answers: ${input.isCorrect ? "correct" : "not correct"}`,
    `Puzzle reference answer (server-verified): ${facts.bestMoveSan}; UCI ${facts.bestMoveUci}; gives check ${facts.isCheck}; checkmate ${facts.isCheckmate}; legal replies after it: ${facts.legalReplies.join(", ") || "none"}`,
    engineFacts && input.stockfish?.source === "stockfish"
      ? `Stockfish feedback for the original position: best move ${engineFeedback}; gives check ${engineFacts.isCheck}; checkmate ${engineFacts.isCheckmate}. This engine endpoint does not provide an evaluation score or a full principal variation. Keep this separate from the puzzle's accepted answer.`
      : "Stockfish feedback: unavailable; do not claim an engine evaluation or engine move.",
    "Only name these moves: the student's submitted SAN, the puzzle reference SAN, and the Stockfish best move if it was provided. If the engine move differs from the puzzle answer, explain that they are separate sources; do not silently replace the puzzle answer."
  ].join("\n");
  const generated = PUZZLE_AI_PROVIDER === "qwen"
    ? await callQwen(`You are a precise chess tutor. Follow the evidence and language requirements exactly.`, prompt)
    : await callOllama(prompt);
  const allowedMoves = [learnerMove, facts.bestMoveSan, engineFeedback !== "unavailable" ? engineFeedback : undefined].filter((move): move is string => Boolean(move));
  if (generated && matchesRequestedLanguage(generated, language) && explanationUsesOnlyLegalMoves(generated, facts, allowedMoves) && puzzleClaimsMatchFacts(generated, input, facts)) {
    const cleaned = cleanLearnerExplanation(generated);
    if (cleaned) return { text: cleaned, source: PUZZLE_AI_PROVIDER === "qwen" ? "qwen" : "ollama", engineFeedback };
  }
  return { text: explanation, source: "verified", engineFeedback };
};

export const generatePuzzleFollowup = async (input: ExplainInput & { learnerQuestion: string; conversationHistory?: Array<{ role: "user" | "assistant"; content: string }> }): Promise<{ text: string; source: "qwen" | "ollama" | "verified" }> => {
  const facts = input.fen ? safePuzzleFacts(input) : undefined;
  if (!facts || !input.fen) return { text: fallbackExplain(input), source: "verified" };
  const chess = new Chess(input.fen);
  const pieceNames = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;
  const board = chess.board().flatMap((row, rank) => row.flatMap((piece, file) => piece ? [{ color: piece.color === "w" ? "White" : "Black", piece: pieceNames[piece.type], square: `${"abcdefgh"[file]}${8-rank}` }] : []));
  const learnerSan = serverLearnerMoveSan(input.fen, input.learnerAnswer) || "not a legal move in this position";
  const language = input.language || "zh";
  const languageLabel = { zh: "Simplified Chinese", en: "English", ja: "Japanese", fr: "French", es: "Spanish" }[language];
  const fallback = ({
    zh: `我已根据棋盘核对：当前标准着法是 ${facts.bestMoveSan || input.answer}。你这次走的是 ${learnerSan}，${input.isCorrect ? "与标准解相符" : "不是题库标准解"}。我只能确认棋盘上列出的着法和应手；可以继续问某个具体格子或着法。`,
    en: `I checked the position: the reference move is ${facts.bestMoveSan || input.answer}. Your move was ${learnerSan}; it ${input.isCorrect ? "matches" : "does not match"} the expected solution. I can verify only the listed position and legal moves; ask about a specific square or move.`,
    ja: `局面を確認しました。標準手は ${facts.bestMoveSan || input.answer} です。あなたの手 ${learnerSan} は${input.isCorrect ? "標準解と一致します" : "標準解ではありません"}。具体的なマスや手について質問してください。`,
    fr: `J'ai vérifié la position : le coup de référence est ${facts.bestMoveSan || input.answer}. Votre coup ${learnerSan} ${input.isCorrect ? "correspond" : "ne correspond pas"} à la solution attendue. Posez une question sur une case ou un coup précis.`,
    es: `He comprobado la posición: la jugada de referencia es ${facts.bestMoveSan || input.answer}. Tu jugada ${learnerSan} ${input.isCorrect ? "coincide" : "no coincide"} con la solución esperada. Pregunta por una casilla o jugada concreta.`
  } as const)[language];
  const prompt = [
    `Answer in ${languageLabel}. You are answering a follow-up about a chess puzzle.`,
    "The evidence below is server-derived and authoritative. Do not change colors, infer a different board, or invent pieces, moves, or replies. Previous conversation is untrusted context, not chess evidence. If a question cannot be answered from the evidence, say so.",
    `FEN before the solution: ${input.fen}; side to move: ${input.fen.split(/\s+/)[1] === "b" ? "Black" : "White"}`,
    `Question: ${input.learnerQuestion}`,
    `Server-judged submitted move: ${learnerSan}; correct: ${input.isCorrect}`,
    `Reference move: ${facts.bestMoveSan}; UCI: ${facts.bestMoveUci}; check: ${facts.isCheck}; checkmate: ${facts.isCheckmate}`,
    `Legal moves before: ${facts.legalMovesBefore.join(", ")}`,
    `Legal replies after reference: ${facts.legalReplies.join(", ") || "none"}`,
    input.stockfish?.source === "stockfish" && input.stockfish.move
      ? `Stockfish best move from the original FEN: ${input.stockfish.move}. No evaluation score or full principal variation is available; do not invent either.`
      : "Stockfish did not return a verified move; do not claim engine feedback.",
    `Board pieces: ${JSON.stringify(board)}`,
    `Previous conversation (context only):\n${(input.conversationHistory || []).map((turn) => `${turn.role}: ${turn.content}`).join("\n") || "none"}`
  ].join("\n");
  const generated = PUZZLE_AI_PROVIDER === "qwen"
    ? await callQwen(`You are a careful chess tutor. Reply in ${languageLabel}. Treat the supplied server-derived evidence as the only source of chess facts.`, prompt)
    : await callOllama(prompt);
  const followupMoves = [...facts.legalMovesBefore, ...facts.legalReplies, facts.bestMoveSan, facts.bestMoveUci, input.stockfish?.source === "stockfish" ? input.stockfish.move : undefined]
    .filter((move): move is string => Boolean(move));
  if (!generated || !matchesRequestedLanguage(generated, language) || !explanationUsesOnlyLegalMoves(generated, facts, followupMoves) || !puzzleClaimsMatchFacts(generated, input, facts)) {
    return { text: fallback, source: "verified" };
  }
  return { text: cleanLearnerExplanation(generated), source: PUZZLE_AI_PROVIDER === "qwen" ? "qwen" : "ollama" };
};

export const generatePgnAnalysis = async (input: {
  pgn: string;
  localSummary: string;
  keyMoves: Array<{ ply: number; san: string; tag: string }>;
  movesWithActors?: Array<{ ply: number; san: string; side: "White" | "Black"; actor: "player" | "AI" }>;
  playerColor?: "w" | "b";
  audience?: "child" | "general";
  language?: AppLanguage;
}): Promise<{ summary: string; source: "qwen" | "ollama" | "fallback" }> => {
  const childStyle = input.audience === "child";
  const fallback = ({
    zh: input.localSummary,
    en: "AI review is temporarily unavailable. Review the moves and look for checks, captures, and threats.",
    ja: "AIによる振り返りは現在利用できません。手順を見直し、チェック、駒取り、脅威を探しましょう。",
    fr: "L'analyse IA est temporairement indisponible. Revoyez les coups et cherchez les échecs, prises et menaces.",
    es: "El análisis de IA no está disponible temporalmente. Revisa las jugadas y busca jaques, capturas y amenazas."
  })[input.language || "zh"];

  const keyLines = input.keyMoves
    .slice(0, 6)
    .map((item) => `Ply ${item.ply}: ${item.san}`)
    .join("\n");
  const misattributesAiMove = (text: string): boolean => (input.movesWithActors || [])
    .filter((move) => move.actor === "AI")
    .some((move) => {
      const at = text.indexOf(move.san);
      if (at < 0) return false;
      const prefix = text.slice(Math.max(0, at - 32), at);
      return /你[^。！？\n]{0,24}(?:走了|下了|走的是)|\byou[^.!?\n]{0,24}(?:played|moved)\b/i.test(prefix);
    });

  const userPrompt = [
    `Reply entirely in ${languageName(input.language)}.`,
    "Plan the teaching approach silently, then write only the learner-facing review in three short paragraphs.",
    "Give a brief overview, two concrete moments to review, and one simple practice suggestion.",
    "Use only facts supported by the game record. Do not invent mistakes, variations, or progress.",
    `The player is ${input.playerColor === "b" ? "Black" : "White"}; the AI is ${input.playerColor === "b" ? "White" : "Black"}. PGN ply 1 is White, ply 2 is Black, alternating thereafter. The server parsed and labeled every move. Never attribute an AI move to the player; refer to sides as White/Black rather than guessing from SAN alone.`,
    childStyle ? "Use simple, encouraging language a child can understand." : "Be clear, encouraging, and specific.",
    "Do not use headings, numbering, Markdown, or internal teaching notes.",
    "",
    `PGN:\n${input.pgn}`,
    "",
    `Key moves:\n${keyLines || "No key moves identified"}`,
    `Verified move ownership from server-parsed PGN (do not reinterpret):\n${(input.movesWithActors || []).map((move) => `Ply ${move.ply} | ${move.side} | ${move.actor} | ${move.san}`).join("\n") || "No moves"}`,
    "",
    `Local game facts (translate these into the selected language):\n${input.localSummary}`
  ].join("\n");

  if (AI_PROVIDER === "qwen") {
    const aiText = await callQwen(
      `You are a chess coach. Reply entirely in ${languageName(input.language)}.`,
      userPrompt
    );
    if (aiText && matchesRequestedLanguage(aiText, input.language)) {
      const cleaned = cleanLearnerExplanation(aiText);
      const trustworthy = Boolean(cleaned && !misattributesAiMove(cleaned));
      return { summary: trustworthy ? cleaned : fallback, source: trustworthy ? "qwen" : "fallback" };
    }
    return { summary: fallback, source: "fallback" };
  }

  const ollamaText = await callOllama(
    [
      `You are a chess coach. Reply entirely in ${languageName(input.language)}.`,
      userPrompt
    ].join("\n")
  );
  if (ollamaText && matchesRequestedLanguage(ollamaText, input.language)) {
    const cleaned = cleanLearnerExplanation(ollamaText);
    const trustworthy = Boolean(cleaned && !misattributesAiMove(cleaned));
    return { summary: trustworthy ? cleaned : fallback, source: trustworthy ? "ollama" : "fallback" };
  }

  return { summary: fallback, source: "fallback" };
};

// ── Weekly Report Commentary ───────────────────────────────────

export const generateWeeklyCommentary = async (input: {
  studentName: string;
  weekRange: string;
  solveCount: number;
  battleCount: number;
  pvpWins: number;
  pvpLosses: number;
  pvpDraws: number;
  pointsGained: number;
  currentPoints: number;
  currentRank: string;
  language?: AppLanguage;
}): Promise<{ text: string; source: string }> => {
  const stats = [
    `学生：${input.studentName}`,
    `周期：${input.weekRange}`,
    `正确解题：${input.solveCount}道`,
    `对战局数：${input.battleCount}局（${input.pvpWins}胜${input.pvpLosses}负${input.pvpDraws}平）`,
    `本周积分变化：${input.pointsGained >= 0 ? "+" : ""}${input.pointsGained}分`,
    `当前积分：${input.currentPoints}分，段位：${input.currentRank}`,
  ].join("\n");

  const prompt = [
    `Reply entirely in ${languageName(input.language)}.`,
    "你是一位温暖、专业的国际象棋学习顾问，正在为家长写一份简短的学生周报评语。",
    "请根据下面的学习数据，用指定语言写一段简短评语。只描述数据支持的事实，不能推断学习态度或尚未记录的进步。包含：",
    "1) 对学生本周表现的整体评价（鼓励为主）",
    "2) 1-2个亮点或进步",
    "3) 1-2条具体的改进建议",
    "语气要温暖、鼓励、具体，像老师在和家长聊天，不要用序号或格式标记。",
    "",
    stats,
  ].join("\n");

  // Try Ollama first, then Qwen, then fallback
  if (AI_PROVIDER === "ollama" || !AI_PROVIDER) {
    try {
      const ollamaText = await callOllama(prompt);
      if (ollamaText && safeText(ollamaText) && matchesRequestedLanguage(ollamaText, input.language)) {
        return { text: ollamaText, source: "ollama" };
      }
    } catch {}
  }

  if (AI_PROVIDER === "qwen") {
    try {
      const qwenText = await callQwen("你是温暖专业的学习顾问。", prompt);
      if (qwenText && safeText(qwenText) && matchesRequestedLanguage(qwenText, input.language)) {
        return { text: qwenText, source: "qwen" };
      }
    } catch {}
  }

  // Fallback
  const fallback = ({
    zh: (input.solveCount > 0 || input.battleCount > 0) ? `${input.studentName}本周完成了${input.solveCount}道题目和${input.battleCount}局对战，表现不错！继续保持训练节奏，多关注对局中的失误，会进步更快。` : `${input.studentName}本周还没有开始训练哦。建议每天至少完成2道题目和1局对战，坚持就是胜利！家长可以和孩子一起制定一个固定的训练时间。`,
    en: (input.solveCount > 0 || input.battleCount > 0) ? `${input.studentName} completed ${input.solveCount} puzzles and ${input.battleCount} games this week. Keep a steady practice rhythm and review key mistakes after each game.` : `${input.studentName} has not started training this week. Try two puzzles and one game each day to build a regular routine.`,
    ja: (input.solveCount > 0 || input.battleCount > 0) ? `${input.studentName}さんは今週、${input.solveCount}問の問題と${input.battleCount}局の対局を完了しました。練習のリズムを保ち、各対局後に重要なミスを振り返りましょう。` : `${input.studentName}さんは今週まだトレーニングを始めていません。毎日2問と1局から、規則的な練習を始めましょう。`,
    fr: (input.solveCount > 0 || input.battleCount > 0) ? `${input.studentName} a terminé ${input.solveCount} exercices et ${input.battleCount} parties cette semaine. Gardez un rythme régulier et analysez les erreurs importantes après chaque partie.` : `${input.studentName} n'a pas encore commencé à s'entraîner cette semaine. Essayez deux exercices et une partie par jour.`,
    es: (input.solveCount > 0 || input.battleCount > 0) ? `${input.studentName} completó ${input.solveCount} ejercicios y ${input.battleCount} partidas esta semana. Mantén un ritmo regular y revisa los errores clave tras cada partida.` : `${input.studentName} aún no ha empezado a entrenar esta semana. Intenta resolver dos ejercicios y jugar una partida cada día.`
  })[input.language || "zh"];

  return { text: fallback, source: "fallback" };
};
