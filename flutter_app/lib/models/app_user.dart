class AppUser {
  AppUser({
    required this.id,
    required this.displayName,
    required this.role,
    required this.points,
    required this.level,
    required this.token,
  });

  final String id;
  final String displayName;
  final String role;
  final int points;
  final int level;
  final String token;
}
