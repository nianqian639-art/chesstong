"""Create a deterministic allowlisted release, excluding credentials and user data."""
from pathlib import Path
import hashlib
import os
import shutil
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
name = 'chesstong-release-20261114-puzzle-qwen-stockfish-v2'
stage = Path(tempfile.mkdtemp(prefix='ct-parent1-stage-')) / name
stage.mkdir()
files = sorted(str(p.relative_to(root)) for folder in ('src', 'public')
               for p in (root / folder).rglob('*') if p.is_file() and not p.is_symlink())
files += ['package.json', 'tsconfig.json', 'tools/release-check.mjs', 'tools/admin-device/reader.cjs']
for file in files:
    target = stage / file
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / file, target)
(stage / 'FILES').write_text('\n'.join(files) + '\n')
shutil.copy2(root / 'tools/deploy-release.sh', stage / 'deploy.sh')
(stage / 'README.txt').write_text('''棋童正式版程序更新包 puzzle-qwen-stockfish-v2（2026-11-14）

此包从当前工作树生成，只有部署脚本完成线上检查后才代表部署成功。
本次修复错题被讲解成答对、复盘把 AI 着法算成玩家着法的问题。习题默认讲解
和后续追问保留千问；服务端先重新判题，并把 FEN、执方、棋盘棋子、学生走法、
标准答案、合法应手和 Stockfish 实际返回的最佳着法传给千问。输出中的未授权
着法、错题说成答对、以及错误声称将杀都会退回服务器核验文本。若无 Stockfish
反馈，会明确标示不可用；本版本引擎接口不提供评估分数或完整变化。

上传到服务器 /root 后，在 Workbench 执行：
  cd /root
  unzip chesstong-release-20261114-puzzle-qwen-stockfish-v2.zip
  cd chesstong-release-20261114-puzzle-qwen-stockfish-v2
  bash deploy.sh

部署先在候选目录构建，再用临时数据库检查账号、聊天、真实双人连接、
匹配、实时 Stockfish 题目着法、Qwen 讲解与中英语音，成功后才更新服务。
正式环境必须已在 .env.production 中配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY，
并确保 STOCKFISH_SERVICE_URL 指向可用引擎；无需在终端粘贴密钥。
程序与数据库自动备份到 /opt/chesstong/backups/kid-learning1-时间-进程号。
更新后的服务检查失败会恢复程序，不回滚用户在此期间产生的数据。
任何构建或模型检查失败，先保留终端信息及备份目录内的日志。

包内没有用户数据库、账号令牌、设备私钥、API Key、服务器环境配置、
node_modules 或本地管理浏览器会话。沿用服务器现有依赖与 .env.production。
CT_APP_DIR / CT_BACKUP_ROOT / CT_NODE_BIN 仅供隔离部署演练；
CT_LIVE_MODELS=0 仅供无云端凭证的本机演练，正式服务器默认验证真实模型。

部署后请在网页实测课程图解、六类棋子走法闯关、教师清空棋盘和不同屏幕宽度。
本包不包含用户数据库、短信发送、赛事报名/多轮赛程或家长事件通知功能。
数据管理继续使用桌面的“棋童数据管理.command”。
''')
for file in sorted((root / 'tests').glob('*')):
    if file.is_file():
        target = stage / 'validation' / file.name
        target.parent.mkdir(exist_ok=True)
        shutil.copy2(file, target)
shutil.copy2(root / 'vitest.config.ts', stage / 'validation/vitest.config.ts')
for audit_name in ('release-audit-20261019.md', 'management-audit-20261017.md', 'https-20261020.md'):
    audit = root.parent / 'docs' / audit_name
    if audit.exists():
        shutil.copy2(audit, stage / audit.name)
hash_files = sorted(p for p in stage.rglob('*') if p.is_file())
(stage / 'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + str(p.relative_to(stage)) + '\n' for p in hash_files))
output_dir = Path(os.environ.get('CT_RELEASE_OUT', str(Path.home() / 'Desktop'))).resolve()
output_dir.mkdir(parents=True, exist_ok=True)
archive = output_dir / (name + '.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for file in sorted(stage.rglob('*')):
        if file.is_file():
            z.write(file, name + '/' + str(file.relative_to(stage)))
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(digest + '  ' + archive.name + '\n')
print('Stage:', stage)
print('Archive:', archive)
print('Program files:', len(files))
print('SHA256:', digest)
