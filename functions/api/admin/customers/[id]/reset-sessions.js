import { db, q } from '../../../../../lib/supabase.js';
import { logAction } from '../../../../../lib/admin.js';
import { json, fail, isUuid } from '../../../../../lib/http.js';

// เตะลูกค้าออกจากทุกเครื่อง
export async function onRequestPost(context) {
  const { env, params } = context;
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const d = db(env);
  const c = await d.one(`customers?id=eq.${q(params.id)}&select=id,code,session_version`);
  if (!c) return fail(404, 'not_found');
  await d.update(`customers?id=eq.${q(c.id)}&select=id`, { session_version: c.session_version + 1 });
  logAction(context, 'customer.reset_sessions', 'customer', c.id, { code: c.code });
  return json({ ok: true });
}
