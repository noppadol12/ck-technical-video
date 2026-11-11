import { db } from '../../../lib/supabase.js';
import { json } from '../../../lib/http.js';

// ประวัติการทำงานของแอดมิน 200 รายการล่าสุด
export async function onRequestGet({ env }) {
  const rows = await db(env).select('admin_actions?select=created_at,action,target_type,target_id,detail,admin:admins(name)&order=created_at.desc&limit=200');
  return json({ actions: rows.map(r => ({ ...r, admin: r.admin?.name ?? null })) });
}
