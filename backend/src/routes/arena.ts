import { FastifyPluginAsync } from "fastify";
import { Chess } from "chess.js";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { db } from "../services/db.js";
import { getUserById, nowIso, requireUserId } from "../services/common.js";

const controls = ["1+0", "3+2", "5+3", "10+0", "15+10", "30+10", "120+15"];
const joinBody = z.object({ timeControl: z.object({ initialMinutes: z.number().int(), incrementSeconds: z.number().int() }).default({ initialMinutes: 10, incrementSeconds: 0 }) });
const participant = (r: typeof db.gameRooms[number], id: string) => r.players.white?.userId === id || r.players.black?.userId === id;

export const arenaRoutes: FastifyPluginAsync = async (app) => {
  const queue = new Map<string, { key: string; seenAt: number }>();
  const clean = () => {
    for (const [id, entry] of queue) if (Date.now() - entry.seenAt > 45000 || db.gameRooms.some(r => r.status !== "finished" && participant(r, id))) queue.delete(id);
  };
  const status = (id: string) => {
    const room = db.gameRooms.find(r => r.id.startsWith("arena-") && r.status !== "finished" && participant(r, id));
    if (room) return { matched: true, inQueue: false, roomId: room.id, roomNumber: room.roomNumber, yourColor: room.players.white?.userId === id ? "white" : "black", timeControl: room.timeControl };
    const entry = queue.get(id);
    return { matched: false, inQueue: !!entry, queueSize: queue.size, queuePosition: entry ? [...queue].filter(([, e]) => e.key === entry.key).findIndex(([uid]) => uid === id) + 1 : 0, time: entry?.key || null };
  };
  app.post("/arena/join", { preHandler: [authGuard] }, async (request, reply) => {
    const id = requireUserId(request);
    if (!getUserById(id)) return reply.code(404).send({ message: "用户不存在" });
    const { timeControl } = joinBody.parse(request.body ?? {});
    const key = `${timeControl.initialMinutes}+${timeControl.incrementSeconds}`;
    if (!controls.includes(key)) return reply.code(400).send({ message: "请选择有效的对战用时" });
    clean();
    if (status(id).matched) return status(id);
    if (db.gameRooms.some(r => r.status !== "finished" && participant(r, id))) return reply.code(409).send({ message: "请先退出已有对局" });
    if (queue.has(id)) { queue.get(id)!.seenAt = Date.now(); return status(id); }
    const opponent = [...queue].find(([, e]) => e.key === key)?.[0];
    if (!opponent) { queue.set(id, { key, seenAt: Date.now() }); return status(id); }
    queue.delete(opponent);
    let roomNumber: string;
    do { roomNumber = String(Math.floor(100000 + Math.random() * 900000)); } while (db.gameRooms.some(r => r.roomNumber === roomNumber && r.status !== "finished"));
    const [white, black] = Math.random() < 0.5 ? [opponent, id] : [id, opponent];
    const totalMs = timeControl.initialMinutes * 60000;
    db.gameRooms.push({ id: `arena-${crypto.randomUUID()}`, roomNumber, creatorId: opponent, timeControl,
      players: { white: { userId: white, timeRemainingMs: totalMs }, black: { userId: black, timeRemainingMs: totalMs } },
      fen: new Chess().fen(), pgn: "", turn: "w", status: "playing", result: null, drawOfferFrom: null,
      lastMoveTimestamp: nowIso(), createdAt: nowIso() });
    return status(id);
  });
  app.post("/arena/leave", { preHandler: [authGuard] }, async request => {
    const id = requireUserId(request); queue.delete(id);
    return { left: true, ...status(id) };
  });
  app.get("/arena/status", { preHandler: [authGuard] }, async request => {
    const id = requireUserId(request); clean();
    if (queue.has(id)) queue.get(id)!.seenAt = Date.now();
    return status(id);
  });
  app.get("/arena/stats", { preHandler: [authGuard] }, async () => {
    const games = db.gameRooms.filter(r => r.id.startsWith("arena-") && r.status === "finished" && r.result);
    const scores = new Map<string, { userId: string; name: string; wins: number; losses: number; draws: number; totalGames: number }>();
    for (const room of games) for (const color of ["white", "black"] as const) {
      const id = room.players[color]?.userId; const user = id && getUserById(id); if (!id || !user) continue;
      const stat = scores.get(id) || { userId: id, name: user.displayName, wins: 0, losses: 0, draws: 0, totalGames: 0 };
      stat.totalGames++; if (room.result === "draw") stat.draws++; else if (room.result === color) stat.wins++; else stat.losses++;
      scores.set(id, stat);
    }
    return { items: [...scores.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.userId.localeCompare(b.userId)).slice(0, 50).map((s, i) => ({ ...s, rank: i + 1, winRate: (100 * s.wins / s.totalGames).toFixed(1) + "%" })) };
  });
};
