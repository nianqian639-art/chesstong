import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { addPoints, db, today } from "../services/db.js";
import { getUserById, nowIso, requireUserId } from "../services/common.js";

const claimBody = z.object({
  missionId: z.string()
});

const redeemBody = z.object({
  itemId: z.string()
});

const solvedProblemCountForDate = (userId: string, date: string): number => {
  return new Set(
    db.attempts
      .filter((attempt) => attempt.userId === userId && attempt.isCorrect && attempt.submittedAt.startsWith(date))
      .map((attempt) => attempt.problemId)
  ).size;
};

export const progressionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/missions/today", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);
    const date = today();
    const solveCount = solvedProblemCountForDate(userId, date);
    const battleCount = db.matches.filter((m) => m.userId === userId && (!m.fen || !!m.finishedAt) && m.createdAt.startsWith(date)).length;

    const missions = db.missions.map((m) => {
      const claimed = db.missionClaims.some((claim) => claim.userId === userId && claim.missionId === m.id && claim.date === date);
      let progress = 0;
      if (m.condition.type === "login") {
        progress = 1;
      }
      if (m.condition.type === "solve_count") {
        progress = solveCount;
      }
      if (m.condition.type === "battle_count") {
        progress = battleCount;
      }
      return {
        ...m,
        progress,
        completed: progress >= m.condition.threshold,
        claimed
      };
    });

    return { date, missions };
  });

  app.post("/missions/claim", { preHandler: [authGuard] }, async (request, reply) => {
    const body = claimBody.parse(request.body);
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user) {
      return reply.code(404).send({ message: "用户不存在" });
    }

    const mission = db.missions.find((m) => m.id === body.missionId);
    if (!mission) {
      return reply.code(404).send({ message: "任务不存在" });
    }

    const date = today();
    const alreadyClaimed = db.missionClaims.some((claim) => claim.userId === userId && claim.missionId === mission.id && claim.date === date);
    if (alreadyClaimed) {
      return reply.code(400).send({ message: "今日已领取" });
    }

    const solveCount = solvedProblemCountForDate(userId, date);
    const battleCount = db.matches.filter((m) => m.userId === userId && (!m.fen || !!m.finishedAt) && m.createdAt.startsWith(date)).length;

    let progress = 0;
    if (mission.condition.type === "login") progress = 1;
    if (mission.condition.type === "solve_count") progress = solveCount;
    if (mission.condition.type === "battle_count") progress = battleCount;

    if (progress < mission.condition.threshold) {
      return reply.code(400).send({ message: "任务未完成" });
    }

    db.missionClaims.push({
      missionId: mission.id,
      userId,
      date,
      claimedAt: nowIso()
    });

    addPoints(userId, mission.pointsReward, `任务奖励:${mission.name}`);

    return {
      success: true,
      points: user.points,
      level: user.level
    };
  });

  app.get("/points/ledger", { preHandler: [authGuard] }, async (request) => {
    const userId = requireUserId(request);
    return {
      items: db.pointLedger.filter((entry) => entry.userId === userId).slice(-50).reverse()
    };
  });

  app.post("/shop/redeem", { preHandler: [authGuard] }, async (request, reply) => {
    const body = redeemBody.parse(request.body);
    const userId = requireUserId(request);
    const user = getUserById(userId);
    if (!user) {
      return reply.code(404).send({ message: "用户不存在" });
    }

    const item = db.shopItems.find((it) => it.id === body.itemId);
    if (!item) {
      return reply.code(404).send({ message: "商品不存在" });
    }

    if (user.points < item.price) {
      return reply.code(400).send({ message: "积分不足" });
    }

    addPoints(userId, -item.price, `兑换:${item.name}`);
    db.inventory.push({
      userId,
      itemId: item.id,
      acquiredAt: nowIso()
    });

    return {
      success: true,
      points: user.points,
      acquiredItem: item
    };
  });
};
