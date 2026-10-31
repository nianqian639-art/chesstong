import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Chess } from "chess.js";
import { authGuard } from "../middleware/auth.js";
import { db } from "../services/db.js";
import { nowIso, requireUserId } from "../services/common.js";

const sendBody = z.object({
  toUserId: z.string().min(1),
  timeControl: z.object({
    initialMinutes: z.number().min(0).max(120),
    incrementSeconds: z.number().min(0).max(300),
  }),
});

function generateRoomNumber(): string {
  while (true) {
    const num = String(Math.floor(100000 + Math.random() * 900000));
    if (!db.gameRooms.some((r) => r.roomNumber === num && r.status !== "finished")) {
      return num;
    }
  }
}

export const gameRequestRoutes: FastifyPluginAsync = async (app) => {
  // ── Send Game Request ─────────────────────────────────────────
  app.post("/game-request/send", { preHandler: [authGuard] }, async (request, reply) => {
    const body = sendBody.parse(request.body);
    const userId = requireUserId(request);

    if (body.toUserId === userId) {
      return reply.code(400).send({ message: "不能向自己发送对局请求" });
    }

    const target = db.users.find((u) => u.id === body.toUserId);
    if (!target) return reply.code(404).send({ message: "用户不存在" });

    // Check if target is a friend
    const isFriend = db.friendRelations.some(
      (r) =>
        r.status === "accepted" &&
        ((r.fromUserId === userId && r.toUserId === body.toUserId) ||
          (r.fromUserId === body.toUserId && r.toUserId === userId))
    );
    if (!isFriend) {
      return reply.code(400).send({ message: "只能向好友发送对局请求" });
    }

    // Expire old pending requests between these two
    db.gameRequests.forEach((gr) => {
      if (
        gr.status === "pending" &&
        ((gr.fromUserId === userId && gr.toUserId === body.toUserId) ||
          (gr.fromUserId === body.toUserId && gr.toUserId === userId))
      ) {
        gr.status = "expired";
      }
    });

    const gr = {
      id: crypto.randomUUID(),
      fromUserId: userId,
      toUserId: body.toUserId,
      timeControl: body.timeControl,
      status: "pending" as const,
      createdAt: nowIso(),
    };
    db.gameRequests.push(gr);

    return { requestId: gr.id, sent: true };
  });

  // ── Accept Game Request ───────────────────────────────────────
  app.post("/game-request/:id/accept", { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = requireUserId(request);

    const gr = db.gameRequests.find(
      (r) => r.id === id && r.toUserId === userId && r.status === "pending"
    );
    if (!gr) return reply.code(404).send({ message: "请求不存在或已处理" });

    gr.status = "accepted";

    // Auto-create a game room
    const chess = new Chess();
    const roomNumber = generateRoomNumber();
    const totalMs = gr.timeControl.initialMinutes * 60 * 1000;

    const room = {
      id: crypto.randomUUID(),
      roomNumber,
      creatorId: gr.fromUserId,
      timeControl: gr.timeControl,
      players: {
        white: { userId: gr.fromUserId, timeRemainingMs: totalMs },
        black: { userId: gr.toUserId, timeRemainingMs: totalMs },
      } as { white: { userId: string; timeRemainingMs: number }; black: { userId: string; timeRemainingMs: number } },
      fen: chess.fen(),
      pgn: "",
      turn: "w" as const,
      status: "playing" as const,
      result: null,
      drawOfferFrom: null,
      lastMoveTimestamp: nowIso(),
      createdAt: nowIso(),
    };

    db.gameRooms.push(room);
    gr.roomId = room.id;

    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      timeControl: room.timeControl,
    };
  });

  // ── Decline Game Request ──────────────────────────────────────
  app.post("/game-request/:id/decline", { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = requireUserId(request);

    const gr = db.gameRequests.find(
      (r) => r.id === id && r.toUserId === userId && r.status === "pending"
    );
    if (!gr) return reply.code(404).send({ message: "请求不存在或已处理" });

    gr.status = "declined";
    return { declined: true };
  });

  // ── Incoming Requests ─────────────────────────────────────────
  app.get("/game-request/incoming", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);

    const incoming = db.gameRequests
      .filter((r) => r.toUserId === userId && r.status === "pending")
      .map((r) => {
        const fromUser = db.users.find((u) => u.id === r.fromUserId);
        return {
          requestId: r.id,
          fromUserId: r.fromUserId,
          fromName: fromUser?.displayName ?? "未知",
          fromLevel: fromUser?.level ?? 1,
          timeControl: r.timeControl,
          createdAt: r.createdAt,
        };
      });

    return { requests: incoming };
  });

  // ── Outgoing Requests ─────────────────────────────────────────
  app.get("/game-request/outgoing", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);

    const outgoing = db.gameRequests
      .filter((r) => r.fromUserId === userId && (r.status === "pending" || r.status === "accepted"))
      .map((r) => {
        const toUser = db.users.find((u) => u.id === r.toUserId);
        const room = r.roomId ? db.gameRooms.find((item) => item.id === r.roomId) : undefined;
        return {
          requestId: r.id,
          toUserId: r.toUserId,
          toName: toUser?.displayName ?? "未知",
          timeControl: r.timeControl,
          status: r.status,
          roomId: r.roomId,
          roomNumber: room?.roomNumber,
          createdAt: r.createdAt,
        };
      });

    return { requests: outgoing };
  });
};
