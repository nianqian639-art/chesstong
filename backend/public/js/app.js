// 棋童 App — Complete Application Logic
let currentView = sessionStorage.getItem("ct.currentView") || "dashboard", ws = null, wsReconnectTimer = null, wsErrorNotified = false, pvpRoomId = sessionStorage.getItem("ct.pvpRoomId") || "", pvpFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", pvpSelected = "", pvpMyColor = "", chatPollTimer = null, gameRequestPollTimer = null;
let problems = [], currentProblem = null, hintIdx = 0, practiceSelected = "", lastPracticeAnswer = "";
let practiceBoardFen = "", practiceSolved = false, practiceSubmitting = false, practiceAttempt = 0, explainInProgress = false;
let matchId = "", battleFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", battleSelected = "", moves = [];
let lastBattleEngineMove = null;
let battleOver = false;
let dailyMissions = [];
let rankTab = "global", currentSection = null, bindTimer = null;
let editorFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", selectedPiece = "K", currentClassId = "";
const BATTLE_LEVELS = [
  { tier: 1, difficulty: 1 }, { tier: 2, difficulty: 2 }, { tier: 3, difficulty: 4 },
  { tier: 4, difficulty: 7 }, { tier: 5, difficulty: 11 }, { tier: 6, difficulty: 16 },
];
const PIECES_FULL = { K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟\uFE0E",".":"·" };
const VOICE_PRESETS = {
  story: { labelKey: "storySister", rate: 0.86, pitch: 1.08, hintKey: "storyHint" },
  child: { labelKey: "childPlayer", rate: 0.95, pitch: 1.18, hintKey: "childHint" },
  buddy: { labelKey: "energyBuddy", rate: 1.03, pitch: 1.16, hintKey: "buddyHint" },
  coach: { labelKey: "patientCoach", rate: 0.88, pitch: 0.92, hintKey: "coachHint" },
  monkey: { labelKey: "monkeyKing", rate: 1.03, pitch: 1.16, hintKey: "monkeyHint" },
};
let speechVoices = [];
let audioCtx = null;
let currentTtsAudio = null;
let speakSession = 0;

const PVP_TIME_CONTROLS = ["1+0", "3+2", "5+3", "10+0", "15+10", "30+10", "120+15"];
function initPvpTimeControls(){
  for (const id of ["pvpTimeControl", "friendTimeControl", "pvpNextTimeControl"]) {
    const select = document.getElementById(id);
    select.innerHTML = PVP_TIME_CONTROLS.map(value => `<option value="${value}">${value}</option>`).join("");
    const saved = localStorage.getItem("ct.pvpTimeControl");
    select.value = PVP_TIME_CONTROLS.includes(saved) ? saved : "10+0";
    select.onchange = () => {
      localStorage.setItem("ct.pvpTimeControl", select.value);
      for (const otherId of ["pvpTimeControl", "friendTimeControl", "pvpNextTimeControl"]) document.getElementById(otherId).value = select.value;
    };
  }
}
function selectedPvpTimeControl(id){
  const value = document.getElementById(id).value;
  if (!PVP_TIME_CONTROLS.includes(value)) throw new Error(t("chooseTime"));
  const [initialMinutes, incrementSeconds] = value.split("+").map(Number);
  return {initialMinutes, incrementSeconds};
}
function pvpTimeLabel(control){ return control ? `${control.initialMinutes}+${control.incrementSeconds}` : ""; }

// ── Init ──
window.ctTrialMode = new URLSearchParams(location.search).get("trial") === "1";
if (window.ctTrialMode) {
  // A trial tab must never inherit a previously saved account session.
  API.token = "";
  API.user = { id: "trial", displayName: t("trialUser"), role: "guest", points: 0, level: 1, streakDays: 0, childIds: [], classIds: [] };
} else if (!API.autoLogin()) {
  location.href = "/";
}
if (API.user) {
document.getElementById("userInfo").textContent = API.user.displayName;
const myRank = getRank(API.user.points || 0);
document.getElementById("greeting").textContent = t("welcomeBack", { name: API.user.displayName });
document.getElementById("rankLine").textContent = window.ctTrialMode ? t("trialNote") : myRank.piece + " " + myRank.title + " · " + (API.user.points||0) + t("points");
if (window.ctTrialMode) {
  document.querySelectorAll('#topNav [data-nav="pvp"], #topNav [data-nav="arena"], #topNav [data-nav="rankings"], #topNav [data-nav="friends"], #topNav [data-nav="classStudent"], #topNav [data-nav="classTeacher"], #topNav [data-nav="parent"]').forEach(el => { el.style.display = "none"; });
  const rankCard = document.getElementById("rankCard"); if (rankCard) rankCard.style.display = "none";
  const missions = document.getElementById("dailyMissionCard"); if (missions) missions.style.display = "none";
  const logout = document.querySelector('button[onclick="API.logout()"]'); if (logout) { logout.textContent = t("login"); logout.onclick = () => { location.href = "/#login"; }; }
}
initPvpTimeControls();
updateRoleNav();
initDash();
initVoiceSettings();
connectWs();
loadVariants();
initBattleDifficulty();
if (API.user.role === "student") fetchBindCodeDisplay();
if (currentView !== "dashboard") setTimeout(() => navTo(currentView), 0);
}

// ── Navigation ──
function updateRoleNav() {
  if (window.ctTrialMode) {
    ["navClassTeacher", "navClassStudent", "navParent"].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = "none";
    });
    return;
  }
  const r = API.user.role;
  document.getElementById("navClassTeacher").style.display = r === "teacher" ? "" : "none";
  document.getElementById("navClassStudent").style.display = (r === "student" || r === "parent") ? "" : "none";
  document.getElementById("navParent").style.display = r === "parent" ? "" : "none";
}

function navTo(view) {
  if (window.ctTrialMode && ["pvp", "arena", "rankings", "friends", "classStudent", "classTeacher", "parent", "bind"].includes(view)) {
    view = "dashboard";
  }
  currentView = view;
  sessionStorage.setItem("ct.currentView", view);
  if (view === "arena" || view === "bind") return; // handled by delegation
  document.querySelectorAll("[id^='view-']").forEach(el => el.style.display = "none");
  const t = document.getElementById("view-" + view);
  if (t) t.style.display = "";
  else { navTo("dashboard"); return; } // fallback
  if (view === "dashboard" && API.user.role === "student") loadDailyMissions();
  if (view === "learn") initLearn();
  if (view === "battle") { initBattleDifficulty(); loadVariants(); }
  if (view === "rankings") { renderRankRules(); loadRankings(); }
  if (view === "friends") {
    loadFriends(); loadFriendRequests(); loadGameRequests();
    if (!gameRequestPollTimer) gameRequestPollTimer = setInterval(loadGameRequests, 3000);
  }
  if (view === "parent") loadMyChildren();
  if (view === "classTeacher") loadTeacherClasses();
  if (view === "classStudent") loadStudentClasses();
}

document.getElementById("topNav").addEventListener("click", e => {
  const a = e.target.closest("[data-nav]");
  if (a) { e.preventDefault(); navTo(a.dataset.nav); }
});

// ── Dashboard ──
function initDash() {
  updateRankDisplay();
  const cards = window.ctTrialMode ? [
    { icon:"📚", title:t("learningCenter"), desc:t("learnDesc"), view:"learn" },
    { icon:"⚔", title:t("practiceCenter"), desc:t("practiceCenter"), view:"practice" },
    { icon:"♛", title:t("aiBattle"), desc:t("aiBattle"), view:"battle" },
  ] : [
    { icon:"📚", title:t("learningCenter"), desc:t("learnDesc"), view:"learn" },
    { icon:"⚔", title:t("practiceCenter"), desc:"300+ · AI", view:"practice" },
    { icon:"♛", title:t("aiBattle"), desc:"Stockfish", view:"battle" },
    { icon:"👥", title:t("pvpBattle"), desc:t("pvpDesc"), view:"pvp" },
    { icon:"🏟", title:t("arenaTitle"), desc:t("arenaDesc"), view:"arena", action:true },
    { icon:"🏆", title:t("rankingTitle"), desc:t("rankingsDesc"), view:"rankings" },
    { icon:"💬", title:t("friendTitle"), desc:t("friendDesc"), view:"friends" },
  ];
  if (!window.ctTrialMode) {
    if (API.user.role === "student") cards.push({ icon:"🔗", title:t("bindParent"), desc:t("bindingDesc"), view:"bind", action:true });
    if (API.user.role === "student" || API.user.role === "parent") cards.push({ icon:"📖", title:t("myClass"), desc:t("classesDesc"), view:"classStudent" });
    if (API.user.role === "teacher") cards.push({ icon:"🏫", title:t("classManagement"), desc:t("classesDesc"), view:"classTeacher" });
    if (API.user.role === "parent") cards.push({ icon:"👨‍👩‍👧", title:t("parentCenter"), desc:t("parentDesc"), view:"parent" });
  }

  document.getElementById("dashGrid").innerHTML = cards.map(c => `
    <div class="dash-card" data-view="${c.view}">
      <div class="icon">${c.icon}</div><h3>${c.title}</h3><p>${c.desc}</p>
    </div>`).join("");
  if (API.user.role === "student") loadDailyMissions();
  else {
    const card = document.getElementById("dailyMissionCard");
    if (card) card.style.display = "none";
  }
}

function missionIcon(type) {
  if (type === "login") return "🌞";
  if (type === "solve_count") return "📝";
  if (type === "battle_count") return "♟";
  return "⭐";
}

function missionText(mission) {
  const count = mission.condition.threshold;
  if (mission.condition.type === "login") {
    return { name: t("missionLoginName"), description: t("missionLoginDescription") };
  }
  if (mission.condition.type === "solve_count") {
    return { name: t("missionTrainingName"), description: t("missionTrainingDescription", { count }) };
  }
  if (mission.condition.type === "battle_count") {
    return { name: t("missionBattleName"), description: t("missionBattleDescription", { count }) };
  }
  return { name: mission.name, description: mission.description };
}

function renderDailyMissions(date) {
  const card = document.getElementById("dailyMissionCard");
  if (!card) return;
  card.style.display = "";
  card.innerHTML = `
    <div class="mission-card">
      <div class="mission-head">
        <div>
          <h3>✅ ${t("dailyMissions")}</h3>
          <p>${t("dailyMissionsUpdated", { date })}</p>
        </div>
        <button class="btn btn-ghost" onclick="loadDailyMissions()">${t("refresh")}</button>
      </div>
      <div class="mission-list">
        ${dailyMissions.map(function(mission) {
          const done = mission.completed || mission.claimed;
          const text = missionText(mission);
          const action = mission.claimed
            ? `<span class="mission-check">✓</span>`
            : mission.completed
              ? `<button class="btn btn-primary" onclick="claimMission('${mission.id}')">${t("missionClaim", { points: mission.pointsReward })}</button>`
              : `<span class="mission-chip">${mission.progress}/${mission.condition.threshold}</span>`;
          return `
            <div class="mission-item ${done ? "done" : ""}">
              <div class="mission-badge">${missionIcon(mission.condition.type)}</div>
              <div class="mission-main">
                <h4>${esc(text.name)}</h4>
                <p>${esc(text.description)}</p>
                <div class="mission-meta">
                  <span class="mission-chip">${t("missionReward", { points: mission.pointsReward })}</span>
                  <span class="mission-chip">${mission.completed ? t("missionCompleted") : t("missionInProgress")}</span>
                </div>
              </div>
              <div>${action}</div>
            </div>`;
        }).join("") || `<div class="feed">${t("dailyMissionsEmpty")}</div>`}
      </div>
    </div>`;
}

