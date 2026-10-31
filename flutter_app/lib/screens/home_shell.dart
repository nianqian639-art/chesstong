import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/session_store.dart";
import "class_screen.dart";
import "missions_screen.dart";
import "practice_screen.dart";
import "rankings_screen.dart";
import "battle_screen.dart";
import "supervise_screen.dart";

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<SessionStore>().user!;
    final isStudent = user.role == "student";

    final studentPages = const [
      PracticeScreen(),
      BattleScreen(),
      MissionsScreen(),
      RankingsScreen(),
    ];

    final parentPages = const [
      SuperviseScreen(),
      ClassScreen(),
      RankingsScreen(),
      MissionsScreen(),
    ];

    final pages = isStudent ? studentPages : parentPages;

    return Scaffold(
      appBar: AppBar(
        title: Text("${user.displayName} · Lv.${user.level} · ${user.points}积分"),
        actions: [
          IconButton(
            onPressed: () => context.read<SessionStore>().logout(),
            icon: const Icon(Icons.logout),
          )
        ],
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: isStudent
            ? const [
                NavigationDestination(icon: Icon(Icons.quiz), label: "做题"),
                NavigationDestination(icon: Icon(Icons.sports_esports), label: "对战"),
                NavigationDestination(icon: Icon(Icons.emoji_events), label: "任务"),
                NavigationDestination(icon: Icon(Icons.leaderboard), label: "排行"),
              ]
            : const [
                NavigationDestination(icon: Icon(Icons.monitor_heart), label: "监督"),
                NavigationDestination(icon: Icon(Icons.groups), label: "班级"),
                NavigationDestination(icon: Icon(Icons.leaderboard), label: "排行"),
                NavigationDestination(icon: Icon(Icons.emoji_events), label: "积分"),
              ],
      ),
    );
  }
}
