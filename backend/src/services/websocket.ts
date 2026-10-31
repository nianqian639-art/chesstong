import { FastifyInstance } from "fastify";
import { Chess } from "chess.js";
import { awardPvpPoints, db } from "./db.js";
import type { GameRoom } from "../models/types.js";

// ── Types ─────────────────────────────────────────────────────────

interface WsMessage {
  type: string;
  payload?: Record<string, unknown>;
}

// ── Connection State ──────────────────────────────────────────────

/** userId -> WebSocket (only one active connection per user) */
const connections = new Map<string, WebSocket>();

/** roomId -> Set of userId currently in the room */
const roomClients = new Map<string, Set<string>>();

/** userId -> NodeJS.Timeout for disconnect forfeit */
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DISCONNECT_GRACE_MS = 60_000; // 60 seconds to reconnect
const CLOCK_TICK_MS = 1000; // broadcast clock every second
const clockIntervals = new Map<string, ReturnType<typeof setInterval>>();

// ── Chat limits ───────────────────────────────────────────────────

const CHAT_MESSAGE_MAX_LENGTH = 2000;
const chatBannedWords = ["政治敏感", "暴力鼓动", "不良引导"];

// ── Helpers ───────────────────────────────────────────────────────

function send(ws: WebSocket, msg: WsMessage): void {
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  } catch {
    // socket may not be ready
  }
}

