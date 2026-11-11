import { currentCustomer } from '../../lib/auth.js';
import { clearCookie } from '../../lib/session.js';
import { json, fail } from '../../lib/http.js';

export async function onRequestGet({ request, env }) {
  const c = await currentCustomer(request, env);
  if (!c) return fail(401, 'unauthorized', { 'Set-Cookie': clearCookie() });
  return json({ name: c.name, expiresAt: c.expires_at });
}
