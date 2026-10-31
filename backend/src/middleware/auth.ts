import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../services/db.js";

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
}

const isSessionExpired = (session: { expiresAt?: string | null }): boolean => {
  if (!session.expiresAt) return false;
  return new Date(session.expiresAt).getTime() < Date.now();
};

export const authGuard = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ message: "缺少认证信息" });
    return;
  }
  const token = header.replace("Bearer ", "").trim();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) {
    reply.code(401).send({ message: "登录状态无效" });
    return;
  }
  if (isSessionExpired(session)) {
    // Remove expired session
    const idx = db.sessions.findIndex((s) => s.token === token);
    if (idx >= 0) db.sessions.splice(idx, 1);
    reply.code(401).send({ message: "登录已过期，请重新登录" });
    return;
  }
  (request as AuthenticatedRequest).userId = session.userId;
};

/** Clean up all expired sessions — call periodically or on startup */
export const cleanupExpiredSessions = (): number => {
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => !isSessionExpired(s));
  return before - db.sessions.length;
};
