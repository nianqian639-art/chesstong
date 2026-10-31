// 棋童 - Shared JavaScript Library
const LANGS = {
  zh: { label: "中文", html: "zh-CN" },
  en: { label: "English", html: "en" },
  ja: { label: "日本語", html: "ja" },
  fr: { label: "Français", html: "fr" },
  es: { label: "Español", html: "es" },
};

const I18N = {
  zh: {
    brand: "棋童",
    appTitle: "棋童 - 训练中心",
    siteTitle: "棋童 - 国际象棋在线学习平台",
    home: "首页",
    training: "学习训练",
    features: "功能介绍",
    logout: "退出",
    guide: "使用指南",
    dashboard: "首页",
    learn: "学习",
    practice: "做题",
    battle: "AI对战",
    pvp: "对战",
    arena: "公开赛",
    rankings: "排行",
    friends: "好友",
    class: "班级",
    manage: "管理",
    parent: "家长",
    notLoggedIn: "未登录",
    welcomeBack: "{name}，欢迎回来",
    heroTitleA: "用",
    heroTitleB: "掌握国际象棋",
    heroSubtitle: "从开局原则到残局技巧，从AI对弈到真人PK，一站式的国际象棋学习平台",
    startTraining: "开始训练",
    loginRegister: "登录/注册",
    loginBrand: "登录棋童",
    createAccount: "创建棋童账号",
    login: "登录",
    register: "注册",
    account: "账号",
    phone: "手机号 / 国际号码",
    password: "密码",
    nickname: "昵称",
    role: "角色",
    student: "学生",
    parentRole: "家长",
    teacher: "老师",
    registerStart: "注册并开始",
    loggingIn: "登录中...",
    registering: "注册中...",
    loginSuccess: "成功！跳转到训练页面...",
    learningCenter: "学习中心",
    practiceCenter: "题库训练",
    aiBattle: "AI对战",
    pvpBattle: "双人对战",
    arenaTitle: "公开赛",
    rankingTitle: "排行榜",
    friendTitle: "好友",
    parentCenter: "家长中心",
    classManagement: "班级管理",
    myClass: "我的班级",
    bindParent: "绑定家长",
    voiceTitle: "语音讲解设置",
    voiceUnsupported: "当前浏览器暂不支持语音朗读。",
    voiceNote: "云端角色音色需要服务器配置语音 Key；云端暂不可用时会尝试使用当前语言的本机音色。",
    voiceCloudFallback: "云端角色音色暂不可用，已切换为当前语言的本机语音。",
    sessionExpired: "登录状态已过期，请重新登录。登录后会回到刚才的页面。",
    voiceStyle: "讲解风格",
    systemVoice: "系统音色",
    autoVoice: "自动选择当前语言音色",
    voiceLocalUnavailable: "本机没有安装当前语言的语音，请安装系统语音后重试。",
    voiceRate: "语速",
    voiceNatural: "自然度",
    testVoice: "试听",
    testSound: "试听音效",
    storySister: "憨厚熊哥哥",
    childPlayer: "软萌小猪妹",
    energyBuddy: "元气小队长",
    patientCoach: "呆萌机器人",
    storyHint: "憨厚温和的大熊哥哥，慢悠悠地给你讲故事。",
    childHint: "奶声奶气的小猪妹，软糯又可爱。",
    buddyHint: "元气满满的小队长，做题后为你加油。",
    coachHint: "带点科技感的呆萌机器人，陪你分析复盘。",
    monkeyKing: "猴哥",
    monkeyHint: "经典猴哥，活泼有精神，带点戏剧腔。",
    rankRules: "段位规则",
    pointSources: "积分来源",
    rankRulesText: "兵 0-99 · 骑士 100-299 · 主教 300-599 · 战车 600-999 · 皇后 1000-1499 · 国王 1500+",
    pointSourcesText: "做题答对 +10；对局结束 +20。后续可以继续加入连续练习、作业完成、公开赛奖励。",
    rankProgress: "段位进度",
    points: "分",
    nextRank: "距离 {rank} 还差 {points} 分",
    topRank: "已经达到最高段位",
    answerCorrect: "做题答对 +10",
    gameOverPoints: "对局结束 +20",
    progress: "进度 {progress}%",
    dailyMissions: "每日任务",
    dailyMissionsUpdated: "{date} 自动更新。做完一项就会打勾，还能领积分。",
    refresh: "刷新",
    missionLoginName: "每日登录",
    missionLoginDescription: "每天登录一次",
    missionTrainingName: "今日训练",
    missionTrainingDescription: "完成 {count} 道题",
    missionBattleName: "实战练习",
    missionBattleDescription: "完成 {count} 局人机对战",
    missionReward: "奖励 {points} 分",
    missionCompleted: "已完成",
    missionInProgress: "进行中",
    missionClaim: "领 {points} 分",
    dailyMissionsEmpty: "今天还没有任务，稍后再来看看。",
    dailyMissionsLoading: "⏳ 正在加载今天的任务...",
    dailyMissionsLoadFailed: "加载任务失败：{message}",
    speak: "朗读",
    stop: "停止",
    noSpeechContent: "没有可朗读的内容",
    speechNotSupported: "当前浏览器不支持语音朗读",
    sampleVoice: "嘿，小棋手，这一步走得不错！我们一起看看棋盘上还有什么精彩的变化。",
    footer: "棋童 · 国际象棋在线学习平台 · 让每个人都能学会下棋",
  },
  en: {
    brand: "Chesstong",
    appTitle: "Chesstong - Training Center",
    siteTitle: "Chesstong - Online Chess Learning Platform",
    home: "Home", training: "Training", features: "Features", logout: "Log out", guide: "Guide",
    dashboard: "Home", learn: "Learn", practice: "Practice", battle: "AI Battle", pvp: "Battle", arena: "Arena", rankings: "Rankings", friends: "Friends", class: "Class", manage: "Manage", parent: "Parent", notLoggedIn: "Not signed in",
    welcomeBack: "Welcome back, {name}", heroTitleA: "Master chess with ", heroTitleB: "", heroSubtitle: "A one-stop chess learning platform from openings to endgames, AI games, and real matches.",
    startTraining: "Start Training", loginRegister: "Log in / Sign up", loginBrand: "Log in to Chesstong", createAccount: "Create a Chesstong account", login: "Log in", register: "Sign up", account: "Account", phone: "Phone / international number", password: "Password", nickname: "Nickname", role: "Role", student: "Student", parentRole: "Parent", teacher: "Teacher", registerStart: "Sign up and start", loggingIn: "Logging in...", registering: "Signing up...", loginSuccess: "Success! Redirecting...",
    learningCenter: "Learning Center", practiceCenter: "Puzzle Training", aiBattle: "AI Battle", pvpBattle: "Two-player Battle", arenaTitle: "Arena", rankingTitle: "Rankings", friendTitle: "Friends", parentCenter: "Parent Center", classManagement: "Class Management", myClass: "My Class", bindParent: "Bind Parent",
    voiceTitle: "Voice Explanation Settings", voiceUnsupported: "Speech is not supported in this browser.", voiceNote: "Cloud character voices require a server-side speech key. If unavailable, the app tries a local voice in the current language.", voiceCloudFallback: "Cloud character voice is unavailable; switched to a local voice for this language.", voiceLocalUnavailable: "No local voice is installed for this language. Install one in your system settings and try again.", sessionExpired: "Your session expired. Sign in again to return to the page you were using.", voiceStyle: "Style", systemVoice: "Browser voice for this language", autoVoice: "Choose a voice for the current language", voiceRate: "Speed", voiceNatural: "Naturalness", testVoice: "Preview", testSound: "Sound",
    storySister: "Gentle Bear", childPlayer: "Cute Piggy", energyBuddy: "Cheer Captain", patientCoach: "Robot Coach", monkeyKing: "Monkey King", storyHint: "A warm, gentle bear telling stories at an easy pace.", childHint: "An adorable little piggy with a soft, sweet voice.", buddyHint: "An energetic captain cheering you on after each puzzle.", coachHint: "A techy robot buddy for analysis and reviews.", monkeyHint: "A classic Monkey King, lively and theatrical.",
    rankRules: "Rank Rules", pointSources: "Point Sources", rankRulesText: "Pawn 0-99 · Knight 100-299 · Bishop 300-599 · Rook 600-999 · Queen 1000-1499 · King 1500+", pointSourcesText: "Correct puzzle +10; finished game +20. Streaks, homework, and arena bonuses can be added later.", rankProgress: "Rank Progress", points: "pts", nextRank: "{points} pts to {rank}", topRank: "Top rank reached", answerCorrect: "Correct puzzle +10", gameOverPoints: "Finished game +20", progress: "Progress {progress}%", dailyMissions: "Daily Missions", dailyMissionsUpdated: "Updated automatically on {date}. Complete a mission to earn points.", refresh: "Refresh", missionLoginName: "Daily Login", missionLoginDescription: "Log in once per day", missionTrainingName: "Today's Training", missionTrainingDescription: "Complete {count} puzzles", missionBattleName: "Battle Practice", missionBattleDescription: "Complete {count} AI game", missionReward: "Reward {points} pts", missionCompleted: "Completed", missionInProgress: "In progress", missionClaim: "Claim {points} pts", dailyMissionsEmpty: "There are no missions for today. Please check back later.", dailyMissionsLoading: "⏳ Loading today's missions...", dailyMissionsLoadFailed: "Failed to load missions: {message}", speak: "Speak", stop: "Stop", noSpeechContent: "No text to speak", speechNotSupported: "Speech is not supported in this browser.", sampleVoice: "Hello, this is Chesstong. I will slow down and explain chess in words that are easier to understand.", footer: "Chesstong · Online Chess Learning Platform · Helping everyone learn chess",
  },
  ja: {
    brand: "棋童", appTitle: "棋童 - トレーニングセンター", siteTitle: "棋童 - オンラインチェス学習プラットフォーム",
    home: "ホーム", training: "学習", features: "機能", logout: "ログアウト", guide: "ガイド",
    dashboard: "ホーム", learn: "学ぶ", practice: "練習", battle: "AI対局", pvp: "対局", arena: "アリーナ", rankings: "ランキング", friends: "友達", class: "クラス", manage: "管理", parent: "保護者", notLoggedIn: "未ログイン",
    welcomeBack: "{name}さん、おかえりなさい", heroTitleA: "", heroTitleB: "でチェスを学ぼう", heroSubtitle: "序盤から終盤、AI対局、実戦まで学べるチェス学習プラットフォームです。",
    startTraining: "練習を始める", loginRegister: "ログイン/登録", loginBrand: "棋童にログイン", createAccount: "棋童アカウント作成", login: "ログイン", register: "登録", account: "アカウント", phone: "電話番号 / 国際番号", password: "パスワード", nickname: "ニックネーム", role: "役割", student: "生徒", parentRole: "保護者", teacher: "先生", registerStart: "登録して開始", loggingIn: "ログイン中...", registering: "登録中...", loginSuccess: "成功しました。移動します...",
    learningCenter: "学習センター", practiceCenter: "問題練習", aiBattle: "AI対局", pvpBattle: "二人対局", arenaTitle: "アリーナ", rankingTitle: "ランキング", friendTitle: "友達", parentCenter: "保護者センター", classManagement: "クラス管理", myClass: "マイクラス", bindParent: "保護者連携",
    voiceTitle: "音声説明設定", voiceUnsupported: "このブラウザは音声読み上げに対応していません。", voiceNote: "クラウドのキャラクター音声にはサーバー側の音声キーが必要です。利用できない場合は現在の言語の端末音声を試します。", voiceCloudFallback: "クラウド音声を利用できないため、この言語の端末音声に切り替えました。", voiceLocalUnavailable: "この言語の端末音声がありません。システムに音声をインストールして再試行してください。", sessionExpired: "ログインの有効期限が切れました。再ログイン後、使用中のページに戻ります。", voiceStyle: "説明スタイル", systemVoice: "この言語のブラウザー音声", autoVoice: "現在の言語の音声を自動選択", voiceRate: "速度", voiceNatural: "自然さ", testVoice: "試聴", testSound: "効果音",
    storySister: "やさしいクマのお兄さん", childPlayer: "かわいい子ブタちゃん", energyBuddy: "元気な小隊長", patientCoach: "おちゃめロボット", monkeyKing: "おさるの兄ちゃん", storyHint: "温かくやさしいクマが、ゆっくりお話しします。", childHint: "甘くてかわいい子ブタの声。", buddyHint: "元気いっぱいの小隊長が応援します。", coachHint: "テクノっぽいロボットが分析や復習を担当します。", monkeyHint: "定番のサル兄ちゃん、元気で芝居がかった声。",
    rankRules: "ランク規則", pointSources: "ポイント", rankRulesText: "ポーン 0-99 · ナイト 100-299 · ビショップ 300-599 · ルーク 600-999 · クイーン 1000-1499 · キング 1500+", pointSourcesText: "正解 +10、対局終了 +20。連続練習や宿題報酬も追加できます。", rankProgress: "ランク進捗", points: "点", nextRank: "{rank}まであと{points}点", topRank: "最高ランクです", answerCorrect: "正解 +10", gameOverPoints: "対局終了 +20", progress: "進捗 {progress}%", dailyMissions: "デイリーミッション", dailyMissionsUpdated: "{date}に自動更新。達成するとポイントを受け取れます。", refresh: "更新", missionLoginName: "毎日ログイン", missionLoginDescription: "1日1回ログイン", missionTrainingName: "今日のトレーニング", missionTrainingDescription: "問題を{count}問解く", missionBattleName: "実戦練習", missionBattleDescription: "AI対局を{count}局完了", missionReward: "報酬 {points}点", missionCompleted: "完了", missionInProgress: "進行中", missionClaim: "{points}点を受け取る", dailyMissionsEmpty: "今日のミッションはありません。後でもう一度確認してください。", dailyMissionsLoading: "⏳ 今日のミッションを読み込み中...", dailyMissionsLoadFailed: "ミッションの読み込みに失敗しました：{message}", speak: "再生", stop: "停止", noSpeechContent: "読み上げる内容がありません", speechNotSupported: "このブラウザは音声に対応していません。", sampleVoice: "こんにちは、棋童です。ゆっくり、わかりやすい言葉でチェスを説明します。", footer: "棋童 · オンラインチェス学習プラットフォーム",
  },
  fr: {
    brand: "Chesstong", appTitle: "Chesstong - Centre d'entraînement", siteTitle: "Chesstong - Plateforme d'apprentissage des échecs",
    home: "Accueil", training: "Entraînement", features: "Fonctions", logout: "Quitter", guide: "Guide",
    dashboard: "Accueil", learn: "Apprendre", practice: "Exercices", battle: "IA", pvp: "Duel", arena: "Tournoi", rankings: "Classement", friends: "Amis", class: "Classe", manage: "Gestion", parent: "Parents", notLoggedIn: "Non connecté",
    welcomeBack: "Bon retour, {name}", heroTitleA: "Apprendre les échecs avec ", heroTitleB: "", heroSubtitle: "Une plateforme complète pour apprendre les ouvertures, les finales, jouer contre l'IA et progresser.",
    startTraining: "Commencer", loginRegister: "Connexion / Inscription", loginBrand: "Connexion à Chesstong", createAccount: "Créer un compte Chesstong", login: "Connexion", register: "Inscription", account: "Compte", phone: "Téléphone / numéro international", password: "Mot de passe", nickname: "Pseudo", role: "Rôle", student: "Élève", parentRole: "Parent", teacher: "Professeur", registerStart: "S'inscrire et commencer", loggingIn: "Connexion...", registering: "Inscription...", loginSuccess: "Succès ! Redirection...",
    learningCenter: "Centre d'apprentissage", practiceCenter: "Exercices", aiBattle: "Partie IA", pvpBattle: "Duel à deux", arenaTitle: "Tournoi", rankingTitle: "Classement", friendTitle: "Amis", parentCenter: "Espace parents", classManagement: "Gestion de classe", myClass: "Ma classe", bindParent: "Lier un parent",
    voiceTitle: "Réglages de voix", voiceUnsupported: "La synthèse vocale n'est pas prise en charge.", voiceNote: "Les voix cloud nécessitent une clé configurée sur le serveur. En cas d'indisponibilité, une voix locale dans la langue choisie sera essayée.", voiceCloudFallback: "La voix cloud est indisponible ; une voix locale dans cette langue a été sélectionnée.", voiceLocalUnavailable: "Aucune voix locale n'est installée pour cette langue. Installez-la dans les réglages système puis réessayez.", sessionExpired: "Votre session a expiré. Reconnectez-vous pour revenir à la page utilisée.", voiceStyle: "Style", systemVoice: "Voix du navigateur dans cette langue", autoVoice: "Choisir une voix pour la langue actuelle", voiceRate: "Vitesse", voiceNatural: "Naturel", testVoice: "Essayer", testSound: "Son",
    storySister: "Ourson doux", childPlayer: "Petit cochon mignon", energyBuddy: "Capitaine motivé", patientCoach: "Robot coach", monkeyKing: "Roi singe", storyHint: "Un ours chaleureux et doux qui raconte à un rythme calme.", childHint: "Un petit cochon adorable à la voix douce.", buddyHint: "Un capitaine énergique qui t'encourage après chaque exercice.", coachHint: "Un robot techy pour analyser et réviser.", monkeyHint: "Un singe classique, vif et théâtral.",
    rankRules: "Règles de rang", pointSources: "Points", rankRulesText: "Pion 0-99 · Cavalier 100-299 · Fou 300-599 · Tour 600-999 · Dame 1000-1499 · Roi 1500+", pointSourcesText: "Exercice correct +10 ; partie terminée +20. Séries, devoirs et bonus pourront être ajoutés.", rankProgress: "Progression", points: "pts", nextRank: "{points} pts avant {rank}", topRank: "Rang maximal atteint", answerCorrect: "Exercice correct +10", gameOverPoints: "Partie terminée +20", progress: "Progression {progress}%", dailyMissions: "Missions quotidiennes", dailyMissionsUpdated: "Mise à jour automatique le {date}. Terminez une mission pour gagner des points.", refresh: "Actualiser", missionLoginName: "Connexion quotidienne", missionLoginDescription: "Se connecter une fois par jour", missionTrainingName: "Entraînement du jour", missionTrainingDescription: "Terminer {count} exercices", missionBattleName: "Entraînement en partie", missionBattleDescription: "Terminer {count} partie contre l'IA", missionReward: "Récompense {points} pts", missionCompleted: "Terminé", missionInProgress: "En cours", missionClaim: "Recevoir {points} pts", dailyMissionsEmpty: "Aucune mission aujourd'hui. Revenez plus tard.", dailyMissionsLoading: "⏳ Chargement des missions du jour...", dailyMissionsLoadFailed: "Échec du chargement des missions : {message}", speak: "Lire", stop: "Stop", noSpeechContent: "Aucun texte à lire", speechNotSupported: "Synthèse vocale non prise en charge.", sampleVoice: "Bonjour, c'est Chesstong. Je vais parler plus lentement et expliquer les échecs avec des mots simples.", footer: "Chesstong · Plateforme d'apprentissage des échecs",
  },
  es: {
    brand: "Chesstong", appTitle: "Chesstong - Centro de entrenamiento", siteTitle: "Chesstong - Plataforma online para aprender ajedrez",
    home: "Inicio", training: "Entrenar", features: "Funciones", logout: "Salir", guide: "Guía",
    dashboard: "Inicio", learn: "Aprender", practice: "Ejercicios", battle: "IA", pvp: "Duelo", arena: "Torneo", rankings: "Ranking", friends: "Amigos", class: "Clase", manage: "Gestionar", parent: "Padres", notLoggedIn: "Sin sesión",
    welcomeBack: "Bienvenido de nuevo, {name}", heroTitleA: "Aprende ajedrez con ", heroTitleB: "", heroSubtitle: "Una plataforma completa para aperturas, finales, partidas contra IA y práctica real.",
    startTraining: "Empezar", loginRegister: "Entrar / Registrarse", loginBrand: "Entrar a Chesstong", createAccount: "Crear cuenta Chesstong", login: "Entrar", register: "Registrarse", account: "Cuenta", phone: "Teléfono / número internacional", password: "Contraseña", nickname: "Apodo", role: "Rol", student: "Estudiante", parentRole: "Padre/Madre", teacher: "Profesor", registerStart: "Registrarse y empezar", loggingIn: "Entrando...", registering: "Registrando...", loginSuccess: "¡Listo! Redirigiendo...",
    learningCenter: "Centro de aprendizaje", practiceCenter: "Ejercicios", aiBattle: "Partida IA", pvpBattle: "Duelo de dos", arenaTitle: "Torneo", rankingTitle: "Ranking", friendTitle: "Amigos", parentCenter: "Centro para padres", classManagement: "Gestión de clase", myClass: "Mi clase", bindParent: "Vincular padre",
    voiceTitle: "Ajustes de voz", voiceUnsupported: "Este navegador no soporta voz.", voiceNote: "Las voces en la nube requieren una clave configurada en el servidor. Si no están disponibles, se probará una voz local del idioma actual.", voiceCloudFallback: "La voz en la nube no está disponible; se cambió a una voz local de este idioma.", voiceLocalUnavailable: "No hay una voz local instalada para este idioma. Instálala en los ajustes del sistema y vuelve a intentarlo.", sessionExpired: "Tu sesión ha caducado. Inicia sesión otra vez para volver a la página que estabas usando.", voiceStyle: "Estilo", systemVoice: "Voz del navegador para este idioma", autoVoice: "Elegir una voz para el idioma actual", voiceRate: "Velocidad", voiceNatural: "Naturalidad", testVoice: "Probar", testSound: "Sonido",
    storySister: "Osito tierno", childPlayer: "Cerdito lindo", energyBuddy: "Capitán animado", patientCoach: "Robot entrenador", monkeyKing: "Rey mono", storyHint: "Un oso cálido y suave que cuenta historias con calma.", childHint: "Un cerdito adorable con voz dulce.", buddyHint: "Un capitán lleno de energía que te anima tras cada ejercicio.", coachHint: "Un robot con toque tecnológico para analizar y repasar.", monkeyHint: "Un mono clásico, vivaz y teatral.",
    rankRules: "Reglas de nivel", pointSources: "Puntos", rankRulesText: "Peón 0-99 · Caballo 100-299 · Alfil 300-599 · Torre 600-999 · Dama 1000-1499 · Rey 1500+", pointSourcesText: "Ejercicio correcto +10; partida terminada +20. Luego se pueden añadir rachas, tareas y torneos.", rankProgress: "Progreso", points: "pts", nextRank: "{points} pts para {rank}", topRank: "Nivel máximo alcanzado", answerCorrect: "Ejercicio correcto +10", gameOverPoints: "Partida terminada +20", progress: "Progreso {progress}%", dailyMissions: "Misiones diarias", dailyMissionsUpdated: "Se actualiza automáticamente el {date}. Completa una misión para ganar puntos.", refresh: "Actualizar", missionLoginName: "Inicio de sesión diario", missionLoginDescription: "Inicia sesión una vez al día", missionTrainingName: "Entrenamiento de hoy", missionTrainingDescription: "Completa {count} ejercicios", missionBattleName: "Práctica de partida", missionBattleDescription: "Completa {count} partida contra la IA", missionReward: "Recompensa {points} pts", missionCompleted: "Completada", missionInProgress: "En curso", missionClaim: "Reclamar {points} pts", dailyMissionsEmpty: "No hay misiones para hoy. Vuelve más tarde.", dailyMissionsLoading: "⏳ Cargando las misiones de hoy...", dailyMissionsLoadFailed: "No se pudieron cargar las misiones: {message}", speak: "Leer", stop: "Parar", noSpeechContent: "No hay texto para leer", speechNotSupported: "El navegador no soporta voz.", sampleVoice: "Hola, soy Chesstong. Hablaré más despacio y explicaré ajedrez con palabras fáciles.", footer: "Chesstong · Plataforma online para aprender ajedrez",
  },
};

