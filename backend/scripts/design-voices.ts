// 一次性脚本：用「声音设计」创建原创卡通角色音色，并打印返回的 voice_id。
// 运行：npm run design:voices
import { existsSync } from "fs";
import { resolve } from "path";

if (existsSync(resolve(process.cwd(), ".env"))) {
  process.loadEnvFile?.(resolve(process.cwd(), ".env"));
}

const KEY = process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY ?? "";
const BASE = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization";
const TARGET_MODEL = "cosyvoice-v3.5-plus";

const VOICES = [
  {
    prefix: "bear",
    prompt: "一只憨厚可爱的大棕熊男孩，声音低沉温暖、软萌憨厚，带一点鼻音，语速平稳，像耐心的大哥哥在给小朋友讲故事。",
    preview: "小朋友，今天熊哥哥陪你一起学下棋，我们慢慢来，一点都不难。",
  },
  {
    prefix: "piggy",
    prompt: "一只软萌可爱的小粉猪女孩，声音奶声奶气、软糯稚嫩，语速稍慢，像幼儿园小朋友一样可爱。",
    preview: "大家好呀，我是小猪妹妹，我们一起玩吧。",
  },
  {
    prefix: "capn",
    prompt: "一个元气满满的少年探险小队长，声音清脆有精神、积极阳光，语速轻快，充满鼓励和干劲。",
    preview: "太棒了！你做得非常好，继续保持，冲呀！",
  },
  {
    prefix: "robot",
    prompt: "一个呆萌可爱的卡通小机器人，声音带有轻微的电子合成质感，活泼俏皮，节奏轻快，像来自未来的智能小伙伴。",
    preview: "你好，我是你的智能棋伴，我们开始分析这盘棋吧。",
  },
];

async function createVoice(v: (typeof VOICES)[number]) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: "voice-enrollment",
      input: {
        action: "create_voice",
        target_model: TARGET_MODEL,
        prefix: v.prefix,
        voice_prompt: v.prompt,
        preview_text: v.preview,
      },
      parameters: {
        sample_rate: 24000,
        response_format: "mp3",
      },
    }),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  if (!KEY) {
    console.error("未配置 DASHSCOPE_API_KEY（或 QWEN_API_KEY）");
    process.exit(1);
  }
  for (const v of VOICES) {
    console.log(`\n=== 创建音色 [${v.prefix}] ===`);
    const { status, data } = await createVoice(v);
    console.log("HTTP", status);
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
