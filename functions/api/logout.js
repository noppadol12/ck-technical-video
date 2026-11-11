import { clearCookie } from '../../lib/session.js';
import { json } from '../../lib/http.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
