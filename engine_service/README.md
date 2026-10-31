# Stockfish Engine Service

Small HTTP wrapper around Stockfish for the Mac local Demo.

## Start

The service now searches the repository-local Stockfish package first:

- `../tools/stockfish/stockfish/src/stockfish`
- `../tools/stockfish/stockfish/stockfish*`

If you only have source code on macOS, build the local binary once:

```bash
cd ../tools/stockfish/stockfish/src
make -j build ARCH=apple-silicon COMP=clang
chmod +x stockfish
```

```bash
cp .env.example .env
npm install
npm run dev
```

Override path only when Stockfish is elsewhere:

```env
STOCKFISH_BIN=../tools/stockfish/stockfish/src/stockfish
```

When no executable binary is available the service stays online and returns fallback moves.

## API

- `GET /health`
- `POST /best-move`
