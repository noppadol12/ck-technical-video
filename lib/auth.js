import { db, q } from './supabase.js';
import { readCookie, verifySession } from './session.js';

const CUSTOMER_FIELDS = 'id,code,name,active,expires_at,session_version';

// ตรวจสถานะลูกค้าใหม่ทุก request: ปิดสิทธิ์ / หมดอายุ / รีเซ็ตการล็อกอิน มีผลทันที
export function customerStatus(c) {
  if (!c || !c.active) return 'invalid';
  if (c.expires_at && Date.parse(c.expires_at) <= Date.now()) return 'expired';
  return 'ok';
}

export async function findCustomerByCode(env, code) {
  return db(env).one(`customers?code=eq.${q(code)}&select=${CUSTOMER_FIELDS}`);
}

export async function currentCustomer(request, env) {
  const session = await verifySession(env, readCookie(request));
  if (!session) return null;
  const c = await db(env).one(`customers?id=eq.${q(session.cid)}&select=${CUSTOMER_FIELDS}`);
  if (customerStatus(c) !== 'ok') return null;
  if (c.session_version !== session.sv) return null;
  return c;
}
