import { FastifyPluginAsync } from "fastify";

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>棋童 - 国际象棋在线学习平台</title>
  <style>
    :root {
      --ink: #251811;
      --muted: #6f5943;
      --paper: #f2dfb8;
      --paper2: #d7b77b;
      --steel: #26313a;
      --steel2: #151b22;
      --banner: #8b1f22;
      --gold: #c79b45;
      --green: #355943;
      --light: #f5e0c0;
      --dark: #7a4320;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background:
        linear-gradient(rgba(18, 20, 24, .42), rgba(18, 20, 24, .62)),
        radial-gradient(circle at 12% 18%, rgba(246, 213, 130, .42), transparent 18%),
        radial-gradient(circle at 88% 8%, rgba(154, 31, 34, .28), transparent 20%),
        linear-gradient(150deg, #5a3522 0%, #2d2f2d 36%, #1b2326 62%, #0f1216 100%);
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: .32;
      background:
        linear-gradient(115deg, transparent 0 16%, rgba(199,155,69,.55) 16% 17%, transparent 17% 30%, rgba(139,31,34,.45) 30% 31%, transparent 31%),
        repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 34px);
      mix-blend-mode: screen;
    }
    .wrap { width: min(1320px, 100%); margin: 0 auto; padding: 18px; position: relative; }
    .hero {
      min-height: 132px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
      color: #fff7dc;
      padding: 22px;
      border: 1px solid rgba(246, 210, 130, .55);
      background:
        linear-gradient(90deg, rgba(34,25,20,.92), rgba(80,43,28,.72)),
        linear-gradient(135deg, rgba(139,31,34,.4), rgba(38,49,58,.25));
      box-shadow: 0 18px 58px rgba(0,0,0,.34), inset 0 0 0 1px rgba(255,255,255,.08);
      border-radius: 8px;
    }
    .hero h1 { margin: 0; font-size: clamp(28px, 4vw, 48px); letter-spacing: 0; }
    .hero p { margin: 8px 0 0; color: #e8d6ad; line-height: 1.45; max-width: 820px; }
    .crest {
      width: 116px;
      height: 116px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #ffe3a2;
      font-size: 58px;
      background: radial-gradient(circle, #8b1f22 0 42%, #4b1719 43% 58%, #c79b45 59% 64%, #26313a 65%);
      box-shadow: inset 0 0 22px rgba(0,0,0,.38), 0 14px 34px rgba(0,0,0,.32);
    }
    .topbar, .panel, .app-tabs {
      border-radius: 8px;
      border: 1px solid rgba(90, 62, 35, .42);
      background:
        linear-gradient(rgba(255,255,255,.26), rgba(255,255,255,.08)),
        linear-gradient(135deg, var(--paper), var(--paper2));
      box-shadow: 0 14px 38px rgba(0,0,0,.22), inset 0 0 0 1px rgba(255,255,255,.38);
    }
    .topbar { margin-top: 14px; padding: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .app-tabs {
      position: sticky;
      top: 8px;
      z-index: 3;
      margin-top: 14px;
      padding: 8px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .tab-btn {
      min-height: 46px;
      border-radius: 6px;
      color: var(--ink);
      background: rgba(255, 247, 219, .72);
      border-color: rgba(66,44,25,.34);
      box-shadow: none;
    }
    .tab-btn.active {
      color: #fff7dc;
      background: linear-gradient(#355943, #243c2d);
      border-color: #17251c;
    }
    .grid { display: block; margin-top: 14px; }
    .panel { display: none; padding: 14px; }
    .panel.active { display: block; }
    .panel h2 { margin: 0 0 10px; font-size: 20px; display: flex; align-items: center; gap: 8px; }
    .sub { color: var(--muted); font-size: 13px; margin: 0 0 10px; line-height: 1.45; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
    input, select, button {
      min-height: 38px;
      border-radius: 6px;
      border: 1px solid rgba(66, 44, 25, .52);
      padding: 8px 10px;
      font: inherit;
    }
    input, select {
      color: var(--ink);
      background: rgba(255, 247, 219, .9);
      min-width: 130px;
    }
    button {
      cursor: pointer;
      color: #fff7dc;
      font-weight: 700;
      background: linear-gradient(#9d2930, #741c22);
      border-color: #481116;
      box-shadow: inset 0 1px rgba(255,255,255,.2), 0 2px 0 rgba(0,0,0,.24);
    }
    button.secondary { background: linear-gradient(#3f5361, #26313a); border-color: #171f26; }
    button.ghost { color: var(--ink); background: rgba(255, 247, 219, .64); border-color: rgba(66,44,25,.42); box-shadow: none; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .split { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(250px, .72fr); gap: 12px; align-items: start; }
    .battle-layout { display: grid; grid-template-columns: minmax(280px, 620px) minmax(250px, 1fr); gap: 12px; align-items: start; }
    .board {
      width: min(100%, 560px);
      aspect-ratio: 1 / 1;
      display: grid;
      grid-template-columns: 28px repeat(8, 1fr) 28px;
      grid-template-rows: 28px repeat(8, 1fr) 28px;
      border: 6px solid #3a2619;
      border-radius: 4px;
      box-shadow: 0 12px 28px rgba(0,0,0,.3), inset 0 0 0 2px #c79b45;
      background: #3a2619;
    }
    .cell {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      font-size: clamp(24px, 4.1vw, 42px);
      line-height: 1;
      user-select: none;
      cursor: pointer;
      min-width: 0;
      min-height: 0;
    }
    .light { background: var(--light); }
    .dark { background: var(--dark); }
    .selected { box-shadow: inset 0 0 0 4px #f8f06a; }
    .coord-label {
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #1a1a1a;
      background: rgba(255, 255, 255, 0.88);
      pointer-events: none;
      user-select: none;
    }
    .corner-cell {
      background: rgba(255, 255, 255, 0.88);
    }
    .piece.white { color: #fff6df; text-shadow: 0 2px 2px rgba(0,0,0,.45); }
    .piece.black { color: #1a1512; text-shadow: 0 1px 0 rgba(255,255,255,.25); }
    .list {
      max-height: 260px;
      overflow: auto;
      display: grid;
      gap: 6px;
      padding-right: 3px;
    }
    .puzzle-item {
      width: 100%;
      text-align: left;
      color: var(--ink);
      background: rgba(255, 247, 219, .62);
      border: 1px solid rgba(90, 62, 35, .28);
      box-shadow: none;
      font-weight: 600;
    }
    .puzzle-item.active { background: #5b743f; color: #fff7dc; border-color: #2d3d21; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
    .tag {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      color: #fff7dc;
      background: #355943;
    }
    .tag.red { background: var(--banner); }
    .tag.steel { background: var(--steel); }
    .feed {
      min-height: 86px;
      padding: 10px;
      border-radius: 6px;
      background: rgba(255, 247, 219, .7);
      border: 1px solid rgba(90, 62, 35, .28);
      white-space: pre-wrap;
      line-height: 1.45;
      font-size: 13px;
    }
    .moves { max-height: 130px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; }
      .crest { display: none; }
      .grid, .split, .battle-layout { grid-template-columns: 1fr; }
      .wrap { padding: 12px; }
      .app-tabs { bottom: 8px; top: auto; }
    }
    /* ── Class UI ── */
    .piece-palette {
      display: flex; gap: 6px; flex-wrap: wrap; padding: 10px;
      background: rgba(0,0,0,.25); border-radius: 8px; margin-bottom: 10px;
    }
    .palette-piece {
      width: 40px; height: 40px; border-radius: 6px; border: 2px solid rgba(0,0,0,.25);
      font-size: 22px; cursor: pointer; display: grid; place-items: center;
      background: #fff7db; color: #1a1512;
      box-shadow: 0 2px 4px rgba(0,0,0,.15);
      transition: transform .08s, box-shadow .08s;
    }
    .palette-piece:active { transform: scale(.93); box-shadow: 0 1px 2px rgba(0,0,0,.1); }
    .palette-piece.selected { border-color: #e8383f; background: #ffe0d0; box-shadow: 0 0 0 2px rgba(232,56,63,.35); }
    .palette-piece.erase { font-size: 16px; color: #888; background: #f5f5f5; }
    .editor-board .cell { cursor: pointer; }
    .editor-board .cell:hover { box-shadow: inset 0 0 0 3px #e8383f; }
    .class-card, .homework-card {
      padding: 10px; border-radius: 6px; margin-bottom: 8px;
      background: rgba(255,247,219,.55); border: 1px solid rgba(90,62,35,.2);
    }
    .homework-card { cursor: pointer; }
    .homework-card:hover { background: rgba(255,247,219,.82); }
    .homework-card.solved { border-left: 4px solid #355943; }
    .invite-code {
      font-size: 28px; font-weight: 800; letter-spacing: 6px;
      color: var(--banner); padding: 8px 16px; border-radius: 8px;
      background: rgba(139,31,34,.1); border: 2px dashed var(--banner);
      display: inline-block;
    }
    .member-list { max-height: 180px; overflow: auto; }
    .member-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,.06); }
    /* ── PvP / Social UI ── */
    .time-presets { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .time-btn { min-height: 36px; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 700; color: var(--ink); background: rgba(255,247,219,.72); border: 1px solid rgba(66,44,25,.42); }
    .time-btn.selected { color: #fff7dc; background: linear-gradient(#355943, #243c2d); border-color: #17251c; }
    .room-number {
      font-size: 36px; font-weight: 800; letter-spacing: 8px;
      color: var(--banner); padding: 8px 20px; border-radius: 8px;
      background: rgba(139,31,34,.1); border: 2px dashed var(--banner);
      display: inline-block; margin: 6px 0;
    }
    .clock-display {
      text-align: center; padding: 6px 12px; border-radius: 6px;
      font-size: 22px; font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: rgba(0,0,0,.18); color: #fff7dc;
      min-width: 100px;
    }
    .clock-display.ticking { background: rgba(0,0,0,.35); }
    .clock-display.low { color: #ff6b6b; animation: pulse .5s infinite alternate; }
    @keyframes pulse { 0% { opacity: .7; } 100% { opacity: 1; } }
    .friend-item {
      display: flex; align-items: center; gap: 8px; padding: 10px;
      border-radius: 6px; margin-bottom: 6px;
      background: rgba(255,247,219,.55); border: 1px solid rgba(90,62,35,.2);
      justify-content: space-between;
    }
    .friend-item .info { flex: 1; }
    .friend-item .actions { display: flex; gap: 4px; }
    .chat-panel {
      position: fixed; bottom: 0; right: 20px; width: 360px; max-height: 480px;
      background: linear-gradient(135deg, var(--paper), var(--paper2));
      border-radius: 8px 8px 0 0; border: 1px solid rgba(90,62,35,.42);
      box-shadow: 0 -4px 24px rgba(0,0,0,.28); z-index: 10;
      display: flex; flex-direction: column;
    }
    .chat-header {
      padding: 10px 14px; border-bottom: 1px solid rgba(90,62,35,.28);
      display: flex; justify-content: space-between; align-items: center;
      cursor: pointer; user-select: none;
    }
    .chat-messages {
      flex: 1; overflow-y: auto; padding: 10px; min-height: 200px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .chat-bubble {
      max-width: 80%; padding: 8px 12px; border-radius: 10px;
      font-size: 13px; line-height: 1.4; word-break: break-word;
    }
    .chat-bubble.outgoing {
      align-self: flex-end; background: #355943; color: #fff7dc;
    }
    .chat-bubble.incoming {
      align-self: flex-start; background: rgba(255,247,219,.8); color: var(--ink);
    }
    .chat-time { font-size: 10px; opacity: .55; margin-top: 2px; }
    .chat-input-row { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid rgba(90,62,35,.28); }
    .chat-input-row input { flex: 1; min-width: 0; }
    .notification-toast {
      position: fixed; top: 16px; right: 16px; z-index: 20;
      min-width: 300px; max-width: 420px;
    }
    .toast-item {
      padding: 14px; border-radius: 8px; margin-bottom: 8px;
      background: linear-gradient(135deg, var(--paper), var(--paper2));
      border: 1px solid rgba(90,62,35,.42);
      box-shadow: 0 8px 24px rgba(0,0,0,.28); animation: slideIn .3s ease;
    }
    @keyframes slideIn { 0% { transform: translateX(100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
    .toast-item .toast-actions { display: flex; gap: 6px; margin-top: 8px; }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 15;
      display: flex; align-items: center; justify-content: center;
    }
    .modal-box {
      background: linear-gradient(135deg, var(--paper), var(--paper2));
      border-radius: 8px; padding: 24px; min-width: 320px; max-width: 440px;
      box-shadow: 0 18px 48px rgba(0,0,0,.38);
    }
    .unread-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; border-radius: 9px;
      background: var(--banner); color: #fff; font-size: 11px;
      font-weight: 700; padding: 0 5px; margin-left: 4px;
    }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .status-dot.online { background: #355943; }
    .status-dot.offline { background: #999; }
    /* ── Dashboard & Navigation ── */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
      margin-top: 14px;
    }
    .dash-card {
      padding: 20px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid rgba(90, 62, 35, .42);
      background: linear-gradient(rgba(255,255,255,.26), rgba(255,255,255,.08)), linear-gradient(135deg, var(--paper), var(--paper2));
      box-shadow: 0 8px 24px rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.24);
      transition: transform .18s, box-shadow .18s;
      text-align: center;
    }
    .dash-card:hover { transform: translateY(-4px); box-shadow: 0 16px 36px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.38); }
    .dash-card .dash-icon { font-size: 38px; margin-bottom: 8px; }
    .dash-card h3 { margin: 0 0 6px; font-size: 17px; }
    .dash-card p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.4; }
    .breadcrumb { display: flex; gap: 6px; align-items: center; font-size: 13px; color: #e8d6ad; flex-wrap: wrap; }
    .breadcrumb span { cursor: pointer; opacity: .75; }
    .breadcrumb span:hover { opacity: 1; text-decoration: underline; }
    .breadcrumb span.current { cursor: default; text-decoration: none; opacity: 1; font-weight: 700; }
    .breadcrumb .crumb-arrow { opacity: .4; }
    @media (max-width: 600px) {
      .dashboard-grid { grid-template-columns: 1fr; }
    }
    /* ── Learning Center ── */
    #learningTopicContent { line-height: 1.6; }
    #learningTopicContent h3 { margin-top: 0; }
    #learningTopicContent h4 { margin: 10px 0 6px; }
    #learningTopicContent ul, #learningTopicContent ol { padding-left: 20px; }
    #learningTopicContent li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>棋童</h1>
        <p>Mac 本地国际象棋训练营：Stockfish 主导棋力，Ollama qwen3:8b 负责中文讲解。</p>
      </div>
      <div class="crest">♜</div>
    </section>

    <section class="topbar" style="align-items:center;">
      <button id="backBtn" class="ghost" style="display:none;flex-shrink:0;font-size:16px;min-height:32px;padding:4px 10px;">← 返回</button>
      <div id="breadcrumb" class="breadcrumb" style="flex:1;min-width:0;"></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex-shrink:0;">
        <input id="phone" value="" aria-label="phone" placeholder="手机号/+国际号码" style="width:140px;" />
        <input id="password" type="password" aria-label="password" placeholder="密码" style="width:110px;" />
        <input id="name" value="" aria-label="name" placeholder="昵称" style="width:100px;" />
        <select id="role" aria-label="role"><option value="student">学生</option><option value="parent">家长</option><option value="teacher">老师</option></select>
        <button id="btnLogin">登录/注册</button>
        <span class="tag steel" id="loginTag">未登录</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        <span class="tag red" id="engineTag">Stockfish: 待检测</span>
        <span class="tag steel" id="coachTag">讲解: Ollama qwen3:8b</span>
        <span class="tag red" id="bindCodeTag" style="display:none;cursor:pointer;" title="点击重新生成">绑定码: ----</span>
      </div>
    </section>

    <!-- ── Home Dashboard ── -->
    <section class="panel active" id="homeView">
      <h2>♜ 棋童</h2>
      <div class="sub">选择你想要的训练模式，层层深入提升棋艺</div>
      <div class="dashboard-grid" id="dashboardGrid">
        <div class="dash-card" data-target="learningCenter">
          <div class="dash-icon">📚</div>
          <h3>学习中心</h3>
          <p>开局原则 · 经典开局 · 中局策略 · 残局基础 · 常见陷阱</p>
        </div>
        <div class="dash-card" data-target="practiceView">
          <div class="dash-icon">⚔</div>
          <h3>题库训练</h3>
          <p>300+精选题目 · AI讲解 · 阶梯难度</p>
        </div>
        <div class="dash-card" data-target="battleView">
          <div class="dash-icon">♛</div>
          <h3>人机对战</h3>
          <p>Stockfish引擎 · 可调难度 · AI复盘</p>
        </div>
        <div class="dash-card" data-target="pvpView">
          <div class="dash-icon">👥</div>
          <h3>双人对战</h3>
          <p>实时对战 · 计时系统 · 房间制</p>
        </div>
        <div class="dash-card" data-target="friendsView">
          <div class="dash-icon">💬</div>
          <h3>好友</h3>
          <p>加好友 · 聊天 · 邀请对局</p>
        </div>
        <div class="dash-card" data-target="arenaView">
          <div class="dash-icon">🏟</div>
          <h3>公开赛</h3>
          <p>自动匹配 · 公平竞技 · 积分争霸</p>
        </div>
        <div class="dash-card" data-target="rankingsView">
          <div class="dash-icon">🏆</div>
          <h3>积分榜</h3>
          <p>全站排名 · 班级排名 · 段位晋升</p>
        </div>
        <div class="dash-card" data-target="classView" id="dashClassStudent" style="display:none;">
          <div class="dash-icon">📖</div>
          <h3>我的班级</h3>
          <p>加入班级 · 作业 · 公告</p>
        </div>
        <div class="dash-card" id="dashBindParent" style="display:none;cursor:pointer;">
          <div class="dash-icon">🔗</div>
          <h3>绑定家长</h3>
          <p id="bindCardDesc">生成6位码 → 发给家长 → 家长输入即绑定</p>
        </div>
        <div class="dash-card" data-target="classTeacherView" id="dashClassTeacher" style="display:none;">
          <div class="dash-icon">🏫</div>
          <h3>班级管理</h3>
          <p>创建班级 · 布置作业 · 发公告</p>
        </div>
        <div class="dash-card" data-target="parentView" id="dashParent" style="display:none;">
          <div class="dash-icon">👨‍👩‍👧</div>
          <h3>家长中心</h3>
          <p>绑定孩子 · 学习计划 · 进度追踪</p>
        </div>
      </div>
    </section>

    <div class="grid">
      <section class="panel" id="practiceView">
        <h2>⚔ 做题训练</h2>
        <div class="split">
          <div>
            <div id="practiceBoard" class="board"></div>
            <div class="row" style="margin-top:10px;">
              <input id="practiceMove" placeholder="备用输入：如 Ra8# 或 a1a8" style="flex:1;" />
              <button id="btnPracticeSubmit">提交</button>
              <button class="ghost" id="btnHint">提示</button>
            </div>
          </div>
          <aside>
            <div class="row">
              <button class="secondary" id="btnLoadProblems">载入题库</button>
              <button class="ghost" id="btnNextProblem">下一题</button>
            </div>
            <div id="problemMeta" class="feed">登录后点击"载入题库"加载全部题目。</div>
            <div class="tags" id="problemTags"></div>
            <div class="list" id="problemList"></div>
          </aside>
        </div>
        <h2 style="margin-top:14px;">♞ Qwen 讲解</h2>
        <div id="practiceResult" class="feed">尚未提交答案。</div>
      </section>

      <section class="panel" id="battleView">
        <h2>♛ Stockfish 对战</h2>
        <div class="battle-layout">
          <div>
            <div id="battleBoard" class="board"></div>
            <div class="row" style="margin-top:10px;">
              <input id="battleMove" placeholder="备用输入：如 e2e4 或 e4" style="flex:1;" />
              <button id="btnBattleSubmit">提交走法</button>
            </div>
          </div>
          <aside>
            <div class="row">
              <select id="mode"><option value="standard">标准模式</option><option value="teaching">教学模式</option></select>
              <input id="difficulty" type="number" min="1" max="20" value="8" />
              <button id="btnStart">开始对局</button>
            </div>
            <div class="row">
              <button class="secondary" id="btnSuggest">Stockfish建议</button>
              <button class="ghost" id="btnAnalyze">Qwen复盘</button>
            </div>
            <div class="tags">
              <span class="tag steel" id="turnTag">轮到: -</span>
              <span class="tag red" id="sourceTag">引擎: -</span>
            </div>
            <div id="battleStatus" class="feed">登录后开始对局。</div>
            <h2 style="margin-top:14px;">战报</h2>
            <div id="moveList" class="feed moves">暂无走子。</div>
            <div id="analysis" class="feed" style="margin-top:10px;">尚未复盘。</div>
          </aside>
        </div>
      </section>

      <!-- ── Learning Center ── -->
      <section class="panel" id="learningCenter">
        <h2>📚 学习中心</h2>
        <div class="sub">选择学习主题，系统提升棋艺理解</div>
        <div id="learningSections" class="dashboard-grid" style="grid-template-columns:repeat(auto-fill, minmax(190px, 1fr));">
          <div class="dash-card" data-section="principles">
            <div class="dash-icon">🏰</div><h3>开局原则</h3><p>中心 · 出子 · 王安全</p>
          </div>
          <div class="dash-card" data-section="openings">
            <div class="dash-icon">📖</div><h3>经典开局</h3><p>意大利 · 西班牙 · 伦敦 · 西西里</p>
          </div>
          <div class="dash-card" data-section="middlegame">
            <div class="dash-icon">⚡</div><h3>中局策略</h3><p>子力活跃 · 兵形 · 王翼进攻</p>
          </div>
          <div class="dash-card" data-section="endgame">
            <div class="dash-icon">🏁</div><h3>残局基础</h3><p>杀王 · 对王 · 通路兵</p>
          </div>
          <div class="dash-card" data-section="traps">
            <div class="dash-icon">🎯</div><h3>常见陷阱</h3><p>四步杀 · 勒加尔 · 布达佩斯</p>
          </div>
        </div>
        <div id="learningDetail" style="display:none;margin-top:12px;">
          <div class="split">
            <div id="learningTopicList" class="list" style="max-height:400px;"></div>
            <div>
              <div id="learningTopicContent" class="feed" style="min-height:200px;max-height:500px;overflow:auto;"></div>
              <div id="learningTopicBoard" style="margin-top:10px;"></div>
              <div class="tags" id="learningTopicTips" style="margin-top:8px;"></div>
            </div>
          </div>
        </div>
      </section>

        <!-- ── Teacher Class View ── -->
        <section class="panel" id="classTeacherView">
          <h2>🏫 班级管理</h2>
          <div class="row">
            <input id="clsName" placeholder="班级名称" style="flex:1;" />
            <input id="clsCode" placeholder="6位邀请码（留空自动生成）" maxlength="6" style="width:200px;" />
            <button id="btnCreateClass">创建班级</button>
          </div>
          <div id="createResult" class="feed" style="min-height:0;margin-bottom:10px;"></div>
          <div class="row">
            <select id="clsSelect" style="flex:1;"><option value="">-- 选择班级 --</option></select>
            <button class="secondary" id="btnRefreshClass">刷新</button>
          </div>
          <div id="classTeacherDetail"></div>
        </section>

        <!-- ── Student Class View ── -->
        <section class="panel" id="classStudentView">
          <h2>📚 我的班级</h2>
          <div class="row">
            <input id="joinCode" placeholder="输入6位邀请码" maxlength="6" style="width:140px;" />
            <button id="btnJoinClass">加入班级</button>
          </div>
          <div id="joinResult" class="feed" style="min-height:0;margin-bottom:10px;"></div>
          <div class="row">
            <select id="stuClsSelect" style="flex:1;"><option value="">-- 选择班级 --</option></select>
            <button class="secondary" id="btnStuRefresh">刷新</button>
          </div>
          <div id="classStudentDetail"></div>
        </section>

        <!-- ── Parent Dashboard ── -->
        <section class="panel" id="parentView">
          <h2>👨‍👩‍👧 家长中心</h2>

          <!-- ── 输入学生绑定码 ── -->
          <h3>📥 输入学生给的绑定码</h3>
          <div style="background:rgba(199,155,69,.15);border-radius:8px;padding:12px;margin-bottom:10px;line-height:1.6;font-size:13px;">
            ⚠️ 家长端<b>没有</b>绑定码，家长是<b>输入端</b><br>
            ① 让孩子在Ta的仪表盘点击 <b>「🔗 绑定家长」</b><br>
            ② 孩子得到一个6位数字码 → <b>把码发给你</b><br>
            ③ <b>在下方输入那个码</b>完成绑定
          </div>
          <div class="row">
            <input id="bindCode" placeholder="学生给你的6位数字码" maxlength="6" style="width:220px;font-size:20px;text-align:center;letter-spacing:6px;font-weight:700;" />
            <button id="btnBindChild">确认绑定</button>
          </div>
          <div id="bindResult" class="feed" style="min-height:0;margin-bottom:10px;"></div>

          <!-- ── 我的孩子 ── -->
          <h3>👶 我的孩子</h3>
          <div class="row">
            <button class="secondary" id="btnRefreshChildren">刷新</button>
          </div>
          <div id="childrenList" class="list" style="max-height:260px;"></div>
          <div id="childDetail" class="feed" style="margin-top:10px;min-height:60px;"></div>

          <!-- ── 学习周报 ── -->
          <h3>📊 学习周报</h3>
          <div class="sub">每周生成详细报告，含数据统计 + AI评语 + 改进建议</div>
          <div class="row">
            <select id="reportChildSelect" style="flex:1;"><option value="">-- 选择孩子 --</option></select>
            <button id="btnGenerateReport" style="font-size:15px;padding:8px 16px;">📊 生成本周报告</button>
            <button class="secondary" id="btnViewReports">📋 历史周报</button>
          </div>
          <div id="reportResult" style="margin-top:10px;"></div>

          <!-- ── 学习计划 ── -->
          <h3>📋 学习计划</h3>
          <div class="row">
            <select id="planChildSelect" style="flex:1;"><option value="">-- 选择孩子 --</option></select>
          </div>
          <div class="row">
            <input id="planSolveTarget" type="number" min="0" max="100" value="5" placeholder="每日做题目标" style="width:130px;" />
            <input id="planBattleTarget" type="number" min="0" max="50" value="1" placeholder="每日对战目标" style="width:130px;" />
            <input id="planStartDate" type="date" style="width:140px;" />
            <input id="planEndDate" type="date" style="width:140px;" />
          </div>
          <div class="row">
            <button id="btnCreatePlan">创建计划</button>
            <button class="secondary" id="btnRefreshPlans">刷新</button>
          </div>
          <div id="planCreateResult" class="feed" style="min-height:0;margin-bottom:8px;"></div>
          <div id="planList"></div>

          <!-- ── 我的班级 ── -->
          <h3>🏫 我的班级</h3>
          <div class="row">
            <input id="parentJoinCode" placeholder="输入6位邀请码" maxlength="6" style="width:140px;" />
            <button id="btnParentJoinClass">加入班级</button>
          </div>
          <div id="parentJoinResult" class="feed" style="min-height:0;margin-bottom:10px;"></div>
          <div class="row">
            <select id="parentClsSelect" style="flex:1;"><option value="">-- 选择班级 --</option></select>
            <button class="secondary" id="btnParentClsRefresh">刷新</button>
          </div>
          <div id="parentClassDetail"></div>
        </section>

        <!-- ── PvP Battle View ── -->
        <section class="panel" id="pvpView">
          <h2>⚔ 双人对战</h2>
          <div class="split">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div id="pvpWhiteClock" class="clock-display">10:00</div>
                <span style="font-size:13px;color:var(--muted);">VS</span>
                <div id="pvpBlackClock" class="clock-display">10:00</div>
              </div>
              <div id="pvpBoard" class="board"></div>
              <div class="row" style="margin-top:8px;">
                <button id="btnPvpResign" style="display:none;">认输</button>
                <button class="ghost" id="btnPvpDraw" style="display:none;">提和</button>
              </div>
            </div>
            <aside>
              <!-- Room creation / joining -->
              <div id="pvpSetup">
                <div style="margin-bottom:8px; font-weight:700;">⏱ 时间控制</div>
                <div class="time-presets" id="timePresets">
                  <button class="time-btn selected" data-min="1" data-inc="0">1+0</button>
                  <button class="time-btn" data-min="5" data-inc="2">5+2</button>
                  <button class="time-btn" data-min="10" data-inc="0">10+0</button>
                  <button class="time-btn" data-min="15" data-inc="10">15+10</button>
                  <button class="time-btn" data-min="-1" data-inc="-1" id="customTimeBtn">自定义</button>
                </div>
                <div class="row" id="customTimeRow" style="display:none;">
                  <input id="customMinutes" type="number" min="0" max="120" value="3" placeholder="分钟" style="width:70px;" />
                  <span>分 +</span>
                  <input id="customSeconds" type="number" min="0" max="300" value="2" placeholder="秒" style="width:70px;" />
                  <span>秒</span>
                </div>
                <div class="row" style="margin-top:10px;">
                  <button id="btnCreateRoom">创建房间</button>
                  <span style="margin:0 6px;">或</span>
                  <input id="joinRoomNumber" placeholder="输入6位房间号" maxlength="6" style="width:130px;" />
                  <button class="secondary" id="btnJoinRoom">加入</button>
                </div>
                <div id="pvpRoomInfo" class="feed" style="margin-top:8px; min-height:0;"></div>
                <div class="row" style="margin-top:8px;">
                  <button class="ghost" id="btnRefreshRooms">刷新活跃房间</button>
                </div>
                <div id="activeRooms" class="list" style="max-height:180px;"></div>
              </div>
              <!-- In-game info -->
              <div id="pvpGameInfo" style="display:none;">
                <div id="pvpStatus" class="feed">对局中...</div>
                <div id="pvpMoveList" class="feed moves" style="margin-top:8px;">暂无走子。</div>
                <div style="margin-top:8px;">
                  <button class="ghost" id="btnPvpShareClass" style="display:none;">📢 分享到班级群</button>
                </div>
              </div>
            </aside>
          </div>
        </section>

      <!-- ── Arena View (Public Matchmaking) ── -->
      <section class="panel" id="arenaView">
        <h2>🏟 公开赛</h2>
        <div class="sub">自动匹配对手，公平竞技，赢取积分晋升段位</div>
        <div class="split">
          <div style="text-align:center;padding:30px;">
            <div id="arenaStatus" style="font-size:48px;margin-bottom:12px;">⚔</div>
            <div id="arenaStatusText" class="feed" style="min-height:0;font-size:18px;text-align:center;">
              点击下方按钮加入公开匹配
            </div>
            <div style="margin-top:16px;">
              <button id="btnArenaJoin" style="font-size:18px;padding:12px 32px;">⚡ 加入匹配</button>
              <button id="btnArenaLeave" class="ghost" style="display:none;font-size:16px;padding:10px 24px;">取消匹配</button>
            </div>
            <div id="arenaQueueInfo" style="margin-top:12px;color:var(--muted);font-size:13px;"></div>
            <div id="arenaMatchedInfo" style="display:none;margin-top:16px;">
              <div class="room-number" id="arenaRoomNumber" style="font-size:28px;"></div>
              <div style="margin-top:8px;color:var(--muted);">对手已找到！请切换到双人对战开始下棋</div>
              <button id="btnArenaGoPvp" style="margin-top:10px;">进入对局 →</button>
            </div>
          </div>
          <aside>
            <h3>🏆 公开赛战绩榜</h3>
            <div class="row">
              <button class="secondary" id="btnArenaRefreshStats">刷新</button>
            </div>
            <div id="arenaStatsList" class="list" style="max-height:320px;"></div>
          </aside>
        </div>
      </section>

      <!-- ── Rankings View ── -->
      <section class="panel" id="rankingsView">
        <h2>🏆 排行榜</h2>
        <div class="sub">积分榜 · 做题榜 · 对战榜</div>
        <div class="row" style="flex-wrap:wrap;">
          <button class="tab-btn active" id="btnRankGlobal" style="min-height:32px;">⭐ 积分榜</button>
          <button class="tab-btn" id="btnRankPuzzle" style="min-height:32px;">📝 做题榜</button>
          <button class="tab-btn" id="btnRankBattle" style="min-height:32px;">⚔ 对战榜</button>
          <button class="secondary" id="btnRefreshRankings" style="min-height:32px;">🔄 刷新</button>
        </div>
        <div id="rankingsTable" class="list" style="max-height:450px;"></div>
      </section>

        <!-- ── Friends View ── -->
        <section class="panel" id="friendsView">
          <h2>👥 好友</h2>
          <div class="split">
            <div>
              <div class="row">
                <input id="friendSearchInput" placeholder="搜索用户（姓名/手机号）" style="flex:1;" />
                <button id="btnFriendSearch">🔍 搜索</button>
              </div>
              <div id="friendSearchResults" style="margin-bottom:10px;"></div>

              <h3 id="friendRequestsHeader" style="display:none;">📩 好友请求</h3>
              <div id="friendRequestsList"></div>

              <h3>👫 我的好友</h3>
              <div class="row">
                <button class="secondary" id="btnRefreshFriends">刷新好友列表</button>
              </div>
              <div id="friendsList" class="list" style="max-height:260px;"></div>
              <div id="unreadSummary" style="margin-top:6px;"></div>
            </div>
            <aside id="chatContainer" style="display:none;">
              <div id="chatPanel" class="chat-panel" style="position:relative;bottom:auto;right:auto;width:auto;max-height:380px;box-shadow:none;">
                <div class="chat-header">
                  <b id="chatTitle">聊天</b>
                  <button class="ghost" id="btnCloseChat" style="min-height:28px;padding:2px 8px;font-size:11px;">✕</button>
                </div>
                <div class="chat-messages" id="chatMessages">
                  <div style="color:var(--muted);text-align:center;font-size:12px;">加载中...</div>
                </div>
                <div class="chat-input-row">
                  <input id="chatInput" placeholder="输入消息..." style="flex:1;" />
                  <button id="btnChatSend">发送</button>
                </div>
              </div>
            </aside>
          </div>
        </section>
    </div>
  </main>

  <!-- Footer -->
  <footer style="text-align:center;padding:30px 18px;color:rgba(255,255,255,.45);font-size:12px;position:relative;">
    <div style="margin-bottom:8px;font-size:16px;color:rgba(255,255,255,.6);">♜ 棋童</div>
    <div>棋童 · 国际象棋在线学习平台</div>
    <div style="margin-top:6px;">学习中心 · 题库训练 · 人机对战 · 双人对战 · 公开赛 · 积分榜</div>
  </footer>

<!-- Binding Code Modal -->
<div class="modal-overlay" id="bindModal" style="display:none;">
  <div class="modal-box">
    <h3 id="bindModalTitle">🔗 绑定</h3>
    <div id="bindModalBody"></div>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
      <button class="ghost" id="btnBindModalClose">关闭</button>
    </div>
  </div>
</div>

<!-- Notification toast container -->
<div class="notification-toast" id="toastContainer"></div>

<script>
(function () {
  var token = "";
  var problems = [];
  var currentProblem = null;
  var practiceSelected = "";
  var practiceHintIndex = 0;
  var matchId = "";
  var battleFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var battleSelected = "";
  var userRole = "";
  var editorFen = "8/8/8/8/8/8/8/8";
  var selectedPiece = "K";
  var currentClassId = "";
  var homeworksCache = {};
  var moves = [];
  var pieceMap = {
    p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
  };

  // ── PvP / Social State ────────────────────────────────────────
  var ws = null;
  var wsReconnectTimer = null;
  var myUserId = "";
  var pvpRoomId = "";
  var pvpFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var pvpSelected = "";
  var pvpMyColor = ""; // "white" or "black"
  var pvpStatus = ""; // "waiting" | "playing" | "finished"
  var pvpSelectedTime = { initialMinutes: 10, incrementSeconds: 0 };
  var pvpMoves = [];
  var whiteTimeMs = 0;
  var blackTimeMs = 0;
  var clockTimer = null;
  var activeChatFriendId = "";
  var friendsCache = [];
  var chatOpen = false;

  function byId(id) { return document.getElementById(id); }
  function aiSourceLabel(source) {
    return source === "ollama" ? "Ollama qwen3:8b" : source === "qwen" ? "Qwen API" : "本地兜底";
  }
  function engineSourceLabel(source) {
    return source === "stockfish" ? "Stockfish" : "fallback";
  }
  var navStack = ["homeView"];
  var sectionTitles = { homeView: "首页", learningCenter: "学习中心", practiceView: "题库训练", battleView: "人机对战", pvpView: "双人对战", friendsView: "好友", arenaView: "公开赛", rankingsView: "积分榜", classTeacherView: "班级管理", classStudentView: "我的班级", parentView: "家长中心" };

  function navigateTo(viewId) {
    // Prevent duplicate consecutive entries
    if (navStack[navStack.length - 1] === viewId) return;
    navStack.push(viewId);
    renderCurrentView();
  }
  function goBack() {
    if (navStack.length > 1) {
      navStack.pop();
      renderCurrentView();
    }
  }
  function renderCurrentView() {
    var currentView = navStack[navStack.length - 1];
    document.querySelectorAll(".panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === currentView);
    });
    // Home dashboard is outside .grid
    var homePanel = byId("homeView");
    if (homePanel) homePanel.classList.toggle("active", currentView === "homeView");
    // Back button
    var backBtn = byId("backBtn");
    if (backBtn) backBtn.style.display = navStack.length > 1 ? "" : "none";
    // Breadcrumb
    var bc = byId("breadcrumb");
    if (bc) {
      var html = "";
      for (var i = 0; i < navStack.length; i++) {
        if (i > 0) html += '<span class="crumb-arrow">›</span>';
        var isLast = i === navStack.length - 1;
        html += '<span class="' + (isLast ? "current" : "") + '" data-nav="' + navStack[i] + '">' + (sectionTitles[navStack[i]] || navStack[i]) + '</span>';
      }
      bc.innerHTML = html;
      // Click handlers on breadcrumb items
      bc.querySelectorAll("span[data-nav]").forEach(function (sp) {
        sp.onclick = function () {
          var target = sp.getAttribute("data-nav");
          // Navigate to that level by rewinding stack
          var idx = navStack.indexOf(target);
          if (idx >= 0) {
            navStack = navStack.slice(0, idx + 1);
            renderCurrentView();
          }
        };
      });
    }
    // Trigger role-specific refresh
    if (currentView === "pvpView") { refreshActiveRooms(); checkGameRequests(); }
    if (currentView === "friendsView") { loadFriends(); loadFriendRequests(); updateUnreadSummary(); checkGameRequests(); }
    if (currentView === "parentView") { loadMyChildren(); loadStudyPlans(); loadParentClasses(); }
    if (currentView === "arenaView") { loadArenaStats(); checkArenaStatus(); }
    if (currentView === "rankingsView") { loadRankings("global"); }
    if (currentView === "classTeacherView" && token) { loadTeacherClasses(); }
    if (currentView === "classStudentView" && token) { loadStudentClasses(); }
  }
  function api(path, method, body, authed) {
    return fetch(path, {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authed === false ? "" : (token ? "Bearer " + token : "")
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (raw) {
        var data;
        try { data = raw ? JSON.parse(raw) : {}; } catch (_e) { throw new Error("接口返回异常: " + raw); }
        if (!res.ok) throw new Error(data.message || ("请求失败(" + res.status + ")"));
        return data;
      });
    });
  }
  function sqName(row, col) { return "abcdefgh"[col] + String(8 - row); }
  function parseBoard(fenText) {
    var rows = (fenText || "8/8/8/8/8/8/8/8").split(" ")[0].split("/");
    return rows.map(function (r) {
      var line = [];
      for (var i = 0; i < r.length; i++) {
        var ch = r[i];
        if (ch >= "1" && ch <= "8") {
          for (var j = 0; j < Number(ch); j++) line.push("");
        } else {
          line.push(ch);
        }
      }
      return line;
    });
  }
  function renderBoard(id, fen, selected, onClick) {
    var board = byId(id);
    board.innerHTML = "";
    board.className = "board";
    var b = parseBoard(fen);
    var files = "abcdefgh";

    // 10x10 grid: row 0=top labels, rows 1-8=board, row 9=bottom labels
    // col 0=left ranks, cols 1-8=board, col 9=right ranks
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 10; c++) {
        // Four corners
        if ((r === 0 || r === 9) && (c === 0 || c === 9)) {
          var corner = document.createElement("div");
          corner.className = "corner-cell";
          board.appendChild(corner);
        }
        // Top file labels (a-h)
        else if (r === 0 && c >= 1 && c <= 8) {
          var fl = document.createElement("div");
          fl.className = "coord-label";
          fl.textContent = files[c - 1];
          board.appendChild(fl);
        }
        // Bottom file labels (a-h)
        else if (r === 9 && c >= 1 && c <= 8) {
          var fl2 = document.createElement("div");
          fl2.className = "coord-label";
          fl2.textContent = files[c - 1];
          board.appendChild(fl2);
        }
        // Left rank labels (8-1)
        else if (c === 0 && r >= 1 && r <= 8) {
          var rl = document.createElement("div");
          rl.className = "coord-label";
          rl.textContent = String(9 - r);
          board.appendChild(rl);
        }
        // Right rank labels (8-1)
        else if (c === 9 && r >= 1 && r <= 8) {
          var rl2 = document.createElement("div");
          rl2.className = "coord-label";
          rl2.textContent = String(9 - r);
          board.appendChild(rl2);
        }
        // Board cells: rows 1-8, cols 1-8
        else {
          (function (row, col) {
            var sq = sqName(row - 1, col - 1);
            var piece = b[row - 1][col - 1] || "";
            var cell = document.createElement("div");
            cell.className = "cell " + (((row + col) % 2 === 0) ? "light" : "dark") + (selected === sq ? " selected" : "");
            var span = document.createElement("span");
            span.className = "piece " + (piece === piece.toUpperCase() ? "white" : "black");
            span.textContent = pieceMap[piece] || "";
            cell.appendChild(span);
            cell.onclick = function () { onClick(sq, piece); };
            board.appendChild(cell);
          })(r, c);
        }
      }
    }
  }
  function quickLogin() {
    byId("loginTag").textContent = "登录中...";
    var phone = byId("phone").value.trim();
    var password = byId("password").value;
    api("/auth/login", "POST", { phone: phone, password: password }, false)
      .catch(function (err) {
        if (!String(err.message || err).includes("账号不存在")) throw err;
        return api("/auth/register", "POST", {
          phone: byId("phone").value.trim(),
          password: byId("password").value,
          role: byId("role").value,
          displayName: byId("name").value.trim() || "本地小骑士"
        }, false);
      })
      .then(function (data) {
        token = data.token;
        userRole = data.user.role;
        myUserId = data.user.id;
        // Show role-specific dashboard cards
        if (userRole === "teacher") {
          byId("dashClassTeacher").style.display = "";
          byId("dashClassStudent").style.display = "none";
          byId("dashParent").style.display = "none";
          byId("dashBindParent").style.display = "none";
        } else if (userRole === "student") {
          byId("dashClassStudent").style.display = "";
          byId("dashClassTeacher").style.display = "none";
          byId("dashParent").style.display = "none";
          byId("dashBindParent").style.display = "";
        } else {
          byId("dashClassTeacher").style.display = "none";
          byId("dashClassStudent").style.display = "";
          byId("dashParent").style.display = "";
          byId("dashBindParent").style.display = "none";
        }
        var rankInfo = getRankDisplay(data.user.points || 0);
        byId("loginTag").innerHTML = "已登录: " + data.user.displayName + " · " + rankInfo.piece + " " + rankInfo.title + " · " + (data.user.points || 0) + "分";

        // Save token to localStorage for session memory
        try { localStorage.setItem("chesstong_token", token); localStorage.setItem("chesstong_role", userRole); localStorage.setItem("chesstong_phone", byId("phone").value.trim()); localStorage.setItem("chesstong_name", byId("name").value.trim()); } catch(e) {}

        // Auto-fetch binding code for students
        if (userRole === "student") {
          fetchBindCode();
        } else {
          byId("bindCodeTag").style.display = "none";
        }

        // Connect WebSocket
        connectWebSocket();

        // Check for active PvP game
        checkActivePvpGame();
        // Load friends
        loadFriends();

        return loadProblems();
      })
      .catch(function (e) { byId("loginTag").textContent = String(e.message || e); });
  }
  function loadProblems() {
    if (!token) {
      byId("problemMeta").textContent = "请先登录。";
      return Promise.resolve();
    }
    return api("/problems/list", "GET", null, true).then(function (data) {
      problems = data.items || [];
      currentProblem = problems[0] || null;
      byId("problemMeta").innerHTML = "共加载 <b>" + problems.length + "</b> 道题目";
      renderProblemList();
      renderProblem();
    }).catch(function (e) {
      byId("problemMeta").textContent = String(e.message || e);
    });
  }
  function renderProblemList() {
    var list = byId("problemList");
    list.innerHTML = "";
    problems.forEach(function (p, index) {
      var btn = document.createElement("button");
      btn.className = "puzzle-item" + (currentProblem && currentProblem.id === p.id ? " active" : "");
      btn.textContent = String(index + 1).padStart(2, "0") + " · " + p.knowledgePoint + " · ★" + p.difficulty;
      btn.onclick = function () {
        currentProblem = p;
        practiceSelected = "";
        practiceHintIndex = 0;
        renderProblemList();
        renderProblem();
      };
      list.appendChild(btn);
    });
  }
  function renderProblem() {
    if (!currentProblem) {
      renderBoard("practiceBoard", "8/8/8/8/8/8/8/8", "", function () {});
      byId("problemMeta").textContent = "暂无题目。";
      return;
    }
    renderBoard("practiceBoard", currentProblem.fen, practiceSelected, onPracticeClick);
    byId("problemMeta").innerHTML = "<b>" + escapeHtml(currentProblem.question) + "</b><br><small style='opacity:0.7'>FEN: " + escapeHtml(currentProblem.fen) + "</small>";
    byId("problemTags").innerHTML = "";
    [currentProblem.knowledgePoint, "Rating " + (currentProblem.rating || "-"), "难度 " + currentProblem.difficulty].forEach(function (text, idx) {
      var tag = document.createElement("span");
      tag.className = "tag " + (idx === 0 ? "red" : "steel");
      tag.textContent = text;
      byId("problemTags").appendChild(tag);
    });
  }
  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
  function onPracticeClick(square, piece) {
    if (!currentProblem) return;
    if (!practiceSelected) {
      if (!piece || piece !== piece.toUpperCase()) {
        byId("practiceResult").textContent = "请先选择白方棋子。";
        return;
      }
      practiceSelected = square;
      renderProblem();
      return;
    }
    if (practiceSelected === square) {
      practiceSelected = "";
      renderProblem();
      return;
    }
    var move = practiceSelected + square;
    var answer = (currentProblem.solutionUci || "").length === 5 && move === currentProblem.solutionUci.slice(0, 4)
      ? currentProblem.solutionUci
      : move;
    submitPractice(answer);
  }
  function submitPractice(answer) {
    if (!token || !currentProblem) {
      byId("practiceResult").textContent = "请先登录并选择题目。";
      return;
    }
    practiceSelected = "";
    byId("practiceResult").textContent = "判题中...";
    api("/problems/submit", "POST", { problemId: currentProblem.id, answer: answer }, true)
      .then(function (submit) {
        var score = submit.awardedPoints ? " +" + submit.awardedPoints + "积分" : (submit.alreadySolved ? " 已答对过，不重复加分" : "");
        var header = submit.isCorrect ? "答对了！" + score : "还差一点。标准答案：" + submit.correctAnswer;
        return api("/problems/explain", "POST", {
          problemId: currentProblem.id,
          answer: answer,
          isCorrect: submit.isCorrect
        }, true).then(function (explain) {
          byId("practiceResult").innerHTML = escapeHtml(header) + "<br>讲解: " + escapeHtml(aiSourceLabel(explain.source)) + "<br><br>" + escapeHtml(explain.explanation);
          renderProblem();
        });
      })
      .catch(function (e) {
        byId("practiceResult").textContent = String(e.message || e);
        renderProblem();
      });
  }
  function showHint() {
    if (!currentProblem) return;
    var hints = currentProblem.hints || [];
    if (!hints.length) {
      byId("practiceResult").textContent = "这题没有提示，试着先找将军、吃子、威胁。";
      return;
    }
    byId("practiceResult").textContent = "提示：" + hints[Math.min(practiceHintIndex, hints.length - 1)];
    practiceHintIndex += 1;
  }
  function nextProblem() {
    if (!problems.length) return;
    var idx = Math.max(0, problems.findIndex(function (p) { return currentProblem && p.id === currentProblem.id; }));
    currentProblem = problems[(idx + 1) % problems.length];
    practiceSelected = "";
    renderProblemList();
    renderProblem();
  }
  function startMatch() {
    if (!token) {
      byId("battleStatus").textContent = "请先登录。";
      return;
    }
    api("/match/start", "POST", {
      mode: byId("mode").value,
      difficulty: Number(byId("difficulty").value || 8)
    }, true).then(function (data) {
      matchId = data.matchId;
      battleFen = data.matchState;
      battleSelected = "";
      moves = [];
      renderBattle();
      renderMoves();
      byId("battleStatus").textContent = "对局开始，你执白方。";
    }).catch(function (e) { byId("battleStatus").textContent = String(e.message || e); });
  }
  function renderBattle() {
    renderBoard("battleBoard", battleFen, battleSelected, onBattleClick);
    var turn = (battleFen.split(" ")[1] || "-");
    byId("turnTag").textContent = "轮到: " + (turn === "w" ? "白方" : turn === "b" ? "黑方" : "-");
  }
  function onBattleClick(square, piece) {
    if (!matchId) {
      byId("battleStatus").textContent = "请先开始对局。";
      return;
    }
    if (!battleSelected) {
      if (!piece || piece !== piece.toUpperCase()) {
        byId("battleStatus").textContent = "请先选择白方棋子。";
        return;
      }
      battleSelected = square;
      renderBattle();
      return;
    }
    if (battleSelected === square) {
      battleSelected = "";
      renderBattle();
      return;
    }
    submitBattle(battleSelected + square);
  }
  function submitBattle(moveText) {
    if (!matchId) {
      byId("battleStatus").textContent = "请先开始对局。";
      return;
    }
    api("/match/move", "POST", {
      matchId: matchId,
      fen: battleFen,
      move: moveText,
      difficulty: Number(byId("difficulty").value || 8)
    }, true).then(function (data) {
      battleFen = data.fenAfter;
      battleSelected = "";
      if (data.playerMove) moves.push(data.playerMove);
      if (data.engineMove) moves.push(data.engineMove);
      byId("sourceTag").textContent = "引擎: " + engineSourceLabel(data.engineSource);
      byId("engineTag").textContent = "Stockfish: " + (data.engineSource === "stockfish" ? "已接入" : "fallback");
      byId("battleStatus").innerHTML = "你走: " + escapeHtml(data.playerMove || moveText) + "<br>AI: " + escapeHtml(data.engineMove || "无") + (data.gameOver ? "<br>对局结束。" : "");
      renderBattle();
      renderMoves();
    }).catch(function (e) {
      battleSelected = "";
      byId("battleStatus").textContent = String(e.message || e);
      renderBattle();
    });
  }
  function suggest() {
    if (!matchId) {
      byId("analysis").textContent = "请先开始对局。";
      return;
    }
    api("/match/suggest", "POST", {
      fen: battleFen,
      difficulty: Number(byId("difficulty").value || 8)
    }, true).then(function (data) {
      byId("analysis").innerHTML = "建议: " + escapeHtml(data.move || "无") + "<br>引擎: " + escapeHtml(engineSourceLabel(data.source)) + "<br>原因: " + escapeHtml(data.reason) + "<br>" + (data.plan || []).map(function(l){return escapeHtml(l);}).join("<br>");
    }).catch(function (e) { byId("analysis").textContent = String(e.message || e); });
  }
  function renderMoves() {
    if (!moves.length) {
      byId("moveList").textContent = "暂无走子。";
      return;
    }
    var lines = [];
    for (var i = 0; i < moves.length; i += 2) {
      lines.push((Math.floor(i / 2) + 1) + ". " + (moves[i] || "") + "   " + (moves[i + 1] || ""));
    }
    byId("moveList").innerHTML = lines.map(function(l){return escapeHtml(l);}).join("<br>");
  }
  function buildPgn() {
    var pgn = [];
    for (var i = 0; i < moves.length; i += 2) {
      pgn.push((Math.floor(i / 2) + 1) + ". " + (moves[i] || "") + (moves[i + 1] ? " " + moves[i + 1] : ""));
    }
    return pgn.join(" ");
  }
  function analyze() {
    var pgn = buildPgn();
    if (!pgn) {
      byId("analysis").textContent = "暂无走子，无法复盘。";
      return;
    }
    api("/match/analyze", "POST", { pgn: pgn }, true).then(function (data) {
      var keyMoves = (data.keyMoves || []).map(function (m) { return "第" + m.ply + "手 " + escapeHtml(m.san) + "（" + escapeHtml(m.tag) + "）"; }).join("<br>");
      byId("analysis").innerHTML = "讲解: " + escapeHtml(aiSourceLabel(data.source)) + "<br>" + escapeHtml(data.summary) + "<br><br>关键着法:<br>" + (keyMoves || "暂无明显关键着法");
    }).catch(function (e) { byId("analysis").textContent = String(e.message || e); });
  }

  // ── Class management ──────────────────────────────────────────

  var pieceMapFull = { K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟",".":"·" };

  function renderEditorBoard() {
    var board = byId("editorBoard");
    if (!board) return;
    var pc = { K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟" };
    board.innerHTML = "";
    board.className = "board editor-board";
    var b = parseBoard(editorFen);
    var files = "abcdefgh";

    // 10x10 grid with four-sided coordinate labels
    for (var r = 0; r < 10; r++) {
      for (var c = 0; c < 10; c++) {
        // Four corners
        if ((r === 0 || r === 9) && (c === 0 || c === 9)) {
          var corner = document.createElement("div");
          corner.className = "corner-cell";
          board.appendChild(corner);
        }
        // Top file labels
        else if (r === 0 && c >= 1 && c <= 8) {
          var fl = document.createElement("div");
          fl.className = "coord-label";
          fl.textContent = files[c - 1];
          board.appendChild(fl);
        }
        // Bottom file labels
        else if (r === 9 && c >= 1 && c <= 8) {
          var fl2 = document.createElement("div");
          fl2.className = "coord-label";
          fl2.textContent = files[c - 1];
          board.appendChild(fl2);
        }
        // Left rank labels
        else if (c === 0 && r >= 1 && r <= 8) {
          var rl = document.createElement("div");
          rl.className = "coord-label";
          rl.textContent = String(9 - r);
          board.appendChild(rl);
        }
        // Right rank labels
        else if (c === 9 && r >= 1 && r <= 8) {
          var rl2 = document.createElement("div");
          rl2.className = "coord-label";
          rl2.textContent = String(9 - r);
          board.appendChild(rl2);
        }
        // Board cells
        else {
          var f = c - 1;
          var file = String.fromCharCode(97 + f);
          var rank = 9 - r;  // r=1..8 gives rank=8..1
          var sq = file + rank;
          var piece = b[r - 1][f] || "";
          var cell = document.createElement("div");
          cell.className = "cell " + ((r + f) % 2 === 0 ? "light" : "dark");
          cell.textContent = pc[piece] || "";
          cell.onclick = (function (s, p) { return function () { onEditorClick(s, p); }; })(sq, piece);
          board.appendChild(cell);
        }
      }
    }
    var fenEl = byId("editorFenDisplay");
    if (fenEl) fenEl.textContent = "FEN: " + editorFen;
  }

  function boardToFen(board) {
    // board[r][f]  r=0..7 (rank8..rank1)  f=0..7 (a..h)
    var rows = [];
    for (var r = 0; r < 8; r++) {
      var row = "";
      var empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = board[r][f] || "";
        if (p) {
          if (empty) { row += empty; empty = 0; }
          row += p;
        } else {
          empty++;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join("/") + " w - - 0 1";
  }

  function onEditorClick(sq, existing) {
    var b = parseBoard(editorFen);
    var file = sq.charCodeAt(0) - 97;
    var rank = 8 - parseInt(sq[1]);
    if (selectedPiece === ".") {
      b[rank][file] = "";
    } else {
      var color = selectedPiece === selectedPiece.toUpperCase() ? "w" : "b";
      var fenChar = color === "w" ? selectedPiece : selectedPiece.toLowerCase();
      b[rank][file] = fenChar;
    }
    editorFen = boardToFen(b);
    renderEditorBoard();
  }

  function setEditorPiece(piece) {
    selectedPiece = piece;
    document.querySelectorAll(".palette-piece").forEach(function (el) {
      el.classList.toggle("selected", el.getAttribute("data-piece") === piece);
    });
  }

  // Teacher: load classes
  function loadTeacherClasses() {
    api("/class/my-classes", "GET", null, true).then(function (data) {
      var sel = byId("clsSelect");
      sel.innerHTML = '<option value="">-- 选择班级 --</option>';
      (data.items || []).forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name + " (" + c.memberCount + "人) 邀请码:" + c.inviteCode;
        sel.appendChild(opt);
      });
    }).catch(function (e) { console.error(e); });
  }

  // Teacher: create class
  function createClass() {
    var name = byId("clsName").value.trim();
    if (!name) { byId("createResult").textContent = "请输入班级名称。"; return; }
    var code = byId("clsCode").value.trim();
    var payload = { name: name };
    if (code.length === 6) payload.inviteCode = code;
    else if (code.length > 0 && code.length !== 6) { byId("createResult").textContent = "邀请码必须为6位数字。"; return; }
    api("/class/create", "POST", payload, true).then(function (data) {
      byId("createResult").innerHTML = "班级「<b>" + data.class.name + "</b>」创建成功！邀请码：<span class='invite-code'>" + data.inviteCode + "</span>";
      loadTeacherClasses();
      // Auto-select the new class after reload
      setTimeout(function() { byId("clsSelect").value = data.class.id; showClassDetail(data.class.id); }, 300);
    }).catch(function (e) { byId("createResult").textContent = String(e.message || e); });
  }

  // Teacher: show class detail
  function showClassDetail(classId) {
    if (!classId) { byId("classTeacherDetail").innerHTML = ""; return; }
    currentClassId = classId;
    api("/class/" + classId, "GET", null, true).then(function (data) {
      var html = "";

      // Notice form
      html += "<div class='row'><input id='noticeMsg' placeholder='发布班级公告...' style='flex:1;' /><button id='btnSendNotice'>发送公告</button></div>";
      html += "<div id='noticeResult'></div>";

      // Notices
      if (data.notices && data.notices.length > 0) {
        html += "<h3>📢 公告</h3>";
        data.notices.forEach(function (n) {
          html += "<div class='class-card'><b>" + (n.creatorName || "老师") + "</b>: " + escapeHtml(n.message) + "<br><small>" + n.createdAt + "</small></div>";
        });
      }

      // Board editor
      html += "<h3>♟ 棋盘编辑器</h3>";
      html += "<div class='piece-palette'>";
      ["K","Q","R","B","N","P","k","q","r","b","n","p","."].forEach(function (p) {
        var label = p === "." ? "✕" : pieceMapFull[p] || p;
        html += "<button class='palette-piece" + (p === selectedPiece ? " selected" : "") + "' data-piece='" + p + "' title='" + p + "'>" + label + "</button>";
      });
      html += "</div>";
      html += "<div class='split'><div><div id='editorBoard' class='board editor-board'></div></div><aside>";
      html += "<div id='editorFenDisplay' style='font-size:11px;word-break:break-all;margin-bottom:8px;'>FEN: " + editorFen + "</div>";
      html += "<div class='row'><input id='hwTitle' placeholder='作业标题' style='flex:1;' /><input id='hwDue' type='date' value='" + new Date(Date.now()+7*86400000).toISOString().slice(0,10) + "' /></div>";
      html += "<div class='row'><input id='hwSolutions' placeholder='标准答案，多个用逗号分隔（如 Ra8#,Ra8,a1a8）' style='flex:1;' /></div>";
      html += "<button id='btnSaveHomework'>保存并布置作业</button>";
      html += "</aside></div>";

      // Homework list
      html += "<h3>📝 已布置作业</h3>";
      if (data.homeworks && data.homeworks.length > 0) {
        data.homeworks.forEach(function (h) {
          var answers = (h.acceptedAnswers || []).join(", ") || "无";
          html += "<div class='homework-card'><b>" + escapeHtml(h.title) + "</b> · 提交:" + h.submitCount + " · 截止:" + h.dueDate + "<br><small>正解: " + answers + " | FEN: " + h.fen + "</small></div>";
        });
      } else {
        html += "<div class='feed'>暂无作业，用棋盘编辑器布置第一份作业吧！</div>";
      }

      // Members
      html += "<h3>👥 成员 (" + data.memberCount + ")</h3><div class='member-list'>";
      (data.members || []).forEach(function (m) {
        var roleLabel = m.role==="teacher"?"老师":m.role==="student"?"学生":"家长";
        html += "<div class='member-row'><span class='tag " + (m.role==="teacher"?"red":"steel") + "'>" + roleLabel + "</span> " + escapeHtml(m.displayName) + " · Lv." + m.level + " · " + m.points + "分</div>";
      });
      html += "</div>";

      byId("classTeacherDetail").innerHTML = html;

      // Re-render editor board
      setTimeout(renderEditorBoard, 100);

      // Bind events
      var paletteBtns = document.querySelectorAll(".palette-piece");
      paletteBtns.forEach(function (btn) {
        btn.onclick = function () { setEditorPiece(btn.getAttribute("data-piece")); };
      });
      var sendBtn = byId("btnSendNotice");
      if (sendBtn) sendBtn.onclick = sendNotice;
      var saveBtn = byId("btnSaveHomework");
      if (saveBtn) saveBtn.onclick = saveHomework;
    }).catch(function (e) { byId("classTeacherDetail").textContent = String(e.message || e); });
  }

  function sendNotice() {
    var msg = byId("noticeMsg").value.trim();
    if (!msg) return;
    api("/class/" + currentClassId + "/notice", "POST", { message: msg }, true).then(function () {
      byId("noticeResult").textContent = "公告已发送！";
      byId("noticeMsg").value = "";
      showClassDetail(currentClassId);
    }).catch(function (e) { byId("noticeResult").textContent = String(e.message || e); });
  }

  function saveHomework() {
    var title = byId("hwTitle").value.trim();
    if (!title) { alert("请输入作业标题"); return; }
    var due = byId("hwDue").value;
    var solRaw = byId("hwSolutions").value.trim();
    var solutions = solRaw ? solRaw.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
    var payload = { title: title, fen: editorFen, dueDate: due, solutions: solutions };
    api("/class/" + currentClassId + "/homework", "POST", payload, true).then(function () {
      editorFen = "8/8/8/8/8/8/8/8";
      renderEditorBoard();
      showClassDetail(currentClassId);
    }).catch(function (e) { alert(String(e.message || e)); });
  }

  // Student: load classes
  function loadStudentClasses() {
    api("/class/my-classes", "GET", null, true).then(function (data) {
      var sel = byId("stuClsSelect");
      sel.innerHTML = '<option value="">-- 选择班级 --</option>';
      (data.items || []).forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name + " (" + c.memberCount + "人)";
        sel.appendChild(opt);
      });
    }).catch(function (e) { console.error(e); });
  }

  // Student: join class
  function joinClass() {
    var code = byId("joinCode").value.trim();
    if (code.length !== 6) { byId("joinResult").textContent = "请输入6位邀请码。"; return; }
    api("/class/join", "POST", { inviteCode: code }, true).then(function (data) {
      byId("joinResult").innerHTML = "✅ " + data.message;
      loadStudentClasses();
    }).catch(function (e) { byId("joinResult").textContent = String(e.message || e); });
  }

  // Student: show class detail
  function showStudentClassDetail(classId) {
    if (!classId) { byId("classStudentDetail").innerHTML = ""; return; }
    currentClassId = classId;
    api("/class/" + classId, "GET", null, true).then(function (data) {
      var html = "";

      // Notices
      if (data.notices && data.notices.length > 0) {
        html += "<h3>📢 公告</h3>";
        data.notices.forEach(function (n) {
          html += "<div class='class-card'><b>" + (n.creatorName || "老师") + "</b>: " + escapeHtml(n.message) + "<br><small>" + n.createdAt + "</small></div>";
        });
      }

      // Homework
      html += "<h3>📝 作业</h3>";
      if (data.homeworks && data.homeworks.length > 0) {
        data.homeworks.forEach(function (h) {
          var submitted = h.submitCount > 0;
          homeworksCache[h.id] = h.fen;
          html += "<div class='homework-card" + (submitted ? " solved" : "") + "' data-hwid='" + h.id + "'>";
          html += "<b>" + escapeHtml(h.title) + "</b> " + (submitted ? "✅" : "⬜") + " · 截止:" + h.dueDate + "</div>";
        });
      } else {
        html += "<div class='feed'>暂无作业。</div>";
      }

      html += "<div id='hwSolveArea'></div>";

      byId("classStudentDetail").innerHTML = html;

      // Bind click on homework cards
      setTimeout(function () {
        var cards = document.querySelectorAll("#classStudentDetail .homework-card");
        cards.forEach(function (card) {
          card.onclick = function () {
            var hwId = card.getAttribute("data-hwid");
            var hwFen = homeworksCache[hwId] || "";
            selectHomework(hwId, hwFen);
          };
        });
      }, 50);
    }).catch(function (e) { byId("classStudentDetail").textContent = String(e.message || e); });
  }

  // Student: select homework → load into practice board
  function selectHomework(hwId, hwFen) {
    currentProblem = { id: "hw-" + hwId, fen: hwFen, question: "班级作业", solution: "", solutionUci: "", acceptedAnswers: [], knowledgePoint: "作业", difficulty: 0, rating: 0 };
    navigateTo("practiceView");
    renderProblem();
    byId("classStudentDetail").querySelector("#hwSolveArea").innerHTML = "<div class='row' style='margin-top:8px;'><span class='tag red'>题目已加载到做题训练区</span><input id='hwAnswer' placeholder='输入答案' style='flex:1;' /><button id='btnHwSubmit'>提交作业</button></div><div id='hwSubmitResult'></div>";
    var submitBtn = byId("btnHwSubmit");
    if (submitBtn) submitBtn.onclick = function () { submitHomework(hwId); };
  };

  function submitHomework(hwId) {
    var ans = byId("hwAnswer").value.trim();
    if (!ans) return;
    api("/class/" + currentClassId + "/homework/" + hwId + "/submit", "POST", { answer: ans }, true).then(function (data) {
      byId("hwSubmitResult").textContent = data.isCorrect ? "✅ 回答正确！" : "❌ 回答错误，请再试。";
    }).catch(function (e) { byId("hwSubmitResult").textContent = String(e.message || e); });
  }

  // ── Binding Code for Students ──────────────────────────────

  var bindCountdownTimer = null;
  function fetchBindCode() {
    api("/student/my-code", "GET", null, true)
      .then(function (data) {
        var tag = byId("bindCodeTag");
        tag.style.display = "";
        tag.textContent = "绑定码: " + data.code;
        tag.style.cursor = "pointer";
        tag.title = "点击查看绑定码（5分钟有效）";
        tag.onclick = function () { showStudentBindModal(data); };
      })
      .catch(function () { byId("bindCodeTag").style.display = "none"; });
  }

  function showStudentBindModal(data) {
    var expiresIn = data.expiresInSeconds || 300;
    var code = data.code;
    byId("bindModalTitle").textContent = "🔗 你的绑定码（发给家长）";
    var html = "<div style='text-align:center;'>";
    html += "<div style='font-size:52px;font-weight:800;letter-spacing:10px;color:var(--banner);margin:16px 0;'>" + code + "</div>";
    html += "<div id='bindCountdown' style='font-size:16px;color:var(--muted);'>⏱ 剩余时间: " + formatCountdown(expiresIn) + "</div>";
    html += "<div style='margin-top:12px;font-size:13px;color:var(--muted);line-height:1.6;'>";
    html += "📤 <b>你</b>把这个码发给<b>家长</b><br>";
    html += "📥 <b>家长</b>在Ta的仪表盘→家长中心→输入此码<br>";
    html += "✅ 5分钟内输入有效，过期需重新生成";
    html += "</div>";
    html += "<button id='btnRegenCode' class='ghost' style='margin-top:12px;'>🔄 重新生成</button>";
    html += "</div>";
    byId("bindModalBody").innerHTML = html;
    byId("bindModal").style.display = "flex";
    // Countdown
    if (bindCountdownTimer) clearInterval(bindCountdownTimer);
    var remaining = expiresIn;
    bindCountdownTimer = setInterval(function () {
      remaining--;
      var el = byId("bindCountdown");
      if (el) el.textContent = "剩余时间: " + formatCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(bindCountdownTimer);
        if (el) { el.textContent = "已过期"; el.style.color = "var(--banner)"; }
      }
    }, 1000);
    // Regen button
    setTimeout(function () {
      var btn = byId("btnRegenCode");
      if (btn) btn.onclick = function () {
        clearInterval(bindCountdownTimer);
        api("/student/regenerate-code", "POST", null, true)
          .then(function (newData) { showStudentBindModal(newData); })
          .catch(function (e) { showToast(String(e.message || e)); });
      };
    }, 200);
  }

  function formatCountdown(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + "分" + (s < 10 ? "0" : "") + s + "秒";
  }

  // ── Parent Dashboard ─────────────────────────────────────────

  // Binding: bind child via 6-digit code
  function bindChild() {
    var code = byId("bindCode").value.trim();
    if (code.length !== 6) { byId("bindResult").textContent = "请输入6位绑定码。"; return; }
    byId("bindResult").textContent = "绑定中...";
    api("/parent/bind-child", "POST", { code: code }, true)
      .then(function (data) {
        byId("bindResult").innerHTML = "✅ " + data.message;
        byId("bindCode").value = "";
        loadMyChildren();
      })
      .catch(function (e) { byId("bindResult").textContent = String(e.message || e); });
  }

  // Load bound children list
  function loadMyChildren() {
    api("/parent/my-children", "GET", null, true)
      .then(function (data) {
        var container = byId("childrenList");
        container.innerHTML = "";
        var planSel = byId("planChildSelect");
        planSel.innerHTML = '<option value="">-- 选择孩子 --</option>';
        var reportSel = byId("reportChildSelect");
        reportSel.innerHTML = '<option value="">-- 选择孩子 --</option>';
        if (!data.children || data.children.length === 0) {
          container.innerHTML = "<div class='feed'>尚未绑定孩子，请先使用绑定码绑定。</div>";
          return;
        }
        data.children.forEach(function (ch) {
          // List item
          var card = document.createElement("div");
          card.className = "class-card";
          card.style.cssText = "cursor:pointer;display:flex;justify-content:space-between;align-items:center;";
          var infoDiv = document.createElement("div");
          infoDiv.style.flex = "1";
          infoDiv.innerHTML = "<b>" + escapeHtml(ch.childName) + "</b> · " + (ch.rankTitle || "") + " · " + ch.points + "分<br>" +
            "<small>总做题:" + ch.totalAttempts + " · 正确率:" + ch.accuracy + "% · 今日做题:" + ch.todaySolve + " · 今日对战:" + ch.todayBattle + "</small>";
          infoDiv.onclick = (function (id) { return function () { showChildDetail(id); }; })(ch.childId);
          card.appendChild(infoDiv);
          container.appendChild(card);

          // Plan select option
          var opt = document.createElement("option");
          opt.value = ch.childId;
          opt.textContent = ch.childName;
          planSel.appendChild(opt);

          // Report select option
          var rOpt = document.createElement("option");
          rOpt.value = ch.childId;
          rOpt.textContent = ch.childName;
          byId("reportChildSelect").appendChild(rOpt);
        });
        // Set plan date defaults
        var todayStr = new Date().toISOString().slice(0, 10);
        var weekLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        byId("planStartDate").value = todayStr;
        byId("planEndDate").value = weekLater;
      })
      .catch(function (e) { byId("childrenList").innerHTML = "<div class='feed'>加载失败: " + escapeHtml(String(e.message || e)) + "</div>"; });
  }

  // Show child detail
  function showChildDetail(childId) {
    byId("childDetail").textContent = "加载中...";
    api("/parent/child/" + childId + "/detail", "GET", null, true)
      .then(function (data) {
        var html = "<b>" + escapeHtml(data.childName) + "</b> · Lv." + data.level + " · " + data.points + "分<br>";
        html += "<small>总做题:" + data.totalAttempts + " · 正确率:" + data.accuracy + "% · 今日做题:" + data.todaySolve + " · 今日对战:" + data.todayBattle + "</small>";

        // Recent attempts
        html += "<h4 style='margin-bottom:4px;'>📝 最近做题</h4>";
        if (data.recentAttempts && data.recentAttempts.length > 0) {
          html += "<div class='list' style='max-height:120px;'>";
          data.recentAttempts.forEach(function (a) {
            html += "<div class='class-card' style='font-size:12px;'>" +
              (a.isCorrect ? "✅" : "❌") + " " + escapeHtml(a.answer) +
              " <small>" + a.submittedAt + "</small></div>";
          });
          html += "</div>";
        } else {
          html += "<div class='feed' style='font-size:12px;'>暂无做题记录。</div>";
        }

        // Recent matches
        html += "<h4 style='margin-bottom:4px;'>⚔ 最近对战</h4>";
        if (data.recentMatches && data.recentMatches.length > 0) {
          html += "<div class='list' style='max-height:120px;'>";
          data.recentMatches.forEach(function (m) {
            var resEmoji = m.result === "win" ? "🏆" : m.result === "lose" ? "💔" : "🤝";
            html += "<div class='class-card' style='font-size:12px;'>" +
              resEmoji + " " + m.mode + " · 难度:" + m.difficulty +
              " <small>" + m.createdAt + "</small></div>";
          });
          html += "</div>";
        } else {
          html += "<div class='feed' style='font-size:12px;'>暂无对战记录。</div>";
        }

        // Homework attempts
        html += "<h4 style='margin-bottom:4px;'>📚 作业记录</h4>";
        if (data.homeworkAttempts && data.homeworkAttempts.length > 0) {
          html += "<div class='list' style='max-height:120px;'>";
          data.homeworkAttempts.forEach(function (a) {
            html += "<div class='class-card' style='font-size:12px;'>" +
              (a.isCorrect ? "✅" : "❌") + " " + escapeHtml(a.homeworkTitle) +
              " <small>" + a.submittedAt + "</small></div>";
          });
          html += "</div>";
        } else {
          html += "<div class='feed' style='font-size:12px;'>暂无作业记录。</div>";
        }

        byId("childDetail").innerHTML = html;
      })
      .catch(function (e) { byId("childDetail").textContent = String(e.message || e); });
  }

  // ── Weekly Report ─────────────────────────────────────────────
  function generateChildReport(childId, childName) {
    byId("childDetail").innerHTML = "<div class='feed'>正在生成周报，请稍候...</div>";
    api("/parent/child/" + childId + "/generate-report", "POST", {}, true)
      .then(function (data) {
        var r = data.report;
        var cachedTag = data.cached ? " <span class='tag' style='font-size:10px;'>已缓存</span>" : "";
        var html = "<h3>📊 " + escapeHtml(childName) + " 周报" + cachedTag + "</h3>";
        html += "<div class='feed' style='line-height:1.6;'>";
        html += "<p><b>周期：</b>" + (r.weekStart || "").slice(0, 10) + " ~ " + (r.weekEnd || "").slice(0, 10) + "</p>";
        html += "<p><b>段位：</b>" + escapeHtml(r.currentRank || "") + " · <b>积分：</b>" + r.currentPoints + "分（本周+" + r.pointsGained + "）</p>";
        html += "<div style='display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0;text-align:center;'>";
        html += "<div class='class-card'><b style='font-size:22px;'>" + r.solveCount + "</b><br><small>正确解题</small></div>";
        html += "<div class='class-card'><b style='font-size:22px;'>" + r.battleCount + "</b><br><small>对战局数</small></div>";
        html += "<div class='class-card'><b style='font-size:22px;'>" + r.pvpWins + "胜</b><br><small>" + r.pvpLosses + "负" + r.pvpDraws + "平</small></div>";
        html += "</div>";
        if (r.aiCommentary) {
          html += "<h4>🤖 AI评语</h4>";
          html += "<div class='feed' style='background:rgba(53,89,67,.12);border-left:3px solid var(--green);'>" + escapeHtml(r.aiCommentary) + "</div>";
        }
        if (r.suggestions && r.suggestions.length) {
          html += "<h4>💡 建议</h4>";
          r.suggestions.forEach(function (s) {
            html += "<div class='tag' style='margin:2px;'>📌 " + escapeHtml(s) + "</div>";
          });
        }
        html += "</div>";
        html += "<div class='row' style='margin-top:10px;'><button class='secondary' id='btnLoadReports'>查看历史周报</button></div>";
        byId("childDetail").innerHTML = html;
        var loadBtn = byId("btnLoadReports");
        if (loadBtn) loadBtn.onclick = function () { loadWeeklyReports(childId, childName); };
      })
      .catch(function (e) { byId("childDetail").innerHTML = "<div class='feed' style='color:var(--banner);'>生成失败: " + escapeHtml(String(e.message || e)) + "</div>"; });
  }

  function renderReportResult(r, childName, cached) {
    var cachedTag = cached ? " <span class='tag' style='font-size:10px;'>已缓存</span>" : "";
    var html = "<h4>📊 " + escapeHtml(childName) + " 本周报告" + cachedTag + "</h4>";
    html += "<div class='feed' style='line-height:1.6;'>";
    html += "<p><b>📅 周期：</b>" + (r.weekStart || "").slice(0, 10) + " ~ " + (r.weekEnd || "").slice(0, 10) + "</p>";
    html += "<p><b>🏆 段位：</b>" + escapeHtml(r.currentRank || "") + " · <b>积分：</b>" + r.currentPoints + "分（<span style='color:var(--green);'>本周+" + r.pointsGained + "</span>）</p>";
    html += "<div style='display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0;text-align:center;'>";
    html += "<div class='class-card'><b style='font-size:22px;'>" + r.solveCount + "</b><br><small>✅ 正确解题</small></div>";
    html += "<div class='class-card'><b style='font-size:22px;'>" + r.battleCount + "</b><br><small>⚔ 对战局数</small></div>";
    html += "<div class='class-card'><b style='font-size:22px;color:var(--green);'>" + r.pvpWins + "</b><br><small>🏅 胜利</small></div>";
    html += "<div class='class-card'><b style='font-size:22px;color:var(--banner);'>" + r.pvpLosses + "</b><br><small>💪 失利</small></div>";
    html += "</div>";
    if (r.aiCommentary) {
      html += "<h4>🤖 AI评语</h4>";
      html += "<div class='feed' style='background:rgba(53,89,67,.12);border-left:3px solid var(--green);'>" + escapeHtml(r.aiCommentary) + "</div>";
    }
    if (r.suggestions && r.suggestions.length) {
      html += "<h4>💡 个性化建议</h4>";
      r.suggestions.forEach(function (s, i) {
        var icons = ["📌", "🎯", "💪", "📖", "⭐"];
        html += "<div style='padding:4px 0;font-size:13px;'>" + (icons[i] || "•") + " " + escapeHtml(s) + "</div>";
      });
    }
    html += "</div>";
    byId("reportResult").innerHTML = html;
  }

  function loadWeeklyReports(childId, childName) {
    api("/parent/child/" + childId + "/reports", "GET", null, true)
      .then(function (data) {
        var html = "<h4>📊 " + escapeHtml(childName) + " 历史周报</h4>";
        if (!data.items || !data.items.length) {
          html += "<div class='feed'>暂无历史报告，请先生成本周报告</div>";
        } else {
          data.items.forEach(function (r) {
            html += "<div class='class-card' style='margin-bottom:10px;'>";
            html += "<b>📅 " + (r.weekStart || "").slice(0, 10) + " ~ " + (r.weekEnd || "").slice(0, 10) + "</b>";
            html += " · 解题" + r.solveCount + " · 对战" + r.battleCount + " · " + r.pvpWins + "胜" + r.pvpLosses + "负<br>";
            if (r.aiCommentary) {
              html += "<small style='color:var(--muted);'>💬 " + escapeHtml(r.aiCommentary).substring(0, 150) + "...</small>";
            }
            html += "</div>";
          });
        }
        byId("reportResult").innerHTML = html;
      })
      .catch(function (e) { byId("reportResult").innerHTML = "<div class='feed'>加载失败: " + escapeHtml(String(e.message || e)) + "</div>"; });
  }

  // Study plan: create
  function createStudyPlan() {
    var childId = byId("planChildSelect").value;
    if (!childId) { byId("planCreateResult").textContent = "请选择孩子。"; return; }
    var solveTarget = Number(byId("planSolveTarget").value) || 0;
    var battleTarget = Number(byId("planBattleTarget").value) || 0;
    var startDate = byId("planStartDate").value;
    var endDate = byId("planEndDate").value;
    if (!startDate || !endDate) { byId("planCreateResult").textContent = "请选择起止日期。"; return; }
    byId("planCreateResult").textContent = "创建中...";
    api("/parent/study-plan", "POST", {
      childId: childId,
      dailySolveTarget: solveTarget,
      dailyBattleTarget: battleTarget,
      startDate: startDate,
      endDate: endDate
    }, true)
      .then(function () {
        byId("planCreateResult").textContent = "学习计划创建成功！";
        loadStudyPlans();
      })
      .catch(function (e) { byId("planCreateResult").textContent = String(e.message || e); });
  }

  // Study plan: load list
  function loadStudyPlans() {
    api("/parent/study-plans", "GET", null, true)
      .then(function (data) {
        var container = byId("planList");
        container.innerHTML = "";
        if (!data.plans || data.plans.length === 0) {
          container.innerHTML = "<div class='feed'>暂无学习计划。</div>";
          return;
        }
        data.plans.forEach(function (p) {
          var solveBar = p.dailySolveTarget > 0
            ? "<div style='background:#355943;height:4px;border-radius:2px;width:" + Math.min(100, p.solveProgress) + "%;'></div>"
            : "";
          var battleBar = p.dailyBattleTarget > 0
            ? "<div style='background:#8b1f22;height:4px;border-radius:2px;width:" + Math.min(100, p.battleProgress) + "%;'></div>"
            : "";
          var card = document.createElement("div");
          card.className = "class-card";
          card.innerHTML = "<b>" + escapeHtml(p.childName) + "</b> · 做题:" + p.todaySolve + "/" + p.dailySolveTarget + " · 对战:" + p.todayBattle + "/" + p.dailyBattleTarget + "<br>" +
            (solveBar || battleBar ? "<div style='margin:4px 0;'>" + solveBar + (solveBar && battleBar ? "<div style='height:2px;'></div>" : "") + battleBar + "</div>" : "") +
            "<small>" + p.startDate + " ~ " + p.endDate +
            " <button class='ghost' style='min-height:24px;font-size:11px;padding:2px 6px;margin-left:4px;' data-action='delete-plan' data-planid='" + p.id + "'>删除</button></small>";
          container.appendChild(card);
        });
        // Bind delete buttons
        setTimeout(function () {
          var delBtns = document.querySelectorAll("#planList [data-action='delete-plan']");
          delBtns.forEach(function (btn) {
            btn.onclick = function () { deleteStudyPlan(btn.getAttribute("data-planid")); };
          });
        }, 50);
      })
      .catch(function (e) { byId("planList").innerHTML = "<div class='feed'>加载失败</div>"; });
  }

  // Study plan: delete
  function deleteStudyPlan(planId) {
    if (!confirm("确定删除此学习计划？")) return;
    api("/parent/study-plan/" + planId, "DELETE", null, true)
      .then(function () { loadStudyPlans(); })
      .catch(function (e) { alert(String(e.message || e)); });
  }

  // Parent: join class
  function parentJoinClass() {
    var code = byId("parentJoinCode").value.trim();
    if (code.length !== 6) { byId("parentJoinResult").textContent = "请输入6位邀请码。"; return; }
    api("/class/join", "POST", { inviteCode: code }, true)
      .then(function (data) {
        byId("parentJoinResult").innerHTML = "✅ " + data.message;
        loadParentClasses();
      })
      .catch(function (e) { byId("parentJoinResult").textContent = String(e.message || e); });
  }

  // Parent: load classes
  function loadParentClasses() {
    api("/class/my-classes", "GET", null, true)
      .then(function (data) {
        var sel = byId("parentClsSelect");
        sel.innerHTML = '<option value="">-- 选择班级 --</option>';
        (data.items || []).forEach(function (c) {
          var opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name + " (" + c.memberCount + "人) 邀请码:" + c.inviteCode;
          sel.appendChild(opt);
        });
      })
      .catch(function (e) { console.error(e); });
  }

  // Parent: show class detail
  function showParentClassDetail(classId) {
    if (!classId) { byId("parentClassDetail").innerHTML = ""; return; }
    api("/class/" + classId, "GET", null, true)
      .then(function (data) {
        var html = "";
        // Notices
        if (data.notices && data.notices.length > 0) {
          html += "<h4>📢 公告</h4>";
          data.notices.forEach(function (n) {
            html += "<div class='class-card'><b>" + escapeHtml(n.creatorName || "老师") + "</b>: " + escapeHtml(n.message) + "<br><small>" + n.createdAt + "</small></div>";
          });
        }
        // Homework overview
        if (data.homeworks && data.homeworks.length > 0) {
          html += "<h4>📝 作业 (共" + data.homeworks.length + "份)</h4>";
          data.homeworks.forEach(function (h) {
            html += "<div class='homework-card'><b>" + escapeHtml(h.title) + "</b> · 提交:" + h.submitCount + " · 截止:" + h.dueDate + "</div>";
          });
        }
        // Members
        html += "<h4>👥 成员 (" + data.memberCount + ")</h4><div class='member-list'>";
        (data.members || []).forEach(function (m) {
          var roleLabel = m.role === "teacher" ? "老师" : m.role === "student" ? "学生" : "家长";
          html += "<div class='member-row'><span class='tag " + (m.role === "teacher" ? "red" : "steel") + "'>" + roleLabel + "</span> " + escapeHtml(m.displayName) + " · Lv." + m.level + " · " + m.points + "分</div>";
        });
        html += "</div>";
        byId("parentClassDetail").innerHTML = html;
      })
      .catch(function (e) { byId("parentClassDetail").textContent = String(e.message || e); });
  }

  // ── WebSocket ──────────────────────────────────────────────────

  function connectWebSocket() {
    if (!token) return;
    if (ws && ws.readyState === WebSocket.OPEN) return;

    var protocol = location.protocol === "https:" ? "wss:" : "ws:";
    var wsUrl = protocol + "//" + location.host + "/ws?token=" + encodeURIComponent(token);
    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
      console.log("[ws] connected");
      if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
    };

    ws.onmessage = function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      handleWsMessage(msg);
    };

    ws.onclose = function () {
      console.log("[ws] disconnected");
      // Reconnect after 3 seconds
      if (token) {
        wsReconnectTimer = setTimeout(function () { connectWebSocket(); }, 3000);
      }
    };

    ws.onerror = function (err) {
      console.error("[ws] error", err);
    };
  }

  function sendWs(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function handleWsMessage(msg) {
    switch (msg.type) {
      case "auth_ok":
        myUserId = msg.payload.userId;
        console.log("[ws] authenticated as " + myUserId);
        break;

      case "game_state":
        handleGameState(msg.payload);
        break;

      case "clock_tick":
        handleClockTick(msg.payload);
        break;

      case "game_over":
        handleGameOver(msg.payload);
        break;

      case "opponent_disconnected":
        showToast("对手已断开连接，等待60秒重连...");
        break;

      case "room_joined":
        showToast("对手已加入房间！");
        if (pvpRoomId) {
          sendWs({ type: "join_room", payload: { roomId: pvpRoomId } });
        }
        break;

      case "chat_receive":
        handleChatReceive(msg.payload);
        break;

      case "draw_offered":
        handleDrawOffered(msg.payload);
        break;

      case "draw_offer_sent":
        byId("pvpStatus").textContent = "已发送和棋请求，等待对手响应...";
        break;

      case "draw_rejected":
        byId("pvpStatus").textContent = "对手拒绝了和棋请求";
        showToast("对手拒绝了和棋请求");
        break;

      case "error":
        showToast("错误: " + (msg.payload.message || "未知错误"));
        break;

      case "pong":
        break;
    }
  }

  // ── PvP Game Logic ────────────────────────────────────────────

  function handleGameState(payload) {
    pvpRoomId = payload.roomId;
    pvpFen = payload.fen;
    pvpStatus = payload.status;
    whiteTimeMs = payload.white.timeRemainingMs;
    blackTimeMs = payload.black.timeRemainingMs;

    // Determine my color
    if (payload.white.userId === myUserId) pvpMyColor = "white";
    else if (payload.black.userId === myUserId) pvpMyColor = "black";

    // Update UI
    updatePvpUI(payload);

    // Render board
    renderBoard("pvpBoard", pvpFen, pvpSelected, onPvpClick);

    // Show game info, hide setup
    if (pvpStatus === "playing") {
      byId("pvpSetup").style.display = "none";
      byId("pvpGameInfo").style.display = "";
      byId("btnPvpResign").style.display = "";
      byId("btnPvpDraw").style.display = "";
      byId("btnPvpShareClass").style.display = "";
      updatePvpClocks();
      startClientClock();
    }
  }

  function updatePvpUI(payload) {
    var whiteName = payload.white.name || "白方";
    var blackName = payload.black.name || "黑方";
    byId("pvpWhiteClock").textContent = whiteName + " " + formatTime(whiteTimeMs);
    byId("pvpBlackClock").textContent = blackName + " " + formatTime(blackTimeMs);
    updateClockHighlight();

    var statusText = pvpMyColor === "white" ? "你执白方" : "你执黑方";
    if (payload.turn === pvpMyColor.charAt(0)) statusText += " · 轮到你走棋";
    else statusText += " · 等待对手走棋";
    byId("pvpStatus").textContent = statusText;
  }

  function handleClockTick(payload) {
    whiteTimeMs = payload.whiteTimeMs;
    blackTimeMs = payload.blackTimeMs;
    updatePvpClocks();
    updateClockHighlight();
  }

  function updatePvpClocks() {
    var whiteNameEl = byId("pvpWhiteClock");
    var blackNameEl = byId("pvpBlackClock");
    var whiteText = whiteNameEl.textContent.split(" ")[0];
    var blackText = blackNameEl.textContent.split(" ")[0];
    whiteNameEl.textContent = (whiteText || "白方") + " " + formatTime(whiteTimeMs);
    blackNameEl.textContent = (blackText || "黑方") + " " + formatTime(blackTimeMs);

    // Low time warning
    whiteNameEl.classList.toggle("low", whiteTimeMs < 30000);
    blackNameEl.classList.toggle("low", blackTimeMs < 30000);
  }

  function updateClockHighlight() {
    var turn = pvpFen.split(" ")[1] || "w";
    byId("pvpWhiteClock").classList.toggle("ticking", turn === "w" && pvpStatus === "playing");
    byId("pvpBlackClock").classList.toggle("ticking", turn === "b" && pvpStatus === "playing");
  }

  function startClientClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(function () {
      if (pvpStatus !== "playing") { clearInterval(clockTimer); return; }
      var turn = pvpFen.split(" ")[1] || "w";
      if (turn === "w") whiteTimeMs = Math.max(0, whiteTimeMs - 1000);
      else blackTimeMs = Math.max(0, blackTimeMs - 1000);
      updatePvpClocks();
    }, 1000);
  }

  function handleGameOver(payload) {
    pvpStatus = "finished";
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    byId("pvpStatus").textContent = payload.message || "对局结束";
    byId("btnPvpResign").style.display = "none";
    byId("btnPvpDraw").style.display = "none";
    showToast(payload.message || "对局结束");

    // Update match records in UI
    setTimeout(function () {
      if (pvpRoomId) {
        byId("pvpSetup").style.display = "";
        byId("pvpGameInfo").style.display = "none";
        pvpRoomId = "";
        renderBoard("pvpBoard", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "", function () {});
        byId("pvpWhiteClock").textContent = "10:00";
        byId("pvpBlackClock").textContent = "10:00";
        byId("pvpWhiteClock").classList.remove("ticking", "low");
        byId("pvpBlackClock").classList.remove("ticking", "low");
      }
    }, 3000);
  }

  function formatTime(ms) {
    if (ms <= 0) return "0:00";
    var totalSec = Math.ceil(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function onPvpClick(square, piece) {
    if (pvpStatus !== "playing") {
      byId("pvpStatus").textContent = "对局尚未开始。";
      return;
    }

    var turn = pvpFen.split(" ")[1] || "w";
    var myTurn = (pvpMyColor === "white" && turn === "w") || (pvpMyColor === "black" && turn === "b");
    if (!myTurn) {
      byId("pvpStatus").textContent = "还没轮到你走棋。";
      return;
    }

    if (!pvpSelected) {
      if (!piece) return;
      var isMyPiece = (pvpMyColor === "white" && piece === piece.toUpperCase()) ||
                       (pvpMyColor === "black" && piece === piece.toLowerCase());
      if (!isMyPiece) {
        byId("pvpStatus").textContent = "请选择自己的棋子。";
        return;
      }
      pvpSelected = square;
      renderBoard("pvpBoard", pvpFen, pvpSelected, onPvpClick);
      return;
    }

    if (pvpSelected === square) {
      pvpSelected = "";
      renderBoard("pvpBoard", pvpFen, pvpSelected, onPvpClick);
      return;
    }

    var move = pvpSelected + square;
    sendWs({ type: "move", payload: { roomId: pvpRoomId, move: move } });
    pvpSelected = "";
    renderBoard("pvpBoard", pvpFen, pvpSelected, onPvpClick);
  }

  // ── Time Control Selection ─────────────────────────────────────

  function selectTimeControl(min, inc) {
    pvpSelectedTime = { initialMinutes: min, incrementSeconds: inc };
    document.querySelectorAll("#timePresets .time-btn").forEach(function (btn) {
      var bMin = parseInt(btn.getAttribute("data-min"));
      var bInc = parseInt(btn.getAttribute("data-inc"));
      btn.classList.toggle("selected", bMin === min && bInc === inc);
    });
    if (min === -1) {
      byId("customTimeRow").style.display = "";
      // Read custom values
      pvpSelectedTime.initialMinutes = parseInt(byId("customMinutes").value) || 3;
      pvpSelectedTime.incrementSeconds = parseInt(byId("customSeconds").value) || 2;
    } else {
      byId("customTimeRow").style.display = "none";
    }
  }

  function getSelectedTimeControl() {
    if (document.querySelector("#customTimeBtn.selected")) {
      return {
        initialMinutes: parseInt(byId("customMinutes").value) || 3,
        incrementSeconds: parseInt(byId("customSeconds").value) || 2
      };
    }
    return pvpSelectedTime;
  }

  // ── Room Creation / Join ───────────────────────────────────────

  function createRoom() {
    if (!token) { showToast("请先登录"); return; }
    var tc = getSelectedTimeControl();
    api("/room/create", "POST", { timeControl: tc }, true)
      .then(function (data) {
        pvpRoomId = data.roomId;
        pvpMyColor = data.yourColor;
        pvpStatus = "waiting";
        pvpFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        whiteTimeMs = tc.initialMinutes * 60 * 1000;
        blackTimeMs = tc.initialMinutes * 60 * 1000;

        byId("pvpRoomInfo").innerHTML =
          "房间已创建！<br><span class='room-number'>" + data.roomNumber + "</span><br>" +
          "<small>时间：" + tc.initialMinutes + "+" + tc.incrementSeconds + " · 你执" + (pvpMyColor === "white" ? "白" : "黑") + "方</small><br>" +
          "<button class='secondary' style='margin-top:6px;' id='btnCopyRoom' data-room='" + data.roomNumber + "'>📋 复制房间号</button> " +
          "<button class='ghost' style='margin-top:6px;' id='btnShareRoom'>📢 分享到班级群</button>";
        // Attach listeners to the dynamically created buttons
        setTimeout(function () {
          var copyBtn = byId("btnCopyRoom");
          var shareBtn = byId("btnShareRoom");
          if (copyBtn) copyBtn.onclick = function () {
            navigator.clipboard.writeText(this.getAttribute("data-room") || "").then(function () { showToast("已复制房间号"); });
          };
          if (shareBtn) shareBtn.onclick = shareRoomToClass;
        }, 50);

        // Connect to room
        sendWs({ type: "join_room", payload: { roomId: pvpRoomId } });

        // Render empty board
        renderBoard("pvpBoard", pvpFen, "", onPvpClick);
        updatePvpClocks();
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function joinRoom() {
    if (!token) { showToast("请先登录"); return; }
    var roomNumber = byId("joinRoomNumber").value.trim();
    if (!roomNumber || roomNumber.length !== 6) { showToast("请输入6位房间号"); return; }

    api("/room/join", "POST", { roomNumber: roomNumber }, true)
      .then(function (data) {
        pvpRoomId = data.roomId;
        pvpMyColor = data.yourColor;
        pvpStatus = data.status;
        pvpFen = data.fen;
        var tc = data.timeControl;
        whiteTimeMs = tc.initialMinutes * 60 * 1000;
        blackTimeMs = tc.initialMinutes * 60 * 1000;

        byId("pvpRoomInfo").innerHTML =
          "加入成功！你执" + (pvpMyColor === "white" ? "白" : "黑") + "方<br>" +
          "<small>时间：" + tc.initialMinutes + "+" + tc.incrementSeconds + "</small>";

        // Connect to room
        sendWs({ type: "join_room", payload: { roomId: pvpRoomId } });

        // Render board
        renderBoard("pvpBoard", pvpFen, "", onPvpClick);
        updatePvpClocks();

        if (pvpStatus === "playing") {
          byId("pvpSetup").style.display = "none";
          byId("pvpGameInfo").style.display = "";
          byId("btnPvpResign").style.display = "";
          byId("btnPvpDraw").style.display = "";
          byId("btnPvpShareClass").style.display = "";
          startClientClock();
        }
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function checkActivePvpGame() {
    if (!token) return;
    api("/room/my-active", "GET", null, true)
      .then(function (data) {
        if (data.active) {
          pvpRoomId = data.roomId;
          pvpMyColor = data.yourColor;
          pvpStatus = data.status;
          sendWs({ type: "join_room", payload: { roomId: pvpRoomId } });
          // Fetch room state
          api("/room/" + data.roomId, "GET", null, true)
            .then(function (room) {
              handleGameState(room);
            }).catch(function () {});
        }
      }).catch(function () {});
  }

  function refreshActiveRooms() {
    if (!token) return;
    api("/rooms/active", "GET", null, true)
      .then(function (data) {
        var container = byId("activeRooms");
        container.innerHTML = "";
        if (!data.rooms || data.rooms.length === 0) {
          container.innerHTML = "<div class='feed' style='font-size:12px;'>暂无活跃房间</div>";
          return;
        }
        data.rooms.forEach(function (r) {
          var div = document.createElement("div");
          div.className = "friend-item";
          div.innerHTML =
            "<div class='info'><b>" + escapeHtml(r.creatorName) + "</b> · " +
            r.timeControl.initialMinutes + "+" + r.timeControl.incrementSeconds +
            " · <small>" + r.createdAt + "</small></div>" +
            "<div class='actions'><button class='secondary' style='min-height:28px;font-size:11px;padding:2px 8px;' data-room='" + r.roomNumber + "'>加入</button></div>";
          div.querySelector("button").onclick = function () {
            byId("joinRoomNumber").value = r.roomNumber;
            joinRoom();
          };
          container.appendChild(div);
        });
      })
      .catch(function (e) { console.error(e); });
  }

  function resignPvp() {
    if (!pvpRoomId) return;
    if (!confirm("确定认输吗？")) return;
    api("/room/" + pvpRoomId + "/resign", "POST", {}, true)
      .then(function () {
        sendWs({ type: "resign", payload: { roomId: pvpRoomId } });
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function offerDraw() {
    if (!pvpRoomId) return;
    sendWs({ type: "draw_offer", payload: { roomId: pvpRoomId, action: "offer" } });
    byId("pvpStatus").textContent = "已发送和棋请求...";
  }

  function handleDrawOffered(payload) {
    byId("pvpStatus").textContent = payload.fromName + " 请求和棋";
    if (confirm(payload.fromName + " 请求和棋，是否接受？")) {
      sendWs({ type: "draw_offer", payload: { roomId: pvpRoomId, action: "accept" } });
    } else {
      sendWs({ type: "draw_offer", payload: { roomId: pvpRoomId, action: "reject" } });
    }
  }

  function shareRoomToClass() {
    if (!pvpRoomId) return;
    // Get the room number from the room info
    var roomNumber = "";
    api("/room/" + pvpRoomId, "GET", null, true)
      .then(function (room) {
        roomNumber = room.roomNumber;
        // Get the first class the user is in
        return api("/class/my-classes", "GET", null, true);
      })
      .then(function (data) {
        var classes = data.items || [];
        if (classes.length === 0) {
          showToast("你还没有加入任何班级");
          return;
        }
        // If only one class, post directly
        if (classes.length === 1) {
          var tc = getSelectedTimeControl();
          var msg = "🎮 来下一盘棋吧！房间号: " + roomNumber + " | 时间: " + tc.initialMinutes + "+" + tc.incrementSeconds + " | 点击加入对局";
          return api("/class/" + classes[0].id + "/notice", "POST", { message: msg }, true);
        }
        // Multiple classes - pick first one for now
        var tc2 = getSelectedTimeControl();
        var msg2 = "🎮 来下一盘棋吧！房间号: " + roomNumber + " | 时间: " + tc2.initialMinutes + "+" + tc2.incrementSeconds + " | 点击加入对局";
        return api("/class/" + classes[0].id + "/notice", "POST", { message: msg2 }, true);
      })
      .then(function () {
        if (roomNumber) showToast("已分享到班级群！");
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  // ── Friends Management ──────────────────────────────────────────

  function searchFriends() {
    var q = byId("friendSearchInput").value.trim();
    if (!q) { showToast("请输入搜索关键词"); return; }
    api("/friends/search?q=" + encodeURIComponent(q), "GET", null, true)
      .then(function (data) {
        var container = byId("friendSearchResults");
        container.innerHTML = "";
        if (!data.results || data.results.length === 0) {
          container.innerHTML = "<div class='feed' style='font-size:12px;'>未找到用户</div>";
          return;
        }
        data.results.forEach(function (u) {
          var div = document.createElement("div");
          div.className = "friend-item";
          var actionBtn = "";
          if (u.isFriend) {
            actionBtn = "<span class='tag'>已是好友</span>";
          } else if (u.pendingSent) {
            actionBtn = "<span class='tag steel'>已发送请求</span>";
          } else {
            actionBtn = "<button class='secondary' style='min-height:28px;font-size:11px;padding:2px 8px;' data-uid='" + u.userId + "'>添加好友</button>";
          }
          div.innerHTML =
            "<div class='info'><b>" + escapeHtml(u.displayName) + "</b> · Lv." + u.level + " · " + u.points + "分</div>" +
            "<div class='actions'>" + actionBtn + "</div>";
          var addBtn = div.querySelector("button");
          if (addBtn) addBtn.onclick = function () { sendFriendRequest(u.userId); };
          container.appendChild(div);
        });
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function sendFriendRequest(toUserId) {
    api("/friends/request", "POST", { toUserId: toUserId }, true)
      .then(function () { showToast("好友请求已发送！"); searchFriends(); loadFriendRequests(); })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function loadFriends() {
    if (!token) return;
    api("/friends/list", "GET", null, true)
      .then(function (data) {
        friendsCache = data.friends || [];
        renderFriendsList();
        updateUnreadSummary();
      })
      .catch(function (e) { console.error(e); });
  }

  function renderFriendsList() {
    var container = byId("friendsList");
    container.innerHTML = "";
    if (friendsCache.length === 0) {
      container.innerHTML = "<div class='feed' style='font-size:12px;'>暂无好友，去搜索添加吧！</div>";
      return;
    }
    friendsCache.forEach(function (f) {
      var div = document.createElement("div");
      div.className = "friend-item";
      var unreadBadge = f.unreadCount > 0 ? "<span class='unread-badge'>" + f.unreadCount + "</span>" : "";
      div.innerHTML =
        "<div class='info'><b>" + escapeHtml(f.displayName) + unreadBadge + "</b> · Lv." + f.level + " · " + f.points + "分</div>" +
        "<div class='actions'>" +
        "<button class='secondary' style='min-height:28px;font-size:11px;padding:2px 8px;' data-uid='" + f.userId + "' data-name='" + escapeHtml(f.displayName) + "'>💬</button>" +
        "<button class='ghost' style='min-height:28px;font-size:11px;padding:2px 8px;' data-uid='" + f.userId + "'>⚔</button>" +
        "</div>";
      // Chat button
      div.querySelector(".secondary").onclick = function () { openChat(f.userId, f.displayName); };
      // Challenge button
      div.querySelector(".ghost").onclick = function () { sendGameRequest(f.userId, f.displayName); };
      container.appendChild(div);
    });
  }

  function loadFriendRequests() {
    if (!token) return;
    api("/friends/requests", "GET", null, true)
      .then(function (data) {
        var header = byId("friendRequestsHeader");
        var container = byId("friendRequestsList");
        container.innerHTML = "";

        var incoming = data.incoming || [];
        if (incoming.length === 0) {
          header.style.display = "none";
          return;
        }
        header.style.display = "";
        header.textContent = "📩 好友请求 (" + incoming.length + ")";
        incoming.forEach(function (r) {
          var div = document.createElement("div");
          div.className = "friend-item";
          div.innerHTML =
            "<div class='info'><b>" + escapeHtml(r.displayName) + "</b> 想加你为好友 · Lv." + r.level + "</div>" +
            "<div class='actions'>" +
            "<button class='secondary' style='min-height:28px;font-size:11px;padding:2px 8px;' data-rid='" + r.requestId + "'>接受</button>" +
            "<button class='ghost' style='min-height:28px;font-size:11px;padding:2px 8px;' data-rid='" + r.requestId + "'>拒绝</button>" +
            "</div>";
          div.querySelector(".secondary").onclick = function () { acceptFriendRequest(r.requestId); };
          div.querySelector(".ghost").onclick = function () { rejectFriendRequest(r.requestId); };
          container.appendChild(div);
        });
      })
      .catch(function (e) { console.error(e); });
  }

  function acceptFriendRequest(requestId) {
    api("/friends/accept", "POST", { requestId: requestId }, true)
      .then(function () {
        showToast("已添加好友！");
        loadFriendRequests();
        loadFriends();
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function rejectFriendRequest(requestId) {
    api("/friends/reject", "POST", { requestId: requestId }, true)
      .then(function () { loadFriendRequests(); })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  // ── Chat ───────────────────────────────────────────────────────

  function openChat(friendId, friendName) {
    activeChatFriendId = friendId;
    chatOpen = true;
    byId("chatContainer").style.display = "";
    byId("chatTitle").textContent = "与 " + friendName + " 聊天";
    byId("chatMessages").innerHTML = "<div style='color:var(--muted);text-align:center;font-size:12px;'>加载中...</div>";
    loadChatHistory();
  }

  function closeChat() {
    activeChatFriendId = "";
    chatOpen = false;
    byId("chatContainer").style.display = "none";
  }

  function loadChatHistory() {
    if (!activeChatFriendId) return;
    api("/chat/history/" + activeChatFriendId, "GET", null, true)
      .then(function (data) {
        var container = byId("chatMessages");
        container.innerHTML = "";
        if (!data.messages || data.messages.length === 0) {
          container.innerHTML = "<div style='color:var(--muted);text-align:center;font-size:12px;'>暂无消息，打个招呼吧！</div>";
        } else {
          data.messages.forEach(function (m) {
            appendChatMessage(m);
          });
        }
        container.scrollTop = container.scrollHeight;
        // Update unread counts
        loadFriends();
      })
      .catch(function (e) { console.error(e); });
  }

  function handleChatReceive(msg) {
    // If chat is open with this user, append to chat
    if (activeChatFriendId === msg.fromUserId || (msg.outgoing && activeChatFriendId === msg.toUserId)) {
      appendChatMessage(msg);
      var container = byId("chatMessages");
      container.scrollTop = container.scrollHeight;
    }
    // Update friends list for unread badge
    loadFriends();
    updateUnreadSummary();
    // Show notification for incoming messages if chat not open
    if (!msg.outgoing && (!chatOpen || activeChatFriendId !== msg.fromUserId)) {
      showToast("💬 " + (msg.fromName || "好友") + ": " + msg.message.substring(0, 50));
    }
  }

  function appendChatMessage(msg) {
    var container = byId("chatMessages");
    var div = document.createElement("div");
    div.className = "chat-bubble " + (msg.outgoing ? "outgoing" : "incoming");
    var time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";
    div.innerHTML = escapeHtml(msg.message) + "<div class='chat-time'>" + time + "</div>";
    container.appendChild(div);
  }

  function sendChatMessage() {
    if (!activeChatFriendId) return;
    var input = byId("chatInput");
    var message = input.value.trim();
    if (!message) return;
    input.value = "";

    sendWs({ type: "chat_send", payload: { toUserId: activeChatFriendId, message: message } });
  }

  function updateUnreadSummary() {
    api("/chat/unread", "GET", null, true)
      .then(function (data) {
        var el = byId("unreadSummary");
        if (data.total > 0) {
          el.innerHTML = "<span class='tag red' style='cursor:pointer;'>📬 " + data.total + " 条未读消息</span>";
          el.firstChild.onclick = function () { navigateTo("friendsView"); };
        } else {
          el.innerHTML = "";
        }
      })
      .catch(function () {});
  }

  // ── Game Requests ──────────────────────────────────────────────

  function sendGameRequest(toUserId, friendName) {
    var tc = getSelectedTimeControl();
    if (!confirm("向 " + friendName + " 发送对局请求？\\n时间: " + tc.initialMinutes + "+" + tc.incrementSeconds)) return;
    api("/game-request/send", "POST", { toUserId: toUserId, timeControl: tc }, true)
      .then(function () { showToast("对局请求已发送！"); })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function acceptGameRequest(requestId) {
    api("/game-request/" + requestId + "/accept", "POST", {}, true)
      .then(function (data) {
        showToast("已接受对局请求！房间号: " + data.roomNumber);
        // Join the room
        byId("joinRoomNumber").value = data.roomNumber;
        joinRoom();
        // Switch to PvP tab
        navigateTo("pvpView");
        // Dismiss the toast
        removeAllToasts();
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function declineGameRequest(requestId) {
    api("/game-request/" + requestId + "/decline", "POST", {}, true)
      .then(function () {
        showToast("已拒绝对局请求");
        removeToastByRequestId(requestId);
      })
      .catch(function (e) { showToast(String(e.message || e)); });
  }

  function checkGameRequests() {
    if (!token) return;
    api("/game-request/incoming", "GET", null, true)
      .then(function (data) {
        (data.requests || []).forEach(function (r) {
          showGameRequestToast(r);
        });
      })
      .catch(function () {});
  }

  function showGameRequestToast(request) {
    var container = byId("toastContainer");
    // Check if already showing
    if (container.querySelector("[data-request-id='" + request.requestId + "']")) return;

    var div = document.createElement("div");
    div.className = "toast-item";
    div.setAttribute("data-request-id", request.requestId);
    var tc = request.timeControl;
    div.innerHTML =
      "<b>⚔ " + escapeHtml(request.fromName) + " 邀请你对局</b><br>" +
      "<small>时间: " + tc.initialMinutes + "+" + tc.incrementSeconds + " · Lv." + request.fromLevel + "</small>" +
      "<div class='toast-actions'>" +
      "<button class='secondary' style='min-height:28px;font-size:11px;padding:4px 10px;' data-rid='" + request.requestId + "'>接受</button>" +
      "<button class='ghost' style='min-height:28px;font-size:11px;padding:4px 10px;' data-rid='" + request.requestId + "'>拒绝</button>" +
      "</div>";

    div.querySelector(".secondary").onclick = function () { acceptGameRequest(request.requestId); };
    div.querySelector(".ghost").onclick = function () { declineGameRequest(request.requestId); };

    container.appendChild(div);

    // Auto-dismiss after 30 seconds
    setTimeout(function () {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 30000);
  }

  function removeToastByRequestId(requestId) {
    var el = document.querySelector("[data-request-id='" + requestId + "']");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function removeAllToasts() {
    byId("toastContainer").innerHTML = "";
  }

  // ── Toast Notifications ────────────────────────────────────────

  function showToast(message) {
    var container = byId("toastContainer");
    var div = document.createElement("div");
    div.className = "toast-item";
    div.textContent = message;
    container.appendChild(div);
    setTimeout(function () {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 4000);
  }

var learningTopics = [
  // ═══════════════════════════════════════════════════════════════
  // Section 1: 开局原则 (Opening Principles)
  // ═══════════════════════════════════════════════════════════════
  ({
    id: "pr-01",
    title: "争夺中心",
    category: "principles",
    section: "开局原则",
    difficulty: 1,
    content: \`<h3>中心是棋盘的心脏</h3>
<p>开局的首要目标就是<b>争夺中心</b>。中心四格是指 e4、d4、e5、d5。控制中心意味着你的棋子可以辐射到棋盘各个方向，行动最自由。</p>
<h4>为什么要控制中心？</h4>
<ul>
  <li><b>子力活动范围最大</b>：位于中心的马可以攻击多达8个格子，而在角落只能攻击2个。</li>
  <li><b>限制对手空间</b>：当你的兵占据中心，对手的棋子被迫待在更狭窄的空间里。</li>
  <li><b>方便两翼调动</b>：从中心到王翼和后翼距离相等，你的棋子可以快速支援任何方向。</li>
</ul>
<h4>怎么做？</h4>
<p>白方第一步通常走 <b>1.e4</b> 或 <b>1.d4</b>，立即用兵占据中心。黑方则用 <b>1...e5</b>、<b>1...d5</b> 或 <b>1...c5</b>（西西里防御）来争夺中心控制权。</p>\`,
    keyFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    keyMoves: ["e4", "d4", "e5", "d5"],
    tips: ["第一步走王前兵(1.e4)或后前兵(1.d4)", "用兵和马象一起控制中心格子", "不要在开局阶段把兵乱推，每步都要为中心而战"]
  }),
  ({
    id: "pr-02",
    title: "快速出子",
    category: "principles",
    section: "开局原则",
    difficulty: 1,
    content: \`<h3>先出轻子，后出重子</h3>
<p>开局的第二个原则是<b>尽快出动棋子</b>。优先出动马和象（轻子），然后是后和车（重子）。</p>
<h4>出子顺序</h4>
<ul>
  <li><b>马优先</b>：马只有几个自然的出子格，要尽早决定它们的位置。通常跳向中心：Nf3、Nc3（白方）或 Nf6、Nc6（黑方）。</li>
  <li><b>象随后</b>：象有多条斜线可选，出象前先观察哪个位置最能影响中心。如白方象到 c4 或 b5。</li>
  <li><b>后不要早出</b>：后是最强的子，过早出动会被对手驱赶，白白浪费步数。</li>
</ul>
<h4>最常见的错误</h4>
<p>开局阶段<b>重复走同一个棋子</b>是最常见的错误之一。每步棋都应该让一个新的棋子投入战斗，而不是连续走同一个子。</p>\`,
    keyFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    keyMoves: ["Nf3", "Nc3", "Bc4", "Bb5"],
    tips: ["马优先出，跳向中心(Nf3/Nc3或Nf6/Nc6)", "不要在开局连续走同一个棋子", "开局目标是10步内出动全部轻子", "后不要在前5步出动"]
  }),
  ({
    id: "pr-03",
    title: "王车易位——王的安全",
    category: "principles",
    section: "开局原则",
    difficulty: 1,
    content: \`<h3>及时易位，保王安全</h3>
<p>开局的第三个原则是<b>确保王的安全</b>。在绝大多数对局中，最有效的保王手段就是<b>王车易位（Castling）</b>。</p>
<h4>为什么要易位？</h4>
<ul>
  <li><b>王远离中心</b>：中路的战斗最激烈，王留在中路极易受到攻击。</li>
  <li><b>联通双车</b>：易位后两个车彼此相连，可以互相保护并威胁开放线。</li>
  <li><b>兵墙保护</b>：短易位后王躲在 f2/g2/h2（或 f7/g7/h7）三道兵墙后面。</li>
</ul>
<h4>何时易位？</h4>
<p>一般来说，<b>在10步以内完成易位</b>是最佳实践。在王翼出子完成后（马和象已出动），立即易位。如果中心即将开放，更要争分夺秒地把王转移走。</p>
<h4>短易位 vs 长易位</h4>
<p>短易位（O-O）更快，只需走两步（马和象），是大多数对局的首选。长易位（O-O-O）需要走三步（马、象、后），但可以让车立即占据 d 线。</p>\`,
    keyFen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    tips: ["10步内完成王车易位", "短易位(O-O)更安全、更快", "不要在易位前就发动攻击", "易位后不要随意移动王前的兵"]
  }),
  ({
    id: "pr-04",
    title: "避免重复走子",
    category: "principles",
    section: "开局原则",
    difficulty: 1,
    content: \`<h3>每一步出动一个新棋子</h3>
<p>开局阶段，<b>每步棋都应该带来一个新的棋子投入战斗</b>。如果连续走同一个棋子，等于把先手优势拱手相让。</p>
<h4>为什么是严重错误？</h4>
<ul>
  <li>你连续走一个棋子时，对手在出别的棋子——你的出子速度落后了</li>
  <li>先手优势（白方先行）的价值约等于0.3-0.5个兵，重复走子等于放弃这个优势</li>
  <li>过早暴露后的位置可能使其成为对手攻击的目标</li>
</ul>
<h4>例外情况</h4>
<p>有时重复走子是可以的：</p>
<ul>
  <li>当对手犯了严重错误，你可以立即利用时</li>
  <li>为了吃回一个对方弃掉的兵或棋子（但要先判断是否值得放弃出子速度）</li>
</ul>\`,
    tips: ["一手一个新棋子，直到所有轻子出动", "不要为了吃一个小兵而浪费2-3步", "后至少要在3-4个轻子出动后再考虑走", "白方理想的10步：4轻子+易位=5步，再加2-3个兵推进"]
  }),
  ({
    id: "pr-05",
    title: "开局常见错误总览",
    category: "principles",
    section: "开局原则",
    difficulty: 2,
    content: \`<h3>五个最常见的开局错误</h3>
<ol>
  <li><b>重复走子</b>：不要连续走同一个棋子（除非有具体的战术理由）。</li>
  <li><b>过早出后</b>：后是最大的靶子。过早出动后会被对手的轻子驱赶，白白浪费3-4步。</li>
  <li><b>贪吃小兵</b>：看到无保护的兵就吃，忽略了出子和发展——这叫"贪兵失势"。</li>
  <li><b>不保王安全</b>：迟迟不进行王车易位，王留在中路被打开后无处可逃。</li>
  <li><b>乱推边兵</b>：走 a4、h4、a5、h5 这样的边兵推进在开局阶段几乎总是有害的——它们不帮助争夺中心，也不帮助出子。</li>
</ol>
<h4>记住——开局目标不是将死</h4>
<p>开局的目标是<b>为你的棋子找到最佳的位置</b>，为中局战斗做好充分准备。理解这点比死记10步长篇变例重要得多。</p>\`,
    tips: ["每步问自己：这步棋帮助争夺中心了吗？", "每步问自己：这步棋让我的子力更活跃了吗？", "每步问自己：我的王还安全吗？", "大部分500-1200分段的比赛是靠战术而非开局理论决胜负的"]
  }),

  // ═══════════════════════════════════════════════════════════════
  // Section 2: 经典开局 (Classic Openings)
  // ═══════════════════════════════════════════════════════════════
  ({
    id: "op-01",
    title: "意大利开局",
    category: "openings",
    section: "经典开局",
    difficulty: 1,
    content: \`<h3>最古老、最适合初学者的开局</h3>
<p><b>意大利开局（Italian Game）</b>已有500多年历史，其核心是以象瞄准黑方最薄弱的f7格。</p>
<p>主变：<b>1.e4 e5 2.Nf3 Nc6 3.Bc4</b></p>
<h4>核心思路</h4>
<ul>
  <li>白象在c4直接瞄准f7——黑方开局阶段最薄弱的格子（只有王在防守）</li>
  <li>白方出子顺畅自然：马→象→易位，3步完成王翼部署</li>
  <li>黑方可以走3...Bc5（对称）或3...Nf6（双马防御）</li>
</ul>
<h4>为什么适合初学者？</h4>
<p>意大利开局的计划清晰：控制中心、快速出子、准备易位、瞄准f7。不要求记忆长篇变例，白方的走法非常直观。</p>\`,
    keyFen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    keyMoves: ["e4", "Nf3", "Bc4"],
    tips: ["白方：1.e4 e5 2.Nf3 Nc6 3.Bc4", "象放在c4攻击f7弱点", "然后短易位O-O，出动剩余子力", "黑方可用3...Bc5（对称）或3...Nf6（双马防御）"]
  }),
  ({
    id: "op-02",
    title: "西班牙开局",
    category: "openings",
    section: "经典开局",
    difficulty: 2,
    content: \`<h3>职业棋手最爱的开局</h3>
<p><b>西班牙开局（Ruy Lopez）</b>是国际象棋中研究最深入的开局之一。它的第一步非常自然，但其背后的战略极其丰富。</p>
<p>主变：<b>1.e4 e5 2.Nf3 Nc6 3.Bb5</b></p>
<h4>核心思路</h4>
<ul>
  <li>白象到b5间接施压：它威胁黑方防守e5兵的马（c6马），从而间接控制中心</li>
  <li>白方不需要立即做决定——这是一个"持久施压"的开局</li>
  <li>黑方有多种应对：3...a6（最主流）、3...Nf6、3...Bc5、3...d6等</li>
</ul>
<h4>为什么值得学？</h4>
<p>西班牙开局体现了很多高级棋艺概念：间接施压、子力调动、中心突破的时机等。从初学者到世界冠军都在用它。</p>\`,
    keyFen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    keyMoves: ["e4", "Nf3", "Bb5"],
    tips: ["白方：1.e4 e5 2.Nf3 Nc6 3.Bb5", "象b5施压c6马→间接威胁e5兵", "这是\\"持久施压\\"而非直接攻击", "进阶内容——初学者可以先专注意大利开局"]
  }),
  ({
    id: "op-03",
    title: "伦敦体系",
    category: "openings",
    section: "经典开局",
    difficulty: 1,
    content: \`<h3>最省心的白方开局</h3>
<p><b>伦敦体系（London System）</b>是一个白方可以"自动"走出的开局系统。无论黑方怎么走，白方的前几步几乎不变。</p>
<p>主变：<b>1.d4 d5 2.Nf3 Nf6 3.Bf4</b></p>
<h4>核心思路</h4>
<ul>
  <li>白方建立一个稳固的金字塔结构：d4兵+e3兵+c3兵（"伦敦金字塔"）</li>
  <li>象在f4（不在c1被自己的兵挡住）——这是伦敦的精髓</li>
  <li>然后Nd2、Bd3、O-O、c3，阵型固若金汤</li>
</ul>
<h4>为什么受欢迎？</h4>
<p>伦敦体系不需要记忆长篇变例。白方总是走几乎相同的10步，可以专注于中局计划而非死记开局。网上有大量伦敦体系爱好者。</p>\`,
    keyFen: "rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq - 3 3",
    keyMoves: ["d4", "Nf3", "Bf4"],
    tips: ["白方前三步：1.d4 2.Nf3 3.Bf4（几乎不变）", "建立金字塔：d4+e3+c3", "目标是稳健的中局而非开局刺杀", "对几乎所有黑方防御都适用"]
  }),
  ({
    id: "op-04",
    title: "西西里防御",
    category: "openings",
    section: "经典开局",
    difficulty: 2,
    content: \`<h3>黑方最锋利的选择</h3>
<p><b>西西里防御（Sicilian Defense）</b>是对1.e4最流行的应对，也是最富有战斗性的开局之一。</p>
<p>主变：<b>1.e4 c5</b></p>
<h4>核心思路</h4>
<ul>
  <li>黑方用c兵（而非e兵）来争夺中心——这是"从侧翼控制中心"的思路</li>
  <li>黑方通常会在c线和半开放的c线上寻求反击</li>
  <li>局面不对称——黑方接受白方有更多空间，但寻求动态反击机会</li>
</ul>
<h4>主要变例</h4>
<p>西西里的变例非常多：纳道尔夫变例(2...d6 5...a6)、龙式变例(2...d6 5...g6)、斯维什尼科夫变例等。初学者建议从<b>2...d6</b>开始。</p>\`,
    keyFen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    keyMoves: ["c5"],
    tips: ["黑方：1.e4 c5——从侧翼控制d4", "准备在c线发动反击", "初学者推荐2...d6进入纳道尔夫体系", "西西里有大量变例，建议选定一个深入学"]
  }),
  ({
    id: "op-05",
    title: "后翼弃兵",
    category: "openings",
    section: "经典开局",
    difficulty: 2,
    content: \`<h3>最经典的后兵开局</h3>
<p><b>后翼弃兵（Queen's Gambit）</b>是一个历史悠久的开局，虽然名字里有"弃兵"，但它实际上并不是真正的弃兵——如果黑方吃兵，白方可以轻松夺回控制权。</p>
<p>主变：<b>1.d4 d5 2.c4</b></p>
<h4>核心思路</h4>
<ul>
  <li>白方用c兵攻击黑方中心d5兵，试图让黑方放弃对中心的控制</li>
  <li>如果黑方接受弃兵(2...dxc4)，白方可以用e3和Bxc4夺回兵并获得更好的中心控制</li>
  <li>如果黑方拒绝接受(2...e6 后翼弃兵拒绝接受)，局面转为阵地战</li>
</ul>
<h4>为什么是"弃兵"？</h4>
<p>传统上如果黑方接受弃兵并试图保住它，白方可以获得强大攻势。现代理论认为黑方可以安全地暂时拿住这个兵，但最终白方总能通过各种手段夺回。</p>\`,
    keyFen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2",
    keyMoves: ["d4", "c4"],
    tips: ["白方：1.d4 d5 2.c4——用c兵攻击d5", "接受弃兵(2...dxc4)：白方用e3+Bxc4夺回", "拒绝接受(2...e6)：转入缓慢的阵地战", "后翼弃兵≠真正的弃子——它是用空间换中心控制"]
  }),
  ({
    id: "op-06",
    title: "卡罗-卡恩防御",
    category: "openings",
    section: "经典开局",
    difficulty: 1,
    content: \`<h3>黑方最稳固的防御</h3>
<p><b>卡罗-卡恩防御（Caro-Kann Defense）</b>是对1.e4最稳固的黑方应对之一，以安全性著称。</p>
<p>主变：<b>1.e4 c6 2.d4 d5</b></p>
<h4>核心思路</h4>
<ul>
  <li>黑方用c兵支持d5的推进——与法兰西防御(1...e6)不同，卡罗-卡恩不会阻挡c8象的出路</li>
  <li>黑方通常能获得稳固但不被动的局面</li>
  <li>黑王在中路多待一会儿（与大多数开局不同），但在卡罗-卡恩中这是安全的</li>
</ul>
<h4>为什么适合初学者？</h4>
<p>卡罗-卡恩变例相对较少，黑方计划明确：稳固防守、逐步展开、寻求中局反击机会。</p>\`,
    keyFen: "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    keyMoves: ["c6", "d5"],
    tips: ["黑方：1.e4 c6 2.d4 d5", "不会阻挡c8象（优于法兰西防御）", "稳固为王——适合喜欢稳健风格的棋手", "主要目标是均势→中局反击"]
  }),

  // ═══════════════════════════════════════════════════════════════
  // Section 3: 中局策略 (Middlegame Strategy)
  // ═══════════════════════════════════════════════════════════════
  ({
    id: "mg-01",
    title: "子力活跃性",
    category: "middlegame",
    section: "中局策略",
    difficulty: 2,
    content: \`<h3>活跃的棋子就是好棋子</h3>
<p><b>子力活跃性（Piece Activity）</b>是中局最重要的概念之一。一个活跃的马可以抵得上一个被动的车！</p>
<h4>如何评估子力活跃性？</h4>
<ul>
  <li>数一数你的每个棋子能走到多少个格子（特别是向前进攻的格子）</li>
  <li>一个在中心的马控制8格，在角落只控制2格——差距是4倍</li>
  <li>被自己的兵挡住的象称为"坏象"——想办法换掉它或激活它</li>
</ul>
<h4>"最不活跃的子"法则</h4>
<p>当你不确定该走什么时，找到你<b>位置最差的棋子</b>，想办法改善它。这个简单的原则往往能带来惊人的效果。</p>\`,
    tips: ["每个回合问：我的哪个棋子位置最差？", "活跃的马≈被动的车", "不要让你的象被自己的兵链封死", "每步棋都应该提高至少一个棋子的活跃度"]
  }),
  ({
    id: "mg-02",
    title: "兵形结构",
    category: "middlegame",
    section: "中局策略",
    difficulty: 3,
    content: \`<h3>兵是棋局的骨架</h3>
<p><b>兵形结构（Pawn Structure）</b>决定了整个对局的战略方向。兵不能后退，每一步兵推进都是永久性的承诺。</p>
<h4>常见的兵形弱点</h4>
<ul>
  <li><b>孤兵</b>：相邻两条线上没有友方兵保护的兵。孤兵是永久的弱点——对手可以把子力压在它前面。</li>
  <li><b>叠兵</b>：同一条线上有两个友方兵。它们不能互相保护，而且在残局中是严重负担。</li>
  <li><b>落后兵</b>：被己方兵落在了后面且无法安全推进的兵。</li>
</ul>
<h4>兵形好坏的简单判断</h4>
<p>好的兵形：兵与兵之间可以互相保护，形成链条。坏的兵形：兵与兵之间有空隙，形成孤立的"岛"。</p>\`,
    tips: ["不要轻易推兵——每步兵推进都是不可逆的", "避免制造孤兵、叠兵、落后兵", "兵链是互相保护的兵群——越少越好", "中局利用对手的兵形弱点来进攻"]
  }),
  ({
    id: "mg-03",
    title: "马的据点",
    category: "middlegame",
    section: "中局策略",
    difficulty: 2,
    content: \`<h3>马的最佳位置</h3>
<p><b>马的据点（Knight Outpost）</b>是指一个被己方兵保护、且不能被对方兵攻击的前方格子。在据点上，马是最危险的中局棋子。</p>
<h4>为什么据点如此重要？</h4>
<ul>
  <li>在据点上，马不能被兵驱赶（因为对方的兵被己方兵挡住或不在附近）</li>
  <li>马在据点（如d5、e5、d4、e4）可以攻击8个格子和对方王翼</li>
  <li>要从据点赶走一个马，对手必须用轻子或车来换——这通常是不等价的交换</li>
</ul>
<h4>最经典的据点</h4>
<p>白方：d5、e5、f5。黑方：d4、e4、f4。这些格子位于对方阵营前沿，是绝佳的据点。</p>\`,
    tips: ["寻找被己方兵保护的前线格子", "把马跳到对方兵无法攻击的位置", "d5/e5（白方）或d4/e4（黑方）是最佳据点", "要赶走据点上的马，对手需要付出代价"]
  }),
  ({
    id: "mg-04",
    title: "双象优势",
    category: "middlegame",
    section: "中局策略",
    difficulty: 2,
    content: \`<h3>两只象胜过两匹马</h3>
<p><b>双象优势（Bishop Pair）</b>：拥有两只象的一方控制了两个颜色复合（白格和黑格），通常在开放局面中拥有明显优势。</p>
<h4>为什么双象比马+象或双马强？</h4>
<ul>
  <li>两只象覆盖整个棋盘——一个控制白格，一个控制黑格，没有遗漏</li>
  <li>在开放局面中，象的远程攻击力远超马的短距离跳跃</li>
  <li>双象可以协调配合，在残局中对敌方王形成致命绞杀</li>
  <li>有经验的棋手估值双象优势 ≈ 0.5个兵的价值</li>
</ul>
<h4>什么情况下马比象好？</h4>
<p>在<b>封闭局面</b>中（双方兵链封锁了大量斜线），象的远程能力被限制，此时马（可以跳过兵）更强。</p>\`,
    tips: ["保留双象直到中局末期——它们是优势储备", "在开放局面中，双象 > 双马或马+象", "在封闭局面中，马 > 被兵挡住的象", "打算换象时，考虑是否值得放弃双象优势"]
  }),
  ({
    id: "mg-05",
    title: "王翼进攻",
    category: "middlegame",
    section: "中局策略",
    difficulty: 3,
    content: \`<h3>向对手的王发起总攻</h3>
<p><b>王翼进攻（Kingside Attack）</b>是中局最常见的获胜方式。当对手短易位后，王翼兵阵成为攻击目标。</p>
<h4>进攻王翼的经典方法</h4>
<ul>
  <li><b>兵潮</b>：推进f、g、h兵向前，撕裂对方的王翼兵阵</li>
  <li><b>车抬升</b>：将车抬到第三横排（如Rf1→Rf3→Rg3或Rh3），横向攻击王翼</li>
  <li><b>象和后的斜线攻击</b>：利用b1-h7或a1-h8斜线瞄准对方的王</li>
  <li><b>弃子开线</b>：必要时弃掉一个轻子或兵来打开王前面的防线</li>
</ul>
<h4>何时发动王翼进攻？</h4>
<p>在你自己的王安全的前提下，当你在王翼有子力优势（棋子比对方多）时发动进攻。如果中心封闭（双方兵链锁死），王翼进攻是最自然的计划。</p>\`,
    tips: ["前提：你自己的王是安全的", "方法：兵潮推进 + 车抬升 + 后象瞄准", "当中心封闭时，王翼进攻最自然", "大胆弃子打开防线——往往是制胜关键"]
  }),

  // ═══════════════════════════════════════════════════════════════
  // Section 4: 残局基础 (Endgame Basics)
  // ═══════════════════════════════════════════════════════════════
  ({
    id: "eg-01",
    title: "单后杀王",
    category: "endgame",
    section: "残局基础",
    difficulty: 1,
    content: \`<h3>残局第一步：学会杀王</h3>
<p><b>单后杀王</b>是所有棋手必须掌握的第一个残局技能。当对手只剩下孤王时，你需要用后和自己的王配合将死对方。</p>
<h4>基本方法</h4>
<ol>
  <li>用后把对方的王赶到棋盘边缘</li>
  <li>后不要走得太近——保持一个"骑士跳"的距离（避免逼和）</li>
  <li>把自己的王也带过来，形成二对一的杀王局面</li>
  <li>最后一步：后在己方王的保护下走到对方王面前</li>
</ol>
<h4>关键警告：避免逼和！</h4>
<p>当你把对方的王赶到角落时，后如果贴得太近可能造成逼和（stalemate）——对方无法走棋但并没有被将军，结果是平局。</p>\`,
    keyFen: "8/8/8/4k3/8/8/8/4Q2K w - - 0 1",
    tips: ["把敌王赶到棋盘边缘", "后保持骑士跳的距离，避免逼和", "把自己的王带来帮忙（二对一）", "最后的杀王：后在己方王的保护下贴在对方王旁边"]
  }),
  ({
    id: "eg-02",
    title: "单兵对单王",
    category: "endgame",
    section: "残局基础",
    difficulty: 2,
    content: \`<h3>残局中最常见的决胜局面</h3>
<p><b>单兵对单王</b>是残局中最基本的胜势判断。知道什么时候能赢、什么时候是和棋，决定了你的残局水平。</p>
<h4>正方形法则</h4>
<p>在没有己方王帮助的情况下，兵的升变能否被对方的王阻止？画一个以兵为起点、以升变格为终点的<b>正方形</b>：如果对方的王能踏入这个正方形，它就能阻止兵升变。</p>
<h4>对王法则</h4>
<p>当双方的王面对面（中间隔一格）时，轮到谁走谁吃亏——因为必须让开道路。这就是<b>对王（Opposition）</b>。掌握对王是残局最重要的技能。</p>
<h4>关键口诀</h4>
<p>兵在第六排（白方）或第三排（黑方）且己方王在兵前面时，<b>无论谁先走都是赢棋</b>。</p>\`,
    keyFen: "8/8/8/8/4k3/8/4P3/4K3 w - - 0 1",
    tips: ["正方形法则：判断王能否追上兵", "对王是关键——面对面时轮到谁走谁吃亏", "兵在第六排+王在兵前 = 必胜", "通路兵的价值随其前进而指数级增长"]
  }),
  ({
    id: "eg-03",
    title: "车残局基础",
    category: "endgame",
    section: "残局基础",
    difficulty: 3,
    content: \`<h3>最常见的残局类型</h3>
<p><b>车残局（Rook Endgame）</b>在所有残局中占比最高——约50%的残局至少包含一方有车。</p>
<h4>核心原则</h4>
<ul>
  <li><b>车放在通路兵后面</b>：无论是自己的兵还是对方的兵，车放在兵后面（而不是旁边或前面）是最佳位置。</li>
  <li><b>活跃的车</b>：一只活跃的车（在第7横排攻击对方的兵）往往值多一兵。</li>
  <li><b>切断对方的王</b>：用车切断对方的王通往关键区域的路线。</li>
</ul>
<h4>卢塞纳胜法</h4>
<p>当你多一个兵且车在兵后面时：把车抬到第四排，形成"桥"，护送兵升变。这是车残局中最重要的胜法。</p>\`,
    tips: ["车永远放在通路兵后面", "活跃的车在第7/第2横排攻击对方的兵", "车残局中，主动比被动更重要", "学习卢塞纳和菲利多两个经典局面"]
  }),
  ({
    id: "eg-04",
    title: "双象杀王",
    category: "endgame",
    section: "残局基础",
    difficulty: 2,
    content: \`<h3>用两只象将死孤王</h3>
<p><b>双象杀王</b>没有单后杀王那么简单，但方法一旦掌握就永远不会忘。</p>
<h4>基本方法</h4>
<ol>
  <li>两只象放在相邻的斜线上，形成一道"墙"</li>
  <li>用象的墙一步一步把对方的王逼到角落</li>
  <li>把自己的王也带过来，形成三对一的合力</li>
  <li>最后一步：在己方王的保护下用一只象将军</li>
</ol>
<h4>双马能杀王吗？</h4>
<p>双马<b>不能</b>将死孤王（防守方可以故意走入逼和）。但双马+一个兵（且兵还没升变）可以赢。这是残局中一个有趣的事实。</p>\`,
    tips: ["两只象放在相邻斜线形成墙", "用墙把敌王推向角落", "拥有双象的一方在残局 = 显著优势", "双马无法单独将死孤王（需要至少一个兵）"]
  }),
  ({
    id: "eg-05",
    title: "残局基本原则总结",
    category: "endgame",
    section: "残局基础",
    difficulty: 2,
    content: \`<h3>残局十大法则</h3>
<ol>
  <li><b>王变成战士</b>：残局中王不再需要躲藏——把它带到中心，主动参与战斗。</li>
  <li><b>通路兵决定胜负</b>：制造和保护通路兵是残局的首要任务。</li>
  <li><b>兑换子力不兑换兵</b>：如果你领先，换子（轻子/重子）——不换兵。</li>
  <li><b>车在兵后面</b>：无论自己的还是对方的通路兵，车的最佳位置是兵后面。</li>
  <li><b>不着急</b>：残局中"不要着急"——慢慢改善每个棋子的位置。</li>
  <li><b>兵要分两翼</b>：如果你想赢，保留两翼的兵来拉开对方防线。</li>
  <li><b>换一边的兵</b>：如果你想和棋，把一边的兵兑掉，减少输棋可能。</li>
  <li><b>对王法则</b>：面对面，谁先走谁吃亏。</li>
  <li><b>异色格象容易和</b>：即使多一个兵，异色格象经常是和棋。</li>
  <li><b>象比马好（开放局面）</b>：开放局面+两翼有兵时，象远胜于马。</li>
</ol>\`,
    tips: ["王在残局中是最重要的棋子——把它带到中心", "对手的每个子力兑换都让你的通路兵多一分胜算", "残局要慢慢来——每一步改善一个棋子的位置", "\\"不着急\\"是残局的黄金法则"]
  }),

  // ═══════════════════════════════════════════════════════════════
  // Section 5: 常见陷阱 (Common Traps)
  // ═══════════════════════════════════════════════════════════════
  ({
    id: "tp-01",
    title: "四步杀（学者将杀）",
    category: "traps",
    section: "常见陷阱",
    difficulty: 1,
    content: \`<h3>每个初学者都会遇到的陷阱</h3>
<p><b>四步杀（Scholar's Mate）</b>是国际象棋中最著名的开局陷阱。白方试图在4步内将死对方。</p>
<h4>走法</h4>
<p><b>1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#</b></p>
<h4>为什么有效？</h4>
<p>白方用后和象一起瞄准f7（黑方最弱的格子——只有王在保护）。如果黑方不警惕，第四步就被将死。</p>
<h4>如何防御？</h4>
<p>黑方第2步走2...Nc6保护e5兵是好的。第3步面对Bc4时，<b>走3...g6赶走白后</b>是标准应对。白方过早出后被黑方驱赶，反而浪费步数。</p>\`,
    keyFen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
    keyMoves: ["e4", "Qh5", "Bc4", "Qxf7#"],
    tips: ["白方：后+h5，象+c4，后xf7#", "黑方：3...g6 赶走白后——简单有效", "四步杀在低分段常见但高水平中不会成功", "走2.Qh5本身就是疑问手——黑方正确应对可得优势"]
  }),
  ({
    id: "tp-02",
    title: "勒加尔将杀",
    category: "traps",
    section: "常见陷阱",
    difficulty: 2,
    content: \`<h3>美丽的小子力将杀</h3>
<p><b>勒加尔将杀（Legal's Mate）</b>是国际象棋中最优雅的陷阱之一。白方假装"失误"送后，然后用两个轻子将死对方。</p>
<h4>走法</h4>
<p><b>1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6? 5.Nxe5!! Bxd1 6.Bxf7+ Ke7 7.Nd5#</b></p>
<h4>为什么如此精妙？</h4>
<p>白方第5步Nxe5!!牺牲了后——黑方以为白方犯了低级错误，贪心地吃了后。但接下来白方用象和马完成了令人惊叹的将杀：象在f7将军，马在d5封锁王的所有逃跑格。</p>\`,
    keyFen: "r2qkbnr/ppp2ppp/2np4/4N3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R b KQkq - 5 5",
    keyMoves: ["Nxe5!!", "Bxf7+", "Nd5#"],
    tips: ["白方故意\\"送后\\"让黑方贪吃", "两个轻子（象+马）完成了杀王", "即使黑方不吃后，白方也已赚得一兵", "关键是：黑方的象离开后翼后，d5失去了防守"]
  }),
  ({
    id: "tp-03",
    title: "钓鱼竿陷阱",
    category: "traps",
    section: "常见陷阱",
    difficulty: 2,
    content: \`<h3>西西里防御中的经典陷阱</h3>
<p><b>钓鱼竿陷阱（Fishing Pole Trap）</b>出现在西西里防御的某些变例中，黑方在g线上快速施压。</p>
<h4>典型走法</h4>
<p><b>1.e4 c5 2.Nf3 Nc6 3.Bb5 g6 4.O-O Bg7 5.Re1 Nf6 6.c3 O-O 7.d4 cxd4 8.cxd4 Qb6 9.e5? Ng4!</b></p>
<p>黑方的9...Ng4!是一个非常危险的陷阱——白马在f3受到攻击，同时黑象在g7的斜线瞄准了d4兵。白方面临丢子或王翼崩溃的选择。</p>
<h4>核心概念</h4>
<p>黑方利用开放式g线+象在g7的强力斜线，配合马在g4的侵扰，对白方短易位后的王翼制造了强大压力。</p>\`,
    tips: ["西西里防御中g线是关键的进攻通道", "Ng4入侵是常见的扰袭手段", "黑象在g7的斜线直指白方王翼", "白方不要轻易推进e5，除非中心已确保"]
  }),
  ({
    id: "tp-04",
    title: "布达佩斯弃兵陷阱",
    category: "traps",
    section: "常见陷阱",
    difficulty: 2,
    content: \`<h3>闪电般的反击</h3>
<p><b>布达佩斯弃兵（Budapest Gambit）</b>是黑方对1.d4的一种激进应对。其中的法雅洛维奇变例尤其危险。</p>
<h4>走法</h4>
<p><b>1.d4 Nf6 2.c4 e5 3.dxe5 Ne4!?（法雅洛维奇变例）4.Nf3? Nc6 5.a3? d6! 6.exd6? Bxd6 7.Nbd2?? Nxf2!</b></p>
<h4>陷阱的关键</h4>
<p>黑方第7步<b>Nxf2!</b>是一个毁灭性的打击：如果白方用王吃马(8.Kxf2)，黑方Bg3+将白王抽离，白后无处可逃。白方局面瞬间崩溃。</p>\`,
    keyFen: "rnbqkb1r/pppp1ppp/8/4p3/2P1n3/5N2/PP2PPPP/RNBQKB1R w KQkq - 1 4",
    keyMoves: ["Ne4", "Nxf2"],
    tips: ["布达佩斯弃兵：1.d4 Nf6 2.c4 e5!?", "法雅洛维奇3...Ne4是极度激进的选择", "陷阱核心：Nxf2!! 王吃则Bg3+抽后", "白方要小心不要在d线贪吃兵"]
  }),
  ({
    id: "tp-05",
    title: "开局陷阱防御总则",
    category: "traps",
    section: "常见陷阱",
    difficulty: 2,
    content: \`<h3>如何避免掉入陷阱？</h3>
<p>知道陷阱的存在是防御的第一步。大多数陷阱利用了以下心理：</p>
<ol>
  <li><b>贪吃</b>：对手看似失误地送了一个兵或棋子，诱使你放弃出子去吃它。</li>
  <li><b>过度扩张</b>：不停地推进边兵或过早发起进攻，忽视了子力的协调。</li>
  <li><b>机械走棋</b>：不思考对方走法的意图，按照自己的固定模式走。</li>
</ol>
<h4>防御陷阱的黄金法则</h4>
<ul>
  <li>每步之前问：<b>"对手想干什么？"</b>（预防性思维）</li>
  <li>面对"送子"不要立即吃——先检查是否是不明显的陷阱</li>
  <li>坚持开局原则：出子→易位→保王——这本身就是最好的反陷阱策略</li>
  <li>如果对手走了不自然的怪着，<b>停下来想一想</b>——正常回应通常是最好的</li>
</ul>\`,
    tips: ["每步问：对手想干什么？", "\\"送子\\"往往是陷阱——不要急于吃", "坚持基本开局原则是最好的防陷阱方法", "遇到怪招时停下来思考——不要被带入对手的节奏"]
  })
];


  // ── Learning Center Rendering ──────────────────────────────────
  var currentLearningSection = null;
  var currentLearningTopic = null;
  function showLearningSection(sectionKey) {
    currentLearningSection = sectionKey;
    var sectionNames = {principles: "开局原则", openings: "经典开局", middlegame: "中局策略", endgame: "残局基础", traps: "常见陷阱"};
    var topics = learningTopics.filter(function(t) { return t.category === sectionKey; });
    byId("learningSections").style.display = "none";
    byId("learningDetail").style.display = "";
    // Render topic list
    var list = byId("learningTopicList");
    list.innerHTML = "";
    topics.forEach(function(topic) {
      var btn = document.createElement("button");
      btn.className = "puzzle-item";
      btn.textContent = topic.title;
      btn.onclick = function() { showLearningTopic(topic); };
      list.appendChild(btn);
    });
    // Show first topic by default
    if (topics.length > 0) showLearningTopic(topics[0]);
  }
  function showLearningTopic(topic) {
    currentLearningTopic = topic;
    // Highlight active topic in list
    var btns = byId("learningTopicList").querySelectorAll(".puzzle-item");
    btns.forEach(function(b) { b.classList.remove("active"); });
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent === topic.title) { btns[i].classList.add("active"); break; }
    }
    // Render content
    byId("learningTopicContent").innerHTML = topic.content;
    // Render board if FEN provided
    var boardDiv = byId("learningTopicBoard");
    if (topic.keyFen) {
      boardDiv.style.display = "";
      renderBoard("learningTopicBoard", topic.keyFen, "", function() {});
    } else {
      boardDiv.style.display = "none";
    }
    // Render tips
    var tipsDiv = byId("learningTopicTips");
    tipsDiv.innerHTML = "";
    if (topic.tips && topic.tips.length) {
      topic.tips.forEach(function(tip) {
        var tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "💡 " + tip;
        tipsDiv.appendChild(tag);
      });
    }
  }


  // ── Rank Display ──────────────────────────────────────────────
  function getRankDisplay(points) {
    if (points < 100) return { piece: "♟", title: "兵", level: 1, next: 100 };
    if (points < 300) return { piece: "♞", title: "骑士", level: 2, next: 300 };
    if (points < 600) return { piece: "♝", title: "主教", level: 3, next: 600 };
    if (points < 1000) return { piece: "♜", title: "战车", level: 4, next: 1000 };
    if (points < 1500) return { piece: "♛", title: "皇后", level: 5, next: 1500 };
    return { piece: "♚", title: "国王", level: 6, next: Infinity };
  }

  // ── Arena (Public Matchmaking) ─────────────────────────────────
  var arenaRoomNumber = "";
  function checkArenaStatus() {
    if (!token) return;
    api("/arena/status", "GET", null, true).then(function(data) {
      var joinBtn = byId("btnArenaJoin");
      var leaveBtn = byId("btnArenaLeave");
      var statusEl = byId("arenaStatusText");
      var queueInfo = byId("arenaQueueInfo");
      var statusIcon = byId("arenaStatus");
      if (data.inQueue) {
        joinBtn.style.display = "none";
        leaveBtn.style.display = "";
        statusIcon.textContent = "⏳";
        statusEl.textContent = "正在匹配对手...";
        queueInfo.textContent = "队列中第 " + data.queuePosition + " 位 · 队列共 " + data.queueSize + " 人";
      } else {
        joinBtn.style.display = "";
        leaveBtn.style.display = "none";
        statusIcon.textContent = "⚔";
        statusEl.textContent = "点击加入公开匹配";
        queueInfo.textContent = "当前队列: " + data.queueSize + " 人在等待";
      }
    }).catch(function(){});
  }
  function joinArena() {
    if (!token) { showToast("请先登录"); return; }
    byId("btnArenaJoin").disabled = true;
    byId("arenaStatusText").textContent = "正在加入...";
    api("/arena/join", "POST", {}, true).then(function(data) {
      byId("btnArenaJoin").disabled = false;
      if (data.matched) {
        byId("arenaStatus").textContent = "🎯";
        byId("arenaStatusText").textContent = "已匹配到对手！";
        byId("arenaMatchedInfo").style.display = "";
        byId("arenaRoomNumber").textContent = data.roomNumber;
        arenaRoomNumber = data.roomNumber;
        byId("btnArenaJoin").style.display = "none";
        byId("btnArenaLeave").style.display = "none";
      } else {
        checkArenaStatus();
      }
    }).catch(function(e) {
      byId("btnArenaJoin").disabled = false;
      showToast(String(e.message || e));
    });
  }
  function leaveArena() {
    api("/arena/leave", "POST", {}, true).then(function() {
      checkArenaStatus();
    }).catch(function(){ checkArenaStatus(); });
  }
  function goToArenaPvp() {
    if (arenaRoomNumber) {
      byId("joinRoomNumber").value = arenaRoomNumber;
      joinRoom();
      navigateTo("pvpView");
    }
  }
  function loadArenaStats() {
    if (!token) return;
    api("/arena/stats", "GET", null, true).then(function(data) {
      var list = byId("arenaStatsList");
      list.innerHTML = "";
      if (!data.items || !data.items.length) {
        list.innerHTML = "<div style=\\'color:var(--muted);padding:10px;\\'>暂无战绩记录</div>";
        return;
      }
      data.items.slice(0, 20).forEach(function(item) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);font-size:13px;";
        row.innerHTML = "<span><b>#" + item.rank + "</b> " + escapeHtml(item.name) + "</span><span>" + item.wins + "胜 " + item.losses + "负 " + item.draws + "平 · " + item.winRate + "</span>";
        list.appendChild(row);
      });
    }).catch(function(){});
  }

  // ── Rankings Display ───────────────────────────────────────────
  var currentRankTab = "global";
  function loadRankings(tab) {
    if (!token) return;
    currentRankTab = tab || currentRankTab;
    var url = "/rankings/global";
    if (currentRankTab === "puzzle") url = "/rankings/puzzle";
    else if (currentRankTab === "battle") url = "/rankings/battle";
    byId("btnRankGlobal").classList.toggle("active", currentRankTab === "global");
    byId("btnRankPuzzle").classList.toggle("active", currentRankTab === "puzzle");
    byId("btnRankBattle").classList.toggle("active", currentRankTab === "battle");
    api(url, "GET", null, true).then(function(data) {
      var list = byId("rankingsTable");
      list.innerHTML = "";
      if (!data.items || !data.items.length) {
        list.innerHTML = "<div style=\\'color:var(--muted);padding:10px;\\'>暂无排名数据</div>";
        return;
      }
      // Header
      var header = document.createElement("div");
      header.style.cssText = "display:grid;grid-template-columns:50px 1fr 90px 80px 120px;gap:4px;padding:6px 8px;font-weight:700;font-size:12px;border-bottom:2px solid rgba(0,0,0,.12);";
      header.innerHTML = "<span>排名</span><span>棋手</span>" +
        (currentRankTab === "puzzle" ? "<span>解题</span><span>正确率</span>" :
         currentRankTab === "battle" ? "<span>胜场</span><span>胜率</span>" :
         "<span>积分</span><span>段位</span>") +
        "<span>战绩</span>";
      list.appendChild(header);
      // Rows
      data.items.forEach(function(item) {
        var row = document.createElement("div");
        row.style.cssText = "display:grid;grid-template-columns:50px 1fr 90px 80px 120px;gap:4px;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);font-size:13px;align-items:center;";
        var rankIcon = item.rank <= 3 ? ["🥇","🥈","🥉"][item.rank-1] : "#" + item.rank;
        var col3, col4;
        if (currentRankTab === "puzzle") {
          col3 = item.solved + "题";
          col4 = item.accuracy;
        } else if (currentRankTab === "battle") {
          col3 = item.wins + "胜";
          col4 = item.winRate;
        } else {
          col3 = item.points + "分";
          col4 = item.rankTitle || "";
        }
        var battles = (item.wins||0) + "胜 " + (item.losses||0) + "负 " + (item.draws||0) + "平";
        row.innerHTML = "<span style=\\'font-weight:700;\\'>" + rankIcon + "</span>" +
          "<span>" + escapeHtml(item.name) + "</span>" +
          "<span>" + col3 + "</span>" +
          "<span>" + col4 + "</span>" +
          "<span style=\\'font-size:11px;\\'>" + battles + "</span>";
        list.appendChild(row);
      });
    }).catch(function(e){ showToast(String(e.message || e)); });
  }

  // ── Event listeners ───────────────────────────────────────────

  // Dashboard card click handlers
  document.querySelectorAll(".dash-card").forEach(function (card) {
    card.addEventListener("click", function () {
      var target = card.getAttribute("data-target");
      if (!target) return; // Cards without data-target handle their own clicks (e.g. bind parent)
      if (target === "classView") {
        if (userRole === "teacher") target = "classTeacherView";
        else target = "classStudentView";
      }
      navigateTo(target);
    });
  });
  // Back button
  // Bind parent card (student dashboard) - opens code modal
  byId("dashBindParent").addEventListener("click", function () {
    if (!token) { showToast("请先登录"); return; }
    api("/student/my-code", "GET", null, true)
      .then(function (data) { showStudentBindModal(data); })
      .catch(function (e) { showToast("获取绑定码失败: " + String(e.message || e)); });
  });
  byId("backBtn").addEventListener("click", goBack);
  // Learning Center section cards
  document.querySelectorAll("#learningSections .dash-card").forEach(function (card) {
    card.addEventListener("click", function () {
      showLearningSection(card.getAttribute("data-section"));
    });
  });
  byId("btnLogin").addEventListener("click", quickLogin);
  byId("btnLoadProblems").addEventListener("click", loadProblems);
  byId("btnNextProblem").addEventListener("click", nextProblem);
  byId("btnHint").addEventListener("click", showHint);

  // Class Teacher
  byId("btnCreateClass").addEventListener("click", createClass);
  byId("clsSelect").addEventListener("change", function () { showClassDetail(this.value); });
  byId("btnRefreshClass").addEventListener("click", function () { loadTeacherClasses(); showClassDetail(byId("clsSelect").value); });

  // Class Student
  byId("btnJoinClass").addEventListener("click", joinClass);
  byId("stuClsSelect").addEventListener("change", function () { showStudentClassDetail(this.value); });
  byId("btnStuRefresh").addEventListener("click", function () { loadStudentClasses(); showStudentClassDetail(byId("stuClsSelect").value); });
  byId("btnPracticeSubmit").addEventListener("click", function () { submitPractice(byId("practiceMove").value.trim()); });
  byId("btnStart").addEventListener("click", startMatch);
  byId("btnBattleSubmit").addEventListener("click", function () { submitBattle(byId("battleMove").value.trim()); });
  byId("btnSuggest").addEventListener("click", suggest);
  byId("btnAnalyze").addEventListener("click", analyze);

  // ── Binding Modal ─────────────────────────────────────────────
  byId("btnBindModalClose").addEventListener("click", function () {
    byId("bindModal").style.display = "none";
    if (bindCountdownTimer) { clearInterval(bindCountdownTimer); bindCountdownTimer = null; }
  });
  byId("bindModal").addEventListener("click", function (e) {
    if (e.target === byId("bindModal")) {
      byId("bindModal").style.display = "none";
      if (bindCountdownTimer) { clearInterval(bindCountdownTimer); bindCountdownTimer = null; }
    }
  });

  // Parent Dashboard
  byId("btnBindChild").addEventListener("click", bindChild);
  byId("btnRefreshChildren").addEventListener("click", function () { loadMyChildren(); byId("childDetail").innerHTML = ""; });
  // ── Weekly Report Buttons ───────────────────────────────────
  byId("btnGenerateReport").addEventListener("click", function () {
    var childId = byId("reportChildSelect").value;
    if (!childId) { showToast("请先选择孩子"); return; }
    var childName = byId("reportChildSelect").selectedOptions[0].textContent;
    byId("reportResult").innerHTML = "<div class='feed'>⏳ 正在生成周报，AI评语生成中...</div>";
    api("/parent/child/" + childId + "/generate-report", "POST", {}, true)
      .then(function (data) { renderReportResult(data.report, childName, data.cached); })
      .catch(function (e) { byId("reportResult").innerHTML = "<div class='feed' style='color:var(--banner);'>❌ " + escapeHtml(String(e.message || e)) + "</div>"; });
  });
  byId("btnViewReports").addEventListener("click", function () {
    var childId = byId("reportChildSelect").value;
    if (!childId) { showToast("请先选择孩子"); return; }
    var childName = byId("reportChildSelect").selectedOptions[0].textContent;
    loadWeeklyReports(childId, childName);
  });

  byId("btnCreatePlan").addEventListener("click", createStudyPlan);
  byId("btnRefreshPlans").addEventListener("click", loadStudyPlans);
  byId("btnParentJoinClass").addEventListener("click", parentJoinClass);
  byId("parentClsSelect").addEventListener("change", function () { showParentClassDetail(this.value); });
  byId("btnParentClsRefresh").addEventListener("click", function () { loadParentClasses(); showParentClassDetail(byId("parentClsSelect").value); });
  // Parent data is loaded in renderCurrentView when navigating to parentView

  // ── PvP Event Listeners ──────────────────────────────────────

  // Time control preset buttons
  document.querySelectorAll("#timePresets .time-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var min = parseInt(this.getAttribute("data-min"));
      var inc = parseInt(this.getAttribute("data-inc"));
      selectTimeControl(min, inc);
    });
  });

  // Custom time inputs
  byId("customMinutes").addEventListener("change", function () {
    if (document.querySelector("#customTimeBtn.selected")) {
      pvpSelectedTime.initialMinutes = parseInt(this.value) || 3;
    }
  });
  byId("customSeconds").addEventListener("change", function () {
    if (document.querySelector("#customTimeBtn.selected")) {
      pvpSelectedTime.incrementSeconds = parseInt(this.value) || 2;
    }
  });

  byId("btnCreateRoom").addEventListener("click", createRoom);
  byId("btnJoinRoom").addEventListener("click", joinRoom);
  byId("btnRefreshRooms").addEventListener("click", refreshActiveRooms);
  byId("btnPvpResign").addEventListener("click", resignPvp);
  byId("btnPvpDraw").addEventListener("click", offerDraw);
  byId("btnPvpShareClass").addEventListener("click", shareRoomToClass);

  // Join room on Enter key
  byId("joinRoomNumber").addEventListener("keypress", function (e) {
    if (e.key === "Enter") joinRoom();
  });

  // PvP and Friends data loaded in renderCurrentView

  // ── Friends Event Listeners ───────────────────────────────────

  byId("btnFriendSearch").addEventListener("click", searchFriends);
  byId("btnRefreshFriends").addEventListener("click", function () { loadFriends(); loadFriendRequests(); });

  // Friend search on Enter
  byId("friendSearchInput").addEventListener("keypress", function (e) {
    if (e.key === "Enter") searchFriends();
  });

  // Chat
  byId("btnChatSend").addEventListener("click", sendChatMessage);
  byId("btnCloseChat").addEventListener("click", closeChat);
  byId("chatInput").addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendChatMessage();
  });

  // ── Arena Event Listeners ─────────────────────────────────────
  byId("btnArenaJoin").addEventListener("click", joinArena);
  byId("btnArenaLeave").addEventListener("click", leaveArena);
  byId("btnArenaGoPvp").addEventListener("click", goToArenaPvp);
  byId("btnArenaRefreshStats").addEventListener("click", loadArenaStats);

  // ── Rankings Event Listeners ─────────────────────────────────
  byId("btnRankGlobal").addEventListener("click", function() { loadRankings("global"); });
  byId("btnRankPuzzle").addEventListener("click", function() { loadRankings("puzzle"); });
  byId("btnRankBattle").addEventListener("click", function() { loadRankings("battle"); });
  byId("btnRefreshRankings").addEventListener("click", function() { loadRankings(currentRankTab); });

  // Friends data loaded in renderCurrentView

  // Periodically check for game requests
  setInterval(function () {
    if (token) checkGameRequests();
  }, 10000);

  renderBoard("pvpBoard", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "", function () {});

  renderBoard("practiceBoard", "8/8/8/8/8/8/8/8", "", function () {});
  renderBattle();

  // ── Auto-login from saved session ──────────────────────────────
  try {
    var savedToken = localStorage.getItem("chesstong_token");
    var savedRole = localStorage.getItem("chesstong_role");
    var savedPhone = localStorage.getItem("chesstong_phone");
    var savedName = localStorage.getItem("chesstong_name");
    if (savedToken && savedRole) {
      // Verify token is still valid
      fetch("/rankings/global", { headers: { "Authorization": "Bearer " + savedToken } })
        .then(function(res) {
          if (res.ok) {
            token = savedToken;
            userRole = savedRole;
            if (savedPhone) byId("phone").value = savedPhone;
            if (savedName) byId("name").value = savedName;
            byId("role").value = savedRole;
            quickLogin();
          } else {
            // Token expired, clear storage
            localStorage.removeItem("chesstong_token");
          }
        })
        .catch(function() {});
    }
  } catch(e) {}
})();
</script>
</body>
</html>`;

export const demoRoutes: FastifyPluginAsync = async (app) => {
  app.get("/demo", async (_request, reply) => {
    reply
      .header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
      .header("Pragma", "no-cache")
      .header("Expires", "0")
      .type("text/html; charset=utf-8")
      .send(html);
  });
};
