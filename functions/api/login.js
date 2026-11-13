import { db } from '../../lib/supabase.js';
import { findCustomerByCode, customerStatus } from '../../lib/auth.js';
import { signSession, sessionCookie } from '../../lib/session.js';
import { json, fail, clientIp, normCode } from '../../lib/http.js';
import { rateKey, hit, forgive, sweep } from '../../lib/ratelimit.js';

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
  const attempt = await hit(d, rateKey(request), MAX_FAILS, WINDOW_MIN);
  if (attempt.blocked) {
    return fail(429, 'too_many_attempts', { 'Retry-After': String(WINDOW_MIN * 60) });
  }

  const customer = await findCustomerByCode(env, code);
  const status = customerStatus(customer);

  if (status !== 'ok') {
    sweep(d, waitUntil); // เก็บกวาดรายการเก่าเป็นครั้งคราว
    return fail(401, status === 'expired' ? 'code_expired' : 'invalid_code');
  }

  waitUntil(forgive(d, attempt.id).catch(() => {}));
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
