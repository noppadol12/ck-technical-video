import { db, q, verifyAdminPassword } from '../../../lib/supabase.js';
import { signAdminSession, adminCookie } from '../../../lib/session.js';
import { json, fail, clientIp } from '../../../lib/http.js';
import { readJson, text } from '../../../lib/validate.js';

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readJson(request);
  const email = text(body.email, 'email', { max: 200, required: true }).toLowerCase();
  const password = String(body.password ?? '');
  if (!password || password.length > 200) return fail(401, 'invalid_login');

  const d = db(env);
  const key = `admin:${clientIp(request)}`;
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  if (await d.count(`login_attempts?ip=eq.${q(key)}&created_at=gte.${q(since)}`) >= MAX_FAILS) {
    return fail(429, 'too_many_attempts', { 'Retry-After': String(WINDOW_MIN * 60) });
  }

  const userId = await verifyAdminPassword(env, email, password);
  const admin = userId ? await d.one(`admins?user_id=eq.${q(userId)}&active=is.true&select=user_id,name,role`) : null;

  if (!admin) {
    await d.insert('login_attempts', { ip: key });
    return fail(401, 'invalid_login');
  }

  waitUntil(d.insert('admin_actions', { admin_id: admin.user_id, action: 'admin.login', detail: { ip: clientIp(request) } }).catch(() => {}));
  return json({ name: admin.name, role: admin.role }, 200, { 'Set-Cookie': adminCookie(await signAdminSession(env, admin)) });
}
