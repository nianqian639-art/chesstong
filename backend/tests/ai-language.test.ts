import {afterAll, afterEach, expect, it, vi} from 'vitest';
import {Chess} from 'chess.js';

process.env.AI_PROVIDER = 'qwen';
process.env.QWEN_API_KEY = 'test-only-placeholder';
const {buildServer} = await import('../src/server.js');
const {generateExplanation, generatePgnAnalysis, generatePuzzleFollowup, resolveQwenApiKey, serverLearnerMoveSan} = await import('../src/services/ai.js');
const {analyzePgn} = await import('../src/services/chess.js');
const {suggestMove} = await import('../src/services/chess.js');
const app = buildServer();
afterAll(() => app.close());
afterEach(() => vi.restoreAllMocks());
const languages = ['zh', 'en', 'ja', 'fr', 'es'] as const;
const localized = (text: string, language: typeof languages[number]) => {
  expect(text.length).toBeGreaterThan(10);
  if (language === 'ja') expect(text).toMatch(/[\u3040-\u30ff]/);
  else if (language !== 'zh') expect(text).not.toMatch(/[\u3400-\u9fff]/);
};

it('uses the DashScope key when QWEN_API_KEY is blank and normalizes queen promotion consistently', () => {
  expect(resolveQwenApiKey('', ' dashscope-test-key ')).toBe('dashscope-test-key');
  expect(resolveQwenApiKey(' qwen-test-key ', 'dashscope-test-key')).toBe('qwen-test-key');
  expect(serverLearnerMoveSan('7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8')).toBe('a8=Q+');
  expect(serverLearnerMoveSan('7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n')).toBe('a8=N');
});

it('uses the selected language for guest and signed-in move advice, including invalid and finished boards', async () => {
  const registration = await app.inject({method:'POST', url:'/auth/register', payload:{account:'language_check', password:'test123456', role:'student', displayName:'Language check'}});
  expect(registration.statusCode).toBe(200);
  const auth = registration.json();
  for (const language of languages) {
    for (const url of ['/trial/match/suggest', '/match/suggest']) {
      for (const fen of [new Chess().fen(), 'invalid', '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1']) {
        const response = await app.inject({method:'POST', url, headers:{'x-app-language':language, authorization:'Bearer '+auth.token}, payload:{fen, difficulty:1}});
        expect(response.statusCode).toBe(200);
        const body = response.json();
        localized(body.reason + body.plan.join(' '), language);
        if (fen !== new Chess().fen()) expect(body.move).toBeNull();
      }
    }
  }
});

it('identifies checkmate advice without claiming every quiet move wins an advantage', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({move:'Qg7#', source:'stockfish'})));
  const advice = await suggestMove({fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1', difficulty:10, language:'en'});
  expect(advice.move).toBe('Qg7#');
  expect(advice.reason).toContain('checkmate');
});

it('keeps Chinese puzzle themes out of all foreign-language offline explanations', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  for (const language of languages) {
    const output = await generateExplanation({question:'底线杀', knowledgePoint:'底线杀', answer:'Ra8#', isCorrect:true, language});
    expect(output.source).toBe('verified');
    localized(output.text, language);
  }
});

it('falls back to verified board facts when Qwen is unavailable without inventing pieces or replies', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const fen = '6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1';
  const output = await generateExplanation({
    question:'白车如何利用后排弱点一步将死？',
    knowledgePoint:'后排将杀',
    answer:'Ra8#',
    answerUci:'a1a8',
    fen,
    isCorrect:true,
    language:'en'
  });
  expect(output.source).toBe('verified');
  expect(output.text).toContain('rook moves from a1 to a8');
  expect(output.text).toContain('no legal reply');
  expect(output.text).not.toContain('Kb7');
  expect(output.text).not.toContain('queen');
  expect(output.text).not.toContain('queen on d8');
  expect(fetcher).toHaveBeenCalledOnce();
});

it('rejudges a wrong submitted move on both explanation routes, ignoring a forged correct flag', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).endsWith('/best-move')
    ? new Response(JSON.stringify({move:'a1a2',source:'fallback'}))
    : new Response('{}', {status:503}));
  const wrongAnswer = 'a1a2';
  const trial = await app.inject({method:'POST', url:'/trial/problems/explain', payload:{problemId:'starter-001', answer:wrongAnswer, isCorrect:true, language:'zh'}});
  expect(trial.statusCode).toBe(200);
  expect(trial.json().source).toBe('verified');
  expect(trial.json().explanation).toContain('这一步还不是本题标准答案');
  expect(trial.json().explanation).toContain('Ra8#');
  expect(trial.json().explanation).not.toContain('你这一步答对了');

  const registration = await app.inject({method:'POST', url:'/auth/register', payload:{account:`explain_check_${Date.now()}`, password:'test123456', role:'student', displayName:'Explain check'}});
  expect(registration.statusCode).toBe(200);
  const auth = registration.json();
  const signedIn = await app.inject({method:'POST', url:'/problems/explain', headers:{authorization:`Bearer ${auth.token}`}, payload:{problemId:'starter-001', answer:wrongAnswer, isCorrect:true, language:'en'}});
  expect(signedIn.statusCode).toBe(200);
  expect(signedIn.json().source).toBe('verified');
  expect(signedIn.json().explanation).toContain('not the expected solution');
  expect(signedIn.json().explanation).toContain('Ra8#');
  expect(signedIn.json().explanation).not.toContain('Your answer is correct');
});

