import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "services/api_service.dart";
import "services/session_store.dart";
import "theme/app_theme.dart";
import "screens/login_screen.dart";
import "screens/home_shell.dart";

void main() {
  final api = ApiService();
  runApp(MyApp(apiService: api));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key, required this.apiService});

  final ApiService apiService;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>.value(value: apiService),
        ChangeNotifierProvider<SessionStore>(
          create: (_) => SessionStore(apiService),
        ),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: "渝中国际象棋学习",
        theme: AppTheme.light,
        locale: const Locale("zh"),
        home: const AppEntry(),
      ),
    );
  }
}

class AppEntry extends StatelessWidget {
  const AppEntry({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionStore>(
      builder: (context, store, _) {
        if (!store.isLoggedIn) {
          return const LoginScreen();
        }
        return const HomeShell();
      },
    );
  }
}