// App screens that are rendered dynamically use these keys in addition to the shared site copy above.
// English is deliberately the fallback for a missing non-Chinese translation so a language switch never exposes Chinese UI.
const APP_COPY = {
  zh: { practiceLoad:"📥 载入题库", nextProblem:"下一题→", hint:"💡提示", practiceClick:"👆 点击棋盘上的棋子，再点目标格走棋", practiceInput:"或手动输入走法，如 e2e4", submit:"提交", loadFirst:"请先载入题库", battleTitle:"♛ AI 对战 · 棋子专项训练", teachingMode:"简单陪练", standardMode:"标准对战", start:"开始", suggest:"💡建议", review:"📋复盘", battleInput:"输入走法，比如 e2e4，或者直接点棋盘走棋", move:"走棋", ready:"准备开始", moveHistoryEmpty:"这里会显示完整走子记录", analysisEmpty:"这里会显示 AI 建议、复盘和讲解", battleTier:"{tier}档训练", battleTierHint:"根据当前档位选择适合的 AI 训练强度。", modeTeachingActive:"当前是简单陪练模式。", modeStandardActive:"当前是标准对战模式。", battleStarted:"对局开始啦。你先走白棋，当前难度是 {level}。", battleGuide:"对局开始后，你可以点击“建议”看 AI 小教练提示，或者点击“复盘”看整盘总结。", invalidMove:"非法走子", noMove:"无", battleMoveStatus:"你刚才走了 {player}。\nAI 回应 {engine}。", battleFinished:"对局结束！+20分", battleContinue:"继续观察棋盘，看看下一步有没有更好的吃子或将军机会。", inputMove:"输入走法或点击棋盘走棋", aiSuggestion:"🤖 AI 小教练建议", trainingTier:"当前训练档位", engineSource:"引擎来源", generalSuggestion:"先看看能不能吃子、将军，或者把棋子走到更安全的位置。", reviewTitle:"📋 对局复盘", keyMoves:"关键着法", noKeyMoves:"暂时还没有关键着法", noGameData:"这一盘还没有足够走子，先多下一会儿再来复盘。", moveNumber:"第{number}手 {move}", puzzleCount:"共 {count} 题" },
  en: { practiceLoad:"📥 Load puzzles", nextProblem:"Next →", hint:"💡 Hint", practiceClick:"👆 Select a piece, then select its destination square", practiceInput:"Or enter a move, e.g. e2e4", submit:"Submit", loadFirst:"Load the puzzles first", battleTitle:"♛ AI Battle · Piece Training", teachingMode:"Guided practice", standardMode:"Standard battle", start:"Start", suggest:"💡 Suggest", review:"📋 Review", battleInput:"Enter a move, e.g. e2e4, or use the board", move:"Move", ready:"Ready to begin", moveHistoryEmpty:"Your complete move history will appear here", analysisEmpty:"AI suggestions, reviews, and explanations will appear here", battleTier:"Training tier {tier}", battleTierHint:"Choose an AI strength that matches this training tier.", modeTeachingActive:"Guided-practice mode is active.", modeStandardActive:"Standard-battle mode is active.", battleStarted:"The game has started. You play White at {level}.", battleGuide:"After the game starts, use Suggest for a coaching tip or Review for a summary.", invalidMove:"Illegal move", noMove:"none", battleMoveStatus:"You played {player}.\nAI replied {engine}.", battleFinished:"Game over! +20 pts", battleContinue:"Check the board for stronger captures or checks on your next move.", inputMove:"Enter a move or use the board", aiSuggestion:"🤖 AI coach suggestion", trainingTier:"Training tier", engineSource:"Engine source", generalSuggestion:"Look for checks, captures, or a safer square for your piece.", reviewTitle:"📋 Game review", keyMoves:"Key moves", noKeyMoves:"There are no key moves yet", noGameData:"There are not enough moves to review this game yet.", moveNumber:"Move {number}: {move}", puzzleCount:"{count} puzzles" },
  ja: { practiceLoad:"📥 問題を読み込む", nextProblem:"次の問題 →", hint:"💡 ヒント", practiceClick:"👆 駒を選んでから、移動先のマスを選択します", practiceInput:"または手を入力（例: e2e4）", submit:"送信", loadFirst:"まず問題を読み込んでください", battleTitle:"♛ AI対局・駒別トレーニング", teachingMode:"やさしい練習", standardMode:"標準対局", start:"開始", suggest:"💡 提案", review:"📋 振り返り", battleInput:"手を入力（例: e2e4）するか、盤上で指してください", move:"指す", ready:"開始準備完了", moveHistoryEmpty:"ここに対局の全手順が表示されます", analysisEmpty:"AIの提案、振り返り、解説がここに表示されます", battleTier:"トレーニングレベル {tier}", battleTierHint:"このレベルに合ったAIの強さを選びます。", modeTeachingActive:"やさしい練習モードです。", modeStandardActive:"標準対局モードです。", battleStarted:"対局開始です。あなたは白番、難易度は{level}です。", battleGuide:"対局開始後、「提案」でヒント、「振り返り」で対局のまとめを見られます。", invalidMove:"その手は指せません", noMove:"なし", battleMoveStatus:"あなたの手：{player}\nAIの応手：{engine}", battleFinished:"対局終了！+20点", battleContinue:"次の手では、より良い取りやチェックがないか盤面を確認しましょう。", inputMove:"手を入力するか、盤上で指してください", aiSuggestion:"🤖 AIコーチの提案", trainingTier:"トレーニングレベル", engineSource:"エンジン", generalSuggestion:"チェック、駒取り、またはより安全なマスを探しましょう。", reviewTitle:"📋 対局の振り返り", keyMoves:"重要な手", noKeyMoves:"重要な手はまだありません", noGameData:"この対局はまだ手数が足りず、振り返りできません。", moveNumber:"{number}手目 {move}", puzzleCount:"{count}問" },
  fr: { practiceLoad:"📥 Charger les exercices", nextProblem:"Suivant →", hint:"💡 Indice", practiceClick:"👆 Sélectionnez une pièce, puis sa case d'arrivée", practiceInput:"Ou saisissez un coup, par ex. e2e4", submit:"Envoyer", loadFirst:"Chargez d'abord les exercices", battleTitle:"♛ Partie IA · Entraînement par pièce", teachingMode:"Entraînement guidé", standardMode:"Partie standard", start:"Commencer", suggest:"💡 Conseil", review:"📋 Analyse", battleInput:"Saisissez un coup, par ex. e2e4, ou utilisez l'échiquier", move:"Jouer", ready:"Prêt à commencer", moveHistoryEmpty:"L'historique complet des coups s'affichera ici", analysisEmpty:"Conseils, analyses et explications de l'IA s'afficheront ici", battleTier:"Niveau d'entraînement {tier}", battleTierHint:"Choisissez une force d'IA adaptée à ce niveau.", modeTeachingActive:"Mode entraînement guidé actif.", modeStandardActive:"Mode partie standard actif.", battleStarted:"La partie commence. Vous jouez les Blancs au niveau {level}.", battleGuide:"Utilisez Conseil pour une aide de l'IA ou Analyse pour un résumé de la partie.", invalidMove:"Coup illégal", noMove:"aucun", battleMoveStatus:"Vous avez joué {player}.\nL'IA a répondu {engine}.", battleFinished:"Partie terminée ! +20 pts", battleContinue:"Cherchez une meilleure prise ou un échec au prochain coup.", inputMove:"Saisissez un coup ou utilisez l'échiquier", aiSuggestion:"🤖 Conseil du coach IA", trainingTier:"Niveau d'entraînement", engineSource:"Moteur", generalSuggestion:"Cherchez les échecs, les prises ou une case plus sûre.", reviewTitle:"📋 Analyse de la partie", keyMoves:"Coups clés", noKeyMoves:"Aucun coup clé pour le moment", noGameData:"Il n'y a pas encore assez de coups pour analyser cette partie.", moveNumber:"Coup {number} : {move}", puzzleCount:"{count} exercices" },
  es: { practiceLoad:"📥 Cargar ejercicios", nextProblem:"Siguiente →", hint:"💡 Pista", practiceClick:"👆 Selecciona una pieza y luego la casilla de destino", practiceInput:"O escribe una jugada, p. ej. e2e4", submit:"Enviar", loadFirst:"Primero carga los ejercicios", battleTitle:"♛ Partida IA · Entrenamiento por piezas", teachingMode:"Práctica guiada", standardMode:"Partida estándar", start:"Empezar", suggest:"💡 Sugerencia", review:"📋 Análisis", battleInput:"Escribe una jugada, p. ej. e2e4, o usa el tablero", move:"Jugar", ready:"Listo para empezar", moveHistoryEmpty:"Aquí aparecerá el historial completo de jugadas", analysisEmpty:"Aquí aparecerán sugerencias, análisis y explicaciones de la IA", battleTier:"Nivel de entrenamiento {tier}", battleTierHint:"Elige una fuerza de IA adecuada para este nivel.", modeTeachingActive:"El modo de práctica guiada está activo.", modeStandardActive:"El modo de partida estándar está activo.", battleStarted:"La partida ha empezado. Juegas con blancas en {level}.", battleGuide:"Usa Sugerencia para recibir ayuda o Análisis para ver el resumen.", invalidMove:"Jugada ilegal", noMove:"ninguna", battleMoveStatus:"Has jugado {player}.\nLa IA respondió {engine}.", battleFinished:"¡Partida terminada! +20 pts", battleContinue:"Busca mejores capturas o jaques en tu siguiente jugada.", inputMove:"Escribe una jugada o usa el tablero", aiSuggestion:"🤖 Sugerencia del entrenador IA", trainingTier:"Nivel de entrenamiento", engineSource:"Motor", generalSuggestion:"Busca jaques, capturas o una casilla más segura.", reviewTitle:"📋 Análisis de la partida", keyMoves:"Jugadas clave", noKeyMoves:"Todavía no hay jugadas clave", noGameData:"Aún no hay suficientes jugadas para analizar esta partida.", moveNumber:"Jugada {number}: {move}", puzzleCount:"{count} ejercicios" }
};

