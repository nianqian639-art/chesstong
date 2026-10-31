import { createHmac, randomInt, randomUUID } from 'node:crypto';

export class SmsError extends Error {
  constructor(message: string, public statusCode = 503) { super(message); }
}
const limits = new Map<string, { since: number; count: number }>();
function reserve(key: string, windowMs: number, maximum: number) {
  const now = Date.now();
  const entry = limits.get(key);
  if (entry && now - entry.since < windowMs) {
    if (entry.count >= maximum) throw new SmsError('验证码请求过于频繁，请稍后再试', 429);
    entry.count++;
  } else limits.set(key, { since: now, count: 1 });
  if (limits.size > 10000) for (const [k, v] of limits) if (now - v.since > 86400000) limits.delete(k);
}
const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export async function sendVerificationCode(phone: string, ip: string): Promise<string> {
  const id = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const secret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const sign = process.env.ALIYUN_SMS_SIGN_NAME;
  const template = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!id || !secret || !sign || !template) throw new SmsError('短信登录暂未开通，请使用密码登录或注册');
  if (!/^\+861\d{10}$/.test(phone)) throw new SmsError('目前短信仅支持中国大陆手机号，请使用密码登录', 400);
  reserve('ip:' + ip, 3600000, 20);
  reserve('day:' + phone, 86400000, 10);
  reserve('minute:' + phone, 60000, 1);
  const code = String(randomInt(100000, 1000000));
  const params: Record<string, string> = {
    AccessKeyId: id, Action: 'SendSms', Format: 'JSON', Version: '2017-05-25',
    RegionId: 'cn-hangzhou', SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0',
    SignatureNonce: randomUUID(), Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    PhoneNumbers: phone.slice(3), SignName: sign, TemplateCode: template,
    TemplateParam: JSON.stringify({ code })
  };
  const canonical = Object.keys(params).sort().map(k => encode(k) + '=' + encode(params[k])).join('&');
  params.Signature = createHmac('sha1', secret + '&').update('POST&%2F&' + encode(canonical)).digest('base64');
  try {
    const response = await fetch('https://dysmsapi.aliyuncs.com/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params), signal: AbortSignal.timeout(15000)
    });
    const result = await response.json() as { Code?: string };
    if (!response.ok || result.Code !== 'OK') {
      if (result.Code === 'isv.BUSINESS_LIMIT_CONTROL') throw new SmsError('短信发送次数已达上限，请稍后再试', 429);
      throw new SmsError('短信暂时无法发送，请稍后再试或使用密码登录');
    }
    return code;
  } catch (error) {
    if (error instanceof SmsError) throw error;
    throw new SmsError('短信服务暂时连接不上，请稍后再试');
  }
}
