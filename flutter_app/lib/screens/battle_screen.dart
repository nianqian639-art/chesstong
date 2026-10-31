import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_service.dart";
import "../services/session_store.dart";

class BattleScreen extends StatefulWidget {
  const BattleScreen({super.key});

  @override
  State<BattleScreen> createState() => _BattleScreenState();
}

class _BattleScreenState extends State<BattleScreen> {
  String _mode = "standard";
  double _difficulty = 8;
  String _fen = "";
  String _matchId = "";
  String _move = "";
  String _status = "未开始";
  String _engineSource = "-";

  Future<void> _start() async {
    final api = context.read<ApiService>();
    final token = context.read<SessionStore>().user!.token;
    final data = await api.authedPost("/match/start", token, {
      "mode": _mode,
      "difficulty": _difficulty.toInt(),
    });
    setState(() {
      _matchId = data["matchId"].toString();
      _fen = data["matchState"].toString();
      _status = "对局开始，当前FEN已生成";
    });
  }

  Future<void> _play() async {
    if (_matchId.isEmpty) {
      setState(() => _status = "请先开始对局");
      return;
    }
    final api = context.read<ApiService>();
    final token = context.read<SessionStore>().user!.token;
    final data = await api.authedPost("/match/move", token, {
      "matchId": _matchId,
      "fen": _fen,
      "move": _move,
      "difficulty": _difficulty.toInt(),
    });
    setState(() {
      _fen = data["fenAfter"].toString();
      _engineSource = data["engineSource"]?.toString() ?? "fallback";
      _status = "引擎应对：${data["engineMove"] ?? "无"}；${data["gameOver"] == true ? "对局结束" : "继续"}";
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF281B13),
            Color(0xFF4A2A1E),
            Color(0xFF1A1411),
          ],
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.red.withOpacity(0.10),
                    Colors.transparent,
                    Colors.amber.withOpacity(0.08),
                  ],
                ),
              ),
            ),
          ),
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF8A6A3A), width: 1.2),
                  color: const Color(0xCC1E1714),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.shield, color: Color(0xFFD0A95B)),
                          SizedBox(width: 8),
                          Text(
                            "中世纪战场 · 人机对战",
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFFF3E3C2)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        dropdownColor: const Color(0xFF2A211D),
                        style: const TextStyle(color: Color(0xFFF3E3C2)),
                        value: _mode,
                        decoration: const InputDecoration(
                          labelText: "模式",
                          labelStyle: TextStyle(color: Color(0xFFE5C98C)),
                        ),
                        items: const [
                          DropdownMenuItem(value: "standard", child: Text("标准模式(Stockfish)")),
                          DropdownMenuItem(value: "teaching", child: Text("教学模式(复盘建议+引擎裁决)")),
                        ],
                        onChanged: (value) => setState(() => _mode = value ?? "standard"),
                      ),
                      const SizedBox(height: 12),
                      Text("难度: ${_difficulty.toInt()}", style: const TextStyle(color: Color(0xFFF3E3C2))),
                      Slider(
                        min: 1,
                        max: 20,
                        activeColor: const Color(0xFFD0A95B),
                        value: _difficulty,
                        onChanged: (value) => setState(() => _difficulty = value),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(onPressed: _start, child: const Text("开始对局")),
                      const SizedBox(height: 12),
                      TextField(
                        style: const TextStyle(color: Color(0xFFF3E3C2)),
                        decoration: const InputDecoration(
                          labelText: "输入走法 SAN/UCI (如 e4 或 e2e4)",
                          labelStyle: TextStyle(color: Color(0xFFE5C98C)),
                        ),
                        onChanged: (value) => _move = value,
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: _play, child: const Text("提交走法")),
                      const SizedBox(height: 10),
                      Text("引擎来源: $_engineSource", style: const TextStyle(color: Color(0xFFE5C98C))),
                      const SizedBox(height: 6),
                      Text("FEN: $_fen", style: const TextStyle(color: Color(0xFFD6C8B0))),
                      const SizedBox(height: 8),
                      Text("状态: $_status", style: const TextStyle(color: Color(0xFFF3E3C2))),
                    ],
                  ),
                ),
              )
            ],
          ),
        ],
      ),
    );
  }
}
