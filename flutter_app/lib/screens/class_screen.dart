import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_service.dart";
import "../services/session_store.dart";

class ClassScreen extends StatefulWidget {
  const ClassScreen({super.key});

  @override
  State<ClassScreen> createState() => _ClassScreenState();
}

class _ClassScreenState extends State<ClassScreen> {
  final _taskTitle = TextEditingController(text: "今日战术训练");
  final _noticeController = TextEditingController(text: "请同学们晚上8点前完成3道题");
  String _message = "";

  @override
  void dispose() {
    _taskTitle.dispose();
    _noticeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text("班级管理", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("发布任务"),
                const SizedBox(height: 8),
                TextField(controller: _taskTitle, decoration: const InputDecoration(labelText: "任务标题")),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () async {
                    final api = context.read<ApiService>();
                    final token = context.read<SessionStore>().user!.token;
                    await api.authedPost("/class/task/create", token, {
                      "classId": "class-1",
                      "title": _taskTitle.text,
                      "requiredSolveCount": 3,
                      "dueDate": DateTime.now().add(const Duration(days: 1)).toIso8601String(),
                    });
                    setState(() => _message = "任务已发布");
                  },
                  child: const Text("发布今日任务"),
                )
              ],
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("班级公告"),
                const SizedBox(height: 8),
                TextField(controller: _noticeController, decoration: const InputDecoration(labelText: "公告内容")),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () async {
                    final api = context.read<ApiService>();
                    final token = context.read<SessionStore>().user!.token;
                    await api.authedPost("/class/notice/publish", token, {
                      "classId": "class-1",
                      "message": _noticeController.text,
                    });
                    setState(() => _message = "公告已发布");
                  },
                  child: const Text("发送公告"),
                )
              ],
            ),
          ),
        ),
        if (_message.isNotEmpty) Text(_message),
      ],
    );
  }
}
