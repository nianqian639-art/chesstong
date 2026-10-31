import {afterAll, afterEach, expect, it, vi} from 'vitest';
import {Chess} from 'chess.js';

process.env.AI_PROVIDER = 'qwen';
process.env.QWEN_API_KEY = 'test-only-placeholder';
const {buildServer} = await import('../src/server.js');
const {generateExplanation, generatePgnAnalysis} = await import('../src/services/ai.js');
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
    expect(output.source).toBe('fallback');
    localized(output.text, language);
  }
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
