import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/session_store.dart";

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController(text: "13800138000");
  final _codeController = TextEditingController(text: "123456");
  final _nameController = TextEditingController(text: "小棋手");
  String _role = "student";
  String _message = "";
  bool _loading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = context.read<SessionStore>();
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            margin: const EdgeInsets.all(20),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("渝中区少儿国际象棋", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text("学习辅助MVP", style: TextStyle(color: Colors.black54)),
                  const SizedBox(height: 20),
                  TextField(controller: _phoneController, decoration: const InputDecoration(labelText: "手机号")),
                  const SizedBox(height: 12),
                  TextField(controller: _codeController, decoration: const InputDecoration(labelText: "验证码")),
                  const SizedBox(height: 12),
                  TextField(controller: _nameController, decoration: const InputDecoration(labelText: "昵称")),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _role,
                    decoration: const InputDecoration(labelText: "身份"),
                    items: const [
                      DropdownMenuItem(value: "student", child: Text("学生")),
                      DropdownMenuItem(value: "parent", child: Text("家长")),
                      DropdownMenuItem(value: "teacher", child: Text("老师")),
                    ],
                    onChanged: (value) => setState(() => _role = value ?? "student"),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _loading
                              ? null
                              : () async {
                                  setState(() {
                                    _message = "";
                                    _loading = true;
                                  });
                                  try {
                                    final code = await store.sendCode(_phoneController.text.trim());
                                    setState(() => _message = "开发验证码：$code");
                                  } catch (e) {
                                    setState(() => _message = e.toString());
                                  } finally {
                                    setState(() => _loading = false);
                                  }
                                },
                          child: const Text("发送验证码"),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _loading
                              ? null
                              : () async {
                                  setState(() {
                                    _message = "";
                                    _loading = true;
                                  });
                                  try {
                                    await store.login(
                                      phone: _phoneController.text.trim(),
                                      code: _codeController.text.trim(),
                                      role: _role,
                                      displayName: _nameController.text.trim(),
                                    );
                                  } catch (e) {
                                    setState(() => _message = e.toString());
                                  } finally {
                                    setState(() => _loading = false);
                                  }
                                },
                          child: const Text("登录"),
                        ),
                      ),
                    ],
                  ),
                  if (_message.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(_message, style: const TextStyle(color: Colors.black87)),
                  ]
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
