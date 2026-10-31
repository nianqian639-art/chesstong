
(function () {
  var token = "";
  var matchId = "";
  var fen = "";
  var selected = "";
  var moves = [];
  var pieceMap = {
    p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
    P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
  };

  function byId(id) { return document.getElementById(id); }

  function setStatus(text) { byId("status").textContent = text; }

  function api(path, method, body, authed) {
    return fetch(path, {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authed === false ? "" : (token ? "Bearer " + token : "")
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (raw) {
        var data;
        try { data = raw ? JSON.parse(raw) : {}; } catch (_e) { throw new Error("接口返回异常: " + raw); }
        if (!res.ok) throw new Error(data.message || ("请求失败(" + res.status + ")"));
        return data;
      });
    });
  }

  function parseBoard(fenText) {
    var rows = (fenText || "8/8/8/8/8/8/8/8").split(" ")[0].split("/");
    return rows.map(function (r) {
      var line = [];
      for (var i = 0; i < r.length; i++) {
        var ch = r[i];
        if (ch >= "0" && ch <= "9") {
          var n = Number(ch);
          for (var j = 0; j < n; j++) line.push("");
        } else {
          line.push(ch);
        }
      }
      return line;
    });
  }

  function sqName(row, col) {
    return "abcdefgh"[col] + String(8 - row);
  }

  function renderBoard() {
    var board = byId("board");
    board.innerHTML = "";
    var b = parseBoard(fen);
    var turn = (fen.split(" ")[1] || "-");
    byId("turnTag").textContent = "轮到: " + (turn === "w" ? "白方(你)" : "黑方(AI)");

    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        (function (row, col) {
          var sq = sqName(row, col);
          var piece = b[row][col] || "";
          var cell = document.createElement("div");
          cell.className = "cell " + (((row + col) % 2 === 0) ? "light" : "dark") + (selected === sq ? " selected" : "");
          cell.textContent = pieceMap[piece] || "";
          cell.onclick = function () {
            onBoardClick(sq, piece);
          };
          var coord = document.createElement("span");
          coord.className = "coord";
          coord.textContent = sq;
          cell.appendChild(coord);
          board.appendChild(cell);
        })(r, c);
      }
    }
  }

  function renderMoves() {
    var panel = byId("moveList");
    if (!moves.length) {
      panel.textContent = "暂无走子。";
      panel.className = "move-list muted";
      return;
    }
    panel.className = "move-list";
    var lines = [];
    for (var i = 0; i < moves.length; i += 2) {
      var w = moves[i] || "";
      var bl = moves[i + 1] || "";
      lines.push((Math.floor(i / 2) + 1) + ". " + w + "   " + bl);
    }
    panel.textContent = lines.join("\\n");
  }

  function buildPgn() {
    if (!moves.length) return "";
    var result = [];
    for (var i = 0; i < moves.length; i += 2) {
      var idx = Math.floor(i / 2) + 1;
      var w = moves[i] || "";
      var bl = moves[i + 1] || "";
      result.push(idx + ". " + w + (bl ? " " + bl : ""));
    }
    return result.join(" ");
  }

  function quickLogin() {
    byId("statusTag").textContent = "登录中...";
    setStatus("正在登录...");
    var phone = byId("phone").value.trim();
    var displayName = byId("name").value.trim() || "本地棋手";
    var role = byId("role").value;
    api("/auth/send-code", "POST", { phone: phone }, false)
      .then(function () {
        return api("/auth/login", "POST", { phone: phone, code: "123456", role: role, displayName: displayName }, false);
      })
      .then(function (data) {
        token = data.token;
        byId("statusTag").textContent = "已登录: " + data.user.displayName;
        setStatus("登录成功，点击开始新对局。");
      })
      .catch(function (e) {
        byId("statusTag").textContent = "登录失败";
        setStatus(String(e.message || e));
      });
  }

  function startMatch() {
    setStatus("正在创建对局...");
    if (!token) {
      setStatus("请先登录");
      return;
    }
    var mode = byId("mode").value;
    var difficulty = Number(byId("difficulty").value || 8);
    api("/match/start", "POST", { mode: mode, difficulty: difficulty }, true)
      .then(function (data) {
        matchId = data.matchId;
        fen = data.matchState;
        moves = [];
        selected = "";
        renderBoard();
        renderMoves();
        byId("analysis").textContent = "尚未复盘。";
        setStatus("对局已开始。你执白方。点击棋子再点目标格。");
      })
      .catch(function (e) {
        setStatus(String(e.message || e));
      });
  }

  function submitMove(moveText) {
    if (!matchId) {
      setStatus("请先开始对局");
      return;
    }
    var difficulty = Number(byId("difficulty").value || 8);
    api("/match/move", "POST", { matchId: matchId, fen: fen, move: moveText, difficulty: difficulty }, true)
      .then(function (data) {
        fen = data.fenAfter;
        selected = "";
        if (data.playerMove) moves.push(data.playerMove);
        if (data.engineMove) moves.push(data.engineMove);
        renderBoard();
        renderMoves();
        setStatus("你走: " + (data.playerMove || moveText) + " | AI: " + (data.engineMove || "无") + (data.gameOver ? " | 结束" : ""));
      })
      .catch(function (e) {
        selected = "";
        renderBoard();
        setStatus(String(e.message || e));
      });
  }

  function onBoardClick(square, piece) {
    if (!matchId) {
      setStatus("请先开始对局");
      return;
    }
    var turn = (fen.split(" ")[1] || "-");
    if (turn !== "w") {
      setStatus("当前是 AI 回合，请稍后。");
      return;
    }
    if (!selected) {
      if (!piece || piece !== piece.toUpperCase()) {
        setStatus("请先选择白方棋子");
        return;
      }
      selected = square;
      renderBoard();
      setStatus("已选 " + square + "，请点击目标格");
      return;
    }
    if (selected === square) {
      selected = "";
      renderBoard();
      setStatus("已取消选择");
      return;
    }
    submitMove(selected + square);
  }

  function askSuggestion() {
    if (!matchId) {
      byId("suggestion").textContent = "请先开始对局";
      return;
    }
    var difficulty = Number(byId("difficulty").value || 8);
    api("/match/suggest", "POST", { fen: fen, difficulty: difficulty }, true)
      .then(function (data) {
        var lines = [
          "建议着法: " + (data.move || "无"),
          "原因: " + data.reason,
          "训练建议:"
        ];
        for (var i = 0; i < (data.plan || []).length; i++) {
          lines.push((i + 1) + ". " + data.plan[i]);
        }
        byId("suggestion").textContent = lines.join("\\n");
      })
      .catch(function (e) {
        byId("suggestion").textContent = String(e.message || e);
      });
  }

  function analyzeMatch() {
    var pgn = buildPgn();
    if (!pgn) {
      byId("analysis").textContent = "暂无走子，无法复盘";
      return;
    }
    api("/match/analyze", "POST", { pgn: pgn }, true)
      .then(function (data) {
        var lines = [data.summary || "暂无总结", "", "关键着法:"];
        var keys = data.keyMoves || [];
        if (!keys.length) {
          lines.push("未检测到明显战术着法");
        } else {
          for (var i = 0; i < keys.length; i++) {
            lines.push("第" + keys[i].ply + "手 " + keys[i].san + "（" + keys[i].tag + "）");
          }
        }
        lines.push("", "PGN:", pgn);
        byId("analysis").textContent = lines.join("\\n");
      })
      .catch(function (e) {
        byId("analysis").textContent = String(e.message || e);
      });
  }

  function submitUciMove() {
    var moveText = byId("uciMove").value.trim();
    if (!moveText) return;
    submitMove(moveText);
  }

  byId("btnLogin").addEventListener("click", quickLogin);
  byId("btnStart").addEventListener("click", startMatch);
  byId("btnSuggest").addEventListener("click", askSuggestion);
  byId("btnAnalyze").addEventListener("click", analyzeMatch);
  byId("btnSubmitMove").addEventListener("click", submitUciMove);

  // 初始展示标准开局棋盘，确保页面有可见反馈
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  renderBoard();
  renderMoves();
})();

