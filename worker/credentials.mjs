const encoder = new TextEncoder();
export const COOKIE = '__Host-hnust_session';
export const ITERATIONS = 100000;
export const SESSION_MS = 7 * 86400000;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function hex(bytes) { return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join(''); }
export function unhex(value) { return Uint8Array.from(value.match(/../g) || [], x => parseInt(x, 16)); }
export function randomToken(bytes = 32) { return hex(crypto.getRandomValues(new Uint8Array(bytes))); }
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function username(value) {
  const result = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{3,32}$/.test(result)) throw new HttpError(400, '用户名须为 3–32 位字母、数字或下划线');
  return result;
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new HttpError(400, '密码须为 12–128 个字符');
  return value;
}
export function text(value, max = 100) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, '字段格式或长度不正确');
  return value.trim();
}
export async function passwordHash(value, salt, pepper) {
  if (!pepper || pepper.length < 32) throw new HttpError(503, '账号服务尚未配置完成');
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prehash = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const material = await crypto.subtle.importKey('raw', prehash, 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: ITERATIONS }, material, 256));
}
export function sessionCookie(token, maxAge = SESSION_MS / 1000) {
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge;
}
export function readCookie(request) {
  const entries = (request.headers.get('Cookie') || '').split(';').map(x => x.trim());
  const values = entries.filter(x => x.startsWith(COOKIE + '='));
  if (values.length !== 1) return '';
  const value = values[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}
export function sameOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw new HttpError(403, '请从校队网站提交');
}
export async function payload(request) {
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) throw new HttpError(415, '请使用 JSON 提交');
  const reader = request.body?.getReader(); let size = 0; const chunks = [];
  if (reader) while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new HttpError(413, '提交内容过长'); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let result;
  try { result = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(400, '提交内容无效'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new HttpError(400, '提交内容无效');
  return result;
}
export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
