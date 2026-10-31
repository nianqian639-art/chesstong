import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_service.dart";
import "../services/session_store.dart";

class SuperviseScreen extends StatefulWidget {
  const SuperviseScreen({super.key});

  @override
  State<SuperviseScreen> createState() => _SuperviseScreenState();
}

class _SuperviseScreenState extends State<SuperviseScreen> {
  List<dynamic> _children = [];
  String _message = "";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    final token = context.read<SessionStore>().user!.token;
    try {
      final data = await api.authedGet("/parent/child-progress", token);
      setState(() {
        _children = data["children"] as List<dynamic>;
        _message = _children.isEmpty ? "当前还没有绑定学生，后端可通过 childIds 绑定" : "";
      });
    } catch (e) {
      setState(() => _message = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text("学习监督", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        ..._children.map((item) {
          final m = item as Map<String, dynamic>;
          return Card(
            child: ListTile(
              title: Text(m["childName"].toString()),
              subtitle: Text("正确率 ${m["accuracy"]}% · 做题 ${m["totalAttempts"]}"),
              trailing: Text("Lv.${m["level"]} / ${m["points"]}分"),
            ),
          );
        }),
        if (_message.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_message),
          ),
      ],
    );
  }
}
