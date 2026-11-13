import { db, q } from '../../lib/supabase.js';
import { findCustomerByCode, customerStatus } from '../../lib/auth.js';
import { signSession, sessionCookie } from '../../lib/session.js';
import { json, fail, clientIp, normCode } from '../../lib/http.js';

// กันเดารหัส: ใส่ผิดเกิน MAX_FAILS ครั้งใน WINDOW_MIN นาที (ต่อ IP) → รอก่อน
const MAX_FAILS = 5;
const WINDOW_MIN = 5;

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try { body = await request.json(); } catch { return fail(400, 'bad_request'); }

  const code = normCode(body?.code);
  if (!code || code.length > 64) return fail(400, 'invalid_code');

  const d = db(env);
  const ip = clientIp(request);
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();

  const fails = await d.count(`login_attempts?ip=eq.${q(ip)}&created_at=gte.${q(since)}`);
  if (fails >= MAX_FAILS) {
    return fail(429, 'too_many_attempts', { 'Retry-After': String(WINDOW_MIN * 60) });
  }

  const customer = await findCustomerByCode(env, code);
  const status = customerStatus(customer);

  if (status !== 'ok') {
    await d.insert('login_attempts', { ip });
    // เก็บกวาดรายการเก่าเป็นครั้งคราว
    if (Math.random() < 0.05) {
      waitUntil(d.remove(`login_attempts?created_at=lt.${q(new Date(Date.now() - 86_400_000).toISOString())}`).catch(() => {}));
    }
    return fail(401, status === 'expired' ? 'code_expired' : 'invalid_code');
  }

  const token = await signSession(env, customer);

  waitUntil(d.insert('login_logs', {
    customer_id: customer.id,
    code_snapshot: customer.code,
    name_snapshot: customer.name,
    ip,
    user_agent: (request.headers.get('User-Agent') || '').slice(0, 400),
  }).catch(err => console.error('[login] log failed', err)));

  return json({ id: customer.id, name: customer.name }, 200, { 'Set-Cookie': sessionCookie(token) });
}
