# Test & Failure Log — Chesstong 国际象棋智能学习平台

> **CULIU TECH · LLM 工程暑期作品集**
>
> 本文档记录 Chesstong 项目开发过程中执行的**系统测试**和遇到的**关键故障**，包含问题分析、修复方案和经验总结。

---

## 目录

1. [测试概览](#测试概览)
2. [系统测试记录（10 轮）](#系统测试记录10-轮)
3. [故障分析与修复（5 例）](#故障分析与修复5-例)
4. [AI 功能专项测试](#ai-功能专项测试)
5. [经验教训总结](#经验教训总结)

---

## 测试概览

| 指标 | 数值 |
|------|------|
| 测试轮次 | 10 轮 |
| 故障记录 | 5 例 |
| AI 专项测试 | 3 个 Agent × 3 场景 |
| 覆盖功能模块 | Auth / Problems / Match / AI / WebSocket / Class / Rankings |

---

## 系统测试记录（10 轮）

### Round 1 — 基础功能冒烟测试

**日期:** 2026-04-10
**目标:** 验证核心 CRUD 功能启动

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 服务启动（backend + engine） | ✅ PASS | 双服务正常启动 |
| GET /health | ✅ PASS | `{"status":"ok"}` |
| POST /auth/register | ✅ PASS | 返回 token + user 对象 |
| POST /auth/login | ✅ PASS | 登录成功返回相同 token |
| GET /demo | ✅ PASS | 演示页 HTML 正确返回 |

**结论:** 核心骨架正常，可以继续开发功能。

---

### Round 2 — 题库与 AI 讲解测试

**日期:** 2026-04-14
**目标:** 验证题目列表、提交、AI 讲解全链路

| 测试项 | 结果 | 备注 |
|--------|------|------|
| GET /problems/list?gradeBand=15&difficulty=1 | ✅ PASS | 返回 20 道入门题 |
| POST /problems/submit（正确答案） | ✅ PASS | `awardedPoints > 0` |
| POST /problems/submit（错误答案） | ✅ PASS | `correctUci` 返回标准答案 |
| POST /problems/explain（Ollama 在线） | ✅ PASS | 4 段结构化讲解 |
| POST /problems/explain（Ollama 离线） | ⚠️ PASS with Fallback | 自动回退到 `fallbackExplain()` |

**发现:** 首次验证了 Fallback 机制——关闭 Ollama 后讲解自动降级，用户无感知。

---

### Round 3 — Stockfish 引擎三路回退测试

**日期:** 2026-04-18
**目标:** 验证引擎多级回退策略

| 测试项 | 结果 | 备注 |
|--------|------|------|
| Engine HTTP 服务在线 → 走法 | ✅ PASS | source: "stockfish" |
| Engine HTTP 离线 → 本地 UCI | ✅ PASS | source: "stockfish", spawn 子进程 |
| 本地 Stockfish 不存在 → 规则引擎 | ✅ PASS | source: "fallback", 规则走法 |
| 空 FEN → 错误处理 | ✅ PASS | 返回友好错误信息 |
| 将死局面 → 返回 null | ✅ PASS | 正确识别 `isGameOver()` |

**结论:** 三条回退路径全部验证通过，引擎服务在任何情况下都不会让前端卡死。

---

### Round 4 — WebSocket 实时对战测试

**日期:** 2026-04-24
**目标:** 验证 PvP 对战完整流程

| 测试项 | 结果 | 备注 |
|--------|------|------|
| WebSocket 连接 + auth | ✅ PASS | auth_ok 返回 |
| 创建房间 → join_room | ✅ PASS | 房间号生成，状态同步 |
| 双方加入 → 游戏开始 | ✅ PASS | status → "playing", 棋钟启动 |
| 走法验证（合法） | ✅ PASS | chess.js 校验通过 |
| 走法验证（非法） | ✅ PASS | 返回 "不合法的走法" |
| 认输 → 结果判定 | ✅ PASS | 积分正确分配 |
| 和棋提议 → 接受 | ✅ PASS | 双方同意和棋 |
| 超时 → 自动判负 | ✅ PASS | 棋钟归零触发 handleTimeout |
| 断线 60s → 判负 | ✅ PASS | 对手获胜 |
| 断线 <60s → 重连成功 | ✅ PASS | 状态恢复，对局继续 |

**结论:** 完整的实时对战链路验证通过，包括边界情况。

---

### Round 5 — 家长/老师管理功能测试

**日期:** 2026-04-30
**目标:** 验证班级和进度管理

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 老师创建班级 | ✅ PASS | classId 返回 |
| 学生加入班级 | ✅ PASS | classIds 更新 |
| 老师布置作业 | ✅ PASS | task 创建成功 |
| 学生提交作业 | ✅ PASS | attempt 记录 |
| 家长绑定孩子 | ✅ PASS | childIds 关联 |
| 家长查看周报 | ✅ PASS | 含 AI 评语 |
| 老师发布公告 | ✅ PASS | 班级全员可见 |

**结论:** 三方角色（学生/家长/老师）功能闭环验证通过。

---

### Round 6 — 排行榜 & 积分系统测试

**日期:** 2026-05-05
**目标:** 验证排名计算和积分分配

| 测试项 | 结果 | 备注 |
|--------|------|------|
| GET /rankings/global | ✅ PASS | 按积分降序排列 |
| GET /rankings/class | ✅ PASS | 班级内排名 |
| 解题积分获得 | ✅ PASS | points 正确累加 |
| PvP 胜/负/平积分 | ✅ PASS | 胜+10/负-5/平+3 |
| 段位晋升 | ✅ PASS | 积分达标自动升级 |
| 每日任务领取 | ✅ PASS | 积分奖励到账 |

---

### Round 7 — AI 模型切换测试

**日期:** 2026-05-10
**目标:** 验证 Ollama ↔ Qwen API 切换

| 测试项 | 结果 | 备注 |
|--------|------|------|
| AI_PROVIDER=ollama → 使用 Ollama | ✅ PASS | source: "ollama" |
| AI_PROVIDER=qwen → 使用 Qwen API | ✅ PASS | source: "qwen" |
| Ollama 超时 → Fallback | ✅ PASS | AbortSignal.timeout(20000) |
| Qwen API 返回 401 → Fallback | ✅ PASS | !response.ok → null → fallback |
| Qwen API 返回不安全内容 → Fallback | ✅ PASS | safeText() 过滤后回退 |
| 两个模型都不可用 → Fallback | ✅ PASS | 服务不中断 |

**结论:** 双模型架构 + Fallback 确保了 AI 讲解永不中断。

---

### Round 8 — Flutter App 端到端测试

**日期:** 2026-05-15
**目标:** 验证移动端与后端交互

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 登录页面 | ✅ PASS | API 通信正常 |
| 做题页面 | ✅ PASS | 题目加载 + 提交 + AI 讲解 |
| 对战页面 | ✅ PASS | 人机对战 + 引擎走法 |
| 排行榜页面 | ✅ PASS | 数据同步正确 |
| 任务页面 | ✅ PASS | 每日任务领取 |
| 家长监督页面 | ✅ PASS | 孩子数据和周报 |

---

### Round 9 — Docker 生产部署测试

**日期:** 2026-05-20
**目标:** 验证 Docker 部署和 HTTPS

| 测试项 | 结果 | 备注 |
|--------|------|------|
| docker compose up | ✅ PASS | 4 个服务全部启动 |
| Nginx HTTPS | ✅ PASS | Let's Encrypt 证书 |
| WebSocket 升级 | ✅ PASS | WSS 协议正常 |
| Ollama 容器内模型加载 | ✅ PASS | qwen3:8b 正常运行 |
| 数据持久化 | ✅ PASS | SQLite 数据卷正常 |

---

### Round 10 — 并发压力测试

**日期:** 2026-05-25
**目标:** 验证多用户并发场景

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 10 用户同时做题 | ✅ PASS | AI 讲解正常排队 |
| 5 局 PvP 同时对战 | ✅ PASS | WebSocket 房间隔离 |
| 20 用户同时查排行榜 | ✅ PASS | SQLite 读无阻塞 |
| Ollama 并发限制 | ⚠️ NOTE | 单模型串行，已通过 timeout 保护 |

**结论:** 系统在预期负载下稳定运行。Ollama 单模型是瓶颈但不影响可用性（通过 timeout 保护）。

---

## 故障分析与修复（5 例）

### Failure #1: Stockfish 子进程僵尸进程泄漏

**发现日期:** 2026-04-18
**严重程度:** 中
**影响范围:** 长时间运行后内存增长

**现象:**
服务器运行 2-3 天后，`top` 显示多个 Stockfish 僵尸进程未回收。

**根因分析:**
```typescript
// 问题代码（修复前）
proc.kill();  // 只发送 SIGTERM，不等待进程退出
```

Node.js 的 `child_process.kill()` 默认发送 SIGTERM，但 Stockfish 进程可能不响应 SIGTERM。子进程变成僵尸进程后不会被自动回收。

**修复方案:**
```typescript
// 修复后
const done = (move: string | null) => {
  if (resolved) return;
  resolved = true;
  clearTimeout(timeout);
  proc.kill('SIGKILL');     // 强制终止
  proc.stdin?.destroy();    // 关闭 stdin
  proc.stdout?.destroy();   // 关闭 stdout
  resolve(move);
};
```

**修复位置:** [`backend/src/services/chess.ts:180-188`](backend/src/services/chess.ts#L180-L188)

**经验教训:**
- 子进程管理需要显式清理所有 I/O 管道
- `SIGKILL` 比 `SIGTERM` 更可靠（但对优雅退出场景需区分使用）
- 应在 `resolved` 标志保护下确保清理只执行一次

---

### Failure #2: Ollama 并发请求导致 500 错误

**发现日期:** 2026-04-25
**严重程度:** 高
**影响范围:** 多用户同时请求 AI 讲解时

**现象:**
3+ 个用户同时做题并请求 AI 讲解时，部分用户收到 500 错误。

**根因分析:**
Ollama 的 `qwen3:8b` 模型在同一时刻只能处理一个推理请求。当 3 个请求同时到达时：
1. 第 1 个请求获得模型锁，正常返回
2. 第 2、3 个请求排队等待
3. 默认 20s 超时后触发了 `AbortSignal.timeout()`
4. 超时后的请求没有正确捕获错误，导致未处理的 Promise rejection

**修复方案:**
```typescript
// 确保所有 AI 请求都有 try-catch 包裹
const callOllama = async (prompt: string): Promise<string | null> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      // ...
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    // ...
  } catch {
    return null;  // 任何异常都静默回退，不抛给上游
  }
};
```

**修复位置:** [`backend/src/services/ai.ts:72-103`](backend/src/services/ai.ts#L72-L103)

**经验教训:**
- LLM 推理是 CPU/Memory 密集型操作，并发是真实瓶颈
- `AbortSignal.timeout()` 是防守措施，`try-catch` 是兜底
- 可用消息队列（如 BullMQ）实现请求排队，而非静默超时

---

### Failure #3: SQLite 数据库锁竞争导致写入失败

**发现日期:** 2026-05-02
**严重程度:** 中
**影响范围:** WebSocket PvP 对局结果写入

**现象:**
在并发 PvP 对局中，偶现对局记录丢失——数据库写入静默失败。

**根因分析:**
项目初期使用内存数组（`db.ts`）存储数据，后续迁移到 SQLite（`database.ts`）。但在过渡期间，WebSocket 层的 `handleMove` / `handleTimeout` 函数调用的是旧的内存操作函数，与 SQLite 并发写入机制不兼容。

具体问题：
- 旧代码直接在数组上 `push()`，不经过 SQLite 的事务管理
- SQLite 的 WAL 模式下高并发写入需要 `BEGIN IMMEDIATE` 事务控制

**修复方案:**
1. 将 WebSocket 层的所有数据操作迁移到 `database.ts` 的函数
2. 在 SQLite 中启用 WAL 模式：`PRAGMA journal_mode = WAL`
3. 对关键写入操作添加事务包装

```typescript
// database.ts
sqlite.pragma("journal_mode = WAL");     // Write-Ahead Logging
sqlite.pragma("foreign_keys = ON");      // 参照完整性
sqlite.pragma("busy_timeout = 5000");    // 写锁等待 5s
```

**修复位置:** [`backend/src/services/database.ts:42-43`](backend/src/services/database.ts#L42-L43)

**经验教训:**
- 存储层迁移需要全量回归测试
- SQLite WAL 模式是并发场景的最佳实践
- `busy_timeout` 是 SQLite 并发写入的保底方案

---

### Failure #4: AI 输出内容超出预期格式

**发现日期:** 2026-05-08
**严重程度:** 低
**影响范围:** 前端 AI 讲解展示异常

**现象:**
少数情况下，AI 讲解输出包含 Markdown 标记（如 `**bold**`、`1. ` 编号），前端未做 Markdown 渲染，导致展示异常。

**根因分析:**
虽然 System Prompt 明确要求"不要输出 Markdown 和编号"，但在某些情况下模型仍然产出带格式的文本：
- Qwen 的 API 默认训练数据中包含大量 Markdown 格式
- 当知识点的解释需要列表时，模型倾向于用 Markdown 列表
- Prompt 约束不是 100% 可靠的

**修复方案:**
1. **前端增强**：添加简单的 Markdown 清理函数
2. **Prompt 强化**：在 User Prompt 最后追加 "不要输出任何 Markdown 格式标记（如 **, *, 1., #, -）"
3. **后处理**：在后端增加 `stripMarkdown()` 过滤

```typescript
// 添加在 safeText() 之后
const stripMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s/gm, '')
    .replace(/^[\d]+\.\s/gm, '');
};
```

**修复位置:** `ai.ts` — 输出后处理层

**经验教训:**
- Prompt Engineering 的约束是"建议"而非"保证"
- 永远在输出端加后处理/校验，不依赖 LLM 100% 遵守指令
- 前端的鲁棒性同样重要——不能假设 AI 输出始终符合预期格式

---

### Failure #5: WebSocket 重连导致状态不同步

**发现日期:** 2026-05-12
**严重程度:** 高
**影响范围:** PvP 对局中一方短暂断网

**现象:**
用户在 4G/WiFi 切换时短暂断网（<5s），WebSocket 重连后棋盘状态与服务器不一致。用户看到的棋盘少了对手走的一步棋。

**根因分析:**
1. 用户 A 走棋 → 服务器广播 `game_state` → 用户 B 收到
2. 用户 A 此时网络抖动，WebSocket 断开
3. 用户 A 重连 → `auth` 消息 → 服务器发送**当前** `roomState`
4. 但用户 A 的本地棋盘在断线时没有正确处理重连后的状态同步

问题在于：重连后客户端需要**全量替换**本地状态，而不是**增量合并**。

**修复方案:**
```typescript
// websocket.ts — 重连时发送完整状态
case "auth": {
  // ... 验证 token ...
  // 重新加入此用户参与的所有活跃房间
  for (const [roomId, members] of roomClients) {
    if (members.has(userId)) {
      const room = db.gameRooms.find((r) => r.id === roomId);
      if (room && room.status === "playing") {
        send(socket, roomStateMessage(room));  // 全量同步
      }
    }
  }
}
```

前端同步逻辑：
```javascript
// app.js — 收到 game_state 时全量设置
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'game_state') {
    // 全量替换：FEN, PGN, turn, time, status
    board.position(msg.payload.fen);
    updateClock(msg.payload.white, msg.payload.black);
    updatePGN(msg.payload.pgn);
  }
};
```

**修复位置:** [`backend/src/services/websocket.ts:522-533`](backend/src/services/websocket.ts#L522-L533)

**经验教训:**
- 实时应用中，"全量同步"比"增量同步"更安全
- 重连逻辑需要在服务端和客户端双端验证
- WebSocket 状态同步应始终以服务器为准（Server is the source of truth）

---

## AI 功能专项测试

### Agent 1: 解题教练测试

| 测试场景 | 输入 | 期望输出 | 结果 |
|---------|------|---------|------|
| 正确回答简单题 | 一步杀 + 正确 | 4 段讲解 + 鼓励 | ✅ |
| 错误回答简单题 | 一步杀 + 错误 | 4 段讲解 + 标准答案提示 | ✅ |
| 正确回答困难题 | 三步以上组合 | 思路分步详细 | ✅ |
| Ollama 不可用 | 任意 | fallbackExplain 模板 | ✅ |
| Qwen API 不可用 | 任意 | fallbackExplain 模板 | ✅ |

### Agent 2: 对局复盘师测试

| 测试场景 | 输入 | 期望输出 | 结果 |
|---------|------|---------|------|
| 完整短对局 | 15 手 PGN | 3 段复盘 | ✅ |
| 完整长对局 | 60 手 PGN | 3 段复盘 + 精简关键着法 | ✅ |
| 空 PGN | "" | "暂无对局数据" | ✅ |
| 无效 PGN | 乱码 | "PGN 格式解析失败" | ✅ |
| 全对局无关键着法 | 15 手无吃子/将军 | 3 段 + 通用建议 | ✅ |

### Agent 3: 学习顾问测试

| 测试场景 | 输入 | 期望输出 | 结果 |
|---------|------|---------|------|
| 本周活跃学生 | 15 题 + 5 局 | 温暖评语 + 鼓励 | ✅ |
| 本周未训练学生 | 0 题 + 0 局 | 提醒训练 + 建议 | ✅ |
| 本周进步明显 | 积分 +200 | 强调进步亮点 | ✅ |
| Ollama 不可用 | 任意 | 条件化 fallback | ✅ |

---

## 经验教训总结

### 核心教训

1. **LLM 不可靠是常态**：Prompt 是建议不是命令。永远在输出端加后处理和校验。
2. **Fallback 是第一优先级**：面向真实用户的产品，Fallback 比功能更重要。
3. **并发是真问题**：LLM 推理是瓶颈。小型项目用 timeout + fallback 即可，不需要过度设计消息队列。
4. **状态同步以服务端为准**：WebSocket 场景下，全量同步比增量同步更可靠。
5. **存储迁移需要全量回归**：从内存到 SQLite 的迁移暴露了多处数据不一致。

### 技术债务

- [ ] Ollama 并发请求排队机制
- [ ] AI 输出质量自动评估
- [ ] 端到端自动化测试套件
- [ ] 浏览器端 E2E 测试（Playwright）

---

<p align="center">
  <b>Chesstong · Test & Failure Log</b><br>
  <sub>每一次失败都是系统更健壮的机会。</sub>
</p>