function broadcastToRoom(roomId: string, msg: WsMessage): void {
  const members = roomClients.get(roomId);
  if (!members) return;
  for (const uid of members) {
    const ws = connections.get(uid);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function sendToUser(userId: string, msg: WsMessage): void {
  const ws = connections.get(userId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function roomStateMessage(room: typeof db.gameRooms[number]): WsMessage {
  const whiteName = room.players.white
    ? db.users.find((u) => u.id === room.players.white!.userId)?.displayName ?? "白方"
    : "等待中";
  const blackName = room.players.black
    ? db.users.find((u) => u.id === room.players.black!.userId)?.displayName ?? "黑方"
    : "等待中";
  return {
    type: "game_state",
    payload: {
      roomId: room.id,
      roomNumber: room.roomNumber,
      fen: room.fen,
      pgn: room.pgn,
      turn: room.turn,
      status: room.status,
      result: room.result,
      resultReason: room.resultReason,
      white: { userId: room.players.white?.userId ?? null, name: whiteName, timeRemainingMs: room.players.white?.timeRemainingMs ?? 0 },
      black: { userId: room.players.black?.userId ?? null, name: blackName, timeRemainingMs: room.players.black?.timeRemainingMs ?? 0 },
      timeControl: room.timeControl,
      drawOfferFrom: room.drawOfferFrom,
    },
  };
}

function generateRoomNumber(): string {
  // 6-digit numeric room code
  while (true) {
    const num = String(Math.floor(100000 + Math.random() * 900000));
    if (!db.gameRooms.some((r) => r.roomNumber === num && r.status !== "finished")) {
      return num;
    }
  }
}

// ── Validate session ──────────────────────────────────────────────

function validateToken(token: string): { userId: string } | null {
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) return null;
  return { userId: session.userId };
}

// ── Clock Management ──────────────────────────────────────────────

function startClock(roomId: string): void {
  stopClock(roomId);
  const room = db.gameRooms.find((r) => r.id === roomId);
  if (!room || room.status !== "playing") return;

  const interval = setInterval(() => {
    const r = db.gameRooms.find((x) => x.id === roomId);
    if (!r || r.status !== "playing") {
      stopClock(roomId);
      return;
    }

    const now = Date.now();
    const lastMove = new Date(r.lastMoveTimestamp).getTime();
    const elapsed = Math.max(0, now - lastMove);

    // Update the active player's remaining time
    const activePlayer = r.turn === "w" ? r.players.white : r.players.black;
    if (activePlayer) {
      activePlayer.timeRemainingMs = Math.max(0, activePlayer.timeRemainingMs - elapsed);
      // Moves deduct only time since this tick, avoiding a second deduction
      // of the same thinking time when adding the per-move increment.
      r.lastMoveTimestamp = new Date(now).toISOString();
    }

    // Broadcast clock tick
    broadcastToRoom(roomId, {
      type: "clock_tick",
      payload: {
        whiteTimeMs: r.players.white?.timeRemainingMs ?? 0,
        blackTimeMs: r.players.black?.timeRemainingMs ?? 0,
        turn: r.turn,
      },
    });

    // Check timeout
    if (activePlayer && activePlayer.timeRemainingMs <= 0) {
      stopClock(roomId);
      handleTimeout(roomId, r.turn);
    }
  }, CLOCK_TICK_MS);

  clockIntervals.set(roomId, interval);
}

function stopClock(roomId: string): void {
  const existing = clockIntervals.get(roomId);
  if (existing) {
    clearInterval(existing);
    clockIntervals.delete(roomId);
  }
}

function handleTimeout(roomId: string, timedOutColor: "w" | "b"): void {
  const room = db.gameRooms.find((r) => r.id === roomId);
  if (room) finishGame(room, timedOutColor === "w" ? "black" : "white", "timeout");
}

// ── Game Logic ────────────────────────────────────────────────────

function finishGame(room: GameRoom, result: NonNullable<GameRoom["result"]>, reason: NonNullable<GameRoom["resultReason"]>): void {
  if (room.status !== "playing") return;
  room.status = "finished";
  room.result = result;
  room.resultReason = reason;
  room.drawOfferFrom = null;
  stopClock(room.id);

  const finishedAt = new Date().toISOString();
  for (const color of ["white", "black"] as const) {
    const player = room.players[color];
    if (!player) continue;
    db.matches.push({
      id: crypto.randomUUID(), userId: player.userId, mode: "standard", difficulty: 10,
      fen: room.fen, pgn: room.pgn,
      result: result === "draw" ? "draw" : result === color ? "win" : "lose",
      createdAt: finishedAt, finishedAt,
    });
  }
  const pointsReason = { checkmate: "将杀", stalemate: "逼和", draw: "和棋", resign: "认输", timeout: "超时", disconnect: "断线超时" }[reason];
  awardPvpPoints(room.players.white?.userId, room.players.black?.userId, result, pointsReason);

  // Every ending saves both players' records and delivers the final board first.
  broadcastToRoom(room.id, roomStateMessage(room));
  broadcastToRoom(room.id, {
    type: "game_over",
    payload: { roomId: room.id, result, reason, fen: room.fen, pgn: room.pgn },
  });
  cleanupRoom(room.id);
}

function handleMove(userId: string, payload: Record<string, unknown>): void {
  const roomId = payload.roomId as string;
  const san = payload.move as string;

  const room = db.gameRooms.find((r) => r.id === roomId);
  if (!room) {
    sendToUser(userId, { type: "error", payload: { message: "房间不存在" } });
    return;
  }
  if (room.status !== "playing") {
    sendToUser(userId, { type: "error", payload: { message: "游戏未在进行中" } });
    return;
  }

  // Determine player color
  const isWhite = room.players.white?.userId === userId;
  const isBlack = room.players.black?.userId === userId;
  if (!isWhite && !isBlack) {
    sendToUser(userId, { type: "error", payload: { message: "你不是本局的玩家" } });
    return;
  }
  const playerColor = isWhite ? "w" : "b";

  // Check it's this player's turn
  if (room.turn !== playerColor) {
    sendToUser(userId, { type: "error", payload: { message: "还没轮到你走棋" } });
    return;
  }

  // Validate move with chess.js
  const chess = new Chess(room.fen);
  // Restore the complete game, including repetition history, after each move
  // and after a reconnect/server restart. Older rooms may have partial PGNs.
  if (room.pgn) {
    try {
      const history = new Chess();
      history.loadPgn(room.pgn);
      if (history.fen() === room.fen) chess.loadPgn(room.pgn);
    } catch { /* The persisted FEN remains authoritative for legacy rooms. */ }
  }
  let moveResult: ReturnType<typeof chess.move>;
  try {
    moveResult = chess.move(san);
  } catch {
    sendToUser(userId, { type: "error", payload: { message: "无效的走法" } });
    return;
  }

  if (!moveResult) {
    sendToUser(userId, { type: "error", payload: { message: "不合法的走法" } });
    return;
  }

  // Calculate time: deduct elapsed, add increment
  const now = Date.now();
  const lastMove = new Date(room.lastMoveTimestamp).getTime();
  const elapsed = now - lastMove;

  const activePlayer = playerColor === "w" ? room.players.white : room.players.black;
  if (activePlayer) {
    activePlayer.timeRemainingMs = Math.max(0, activePlayer.timeRemainingMs - elapsed);
    if (activePlayer.timeRemainingMs <= 0) {
      handleTimeout(roomId, playerColor as "w" | "b");
      return;
    }
    activePlayer.timeRemainingMs += room.timeControl.incrementSeconds * 1000;
  }

  // Update room state
  room.fen = chess.fen();
  room.pgn = chess.pgn();
  room.turn = room.turn === "w" ? "b" : "w";
  room.lastMoveTimestamp = new Date().toISOString();
  room.drawOfferFrom = null; // any move cancels draw offer

  // Check for game end
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      finishGame(room, playerColor === "w" ? "white" : "black", "checkmate");
    } else if (chess.isStalemate()) {
      finishGame(room, "draw", "stalemate");
    } else {
      finishGame(room, "draw", "draw");
    }
    return;
  }

  // Broadcast updated game state
  broadcastToRoom(roomId, roomStateMessage(room));
  room.lastMoveTimestamp = new Date().toISOString();
}

export function handleResign(userId: string, payload: Record<string, unknown>): void {
  const roomId = payload.roomId as string;
  const room = db.gameRooms.find((r) => r.id === roomId);
  if (!room || room.status !== "playing") return;

  const isWhite = room.players.white?.userId === userId;
  const isBlack = room.players.black?.userId === userId;
  if (!isWhite && !isBlack) return;

  finishGame(room, isWhite ? "black" : "white", "resign");
}

export function handleDrawOffer(userId: string, payload: Record<string, unknown>): void {
  const roomId = payload.roomId as string;
  const action = (payload.action as string) || "offer";
  const room = db.gameRooms.find((r) => r.id === roomId);
  if (!room || room.status !== "playing") return;

  const isWhite = room.players.white?.userId === userId;
  const isBlack = room.players.black?.userId === userId;
  if (!isWhite && !isBlack) return;

  const opponentId = isWhite ? room.players.black?.userId : room.players.white?.userId;

  if (action === "offer") {
    if (room.drawOfferFrom && room.drawOfferFrom !== userId) return;
    room.drawOfferFrom = userId;
    sendToUser(userId, { type: "draw_offer_sent", payload: { roomId } });
    if (opponentId) {
      const userName = db.users.find((u) => u.id === userId)?.displayName ?? "对手";
      sendToUser(opponentId, {
        type: "draw_offered",
        payload: { roomId, fromUserId: userId, fromName: userName },
      });
    }
    broadcastToRoom(roomId, roomStateMessage(room));
  } else if (action === "accept") {
    if (room.drawOfferFrom && room.drawOfferFrom !== userId) {
      finishGame(room, "draw", "draw");
    }
  } else if (action === "reject") {
    if (!room.drawOfferFrom || room.drawOfferFrom === userId) return;
    room.drawOfferFrom = null;
    broadcastToRoom(roomId, { type: "draw_rejected", payload: { roomId } });
    broadcastToRoom(roomId, roomStateMessage(room));
  }
}

// ── Chat ──────────────────────────────────────────────────────────

function handleChatSend(userId: string, payload: Record<string, unknown>): void {
  const toUserId = typeof payload.toUserId === "string" ? payload.toUserId : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!toUserId || !message) return;
  const isFriend = db.friendRelations.some(r => r.status === "accepted" &&
    ((r.fromUserId === userId && r.toUserId === toUserId) ||
      (r.fromUserId === toUserId && r.toUserId === userId)));
  if (toUserId === userId || !isFriend) {
    sendToUser(userId, { type: "error", payload: { message: "只能给好友发消息" } });
    return;
  }
  if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
    sendToUser(userId, { type: "error", payload: { message: `消息不能超过${CHAT_MESSAGE_MAX_LENGTH}个字符` } });
    return;
  }
  if (chatBannedWords.some((w) => message.includes(w))) {
    sendToUser(userId, { type: "error", payload: { message: "消息包含不当内容" } });
    return;
  }

  const msg = {
    id: crypto.randomUUID(),
    fromUserId: userId,
    toUserId,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.chatMessages.push(msg);

  const fromUser = db.users.find((u) => u.id === userId);

  sendToUser(userId, {
    type: "chat_receive",
    payload: {
      id: msg.id,
      fromUserId: userId,
      fromName: fromUser?.displayName ?? "我",
      toUserId,
      message,
      createdAt: msg.createdAt,
      outgoing: true,
    },
  });

  sendToUser(toUserId, {
    type: "chat_receive",
    payload: {
      id: msg.id,
      fromUserId: userId,
      fromName: fromUser?.displayName ?? "未知",
      toUserId,
      message,
      createdAt: msg.createdAt,
      outgoing: false,
    },
  });
}

