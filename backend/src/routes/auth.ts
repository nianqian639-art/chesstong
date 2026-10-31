import { userMessage } from "../services/user-errors.js";
import { sendVerificationCode, SmsError } from "../services/sms.js";
import { FastifyPluginAsync } from "fastify";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../services/db.js";

const SESSION_EXPIRY_DAYS = 7;

const normalizePhone = (value: string): string => {
  const compact = value.trim().replace(/[\s\-().]/g, "");
  if (/^\+\d{8,15}$/.test(compact)) {
    return compact;
  }
  if (/^1\d{10}$/.test(compact)) {
    return `+86${compact}`;
  }
  throw new Error("手机号格式不正确，请输入 13800138000 或 +12232323344 这类号码");
};

const sendCodeSchema = z.object({
  phone: z.string().transform(normalizePhone)
});

const normalizeAccount = (value: string): string => {
  const account = value.trim();
  if (!/^[\p{L}\p{N}_-]{3,32}$/u.test(account)) {
    throw new Error("账号需为3-32位字母、数字、下划线或短横线");
  }
  return account;
};

const loginSchema = z.object({
  account: z.string().optional().transform((value) => value ? normalizeAccount(value) : undefined),
  phone: z.string().optional().transform((value) => value ? normalizePhone(value) : undefined),
  password: z.string().min(8, "密码至少8位").max(72, "密码太长"),
}).refine((value) => Boolean(value.account || value.phone), { message: "请输入账号", path: ["account"] });

const registerSchema = z.object({
  account: z.string().optional().transform((value) => value ? normalizeAccount(value) : undefined),
  phone: z.string().optional().transform((value) => value ? normalizePhone(value) : undefined),
  password: z.string().min(8, "密码至少8位").max(72, "密码太长"),
  role: z.enum(["student", "parent", "teacher"]),
  displayName: z.string().min(1, "昵称不能为空").max(24, "昵称最多24个字")
}).refine((value) => Boolean(value.account || value.phone), { message: "请输入账号", path: ["account"] });

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string | null | undefined): boolean => {
  if (!storedHash) {
    return false;
  }
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const createSession = (userId: string) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.sessions.push({
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt,
  });
  return token;
};

const publicUser = <T extends { passwordHash?: string | null }>(user: T): Omit<T, "passwordHash"> => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const findUserByPhone = (phone: string) => {
  return db.users.find((user) => {
    if (user.phone === phone) {
      return true;
    }
    try {
      return normalizePhone(user.phone) === phone;
    } catch {
      return false;
    }
  });
};

const findUserByAccount = (account: string) => {
  const normalized = account.trim().toLowerCase();
  const byUsername = db.users.find((user) => String(user.username || "").toLowerCase() === normalized);
  if (byUsername) return byUsername;
  // Old accounts did not have a username. A unique display name remains a safe recovery path.
  const byName = db.users.filter((user) => String(user.displayName || "").trim().toLowerCase() === normalized);
  return byName.length === 1 ? byName[0] : undefined;
};

const placeholderPhone = (id: string): string => {
  const digits = id.replace(/\D/g, "").slice(0, 12).padEnd(8, "0");
  return `+999${digits}`;
};

const accountFromPhone = (phone: string): string => `user_${phone.replace(/\D/g, "").slice(-10)}`;

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ── Send SMS verification code ───────────────────────
  app.post("/auth/send-code", async (request, reply) => {
    let body: z.infer<typeof sendCodeSchema>;
    try {
      body = sendCodeSchema.parse(request.body);
    } catch (error) {
      return app.httpErrors.badRequest(userMessage(error, "手机号格式不正确"));
    }
    try {
      const code = await sendVerificationCode(body.phone, request.ip);
      db.smsCodeMap.set(body.phone, code);
      return { success: true, message: "验证码已发送，请在5分钟内使用" };
    } catch (error) {
      return reply.code(error instanceof SmsError ? error.statusCode : 503)
        .send({ message: userMessage(error, "短信暂时无法发送，请稍后再试") });
    }
  });

  // ── Register ─────────────────────────────────────────
  app.post("/auth/register", async (request, reply) => {
    let body: z.infer<typeof registerSchema>;
    try {
      body = registerSchema.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ message: userMessage(error, "注册信息格式不正确") });
    }
    const account = body.account || accountFromPhone(body.phone || "");
    const existing = db.users.find((user) =>
      String(user.username || "").toLowerCase() === account.toLowerCase() ||
      (body.phone ? user.phone === body.phone : false),
    );
    if (existing) {
      return reply.code(409).send({ message: "账号已注册，请直接登录" });
    }

    const id = crypto.randomUUID();
    const user = {
      id,
      username: account,
      phone: body.phone || placeholderPhone(id),
      passwordHash: hashPassword(body.password),
      displayName: body.displayName,
      role: body.role,
      childIds: [] as string[],
      classIds: [] as string[],
      points: 0,
      level: 1,
      streakDays: 1,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);

    return {
      token: createSession(user.id),
      user: publicUser(user)
    };
  });

  // ── Login ────────────────────────────────────────────
  app.post("/auth/login", async (request, reply) => {
    let body: z.infer<typeof loginSchema>;
    try {
      body = loginSchema.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ message: userMessage(error, "登录信息格式不正确") });
    }

    const user = body.account ? findUserByAccount(body.account) : findUserByPhone(body.phone || "");
    if (!user) {
      return reply.code(404).send({ message: "账号不存在，请先注册" });
    }

    if (!user.passwordHash) {
      return reply.code(400).send({ message: "账号未设置密码，请使用验证码登录" });
    }

    if (!verifyPassword(body.password, user.passwordHash)) {
      return reply.code(400).send({ message: "账号或密码不正确" });
    }

    return {
      token: createSession(user.id),
      user: publicUser(user)
    };
  });

  // ── Login with verification code ──────────────────────
  const loginWithCodeSchema = z.object({
    phone: z.string().transform(normalizePhone),
    code: z.string().min(1, "请输入验证码"),
    role: z.enum(["student", "parent", "teacher"]).optional(),
    displayName: z.string().min(1).max(24).optional(),
  });

  app.post("/auth/login-with-code", async (request, reply) => {
    let body: z.infer<typeof loginWithCodeSchema>;
    try {
      body = loginWithCodeSchema.parse(request.body);
    } catch (error) {
      return reply.code(400).send({ message: userMessage(error, "请求格式不正确") });
    }

    if (!db.smsCodeMap.consume(body.phone, body.code)) {
      return reply.code(400).send({ message: "验证码不正确或已过期" });
    }

    // Code is correct — find or create user
    let user = findUserByPhone(body.phone);
    if (!user) {
      // Auto-register for code-based login
      if (!body.role || !body.displayName) {
        return reply.code(400).send({ message: "新用户请提供昵称和角色" });
      }
      user = {
        id: crypto.randomUUID(),
        username: `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
        phone: body.phone,
        passwordHash: null, // no password set for code-login users
        displayName: body.displayName,
        role: body.role,
        childIds: [] as string[],
        classIds: [] as string[],
        points: 0,
        level: 1,
        streakDays: 1,
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
    }

    return {
      token: createSession(user.id),
      user: publicUser(user),
    };
  });

  // ── Logout ───────────────────────────────────────────
  app.post("/auth/logout", async (request, _reply) => {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token = header.replace("Bearer ", "").trim();
      const idx = db.sessions.findIndex((s) => s.token === token);
      if (idx >= 0) {
        db.sessions.splice(idx, 1);
      }
    }
    return { success: true };
  });
};
