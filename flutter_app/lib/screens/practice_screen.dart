import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_service.dart";
import "../services/session_store.dart";

class PracticeScreen extends StatefulWidget {
  const PracticeScreen({super.key});

  @override
  State<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends State<PracticeScreen> {
  List<dynamic> _problems = [];
  Map<String, dynamic>? _current;
  final _answerController = TextEditingController();
  String _result = "";
  String _explain = "";

  @override
  void initState() {
    super.initState();
    _loadProblems();
  }

  Future<void> _loadProblems() async {
    final api = context.read<ApiService>();
    final token = context.read<SessionStore>().user!.token;
    final data = await api.authedGet("/problems/list", token);
    setState(() {
      _problems = (data["items"] as List<dynamic>);
      _current = _problems.isEmpty ? null : _problems.first as Map<String, dynamic>;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_current == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final problem = _current!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("等级 ${problem["gradeBand"]} · ${problem["knowledgePoint"]}"),
                const SizedBox(height: 8),
                Text(problem["question"].toString(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text("FEN: ${problem["fen"]}", style: const TextStyle(color: Colors.black54)),
                const SizedBox(height: 16),
                TextField(
                  controller: _answerController,
                  decoration: const InputDecoration(labelText: "输入你的走法，例如 Rf8#"),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () async {
                    final api = context.read<ApiService>();
                    final token = context.read<SessionStore>().user!.token;
                    final submit = await api.authedPost("/problems/submit", token, {
                      "problemId": problem["id"],
                      "answer": _answerController.text.trim(),
                    });
                    final isCorrect = submit["isCorrect"] as bool;
                    final explain = await api.authedPost("/problems/explain", token, {
                      "problemId": problem["id"],
                      "answer": _answerController.text.trim(),
                      "isCorrect": isCorrect,
                    });
                    setState(() {
                      _result = isCorrect ? "回答正确，+15积分" : "回答错误，继续加油";
                      _explain = explain["explanation"].toString();
                    });
                  },
                  child: const Text("提交并讲解"),
                ),
              ],
            ),
          ),
        ),
        if (_result.isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_result),
            ),
          ),
        if (_explain.isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_explain),
            ),
          ),
      ],
    );
  }
}