// ── Room Cleanup ──────────────────────────────────────────────────

function cleanupRoom(roomId: string): void {
  stopClock(roomId);
  roomClients.delete(roomId);
}

// Called after the HTTP route verifies membership and explicit resignation.
export function leavePvpRoom(userId: string, roomId: string): void {
  const room = db.gameRooms.find(r => r.id === roomId);
  if (!room) return;
  if (room.status === "playing") handleResign(userId, { roomId });
  else if (room.status === "waiting") {
    room.status = "finished";
    cleanupRoom(roomId);
  }
  roomClients.get(roomId)?.delete(userId);
  const timer = disconnectTimers.get(userId);
  if (timer) clearTimeout(timer);
  disconnectTimers.delete(userId);
}

// ── Connection setup ──────────────────────────────────────────────

function setupConnection(userId: string, socket: WebSocket, app: FastifyInstance): void {
  const existingTimer = disconnectTimers.get(userId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    disconnectTimers.delete(userId);
  }

  const oldWs = connections.get(userId);
  if (oldWs && oldWs !== socket) {
    try { oldWs.close(); } catch { /* ignore */ }
  }
  connections.set(userId, socket);

  for (const [roomId, members] of roomClients) {
    if (members.has(userId)) {
      const room = db.gameRooms.find((r) => r.id === roomId);
      if (room && room.status === "playing") {
        send(socket, roomStateMessage(room));
      }
    }
  }
}