it('requests only the selected review language and falls back if the model ignores it', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'请用中文复盘'}}]})));
  const output = await generatePgnAnalysis({pgn:'1. e4 e5', localSummary:'共两手', keyMoves:[], language:'fr'});
  expect(output.source).toBe('fallback');
  localized(output.summary, 'fr');
  const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(request.messages.map((m:{content:string}) => m.content).join(' ')).toContain('Reply entirely in French');
  expect(request.messages.map((m:{content:string}) => m.content).join(' ')).not.toMatch(/请输出三段中文|简洁中文复盘/);
});

it('sends server-parsed player and AI move ownership to Qwen for game reviews', async () => {
  const pgn='1. d4 h6 2. e3 a6 3. f4 b5 4. c3 Nc6';
  const local=await analyzePgn(pgn,'child','w');
  expect(local.movesWithActors.map((move:{san:string;actor:string;side:string})=>`${move.san}:${move.actor}:${move.side}`)).toEqual([
    'd4:player:White','h6:AI:Black','e3:player:White','a6:AI:Black','f4:player:White','b5:AI:Black','c3:player:White','Nc6:AI:Black'
  ]);
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'你走了 c3，黑方回应 Nc6。'}}]})));
  await generatePgnAnalysis({pgn,localSummary:local.summary,keyMoves:local.keyMoves,movesWithActors:local.movesWithActors,playerColor:'w',audience:'child',language:'zh'});
  const qwenCall=fetcher.mock.calls.find(([url])=>String(url).includes('/chat/completions'));
  expect(qwenCall).toBeDefined();
  const request=JSON.parse(String(qwenCall?.[1]?.body));
  const prompt=request.messages.map((message:{content:string})=>message.content).join('\n');
  expect(prompt).toContain('The player is White; the AI is Black');
  expect(prompt).toContain('Ply 8 | Black | AI | Nc6');
  expect(prompt).toContain('Ply 7 | White | player | c3');
});

it('supplies server-derived board pieces and rejudged answers to puzzle follow-up questions', async () => {
  const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async (url) => String(url).endsWith('/best-move')
    ? new Response(JSON.stringify({move:'Ra8#',source:'stockfish'}))
    : new Response(JSON.stringify({choices:[{message:{content:'Ra2 is a legal move, but it is not the expected mate. The reference move is Ra8#.'}}]})));
  const response=await app.inject({method:'POST',url:'/trial/problems/ask',payload:{problemId:'starter-001',answer:'a1a2',question:'Why is my move wrong?',history:[{role:'user',content:'Is Ra2 legal?'},{role:'assistant',content:'Yes, it is legal.'}],language:'en'}});
  expect(response.statusCode).toBe(200);
  expect(response.json().source).toBe('qwen');
  const qwenCall=fetcher.mock.calls.find(([url])=>String(url).includes('/chat/completions'));
  expect(qwenCall).toBeDefined();
  const request=JSON.parse(String(qwenCall?.[1]?.body));
  const prompt=request.messages.map((message:{content:string})=>message.content).join('\n');
  expect(prompt).toContain('Question: Why is my move wrong?');
  expect(prompt).toContain('user: Is Ra2 legal?');
  expect(prompt).toContain('Server-judged submitted move: Ra2; correct: false');
  expect(prompt).toContain('Reference move: Ra8#; UCI: a1a8; check: true; checkmate: true');
  expect(prompt).toContain('Stockfish best move from the original FEN: Ra8#');
  expect(prompt).toContain('"color":"White","piece":"rook","square":"a1"');
  expect(prompt).toContain('"color":"Black","piece":"king","square":"g8"');
  expect(prompt).not.toContain('queen","square":"d8"');
});

it('rejects follow-up answers that contradict the server judgment', async () => {
  vi.spyOn(globalThis,'fetch').mockImplementation(async (url) => String(url).endsWith('/best-move')
    ? new Response(JSON.stringify({move:'Ra8#',source:'stockfish'}))
    : new Response(JSON.stringify({choices:[{message:{content:'你这一步答对了，Ra8# 是标准答案。'}}]})));
  const response=await app.inject({method:'POST',url:'/trial/problems/ask',payload:{problemId:'starter-001',answer:'a1a2',question:'我这步对了吗？',language:'zh'}});
  expect(response.statusCode).toBe(200);
  expect(response.json().source).toBe('verified');
  expect(response.json().answer).toContain('不是题库标准解');
  expect(response.json().answer).not.toContain('你这一步答对了');
});

