import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_service.dart";
import "../services/session_store.dart";

class RankingsScreen extends StatefulWidget {
  const RankingsScreen({super.key});

  @override
  State<RankingsScreen> createState() => _RankingsScreenState();
}

class _RankingsScreenState extends State<RankingsScreen> {
  List<dynamic> _global = [];
  List<dynamic> _classRanking = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    final token = context.read<SessionStore>().user!.token;
    final global = await api.authedGet("/rankings/global", token);
    final classRes = await api.authedGet("/rankings/class", token);
    setState(() {
      _global = global["items"] as List<dynamic>;
      _classRanking = classRes["items"] as List<dynamic>;
    });
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text("排行榜", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          const Text("班级榜"),
          ..._classRanking.take(10).map((item) {
            final m = item as Map<String, dynamic>;
            return ListTile(
              title: Text("#${m["rank"]} ${m["name"]}"),
              trailing: Text("${m["points"]}分"),
            );
          }),
          const Divider(),
          const Text("全站榜"),
          ..._global.take(10).map((item) {
            final m = item as Map<String, dynamic>;
            return ListTile(
              title: Text("#${m["rank"]} ${m["name"]}"),
              subtitle: Text("${m["role"]} · Lv.${m["level"]}"),
              trailing: Text("${m["points"]}分"),
            );
          }),
        ],
      ),
    );
  }
}
