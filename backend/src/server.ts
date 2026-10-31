import Fastify from "fastify";
import { ZodError } from "zod";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { arenaRoutes } from "./routes/arena.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { chatRoutes } from "./routes/chat.js";
import { classRoutes } from "./routes/class.js";
import { demoRoutes } from "./routes/demo.js";
import { friendsRoutes } from "./routes/friends.js";
import { gameRequestRoutes } from "./routes/game-request.js";
import { matchRoutes } from "./routes/match.js";
import { progressionRoutes } from "./routes/progression.js";
import { problemRoutes } from "./routes/problems.js";
import { parentRoutes } from "./routes/parent.js";
import { rankingRoutes } from "./routes/rankings.js";
import { roomRoutes } from "./routes/room.js";
import { ttsRoutes } from "./routes/tts.js";
import { trialRoutes } from "./routes/trial.js";
import { registerWebSocket } from "./services/websocket.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// In dev: src/server.ts -> ../public, in prod: dist/server.js -> ../public (copied by build)
const publicDir = resolve(__dirname, "..", "public");

export const buildServer = () => {
  const app = Fastify({
    logger: true,
    trustProxy: true,
    bodyLimit: 1048576, // 1MB
  });

  app.register(cors, {
    origin: process.env.NODE_ENV === "production"
      ? [/^https?:\/\/(.*\.)?chesstong\.top$/, /^https?:\/\/localhost(:\d+)?$/]
      : true,
  });
  app.register(sensible);
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ message: "输入格式不正确，请检查必填项、数字和日期" });
    request.log.error(error);
    const err = error as { statusCode?: number; message?: string };
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    return reply.code(status).send({ message: status >= 500 ? "服务暂时不可用，请重试" : err.message });
  });
  // Register the WebSocket plugin in a child scope before declaring the /ws
  // route. Declaring a `websocket: true` route before the plugin is ready makes
  // Fastify treat it as a normal HTTP handler, so the handler receives a
  // FastifyRequest instead of a WebSocket and fails with `socket.on is not a
  // function` during the upgrade.

  // Serve static frontend files (CSS, JS, images)
  app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
    index: false,
    list: false,
  });

  // HTML pages
  app.get("/", async (_request, reply) => reply.sendFile("index.html"));
  app.get("/app", async (_request, reply) => reply.sendFile("app.html"));
  app.get("/admin", async (_request, reply) => reply.sendFile("admin.html"));
  app.get("/health", async () => ({ status: "ok" }));

  // Legacy demo
  app.register(demoRoutes);

  // API routes
  app.register(authRoutes);
  app.register(adminRoutes);
  app.register(arenaRoutes);
  app.register(problemRoutes);
  app.register(matchRoutes);
  app.register(progressionRoutes);
  app.register(classRoutes);
  app.register(parentRoutes);
  app.register(rankingRoutes);
  app.register(roomRoutes);
  app.register(friendsRoutes);
  app.register(chatRoutes);
  app.register(gameRequestRoutes);
  app.register(ttsRoutes);
  app.register(trialRoutes);

  // WebSocket handler. The plugin must be loaded before registerWebSocket adds
  // the route; awaiting the registration also preserves the existing root API
  // routes and their middleware.
  app.register(async (wsApp) => {
    await wsApp.register(websocket);
    await registerWebSocket(wsApp);
  });

  return app;
};
