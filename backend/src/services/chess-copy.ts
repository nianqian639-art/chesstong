export type ChessLanguage = "zh" | "en" | "ja" | "fr" | "es";

const copy = {
  zh: {
    invalid: "局面格式无效，请重新开始对局。", ended: "当前局面已结束，请查看结果或开始新对局。",
    mate: "这步可以将杀，对方的王没有合法的脱身办法。", capture: "这步可以吃子，走之前再检查对方能否反吃。",
    check: "这步可以将军，接着看看对方能怎样应对。", quiet: "可以考虑这步，再检查对方的将军、吃子和威胁。",
    plan: ["先检查双方王的安全。", "再计算将军、吃子和威胁。", "落子前确认对方最有力的应对。"]
  },
  en: {
    invalid: "This position is invalid. Please start a new game.", ended: "This game is over. View the result or start a new game.",
    mate: "This move delivers checkmate: the opposing king has no legal escape.", capture: "This move captures a piece. Check whether your opponent can recapture.",
    check: "This move gives check. Look at how your opponent can respond.", quiet: "Consider this move, then check your opponent's checks, captures, and threats.",
    plan: ["Check both kings' safety first.", "Calculate checks, captures, and threats.", "Before moving, find your opponent's strongest reply."]
  },
  ja: {
    invalid: "局面が正しくありません。新しい対局を始めてください。", ended: "対局は終了しています。結果を確認するか、新しい対局を始めましょう。",
    mate: "この手はチェックメイトです。相手のキングには合法な逃げ道がありません。", capture: "この手は駒を取ります。相手に取り返されないか確認しましょう。",
    check: "この手はチェックです。相手の応手も考えましょう。", quiet: "この手を候補にして、相手のチェック、駒取り、脅威を確認しましょう。",
    plan: ["まず両方のキングの安全を確認しましょう。", "チェック、駒取り、脅威を読みましょう。", "指す前に相手の最も強い応手を探しましょう。"]
  },
  fr: {
    invalid: "Cette position est invalide. Commencez une nouvelle partie.", ended: "La partie est terminée. Consultez le résultat ou commencez une nouvelle partie.",
    mate: "Ce coup fait échec et mat : le roi adverse n'a aucune issue légale.", capture: "Ce coup prend une pièce. Vérifiez si votre adversaire peut reprendre.",
    check: "Ce coup donne échec. Cherchez les réponses possibles de votre adversaire.", quiet: "Envisagez ce coup, puis vérifiez les échecs, prises et menaces de votre adversaire.",
    plan: ["Vérifiez d'abord la sécurité des deux rois.", "Calculez les échecs, les prises et les menaces.", "Avant de jouer, cherchez la meilleure réponse adverse."]
  },
  es: {
    invalid: "Esta posición no es válida. Empieza una partida nueva.", ended: "La partida ha terminado. Consulta el resultado o empieza una nueva partida.",
    mate: "Esta jugada da jaque mate: el rey rival no tiene ninguna salida legal.", capture: "Esta jugada captura una pieza. Comprueba si tu rival puede recapturar.",
    check: "Esta jugada da jaque. Busca las posibles respuestas de tu rival.", quiet: "Considera esta jugada y revisa los jaques, capturas y amenazas de tu rival.",
    plan: ["Comprueba primero la seguridad de ambos reyes.", "Calcula jaques, capturas y amenazas.", "Antes de jugar, busca la respuesta más fuerte de tu rival."]
  }
};

export const chessCopy = (language: ChessLanguage = "zh") => copy[language];
