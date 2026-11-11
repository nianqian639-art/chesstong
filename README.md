# 棋童 Chesstong

面向儿童国际象棋学习的 AI 辅助训练与教学协作平台。项目希望把棋局分析转化为易理解的讲解，并为学生、家长和教师提供连续的练习与反馈。

## 项目目标

初学者常常只能看到答案对错，却难以理解一着棋为什么好或不好；家长不一定熟悉国际象棋，教师也需要花费大量时间跟进课后练习。棋童尝试用交互式棋盘、AI 讲解、引擎分析和学习记录，让练习反馈更及时，并让家庭与课堂中的学习协作更清楚。

## 主要功能

- 分级棋题、交互式棋盘和即时答案反馈
- 基于通义千问服务的棋局讲解、建议与复盘
- 基于 Stockfish 的走法分析和人机对弈
- 实时双人对局、聊天和好友挑战
- 教师班级、棋盘作业、注释与学习进度
- 家长绑定、学习任务、训练计划和周报
- 未登录试用入口及账号学习功能

## 技术组成

- 后端：Node.js、Fastify、TypeScript、SQLite
- 实时通信：WebSocket
- 棋力分析：Stockfish UCI 引擎
- AI 服务：通义千问 API（需自行配置密钥）
- Web：原生 JavaScript、HTML、CSS
- 移动端代码：Flutter

## 目录

- `backend/`：HTTP API、WebSocket、Web 前端和测试
- `engine_service/`：Stockfish 引擎服务
- `flutter_app/`：Flutter 客户端
- `tools/stockfish/`：Stockfish 源码及构建文件

## 本地开发

需要 Node.js 22 或更新版本。不要把真实 API 密钥、生产环境配置或数据库文件提交到仓库。

```bash
cd backend
npm ci
cp .env.example .env
npm test
npm run build
```

按 `backend/.env.example` 配置本地服务。引擎服务也提供自己的 `.env.example`；Stockfish 可按其源码目录内的说明在本机编译。完整部署方式见各子项目 README。

## 项目进展

项目由个人独立开发，目前处于测试阶段。正在根据实际使用反馈，继续完善题目交互、家长与教师流程、实时对局及 AI 讲解体验。

## 项目海报

- [打印版海报 PDF（36 × 48 英寸）](output/poster/chesstong-project-poster.pdf)
- [可编辑海报 PPTX](output/poster/chesstong-project-poster.pptx)
- [海报预览 PNG](output/poster/chesstong-project-poster-preview.png)

本机保留的演讲稿历史版本位于 `output/pptx/`，不纳入 Git 版本控制。

## 演示

- 在线体验：<https://chesstong.top>
- 仓库地址：<https://github.com/nianqian639-art/chesstong>

## 第三方组件

Stockfish 使用其上游项目提供的许可证，见 `tools/stockfish/stockfish/Copying.txt`。发布前请继续核对其他依赖、字体和素材的许可要求。
