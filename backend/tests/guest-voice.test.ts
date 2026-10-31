import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildServer } from '../src/server.js';
import { synth } from '../src/services/tts.js';

vi.mock('../src/services/tts.js', () => ({ synth: vi.fn(), TTS_DIR: '/tmp/unused-guest-voice' }));
const apps: ReturnType<typeof buildServer>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); vi.clearAllMocks(); });
const server = () => { const app = buildServer(); apps.push(app); return app; };
const payload = { text: '你好，我们一起学棋。', preset: 'story', language: 'zh' };

it('serves real-provider results to guests while account features still require login', async () => {
  const app = server();
  vi.mocked(synth).mockResolvedValue({ url: '/tts/' + 'a'.repeat(64) + '.mp3' });
  for (const language of ['zh', 'en']) {
    const response = await app.inject({ method: 'POST', url: '/trial/tts', payload: { ...payload, language } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ url: '/tts/' + 'a'.repeat(64) + '.mp3', source: 'dashscope' });
    expect(synth).toHaveBeenLastCalledWith(payload.text, 'story', language);
  }
  expect((await app.inject({ method: 'POST', url: '/tts', payload })).statusCode).toBe(401);
  for (const url of ['/friends/list', '/class/my-classes', '/parent/my-children', '/points/ledger']) {
    expect((await app.inject({ url })).statusCode).toBe(401);
  }
});

it('rejects invalid guest requests before synthesis and bounds anonymous cloud usage', async () => {
  const app = server();
  vi.mocked(synth).mockResolvedValue(null);
  for (const invalid of [{ ...payload, text: '' }, { ...payload, text: 'x'.repeat(2001) }, { ...payload, language: 'invalid' }]) {
    expect((await app.inject({ method: 'POST', url: '/trial/tts', payload: invalid })).statusCode).toBe(400);
  }
  expect(synth).not.toHaveBeenCalled();
  for (let i = 0; i < 60; i++) {
    expect((await app.inject({ method: 'POST', url: '/trial/tts', payload, remoteAddress: '203.0.113.8', headers: { 'x-real-ip': '192.0.2.' + i } })).statusCode).toBe(200);
  }
  const blocked = await app.inject({ method: 'POST', url: '/trial/tts', payload, remoteAddress: '203.0.113.8', headers: { 'x-real-ip': '192.0.2.99' } });
  expect(blocked.statusCode).toBe(429);
  expect(blocked.headers['retry-after']).toBeDefined();
  expect(synth).toHaveBeenCalledTimes(60);
});

function speechHarness() {
  const requests: { resolve: (value: unknown) => void; reject: (reason: Error) => void }[] = [];
  const audio: unknown[] = [], spoken: unknown[] = [], notices: unknown[] = [];
  const context = vm.createContext({
    API: { req: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
    window: { speechSynthesis: {}, SpeechSynthesisUtterance: {} },
    speechSynthesis: { cancel() {}, getVoices: () => [{ lang: 'zh-CN', name: 'Chinese' }], speak: (value: unknown) => spoken.push(value) },
    SpeechSynthesisUtterance: class { constructor(public text: string) {} },
    Audio: class { constructor(public url: string) { audio.push(this); } play() { return Promise.resolve(); } pause() {} },
    localStorage: { getItem: () => '{}' },
    getLang: () => 'zh', cleanSpeechText: (v: string) => v, playUiSound() {}, saveVoiceSettings() {},
    toast: (v: unknown) => notices.push(v), t: (v: string) => v,
  });
  const source = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
  vm.runInContext('let speakSession=0,currentTtsAudio=null,speechVoices=[];\n' + source.slice(source.indexOf('function splitSpeech('), source.indexOf('function speakButton(')), context);
  return { context, requests, audio, spoken, notices };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

it('does not start late audio or fallback after stop or a newer preview', async () => {
  const h = speechHarness();
  vm.runInContext('speakText("first");stopSpeech();', h.context);
  h.requests[0].resolve({ url: '/first.mp3' }); await flush();
  expect(h.audio).toHaveLength(0); expect(h.spoken).toHaveLength(0);
  vm.runInContext('speakText("older");speakText("latest");', h.context);
  h.requests[1].reject(new Error('provider unavailable')); await flush();
  expect(h.spoken).toHaveLength(0); expect(h.notices).toHaveLength(0);
  h.requests[2].resolve({ url: '/latest.mp3' }); await flush();
  expect(h.audio).toHaveLength(1);
});

it('routes guest speech to the public endpoint and prevents duplicate notification stacks', async () => {
  const elements = new Map<string, any>();
  const node = () => ({ id: '', textContent: '', children: [] as any[], parent: null as any,
    get firstElementChild() { return this.children[0]; },
    appendChild(child: any) { child.parent = this; this.children.push(child); if (child.id) elements.set(child.id, child); },
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); },
  });
  const fetched: string[] = [];
  const context = vm.createContext({ window: { ctTrialMode: true, addEventListener() {} }, localStorage: { getItem: () => null },
    document: { body: node(), createElement: node, getElementById: (id: string) => elements.get(id) },
    fetch: async (url: string) => { fetched.push(url); return { ok: true, json: async () => ({ url: '/speech.mp3' }) }; },
    setTimeout() {}, URLSearchParams,
  });
  vm.runInContext(readFileSync(new URL('../public/js/common.js', import.meta.url), 'utf8'), context);
  await vm.runInContext('API.req("/tts","POST",{text:"hello"})', context);
  expect(fetched).toEqual(['/trial/tts']);
  vm.runInContext('for(let i=0;i<10;i++)toast("fallback");', context);
  expect(elements.get('toasts').children).toHaveLength(1);
  vm.runInContext('toast("two");toast("three");toast("four");', context);
  expect(elements.get('toasts').children.map((n: any) => n.textContent)).toEqual(['two', 'three', 'four']);
});