async function loadDailyMissions() {
  if (API.user.role !== "student") return;
  const card = document.getElementById("dailyMissionCard");
  if (card) {
    card.style.display = "";
    card.innerHTML = `<div class="mission-card"><div class="feed">${t("dailyMissionsLoading")}</div></div>`;
  }
  try {
    const data = await API.req("/missions/today");
    dailyMissions = data.missions || [];
    renderDailyMissions(data.date || new Date().toISOString().slice(0, 10));
  } catch (e) {
    if (card) {
      card.style.display = "";
      card.innerHTML = `<div class="mission-card"><div class="feed">${t("dailyMissionsLoadFailed", { message: esc(e.message) })}</div></div>`;
    }
  }
}

async function claimMission(missionId) {
  try {
    const result = await API.req("/missions/claim", "POST", { missionId: missionId });
    toast(t("pointsClaimed"));
    if (typeof result.points === "number") API.user.points = result.points;
    updateRankDisplay();
    await loadDailyMissions();
  } catch (e) {
    toast(e.message);
  }
}

function initVoiceSettings() {
  const el = document.getElementById("voiceSettings");
  if (!el) return;
  const supported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  if (!supported) {
    el.innerHTML = `<div class="voice-panel"><h3>🔊 ${t("voiceTitle")}</h3><div style="font-size:13px;color:var(--muted);">${t("voiceUnsupported")}</div></div>`;
    return;
  }
  const saved = JSON.parse(localStorage.getItem("ct_voice_settings") || "{}");
  el.innerHTML = `
    <div class="voice-panel">
      <h3>🔊 ${t("voiceTitle")}</h3>
      <div class="voice-note">${t("voiceNote")}</div>
      <div class="voice-grid">
        <div class="voice-field">
          <label>${t("voiceStyle")}</label>
          <select id="voicePreset">
            ${Object.entries(VOICE_PRESETS).map(([k,v]) => `<option value="${k}">${t(v.labelKey)}</option>`).join("")}
          </select>
        </div>
        <div class="voice-field">
          <label>${t("systemVoice")}</label>
          <select id="voiceSelect"><option value="">${t("autoVoice")}</option></select>
        </div>
        <div class="voice-field">
          <label>${t("voiceRate")} <span id="voiceRateText"></span></label>
          <input id="voiceRate" type="range" min="0.7" max="1.35" step="0.05">
        </div>
        <div class="voice-field">
          <label>${t("voiceNatural")} <span id="voicePitchText"></span></label>
          <input id="voicePitch" type="range" min="0.85" max="1.25" step="0.05">
        </div>
        <div class="voice-field" style="flex:0 0 auto;align-self:end;">
          <button class="btn btn-ghost" type="button" onclick="testVoice()">${t("testVoice")}</button>
        </div>
        <div class="voice-field" style="flex:0 0 auto;align-self:end;">
          <button class="btn btn-ghost" type="button" onclick="playUiSound('correct')">${t("testSound")}</button>
        </div>
      </div>
      <div id="voiceHint" class="voice-hint"></div>
    </div>`;
  document.getElementById("voicePreset").value = saved.preset || "story";
  applyVoicePreset(false);
  if (saved.rate) document.getElementById("voiceRate").value = saved.rate;
  if (saved.pitch) document.getElementById("voicePitch").value = saved.pitch;
  document.getElementById("voicePreset").addEventListener("change", () => applyVoicePreset(true));
  ["voiceSelect", "voiceRate", "voicePitch"].forEach(id => document.getElementById(id).addEventListener("change", saveVoiceSettings));
  ["voiceRate", "voicePitch"].forEach(id => document.getElementById(id).addEventListener("input", updateVoiceLabels));
  loadSpeechVoices(saved.voice || "");
  updateVoiceLabels();
}

function loadSpeechVoices(preferred) {
  if (!("speechSynthesis" in window)) return;
  speechVoices = speechSynthesis.getVoices();
  const select = document.getElementById("voiceSelect");
  if (!select) return;
  const locale = { zh: "zh", en: "en", ja: "ja", fr: "fr", es: "es" }[getLang()] || "zh";
  // Never offer a voice from another language. The old all-voices fallback
  // could leave a Chinese voice selected after switching to English or French.
  const list = speechVoices.filter(v => v.lang.toLowerCase().startsWith(locale));
  select.innerHTML = `<option value="">${t("autoVoice")}</option>` + list.map(v => `<option value="${esc(v.name)}">${esc(getLang()==="zh"?v.name:v.name.replace(/\s*[（(].*$/, "").replace(/[\u3400-\u9fff]+/g,"")) || esc(v.lang)} · ${esc(v.lang)}</option>`).join("");
  if (preferred) select.value = preferred;
  saveVoiceSettings();
}

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = () => {
    const saved = JSON.parse(localStorage.getItem("ct_voice_settings") || "{}");
    loadSpeechVoices(saved.voice || "");
  };
}

function applyVoicePreset(save) {
  const presetKey = document.getElementById("voicePreset")?.value || "story";
  const preset = VOICE_PRESETS[presetKey] || VOICE_PRESETS.story;
  const rate = document.getElementById("voiceRate");
  const pitch = document.getElementById("voicePitch");
  if (rate) rate.value = preset.rate;
  if (pitch) pitch.value = preset.pitch;
  const hint = document.getElementById("voiceHint");
  if (hint) hint.textContent = preset.hintKey ? t(preset.hintKey) : "";
  updateVoiceLabels();
  if (save) saveVoiceSettings();
}

function updateVoiceLabels() {
  const rate = document.getElementById("voiceRate")?.value || "1";
  const pitch = document.getElementById("voicePitch")?.value || "1";
  const rt = document.getElementById("voiceRateText");
  const pt = document.getElementById("voicePitchText");
  if (rt) rt.textContent = `${rate}x`;
  if (pt) pt.textContent = pitch;
}

function saveVoiceSettings() {
  const settings = {
    preset: document.getElementById("voicePreset")?.value || "story",
    voice: document.getElementById("voiceSelect")?.value || "",
    rate: Number(document.getElementById("voiceRate")?.value || 1),
    pitch: Number(document.getElementById("voicePitch")?.value || 1),
  };
  localStorage.setItem("ct_voice_settings", JSON.stringify(settings));
}

