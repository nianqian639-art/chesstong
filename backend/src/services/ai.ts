const QWEN_API_KEY = process.env.QWEN_API_KEY ?? "";
const AI_PROVIDER = process.env.AI_PROVIDER ?? "ollama";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const QWEN_BASE_URL = process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_MODEL = process.env.QWEN_MODEL ?? "qwen-plus-latest";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20000);

const bannedKeywords = ["政治敏感", "暴力鼓动", "不良引导"];
type AppLanguage = "zh" | "en" | "ja" | "fr" | "es";
const languageName = (language: AppLanguage = "zh") => ({ zh: "Chinese", en: "English", ja: "Japanese", fr: "French", es: "Spanish" })[language];

interface ExplainInput {
  question: string;
  answer: string;
  isCorrect: boolean;
  knowledgePoint: string;
  audience?: "child" | "general";
  language?: "zh" | "en" | "ja" | "fr" | "es";
}

const fallbackExplain = (input: ExplainInput): string => {
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
): Promise<{ text: string; source: "qwen" | "ollama" | "fallback" }> => {
  const childStyle = input.audience === "child";
  const languageName = { zh: "Chinese", en: "English", ja: "Japanese", fr: "French", es: "Spanish" }[input.language || "zh"];
  const prompt = [
    `You are a ${childStyle ? "friendly children's" : "clear and encouraging"} chess coach.`,
    `Write the entire response in ${languageName}. Do not use Chinese unless the selected language is Chinese.`,
    "First plan the teaching approach silently. Do not reveal that plan or any internal rubric.",
    "Then write only the learner-facing explanation as 2 or 3 short natural paragraphs.",
    "Explain what to notice, why the best move works, what reply to watch for, and one simple practice tip.",
    "Do not use headings, labels, numbering, Markdown, JSON, FEN, PGN, or meta commentary.",
    `Puzzle: ${input.question}`,
    `Theme: ${input.knowledgePoint}`,
    `The learner's answer is ${input.isCorrect ? "correct" : "not the expected solution"}.`,
    `Reference answer: ${input.answer}`
  ].join("\n");

  if (AI_PROVIDER === "qwen") {
    const text = await callQwen(
      `You are a chess coach. Reply entirely in ${languageName}.`,
      prompt
    );
    if (text && matchesRequestedLanguage(text, input.language)) {
      const cleaned = cleanLearnerExplanation(text);
      return { text: cleaned || fallbackExplain(input), source: cleaned ? "qwen" : "fallback" };
    }
    return { text: fallbackExplain(input), source: "fallback" };
  }

  const text = await callOllama(prompt);
  if (text && matchesRequestedLanguage(text, input.language)) {
    const cleaned = cleanLearnerExplanation(text);
    return { text: cleaned || fallbackExplain(input), source: cleaned ? "ollama" : "fallback" };
  }
  return { text: fallbackExplain(input), source: "fallback" };
};

export const generatePgnAnalysis = async (input: {
  pgn: string;
  localSummary: string;
  keyMoves: Array<{ ply: number; san: string; tag: string }>;
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

  const userPrompt = [
    `Reply entirely in ${languageName(input.language)}.`,
    "Plan the teaching approach silently, then write only the learner-facing review in three short paragraphs.",
    "Give a brief overview, two concrete moments to review, and one simple practice suggestion.",
    "Use only facts supported by the game record. Do not invent mistakes, variations, or progress.",
    childStyle ? "Use simple, encouraging language a child can understand." : "Be clear, encouraging, and specific.",
    "Do not use headings, numbering, Markdown, or internal teaching notes.",
    "",
    `PGN:\n${input.pgn}`,
    "",
    `Key moves:\n${keyLines || "No key moves identified"}`,
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
      return { summary: cleaned || fallback, source: cleaned ? "qwen" : "fallback" };
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
    return { summary: cleaned || fallback, source: cleaned ? "ollama" : "fallback" };
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
