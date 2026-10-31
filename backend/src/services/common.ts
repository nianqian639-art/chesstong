import { FastifyRequest } from "fastify";
import { db } from "./db.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

export const nowIso = (): string => new Date().toISOString();

export const requireUserId = (request: FastifyRequest): string => {
  return (request as AuthenticatedRequest).userId;
};

export const getUserById = (userId: string) => db.users.find((u) => u.id === userId);