function cleanSpeechText(text) {
  const div = document.createElement("div");
  div.innerHTML = String(text || "");
  return (div.textContent || div.innerText || "")
    .replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "")
    .replace(/[*#`_>~|·•●◦▪▫]/g, "")
    .replace(/^[-–—]\s+|\s[-–—]\s/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLearnerExplanation(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*{1,3}|_{1,3}|`/g, "")
    .replace(/^\s*(?:教学方式|教学方法|讲解方式|核心要点|关键要点|常见错误|常见误区|下次练习|类似题建议|approach|key idea|common mistake|next practice)\s*[:：]?\s*/gim, "")
    .replace(/^\s*(?:\d+\s*[.)、]|[-•])\s*/gm, "")
    .replace(/\b(?:FEN|JSON|PGN)\s*[:：][^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function learnerExplanationHtml(text) {
  return cleanLearnerExplanation(text)
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${esc(paragraph.replace(/\n/g, " "))}</p>`)
    .join("");
}

// 把长文本按句子切成小段，避免单次 TTS 合成超过超时时间（长文本会超时回退系统音）。
function splitSpeech(text, maxLen = 150) {
  const sentences = text.match(/[^。！？；!?;.]+[。！？；!?;.]?/g) || [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > maxLen) { chunks.push(cur); cur = s; }
    else cur += s;
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

function speakText(text) {
  const content = cleanSpeechText(text);
  if (!content) { toast(t("noSpeechContent")); return; }
  stopSpeech();
  playUiSound("speak");
  saveVoiceSettings();
  const settings = JSON.parse(localStorage.getItem("ct_voice_settings") || "{}");
  // 中文用声音设计的动物角色，英文用现成多语角色，其他语言用浏览器对应语言音色。
  const lang = getLang();
  const session = speakSession;
  if (lang === "zh" || lang === "en") {
    speakViaTtsChunked(content, settings.preset || "story", lang, session)
      .catch((err) => {
        if (session !== speakSession) return;
        if (err && err.message === "stopped") return;
        if (err && err.authExpired) return;
        // Keep the lesson audible even when DashScope is unavailable, times
        // out, or returns an audio URL the browser cannot reach. The browser
        // voice uses the selected language and the user's speed/pitch settings.
        // Do not surface provider details in the lesson UI.
        if (speakViaBrowser(content, settings)) toast(t("voiceCloudFallback"));
      });
  } else {
    speakViaBrowser(content, settings);
  }
}

// 逐段合成并顺序播放；段与段之间、以及合成等待期间检查是否已被 stop。
async function speakViaTtsChunked(content, preset, language, session) {
  const chunks = splitSpeech(content);
  for (const chunk of chunks) {
    if (session !== speakSession) throw new Error("stopped");
    await speakViaTts(chunk, preset, language, session);
  }
}

function speakViaTts(content, preset, language, session) {
  return API.req("/tts", "POST", { text: content, preset: preset, language: language })
    .then(async (data) => {
      // A cancelled or superseded synthesis must never start playing late.
      if (session !== speakSession) throw new Error("stopped");
      if (!data || !data.url) { throw new Error("no tts url"); }
      const audio = new Audio(data.url);
      currentTtsAudio = audio;
      // 等这段音频播完（或被 stop 暂停）再进入下一段。
      await new Promise((resolve, reject) => {
        const clear = () => { if (currentTtsAudio === audio) currentTtsAudio = null; };
        audio.onended = () => { clear(); resolve(); };
        audio.onerror = () => { clear(); reject(new Error("tts play failed")); };
        audio.onpause = () => { clear(); reject(new Error("stopped")); };
        audio.play().catch(() => { clear(); reject(new Error("tts play failed")); });
      });
    });
}

function speakViaBrowser(content, settings) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    toast(t("speechNotSupported"));
    return false;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = ({ zh: "zh-CN", en: "en-US", ja: "ja-JP", fr: "fr-FR", es: "es-ES" })[getLang()] || "zh-CN";
  utterance.rate = Number(settings.rate || 1);
  utterance.pitch = Number(settings.pitch || 1);
  const preferred = settings.voice;
  const locale = utterance.lang.slice(0, 2);
  speechVoices = speechSynthesis.getVoices();
  const localizedVoices = speechVoices.filter(v => v.lang.toLowerCase().startsWith(locale));
  const voice = localizedVoices.find(v => v.name === preferred) || localizedVoices[0] || null;
  if (!voice) { toast(t("voiceLocalUnavailable")); return false; }
  utterance.voice = voice;
  speechSynthesis.speak(utterance);
  return true;
}

function stopSpeech() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (currentTtsAudio) { currentTtsAudio.pause(); currentTtsAudio = null; }
  speakSession++; // 使进行中的分段朗读停止
}

function speakButton(text) {
  const encoded = encodeURIComponent(text || "").replace(/'/g, "%27");
  return ` <button class="btn btn-ghost speak-btn" onclick="speakText(decodeURIComponent('${encoded}'))">🔊 ${t("speak")}</button><button class="btn btn-ghost speak-btn" onclick="stopSpeech()">${t("stop")}</button>`;
}

function testVoice() {
  playUiSound("correct");
  speakText(t("sampleVoice"));
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(ctx, freq, start, duration, opts = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(opts.volume || 0.16, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playUiSound(kind) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    if (kind === "correct") {
      tone(ctx, 523, now, 0.1, { type: "sine", volume: 0.055 });
      tone(ctx, 659, now + 0.09, 0.12, { type: "sine", volume: 0.06 });
      tone(ctx, 784, now + 0.18, 0.16, { type: "triangle", volume: 0.055 });
    } else if (kind === "wrong") {
      tone(ctx, 330, now, 0.1, { type: "sine", to: 294, volume: 0.045 });
      tone(ctx, 247, now + 0.1, 0.12, { type: "sine", volume: 0.04 });
    } else if (kind === "level") {
      [523, 659, 784, 988].forEach((f, i) => tone(ctx, f, now + i * 0.09, 0.14, { type: "sine", volume: 0.065 }));
    } else if (kind === "speak") {
      tone(ctx, 440, now, 0.08, { type: "sine", volume: 0.04 });
    }
  } catch (_) {}
}

document.addEventListener("click", e => {
  const card = e.target.closest(".dash-card");
  if (!card) return;
  const view = card.dataset.view;
  if (view === "arena") { joinArena(); return; }
  if (view === "bind") { generateBindCode(); return; }
  if (view) navTo(view);
});

// ── Learning ──
function initLearn() {
  const secs = [
    { key:"principles", icon:"🏰", title:t("learnPrinciples"), desc:t("learnPrinciples") },
    { key:"openings", icon:"📖", title:t("learnOpenings"), desc:t("learnOpenings") },
    { key:"middlegame", icon:"⚡", title:t("learnMiddle"), desc:t("learnMiddle") },
    { key:"endgame", icon:"🏁", title:t("learnEnd"), desc:t("learnEnd") },
    { key:"traps", icon:"🎯", title:t("learnTraps"), desc:t("learnTraps") },
  ];
  document.getElementById("learnSections").innerHTML = secs.map(s => `
    <div class="dash-card" onclick="showLearnSection('${s.key}')"><div class="icon">${s.icon}</div><h3>${s.title}</h3><p>${s.desc}</p></div>`).join("");
  document.getElementById("learnDetail").style.display = "none";
  document.getElementById("learnSections").style.display = "";
}

function showLearnSection(key) {
  currentSection = key;
  document.getElementById("learnSections").style.display = "none";
  document.getElementById("learnDetail").style.display = "";
  const topics = learningTopics().filter(t => t.category === key);
  document.getElementById("learnTopicList").innerHTML = topics.map((t,i) => `<div class="list-item" style="cursor:pointer;" onclick="showTopic('${key}',${i})">${t.title}</div>`).join("");
  if (topics.length) showTopic(key, 0);
}

function showTopic(key, idx) {
  const t = learningTopics().filter(x => x.category === key)[idx];
  document.getElementById("learnContent").innerHTML = t.content;
  const bd = document.getElementById("learnBoard");
  if (t.keyFen) { bd.style.display = ""; renderBoard(bd, t.keyFen, "", ()=>{}); }
  else bd.style.display = "none";
  document.getElementById("learnTips").innerHTML = (t.tips||[]).map(tip => `<span class="tag">💡 ${esc(tip)}</span>`).join("");
}

function backToLearn() {
  document.getElementById("learnDetail").style.display = "none";
  document.getElementById("learnSections").style.display = "";
}

// ── Practice ──
async function loadProblems() {
  try { const d = await API.req("/problems/list"); problems = (d.items||[]).map(localizeProblemForDisplay); currentProblem=problems[0]||null; practiceBoardFen=currentProblem?.fen||""; practiceSolved=false; practiceSubmitting=false; practiceAttempt++; document.getElementById("problemMeta").textContent=t("puzzleCount", { count: problems.length }); renderProbList(); renderProblem(); } catch(e) { toast(e.message); }
}
function practiceUi(key, vars = {}) {
  const copy = {
    zh: { correct:"✅ 答对了！", wrong:"❌ 不对，再试试！", points:"+{points}分", explain:"🤖 AI讲解", loading:"⌛ AI讲解生成中...", failed:"❌ 讲解生成失败：{message}", explanation:"🤖 AI讲解：", fallback:"思路分步：先找关键子力和威胁。\n关键点：留意将军、吃子和对方王的逃跑格。\n常见误区：只看自己的走法，忘记检查对方的应对。\n类似题建议：再练习几道同主题的题目。" },
    en: { correct:"✅ Correct!", wrong:"❌ Not quite. Try again!", points:"+{points} pts", explain:"🤖 AI explanation", loading:"⌛ Generating AI explanation...", failed:"❌ Failed to generate explanation: {message}", explanation:"🤖 AI explanation:", fallback:"Approach: identify the important pieces and threats first.\nKey idea: look for checks, captures, and the opponent king's escape squares.\nCommon mistake: do not consider only your move; check the opponent's reply.\nNext practice: solve several more puzzles with this theme." },
    ja: { correct:"✅ 正解です！", wrong:"❌ もう一度試してみましょう！", points:"+{points}点", explain:"🤖 AI解説", loading:"⌛ AI解説を作成中...", failed:"❌ 解説の作成に失敗しました：{message}", explanation:"🤖 AI解説：", fallback:"考え方：まず重要な駒と脅威を見つけましょう。\nポイント：チェック、駒取り、相手の王の逃げ道を確認します。\nよくあるミス：自分の手だけでなく、相手の応手も確認しましょう。\n次の練習：同じテーマの問題をさらに解いてみましょう。" },
    fr: { correct:"✅ Correct !", wrong:"❌ Pas encore. Réessayez !", points:"+{points} pts", explain:"🤖 Explication IA", loading:"⌛ Génération de l'explication IA...", failed:"❌ Échec de génération : {message}", explanation:"🤖 Explication IA :", fallback:"Méthode : repérez d'abord les pièces et menaces importantes.\nIdée clé : cherchez les échecs, prises et cases de fuite du roi adverse.\nErreur fréquente : vérifiez aussi la réponse adverse.\nEntraînement : faites plusieurs exercices du même thème." },
    es: { correct:"✅ ¡Correcto!", wrong:"❌ Aún no. ¡Inténtalo de nuevo!", points:"+{points} pts", explain:"🤖 Explicación IA", loading:"⌛ Generando explicación de IA...", failed:"❌ No se pudo generar la explicación: {message}", explanation:"🤖 Explicación IA:", fallback:"Método: identifica primero las piezas y amenazas importantes.\nIdea clave: busca jaques, capturas y casillas de escape del rey rival.\nError común: comprueba también la respuesta del rival.\nPráctica: resuelve varios ejercicios más del mismo tema." }
  };
  let value = (copy[getLang()] || copy.en)[key] || copy.en[key] || key;
  Object.entries(vars).forEach(([name, valueToInsert]) => { value = value.replaceAll(`{${name}}`, String(valueToInsert)); });
  return value;
}
function localizeProblemForDisplay(problem) {
  if (getLang() === "zh") return problem;
  const copy = {
    en: { question:"Find the best move in this position.", hint:"Look for checks, captures, and threats.", points:{"后排将杀":"Back-rank mate","皇后后排将杀":"Queen back-rank mate","升变":"Promotion","骑士双攻":"Knight fork"} },
    ja: { question:"この局面で最善手を見つけましょう。", hint:"チェック、駒取り、脅威を探しましょう。", points:{"后排将杀":"バックランクメイト","皇后后排将杀":"クイーンによるバックランクメイト","升变":"昇格","骑士双攻":"ナイトフォーク"} },
    fr: { question:"Trouvez le meilleur coup dans cette position.", hint:"Cherchez les échecs, les prises et les menaces.", points:{"后排将杀":"Mat de la dernière rangée","皇后后排将杀":"Mat de la dernière rangée avec la dame","升变":"Promotion","骑士双攻":"Fourchette de cavalier"} },
    es: { question:"Encuentra la mejor jugada en esta posición.", hint:"Busca jaques, capturas y amenazas.", points:{"后排将杀":"Mate de la última fila","皇后后排将杀":"Mate de la última fila con dama","升变":"Promoción","骑士双攻":"Doble ataque de caballo"} }
  }[getLang()];
  return { ...problem, question: copy.question, knowledgePoint: copy.points[problem.knowledgePoint] || copy.question, hints: (problem.hints || []).map(() => copy.hint) };
}
function explanationMatchesCurrentLanguage(text) {
  if (getLang() === "zh") return true;
  if (getLang() === "ja") return /[\u3040-\u30ff]/.test(text);
  return !/[\u3400-\u9fff]/.test(text);
}
function renderProbList() {
  document.getElementById("problemList").innerHTML = problems.map((p,i) => `<div class="list-item" style="cursor:pointer;${currentProblem&&currentProblem.id===p.id?'background:rgba(255,255,255,.1);':''}" onclick="selectProblem(${i})">${String(i+1).padStart(2,"0")}·${p.knowledgePoint}·★${p.difficulty}</div>`).join("");
}
function resetPracticePosition(problem = currentProblem) {
  practiceAttempt++;
  practiceBoardFen=problem?.fen||"";
  practiceSelected="";
  practiceSolved=false;
  practiceSubmitting=false;
}
function selectProblem(i) { currentProblem=problems[i]; hintIdx=0; resetPracticePosition(); document.getElementById("practiceResult").innerHTML=""; renderProblem(); renderProbList(); }
function previewPracticeMove(fen, moveStr) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(moveStr||"")) return fen;
  const rows=parseFen(fen), from=moveStr.slice(0,2).toLowerCase(), to=moveStr.slice(2,4).toLowerCase();
  const sourceRow=8-Number(from[1]), sourceCol="abcdefgh".indexOf(from[0]);
  const targetRow=8-Number(to[1]), targetCol="abcdefgh".indexOf(to[0]);
  const piece=rows[sourceRow]?.[sourceCol];
  if (!piece || targetRow<0 || targetRow>7 || targetCol<0 || targetCol>7) return fen;
  const fields=(fen||"").split(/\s+/), turn=fields[1]||"w", rights=fields[2]||"-", ep=fields[3]||"-";
  let captured=rows[targetRow][targetCol];
  rows[sourceRow][sourceCol]="";
  // En-passant capture removes the pawn beside the destination square.
  if ((piece==="P"||piece==="p") && from[0]!==to[0] && !captured && ep===to) {
    const epRow=targetRow+(piece==="P"?1:-1);
    captured=rows[epRow]?.[targetCol]||"";
    if (rows[epRow]) rows[epRow][targetCol]="";
  }
  let moved=piece;
  const promotion=moveStr[4]?.toLowerCase();
  if (promotion && (piece==="P"||piece==="p")) moved=piece==="P"?promotion.toUpperCase():promotion;
  rows[targetRow][targetCol]=moved;
  // Move the rook in a castling preview as well.
  if ((piece==="K"||piece==="k") && Math.abs(targetCol-sourceCol)===2) {
    const rookFrom=targetCol>sourceCol?7:0, rookTo=targetCol>sourceCol?5:3;
    rows[sourceRow][rookTo]=rows[sourceRow][rookFrom];
    rows[sourceRow][rookFrom]="";
  }
  const rightsSet=new Set(rights==="-"?[]:rights.split(""));
  const removeRookRight=(square)=>({h1:"K",a1:"Q",h8:"k",a8:"q"}[square]||"");
  if (piece==="K") { rightsSet.delete("K"); rightsSet.delete("Q"); }
  if (piece==="k") { rightsSet.delete("k"); rightsSet.delete("q"); }
  if (piece==="R"||piece==="r") rightsSet.delete(removeRookRight(from));
  if (captured==="R"||captured==="r") rightsSet.delete(removeRookRight(to));
  const nextRights=[..."KQkq"].filter(value=>rightsSet.has(value)).join("")||"-";
  const nextEp=(piece==="P"&&Number(from[1])===2&&Number(to[1])===4)||(piece==="p"&&Number(from[1])===7&&Number(to[1])===5)
    ? from[0]+String((Number(from[1])+Number(to[1]))/2) : "-";
  let empty=piece.toLowerCase()==="p"||captured?0:(Number(fields[4])||0)+1;
  let full=Number(fields[5])||1;
  if (turn==="b") full++;
  const placement=rows.map(row=>{let out="",blank=0;for(const square of row){if(square) {if(blank)out+=blank;blank=0;out+=square;} else blank++;}if(blank)out+=blank;return out;}).join("/");
  return `${placement} ${turn==="w"?"b":"w"} ${nextRights} ${nextEp} ${empty} ${full}`;
}
function renderProblem() {
  if(!currentProblem) return;
  document.getElementById("problemMeta").innerHTML = `<b>${esc(currentProblem.question)}</b><br><small>FEN: ${esc(currentProblem.fen)}</small>`;
  renderBoard(document.getElementById("practiceBoard"), practiceBoardFen||currentProblem.fen, practiceSelected, async (sq, piece) => {
    if (practiceSolved || practiceSubmitting) return;
    const movingSide=currentProblem.fen.split(/\s+/)[1]||"w";
    const movable=piece && (piece===piece.toUpperCase())===(movingSide==="w");
    if (practiceSelected && practiceSelected !== sq) {
      if (movable) { practiceSelected=sq; renderProblem(); return; }
      // Attempting a move: from practiceSelected to sq
      const problem = currentProblem;
      const moveStr = await chooseBoardMove(problem.fen, practiceSelected, sq);
      if (moveStr && currentProblem === problem) submitPracticeMove(moveStr);
      practiceSelected = "";
    } else if (movable) {
      practiceSelected = sq;
    } else {
      practiceSelected = "";
    }
    renderProblem();
  });
}
function showHint() { if(currentProblem&&currentProblem.hints) toast("💡 "+currentProblem.hints[hintIdx++ % currentProblem.hints.length]); }
function nextProblem() { if(problems.length){ const i=problems.indexOf(currentProblem); currentProblem=problems[(i+1)%problems.length]; hintIdx=0; resetPracticePosition(); document.getElementById("practiceResult").innerHTML=""; renderProblem(); renderProbList(); } }

async function submitPracticeMove(moveStr) {
  if(!currentProblem||practiceSolved||practiceSubmitting) return;
  const problem=currentProblem, attempt=++practiceAttempt;
  practiceSubmitting=true;
  practiceSelected="";
  practiceBoardFen=previewPracticeMove(problem.fen,moveStr);
  renderProblem();
  lastPracticeAnswer = moveStr;
  try {
    const d = await API.req("/problems/submit","POST",{problemId:problem.id,answer:moveStr});
    if (attempt!==practiceAttempt||currentProblem!==problem) return;
    practiceSolved=Boolean(d.isCorrect);
    if (!practiceSolved) practiceBoardFen=problem.fen;
    practiceSubmitting=false;
    var hdr = d.isCorrect ? practiceUi("correct")+(d.awardedPoints>0?" "+practiceUi("points", { points:d.awardedPoints }):"") : practiceUi("wrong");
    document.getElementById("practiceResult").innerHTML = '<span data-answer-header>'+hdr+'</span> <button data-explain-button class="btn btn-ghost" onclick="explainAnswer()" style="font-size:11px;padding:2px 8px;">'+practiceUi("explain")+'</button>';
    renderProblem();
    playUiSound(d.isCorrect ? "correct" : "wrong");
    if(!window.ctTrialMode && d.awardedPoints>0){
      const oldRank = getRank(API.user.points || 0);
      API.user.points+=d.awardedPoints;
      const newRank = getRank(API.user.points || 0);
      updateRankDisplay();
      if (newRank.level > oldRank.level) {
        playUiSound("level");
        toast("🎉 升级到 " + newRank.title + "！");
      }
    }
  } catch(e) { if(attempt===practiceAttempt&&currentProblem===problem){practiceBoardFen=problem.fen;practiceSubmitting=false;practiceSolved=false;renderProblem();toast(e.message);} }
}

async function submitPractice() {
  var a = document.getElementById("practiceAnswer").value.trim();
  if(!a){ toast("输入走法或点击棋盘走棋"); return; }
  submitPracticeMove(a);
  document.getElementById("practiceAnswer").value="";
}

async function explainAnswer() {
  if(!currentProblem){ toast("没有题目"); return; }
  if(explainInProgress)return;
  explainInProgress=true;
  const problem=currentProblem;
  const button=document.querySelector('#practiceResult [data-explain-button]');
  if(button){button.disabled=true;button.setAttribute("aria-busy","true");}
  const resultEl=document.getElementById("practiceResult");
  let feedback=document.getElementById("explanationFeedback");
  if(!feedback){feedback=document.createElement("div");feedback.id="explanationFeedback";feedback.className="explanation-feedback";feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");resultEl.appendChild(feedback);}
  feedback.innerHTML=`<span class="loading-spinner" aria-hidden="true"></span><span>${practiceUi("loading")}</span>`;
  try {
    const e = await API.req("/problems/explain","POST",{problemId:problem.id,answer:lastPracticeAnswer||problem.solution,isCorrect:true,language:getLang()});
    if(currentProblem!==problem)return;
    const rawText = explanationMatchesCurrentLanguage(e.explanation || "") ? (e.explanation || "") : practiceUi("fallback");
    const text = cleanLearnerExplanation(rawText);
    feedback.className="explanation-feedback explanation-success";
    feedback.innerHTML=`<b>${practiceUi("explanation")}</b>${speakButton(text)}${learnerExplanationHtml(text)}`;
  } catch(ex){
    if(currentProblem!==problem)return;
    feedback.className="explanation-feedback explanation-error";
    feedback.textContent=practiceUi("failed", { message:ex.message });
  } finally {
    explainInProgress=false;
    if(button){button.disabled=false;button.removeAttribute("aria-busy");}
  }
}

// ── AI Battle ──
var battleFrom = "", battleVariant = "standard", variants = [];
function initBattleDifficulty() {
  var sel = document.getElementById("battleDiff");
  var mode = document.getElementById("battleMode");
  if (!sel) return;
  const previousTier = sel.value || "2";
  sel.innerHTML = BATTLE_LEVELS.map(function(level) {
    return '<option value="' + level.tier + '">' + battleLevelLabel(level) + '</option>';
  }).join("");
  sel.value = previousTier;
  sel.onchange = updateBattleDifficultyHint;
  if (mode) mode.onchange = updateBattleDifficultyHint;
  updateBattleDifficultyHint();
}
function battleLevelLabel(level) { return t("battleTier", { tier: level.tier }); }
function getBattleDifficultyLevel() {
  var sel = document.getElementById("battleDiff");
  var tier = Number(sel ? sel.value : 2);
  return BATTLE_LEVELS.find(function(level) { return level.tier === tier; }) || BATTLE_LEVELS[1];
}
function getBattleDifficultyValue() {
  return getBattleDifficultyLevel().difficulty;
}
function updateBattleDifficultyHint() {
  var level = getBattleDifficultyLevel();
  var mode = document.getElementById("battleMode");
  var modeLabel = mode && mode.value === "teaching" ? t("modeTeachingActive") : t("modeStandardActive");
  document.getElementById("battleDifficultyHint").innerHTML = "<b>" + esc(battleLevelLabel(level)) + "</b>：" + esc(t("battleTierHint")) + "<br><small>" + esc(modeLabel) + "</small>";
}
async function loadVariants() {
  try { var d = await API.req("/match/variants"); variants = d.items||[]; var sel=document.getElementById("battleVariant"); if(!sel)return; sel.innerHTML=variants.map(function(v){ return '<option value="'+v.key+'">'+esc(battleVariantLabel(v.key, v.title))+'</option>'; }).join(""); sel.value=battleVariant; updateVariantDesc(); } catch(e) {}
}
function updateVariantDesc() {
  var sel=document.getElementById("battleVariant"); if(!sel)return;
  battleVariant=sel.value; var v=variants.find(function(x){return x.key===battleVariant;});
  document.getElementById("variantDesc").innerHTML=v?"<b>"+esc(battleVariantLabel(v.key, v.title))+"</b>："+esc(battleVariantDescription(v.key, v.desc)):"";
}
function battleVariantLabel(key, fallback) {
  const names = { standard:["Standard battle","標準対局","Partie standard","Partida estándar"], pawns:["Pawn battle","ポーン対局","Bataille de pions","Batalla de peones"], knights:["Knight battle","ナイト対局","Bataille de cavaliers","Batalla de caballos"], bishops:["Bishop battle","ビショップ対局","Bataille de fous","Batalla de alfiles"], rooks:["Rook battle","ルーク対局","Bataille de tours","Batalla de torres"], queen:["Queen battle","クイーン対局","Bataille de dames","Batalla de damas"], full:["Full battle","総合対局","Partie complète","Partida completa"] };
  if (getLang() === "zh") return fallback;
  const idx = { en:0, ja:1, fr:2, es:3 }[getLang()] ?? 0;
  return names[key]?.[idx] || names.standard[idx];
}
function battleVariantDescription(key, fallback) {
  const descriptions = { standard:["A complete board with all standard pieces.","すべての駒を使う通常のチェス対局です。","Un échiquier complet avec toutes les pièces standard.","Un tablero completo con todas las piezas estándar."], pawns:["Play with kings and pawns only.","キングとポーンだけで対局します。","Jouez uniquement avec les rois et les pions.","Juega solo con reyes y peones."], knights:["Practice knight jumps and forks.","ナイトの跳躍とフォークを練習します。","Entraînez les sauts et fourchettes de cavalier.","Practica saltos y ataques dobles de caballo."], bishops:["Practice bishop diagonal attacks.","ビショップの斜めの攻撃を練習します。","Entraînez les attaques diagonales des fous.","Practica ataques diagonales de alfil."], rooks:["Practice rook control on ranks and files.","ルークの縦横の支配を練習します。","Entraînez le contrôle des lignes avec les tours.","Practica el control de filas y columnas con torres."], queen:["Practice queen coordination.","クイーンとの連携を練習します。","Entraînez la coordination de la dame.","Practica la coordinación de la dama."], full:["A complete game to test all your skills.","総合力を試す通常の対局です。","Une partie complète pour tester votre niveau.","Una partida completa para probar tu nivel."] };
  if (getLang() === "zh") return fallback;
  const idx = { en:0, ja:1, fr:2, es:3 }[getLang()] ?? 0;
  return descriptions[key]?.[idx] || descriptions.standard[idx];
}
async function startMatch() {
  closeGameResult();
  try {
    var level = getBattleDifficultyLevel();
    var payload = { mode: document.getElementById("battleMode").value, difficulty: level.difficulty };
    if (battleVariant && battleVariant !== "standard") payload.variant = battleVariant;
    var d = await API.req("/match/start", "POST", payload);
    battleOver = false;
    matchId = d.matchId;
    battleFen = d.matchState || d.fen;
    moves = [];
    lastBattleEngineMove = null;
    battleSelected = "";
    battleFrom = "";
    document.getElementById("battleStatus").innerHTML = esc(t("battleStarted", { level: battleLevelLabel(level) })).replace(esc(battleLevelLabel(level)), "<b>" + esc(battleLevelLabel(level)) + "</b>");
    document.getElementById("moveHistory").textContent = t("moveHistoryEmpty");
    document.getElementById("analysisResult").textContent = t("battleGuide");
    renderBattle();
  } catch(e){ toast(e.message); }
}
function renderBattle() {
  renderBoard(document.getElementById("battleBoard"), battleFen, battleFrom||battleSelected, async function(sq, piece) {
    if(battleOver) return;
    if (battleFrom) {
      // Destination selected: construct and submit move
      const fen = battleFen, id = matchId, from = battleFrom;
      battleSelected = ""; battleFrom = "";
      const moveStr = await chooseBoardMove(fen, from, sq);
      if (moveStr && battleFen === fen && matchId === id && !battleOver) submitBattleMoveStr(moveStr);
    } else if (piece && piece === piece.toUpperCase()) {
      // Select a white piece (player is always white)
      battleFrom = sq;
      battleSelected = sq;
    } else {
      battleFrom = ""; battleSelected = "";
    }
    renderBattle();
  });
}
async function submitBattleMoveStr(moveStr) {
  try {
    var level = getBattleDifficultyLevel();
    var payload = {matchId, fen:battleFen, move:moveStr, difficulty: level.difficulty, previousEngineMove: lastBattleEngineMove};
    if(battleVariant&&battleVariant!=="standard") payload.variant=battleVariant;
    if (moves.length > 0) {
      var pgn = ""; for (var i=0; i<moves.length; i+=2) { pgn += (Math.floor(i/2)+1)+". "+moves[i]; if (moves[i+1]) pgn += " "+moves[i+1]; pgn += " "; }
      payload.pgn = pgn.trim();
    }
    var d = await API.req("/match/move","POST",payload);
    if (!d.playerMoveAccepted) { toast(t("invalidMove")); renderBattle(); return; }
    battleOver = Boolean(d.gameOver);
    battleFen = d.fenAfter || battleFen;
    moves.push(d.playerMove || moveStr); if (d.engineMove) moves.push(d.engineMove);
    lastBattleEngineMove = d.engineMove || null;
    document.getElementById("battleMoveInput").value = "";
    document.getElementById("battleStatus").innerHTML = esc(t("battleMoveStatus", { player: d.playerMove || moveStr, engine: d.engineMove || t("noMove") })).replace("\n", "<br>") + (d.gameOver ? "<br><b>" + esc(t("battleFinished")) + "</b>" : "<br>" + esc(t("battleContinue")));
    document.getElementById("moveHistory").innerHTML = moves.length ? moves.map(function(move, index) {
      var prefix = index % 2 === 0 ? (Math.floor(index / 2) + 1) + ". " : "";
      return prefix + move;
    }).join("  ") : t("moveHistoryEmpty");
    if (d.gameOver && !window.ctTrialMode) {
      const oldRank = getRank(API.user.points || 0);
      API.user.points = Number.isFinite(d.points) ? d.points : API.user.points;
      const newRank = getRank(API.user.points || 0);
      updateRankDisplay();
      playUiSound(newRank.level > oldRank.level ? "level" : "correct");
      if (newRank.level > oldRank.level) toast("🎉 升级到 " + newRank.title + "！");
    }
    renderBattle();
    if(d.gameOver) showGameResult(d.gameResult==="draw"?"drawn":d.gameResult==="win"?"victory":"defeat", (d.playerMove?.includes("#") || d.engineMove?.includes("#")) ? "checkmate" : "");
  } catch(e) { toast(e.message); renderBattle(); }
}
async function submitBattleMove() {
  var m = document.getElementById("battleMoveInput").value.trim();
  if (!m) { toast(t("inputMove")); return; }
  submitBattleMoveStr(m);
}
async function suggestMove() {
  try {
    const level = getBattleDifficultyLevel();
    const d = await API.req("/match/suggest","POST",{fen:battleFen,difficulty:level.difficulty});
    const reason = cleanLearnerExplanation(d.reason || t("generalSuggestion"));
    const text = `${t("aiSuggestion")} ${d.move||t("noMove")}. ${reason}`;
    document.getElementById("analysisResult").innerHTML =
      `${t("aiSuggestion")}：<b>${esc(d.move||t("noMove"))}</b>${speakButton(text)}<br>` +
      `${t("trainingTier")}：${esc(battleLevelLabel(level))}<br>` +
      `${t("engineSource")}：${esc(d.source||"fallback")}<br>` +
      `${learnerExplanationHtml(reason)}`;
  } catch(e){ toast(e.message); }
}
async function analyzeGame() {
  try {
    const d = await API.req("/match/analyze","POST",{pgn:moves.join(" ")||""});
    const key = (d.keyMoves||[]).map(m=>t("moveNumber", { number: m.ply, move: m.san })).join(", ") || t("noKeyMoves");
    const summary = cleanLearnerExplanation(d.summary || t("noGameData"));
    const text = `${t("reviewTitle")}: ${summary}. ${t("keyMoves")}: ${key}`;
    document.getElementById("analysisResult").innerHTML =
      `${t("reviewTitle")}：${learnerExplanationHtml(summary)}${speakButton(text)}<br>` +
      `${t("keyMoves")}：${esc(key)}`;
  } catch(e){ toast(e.message); }
}

// ── PvP ──
function connectWs() {
  if (window.ctTrialMode || !API.user || !API.token) return;
  if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING)) return;
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  const socket = new WebSocket((location.protocol==="https:"?"wss:":"ws:")+"//"+location.host+"/ws?token="+encodeURIComponent(API.token));
  ws = socket;
  let heartbeatTimer = null;
  socket.onopen=()=>{
    heartbeatTimer=setInterval(()=>{
      if(ws===socket && socket.readyState===WebSocket.OPEN) socket.send(JSON.stringify({type:"ping"}));
    },25000);
  };
  socket.onmessage=e=>{
    if(ws!==socket) return;
    const m=JSON.parse(e.data);
    if(m.type==="auth_ok") {
      wsErrorNotified=false;
      if(pvpRoomId) sendWsWhenOpen({type:"join_room",payload:{roomId:pvpRoomId}});
    }
    if(m.type==="game_state") handlePvpState(m.payload);
    if(m.type==="clock_tick") updateClocks(m.payload);
    if(m.type==="game_over" && pvpRoomId && (!m.payload.roomId || m.payload.roomId===pvpRoomId)){
      if (latestPvpState) handlePvpState({...latestPvpState, fen:m.payload.fen || latestPvpState.fen, status:"finished", result:m.payload.result, resultReason:m.payload.reason});
      const result = m.payload.result === "draw" ? "drawn" : m.payload.result === pvpMyColor ? "victory" : "defeat";
      document.getElementById("pvpStatus").textContent = resultText(result, m.payload.reason);
      showGameResult(result, m.payload.reason);
    }
    if(m.type==="chat_receive") handleChatMsg(m.payload);
    if(m.type==="error") toast(localizedServerMessage(m.payload.message));
  };
  socket.onerror=()=>{
    // A failed attempt can emit both error and close, and an older socket may
    // finish after a newer reconnect has already started. Only the current
    // socket reports the state, once per outage, to keep the board usable.
    if (ws===socket && currentView==="pvp" && !wsErrorNotified) {
      wsErrorNotified=true;
      toast(t("connectionLost"));
    }
  };
  socket.onclose=()=>{
    if(heartbeatTimer) clearInterval(heartbeatTimer);
    if (ws!==socket) return;
    ws=null;
    if (!wsReconnectTimer) wsReconnectTimer=setTimeout(()=>{ wsReconnectTimer=null; connectWs(); },3000);
  };
}
function sendWsWhenOpen(message){
  if(!ws) return false;
  if(ws.readyState===WebSocket.OPEN){ ws.send(JSON.stringify(message)); return true; }
  if(ws.readyState===WebSocket.CONNECTING){
    const socket=ws;
    socket.addEventListener("open",()=>{ if(ws===socket) socket.send(JSON.stringify(message)); },{once:true});
    return true;
  }
  return false;
}
let latestPvpState = null;
function handlePvpState(p){
  if (p.roomId !== pvpRoomId) return;
  if (latestPvpState && (p.fen !== latestPvpState.fen || p.status !== "playing")) cancelPromotion();
  latestPvpState = p;
  pvpRoomId=p.roomId; sessionStorage.setItem("ct.pvpRoomId", p.roomId); sessionStorage.setItem("ct.pvpRoomNumber", p.roomNumber || ""); pvpFen=p.fen; pvpMyColor=(p.white&&p.white.userId===API.user.id)?"white":"black";
  document.getElementById("pvpSetup").style.display="none"; document.getElementById("pvpGameArea").style.display="";
  document.getElementById("pvpRoomInfo").textContent=t("roomNumber",{number:p.roomNumber});
  document.getElementById("pvpGameInfo").textContent=t("roomInfo",{number:p.roomNumber,time:pvpTimeLabel(p.timeControl)});
  document.getElementById("pvpStatus").textContent=p.status==="finished"?(p.result?resultText(p.result==="draw"?"drawn":p.result===pvpMyColor?"victory":"defeat",p.resultReason):t("gameFinished")):p.status==="waiting"?t("waitingOpponent"):"";
  renderDrawOffer(p);
  var myTurn = (pvpMyColor==="white"&&p.turn==="w")||(pvpMyColor==="black"&&p.turn==="b");
  pvpSelected = "";
  async function onPvpSquare(sq,piece){
    if(p.status!=="playing"){ toast(p.status==="waiting"?t("waitingOpponent"):t("gameFinished")); return; }
    if(!myTurn){ toast(t("notYourTurn")); return; }
    var isMyPiece = (pvpMyColor==="white"&&piece===piece.toUpperCase()&&piece) || (pvpMyColor==="black"&&piece===piece.toLowerCase()&&piece);
    if (isMyPiece) {
      pvpSelected = pvpSelected === sq ? "" : sq;
    } else if (pvpSelected) {
      // Already selected a piece, now clicking destination
      const fen = pvpFen, roomId = pvpRoomId, from = pvpSelected;
      pvpSelected = "";
      const moveStr = await chooseBoardMove(fen, from, sq);
      if (!moveStr || pvpRoomId !== roomId || pvpFen !== fen || latestPvpState?.status !== "playing") return;
      if (!ws || ws.readyState!==WebSocket.OPEN) {
        toast(t("reconnecting")); connectWs(); return;
      }
      ws.send(JSON.stringify({type:"move",payload:{roomId:pvpRoomId,move:moveStr}}));
      pvpSelected = "";
    }
    renderBoard(document.getElementById("pvpBoard"), pvpFen, pvpSelected, onPvpSquare, pvpMyColor);
  }
  renderBoard(document.getElementById("pvpBoard"), pvpFen, pvpSelected, onPvpSquare, pvpMyColor);
  updateClocks(p);
}
function updateClocks(p){ document.getElementById("whiteClock").textContent=fmtTime(p.whiteTimeMs ?? p.white?.timeRemainingMs ?? 0); document.getElementById("blackClock").textContent=fmtTime(p.blackTimeMs ?? p.black?.timeRemainingMs ?? 0); }
let pvpLeaving = false;
async function exitPvpRoom(){
  if (pvpLeaving) return false;
  pvpLeaving = true;
  try {
    if (pvpRoomId) {
      const room = await API.req("/room/" + pvpRoomId);
      const resign = room.status === "playing";
      if (resign && !confirm(t("confirmExit"))) return false;
      await API.req("/room/" + pvpRoomId + "/leave", "POST", { resign });
    }
    latestPvpState = null; closeGameResult(); cancelPromotion();
    pvpRoomId = ""; pvpSelected = ""; pvpMyColor = "";
    sessionStorage.removeItem("ct.pvpRoomId");
    sessionStorage.removeItem("ct.pvpRoomNumber");
    document.getElementById("pvpGameArea").style.display = "none";
    document.getElementById("pvpSetup").style.display = "";
    document.getElementById("pvpRoomInfo").textContent = "";
    document.getElementById("pvpGameInfo").textContent = "";
    document.getElementById("pvpStatus").textContent = "";
    document.getElementById("pvpBoard").innerHTML = "";
    document.getElementById("joinRoomCode").value = "";
    await refreshRooms();
    return true;
  } catch (e) { toast(e.message || t("exitFailed")); return false; }
  finally { pvpLeaving = false; }
}
async function startNextPvpRoom(){
  if (await exitPvpRoom()) await createPvpRoom();
}
async function createPvpRoom(){
  try{ const d=await API.req("/room/create","POST",{timeControl:selectedPvpTimeControl("pvpTimeControl"),asColor:"random"}); pvpRoomId=d.roomId; sessionStorage.setItem("ct.pvpRoomId",d.roomId); sessionStorage.setItem("ct.pvpRoomNumber",d.roomNumber); document.getElementById("pvpRoomInfo").innerHTML=esc(t("roomNumber",{number:d.roomNumber})); connectWs(); sendWsWhenOpen({type:"join_room",payload:{roomId:d.roomId}}); }catch(e){ toast(e.message); }
}
async function joinPvpRoom(){
  const c=document.getElementById("joinRoomCode").value.trim(); if(!c){ toast(t("enterRoom")); return; }
  try{ const d=await API.req("/room/join","POST",{roomNumber:c}); pvpRoomId=d.roomId; sessionStorage.setItem("ct.pvpRoomId",d.roomId); sessionStorage.setItem("ct.pvpRoomNumber",d.roomNumber); connectWs(); sendWsWhenOpen({type:"join_room",payload:{roomId:d.roomId}}); }catch(e){ toast(e.message); }
}
async function resignPvp(){
  if (latestPvpState?.status !== "playing" || !confirm(t("confirmResign"))) return;
  try { await API.req("/room/" + pvpRoomId + "/resign", "POST", {}); }
  catch(e){ toast(e.message); }
}
let drawRequestBusy = false;
function renderDrawOffer(p){
  const panel = document.getElementById("pvpDrawOffer");
  const pending = p.status === "playing" && p.drawOfferFrom;
  panel.hidden = !pending;
  document.getElementById("offerDrawButton").disabled = p.status !== "playing" || !!pending;
  if (!pending) { panel.innerHTML = ""; return; }
  const mine = p.drawOfferFrom === API.user.id;
  panel.innerHTML = `<p>${t(mine ? "drawPending" : "drawReceived")}</p>` + (mine ? "" : `<div class="row" style="justify-content:center"><button class="btn btn-primary" onclick="respondDraw('accept')">${t("acceptDraw")}</button><button class="btn btn-ghost" onclick="respondDraw('reject')">${t("rejectDraw")}</button></div>`);
}
async function respondDraw(action){
  if (drawRequestBusy || latestPvpState?.status !== "playing") return;
  const roomId = pvpRoomId;
  drawRequestBusy = true;
  try {
    await API.req("/room/" + roomId + "/draw", "POST", {action});
    // HTTP also works during a socket reconnect. Recover the latest state.
    const state = await API.req("/room/" + roomId);
    if (pvpRoomId === roomId) handlePvpState(state);
  } catch(e){ toast(e.message); }
  finally { drawRequestBusy = false; }
}
function offerDraw(){ return respondDraw("offer"); }
async function refreshRooms(){
  try{ const d=await API.req("/rooms/active"); document.getElementById("activeRooms").innerHTML=(d.rooms||[]).map(r=>`<div class="list-item">${esc(r.roomNumber)}·${esc(r.creatorName)}·${r.timeControl.initialMinutes}+${r.timeControl.incrementSeconds} <button class="btn btn-ghost" onclick="document.getElementById('joinRoomCode').value='${r.roomNumber}';joinPvpRoom();">${t("join")}</button></div>`).join(""); }catch(e){}
}

