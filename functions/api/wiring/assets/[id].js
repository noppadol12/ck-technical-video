import { currentCustomer } from '../../../../lib/auth.js';
import { clearCookie } from '../../../../lib/session.js';
import { fail } from '../../../../lib/http.js';
import { assetResponse } from '../../../../lib/wiring.js';

// รูปในแผนผัง สำหรับลูกค้าที่ล็อกอินแล้ว
export async function onRequestGet({ request, env, params }) {
  const c = await currentCustomer(request, env);
  if (!c) return fail(401, 'unauthorized', { 'Set-Cookie': clearCookie() });
  return assetResponse(env, params.id);
}
