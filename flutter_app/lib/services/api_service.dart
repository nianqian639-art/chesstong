import "dart:convert";

import "package:http/http.dart" as http;

class ApiService {
  ApiService({String? baseUrl}) : baseUrl = baseUrl ?? const String.fromEnvironment("API_BASE_URL", defaultValue: "http://localhost:8080");

  final String baseUrl;

  Future<Map<String, dynamic>> sendCode(String phone) async {
    final response = await http.post(
      Uri.parse("$baseUrl/auth/send-code"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"phone": phone}),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> login({
    required String phone,
    required String code,
    required String role,
    required String displayName,
  }) async {
    final response = await http.post(
      Uri.parse("$baseUrl/auth/login"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "phone": phone,
        "code": code,
        "role": role,
        "displayName": displayName,
      }),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> authedGet(String path, String token) async {
    final response = await http.get(
      Uri.parse("$baseUrl$path"),
      headers: {"Authorization": "Bearer $token"},
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> authedPost(String path, String token, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse("$baseUrl$path"),
      headers: {
        "Authorization": "Bearer $token",
        "Content-Type": "application/json",
      },
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final map = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw Exception(map["message"] ?? "请求失败");
    }
    return map;
  }
}
