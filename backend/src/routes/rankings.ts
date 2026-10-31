import { FastifyPluginAsync } from "fastify";
import { authGuard } from "../middleware/auth.js";
import { db, getRank } from "../services/db.js";
import { requireUserId } from "../services/common.js";

export const rankingRoutes: FastifyPluginAsync = async (app) => {
  const winLossStats = (userId: string) => {
    const userMatches = db.matches.filter((m) => m.userId === userId && (!m.fen || !!m.finishedAt));
    return {
      wins: userMatches.filter((m) => m.result === "win").length,
      losses: userMatches.filter((m) => m.result === "lose").length,
      draws: userMatches.filter((m) => m.result === "draw").length,
      totalGames: userMatches.length,
    };
  };

  app.get("/rankings/global", { preHandler: [authGuard] }, async () => {
    const ranking = [...db.users]
      .sort((a, b) => b.points - a.points)
      .slice(0, 100)
      .map((user, index) => {
        const rank = getRank(user.points);
        return {
          rank: index + 1,
          userId: user.id,
          name: user.displayName,
          role: user.role,
          points: user.points,
          rankTitle: rank.piece + " " + rank.title,
          rankPiece: rank.piece,
          rankName: rank.title,
          ...winLossStats(user.id),
        };
      });

    return { items: ranking };
  });

  app.get("/rankings/class", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);
    const me = db.users.find((u) => u.id === userId);
    const classId = me?.classIds[0];

    const ranking = db.users
      .filter((u) => (classId ? u.classIds.includes(classId) : true))
      .sort((a, b) => b.points - a.points)
      .slice(0, 100)
      .map((user, index) => {
        const rank = getRank(user.points);
        return {
          rank: index + 1,
          userId: user.id,
          name: user.displayName,
          role: user.role,
          points: user.points,
          rankTitle: rank.piece + " " + rank.title,
          rankPiece: rank.piece,
          rankName: rank.title,
          ...winLossStats(user.id),
        };
      });

    return { classId: classId ?? "all", items: ranking };
  });

  // ── 做题榜 (Puzzle Ranking) ─────────────────────────────────

  app.get("/rankings/puzzle", { preHandler: [authGuard] }, async () => {
    const ranking = [...db.users]
      .map((user) => {
        const solved = new Set(
          db.attempts.filter((a) => a.userId === user.id && a.isCorrect).map((a) => a.problemId)
        ).size;
        const total = db.attempts.filter((a) => a.userId === user.id).length;
        const correct = db.attempts.filter((a) => a.userId === user.id && a.isCorrect).length;
        const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) + "%" : "0%";
        return { user, solved, total, accuracy };
      })
      .sort((a, b) => b.solved - a.solved)
      .slice(0, 50)
      .map((item, index) => {
        const rank = getRank(item.user.points);
        return {
          rank: index + 1,
          userId: item.user.id,
          name: item.user.displayName,
          solved: item.solved,
          total: item.total,
          accuracy: item.accuracy,
          rankTitle: rank.piece + " " + rank.title,
        };
      });

    return { items: ranking };
  });

  // ── 对战榜 (Battle Ranking) ─────────────────────────────────

  app.get("/rankings/battle", { preHandler: [authGuard] }, async () => {
    const ranking = [...db.users]
      .map((user) => {
        const all = db.matches.filter((m) => m.userId === user.id && (!m.fen || !!m.finishedAt));
        const wins = all.filter((m) => m.result === "win").length;
        const losses = all.filter((m) => m.result === "lose").length;
        const draws = all.filter((m) => m.result === "draw").length;
        const total = wins + losses + draws;
        const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) + "%" : "0%";
        return { user, wins, losses, draws, total, winRate };
      })
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 50)
      .map((item, index) => {
        const rank = getRank(item.user.points);
        return {
          rank: index + 1,
          userId: item.user.id,
          name: item.user.displayName,
          wins: item.wins,
          losses: item.losses,
          draws: item.draws,
          total: item.total,
          winRate: item.winRate,
          rankTitle: rank.piece + " " + rank.title,
        };
      });

    return { items: ranking };
  });
};
