# Chess Learning Backend

Fastify + TypeScript backend for the Mac local browser Demo.

## Start

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:8080/demo`.

## Mac AI Defaults

The backend defaults to local Ollama for general generation. Puzzle explanations and follow-up questions prefer Qwen when `QWEN_API_KEY` or `DASHSCOPE_API_KEY` is configured; otherwise they use the configured AI provider and fall back to verified server-generated text if the model is unavailable.

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
STOCKFISH_SERVICE_URL=http://localhost:8081
```

`/problems/explain` and `/trial/problems/explain` send the server-judged answer, side to move, board pieces, puzzle solution, and verified Stockfish best move to Qwen. `/problems/ask` and `/trial/problems/ask` preserve the same evidence for follow-up questions. Invalid chess claims or incorrect answer judgments fall back to server-generated text. Stockfish's current service supplies a best move only, not an evaluation score or full line.

The release preflight checks for a real Qwen response and a Stockfish result before updating production. Configure `QWEN_API_KEY` or `DASHSCOPE_API_KEY` and a working `STOCKFISH_SERVICE_URL` in `.env.production` first.

## Stockfish

`/match/move` and `/match/suggest` call `STOCKFISH_SERVICE_URL` first, then fall back to a repository-local binary when available. The backend automatically searches:

- `../tools/stockfish/stockfish/src/stockfish`
- `../tools/stockfish/stockfish/stockfish*`

If the local package only has source code on macOS, build it once from the repo root:

```bash
cd tools/stockfish/stockfish/src
make -j build ARCH=apple-silicon COMP=clang
chmod +x stockfish
```

Set `STOCKFISH_BIN` only when the executable lives somewhere else.

## Optional Qwen API

```env
AI_PROVIDER=qwen
QWEN_API_KEY=sk-xxx
QWEN_MODEL=qwen-plus-latest
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## Puzzle Import

Built-in puzzles live in `src/data/puzzles.ts`. To regenerate from Lichess Puzzle Database CSV:

```bash
npm run import:puzzles -- /path/to/lichess_db_puzzle.csv 30
```

The importer filters beginner-friendly tactical themes and writes the selected set into `src/data/puzzles.ts`.

## APIs

- Auth: `/auth/register`, `/auth/login`
- Problems: `/problems/list`, `/problems/submit`, `/problems/explain`
- Match: `/match/start`, `/match/move`, `/match/suggest`, `/match/analyze`
- Missions & points: `/missions/today`, `/missions/claim`, `/points/ledger`, `/shop/redeem`
- Parent/class: `/parent/child-progress`, `/class/task/create`, `/class/notice/publish`
- Rankings: `/rankings/global`, `/rankings/class`