for (const [lang,names] of Object.entries({zh:["兵","马","象","车","后","王"],en:["Pawn","Knight","Bishop","Rook","Queen","King"],ja:["ポーン","ナイト","ビショップ","ルーク","クイーン","キング"],fr:["Pion","Cavalier","Fou","Tour","Dame","Roi"],es:["Peón","Caballo","Alfil","Torre","Dama","Rey"]})) names.forEach((name,i)=>{I18N[lang]["rank"+(i+1)]=name;});

const LANDING_COPY = {
  "zh": {
    "featureLearn": "开局原则 · 经典开局 · 中局策略 · 残局基础 · 常见陷阱",
    "featurePractice": "精选题目 · AI讲解 · 阶梯难度",
    "featureAi": "Stockfish引擎 · 可调难度 · 建议与复盘",
    "featurePvp": "实时对战 · 多种用时 · 好友邀请",
    "featureArena": "自动匹配对手 · 公平对战 · 积分排名",
    "featureRanks": "积分榜 · 做题榜 · 对战榜 · 段位晋升",
    "featureClasses": "创建班级 · 布置作业 · 公告通知",
    "featureParent": "绑定孩子 · 学习周报 · AI评语 · 学习计划",
    "accountHint": "3–32位字母、数字、下划线或短横线",
    "passwordHint": "至少8位密码",
    "nameHint": "给自己起个名字",
    "playerDefault": "棋手"
  },
  "en": {
    "featureLearn": "Opening principles · Classic openings · Middlegame · Endgames · Traps",
    "featurePractice": "Selected puzzles · AI explanations · Progressive difficulty",
    "featureAi": "Stockfish engine · Adjustable strength · Advice and reviews",
    "featurePvp": "Live games · Time controls · Friend invitations",
    "featureArena": "Automatic pairing · Fair play · Points rankings",
    "featureRanks": "Points · Puzzles · Games · Rank progression",
    "featureClasses": "Create classes · Assign homework · Post announcements",
    "featureParent": "Link children · Weekly reports · AI feedback · Study plans",
    "accountHint": "3–32 letters, digits, underscores or hyphens",
    "passwordHint": "At least 8 characters",
    "nameHint": "Choose a display name",
    "playerDefault": "Player"
  },
  "ja": {
    "featureLearn": "序盤の原則 · 定跡 · 中盤 · 終盤 · トラップ",
    "featurePractice": "厳選問題 · AI解説 · 段階的な難易度",
    "featureAi": "Stockfishエンジン · 強さ調整 · 提案と振り返り",
    "featurePvp": "リアルタイム対局 · 持ち時間 · 友達招待",
    "featureArena": "自動マッチング · 公平な対局 · ポイント順位",
    "featureRanks": "ポイント · 問題 · 対局 · ランク昇格",
    "featureClasses": "クラス作成 · 宿題 · お知らせ",
    "featureParent": "子どもを連携 · 週報 · AIコメント · 学習計画",
    "accountHint": "3〜32文字の英数字、_ または -",
    "passwordHint": "8文字以上",
    "nameHint": "表示名を入力",
    "playerDefault": "プレイヤー"
  },
  "fr": {
    "featureLearn": "Principes d'ouverture · Ouvertures · Milieu de jeu · Finales · Pièges",
    "featurePractice": "Exercices choisis · Explications IA · Difficulté progressive",
    "featureAi": "Moteur Stockfish · Force réglable · Conseils et analyses",
    "featurePvp": "Parties en direct · Cadences · Invitations",
    "featureArena": "Appariement automatique · Jeu équitable · Classements",
    "featureRanks": "Points · Exercices · Parties · Progression",
    "featureClasses": "Créer des classes · Donner des devoirs · Annonces",
    "featureParent": "Lier les enfants · Rapports hebdomadaires · Commentaires IA · Plans d'étude",
    "accountHint": "3 à 32 lettres, chiffres, _ ou -",
    "passwordHint": "Au moins 8 caractères",
    "nameHint": "Choisissez un nom d'affichage",
    "playerDefault": "Joueur"
  },
  "es": {
    "featureLearn": "Principios de apertura · Aperturas · Medio juego · Finales · Trampas",
    "featurePractice": "Ejercicios seleccionados · Explicaciones IA · Dificultad progresiva",
    "featureAi": "Motor Stockfish · Fuerza ajustable · Consejos y análisis",
    "featurePvp": "Partidas en directo · Ritmos · Invitaciones",
    "featureArena": "Emparejamiento automático · Juego limpio · Clasificación",
    "featureRanks": "Puntos · Ejercicios · Partidas · Progreso",
    "featureClasses": "Crear clases · Asignar tareas · Anuncios",
    "featureParent": "Vincular hijos · Informes semanales · Comentarios IA · Planes",
    "accountHint": "De 3 a 32 letras, dígitos, _ o -",
    "passwordHint": "Al menos 8 caracteres",
    "nameHint": "Elige un nombre visible",
    "playerDefault": "Jugador"
  }
};
for(const [lang,copy] of Object.entries(LANDING_COPY)) Object.assign(I18N[lang],copy);

