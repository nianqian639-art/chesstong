import { FastifyPluginAsync } from "fastify";

// Full-site records are available only through the restricted device reader,
// never via a normal account session (including a former admin phone number).
export const adminRoutes: FastifyPluginAsync = async (app) => {
  const deny = async (_request: unknown, reply: any) => reply
    .header("Cache-Control", "no-store")
    .code(403)
    .send({ message: "全站数据仅可通过已授权电脑上的“棋童数据管理”入口查看。" });
  app.get("/admin/overview", deny);
  app.get("/admin/ai-status", deny);
};
