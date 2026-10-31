import { FastifyPluginAsync } from "fastify";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { isIP } from "net";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { synth, TTS_DIR } from "../services/tts.js";

const synthBody = z.object({
  text: z.string().min(1).max(2000),
  preset: z.string().min(1).max(32).default("story"),
  language: z.enum(["zh", "en", "ja", "fr", "es"]).optional().default("zh"),
});

export const ttsRoutes: FastifyPluginAsync = async (app) => {
  // Guest lessons use the same voices, without exposing account-only routes.
  // Bound anonymous cloud usage; only trust the IP overwritten by our local Nginx.
  const guestUsage = new Map<string, { count: number; resetAt: number; active: number }>();
  let guestActive = 0;
  app.post("/trial/tts", async (request, reply) => {
    const body = synthBody.parse(request.body);
    const peer = request.raw.socket.remoteAddress || "unknown";
    const forwarded = request.headers["x-real-ip"];
    const localProxy = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer);
    const ip = localProxy && typeof forwarded === "string" && isIP(forwarded) ? forwarded : peer;
    const now = Date.now();
    for (const [key, usage] of guestUsage) {
      if (usage.resetAt <= now && usage.active === 0) guestUsage.delete(key);
    }
    let usage = guestUsage.get(ip);
    if (!usage) {
      if (guestUsage.size >= 5000) return reply.code(429).header("Retry-After", "60").send({ message: "请稍后再试" });
      usage = { count: 0, resetAt: now + 60000, active: 0 };
      guestUsage.set(ip, usage);
    } else if (usage.resetAt <= now) {
      usage.count = 0;
      usage.resetAt = now + 60000;
    }
    if (usage.count >= 60 || usage.active >= 4 || guestActive >= 8) {
      return reply.code(429).header("Retry-After", "10").send({ message: "请稍后再试" });
    }
    usage.count++;
    usage.active++;
    guestActive++;
    try {
      const result = await synth(body.text, body.preset, body.language);
      return { url: result?.url ?? null, source: result?.direct ? "dashscope-direct" : result ? "dashscope" : null };
    } finally {
      usage.active--;
      guestActive--;
    }
  });

  app.post("/tts", { preHandler: [authGuard] }, async (request) => {
    const body = synthBody.parse(request.body);
    const result = await synth(body.text, body.preset, body.language);
    return { url: result?.url ?? null, source: result?.direct ? "dashscope-direct" : result ? "dashscope" : null };
  });

  // 公开读取：<audio src> 不会携带 Authorization header。
  // key 是 sha256（不可枚举），内容为通用讲解，公开可接受。
  app.get("/tts/:key", async (request, reply) => {
    const { key } = request.params as { key: string };
    if (!/^[a-f0-9]{64}\.mp3$/.test(key)) {
      return reply.code(404).send({ message: "音频不存在" });
    }
    try {
      const buffer = await readFile(resolve(TTS_DIR, key));
      return reply.type("audio/mpeg").send(buffer);
    } catch {
      return reply.code(404).send({ message: "音频不存在" });
    }
  });
};