const FAMILY_TASK_COPY = {
  zh: {
    parentTasks:"🟣 家长任务", parentTaskTitle:"任务内容", parentTaskDeadline:"截止时间（北京时间）", parentTaskHelp:"每个孩子最多同时保留5项未完成任务；每项完成后固定奖励10分。", parentTaskStudentHelp:"这是家长布置的任务，与每日任务分开计算。请在截止时间前完成。", assignParentTask:"布置任务", parentTaskActive:"进行中", parentTaskDone:"已完成", parentTaskExpired:"已过期", parentTaskPoints:"奖励 {points} 分", parentTaskDeadlineValue:"截止 {time}", parentTaskMissing:"请选择孩子、填写任务和北京时间截止时间", parentTaskCreated:"家长任务已布置", confirmDeleteTask:"删除这项家长任务？", deleteTask:"删除", completeParentTask:"完成任务", parentTaskReward:"已获得 +{points} 分", planDeadline:"计划截止时间（北京时间）", planDeadlineHelp:"到这个时刻后，孩子端会显示为已过期。", planDeadlineValue:"截止时间：{time}", planExpired:"已过期", reportFocus:"本周重点", reportFocusLine:"活跃 {days} 天 · 周正确率 {accuracy} · 最忙的一天 {best}", weeklySolved:"正确解题", weeklyBattles:"完成对战", weeklyAccuracy:"本周正确率", weeklyPoints:"积分变化", parentTaskTotals:"家长任务 {done}/{total}", reportLifetime:"当前积分 {points}", reportAttempts:"本周答题 {attempts} 次，其中答对 {correct} 次；累计答题 {allAttempts} 次，累计正确率 {allAccuracy}", reportCommentary:"学习点评", reportNoCommentary:"本周暂无 AI 评语。"
  },
  en: {
    parentTasks:"🟣 Parent tasks", parentTaskTitle:"Task", parentTaskDeadline:"Deadline (Beijing)", parentTaskHelp:"Keep at most 5 unfinished tasks per child. Each completed task awards 10 points.", parentTaskStudentHelp:"These tasks are assigned by a parent and are separate from daily missions. Finish them before the deadline.", assignParentTask:"Assign task", parentTaskActive:"Active", parentTaskDone:"Completed", parentTaskExpired:"Expired", parentTaskPoints:"Reward {points} pts", parentTaskDeadlineValue:"Due {time}", parentTaskMissing:"Choose a child, task and Beijing deadline", parentTaskCreated:"Parent task assigned", confirmDeleteTask:"Delete this parent task?", deleteTask:"Delete", completeParentTask:"Complete", parentTaskReward:"You earned +{points} points", planDeadline:"Plan deadline (Beijing)", planDeadlineHelp:"The plan is marked expired for the child after this time.", planDeadlineValue:"Deadline: {time}", planExpired:"Expired", reportFocus:"Weekly focus", reportFocusLine:"Active {days} days · weekly accuracy {accuracy} · busiest day {best}", weeklySolved:"Correct puzzles", weeklyBattles:"Completed games", weeklyAccuracy:"Weekly accuracy", weeklyPoints:"Points change", parentTaskTotals:"Parent tasks {done}/{total}", reportLifetime:"Current points {points}", reportAttempts:"This week: {attempts} attempts, {correct} correct. All time: {allAttempts} attempts, {allAccuracy} accuracy.", reportCommentary:"Coach note", reportNoCommentary:"No AI note was generated this week."
  },
  ja: {
    parentTasks:"🟣 保護者タスク", parentTaskTitle:"タスク内容", parentTaskDeadline:"締切（北京時間）", parentTaskHelp:"子ども1人につき未完了タスクは最大5件。完了ごとに10点です。", parentTaskStudentHelp:"保護者が設定したタスクです。毎日のミッションとは別に、締切までに完了してください。", assignParentTask:"タスクを設定", parentTaskActive:"進行中", parentTaskDone:"完了", parentTaskExpired:"期限切れ", parentTaskPoints:"報酬 {points}点", parentTaskDeadlineValue:"締切 {time}", parentTaskMissing:"子ども・内容・北京時間の締切を入力してください", parentTaskCreated:"保護者タスクを設定しました", confirmDeleteTask:"このタスクを削除しますか？", deleteTask:"削除", completeParentTask:"完了にする", parentTaskReward:"+{points}点を獲得", planDeadline:"計画の締切（北京時間）", planDeadlineHelp:"この時刻を過ぎると子ども側から非表示になります。", planDeadlineValue:"締切：{time}", reportFocus:"今週の重点", reportFocusLine:"活動 {days}日 · 週間正答率 {accuracy} · 最も多かった日 {best}", weeklySolved:"正解問題", weeklyBattles:"完了した対局", weeklyAccuracy:"週間正答率", weeklyPoints:"ポイント変化", parentTaskTotals:"保護者タスク {done}/{total}", reportLifetime:"現在のポイント {points}", reportAttempts:"今週の回答 {attempts}回（正解 {correct}回）。累計 {allAttempts}回、正答率 {allAccuracy}。", reportCommentary:"学習コメント", reportNoCommentary:"今週のAIコメントはありません。"
  },
  fr: {
    parentTasks:"🟣 Tâches parentales", parentTaskTitle:"Tâche", parentTaskDeadline:"Échéance (heure de Pékin)", parentTaskHelp:"Jusqu’à 5 tâches non terminées par enfant. Chaque tâche terminée vaut 10 points.", parentTaskStudentHelp:"Ces tâches sont données par un parent et séparées des missions quotidiennes. Terminez-les avant l’échéance.", assignParentTask:"Donner la tâche", parentTaskActive:"En cours", parentTaskDone:"Terminée", parentTaskExpired:"Expirée", parentTaskPoints:"Récompense {points} pts", parentTaskDeadlineValue:"Échéance {time}", parentTaskMissing:"Choisissez l’enfant, la tâche et une échéance de Pékin", parentTaskCreated:"Tâche parentale créée", confirmDeleteTask:"Supprimer cette tâche ?", deleteTask:"Supprimer", completeParentTask:"Terminer", parentTaskReward:"+{points} points obtenus", planDeadline:"Échéance du plan (heure de Pékin)", planDeadlineHelp:"Le plan disparaît côté enfant après cette heure.", planDeadlineValue:"Échéance : {time}", reportFocus:"Point fort de la semaine", reportFocusLine:"Actif {days} jours · réussite {accuracy} · jour le plus chargé {best}", weeklySolved:"Exercices réussis", weeklyBattles:"Parties terminées", weeklyAccuracy:"Réussite de la semaine", weeklyPoints:"Variation des points", parentTaskTotals:"Tâches parentales {done}/{total}", reportLifetime:"Points actuels : {points}", reportAttempts:"Cette semaine : {attempts} essais, {correct} corrects. Au total : {allAttempts} essais, {allAccuracy} de réussite.", reportCommentary:"Commentaire pédagogique", reportNoCommentary:"Aucun commentaire IA cette semaine."
  },
  es: {
    parentTasks:"🟣 Tareas de padres", parentTaskTitle:"Tarea", parentTaskDeadline:"Plazo (hora de Pekín)", parentTaskHelp:"Máximo 5 tareas sin terminar por niño. Cada tarea completada da 10 puntos.", parentTaskStudentHelp:"Son tareas asignadas por un padre y separadas de las misiones diarias. Termínalas antes del plazo.", assignParentTask:"Asignar tarea", parentTaskActive:"Activa", parentTaskDone:"Completada", parentTaskExpired:"Vencida", parentTaskPoints:"Recompensa {points} pts", parentTaskDeadlineValue:"Plazo {time}", parentTaskMissing:"Elige un niño, una tarea y un plazo de Pekín", parentTaskCreated:"Tarea asignada", confirmDeleteTask:"¿Eliminar esta tarea?", deleteTask:"Eliminar", completeParentTask:"Completar", parentTaskReward:"Has ganado +{points} puntos", planDeadline:"Plazo del plan (hora de Pekín)", planDeadlineHelp:"El plan se oculta al niño después de esta hora.", planDeadlineValue:"Plazo: {time}", reportFocus:"Enfoque semanal", reportFocusLine:"Activo {days} días · acierto semanal {accuracy} · día más activo {best}", weeklySolved:"Ejercicios correctos", weeklyBattles:"Partidas completadas", weeklyAccuracy:"Acierto semanal", weeklyPoints:"Cambio de puntos", parentTaskTotals:"Tareas de padres {done}/{total}", reportLifetime:"Puntos actuales: {points}", reportAttempts:"Esta semana: {attempts} intentos, {correct} correctos. Total: {allAttempts} intentos, {allAccuracy} de aciertos.", reportCommentary:"Comentario de aprendizaje", reportNoCommentary:"No se generó un comentario de IA esta semana."
  }
};
for (const [lang, copy] of Object.entries(FAMILY_TASK_COPY)) Object.assign(I18N[lang], copy);

