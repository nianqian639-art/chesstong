import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { db } from "../services/db.js";
import { requireUserId } from "../services/common.js";

const sendBody = z.object({
  toUserId: z.string().min(1),
  message: z.string().trim().min(1).max(2000),
});

const bannedWords = ["政治敏感", "暴力鼓动", "不良引导"];

export const chatRoutes: FastifyPluginAsync = async (app) => {
  // ── Send Chat Message ────────────────────────────────────────
  // HTTP fallback keeps messages reliable when the live WebSocket is reconnecting.
  app.post("/chat/send", { preHandler: [authGuard] }, async (request, reply) => {
    const userId = requireUserId(request);
    const body = sendBody.parse(request.body);
    if (body.toUserId === userId) {
      return reply.code(400).send({ message: "不能给自己发消息" });
    }

    const isFriend = db.friendRelations.some(
      (r) => r.status === "accepted" &&
        ((r.fromUserId === userId && r.toUserId === body.toUserId) ||
          (r.fromUserId === body.toUserId && r.toUserId === userId))
    );
    if (!isFriend) return reply.code(403).send({ message: "只能给好友发消息" });
    if (bannedWords.some((word) => body.message.includes(word))) {
      return reply.code(400).send({ message: "消息包含不当内容" });
    }

    const msg = {
      id: crypto.randomUUID(),
      fromUserId: userId,
      toUserId: body.toUserId,
      message: body.message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    db.chatMessages.push(msg);
    return { message: { ...msg, outgoing: true } };
  });

  // ── Chat History ──────────────────────────────────────────────
  app.get("/chat/history/:friendId", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);
    const { friendId } = request.params as { friendId: string };

    const messages = db.chatMessages
      .filter(
        (m) =>
          (m.fromUserId === userId && m.toUserId === friendId) ||
          (m.fromUserId === friendId && m.toUserId === userId)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-100)
      .map((m) => ({
        id: m.id,
        fromUserId: m.fromUserId,
        toUserId: m.toUserId,
        message: m.message,
        createdAt: m.createdAt,
        outgoing: m.fromUserId === userId,
      }));

    // Mark messages as read
    db.chatMessages.forEach((m) => {
      if (m.fromUserId === friendId && m.toUserId === userId && !m.read) {
        m.read = true;
      }
    });

    return { messages };
  });

  // ── Unread Counts ─────────────────────────────────────────────
  app.get("/chat/unread", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);

    const unreadByFriend: Record<string, number> = {};
    db.chatMessages
      .filter((m) => m.toUserId === userId && !m.read)
      .forEach((m) => {
        unreadByFriend[m.fromUserId] = (unreadByFriend[m.fromUserId] || 0) + 1;
      });

    const total = Object.values(unreadByFriend).reduce((a, b) => a + b, 0);

    return { total, byFriend: unreadByFriend };
  });
};