it('sends a Black-to-move position and server-parsed move to Qwen without flipping colors', async () => {
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'黑方后从 h1 走到 h2，将军。'}}]})));
  const output=await generateExplanation({
    question:'黑方如何走后？', answer:'Qh2+', answerUci:'h1h2', learnerAnswer:'h1h2',
    fen:'7k/8/8/8/8/8/K7/7q b - - 0 1', isCorrect:true, knowledgePoint:'将军',
    language:'zh', stockfish:{move:'Qh2+',source:'stockfish'}
  });
  expect(output.source).toBe('qwen');
  const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  const prompt=request.messages.map((message:{content:string})=>message.content).join('\n');
  expect(prompt).toContain('Side to move (the solver\'s side for this puzzle): Black');
  expect(prompt).toContain('Student move submitted: Qh2+');
  expect(prompt).toContain('against accepted puzzle answers: correct');
  expect(prompt).toContain('"color":"Black","piece":"queen","square":"h1"');
});

it('restores Qwen as the default puzzle explainer and supplies verified answer and Stockfish evidence', async () => {
  const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async (url) => String(url).endsWith('/best-move')
    ? new Response(JSON.stringify({move:'Ra8#',source:'stockfish'}))
    : new Response(JSON.stringify({choices:[{message:{content:'你这一步答对了。白车从 a1 走到 a8，将死黑王。'}}]})));
  const response=await app.inject({method:'POST',url:'/trial/problems/explain',payload:{problemId:'starter-001',answer:'a1a8',language:'zh'}});
  expect(response.statusCode).toBe(200);
  expect(response.json().source).toBe('qwen');
  expect(response.json().engineFeedback).toBe('Ra8#');
  const qwenCall=fetcher.mock.calls.find(([url])=>String(url).includes('/chat/completions'));
  expect(qwenCall).toBeDefined();
  const request=JSON.parse(String(qwenCall?.[1]?.body));
  const prompt=request.messages.map((message:{content:string})=>message.content).join('\n');
  expect(prompt).toContain('Side to move (the solver\'s side for this puzzle): White');
  expect(prompt).toContain('Student move submitted: Ra8#');
  expect(prompt).toContain('against accepted puzzle answers: correct');
  expect(prompt).toContain('Puzzle reference answer (server-verified): Ra8#; UCI a1a8');
  expect(prompt).toContain('Stockfish feedback for the original position: best move Ra8#');
  expect(prompt).toContain('does not provide an evaluation score or a full principal variation');
});

it('rejects Qwen puzzle feedback that flips a server-judged wrong answer to correct', async () => {
  vi.spyOn(globalThis,'fetch').mockImplementation(async (url) => String(url).endsWith('/best-move')
    ? new Response(JSON.stringify({move:'Ra8#',source:'stockfish'}))
    : new Response(JSON.stringify({choices:[{message:{content:'你这一步答对了，Ra8# 是标准答案。'}}]})));
  const response=await app.inject({method:'POST',url:'/trial/problems/explain',payload:{problemId:'starter-001',answer:'a1a2',language:'zh'}});
  expect(response.statusCode).toBe(200);
  expect(response.json().source).toBe('verified');
  expect(response.json().explanation).toContain('这一步还不是本题标准答案');
  expect(response.json().explanation).not.toContain('你这一步答对了');
});

it('rejects Qwen puzzle feedback that assigns the move to the wrong color', async () => {
  vi.spyOn(globalThis,'fetch').mockImplementation(async (url) => String(url).endsWith('/best-move')
    ? new Response(JSON.stringify({move:'Ra8#',source:'stockfish'}))
    : new Response(JSON.stringify({choices:[{message:{content:'Black to move: Ra8# is checkmate.'}}]})));
  const response=await app.inject({method:'POST',url:'/trial/problems/explain',payload:{problemId:'starter-001',answer:'a1a8',language:'en'}});
  expect(response.statusCode).toBe(200);
  expect(response.json().source).toBe('verified');
  expect(response.json().explanation).toContain('Your answer is correct.');
  expect(response.json().explanation).not.toContain('Black to move');
});

it('rejects a recap that attributes an AI move to the player', async () => {
  const pgn='1. d4 h6 2. e3 a6 3. f4 b5 4. c3 Nc6';
  const local=await analyzePgn(pgn,'child','w');
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'你走了 h6、a6，又走了 Nc6。'}}]})));
  const result=await generatePgnAnalysis({pgn,localSummary:local.summary,keyMoves:local.keyMoves,movesWithActors:local.movesWithActors,playerColor:'w',language:'zh'});
  expect(result.source).toBe('fallback');
  expect(result.summary).not.toContain('你走了 h6');
  expect(result.summary).toContain('这盘棋大概是这样');
});
