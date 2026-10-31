import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 注意：env 在 synth() 内部读取，而非模块顶层。
// 因为 .env 由 index.ts 在启动时加载，而 ESM 会先求值依赖模块（本文件）
// 再执行 index.ts 的主体代码，顶层读取会拿到空值。
const DEFAULT_TTS_BASE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer";

export const TTS_DIR = resolve(process.env.CHESSTONG_DATA_DIR || resolve(__dirname, "..", "..", "data"), "tts");
if (!existsSync(TTS_DIR)) {
  mkdirSync(TTS_DIR, { recursive: true });
}

// ── 预设音色（按语言）───────────────────────────────────────────
// 中文：声音设计生成的 4 个原创动物角色（cosyvoice-v3.5-plus，支持 instruction）
// 英文：现成多语角色音色（cosyvoice-v3-flash，支持中英，不支持 instruction）
// 其他语言（ja/fr/es）：无 TTS 音色，前端回退浏览器对应语言音色。
interface VoicePreset {
  voice: string;
  model: string;
  rate: number;
  pitch: number;
  instruction?: string;
}

export interface SynthResult {
  url: string;
  /** Whether the audio is a temporary DashScope URL instead of a local cache file. */
  direct?: boolean;
}

const VOICE_MAP_ZH: Record<string, VoicePreset> = {
  story: {
    voice: "cosyvoice-v3.5-plus-vd-bear-b1f98a3cc2414c3d985bdff5e200bad6", // 憨厚棕熊
    model: "cosyvoice-v3.5-plus",
    rate: 0.92,
    pitch: 1.12,
    instruction: "用憨厚可爱的大熊语气，像动画片里温柔的大哥哥，语气亲切活泼。",
  },
  child: {
    voice: "cosyvoice-v3.5-plus-vd-piggy-dba239cff1e04bf68bf570dec4294061", // 软萌小猪
    model: "cosyvoice-v3.5-plus",
    rate: 1.0,
    pitch: 1.28,
    instruction: "用奶声奶气的卡通小朋友语气，俏皮可爱，像动画片里的小猪。",
  },
  buddy: {
    voice: "cosyvoice-v3.5-plus-vd-capn-5220a5cf021a4dd496e39bf872ea0a5f", // 元气小队长
    model: "cosyvoice-v3.5-plus",
    rate: 1.05,
    pitch: 1.22,
    instruction: "用元气满满的卡通少年语气，活泼有干劲，像动画片里的队长。",
  },
  coach: {
    voice: "cosyvoice-v3.5-plus-vd-robot-9b6431c223414b4ba1c2d12eb9ecc2eb", // 呆萌机器人
    model: "cosyvoice-v3.5-plus",
    rate: 0.95,
    pitch: 1.08,
    instruction: "用呆萌的卡通机器人语气，俏皮并带一点电子感。",
  },
  monkey: {
    voice: "cosyvoice-v3.5-plus-vd-monkeyking-66e50b6c47b94e878ab897332b6f8cf3",
    model: "cosyvoice-v3.5-plus",
    rate: 1.03,
    pitch: 1.08,
    instruction: "用自然温暖、明亮清晰的少年男声，带一点爽朗顽皮和自信，像亲切的大哥哥陪孩子学棋；发音松弛有真人感，不要机械电子音，不要播音腔，不要过度夸张。",
  }, // 猴哥
};

const VOICE_MAP_EN: Record<string, VoicePreset> = {
  story: { voice: "longyingxiao_v3", model: "cosyvoice-v3-flash", rate: 0.95, pitch: 1.05 }, // 清甜女声
  child: { voice: "longjiqi_v3", model: "cosyvoice-v3-flash", rate: 1.0, pitch: 1.15 }, // 呆萌机器人
  buddy: { voice: "longhouge_v3", model: "cosyvoice-v3-flash", rate: 1.05, pitch: 1.08 }, // 猴哥
  coach: { voice: "longdaiyu_v3", model: "cosyvoice-v3-flash", rate: 0.9, pitch: 1.0 }, // 才女音
};

const VOICE_MAPS: Record<string, Record<string, VoicePreset> | undefined> = {
  zh: VOICE_MAP_ZH,
  en: VOICE_MAP_EN,
};

const MAX_CHARS = 1000;

const cleanText = (text: string): string => {
  return String(text || "")
    .replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "")
    .replace(/[*#`_>~|·•●◦▪▫]/g, "")
    .replace(/^[-–—]\s+|\s[-–—]\s/gm, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
};

export const synth = async (
  text: string,
  preset: string,
  language = "zh"
): Promise<SynthResult | null> => {
  const apiKey = process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY ?? "";
  const provider = process.env.TTS_PROVIDER ?? "dashscope";
  const baseUrl = process.env.TTS_BASE_URL ?? DEFAULT_TTS_BASE_URL;
  // CosyVoice 合成长文本较慢（约 15 字/秒），单段超时放宽，前端会分段避免长文本卡在 20s 兜底。
  const timeoutMs = Number(process.env.TTS_TIMEOUT_MS ?? 60000);

  if (provider !== "dashscope" || !apiKey) {
    return null; // 前端据此回退到浏览器 speechSynthesis
  }

  const voiceMap = VOICE_MAPS[language];
  if (!voiceMap) return null; // ja/fr/es 无 TTS 音色，前端回退浏览器
  const voiceEntry = voiceMap[preset] ?? voiceMap.story;
  const content = cleanText(text);
  if (!content) return null;

  const cacheKey = createHash("sha256")
    .update(`${voiceEntry.model}|${voiceEntry.voice}|${voiceEntry.rate}|${voiceEntry.pitch}|${voiceEntry.instruction ?? ""}|${content}`)
    .digest("hex");
  const fileName = `${cacheKey}.mp3`;
  const filePath = resolve(TTS_DIR, fileName);
  const url = `/tts/${fileName}`;

  if (existsSync(filePath)) {
    return { url };
  }

  try {
    const synthRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: voiceEntry.model,
        input: {
          text: content,
          voice: voiceEntry.voice,
          format: "mp3",
          sample_rate: 24000,
          rate: voiceEntry.rate,
          pitch: voiceEntry.pitch,
          ...(voiceEntry.instruction ? { instruction: voiceEntry.instruction } : {}),
        },
      }),
    });

    if (!synthRes.ok) {
      return null;
    }

    const data = (await synthRes.json()) as {
      output?: { audio?: { url?: string } | string };
    };
    const audio = data.output?.audio;
    const audioUrl = typeof audio === "string" ? audio : audio?.url;
    if (!audioUrl) {
      return null;
    }

    // DashScope currently returns an OSS URL. Some production networks can
    // reach the API but cannot download that OSS host from the server. Try to
    // cache it locally first; if that fails, let the user's browser fetch the
    // same short-lived URL over HTTPS instead of silently switching voices.
    try {
      const audioRes = await fetch(audioUrl, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (audioRes.ok) {
        const buffer = Buffer.from(await audioRes.arrayBuffer());
        await writeFile(filePath, buffer);
        return { url };
      }
    } catch {
      // Fall through to the direct browser URL below.
    }

    return {
      url: audioUrl.replace(/^http:\/\//i, "https://"),
      direct: true,
    };
  } catch {
    return null;
  }
};
