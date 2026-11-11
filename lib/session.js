// Session: token ที่เซ็นด้วย HMAC-SHA256 เก็บใน cookie แบบ HttpOnly
// ลูกค้า: { typ: 'c', cid, sv, exp }   แอดมิน: { typ: 'a', aid, exp }

export const COOKIE = 'ck_session';
export const SESSION_DAYS = 30;
export const ADMIN_COOKIE = 'ck_admin';
export const ADMIN_HOURS = 12;

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function secretOf(env) {
  const s = env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร');
  return s;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signToken(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secretOf(env)), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export function signSession(env, customer) {
  return signToken(env, {
    typ: 'c',
    cid: customer.id,
    sv: customer.session_version,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  });
}

export function signAdminSession(env, admin) {
  return signToken(env, { typ: 'a', aid: admin.user_id, exp: Math.floor(Date.now() / 1000) + ADMIN_HOURS * 3600 });
}

export async function verifySession(env, token) {
  const p = await verifyToken(env, token);
  // token ลูกค้ารุ่นแรกไม่มี typ
  return p && (p.typ === 'c' || p.typ === undefined) && typeof p.cid === 'string' ? p : null;
}

export async function verifyAdminSession(env, token) {
  const p = await verifyToken(env, token);
  return p && p.typ === 'a' && typeof p.aid === 'string' ? p : null;
}

async function verifyToken(env, token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secretOf(env)), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(request, name = COOKIE) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// cookie แอดมินส่งเฉพาะ /api/admin และใช้ SameSite=Strict
export function adminCookie(token) {
  return `${ADMIN_COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_HOURS * 3600}`;
}

export function clearAdminCookie() {
  return `${ADMIN_COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
