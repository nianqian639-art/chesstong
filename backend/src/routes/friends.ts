import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { db } from "../services/db.js";
import { nowIso, requireUserId } from "../services/common.js";

const requestBody = z.object({
  toUserId: z.string().min(1),
});

const respondBody = z.object({
  requestId: z.string().min(1),
});

const normalizePhone = (value: string): string => value.replace(/\D/g, "").replace(/^86/, "");

export const friendsRoutes: FastifyPluginAsync = async (app) => {
  // ── Send Friend Request ───────────────────────────────────────
  app.post("/friends/request", { preHandler: [authGuard] }, async (request, reply) => {
    const body = requestBody.parse(request.body);
    const userId = requireUserId(request);
    if (body.toUserId === userId) {
      return reply.code(400).send({ message: "不能添加自己为好友" });
    }

    const target = db.users.find((u) => u.id === body.toUserId);
    if (!target) {
      return reply.code(404).send({ message: "用户不存在" });
    }

    // Check existing relation
    const existing = db.friendRelations.find(
      (r) =>
        (r.fromUserId === userId && r.toUserId === body.toUserId) ||
        (r.fromUserId === body.toUserId && r.toUserId === userId)
    );
    if (existing) {
      if (existing.status === "accepted") {
        return reply.code(400).send({ message: "已经是好友了" });
      }
      if (existing.status === "pending") {
        if (existing.fromUserId === userId) {
          return reply.code(400).send({ message: "已发送过好友请求" });
        }
        // The other party already sent a request — auto-accept
        existing.status = "accepted";
        return { accepted: true, message: "你们成为好友了！" };
      }
      // Previously rejected — allow retry
      existing.status = "pending";
      existing.fromUserId = userId;
      existing.toUserId = body.toUserId;
      existing.createdAt = nowIso();
      return { sent: true };
    }

    db.friendRelations.push({
      id: crypto.randomUUID(),
      fromUserId: userId,
      toUserId: body.toUserId,
      status: "pending",
      createdAt: nowIso(),
    });

    return { sent: true };
  });

  // ── Accept Friend Request ─────────────────────────────────────
  app.post("/friends/accept", { preHandler: [authGuard] }, async (request, reply) => {
    const body = respondBody.parse(request.body);
    const userId = requireUserId(request);

    const relation = db.friendRelations.find(
      (r) => r.id === body.requestId && r.toUserId === userId && r.status === "pending"
    );
    if (!relation) {
      return reply.code(404).send({ message: "请求不存在或已处理" });
    }

    relation.status = "accepted";
    return { accepted: true, message: "你们成为好友了！" };
  });

  // ── Reject Friend Request ─────────────────────────────────────
  app.post("/friends/reject", { preHandler: [authGuard] }, async (request, reply) => {
    const body = respondBody.parse(request.body);
    const userId = requireUserId(request);

    const relation = db.friendRelations.find(
      (r) => r.id === body.requestId && r.toUserId === userId && r.status === "pending"
    );
    if (!relation) {
      return reply.code(404).send({ message: "请求不存在或已处理" });
    }

    relation.status = "rejected";
    return { rejected: true };
  });

  // ── List Friends ──────────────────────────────────────────────
  app.get("/friends/list", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);

    const relations = db.friendRelations.filter(
      (r) =>
        r.status === "accepted" &&
        (r.fromUserId === userId || r.toUserId === userId)
    );

    const friends = relations.map((r) => {
      const friendId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
      const friend = db.users.find((u) => u.id === friendId);
      // Check for unread messages
      const unreadCount = db.chatMessages.filter(
        (m) => m.fromUserId === friendId && m.toUserId === userId && !m.read
      ).length;
      return {
        relationId: r.id,
        userId: friendId,
        displayName: friend?.displayName ?? "未知",
        level: friend?.level ?? 1,
        points: friend?.points ?? 0,
        unreadCount,
        friendSince: r.createdAt,
      };
    });

    return { friends };
  });

  // ── Pending Friend Requests ───────────────────────────────────
  app.get("/friends/requests", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);

    const incoming = db.friendRelations
      .filter((r) => r.toUserId === userId && r.status === "pending")
      .map((r) => {
        const fromUser = db.users.find((u) => u.id === r.fromUserId);
        return {
          requestId: r.id,
          userId: r.fromUserId,
          displayName: fromUser?.displayName ?? "未知",
          level: fromUser?.level ?? 1,
          createdAt: r.createdAt,
        };
      });

    const outgoing = db.friendRelations
      .filter((r) => r.fromUserId === userId && r.status === "pending")
      .map((r) => {
        const toUser = db.users.find((u) => u.id === r.toUserId);
        return {
          requestId: r.id,
          userId: r.toUserId,
          displayName: toUser?.displayName ?? "未知",
          createdAt: r.createdAt,
        };
      });

    return { incoming, outgoing };
  });

  // ── Search Users ──────────────────────────────────────────────
  app.get("/friends/search", {
    preHandler: [authGuard],
    schema: {
      querystring: {
        type: "object",
        properties: { q: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    const query = q?.trim();
    if (!query) return reply.code(400).send({ message: "请输入搜索关键词" });

    const userId = requireUserId(request);
    const results = db.users
      .filter((u) => {
        if (u.id === userId) return false;
        const q = query.toLowerCase();
        const phone = normalizePhone(u.phone || "");
        const queryPhone = normalizePhone(query);
        return (
          String(u.username || "").toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          (queryPhone.length >= 3 && phone.includes(queryPhone))
        );
      })
      .slice(0, 20)
      .map((u) => {
        const isFriend = db.friendRelations.some(
          (r) =>
            r.status === "accepted" &&
            ((r.fromUserId === userId && r.toUserId === u.id) ||
              (r.fromUserId === u.id && r.toUserId === userId))
        );
        const pendingSent = db.friendRelations.some(
          (r) => r.fromUserId === userId && r.toUserId === u.id && r.status === "pending"
        );
        const pendingIncoming = db.friendRelations.find(
          (r) => r.fromUserId === u.id && r.toUserId === userId && r.status === "pending"
        );
        return {
          userId: u.id,
          displayName: u.displayName,
          level: u.level,
          points: u.points,
          isFriend,
          pendingSent,
          pendingIncoming: Boolean(pendingIncoming),
          pendingRequestId: pendingIncoming?.id ?? null,
        };
      });

    return { results };
  });
};