// ── Arena ──
async function joinArena(){
  try{ const d=await API.req("/arena/join","POST",{}); if(d.matched){ toast("🎯匹配成功！房间:"+d.roomNumber); document.getElementById("joinRoomCode").value=d.roomNumber; navTo("pvp"); setTimeout(()=>joinPvpRoom(),1000); } else toast("⏳加入队列，位置:"+d.queuePosition); }catch(e){ toast(e.message); }
}

// ── Rankings ──
async function loadRankings(){
  const urls={global:"/rankings/global",puzzle:"/rankings/puzzle",battle:"/rankings/battle"};
  try{ const d=await API.req(urls[rankTab]||urls.global); document.getElementById("rankingsTable").innerHTML=`<div class="list-item" style="font-weight:700;border-bottom:2px solid rgba(255,255,255,.1);"><span>${t("rankPosition")}</span><span>${t("player")}</span><span>${rankTab==="puzzle"?t("practiceCenter"):t("points")}</span><span>${t("rankProgress")}</span><span>${t("record")}</span></div>`+(d.items||[]).map(i=>{ const rr=getRank(i.points||0); return `<div class="list-item"><span style="font-weight:700;">${i.rank<=3?["🥇","🥈","🥉"][i.rank-1]:"#"+i.rank}</span><span>${esc(i.name)}</span><span>${rankTab==="puzzle"?i.solved:i.points+" "+t("points")}</span><span>${rr.piece} Lv.${rr.level} ${rr.title} ${rr.toNext?`<small style="color:var(--muted);">${t("nextRank",{rank:rr.nextTitle,points:rr.toNext})}</small>`:""}</span><span style="font-size:11px;">${t("winLoss",{wins:i.wins||0,losses:i.losses||0})}</span></div>`; }).join(""); }catch(e){ toast(e.message); }
}
function renderRankRules() {
  const el = document.getElementById("rankRules");
  if (!el) return;
  el.innerHTML = `
    <div class="rank-rules">
      <div><b>${t("rankRules")}</b>：${t("rankRulesText")}</div>
      <div><b>${t("pointSources")}</b>：${t("pointSourcesText")}</div>
    </div>`;
}
document.addEventListener("click",e=>{ if(e.target.classList.contains("btn-rank-tab")){ rankTab=e.target.dataset.tab; document.querySelectorAll(".btn-rank-tab").forEach(b=>b.className=b.dataset.tab===rankTab?"btn btn-primary btn-rank-tab":"btn btn-ghost btn-rank-tab"); renderRankRules(); loadRankings(); } });

