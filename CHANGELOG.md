# Changelog — Chesstong 国际象棋智能学习平台

> 所有值得记录的重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范。

---

## [v0.7.0] — 2026-05-25

### Added
- **WebSocket 断线重连机制**：玩家断线后 60s 内可重连恢复对局，超时自动判负
- **和棋提议功能**：PvP 对局中支持提出/接受/拒绝和棋
- **聊天系统**：WebSocket 实时聊天，支持未读消息标记

### Fixed
- Fix #5: WebSocket 重连后棋盘状态不同步 — 改为全量状态同步
- WebSocket 连接泄漏：用户多次重连导致旧连接残留

---

## [v0.6.0] — 2026-05-15

### Added
- **Flutter 移动端 MVP**：8 个核心页面（登录/做题/对战/排行榜/任务/家长监督/班级/积分）
- **7 种棋局变体**：标准/兵战/马战/象战/车战/后战/全能战
- **变体自定义胜利条件**：兵战/马战等变体的特殊获胜判定

### Changed
- 前端 UI 重构：index.html（首页）与 app.html（主应用）分离
- 积分系统细化：对战积分与解题积分使用不同计算规则
- 段位系统：从固定等级改为积分驱动的动态段位

### Fixed
- 变体对局中 checkmate 判定与标准规则不一致的问题

---

## [v0.5.0] — 2026-05-05

### Added
- **家长/老师管理模块**：
  - 家长绑定孩子账号
  - 老师创建班级、布置作业、发布公告
  - 学生学习进度追踪
- **排行榜系统**：全球排行榜 + 班级排行榜
- **AI 周报评语**：Agent 3 学习顾问自动生成温暖鼓励的周报

### Changed
- 数据库迁移：从内存数组（`db.ts`）迁移到 SQLite（`database.ts`），启用 WAL 模式
- 数据表从 4 张扩展到 12 张（users, sessions, problems, matches, classes, tasks, homework, weekly_reports, chat_messages, friends, game_requests, point_ledger）

### Fixed
- Fix #3: SQLite 并发写入锁竞争问题 — 增加 `busy_timeout = 5000` 和 WAL 模式优化

---

## [v0.4.0] — 2026-04-24

### Added
- **WebSocket 实时 PvP 对战**：
  - 房间系统（6 位数字房间号）
  - 倒计时棋钟（1s tick 广播）
  - 走法校验（chess.js 服务端验证）
  - 认输/超时判负
  - 对局记录自动存储
- **竞技场匹配系统**：同段位自动匹配

### Changed
- `/match/*` 路由重构：支持 PvP 和 PvE 双模式
- WebSocket 消息协议标准化：auth / move / resign / draw_offer / chat_send / join_room / ping

### Fixed
- 引擎服务不可用时 `/match/start` 返回 500 → 改为返回 fallback 走法
- Fix #1: Stockfish 子进程僵尸泄漏 — 增加 `SIGKILL` + stdin/stdout 清理

---

## [v0.3.0] — 2026-04-18

### Added
- **AI 双模型支持**：Ollama (qwen3:8b) + Qwen API (qwen-plus-latest)，通过 `AI_PROVIDER` 环境变量切换
- **Stockfish 三路回退**：HTTP 服务 → 本地 UCI 子进程 → chess.js 规则引擎
- **安全过滤层**：`safeText()` 内容安全过滤 + `bannedKeywords` 黑名单
- **超时熔断**：所有 AI 请求独立超时（AI: 20s, Engine HTTP: 3s, Stockfish: 3.5s）

### Changed
- AI 服务架构重构：`ai.ts` 统一管理 3 个 Agent，每个 Agent 独立的 Prompt 和 Fallback
- 引擎服务多级回退：`requestEngineMove()` 统一入口，内部自动降级
- 环境变量扩展：新增 `QWEN_API_KEY`, `QWEN_MODEL`, `AI_TIMEOUT_MS` 等

### Fixed
- Fix #2: Ollama 并发请求超时导致 500 → 增加 try-catch 兜底 + 超时后静默回退

---

## [v0.2.0] — 2026-04-14

### Added
- **题库系统**：从 Lichess Puzzle Database 导入 300+ 道分级战术题
- **AI 讲解 Agent 1**：解题教练 — 4 段式结构化讲解（思路/关键点/误区/建议）
- **学习中心**：开局原则（5 课）、中局战略（3 课）、残局基础（3 课）
- **题目导入脚本**：`scripts/import-puzzles.ts` 从 Lichess CSV 自动生成 puzzles.ts

### Changed
- 题目数据模型扩展：增加 `knowledgePoint`, `hints`, `themes`, `gradeBand` 字段
- `/problems/submit` API 支持 UCI 和 SAN 两种走法格式

### Fixed
- `knowledgePoint` 空字符串导致 AI Prompt 中出现空知识点的问题

---

## [v0.1.3] — 2026-04-12

### Added
- **Docker 生产部署配置**：
  - `infra/docker/docker-compose.prod.yml` — 4 服务编排（backend/engine/ollama/nginx）
  - Nginx 反向代理 + SSL 终止 + WebSocket 升级
  - Let's Encrypt 自动证书获取与续期
  - `deploy.sh` — 一键部署脚本

### Changed
- 后端静态文件服务从手动路由改为 `@fastify/static` 插件
- 前端 CSP 和缓存头配置移到 Nginx 层

### Fixed
- Docker 容器内 Ollama 模型路径配置错误

---

## [v0.1.2] — 2026-04-11

### Added
- **人机对战模块**：
  - Stockfish 引擎对接（通过 HTTP Engine Service）
  - 1-20 级难度调节
  - 走法建议（`/match/suggest`）
  - PGN 对局记录与导出
- **积分与任务系统**：
  - 每日任务（解题/对战/连胜）
  - 积分获取与消费
  - 商城皮肤兑换

### Changed
- 棋盘组件升级：支持 FEN 初始化、走法高亮、上一步标记

---

## [v0.1.1] — 2026-04-10

### Added
- **用户认证系统**：
  - 手机号 + 密码注册/登录
  - JWT Token 会话管理
  - 角色系统（学生/家长/老师）
  - 认证中间件
- **Engine Service**：Stockfish 的独立 HTTP 包装服务

### Fixed
- Fix #4: AI 输出包含 Markdown 格式标记 — 添加 `stripMarkdown()` 后处理
- 用户注册时密码未哈希存储 — 添加 SHA-256 哈希

---

## [v0.1.0] — 2026-04-08

### Added
- **项目初始化**：
  - Fastify + TypeScript 后端骨架
  - Ollama AI 集成基础架构
  - chess.js 棋局逻辑引擎
  - 演示页面 `/demo`
  - 基础 REST API 结构
- **核心数据模型定义**：User, Problem, Match, Session, Mission

---

## 版本路线图

| 版本 | 计划内容 |
|------|---------|
| v0.8.0 | 向量化 RAG 知识检索、AI 回答质量自动评估 |
| v0.9.0 | Function Calling 原生集成、Agentic Loop 自适应学习 |
| v1.0.0 | 完整测试覆盖、性能优化、正式发布 |

---

<p align="center">
  <b>Chesstong · Changelog</b><br>
  <sub>15 条重要变更，持续迭代中。</sub>
</p>
