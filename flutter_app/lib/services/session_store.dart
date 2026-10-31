import "package:flutter/foundation.dart";

import "../models/app_user.dart";
import "api_service.dart";

class SessionStore extends ChangeNotifier {
  SessionStore(this._apiService);

  final ApiService _apiService;
  AppUser? user;

  bool get isLoggedIn => user != null;

  Future<void> login({
    required String phone,
    required String code,
    required String role,
    required String displayName,
  }) async {
    final data = await _apiService.login(
      phone: phone,
      code: code,
      role: role,
      displayName: displayName,
    );

    final token = data["token"] as String;
    final userData = data["user"] as Map<String, dynamic>;
    user = AppUser(
      id: userData["id"] as String,
      displayName: userData["displayName"] as String,
      role: userData["role"] as String,
      points: userData["points"] as int,
      level: userData["level"] as int,
      token: token,
    );
    notifyListeners();
  }

  Future<String> sendCode(String phone) async {
    final data = await _apiService.sendCode(phone);
    return (data["devCode"] ?? "").toString();
  }

  void logout() {
    user = null;
    notifyListeners();
  }
}
