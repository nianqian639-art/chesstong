import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import pino from "pino";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const logger = pino({ name: "db" });
import type {
  AuthSession,
  BindingCode,
  ChatMessage,
  Class,
  ClassNotice,
  ClassTask,
  FriendRelation,
  GameRequest,
  GameRoom,
  Homework,
  HomeworkAttempt,
  InventoryEntry,
  MatchRecord,
  Mission,
  MissionClaim,
  PointLedgerEntry,
  ParentTask,
  Problem,
  ProblemAttempt,
  ShopItem,
  StudyPlan,
  User,
  WeeklyReport,
} from "../models/types.js";
import { allProblems } from "../data/puzzles.js";

// ── Determine DB path relative to this module ──────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = process.env.CHESSTONG_DATA_DIR || resolve(__dirname, "..", "..", "data");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}
const dbPath = resolve(dataDir, "chesstong.db");

// ── Open SQLite ────────────────────────────────────────────────
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// ── Table metadata ─────────────────────────────────────────────

interface TableMeta {
  columns: string[];
  pk: string[];
  jsonColumns: string[];
  boolColumns: string[];
}

const tableMetas: Record<string, TableMeta> = {
  users: {
    columns: [
      "id", "username", "phone", "passwordHash", "displayName", "role",
      "childIds", "classIds", "points", "level",
      "streakDays", "createdAt",
    ],
    pk: ["id"],
    jsonColumns: ["childIds", "classIds"],
    boolColumns: [],
  },
  sessions: {
    columns: ["token", "userId", "createdAt", "expiresAt"],
    pk: ["token"],
    jsonColumns: [],
    boolColumns: [],
  },
  problems: {
    columns: [
      "id", "gradeBand", "type", "difficulty",
      "knowledgePoint", "fen", "question", "solution",
      "solutionUci", "acceptedAnswers", "hints",
      "rating", "themes", "source",
    ],
    pk: ["id"],
    jsonColumns: ["acceptedAnswers", "hints", "themes", "source"],
    boolColumns: [],
  },
  attempts: {
    columns: ["id", "userId", "problemId", "answer", "isCorrect", "submittedAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: ["isCorrect"],
  },
  missions: {
    columns: ["id", "name", "description", "pointsReward", "condition"],
    pk: ["id"],
    jsonColumns: ["condition"],
    boolColumns: [],
  },
  mission_claims: {
    columns: ["missionId", "userId", "date", "claimedAt"],
    pk: ["missionId", "userId", "date"],
    jsonColumns: [],
    boolColumns: [],
  },
  point_ledger: {
    columns: ["id", "userId", "change", "reason", "createdAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  shop_items: {
    columns: ["id", "kind", "name", "price"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  inventory: {
    columns: ["userId", "itemId", "acquiredAt"],
    pk: ["userId", "itemId"],
    jsonColumns: [],
    boolColumns: [],
  },
  matches: {
    columns: ["id", "userId", "mode", "difficulty", "pgn", "result", "createdAt", "fen", "variant", "finishedAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  class_tasks: {
    columns: ["id", "classId", "creatorId", "title", "requiredSolveCount", "dueDate", "createdAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  class_notices: {
    columns: ["id", "classId", "creatorId", "message", "createdAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  classes: {
    columns: ["id", "name", "teacherId", "inviteCode", "memberIds", "createdAt"],
    pk: ["id"],
    jsonColumns: ["memberIds"],
    boolColumns: [],
  },
  homeworks: {
    columns: [
      "id", "classId", "creatorId", "title", "fen",
      "acceptedAnswers", "requiredSolveCount", "dueDate", "createdAt",
    ],
    pk: ["id"],
    jsonColumns: ["acceptedAnswers"],
    boolColumns: [],
  },
  homework_attempts: {
    columns: ["id", "homeworkId", "userId", "answer", "isCorrect", "submittedAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: ["isCorrect"],
  },
  binding_codes: {
    columns: ["code", "studentId", "expiresAt", "createdAt"],
    pk: ["code"],
    jsonColumns: [],
    boolColumns: [],
  },
  study_plans: {
    columns: [
      "id", "parentId", "childId",
      "dailySolveTarget", "dailyBattleTarget",
      "startDate", "endDate", "deadlineAt", "createdAt",
    ],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  parent_tasks: {
    columns: ["id", "parentId", "childId", "title", "deadlineAt", "completedAt", "createdAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  game_rooms: {
    columns: [
      "id", "roomNumber", "creatorId", "timeControl",
      "players", "fen", "pgn", "turn", "status",
      "result", "resultReason", "drawOfferFrom",
      "lastMoveTimestamp", "createdAt",
    ],
    pk: ["id"],
    jsonColumns: ["timeControl", "players"],
    boolColumns: [],
  },
  friend_relations: {
    columns: ["id", "fromUserId", "toUserId", "status", "createdAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: [],
  },
  chat_messages: {
    columns: ["id", "fromUserId", "toUserId", "message", "read", "createdAt"],
    pk: ["id"],
    jsonColumns: [],
    boolColumns: ["read"],
  },
  game_requests: {
    columns: ["id", "fromUserId", "toUserId", "timeControl", "status", "roomId", "createdAt"],
    pk: ["id"],
    jsonColumns: ["timeControl"],
    boolColumns: [],
  },
  weekly_reports: {
    columns: [
      "id", "studentId", "parentId", "weekStart", "weekEnd",
      "solveCount", "battleCount", "pvpWins", "pvpLosses", "pvpDraws",
      "pointsGained", "currentPoints", "currentRank",
      "aiCommentary", "suggestions", "createdAt", "language", "totalAttempts", "totalAccuracy", "homeworkDone", "homeworkTotal", "dailyBreakdown",
      "weeklyAttempts", "weeklyCorrect", "weeklyAccuracy", "activeDays", "bestDay", "parentTaskDone", "parentTaskTotal",
    ],
    pk: ["id"],
    jsonColumns: ["suggestions", "dailyBreakdown"],
    boolColumns: [],
  },
  sms_codes: {
    columns: ["phone", "code", "createdAt"],
    pk: ["phone"],
    jsonColumns: [],
    boolColumns: [],
  },
};

// ── Map DB property name <-> SQLite table name ─────────────────

const dbToTable: Record<string, string> = {
  users:             "users",
  sessions:          "sessions",
  problems:          "problems",
  attempts:          "attempts",
  missions:          "missions",
  missionClaims:     "mission_claims",
  pointLedger:       "point_ledger",
  shopItems:         "shop_items",
  inventory:         "inventory",
  matches:           "matches",
  classTasks:        "class_tasks",
  classNotices:      "class_notices",
  classes:           "classes",
  homeworks:         "homeworks",
  homeworkAttempts:  "homework_attempts",
  bindingCodes:      "binding_codes",
  studyPlans:        "study_plans",
  parentTasks:       "parent_tasks",
  gameRooms:         "game_rooms",
  friendRelations:   "friend_relations",
  chatMessages:      "chat_messages",
  gameRequests:      "game_requests",
  weeklyReports:     "weekly_reports",
};

// ── Row-level Proxy helpers ────────────────────────────────────

/** Wrap a plain object in a deep proxy that auto-saves to SQLite on mutation. */
function createRowProxy<T extends Record<string, any>>(
  row: T,
  tableName: string,
): T {
  const meta = tableMetas[tableName];
  if (!meta) return row;
  if (tableName === "users" && "passwordHash" in row) {
    Object.defineProperty(row, "passwordHash", {
      value: row.passwordHash,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }

  const save = () => saveRow(tableName, row);

  return new Proxy(row, {
    get(target, prop) {
      const value = target[prop as string];
      if (typeof value === "function") return value.bind(target);
      if (Array.isArray(value)) {
        return createArrayProxy(value, save);
      }
      if (value && typeof value === "object") {
        return createNestedProxy(value, save);
      }
      return value;
    },
    set(target, prop, value) {
      (target as any)[prop] = value;
      save();
      return true;
    },
    deleteProperty(target, prop) {
      delete (target as any)[prop];
      save();
      return true;
    },
  }) as unknown as T;
}

/** Wrap an array so mutations (push/splice etc.) call onSave. */
function createArrayProxy(arr: any[], onSave: () => void): any[] {
  const mutableMethods = new Set([
    "push", "pop", "shift", "unshift",
    "splice", "sort", "reverse", "fill", "copyWithin",
  ]);

  return new Proxy(arr, {
    get(target, prop) {
      const value = (target as any)[prop];
      if (typeof value === "function" && mutableMethods.has(prop as string)) {
        return function (...args: any[]) {
          const result = (value as Function).apply(target, args);
          onSave();
          return result;
        };
      }
      if (typeof value === "function") return value.bind(target);
      if (Array.isArray(value)) return createArrayProxy(value, onSave);
      if (value && typeof value === "object") return createNestedProxy(value, onSave);
      return value;
    },
    set(target, prop, value) {
      (target as any)[prop] = value;
      onSave();
      return true;
    },
  }) as any[];
}

/** Wrap a nested object so property changes call onSave. */
function createNestedProxy(
  obj: Record<string, any>,
  onSave: () => void,
): Record<string, any> {
  return new Proxy(obj, {
    get(target, prop) {
      const value = target[prop as string];
      if (typeof value === "function") return value.bind(target);
      if (Array.isArray(value)) return createArrayProxy(value, onSave);
      if (value && typeof value === "object") return createNestedProxy(value, onSave);
      return value;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      onSave();
      return true;
    },
    deleteProperty(target, prop) {
      delete target[prop as string];
      onSave();
      return true;
    },
  });
}

// ── SQL persistence helpers ────────────────────────────────────

function serialize(val: any, isJson: boolean, isBool: boolean): any {
  if (val === undefined || val === null) return null;
  if (isJson) return JSON.stringify(val);
  if (isBool) return val ? 1 : 0;
  return val;
}

function deserialize(val: any, isJson: boolean, isBool: boolean): any {
  if (val === null || val === undefined) {
    if (isBool) return false;
    return null;
  }
  if (isBool) return val === 1 || val === true;
  if (isJson) {
    try {
      return JSON.parse(val as string);
    } catch {
      return null;
    }
  }
  return val;
}

function jsonDefault(columnName: string): any {
  if (
    [
      "childIds", "classIds", "memberIds", "acceptedAnswers",
      "hints", "themes", "suggestions",
    ].includes(columnName)
  ) {
    return [];
  }
  return null;
}

/** Insert or replace a single row. */
function insertRow(tableName: string, row: Record<string, any>): void {
  const meta = tableMetas[tableName];
  if (!meta) return;
  const cols = meta.columns;
  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((c) =>
    serialize(row[c], meta.jsonColumns.includes(c), meta.boolColumns.includes(c)),
  );
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders})`,
    )
    .run(...values);
}

/** Save (upsert) a single row back to SQLite. */
function saveRow(tableName: string, row: Record<string, any>): void {
  const meta = tableMetas[tableName];
  if (!meta) return;
  const cols = meta.columns;
  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((c) =>
    serialize(row[c], meta.jsonColumns.includes(c), meta.boolColumns.includes(c)),
  );
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders})`,
    )
    .run(...values);
}

/** Delete a single row by primary key. */
function deleteRow(tableName: string, row: Record<string, any>): void {
  const meta = tableMetas[tableName];
  if (!meta) return;
  const where = meta.pk.map((c) => `${c} = ?`).join(" AND ");
  const values = meta.pk.map((c) => row[c]);
  sqlite.prepare(`DELETE FROM ${tableName} WHERE ${where}`).run(...values);
}

/** Replace all rows in a table (used for whole-array reassignment). */
function syncTable(tableName: string, rows: Record<string, any>[]): void {
  sqlite.prepare(`DELETE FROM ${tableName}`).run();
  if (rows.length === 0) return;
  const meta = tableMetas[tableName];
  const insert = sqlite.prepare(
    `INSERT OR REPLACE INTO ${tableName} (${meta.columns.join(", ")})
     VALUES (${meta.columns.map(() => "?").join(", ")})`,
  );
  const txn = sqlite.transaction((items: Record<string, any>[]) => {
    for (const row of items) {
      const values = meta.columns.map((c) =>
        serialize(row[c], meta.jsonColumns.includes(c), meta.boolColumns.includes(c)),
      );
      insert.run(...values);
    }
  });
  txn(rows);
}

// ── Load rows and wrap in proxies ──────────────────────────────

function loadTable(tableName: string): Record<string, any>[] {
  const meta = tableMetas[tableName];
  if (!meta) return [];

  const rawRows = sqlite.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, any>[];

  return rawRows.map((raw) => {
    const parsed: Record<string, any> = {};
    for (const col of meta.columns) {
      let val = raw[col];
      const isJson = meta.jsonColumns.includes(col);
      const isBool = meta.boolColumns.includes(col);
      val = deserialize(val, isJson, isBool);
      if (val === null && isJson) {
        val = jsonDefault(col);
      }
      parsed[col] = val;
    }
    return createRowProxy(parsed, tableName);
  });
}

// ── Table-level array proxies ──────────────────────────────────

const tableCaches: Record<string, any[]> = {};
const _tableProxies: Record<string, any[]> = {};

function createTableArrayProxy<T>(tableName: string): T[] {
  const cache = tableCaches[tableName];
  if (!cache) return [] as unknown as T[];

  const meta = tableMetas[tableName];
  const mutatingMethods = new Set([
    "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill",
  ]);

  return new Proxy(cache, {
    get(_target, prop) {
      if (prop === Symbol.iterator) {
        return cache[Symbol.iterator].bind(cache);
      }
      const value = (cache as any)[prop];
      if (typeof value === "function") {
        if (mutatingMethods.has(prop as string)) {
          const fnName = prop as string;
          return function (...args: any[]) {
            if (fnName === "push") {
              for (const item of args) {
                if (meta) insertRow(tableName, item);
                const proxied = createRowProxy(item, tableName);
                cache.push(proxied);
              }
              return cache.length;
            }
            if (fnName === "pop") {
              if (cache.length === 0) return undefined;
              const item = cache[cache.length - 1];
              deleteRow(tableName, item);
              return cache.pop();
            }
            if (fnName === "shift") {
              if (cache.length === 0) return undefined;
              const item = cache[0];
              deleteRow(tableName, item);
              return cache.shift();
            }
            if (fnName === "unshift") {
              for (const item of [...args].reverse()) {
                if (meta) insertRow(tableName, item);
                const proxied = createRowProxy(item, tableName);
                cache.unshift(proxied);
              }
              return cache.length;
            }
            if (fnName === "splice") {
              const start = args[0] as number;
              const deleteCount = args[1] as number ?? cache.length - start;
              const insertItems = args.slice(2);
              const removed = cache.slice(start, start + deleteCount);
              for (const item of removed) {
                deleteRow(tableName, item);
              }
              for (const item of insertItems) {
                if (meta) insertRow(tableName, item);
              }
              const proxiedInserts = insertItems.map((item: any) =>
                createRowProxy(item, tableName),
              );
              const result = (cache as any[]).splice(start, deleteCount, ...proxiedInserts);
              return result;
            }
            // sort, reverse, fill — run on cache, individual element
            // mutations are saved by their own row proxies
            const result = (value as Function).apply(cache, args);
            return result;
          };
        }
        return value.bind(cache);
      }
      return value;
    },
    set(_target, prop, val) {
      (cache as any)[prop] = val;
      return true;
    },
  }) as unknown as T[];
}

function getTableProxy(tableName: string): any[] {
  if (!_tableProxies[tableName]) {
    _tableProxies[tableName] = createTableArrayProxy(tableName);
  }
  return _tableProxies[tableName];
}

// ── SMS code map ───────────────────────────────────────────────

const smsCodeMap = {
  set(phone: string, code: string) {
    sqlite
      .prepare(`INSERT OR REPLACE INTO sms_codes (phone, code, createdAt) VALUES (?, ?, ?)`)
      .run(phone, code, new Date().toISOString());
  },
  get(phone: string): string | undefined {
    const row = sqlite.prepare("SELECT code, createdAt FROM sms_codes WHERE phone = ?").get(phone) as { code: string; createdAt: string } | undefined;
    if (!row || Date.now() - Date.parse(row.createdAt) > 300000) return undefined;
    return row.code;
  },
  consume(phone: string, code: string): boolean {
    return sqlite.transaction(() => {
      const saved = smsCodeMap.get(phone);
      // Every verification attempt consumes the code, preventing brute force and replay.
      sqlite.prepare("DELETE FROM sms_codes WHERE phone = ?").run(phone);
      return Boolean(saved && saved === code);
    })();
  },
};

// ── Seed data ──────────────────────────────────────────────────

const seededMissions: Mission[] = [
  {
    id: "m-login",
    name: "每日登录",
    description: "每天登录一次",
    pointsReward: 10,
    condition: { type: "login", threshold: 1 },
  },
  {
    id: "m-solve-3",
    name: "今日训练",
    description: "完成3道题",
    pointsReward: 30,
    condition: { type: "solve_count", threshold: 3 },
  },
  {
    id: "m-battle-1",
    name: "实战练习",
    description: "完成1局人机对战",
    pointsReward: 20,
    condition: { type: "battle_count", threshold: 1 },
  },
];

const seededShop: ShopItem[] = [
  { id: "skin-board-neon", kind: "board_skin", name: "霓虹棋盘", price: 200 },
  { id: "skin-piece-future", kind: "piece_skin", name: "未来棋子", price: 260 },
  { id: "item-hint-card", kind: "item", name: "提示卡", price: 80 },
];

// ── Initialization ─────────────────────────────────────────────

let initialized = false;

function initDatabase(): void {
  if (initialized) return;

  // ── Create all tables ─────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      phone TEXT NOT NULL,
      passwordHash TEXT,
      displayName TEXT NOT NULL,
      role TEXT NOT NULL,
      childIds TEXT DEFAULT '[]',
      classIds TEXT DEFAULT '[]',
      points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streakDays INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      gradeBand TEXT NOT NULL,
      type TEXT NOT NULL,
      difficulty INTEGER NOT NULL,
      knowledgePoint TEXT NOT NULL,
      fen TEXT NOT NULL,
      question TEXT NOT NULL,
      solution TEXT NOT NULL,
      solutionUci TEXT,
      acceptedAnswers TEXT,
      hints TEXT DEFAULT '[]',
      rating INTEGER,
      themes TEXT,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      problemId TEXT NOT NULL,
      answer TEXT NOT NULL,
      isCorrect INTEGER DEFAULT 0,
      submittedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      pointsReward INTEGER NOT NULL,
      condition TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mission_claims (
      missionId TEXT NOT NULL,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      claimedAt TEXT NOT NULL,
      PRIMARY KEY (missionId, userId, date)
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      userId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      acquiredAt TEXT NOT NULL,
      PRIMARY KEY (userId, itemId)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      mode TEXT NOT NULL,
      difficulty INTEGER NOT NULL,
      pgn TEXT NOT NULL,
      result TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_tasks (
      id TEXT PRIMARY KEY,
      classId TEXT NOT NULL,
      creatorId TEXT NOT NULL,
      title TEXT NOT NULL,
      requiredSolveCount INTEGER NOT NULL,
      dueDate TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_notices (
      id TEXT PRIMARY KEY,
      classId TEXT NOT NULL,
      creatorId TEXT NOT NULL,
      message TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacherId TEXT NOT NULL,
      inviteCode TEXT NOT NULL,
      memberIds TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS homeworks (
      id TEXT PRIMARY KEY,
      classId TEXT NOT NULL,
      creatorId TEXT NOT NULL,
      title TEXT NOT NULL,
      fen TEXT NOT NULL,
      acceptedAnswers TEXT DEFAULT '[]',
      requiredSolveCount INTEGER NOT NULL,
      dueDate TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS homework_attempts (
      id TEXT PRIMARY KEY,
      homeworkId TEXT NOT NULL,
      userId TEXT NOT NULL,
      answer TEXT NOT NULL,
      isCorrect INTEGER DEFAULT 0,
      submittedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS binding_codes (
      code TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_plans (
      id TEXT PRIMARY KEY,
      parentId TEXT NOT NULL,
      childId TEXT NOT NULL,
      dailySolveTarget INTEGER NOT NULL,
      dailyBattleTarget INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      deadlineAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parent_tasks (
      id TEXT PRIMARY KEY,
      parentId TEXT NOT NULL,
      childId TEXT NOT NULL,
      title TEXT NOT NULL,
      deadlineAt TEXT NOT NULL,
      completedAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_rooms (
      id TEXT PRIMARY KEY,
      roomNumber TEXT NOT NULL,
      creatorId TEXT NOT NULL,
      timeControl TEXT NOT NULL,
      players TEXT NOT NULL,
      fen TEXT NOT NULL,
      pgn TEXT NOT NULL,
      turn TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      resultReason TEXT,
      drawOfferFrom TEXT,
      lastMoveTimestamp TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friend_relations (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_requests (
      id TEXT PRIMARY KEY,
      fromUserId TEXT NOT NULL,
      toUserId TEXT NOT NULL,
      timeControl TEXT NOT NULL,
      status TEXT NOT NULL,
      roomId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      parentId TEXT NOT NULL,
      weekStart TEXT NOT NULL,
      weekEnd TEXT NOT NULL,
      solveCount INTEGER DEFAULT 0,
      battleCount INTEGER DEFAULT 0,
      pvpWins INTEGER DEFAULT 0,
      pvpLosses INTEGER DEFAULT 0,
      pvpDraws INTEGER DEFAULT 0,
      pointsGained INTEGER DEFAULT 0,
      currentPoints INTEGER DEFAULT 0,
      currentRank TEXT NOT NULL,
      aiCommentary TEXT NOT NULL,
      suggestions TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sms_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  const matchColumns = sqlite.prepare("PRAGMA table_info(matches)").all() as Array<{ name: string }>;
  for (const name of ["fen", "variant", "finishedAt"]) {
    if (!matchColumns.some(c => c.name === name)) sqlite.exec(`ALTER TABLE matches ADD COLUMN ${name} TEXT`);
  }
  const reportColumns = sqlite.prepare("PRAGMA table_info(weekly_reports)").all() as Array<{ name: string }>;
  for (const [name, type] of Object.entries({ language: "TEXT", totalAttempts: "INTEGER", totalAccuracy: "TEXT", homeworkDone: "INTEGER", homeworkTotal: "INTEGER", dailyBreakdown: "TEXT", weeklyAttempts: "INTEGER", weeklyCorrect: "INTEGER", weeklyAccuracy: "TEXT", activeDays: "INTEGER", bestDay: "TEXT", parentTaskDone: "INTEGER", parentTaskTotal: "INTEGER" })) {
    if (!reportColumns.some(c => c.name === name)) sqlite.exec(`ALTER TABLE weekly_reports ADD COLUMN ${name} ${type}`);
  }
  const planColumns = sqlite.prepare("PRAGMA table_info(study_plans)").all() as Array<{ name: string }>;
  if (!planColumns.some(c => c.name === "deadlineAt")) sqlite.exec("ALTER TABLE study_plans ADD COLUMN deadlineAt TEXT");
  const userColumns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "username")) {
    sqlite.prepare("ALTER TABLE users ADD COLUMN username TEXT").run();
  }
  if (!userColumns.some((column) => column.name === "passwordHash")) {
    sqlite.prepare("ALTER TABLE users ADD COLUMN passwordHash TEXT").run();
  }
  const migratedUsers = sqlite.prepare("SELECT id, displayName, username FROM users").all() as Array<{ id: string; displayName: string; username?: string | null }>;
  const usedUsernames = new Set(migratedUsers.map((user) => String(user.username || "").toLowerCase()).filter(Boolean));
  const updateUsername = sqlite.prepare("UPDATE users SET username = ? WHERE id = ?");
  for (const user of migratedUsers) {
    if (user.username) continue;
    const readable = String(user.displayName || "").trim().replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 20) || "user";
    let candidate = `${readable}_${user.id.replace(/[^a-z0-9]/gi, "").slice(0, 8)}`.slice(0, 32);
    let suffix = 1;
    while (usedUsernames.has(candidate.toLowerCase())) {
      candidate = `${readable.slice(0, 26)}_${suffix++}`.slice(0, 32);
    }
    usedUsernames.add(candidate.toLowerCase());
    updateUsername.run(candidate, user.id);
  }
  sqlite.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)").run();
  sqlite.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)").run();

  const sessionColumns = sqlite.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  if (!sessionColumns.some((column) => column.name === "expiresAt")) {
    sqlite.prepare("ALTER TABLE sessions ADD COLUMN expiresAt TEXT").run();
  }

  // ── Seed on first run ─────────────────────────────────────

  const problemCount = (sqlite.prepare("SELECT COUNT(*) as cnt FROM problems").get() as { cnt: number }).cnt;
  if (problemCount === 0) {
    logger.info("Seeding problems...");
    const insertProblem = sqlite.prepare(
      `INSERT OR REPLACE INTO problems (${tableMetas.problems.columns.join(", ")})
       VALUES (${tableMetas.problems.columns.map(() => "?").join(", ")})`,
    );
    const txn = sqlite.transaction((problems: Problem[]) => {
      for (const p of problems) {
        insertProblem.run(
          p.id, p.gradeBand, p.type, p.difficulty,
          p.knowledgePoint, p.fen, p.question, p.solution,
          p.solutionUci ?? null,
          p.acceptedAnswers ? JSON.stringify(p.acceptedAnswers) : null,
          JSON.stringify(p.hints),
          p.rating ?? null,
          p.themes ? JSON.stringify(p.themes) : null,
          p.source ? JSON.stringify(p.source) : null,
        );
      }
    });
    txn(allProblems as Problem[]);
    logger.info({ count: allProblems.length }, "Seeded problems");
  }

  // Correct the built-in positions without touching attempts or user-created puzzles.
  const correctedPuzzleIds = new Set(["starter-011", "starter-016", "starter-017", "starter-023", "starter-029"]);
  const correctedProblems = allProblems.filter((problem) => correctedPuzzleIds.has(problem.id));
  const updateBuiltInPuzzle = sqlite.prepare(
    `UPDATE problems SET gradeBand = ?, type = ?, difficulty = ?, knowledgePoint = ?, fen = ?, question = ?, solution = ?, solutionUci = ?, acceptedAnswers = ?, hints = ?, rating = ?, themes = ?, source = ? WHERE id = ?`,
  );
  const migrateBuiltInPuzzles = sqlite.transaction((problems: Problem[]) => {
    for (const problem of problems) {
      updateBuiltInPuzzle.run(
        problem.gradeBand, problem.type, problem.difficulty, problem.knowledgePoint,
        problem.fen, problem.question, problem.solution, problem.solutionUci ?? null,
        problem.acceptedAnswers ? JSON.stringify(problem.acceptedAnswers) : null,
        JSON.stringify(problem.hints), problem.rating ?? null,
        problem.themes ? JSON.stringify(problem.themes) : null,
        problem.source ? JSON.stringify(problem.source) : null,
        problem.id,
      );
    }
  });
  migrateBuiltInPuzzles(correctedProblems);

  const missionCount = (sqlite.prepare("SELECT COUNT(*) as cnt FROM missions").get() as { cnt: number }).cnt;
  if (missionCount === 0) {
    logger.info("Seeding missions...");
    const insertMission = sqlite.prepare(
      `INSERT OR REPLACE INTO missions (id, name, description, pointsReward, condition)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const txn = sqlite.transaction((missions: Mission[]) => {
      for (const m of missions) {
        insertMission.run(m.id, m.name, m.description, m.pointsReward, JSON.stringify(m.condition));
      }
    });
    txn(seededMissions);
  }

  const shopCount = (sqlite.prepare("SELECT COUNT(*) as cnt FROM shop_items").get() as { cnt: number }).cnt;
  if (shopCount === 0) {
    logger.info("Seeding shop items...");
    const insertShop = sqlite.prepare(
      `INSERT OR REPLACE INTO shop_items (id, kind, name, price) VALUES (?, ?, ?, ?)`,
    );
    const txn = sqlite.transaction((items: ShopItem[]) => {
      for (const item of items) {
        insertShop.run(item.id, item.kind, item.name, item.price);
      }
    });
    txn(seededShop);
  }

  // ── Load all tables into memory ───────────────────────────

  for (const tableName of Object.keys(tableMetas)) {
    if (tableName === "sms_codes") continue;
    tableCaches[tableName] = loadTable(tableName);
  }

  initialized = true;
  logger.info({ dbPath }, "Database initialized");
}

// ── The db object ─────────────────────────────────────────────

export interface Database {
  users: User[];
  sessions: AuthSession[];
  problems: Problem[];
  attempts: ProblemAttempt[];
  missions: Mission[];
  missionClaims: MissionClaim[];
  pointLedger: PointLedgerEntry[];
  shopItems: ShopItem[];
  inventory: InventoryEntry[];
  matches: MatchRecord[];
  classTasks: ClassTask[];
  classNotices: ClassNotice[];
  classes: Class[];
  homeworks: Homework[];
  homeworkAttempts: HomeworkAttempt[];
  bindingCodes: BindingCode[];
  studyPlans: StudyPlan[];
  parentTasks: ParentTask[];
  gameRooms: GameRoom[];
  friendRelations: FriendRelation[];
  chatMessages: ChatMessage[];
  gameRequests: GameRequest[];
  weeklyReports: WeeklyReport[];
  smsCodeMap: {
    set: (phone: string, code: string) => void;
    get: (phone: string) => string | undefined;
    consume: (phone: string, code: string) => boolean;
  };
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    if (prop === "smsCodeMap") return smsCodeMap;

    const dbProp = prop as string;
    const tableName = dbToTable[dbProp];
    if (tableName) {
      if (!initialized) initDatabase();
      return getTableProxy(tableName);
    }
    return undefined;
  },
  set(_target, prop, value) {
    const dbProp = prop as string;
    const tableName = dbToTable[dbProp];
    if (tableName) {
      if (!initialized) initDatabase();
      // Whole-array reassignment: db.x = db.x.filter(...)
      const rows: Record<string, any>[] = Array.isArray(value) ? value : [];
      syncTable(tableName, rows);

      const cache = tableCaches[tableName];
      const newRows = rows.map((row: any) => createRowProxy(row, tableName));
      cache.length = 0;
      cache.push(...newRows);
      return true;
    }
    return false;
  },
});

// ── Helper functions ──────────────────────────────────────────

const now = () => new Date().toISOString();

export interface RankInfo {
  level: number;
  title: string;
  piece: string;
  name: string;
  nextPoints: number;
}

export const getRank = (points: number): RankInfo => {
  if (points < 100) return { level: 1, title: "兵", piece: "♟", name: "Pawn", nextPoints: 100 };
  if (points < 300) return { level: 2, title: "骑士", piece: "♞", name: "Knight", nextPoints: 300 };
  if (points < 600) return { level: 3, title: "主教", piece: "♝", name: "Bishop", nextPoints: 600 };
  if (points < 1000) return { level: 4, title: "战车", piece: "♜", name: "Rook", nextPoints: 1000 };
  if (points < 1500) return { level: 5, title: "皇后", piece: "♛", name: "Queen", nextPoints: 1500 };
  return { level: 6, title: "国王", piece: "♚", name: "King", nextPoints: Infinity };
};

export const addPoints = (userId: string, delta: number, reason: string): void => {
  if (!initialized) initDatabase();

  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return;
  }
  const oldRank = getRank(user.points);
  user.points += delta;
  user.level = getRank(user.points).level;
  db.pointLedger.push({
    id: crypto.randomUUID(),
    userId,
    change: delta,
    reason,
    createdAt: now(),
  });
  // Check for rank promotion
  const newRank = getRank(user.points);
  if (newRank.level > oldRank.level) {
    db.pointLedger.push({
      id: crypto.randomUUID(),
      userId,
      change: 0,
      reason: `🎉 晋升为【${newRank.piece} ${newRank.title}】！`,
      createdAt: now(),
    });
  }
};

export const awardPvpPoints = (
  whiteUserId: string | undefined,
  blackUserId: string | undefined,
  result: "white" | "black" | "draw",
  reason: string,
): void => {
  if (whiteUserId) {
    const whiteResult =
      result === "white" ? "win" : result === "black" ? "lose" : "draw";
    const whitePoints = whiteResult === "win" ? 30 : whiteResult === "draw" ? 10 : 5;
    addPoints(
      whiteUserId,
      whitePoints,
      `PvP对战${reason}:${whiteResult === "win" ? "胜" : whiteResult === "draw" ? "平" : "负"}`,
    );
  }
  if (blackUserId) {
    const blackResult =
      result === "black" ? "win" : result === "white" ? "lose" : "draw";
    const blackPoints = blackResult === "win" ? 30 : blackResult === "draw" ? 10 : 5;
    addPoints(
      blackUserId,
      blackPoints,
      `PvP对战${reason}:${blackResult === "win" ? "胜" : blackResult === "draw" ? "平" : "负"}`,
    );
  }
};

export const today = (): string => new Date().toISOString().slice(0, 10);

/** Gracefully close the SQLite database connection. */
export function closeDatabase(): void {
  sqlite.close();
  logger.info("SQLite connection closed");
}

export { initDatabase };