function getLang() {
  return localStorage.getItem("ct_lang") || "zh";
}

function setLang(lang) {
  localStorage.setItem("ct_lang", I18N[lang] ? lang : "zh");
  applyI18n();
  if (typeof refreshI18n === "function") refreshI18n();
}

function t(key, vars = {}) {
  const dict = I18N[getLang()] || I18N.zh;
  let text = dict[key] || APP_COPY[getLang()]?.[key] || APP_COPY.en[key] || I18N.zh[key] || key;
  Object.entries(vars).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, String(v)); });
  return text;
}

function langSelector() {
  return `<select class="lang-select" onchange="setLang(this.value)" aria-label="Language">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${getLang() === k ? "selected" : ""}>${v.label}</option>`).join("")}</select>`;
}

function applyI18n() {
  const lang = getLang();
  document.documentElement.lang = (LANGS[lang] || LANGS.zh).html;
  document.querySelectorAll(".lang-select").forEach(el=>{el.value=lang;});
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}

window.addEventListener("DOMContentLoaded", applyI18n);
const API = {
  token: localStorage.getItem("ct_token") || "",
  user: null,
  sessionExpiryRedirecting: false,

  async req(path, method, body, authed = true) {
    if (window.ctTrialMode && path.startsWith("/problems/")) path = "/trial" + path;
    if (window.ctTrialMode && path.startsWith("/match/")) path = "/trial" + path;
    if (window.ctTrialMode && path === "/tts") path = "/trial/tts";
    const headers = { "X-App-Language": getLang() };
    const requestToken = authed ? this.token : "";
    if (body !== undefined && body !== null) headers["Content-Type"] = "application/json";
    if (requestToken) headers["Authorization"] = "Bearer " + requestToken;
    const res = await fetch(path, { method: method || "GET", headers, body: body !== undefined && body !== null ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message=data.message || `HTTP ${res.status}`;
      const error = new Error(typeof localizedServerMessage === "function" ? localizedServerMessage(message) : message);
      error.status = res.status;
      // Several requests can be in flight when an expired session is
      // detected. A late 401 from the old token must never clear a newer
      // token entered on the sign-in page in another document.
      if (res.status === 401 && authed && requestToken && !window.ctTrialMode && localStorage.getItem("ct_token") === requestToken) {
        error.authExpired = true;
        this.expireSession();
      }
      throw error;
    }
    return data;
  },

  expireSession() {
    if (this.sessionExpiryRedirecting) return;
    this.sessionExpiryRedirecting = true;
    this.token = "";
    this.user = null;
    localStorage.removeItem("ct_token");
    localStorage.removeItem("ct_user");
    // Keep sessionStorage intact: the app uses it to reopen the current view,
    // room id and scroll context after the user signs in again.
    location.replace("/?reason=session-expired#login");
  },

  async login(account, password) {
    const data = await this.req("/auth/login", "POST", { account, password }, false);
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem("ct_token", this.token);
    localStorage.setItem("ct_user", JSON.stringify(data.user));
    return data;
  },

  async register(account, password, role, name) {
    const data = await this.req("/auth/register", "POST", { account, password, role, displayName: name }, false);
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem("ct_token", this.token);
    localStorage.setItem("ct_user", JSON.stringify(data.user));
    return data;
  },

  async loginWithCode(phone, code, role, name) {
    const data = await this.req("/auth/login-with-code", "POST", { phone, code, role, displayName: name }, false);
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem("ct_token", this.token);
    localStorage.setItem("ct_user", JSON.stringify(data.user));
    return data;
  },

  logout() {
    this.token = ""; this.user = null;
    localStorage.removeItem("ct_token"); localStorage.removeItem("ct_user");
    location.href = "/";
  },

  autoLogin() {
    const saved = localStorage.getItem("ct_user");
    if (this.token && saved) {
      try {
        this.user = JSON.parse(saved);
        return Boolean(this.user && this.user.id && this.user.role);
      } catch (_) {
        this.token = "";
        localStorage.removeItem("ct_token");
        localStorage.removeItem("ct_user");
      }
    }
    return false;
  }
};

// ── Chess Board Rendering ──
const PIECES = {
  p:"♟\uFE0E",r:"♜",n:"♞",b:"♝",q:"♛",k:"♚",
  P:"♙",R:"♖",N:"♘",B:"♗",Q:"♕",K:"♔"
};

function parseFen(fen) {
  const rows = (fen || "8/8/8/8/8/8/8/8").split(" ")[0].split("/");
  return rows.map(r => {
    const line = [];
    for (const ch of r) {
      if (ch >= "1" && ch <= "8") for (let i = 0; i < +ch; i++) line.push("");
      else line.push(ch);
    }
    return line;
  });
}

function sqName(r, c) { return "abcdefgh"[c] + (8 - r); }

function renderBoard(el, fen, selected, onClick, orientation = "white") {
  el.innerHTML = "";
  el.className = "board";
  const b = parseFen(fen), files = "abcdefgh";
  const top = document.createElement("div");
  top.className = "board-files board-files-top";
  const bottom = document.createElement("div");
  bottom.className = "board-files board-files-bottom";
  const left = document.createElement("div");
  left.className = "board-ranks board-ranks-left";
  const right = document.createElement("div");
  right.className = "board-ranks board-ranks-right";
  const grid = document.createElement("div");
  grid.className = "board-grid";

  for (let i = 0; i < 8; i++) {
    const fileTop = document.createElement("div");
    fileTop.className = "coord";
    fileTop.textContent = files[orientation === "black" ? 7 - i : i];
    top.appendChild(fileTop);

    const fileBottom = document.createElement("div");
    fileBottom.className = "coord";
    fileBottom.textContent = files[orientation === "black" ? 7 - i : i];
    bottom.appendChild(fileBottom);

    const rankLeft = document.createElement("div");
    rankLeft.className = "coord";
    rankLeft.textContent = String(orientation === "black" ? i + 1 : 8 - i);
    left.appendChild(rankLeft);

    const rankRight = document.createElement("div");
    rankRight.className = "coord";
    rankRight.textContent = String(orientation === "black" ? i + 1 : 8 - i);
    right.appendChild(rankRight);
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement("div");
      const boardRow = orientation === "black" ? 7 - r : r;
      const boardCol = orientation === "black" ? 7 - c : c;
      const sq = sqName(boardRow, boardCol);
      const piece = b[boardRow][boardCol] || "";
      cell.dataset.square = sq;
      cell.setAttribute("aria-label", sq + (piece ? " " + piece : ""));
      cell.className = "cell " + ((r+c)%2===0 ? "light" : "dark") + (selected === sq ? " selected" : "");
      const span = document.createElement("span");
      span.className = "piece " + (piece === piece.toUpperCase() ? "white" : "black");
      span.textContent = PIECES[piece] || "";
      cell.appendChild(span);
      cell.onclick = () => onClick(sq, piece);
      grid.appendChild(cell);
    }
  }

  el.appendChild(top);
  el.appendChild(left);
  el.appendChild(grid);
  el.appendChild(right);
  el.appendChild(bottom);
}

// ── Rank Display ──
const RANKS = [
  { piece:"♟", title:"兵", level:1, min:0, next:100 },
  { piece:"♞", title:"骑士", level:2, min:100, next:300 },
  { piece:"♝", title:"主教", level:3, min:300, next:600 },
  { piece:"♜", title:"战车", level:4, min:600, next:1000 },
  { piece:"♛", title:"皇后", level:5, min:1000, next:1500 },
  { piece:"♚", title:"国王", level:6, min:1500, next:Infinity },
];

function getRank(points) {
  const safePoints = Math.max(0, Number(points) || 0);
  const rank = RANKS.find(r => safePoints >= r.min && safePoints < r.next) || RANKS[RANKS.length - 1];
  const nextRank = RANKS.find(r => r.min === rank.next) || null;
  const span = Number.isFinite(rank.next) ? rank.next - rank.min : 1;
  const progress = Number.isFinite(rank.next) ? Math.max(0, Math.min(100, Math.round(((safePoints - rank.min) / span) * 100))) : 100;
  return {
    ...rank,
    title: t("rank" + rank.level),
    points: safePoints,
    progress,
    nextTitle: nextRank ? t("rank" + nextRank.level) : t("topRank"),
    toNext: Number.isFinite(rank.next) ? Math.max(0, rank.next - safePoints) : 0,
  };
}

function renderRankProgress(points) {
  const r = getRank(points);
  const nextText = r.toNext > 0 ? t("nextRank", { rank: r.nextTitle, points: r.toNext }) : t("topRank");
  return `
    <div class="rank-card">
      <div class="rank-main">
        <div class="rank-piece">${r.piece}</div>
        <div>
          <div class="rank-title">Lv.${r.level} ${r.title}</div>
          <div class="rank-sub">${r.points} ${t("points")} · ${nextText}</div>
        </div>
      </div>
      <div class="rank-progress" aria-label="段位进度"><span style="width:${r.progress}%"></span></div>
      <div class="rank-guide">
        <span>✅ ${t("answerCorrect")}</span>
        <span>🏁 ${t("gameOverPoints")}</span>
        <span>📈 ${t("progress", { progress: r.progress })}</span>
      </div>
    </div>`;
}

// ── Toast ──
function toast(msg) {
  const c = document.getElementById("toasts") || (() => { const d = document.createElement("div"); d.id = "toasts"; d.className = "toast-container"; document.body.appendChild(d); return d; })();
  if (Array.from(c.children).some(item => item.textContent === String(msg))) return;
  while (c.children.length >= 3) c.firstElementChild.remove();
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Escape HTML ──
function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

// ── Format Time ──
function fmtTime(ms) { const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000); return m + ":" + (s<10?"0":"") + s; }
