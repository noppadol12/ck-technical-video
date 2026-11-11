import { db, q } from './supabase.js';
import { readCookie, verifyAdminSession, ADMIN_COOKIE } from './session.js';

export async function currentAdmin(request, env) {
  const s = await verifyAdminSession(env, readCookie(request, ADMIN_COOKIE));
  if (!s) return null;
  const a = await db(env).one(`admins?user_id=eq.${q(s.aid)}&active=is.true&select=user_id,name,role`);
  return a;
}

export const isOwner = admin => admin?.role === 'owner';

// บันทึกว่าแอดมินคนไหนทำอะไร (ไม่ทำให้คำขอหลักล้มถ้าบันทึกไม่สำเร็จ)
export function logAction(context, action, targetType, targetId, detail) {
  const admin = context.data.admin;
  context.waitUntil(
    db(context.env).insert('admin_actions', {
      admin_id: admin?.user_id ?? null,
      action,
      target_type: targetType,
      target_id: targetId == null ? null : String(targetId),
      detail: detail ?? null,
    }).catch(err => console.error('[admin_actions]', err)),
  );
}