// ── Friends ──
async function searchFriends(){
  const q=document.getElementById("friendSearch").value.trim(); if(!q){toast(t("friendSearch"));return;}
  try {const d=await API.req("/friends/search?q="+encodeURIComponent(q));
    document.getElementById("friendResults").innerHTML=(d.results||[]).map(u=>{
      const action=u.isFriend?`<span class="tag green">${t("alreadyFriend")}</span>`:u.pendingIncoming?`<button class="btn btn-primary" onclick="acceptFriend('${u.pendingRequestId}')">${t("accept")}</button>`:u.pendingSent?`<span class="tag">${t("sent")}</span>`:`<button class="btn btn-ghost" onclick="sendFriendReq('${u.userId}')">${t("addFriend")}</button>`;
      return `<div class="list-item"><span>${esc(u.displayName)} · Lv.${u.level} · ${u.points} ${t("points")}</span>${action}</div>`;
    }).join("")||esc(t("noUsers"));
  }catch(e){toast(e.message);}
}
async function sendFriendReq(uid){ try{ const result=await API.req("/friends/request","POST",{toUserId:uid}); toast(result.accepted?t("friendAdded"):t("friendSent")); await Promise.all([loadFriends(),loadFriendRequests(),searchFriends()]); }catch(e){ toast(e.message); } }
async function loadFriends(){
  try{ const d=await API.req("/friends/list"); document.getElementById("friendsList").innerHTML=(d.friends||[]).map(f=>`<div class="list-item"><span>${esc(f.displayName)}·${f.points} ${t("points")} ${f.unreadCount?'<span class="tag red">'+f.unreadCount+'</span>':''}</span><span><button class="btn btn-ghost" onclick="openChat('${f.userId}','${esc(f.displayName)}')">💬</button><button class="btn btn-ghost" onclick="sendGameReq('${f.userId}','${esc(f.displayName)}')">⚔</button></span></div>`).join(""); }catch(e){}
}
async function loadFriendRequests(){
  try{ const d=await API.req("/friends/requests"); document.getElementById("friendRequests").innerHTML=(d.incoming||[]).map(r=>`<div class="list-item"><span>${esc(r.displayName)}</span><span><button class="btn btn-primary" onclick="acceptFriend('${r.requestId}')">${t("accept")}</button><button class="btn btn-ghost" onclick="rejectFriend('${r.requestId}')">${t("reject")}</button></span></div>`).join("")||`<div style="color:var(--muted);font-size:12px;">${t("noRequests")}</div>`; }catch(e){}
}
async function loadGameRequests(){
  if (!document.getElementById("gameRequests")) return;
  try {
    const [incomingData, outgoingData] = await Promise.all([
      API.req("/game-request/incoming"),
      API.req("/game-request/outgoing"),
    ]);
    const incoming = (incomingData.requests || []).map(r =>
      `<div class="list-item"><span>${esc(t("inviteFrom",{name:r.fromName,time:pvpTimeLabel(r.timeControl)}))}</span><span><button class="btn btn-primary" onclick="acceptGameRequest('${r.requestId}')">${t("accept")}</button><button class="btn btn-ghost" onclick="declineGameRequest('${r.requestId}')">${t("reject")}</button></span></div>`
    );
    const outgoing = (outgoingData.requests || []).map(r => {
      if (r.status === "accepted" && r.roomId) {
        return `<div class="list-item"><span>${esc(t("inviteAccepted",{name:r.toName,time:pvpTimeLabel(r.timeControl)}))}</span><button class="btn btn-primary" onclick="joinAcceptedGame('${r.roomId}','${r.roomNumber || ""}')">${t("enterGame")}</button></div>`;
      }
      return `<div class="list-item"><span>${esc(t("inviteSent",{name:r.toName,time:pvpTimeLabel(r.timeControl)}))}</span><span class="tag">${t("waitingAccept")}</span></div>`;
    });
    document.getElementById("gameRequests").innerHTML = incoming.concat(outgoing).join("") || `<div style="color:var(--muted);font-size:12px;">${t("noInvitations")}</div>`;
  } catch (e) {
    // Keep the friend page usable if the optional request poll is temporarily unavailable.
  }
}
async function acceptGameRequest(requestId){
  try {
    const d = await API.req("/game-request/" + requestId + "/accept", "POST", {});
    await joinAcceptedGame(d.roomId, d.roomNumber);
  } catch (e) { toast(e.message || t("requestFailed")); }
}
async function declineGameRequest(requestId){
  try { await API.req("/game-request/" + requestId + "/decline", "POST", {}); loadGameRequests(); }
  catch (e) { toast(e.message || t("requestFailed")); }
}
async function joinAcceptedGame(roomId, roomNumber){
  pvpRoomId = roomId;
  sessionStorage.setItem("ct.pvpRoomId", roomId);
  sessionStorage.setItem("ct.pvpRoomNumber", roomNumber || "");
  if (roomNumber) document.getElementById("joinRoomCode").value = roomNumber;
  navTo("pvp");
  connectWs();
  sendWsWhenOpen({type:"join_room", payload:{roomId}});
}
async function acceptFriend(rid){ try{ await API.req("/friends/accept","POST",{requestId:rid}); toast(t("friendAdded")); await Promise.all([loadFriends(),loadFriendRequests()]); }catch(e){ toast(e.message); } }
async function rejectFriend(rid){ try{ await API.req("/friends/reject","POST",{requestId:rid}); loadFriendRequests(); }catch(e){ toast(e.message); } }
function openChat(fid, fname){
  document.getElementById("chatPanel").style.display="";
  document.getElementById("chatTitle").textContent="💬 "+fname;
  window._chatFriend=fid;
  loadChatHistory();
  if(chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer=setInterval(()=>{ if(window._chatFriend) loadChatHistory(); }, 2000);
}
async function loadChatHistory(){
  if(!window._chatFriend) return;
  try{ const d=await API.req("/chat/history/"+window._chatFriend); document.getElementById("chatMessages").innerHTML=(d.messages||[]).map(m=>`<div class="chat-msg ${m.outgoing?'out':'in'}">${esc(m.message)}<div class="chat-time">${m.createdAt}</div></div>`).join("")||t("noMessages"); }catch(e){}
}
async function sendChatMsg(){
  const input=document.getElementById("chatInput");
  const message=input.value.trim();
  if(!message||!window._chatFriend) return;
  try{
    await API.req("/chat/send","POST",{toUserId:window._chatFriend,message});
    input.value="";
    await loadChatHistory();
  }catch(e){
    toast(e.message || t("sendFailed"));
  }
}
function handleChatMsg(msg){ if(window._chatFriend===msg.fromUserId||window._chatFriend===msg.toUserId) loadChatHistory(); else toast("💬 "+msg.fromName+": "+msg.message); }
async function sendGameReq(uid,uname){ try{ await API.req("/game-request/send","POST",{toUserId:uid,timeControl:selectedPvpTimeControl("friendTimeControl")}); toast(t("inviteSent",{name:uname,time:pvpTimeLabel(selectedPvpTimeControl("friendTimeControl"))})); loadGameRequests(); }catch(e){ toast(e.message); } }

// ── Binding ──
async function generateBindCode(){
  try{ const d=await API.req("/student/my-code"); showBindModal(d); }catch(e){ toast(e.message); }
}
function showBindModal(d){
  document.getElementById("bindCodeDisplay").textContent=d.code;
  document.getElementById("bindModal").style.display="flex";
  let remain=d.expiresInSeconds||300;
  if(bindTimer) clearInterval(bindTimer);
  document.getElementById("bindCountdown").textContent=t("codeRemaining",{time:fmtCountdown(remain)});
  bindTimer=setInterval(()=>{ remain--; document.getElementById("bindCountdown").textContent=t("codeRemaining",{time:fmtCountdown(remain)}); if(remain<=0){ clearInterval(bindTimer); document.getElementById("bindCountdown").textContent=t("codeExpired"); } },1000);
  document.getElementById("btnRegenCode").onclick=async ()=>{ clearInterval(bindTimer); try{ const nd=await API.req("/student/regenerate-code","POST"); showBindModal(nd); }catch(e){ toast(e.message); } };
}
function closeBindModal(){ document.getElementById("bindModal").style.display="none"; if(bindTimer) clearInterval(bindTimer); }
function fmtCountdown(s){ const m=Math.floor(s/60), sec=s%60; return m+":"+(sec<10?"0":"")+sec; }
async function fetchBindCodeDisplay(){ try{ const d=await API.req("/student/my-code"); }catch(e){} }

// ── Parent ──
async function bindChild(){
  const c=document.getElementById("bindCode").value.trim();
  if(c.length!==6){ document.getElementById("bindResult").textContent="请输入6位码"; return; }
  try{ const d=await API.req("/parent/bind-child","POST",{code:c}); document.getElementById("bindResult").innerHTML=`<span style="color:var(--green);">✅ ${d.message}</span>`; loadMyChildren(); }catch(e){ document.getElementById("bindResult").innerHTML=`<span style="color:var(--banner);">❌ ${e.message}</span>`; }
}
async function loadMyChildren(){
  try{ const d=await API.req("/parent/my-children");
    document.getElementById("childrenList").innerHTML=(d.children||[]).map(ch=>`<div class="list-item"><span><b>${esc(ch.childName)}</b>·${ch.rankTitle||""}·${ch.points}分<br><small>做题${ch.totalAttempts}·正确率${ch.accuracy}%·今日${ch.todaySolve}题${ch.todayBattle}战</small></span><span><button class="btn btn-ghost" onclick="showChildDetail('${ch.childId}')">详情</button></span></div>`).join("")||"<div class='feed' style='text-align:center;padding:16px;'>⚠️ 尚未绑定孩子<br><small>让孩子在Ta的仪表盘点击 <b>「🔗 绑定家长」</b> 获取6位码<br>然后在上方输入框中输入该码完成绑定</small></div>";
    document.getElementById("planChildSelect").innerHTML='<option value="">--选择孩子--</option>'+(d.children||[]).map(ch=>`<option value="${ch.childId}">${ch.childName}</option>`).join("");
    document.getElementById("reportChildSelect").innerHTML='<option value="">--选择孩子--</option>'+(d.children||[]).map(ch=>`<option value="${ch.childId}">${ch.childName}</option>`).join("");
  }catch(e){}
}
async function showChildDetail(cid){
  try{ const d=await API.req("/parent/child/"+cid+"/detail"); document.getElementById("childDetail").innerHTML=`<b>${esc(d.childName)}</b>·${d.rankTitle||""}·${d.points}分<br>总做题${d.totalAttempts}·正确率${d.accuracy}%·今日${d.todaySolve}题${d.todayBattle}战`; }catch(e){}
}
async function genReport(force){
  const cid=document.getElementById("reportChildSelect").value; if(!cid){ toast("选择孩子"); return; }
  document.getElementById("reportResult").innerHTML="<div class='feed'>⏳ 生成中...</div>";
  var url="/parent/child/"+cid+"/generate-report";
  if(force) url+="?force=true";
  try{ const d=await API.req(url,"POST",{}); const r=d.report;
    var html="";
    html+=`<div class='feed' style='line-height:1.7;'>`;
    html+=`<h4>📊 学习周报 ${d.cached?'<span class="tag" style="font-size:10px;">已缓存</span>':''}${d.refreshed?'<span class="tag green" style="font-size:10px;">已刷新</span>':''}</h4>`;
    html+=`<p><b>📅 ${(r.weekStart||"").slice(0,10)} ~ ${(r.weekEnd||"").slice(0,10)}</b></p>`;
    html+=`<p>🏆 段位 <b>${esc(r.currentRank||"")}</b> · 积分 <b>${r.currentPoints}</b>（<span style="color:var(--green);">本周${r.pointsGained>=0?'+':''}${r.pointsGained}</span>）</p>`;
    html+=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;margin:8px 0;">`;
    html+=`<div class="class-card"><b style="font-size:20px;">${r.solveCount}</b><br><small>✅ 正确解题</small></div>`;
    html+=`<div class="class-card"><b style="font-size:20px;">${r.battleCount}</b><br><small>⚔ 对战局数</small></div>`;
    html+=`<div class="class-card"><b style="font-size:20px;color:var(--green);">${r.pvpWins}</b><br><small>🏅 胜利</small></div>`;
    html+=`<div class="class-card"><b style="font-size:20px;color:var(--banner);">${r.pvpLosses}</b><br><small>💪 失利</small></div>`;
    html+=`</div>`;
    html+=`<p>📚 累计做题 <b>${r.totalAttempts||0}</b> 次 · 正确率 <b>${r.totalAccuracy||"0%"}</b></p>`;
    html+=`<p>📝 班级作业 <b>${r.homeworkDone||0}/${r.homeworkTotal||0}</b> 完成</p>`;
    // Daily breakdown
    if(r.dailyBreakdown&&r.dailyBreakdown.length){
      html+=`<p style="margin-top:8px;"><b>📅 每日统计</b></p>`;
      html+=`<div style="display:flex;gap:4px;flex-wrap:wrap;">`;
      r.dailyBreakdown.forEach(function(day){
        var dow=["日","一","二","三","四","五","六"][new Date(day.date).getDay()];
        html+=`<div style="flex:1;min-width:80px;text-align:center;padding:4px;background:rgba(255,255,255,.05);border-radius:4px;font-size:11px;">`;
        html+=`<div>周${dow}</div><div>✅${day.solve}</div><div>⚔${day.battle}</div>`;
        html+=`</div>`;
      });
      html+=`</div>`;
    }
    // AI commentary
    if(r.aiCommentary){
      html+=`<div style="margin-top:10px;padding:8px;background:rgba(53,89,67,.12);border-left:3px solid var(--green);border-radius:4px;">`;
      html+=`<b>🤖 AI评语</b><br>${esc(r.aiCommentary)}</div>`;
    }
    // Suggestions
    if(r.suggestions&&r.suggestions.length){
      html+=`<p style="margin-top:8px;"><b>💡 建议</b></p>`;
      r.suggestions.forEach(function(s,i){
        html+=`<div style="padding:2px 0;font-size:12px;">${["📌","🎯","💪","📖"][i]||"•"} ${esc(s)}</div>`;
      });
    }
    html+=`</div>`;
    html+=`<div class="row" style="margin-top:8px;"><button class="btn btn-ghost" onclick="genReport(true)">🔄 刷新报告</button></div>`;
    document.getElementById("reportResult").innerHTML=html;
  }catch(e){ document.getElementById("reportResult").innerHTML=`<div class='feed' style="color:var(--banner);">❌ ${esc(e.message)}</div>`; }
}
async function viewReports(){
  const cid=document.getElementById("reportChildSelect").value; if(!cid){ toast("选择孩子"); return; }
  try{ const d=await API.req("/parent/child/"+cid+"/reports"); document.getElementById("reportResult").innerHTML="<h4>历史周报</h4>"+(d.items||[]).map(r=>`<div class='list-item'><b>${(r.weekStart||"").slice(0,10)}~${(r.weekEnd||"").slice(0,10)}</b>·解题${r.solveCount}·对战${r.battleCount}·${r.pvpWins}胜</div>`).join("")||"暂无"; }catch(e){}
}
async function createStudyPlan(){
  const cid=document.getElementById("planChildSelect").value; if(!cid){ toast("选择孩子"); return; }
  try{ await API.req("/parent/study-plan","POST",{childId:cid,dailySolveTarget:+document.getElementById("planSolve").value,dailyBattleTarget:+document.getElementById("planBattle").value,startDate:document.getElementById("planStart").value,endDate:document.getElementById("planEnd").value}); toast("计划创建成功"); loadStudyPlans(); }catch(e){ toast(e.message); }
}
async function loadStudyPlans(){
  try{ const d=await API.req("/parent/study-plans"); document.getElementById("planList").innerHTML=(d.plans||[]).map(p=>`<div class="list-item"><span>${esc(p.childName)}·做题${p.todaySolve}/${p.dailySolveTarget}·对战${p.todayBattle}/${p.dailyBattleTarget}</span><span>${p.startDate}~${p.endDate}</span></div>`).join("")||"<div class='feed'>暂无计划</div>"; }catch(e){}
}

// ── Class Management ──
async function createClass(){
  const n=document.getElementById("clsName").value.trim(); if(!n){ document.getElementById("createResult").innerHTML="<span style='color:var(--banner);'>输入班级名称</span>"; return; }
  const c=document.getElementById("clsCode").value.trim();
  const p={name:n}; if(c.length===6) p.inviteCode=c; else if(c.length>0){ document.getElementById("createResult").innerHTML="<span style='color:var(--banner);'>邀请码6位</span>"; return; }
  try{ const d=await API.req("/class/create","POST",p); document.getElementById("createResult").innerHTML=`<span style="color:var(--green);">✅ 创建成功！邀请码: <b>${d.inviteCode}</b></span>`; loadTeacherClasses(); setTimeout(()=>{ document.getElementById("clsSelect").value=d.class.id; showClassDetail(d.class.id); },300); }catch(e){ document.getElementById("createResult").innerHTML=`<span style="color:var(--banner);">❌ ${e.message}</span>`; }
}
async function loadTeacherClasses(){
  try{ const d=await API.req("/class/my-classes"); const sel=document.getElementById("clsSelect"); sel.innerHTML='<option value="">--选择班级--</option>'+(d.items||[]).map(c=>`<option value="${c.id}">${c.name} (${c.memberCount})</option>`).join(""); }catch(e){}
}
async function showClassDetail(cid){
  if(!cid){ document.getElementById("classTeacherDetail").innerHTML=""; return; }
  currentClassId=cid;
  try{ const d=await API.req("/class/"+cid);
    let h=`<div class="row"><input id="noticeMsg" placeholder="公告" style="flex:1;"><button class="btn btn-ghost" id="btnSendNotice">发送</button></div><div id="noticeResult"></div>`;
    h+="<h4>公告</h4>"+(d.notices||[]).map(n=>`<div class="list-item">${n.creatorName}: ${esc(n.message)}</div>`).join("")||"暂无";
    h+="<h4>👥成员("+d.memberCount+")</h4>"+(d.members||[]).map(m=>`<div class="list-item">${m.displayName}·${m.role}·${m.points}分</div>`).join("");
    h+="<h4>📝作业</h4>"+(d.homeworks||[]).map(hw=>`<div class="list-item">${esc(hw.title)}·截止${hw.dueDate}·提交${hw.submitCount}</div>`).join("")||"暂无";
    h+='<div class="row" style="margin-top:10px;"><button class="btn btn-primary" onclick="showBoardEditor()">♟ 棋盘编辑器（自定义题目）</button></div>';
    document.getElementById("classTeacherDetail").innerHTML=h;
    setTimeout(()=>{ const b=document.getElementById("btnSendNotice"); if(b) b.onclick=sendNotice; },200);
  }catch(e){ document.getElementById("classTeacherDetail").textContent=e.message; }
}
async function sendNotice(){ const m=document.getElementById("noticeMsg").value.trim(); if(!m)return; try{ await API.req("/class/"+currentClassId+"/notice","POST",{message:m}); document.getElementById("noticeResult").textContent="✅已发送"; showClassDetail(currentClassId); }catch(e){ toast(e.message); } }

async function loadStudentClasses(){
  try{ const d=await API.req("/class/my-classes"); document.getElementById("classStudentContent").innerHTML=`<h4>${t("myClass")}</h4>`+(d.items||[]).map(c=>`<div class="list-item"><span>${c.name} (${c.memberCount})</span><button class="btn btn-ghost" onclick="showStudentClass('${c.id}')">${t("view")}</button></div>`).join("")||t("noClasses"); }catch(e){}
}
async function showStudentClass(cid){
  try{ const d=await API.req("/class/"+cid);
    let h=`<h4>📢公告</h4>`+(d.notices||[]).map(n=>`<div class="list-item">${n.creatorName}: ${esc(n.message)}</div>`).join("")||"暂无";
    h+="<h4>📝作业</h4>"+(d.homeworks||[]).map(hw=>`<div class="list-item"><span>${esc(hw.title)}·截止${hw.dueDate}·提交${hw.submitCount}</span></div>`).join("")||"暂无";
    document.getElementById("classStudentContent").innerHTML=h;
  }catch(e){ toast(e.message); }
}
async function joinClass(){ const c=document.getElementById("joinCode").value.trim(); if(!c)return; try{ await API.req("/class/join","POST",{inviteCode:c}); toast(t("joined")); loadStudentClasses(); }catch(e){ toast(e.message); } }

// ── Teacher Board Editor ─────────────────────────────────────────
function showBoardEditor() {
  var h='<h4>♟ 棋盘编辑器 - 自定义题目</h4>';
  h+='<div class="piece-palette" style="display:flex;gap:6px;flex-wrap:wrap;padding:8px;background:rgba(0,0,0,.2);border-radius:6px;margin-bottom:8px;">';
  ["K","Q","R","B","N","P","k","q","r","b","n","p","."].forEach(function(p){
    var label=p==="."?"✕":(PIECES_FULL[p]||p);
    h+='<button class="palette-piece" data-piece="'+p+'" style="width:38px;height:38px;font-size:20px;cursor:pointer;border-radius:4px;'+(p===selectedPiece?'background:var(--gold);border:2px solid #fff;':'background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.1);')+'">'+label+'</button>';
  });
  h+='</div>';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;"><div style="flex:1;min-width:280px;"><div id="editorBoard" class="board-wrap"></div></div>';
  h+='<div style="min-width:220px;">';
  h+='<div id="editorFenDisplay" style="font-size:11px;word-break:break-all;margin-bottom:8px;">FEN: '+editorFen+'</div>';
  h+='<input id="hwTitle" placeholder="作业/题目名称" style="width:100%;margin-bottom:6px;">';
  h+='<input id="hwSolutions" placeholder="标准答案(多个用逗号分隔)如 Ra8#,a1a8" style="width:100%;margin-bottom:6px;">';
  h+='<input id="hwDue" type="date" style="width:100%;margin-bottom:6px;">';
  h+='<button class="btn btn-primary" onclick="saveCustomHomework()" style="width:100%;">💾 保存自定义题目</button>';
  h+='<div id="hwSaveResult" style="margin-top:6px;font-size:12px;"></div>';
  h+='</div></div>';
  document.getElementById("classTeacherDetail").innerHTML=h;
  setTimeout(function(){
    renderEditorBoard();
    document.querySelectorAll(".palette-piece").forEach(function(btn){
      btn.onclick=function(){ selectedPiece=btn.getAttribute("data-piece"); showBoardEditor(); };
    });
  },100);
}

function renderEditorBoard(){
  var el=document.getElementById("editorBoard"); if(!el) return;
  el.innerHTML=""; el.className="board";
  var b=parseFen(editorFen), files="abcdefgh";
  var top=document.createElement("div"), bottom=document.createElement("div"), left=document.createElement("div"), right=document.createElement("div"), grid=document.createElement("div");
  top.className="board-files board-files-top";
  bottom.className="board-files board-files-bottom";
  left.className="board-ranks board-ranks-left";
  right.className="board-ranks board-ranks-right";
  grid.className="board-grid";

  for(var i=0;i<8;i++){
    var ft=document.createElement("div"); ft.className="coord"; ft.textContent=files[i]; top.appendChild(ft);
    var fb=document.createElement("div"); fb.className="coord"; fb.textContent=files[i]; bottom.appendChild(fb);
    var rl=document.createElement("div"); rl.className="coord"; rl.textContent=String(8-i); left.appendChild(rl);
    var rr=document.createElement("div"); rr.className="coord"; rr.textContent=String(8-i); right.appendChild(rr);
  }

  for(var r=0;r<8;r++){for(var c=0;c<8;c++){
    var sq=sqName(r,c), piece=b[r][c]||"";
    var cell=document.createElement("div");
    cell.className="cell "+((r+c)%2===0?"light":"dark");
    cell.onclick=(function(s,p){return function(){onEditorClick(s,p);};})(sq,piece);
    var sp=document.createElement("span");
    sp.className="piece "+(piece===piece.toUpperCase()&&piece?"white":"black");
    sp.textContent=PIECES_FULL[piece]||"";
    cell.appendChild(sp);
    grid.appendChild(cell);
  }}

  el.appendChild(top);
  el.appendChild(left);
  el.appendChild(grid);
  el.appendChild(right);
  el.appendChild(bottom);
  var fd=document.getElementById("editorFenDisplay"); if(fd) fd.textContent="FEN: "+editorFen;
}

function onEditorClick(sq,existing){
  var b=parseFen(editorFen), row=8-parseInt(sq[1]), col="abcdefgh".indexOf(sq[0]);
  if(selectedPiece==="."){ b[row][col]=""; }
  else { var color=selectedPiece===selectedPiece.toUpperCase()?"w":"b"; b[row][col]=color==="w"?selectedPiece:selectedPiece.toLowerCase(); }
  const side=editorFen.split(" ")[1]||"w"; editorFen=boardToFen(b).replace(" w "," "+side+" "); renderEditorBoard(); if(document.getElementById("editorFenInput"))document.getElementById("editorFenInput").value=editorFen;
}

function boardToFen(board){
  var fen=""; for(var i=0;i<8;i++){ var empty=0; for(var j=0;j<8;j++){ var p=board[i][j]; if(p){ if(empty>0){fen+=empty;empty=0;} fen+=p; } else empty++; } if(empty>0) fen+=empty; if(i<7) fen+="/"; }
  return fen+" w - - 0 1";
}

async function saveCustomHomework(){
  var title=document.getElementById("hwTitle").value.trim();
  if(!title){ document.getElementById("hwSaveResult").innerHTML="<span style=color:var(--banner)>请输入题目名称</span>"; return; }
  var solutions=document.getElementById("hwSolutions").value.trim();
  if(!solutions){ document.getElementById("hwSaveResult").innerHTML="<span style=color:var(--banner)>请输入标准答案</span>"; return; }
  var due=document.getElementById("hwDue").value||new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  try{
    await API.req("/class/"+currentClassId+"/homework","POST",{title:title,fen:editorFen,solutions:solutions.split(",").map(function(s){return s.trim()}),dueDate:due});
    document.getElementById("hwSaveResult").innerHTML="<span style=color:var(--green)>✅ 自定义题目已保存！</span>";
    setTimeout(function(){ showClassDetail(currentClassId); },800);
  }catch(e){ document.getElementById("hwSaveResult").innerHTML="<span style=color:var(--banner)>❌ "+esc(e.message)+"</span>"; }
}

// ── Game History ─────────────────────────────────────────────────
async function loadGameHistory(){
  try{
    var d=await API.req("/match/history","GET");
    var items=d.items||[];
    if(!items.length){ document.getElementById("gameHistoryView").innerHTML="<div class=feed>暂无对局记录</div>"; return; }
    var h="<div class=list style=max-height:400px>";
    items.forEach(function(m){
      h+='<div class=list-item><span>'+esc(m.mode)+'·'+esc(m.result)+'·难度'+m.difficulty+'</span><span style=font-size:11px>'+new Date(m.createdAt).toLocaleDateString()+'</span></div>';
    });
    h+="</div>";
    document.getElementById("gameHistoryView").innerHTML=h;
  }catch(e){}
}

// ── Usage Guide ──────────────────────────────────────────────────
function showGuide(){
  closeGuide();
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-overlay" id="guideModal" style="display:flex;" onclick="if(event.target===this)closeGuide()"><div class="modal-box" style="max-width:600px;max-height:80vh;overflow:auto;"><h3>${t("guide")}</h3><h4>${t("student")}</h4><p>${t("guideStudent")}</p><h4>${t("teacher")}</h4><p>${t("guideTeacher")}</p><h4>${t("parentRole")}</h4><p>${t("guideParent")}</p><button class="btn btn-ghost" onclick="closeGuide()">${t("close")}</button></div></div>`);
}
function closeGuide(){ var m=document.getElementById("guideModal"); if(m) m.remove(); }

// ── Helpers ──
function updateRankDisplay(){
  if (window.ctTrialMode) {
    document.getElementById("greeting").textContent = t("welcomeBack", { name: t("trialUser") });
    document.getElementById("rankLine").textContent = t("trialNote");
    const card = document.getElementById("rankCard");
    if (card) card.style.display = "none";
    return;
  }
  const r=getRank(API.user.points||0);
  document.getElementById("greeting").textContent = t("welcomeBack", { name: API.user.displayName });
  document.getElementById("rankLine").textContent=r.piece+" Lv."+r.level+" "+r.title+" · "+API.user.points+t("points");
  const card=document.getElementById("rankCard");
  if(card) card.innerHTML=renderRankProgress(API.user.points||0);
}

function refreshI18n() {
  document.title = t("appTitle");
  if(latestPvpState) handlePvpState(latestPvpState);
  if(document.getElementById("guideModal")) showGuide();
  refreshGameResult();
  if(currentView==="friends") {loadFriends();loadFriendRequests();loadGameRequests();}
  if(currentView==="pvp") refreshRooms();
  if(currentView==="classStudent") loadStudentClasses();
  if(currentView==="learn") initLearn();
  document.getElementById("analysisResult").textContent=t("analysisEmpty");
  document.getElementById("battleStatus").textContent=t("ready");
  updateRankDisplay();
  initDash();
  initVoiceSettings();
  // These views cache API data. Fetch it again so titles, hints, and variant copy
  // use the newly selected language instead of the previous response.
  if (currentView === "practice" && problems.length) {
    // A previous result or AI explanation belongs to the old language and must not
    // remain visible after switching. The learner can submit again for a new one.
    document.getElementById("practiceResult").innerHTML = "";
    loadProblems();
  }
  initBattleDifficulty(); loadVariants();
  if (currentView === "rankings") renderRankRules();
}
connectWs();
