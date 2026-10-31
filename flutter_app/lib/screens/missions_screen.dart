import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_service.dart";
import "../services/session_store.dart";

class MissionsScreen extends StatefulWidget {
  const MissionsScreen({super.key});

  @override
  State<MissionsScreen> createState() => _MissionsScreenState();
}

class _MissionsScreenState extends State<MissionsScreen> {
  List<dynamic> _missions = [];
  List<dynamic> _ledger = [];
  String _message = "";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    final token = context.read<SessionStore>().user!.token;
    final missionsData = await api.authedGet("/missions/today", token);
    final ledgerData = await api.authedGet("/points/ledger", token);
    setState(() {
      _missions = missionsData["missions"] as List<dynamic>;
      _ledger = ledgerData["items"] as List<dynamic>;
    });
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text("每日任务", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._missions.map((mission) {
            final data = mission as Map<String, dynamic>;
            final completed = data["completed"] == true;
            final claimed = data["claimed"] == true;
            return Card(
              child: ListTile(
                title: Text(data["name"].toString()),
                subtitle: Text("进度 ${data["progress"]}/${(data["condition"] as Map<String, dynamic>)["threshold"]} · 奖励 ${data["pointsReward"]}积分"),
                trailing: FilledButton(
                  onPressed: (!completed || claimed)
                      ? null
                      : () async {
                          final api = context.read<ApiService>();
                          final token = context.read<SessionStore>().user!.token;
                          await api.authedPost("/missions/claim", token, {"missionId": data["id"]});
                          setState(() => _message = "领取成功");
                          await _load();
                        },
                  child: Text(claimed ? "已领取" : "领取"),
                ),
              ),
            );
          }),
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(child: Text("积分商城示例：", style: TextStyle(fontWeight: FontWeight.bold))),
              OutlinedButton(
                onPressed: () async {
                  final api = context.read<ApiService>();
                  final token = context.read<SessionStore>().user!.token;
                  try {
                    final data = await api.authedPost("/shop/redeem", token, {"itemId": "skin-board-neon"});
                    setState(() => _message = "兑换成功，剩余积分 ${data["points"]}");
                    await _load();
                  } catch (e) {
                    setState(() => _message = e.toString());
                  }
                },
                child: const Text("兑换霓虹棋盘"),
              )
            ],
          ),
          const SizedBox(height: 12),
          const Text("积分流水", style: TextStyle(fontWeight: FontWeight.bold)),
          ..._ledger.map((entry) {
            final data = entry as Map<String, dynamic>;
            return ListTile(
              dense: true,
              title: Text(data["reason"].toString()),
              trailing: Text(data["change"].toString()),
            );
          }),
          if (_message.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(_message),
          ]
        ],
      ),
    );
  }
}
