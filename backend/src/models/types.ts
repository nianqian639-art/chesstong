export type UserRole = "student" | "parent" | "teacher";

export interface User {
  id: string;
  username: string;
  phone: string;
  passwordHash?: string | null;
  displayName: string;
  role: UserRole;
  childIds: string[];
  classIds: string[];
  points: number;
  level: number;
  streakDays: number;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt?: string;
}

export interface Problem {
  id: string;
  gradeBand: string;
  type: string;
  difficulty: number;
  knowledgePoint: string;
  fen: string;
  question: string;
  solution: string;
  solutionUci?: string;
  acceptedAnswers?: string[];
  hints: string[];
  rating?: number;
  themes?: string[];
  source?: {
    name: string;
    id?: string;
    url?: string;
  };
}

export interface ProblemAttempt {
  id: string;
  userId: string;
  problemId: string;
  answer: string;
  isCorrect: boolean;
  submittedAt: string;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  pointsReward: number;
  condition: {
    type: "solve_count" | "battle_count" | "login";
    threshold: number;
  };
}

export interface MissionClaim {
  missionId: string;
  userId: string;
  date: string;
  claimedAt: string;
}

export interface PointLedgerEntry {
  id: string;
  userId: string;
  change: number;
  reason: string;
  createdAt: string;
}

export interface ShopItem {
  id: string;
  kind: "board_skin" | "piece_skin" | "item";
  name: string;
  price: number;
}

export interface InventoryEntry {
  userId: string;
  itemId: string;
  acquiredAt: string;
}

export interface MatchRecord {
  id: string;
  userId: string;
  mode: "standard" | "teaching";
  difficulty: number;
  pgn: string;
  result: "win" | "lose" | "draw";
  createdAt: string;
  fen?: string | null;
  variant?: string | null;
  finishedAt?: string | null;
}

export interface ClassTask {
  id: string;
  classId: string;
  creatorId: string;
  title: string;
  requiredSolveCount: number;
  dueDate: string;
  createdAt: string;
}

export interface ClassNotice {
  id: string;
  classId: string;
  creatorId: string;
  message: string;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  inviteCode: string;
  memberIds: string[];
  createdAt: string;
}

export interface Homework {
  id: string;
  classId: string;
  creatorId: string;
  title: string;
  fen: string;
  acceptedAnswers: string[];
  requiredSolveCount: number;
  dueDate: string;
  createdAt: string;
}

export interface HomeworkAttempt {
  id: string;
  homeworkId: string;
  userId: string;
  answer: string;
  isCorrect: boolean;
  submittedAt: string;
}

export interface BindingCode {
  code: string;
  studentId: string;
  expiresAt: string;
  createdAt: string;
}

// ── Weekly Report ────────────────────────────────────────────

export interface WeeklyReport {
  language?: string;
  id: string;
  studentId: string;
  parentId: string;
  weekStart: string;
  weekEnd: string;
  solveCount: number;
  battleCount: number;
  pvpWins: number;
  pvpLosses: number;
  pvpDraws: number;
  pointsGained: number;
  currentPoints: number;
  currentRank: string;
  totalAttempts?: number;
  totalAccuracy?: string;
  homeworkDone?: number;
  homeworkTotal?: number;
  dailyBreakdown?: { date: string; solve: number; battle: number }[];
  weeklyAttempts?: number;
  weeklyCorrect?: number;
  weeklyAccuracy?: string;
  activeDays?: number;
  bestDay?: string;
  parentTaskDone?: number;
  parentTaskTotal?: number;
  aiCommentary: string;
  suggestions: string[];
  createdAt: string;
}

export interface StudyPlan {
  id: string;
  parentId: string;
  childId: string;
  dailySolveTarget: number;
  dailyBattleTarget: number;
  startDate: string;
  endDate: string;
  /** Optional exact expiry instant. Input/output is stored as an ISO timestamp. */
  deadlineAt?: string;
  createdAt: string;
}

export interface ParentTask {
  id: string;
  parentId: string;
  childId: string;
  title: string;
  deadlineAt: string;
  completedAt?: string | null;
  createdAt: string;
}

// ── PvP / Social Types ───────────────────────────────────────────

export interface TimeControl {
  initialMinutes: number;
  incrementSeconds: number;
}

export interface GameRoom {
  id: string;
  roomNumber: string;
  creatorId: string;
  timeControl: TimeControl;
  players: {
    white: { userId: string; timeRemainingMs: number } | null;
    black: { userId: string; timeRemainingMs: number } | null;
  };
  fen: string;
  pgn: string;
  turn: "w" | "b";
  status: "waiting" | "playing" | "finished";
  result: "white" | "black" | "draw" | null;
  resultReason?: "checkmate" | "resign" | "timeout" | "disconnect" | "draw" | "stalemate";
  drawOfferFrom: string | null; // userId of the player who offered draw
  lastMoveTimestamp: string;
  createdAt: string;
}

export interface FriendRelation {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface GameRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  timeControl: TimeControl;
  status: "pending" | "accepted" | "declined" | "expired";
  roomId?: string;
  createdAt: string;
}

// ── Learning Content ──────────────────────────────────────────

export interface LearningTopic {
  id: string;
  title: string;
  category: "openings" | "principles" | "middlegame" | "endgame" | "traps";
  section: string;
  difficulty: number;
  content: string;
  keyFen?: string;
  keyMoves?: string[];
  tips: string[];
}
