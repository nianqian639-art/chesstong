import { ZodError } from 'zod';

const fields: Record<string, string> = { account: '账号', username: '账号', phone: '手机号', password: '密码', displayName: '昵称', code: '验证码', role: '角色', fen: '棋盘局面' };
export function userMessage(error: unknown, fallback = '操作没有完成，请稍后再试'): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (!issue) return fallback;
    const field = fields[String(issue.path.at(-1))] || '输入内容';
    return /[\u3400-\u9fff]/.test(issue.message) ? issue.message : `请检查${field}是否填写正确`;
  }
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/^\s*[\[{]/.test(message)) {
    try {
      const data = JSON.parse(message);
      if (Array.isArray(data)) {
        const issue = data[0];
        if (issue?.message && /[\u3400-\u9fff]/.test(issue.message)) return issue.message;
        return `请检查${fields[String(issue?.path?.at(-1))] || '输入内容'}是否填写正确`;
      }
      if (typeof data?.message === 'string' && data.message !== message) return userMessage(data.message, fallback);
    } catch { /* Hide malformed structured errors. */ }
    return fallback;
  }
  return message && /[\u3400-\u9fff]/.test(message) && !/[<>\n{}]/.test(message) ? message : fallback;
}
