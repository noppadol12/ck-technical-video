import { db, q, verifyAdminPassword } from '../../../lib/supabase.js';
import { signAdminSession, adminCookie } from '../../../lib/session.js';
import { json, fail, clientIp } from '../../../lib/http.js';
import { readJson, text } from '../../../lib/validate.js';
import { rateKey, hit, forgive } from '../../../lib/ratelimit.js';

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readJson(request);
  const email = text(body.email, 'email', { max: 200, required: true }).toLowerCase();
  const password = String(body.password ?? '');
  if (!password || password.length > 200) return fail(401, 'invalid_login');

  const d = db(env);
  const byIp = await hit(d, rateKey(request, 'admin:'), MAX_FAILS, WINDOW_MIN);
  if (byIp.blocked) {
    return fail(429, 'too_many_attempts', { 'Retry-After': String(WINDOW_MIN * 60) });
  }

  const userId = await verifyAdminPassword(env, email, password);
  const admin = userId ? await d.one(`admins?user_id=eq.${q(userId)}&active=is.true&select=user_id,name,role`) : null;

  if (!admin) {
    return fail(401, 'invalid_login');
  }

  waitUntil(forgive(d, byIp.id).catch(() => {}));
  waitUntil(d.insert('admin_actions', { admin_id: admin.user_id, action: 'admin.login', detail: { ip: clientIp(request) } }).catch(() => {}));
  return json({ name: admin.name, role: admin.role }, 200, { 'Set-Cookie': adminCookie(await signAdminSession(env, admin)) });
}
