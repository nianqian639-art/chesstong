# LLM Engineering Notes — Chesstong 国际象棋智能学习平台

> **CULIU TECH · LLM 工程暑期作品集**
>
> 本文档详细记录 Chesstong 项目中 **8 个 LLM 工程核心维度**的设计思路、实现细节、代码位置与经验总结。

---

## 目录

1. [Prompt Engineering](#1-prompt-engineering)
2. [RAG（检索增强生成）](#2-rag检索增强生成)
3. [Tool Calling](#3-tool-calling)
4. [Memory](#4-memory)
5. [Agent](#5-agent)
6. [Multi-Agent](#6-multi-agent)
7. [Safety Guard](#7-safety-guard)
8. [Fallback](#8-fallback)
9. [总结与展望](#9-总结与展望)

---

## 1. Prompt Engineering

### 1.1 设计理念

在 Chesstong 中，Prompt 不是一次性写好就固定的文本，而是根据**角色、场景、用户状态**动态构建的系统指令。核心原则：

- **角色锚定**：每个 Prompt 都明确定义 AI 扮演的角色（少儿教练 / 复盘师 / 学习顾问）
- **结构约束**：用明确的输出格式规范控制回复结构，便于前端解析展示
- **安全边界**：通过 Prompt 本身限制输出范围（"不输出与棋题无关内容"）
- **语言适配**：强制中文输出，面向中国少儿国际象棋初学者

### 1.2 三组核心 Prompt 设计

#### Agent 1: 解题教练（`generateExplanation`）

**System Prompt:**
```
你是少儿国际象棋教练，请用中文输出。
输出格式必须是4段：思路分步、关键点、常见误区、类似题建议。
语言积极、简洁，不输出任何与棋题无关内容。
```

**User Prompt（动态构建）:**
```
题目：${input.question}
知识点：${input.knowledgePoint}
学生答案是否正确：${input.isCorrect ? "是" : "否"}
标准参考答案：${input.answer}
```

**设计要点:**
- **4 段结构化输出**强制 AI 不能只给"对/错"——必须拆解思路
- **isCorrect 条件分支**让 AI 根据学生作答情况调整回复语气和侧重点
- **knowledgePoint 注入**让 AI 围绕当前知识点展开，避免泛泛而谈
- `temperature: 0.35` 在创造性和专业性之间取得平衡
- `num_predict: 360` 限制生成长度，防止过长的解释让初学者困惑

**代码位置:** [`backend/src/services/ai.ts:105-134`](backend/src/services/ai.ts#L105-L134)

---

#### Agent 2: 对局复盘师（`generatePgnAnalysis`）

**User Prompt（结构化多段）:**
```
请输出三段中文内容：
1) 对局总评（不超过80字）
2) 两个关键问题
3) 下次训练建议（2条）
不要输出Markdown和编号，直接分段。

PGN:
${input.pgn}

关键着法摘要:
${keyLines}

本地分析摘要:
${input.localSummary}
```

**设计要点:**
- **字数限制**（80字总评）确保 AI 回复精炼，适合少儿阅读
- **去 Markdown 约束**确保输出纯文本，前端可自由格式化
- **多源输入融合**：PGN 棋谱 + 引擎关键着法 + 本地规则分析 → 综合复盘
- `temperature: 0.35` 保持一致性和可预测性

**代码位置:** [`backend/src/services/ai.ts:136-185`](backend/src/services/ai.ts#L136-L185)

---

#### Agent 3: 学习顾问（`generateWeeklyCommentary`）

**温度 Prompt（温暖、鼓励、具体）:**
```
你是一位温暖、专业的国际象棋学习顾问，正在为家长写一份简短的学生周报评语。
请根据下面的学习数据，用中文写一段80-150字的评语，包含：
1) 对学生本周表现的整体评价（鼓励为主）
2) 1-2个亮点或进步
3) 1-2条具体的改进建议
语气要温暖、鼓励、具体，像老师在和家长聊天，不要用序号或格式标记。
```

**设计要点:**
- **受众切换**：从"对学生的"教练→"对家长的"顾问，语气从指导变为沟通
- **数据注入**：将解题数、对局数、胜率、积分变化等结构数据序列化为自然语言
- **结构约束**：三段式（评价 + 亮点 + 建议），家长可快速定位信息
- **风格约束**："像聊天"而非"像报告"，提升家长阅读体验

**代码位置:** [`backend/src/services/ai.ts:189-246`](backend/src/services/ai.ts#L189-L246)

---

### 1.3 Prompt 设计原则总结

| 原则 | 实现方式 | 对应代码 |
|------|---------|---------|
| **角色锚定** | System Prompt 定义角色身份 + 输出风格 | `ai.ts` 3 组角色定义 |
| **结构约束** | 强制分段输出（4段/3段）+ 字数限制 | `num_predict: 360` |
| **动态注入** | 将用户状态/数据序列化后拼入 User Prompt | 题目/对局/周报数据注入 |
| **温度控制** | `temperature: 0.35` 平衡专业性与可读性 | Ollama + Qwen 参数 |
| **安全边界** | "不输出与棋题无关内容" + 禁止 Markdown | System Prompt 约束 |

---

## 2. RAG（检索增强生成）

### 2.1 设计理念

Chesstong 的 RAG 采用的是**结构化知识库 + 语义学习路径**的方式。虽然不是传统的向量检索 RAG，但在象棋学习这个垂直领域，**结构化知识图谱比向量检索更有效**——因为知识之间有明确的层级关系和前置依赖。

### 2.2 知识库架构

**知识组织结构:**
```
learningTopics[]
├── Section 1: 开局原则 (5课)
│   ├── pr-01: 争夺中心
│   ├── pr-02: 快速出子
│   ├── pr-03: 王车易位
│   ├── pr-04: 避免重复走子
│   └── pr-05: 开局常见错误总览
├── Section 2: 中局战略 (3课)
│   ├── ma-01: 战术组合基础
│   ├── ma-02: 开放线与半开放线
│   └── ma-03: 弱格与强格
└── Section 3: 残局基础 (3课)
    ├── eg-01: 单后杀王
    ├── eg-02: 单车杀王
    └── eg-03: 兵残局基础
```

**每课数据结构:**
```typescript
interface LearningTopic {
  id: string;           // 唯一标识，如 "pr-01"
  title: string;        // 课题名称
  category: string;     // 分类："principles" | "middlegame" | "endgame"
  section: string;      // 所属章节
  difficulty: number;   // 难度 1-5
  content: string;      // HTML 富文本教学内容
  keyFen?: string;      // 关键局面 FEN，前端渲染交互棋盘
  keyMoves?: string[];  // 关键走法
  tips: string[];       // 学习提示（用于检索增强）
}
```

**代码位置:** [`backend/src/data/learning-content.ts`](backend/src/data/learning-content.ts)

---

### 2.3 知识检索 + AI 增强流程

```
用户选择课题
    │
    ▼
┌─────────────────┐
│ 本地知识库检索   │ ← 按 section + difficulty 索引
│ 返回结构化内容   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 交互式棋盘渲染   │ ← keyFen → Chessboard.js 渲染
│ HTML 内容展示    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 关联题目推荐     │ ← 同 knowledgePoint 的 puzzle
│ 用户做题         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI 增强讲解      │ ← Prompt 注入 knowledgePoint
│ 个性化反馈       │
└─────────────────┘
```

### 2.4 题库与知识的关联

300+ 道战术题中的每道题都标注了 `knowledgePoint`，与学习内容的 `title` 关联：
- 学完"争夺中心"→ 推荐知识点为"中心控制"的题目
- 做题时 AI 讲解自动引用相关学习内容
- 形成"学习 → 练习 → AI 讲解 → 复习"的闭环

**代码位置:** [`backend/src/data/puzzles.ts`](backend/src/data/puzzles.ts) — `knowledgePoint` 字段

---

## 3. Tool Calling

### 3.1 设计理念

Chesstong 的 Tool Calling 不是传统 Function Calling API，而是**架构层面的 AI 与外部工具协作**——LLM 负责"理解和解释"，Stockfish 引擎负责"计算和走棋"。两者通过明确的服务边界和回退策略协同工作。

### 3.2 双引擎架构

```
用户下棋请求
    │
    ▼
┌──────────────────────┐
│ Backend /match/move  │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Step 1: Stockfish HTTP 服务  │ ← STOCKFISH_SERVICE_URL
│ POST /best-move {fen, diff}  │   超时 3s
│ 成功 → 返回 SAN 格式走法     │
└────────┬─────────────────────┘
         │ 失败/超时
         ▼
┌──────────────────────────────┐
│ Step 2: 本地 Stockfish 二进制│ ← spawn + UCI 协议
│ uci → isready → position fen  │   超时 3.5s，深度 = diff+6
│ → go depth N → bestmove       │
│ 成功 → UCI 转 SAN             │
└────────┬─────────────────────┘
         │ 失败
         ▼
┌──────────────────────────────┐
│ Step 3: 本地规则引擎         │ ← chess.js 本地评估
│ 按难度排序走法（优先吃子）    │   0 延迟
│ 低难度 = 随机，高难度 = 最优 │
└──────────────────────────────┘
```

**代码位置:** [`backend/src/services/chess.ts:100-261`](backend/src/services/chess.ts#L100-L261)

---

### 3.3 引擎通信协议（UCI）

与 Stockfish 的通信采用标准 **UCI（Universal Chess Interface）协议**：

```
发送: uci
接收: uciok
发送: isready
接收: readyok
发送: position fen <FEN字符串>
发送: go depth <深度>
接收: bestmove <走法>
```

**UCI 协议实现:** [`backend/src/services/chess.ts:158-215`](backend/src/services/chess.ts#L158-L215)

### 3.4 Tool Calling 与 AI 的协作

| 场景 | Tool（引擎） | AI（LLM） |
|------|-------------|-----------|
| **走法计算** | Stockfish 计算最优走法 | — |
| **走法解释** | — | Ollama/Qwen 用中文解释为何走这步 |
| **局面分析** | chess.js 本地评估（吃子/将军/升变） | Ollama/Qwen 综合生成复盘报告 |
| **建议走法** | Stockfish 给出 best move | Ollama/Qwen 补充"为什么"和"下一步计划" |

**走法建议 API** 展示了 Tool + AI 协作的完整流程：

```
POST /match/suggest  { fen, difficulty }
  → Stockfish 计算 bestmove
  → chess.js 判断走法类型（吃子/将军/发展）
  → 生成规则建议理由
  → 返回: { move, source, reason, plan[] }
```

**代码位置:** [`backend/src/services/chess.ts:304-349`](backend/src/services/chess.ts#L304-L349)

---

## 4. Memory

### 4.1 设计理念

Chesstong 的 Memory 体系是一个**多层级、渐进式**的记忆架构。从短期的会话状态到长期的用户画像，每一层都为 AI 提供上下文，让 AI 的回复越来越个性化。

### 4.2 四层记忆架构

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: 会话记忆 (Session Memory)                   │
│ ├─ token → userId 映射（内存 Map）                    │
│ ├─ WebSocket 连接状态（在线/离线/游戏中）              │
│ └─ 房间状态（对局中 FEN/PGN/棋钟）                    │
│ 生命周期: 单次会话 | 存储: 内存 + SQLite sessions 表  │
├─────────────────────────────────────────────────────┤
│ Layer 2: 交互记忆 (Interaction Memory)               │
│ ├─ 做题记录（ProblemAttempt: 题目/答案/正确/时间）     │
│ ├─ 对局记录（MatchRecord: PGN/结果/难度）             │
│ └─ 错题收集（用于后续针对性训练）                     │
│ 生命周期: 永久 | 存储: SQLite                         │
├─────────────────────────────────────────────────────┤
│ Layer 3: 学习轨迹 (Learning Trajectory)               │
│ ├─ 积分变化（PointLedgerEntry: 来源/数量/时间）       │
│ ├─ 段位晋升（Rank advancement history）               │
│ ├─ 学习计划（StudyPlan: 目标/进度/截止）              │
│ └─ 周报记录（WeeklyReport: 数据快照 + AI 评语）       │
│ 生命周期: 永久 | 存储: SQLite                         │
├─────────────────────────────────────────────────────┤
│ Layer 4: 社交画像 (Social Profile)                    │
│ ├─ 好友关系（FriendRelation: 双向/屏蔽）              │
│ ├─ 聊天历史（ChatMessage: 已读/未读）                 │
│ └─ 对局邀请（GameRequest: 发送/接受/过期）            │
│ 生命周期: 永久 | 存储: SQLite                         │
└─────────────────────────────────────────────────────┘
```

**代码位置:** [`backend/src/services/database.ts`](backend/src/services/database.ts) — 12 张表完整定义

---

### 4.3 Memory 如何增强 AI 回复

| AI 场景 | 使用的 Memory 层 | 增强效果 |
|---------|-----------------|---------|
| **解题讲解** | Layer 2: 历史错题 → Prompt 注入知识点 | "你之前在这个知识点错过2次，注意..." |
| **对局复盘** | Layer 3: PGN 历史 → 对比进步 | "和上周相比，你的中局控制更稳定了" |
| **周报评语** | Layer 3: 全量周数据 → AI 评语 | 个性化鼓励 + 针对性建议 |
| **难度推荐** | Layer 2+3: 做题/对战记录 | 动态调整题目难度和对局引擎等级 |

### 4.4 技术实现细节

**SQLite WAL 模式:**
```typescript
sqlite.pragma("journal_mode = WAL");    // 支持并发读写
sqlite.pragma("foreign_keys = ON");     // 参照完整性
```

**JSON 列存储灵活数据:**
```typescript
jsonColumns: ["childIds", "classIds", "acceptedAnswers", "hints", "themes"]
// SQLite 原生 JSON 函数支持查询 JSON 列内部字段
```

**内存 Map 加速热数据:**
```typescript
const connections = new Map<string, WebSocket>();     // 在线用户连接
const roomClients = new Map<string, Set<string>>();   // 房间成员
const disconnectTimers = new Map<string, Timeout>();  // 断线计时器
```

---

## 5. Agent

### 5.1 设计理念

Chesstong 实现了**三个独立的 AI Agent**，每个 Agent 有明确的角色定义、输入输出规范和调用时机。这不是一个通用 chatbot，而是**三个有明确职责边界的专业 Agent**。

### 5.2 三个 Agent 详解

#### 🎓 Agent 1: 解题教练（Explanation Agent）

| 属性 | 说明 |
|------|------|
| **触发条件** | 学生提交题目答案后 |
| **输入** | 题目文本 + 知识点 + 学生答案 + 正确性 |
| **输出** | 结构化的 4 段讲解 |
| **System Prompt** | "你是少儿国际象棋教练..." |
| **模型** | Ollama qwen3:8b / Qwen API |
| **Temperature** | 0.35 |
| **Max Tokens** | 360 |

**职责:** 把专业棋语翻译成孩子能听懂的话，不只是告诉对错。

#### 🔍 Agent 2: 对局复盘师（Analysis Agent）

| 属性 | 说明 |
|------|------|
| **触发条件** | 用户完成一局对战后 |
| **输入** | 完整 PGN + 关键着法标记 + 本地分析摘要 |
| **输出** | 结构化 3 段复盘报告 |
| **System Prompt** | "你是青少年国际象棋教练，复盘语言具体、鼓励、可执行" |
| **模型** | Ollama qwen3:8b / Qwen API |
| **Temperature** | 0.35 |

**职责:** 不只是说"哪步错了"，而是给出可执行的改进方案。

#### 💌 Agent 3: 学习顾问（Weekly Report Agent）

| 属性 | 说明 |
|------|------|
| **触发条件** | 家长查看孩子周报时 |
| **输入** | 本周全部学习数据（解题/对战/积分/段位） |
| **输出** | 80-150 字温暖评语 |
| **System Prompt** | "你是一位温暖、专业的国际象棋学习顾问..." |
| **模型** | Ollama qwen3:8b / Qwen API |

**职责:** 桥接"家长不懂棋"和"想知道孩子学得怎样"之间的鸿沟。

---

### 5.3 Agent 调度流程

```
                    ┌──────────────┐
                    │  用户行为     │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ 提交题目    │  │ 完成对局    │  │ 查看周报    │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Agent 1    │  │ Agent 2    │  │ Agent 3    │
    │ 解题教练   │  │ 复盘师     │  │ 学习顾问   │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          ▼               ▼               ▼
    ┌────────────────────────────────────────────┐
    │           统一 Fallback 层                  │
    │  Ollama → Qwen API → 确定性本地文本         │
    └────────────────────────────────────────────┘
```

**代码位置:** Agent 路由在 [`backend/src/services/ai.ts`](backend/src/services/ai.ts) — `generateExplanation`, `generatePgnAnalysis`, `generateWeeklyCommentary`

---

## 6. Multi-Agent

### 6.1 设计理念

Chesstong 的 Multi-Agent 不是多个 LLM Agent 之间直接对话，而是**多个 Agent 通过共享数据库和事件系统间接协作**。这种设计更适合教育场景——Agent 之间不需要"对话"，而是"接力"。

### 6.2 Agent 协作架构

```
┌──────────────────────────────────────────────┐
│                 共享数据库                      │
│  users | problems | matches | weekly_reports  │
│  sessions | classes | chat_messages | ...     │
└────┬──────────┬──────────┬───────────────────┘
     │          │          │
     ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Agent 1  │ │Agent 2  │ │Agent 3  │
│解题教练 │ │复盘师   │ │学习顾问 │
└────┬────┘ └────┬────┘ └────┬────┘
     │          │          │
     │  写入    │  写入    │  写入
     ▼          ▼          ▼
┌──────────────────────────────────────────────┐
│  ProblemAttempt  MatchRecord  WeeklyReport   │
│  (Agent 1 输出)  (Agent 2 输入) (Agent 3 输入) │
└──────────────────────────────────────────────┘
     │          │          │
     └──────────┼──────────┘
                │ 聚合
                ▼
         ┌─────────────┐
         │ Agent 3 周报 │ ← 汇总所有 Agent 的输出
         │ 综合生成评语 │
         └─────────────┘
```

### 6.3 Agent 协作场景

| 场景 | 协作方式 | 数据流 |
|------|---------|--------|
| **学习闭环** | Agent 1 记录错题 → Agent 3 统计薄弱点 → Agent 1 下次讲解引用 | ProblemAttempt → WeeklyReport → Prompt |
| **对局→训练** | Agent 2 分析漏洞 → 推荐相关题目 → Agent 1 讲解相关知识点 | MatchRecord → Puzzle Recommendation |
| **周报生成** | Agent 3 聚合 Agent 1+2 的全部输出 → 综合评语 | All records → AI Commentary |

### 6.4 实时 Multi-Agent 通信（WebSocket）

WebSocket 层实现了**多用户实时 Agent 协作**：
- 对局双方看到的是同一个"局面 Agent"的输出
- 断线检测触发"监督 Agent"计时
- 聊天系统是"社交 Agent"的消息路由

**代码位置:** [`backend/src/services/websocket.ts`](backend/src/services/websocket.ts) — 完整 WebSocket 消息路由

---

## 7. Safety Guard

### 7.1 设计理念

Chesstong 面向 4-10 岁少儿用户，安全是最高优先级。安全防护不依赖单一机制，而是**纵深防御**：

### 7.2 四层安全防护

```
用户请求
    │
    ▼
┌──────────────────────────────┐
│ Layer 1: 认证与授权          │
│ ├─ JWT Token 验证（所有 API）│
│ ├─ 角色权限控制（学生/家长/老师）│
│ └─ WebSocket auth 握手       │
│ 代码: middleware/auth.ts      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Layer 2: 内容安全过滤        │
│ ├─ bannedKeywords 黑名单     │
│ ├─ safeText() 输出校验       │
│ └─ 不通过 → 丢弃，启用回退   │
│ 代码: ai.ts:28-30            │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Layer 3: 超时熔断            │
│ ├─ AI_TIMEOUT_MS: 20s        │
│ ├─ ENGINE_TIMEOUT_MS: 3s     │
│ ├─ STOCKFISH_TIMEOUT_MS: 3.5s│
│ └─ AbortSignal.timeout()     │
│ 代码: ai.ts:7, chess.ts:8-10 │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Layer 4: Prompt 安全约束     │
│ ├─ "不输出与棋题无关内容"    │
│ ├─ 角色边界限制（少儿教练）  │
│ └─ 输出格式强制（4段/3段）   │
│ 代码: ai.ts System Prompts   │
└──────────────────────────────┘
```

### 7.3 安全实现详解

**关键词过滤:**
```typescript
const bannedKeywords = ["政治敏感", "暴力鼓动", "不良引导"];

const safeText = (text: string): boolean => {
  return !bannedKeywords.some((item) => text.includes(item));
};
```
AI 输出在返回用户之前，必须通过 `safeText()` 校验。不通过的输出被丢弃，自动切换到 fallback 响应。

**超时熔断:**
```typescript
signal: AbortSignal.timeout(AI_TIMEOUT_MS)   // 20s 硬超时
```
每个 AI 请求都有独立超时，防止单个请求阻塞整个服务。

**认证中间件:**
所有 API 请求通过 Bearer Token 验证身份，WebSocket 连接也需要先发送 `auth` 消息完成认证才能进行后续操作。

**代码位置:** [`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts), [`backend/src/services/ai.ts:28-30`](backend/src/services/ai.ts#L28-L30)

---

## 8. Fallback

### 8.1 设计理念

Chesstong 面向的是真实用户（少儿学生和家长），**服务必须7×24小时可用**。当 AI 模型或引擎不可用时，系统必须优雅降级，不能让用户看到报错页面或空白。

### 8.2 全链路回退策略

```
每个 AI 功能点都设计了 3-4 级回退：

┌─────────────────────────────┐
│ Tier 1: 优先路径             │
│ Ollama 本地模型 (qwen3:8b)  │ ← 默认，最快速
├─────────────────────────────┤
│ Tier 2: 云端回退            │
│ Qwen API (qwen-plus-latest) │ ← 需要 API Key
├─────────────────────────────┤
│ Tier 3: 规则引擎            │
│ 确定性本地文本 / chess.js   │ ← 永远可用
├─────────────────────────────┤
│ (引擎) Tier 4: 本地二进制   │
│ spawn Stockfish + UCI       │ ← 引擎专属
└─────────────────────────────┘
```

### 8.3 各功能 Fallback 实现

#### AI 解题讲解 Fallback

```typescript
const fallbackExplain = (input: ExplainInput): string => {
  return [
    `思路分步：先识别题型与关键子力关系，再计算1-2步强制变化。`,
    `关键点：本题核心知识点是【${input.knowledgePoint}】。`,
    `常见误区：只看一步将军、不检查对方反击。`,
    `类似题建议：做3道同知识点题并复盘错因。`,
    `本题结果：你的答案${input.isCorrect ? "正确" : "暂未命中标准解"}。标准参考：${input.answer}`
  ].join("\n");
};
```

即使 Ollama 和 Qwen API 同时不可用，学生仍能得到结构化的、有用的反馈。

#### Stockfish 引擎 Fallback（3 级）

```
Tier 1: HTTP 服务 → Tier 2: 本地 UCI 子进程 → Tier 3: chess.js 规则引擎
```

`localEngineMove()` 函数实现了纯 JavaScript 回退——按难度排序走法，优先选择吃子走法，确保在没有 Stockfish 的情况下也能下棋。

**代码位置:** [`backend/src/services/chess.ts:100-116`](backend/src/services/chess.ts#L100-L116)

#### 周报评语 Fallback

```typescript
const fallback = input.solveCount > 0
  ? `${input.studentName}本周完成了${input.solveCount}道题目和${input.battleCount}局对战，表现不错！继续保持训练节奏...`
  : `${input.studentName}本周还没有开始训练哦。建议每天至少完成2道题目和1局对战...`;
```

条件化的 fallback 文本——根据不同数据给出不同的鼓励话术。

**代码位置:** [`backend/src/services/ai.ts:240-246`](backend/src/services/ai.ts#L240-L246)

---

### 8.4 所有回退路径汇总

| 功能 | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|------|--------|--------|--------|--------|
| **AI 讲解** | Ollama | Qwen API | `fallbackExplain()` | — |
| **PGN 复盘** | Ollama | Qwen API | `fallback` + 本地摘要 | — |
| **周报评语** | Ollama | Qwen API | 条件化 fallback 文本 | — |
| **引擎走法** | HTTP 服务 | 本地 Stockfish + UCI | `localEngineMove()` | — |
| **走法建议** | HTTP 服务 + chess.js 分析 | 本地 Stockfish + chess.js | chess.js only | — |

---

## 9. 总结与展望

### 9.1 项目 LLM 工程核心优势

| 维度 | 核心优势 |
|------|---------|
| **Prompt** | 3 组场景化 Prompt，结构化输出约束，动态数据注入 |
| **RAG** | 结构化棋艺知识库 + 题库关联 + 学习闭环 |
| **Tool** | 双引擎架构 + UCI 协议 + 走法类型识别 |
| **Memory** | 4 层记忆体系：会话→交互→轨迹→社交 |
| **Agent** | 3 个独立 Agent，明确边界，专业化分工 |
| **Multi-Agent** | 数据库驱动协作 + WebSocket 实时通信 |
| **Safety** | 4 层纵深防御：认证→过滤→熔断→Prompt |
| **Fallback** | 全链路 3-4 级回退，服务永不中断 |

### 9.2 未来规划

- [ ] **向量化 RAG**: 将学习内容 Embedding 化，支持自然语言搜索
- [ ] **Function Calling**: 升级到原生 Function Calling API，让 AI 自主决定是否调用 Stockfish
- [ ] **Agentic Loop**: 实现 AI 驱动的自适应学习路径（观察→计划→执行→反思）
- [ ] **Multi-Modal**: 支持棋盘图片识别 + 语音问答
- [ ] **Evaluation Framework**: 建立 AI 回复质量自动评估体系

---

<p align="center">
  <b>Chesstong · LLM Engineering Portfolio</b><br>
  <sub>每一个维度都经过真实用户场景的设计和验证。</sub>
</p>
