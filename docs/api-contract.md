# API Contract (MVP v0.1)

Base URL: `http://localhost:8080`
Auth: `Authorization: Bearer <token>` (except register/login)

## Demo Page
### GET /demo
浏览器本地演示页（Mac 主入口，直接串联登录、点击棋盘做题、AI讲解、Stockfish 对战）。

## Auth
### POST /auth/register
```json
{
  "phone": "+8613800138000",
  "password": "secret123",
  "role": "student",
  "displayName": "小棋手"
}
```
### POST /auth/login
```json
{
  "phone": "+8613800138000",
  "password": "secret123"
}
```

## Problems
### GET /problems/list?gradeBand=15&difficulty=1
### POST /problems/submit
```json
{ "problemId": "starter-001", "answer": "a1a8" }
```
`answer` accepts SAN or UCI. Response includes `awardedPoints`, `alreadySolved`, and `correctUci`.
### POST /problems/explain
```json
{ "problemId": "starter-001", "answer": "a1a8", "isCorrect": true }
```
Uses local Ollama by default (`qwen3:8b`) and falls back to deterministic local text.

## Match
### POST /match/start
```json
{ "mode": "standard", "difficulty": 8 }
```
### POST /match/move
```json
{
  "matchId": "...",
  "fen": "...",
  "move": "e4",
  "difficulty": 8
}
```
Response includes `engineSource`, which is `stockfish` when the engine service is connected, otherwise `fallback`.
### POST /match/suggest
```json
{
  "fen": "...",
  "difficulty": 8
}
```
Response includes `source`, which is `stockfish` when the engine service is connected, otherwise `fallback`.
### POST /match/analyze
```json
{ "pgn": "1. e4 e5 2. Nf3 Nc6" }
```
Response includes `source`, which is `qwen` when Qwen analysis is connected, otherwise `fallback`.

## Missions & points
### GET /missions/today
### POST /missions/claim
```json
{ "missionId": "m-solve-3" }
```
### GET /points/ledger
### POST /shop/redeem
```json
{ "itemId": "skin-board-neon" }
```

## Parent/Class
### GET /parent/child-progress
### POST /class/task/create
```json
{
  "classId": "class-1",
  "title": "今日战术训练",
  "requiredSolveCount": 3,
  "dueDate": "2026-04-13T12:00:00.000Z"
}
```
### POST /class/notice/publish
```json
{ "classId": "class-1", "message": "请今晚8点前完成训练" }
```

## Ranking
### GET /rankings/global
### GET /rankings/class