// ── Main WebSocket Handler ────────────────────────────────────────

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  app.get("/ws", { websocket: true }, (socket, req) => {
    let userId: string | null = null;
    let sessionToken: string | null = null;

    // Pre-validate token from URL query parameter
    const url = new URL(req.url ?? "/", "http://localhost");
    const urlToken = url.searchParams.get("token");
    if (urlToken) {
      const result = validateToken(urlToken);
      if (result) {
        sessionToken = urlToken;
        userId = result.userId;
        setupConnection(userId, socket, app);
        send(socket, { type: "auth_ok", payload: { userId } });
        const user = db.users.find((u) => u.id === userId);
        app.log.info({ userId, userName: user?.displayName ?? userId }, "ws user connected");
      }
    }

    socket.on("message", (raw: Buffer) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: "error", payload: { message: "无效的 JSON" } });
        return;
      }

      // ── Auth (via message, for backward compat) ──────────
      if (msg.type === "auth") {
        const token = (msg.payload as Record<string, unknown>)?.token as string;
        if (!token) {
          send(socket, { type: "error", payload: { message: "缺少 token" } });
          return;
        }
        const result = validateToken(token);
        if (!result) {
          send(socket, { type: "error", payload: { message: "无效的 token" } });
          return;
        }
        if (userId && userId !== result.userId) {
          send(socket, { type: "error", payload: { message: "切换账号请重新连接" } });
          return;
        }
        sessionToken = token;
        userId = result.userId;
        setupConnection(userId, socket, app);
        send(socket, { type: "auth_ok", payload: { userId } });
        const user = db.users.find((u) => u.id === userId);
        app.log.info({ userId, userName: user?.displayName ?? userId }, "ws user connected");
        return;
      }

      // Require auth for all other messages
      if (!userId || !sessionToken || !validateToken(sessionToken)) {
        send(socket, { type: "error", payload: { message: "请先认证" } });
        return;
      }

      switch (msg.type) {
        case "move":
          handleMove(userId, msg.payload ?? {});
          break;
        case "resign":
          handleResign(userId, msg.payload ?? {});
          break;
        case "draw_offer":
          handleDrawOffer(userId, msg.payload ?? {});
          break;
        case "chat_send":
          handleChatSend(userId, msg.payload ?? {});
          break;
        case "join_room": {
          const roomId = (msg.payload as Record<string, unknown>)?.roomId as string;
          if (!roomId) return;
          const room = db.gameRooms.find((r) => r.id === roomId);
          if (!room) {
            send(socket, { type: "error", payload: { message: "房间不存在" } });
            return;
          }
          if (room.players.white?.userId !== userId && room.players.black?.userId !== userId) {
            send(socket, { type: "error", payload: { message: "你不是本局的玩家" } });
            return;
          }
          if (!roomClients.has(roomId)) {
            roomClients.set(roomId, new Set());
          }
          roomClients.get(roomId)!.add(userId);
          if (room.status === "waiting" && room.players.white && room.players.black) {
            room.status = "playing";
            room.lastMoveTimestamp = new Date().toISOString();
            broadcastToRoom(roomId, roomStateMessage(room));
            startClock(roomId);
          } else {
            // HTTP joining has already switched the room to playing. Notify
            // the waiting opponent as well as the player who just joined.
            broadcastToRoom(roomId, roomStateMessage(room));
            // Accepted friend challenges are already playing when the first
            // player joins the socket. Start their clock once, including after
            // a backend restart, without resetting it on every reconnect.
            if (room.status === "playing" && !clockIntervals.has(roomId)) startClock(roomId);
          }
          break;
        }
        case "ping":
          send(socket, { type: "pong", payload: {} });
          break;
        default:
          send(socket, { type: "error", payload: { message: `未知消息类型: ${msg.type}` } });
      }
    });

    socket.on("close", () => {
      if (!userId) return;
      // A newer tab or reconnect can replace this user's socket. Its old
      // close event must not start a forfeit timer for the active connection.
      if (connections.get(userId) !== socket) return;
      connections.delete(userId);

      const userName = db.users.find((u) => u.id === userId)?.displayName ?? userId;
      app.log.info({ userId, userName }, "ws user disconnected");

      for (const [roomId, members] of roomClients) {
        if (members.has(userId)) {
          const room = db.gameRooms.find((r) => r.id === roomId);
          if (room && room.status === "playing") {
            const isWhite: boolean = room.players.white?.userId === userId;
            const isBlack: boolean = room.players.black?.userId === userId;
            if (isWhite || isBlack) {
              const opponentColor: "white" | "black" = isWhite ? "black" : "white";
              const opponentId = room.players[opponentColor]?.userId;
              if (opponentId) {
                sendToUser(opponentId, {
                  type: "opponent_disconnected",
                  payload: {
                    message: "对手已断开连接，等待60秒重连...",
                    graceSeconds: 60,
                  },
                });
              }

              const timer = setTimeout(() => {
                finishGame(room, opponentColor, "disconnect");
                disconnectTimers.delete(userId!);
              }, DISCONNECT_GRACE_MS);
              disconnectTimers.set(userId, timer);
            }
          }
        }
      }
    });
  });
}
