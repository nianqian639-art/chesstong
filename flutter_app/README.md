# Flutter App (MVP)

## Run
```bash
flutter pub get
flutter run
```

## API config
Default: `http://localhost:8080`

Override with:
```bash
flutter run --dart-define=API_BASE_URL=http://<host>:8080
```

## Current screens
- 登录（手机号验证码 + 身份选择）
- 学生：做题、对战、任务积分、排行榜
- 家长/老师：监督、班级任务与公告、排行榜、积分

## i18n
当前默认中文，后续可在 `lib/l10n` 增加 ARB 资源实现多语言。
