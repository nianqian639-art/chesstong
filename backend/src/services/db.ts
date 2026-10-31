// This file re-exports from the SQLite-backed database service.
// All existing route imports continue to work unchanged.
export {
  db,
  getRank,
  addPoints,
  awardPvpPoints,
  today,
  initDatabase,
  closeDatabase,
} from "./database.js";

export type { Database, RankInfo } from "./database.js";
