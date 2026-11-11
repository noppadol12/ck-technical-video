import { currentAdmin } from '../../../lib/admin.js';
import { clearAdminCookie } from '../../../lib/session.js';
import { fail } from '../../../lib/http.js';

// ทุก /api/admin/* ต้องล็อกอินแอดมิน ยกเว้นหน้าล็อกอิน
export async function onRequest(context) {
  const path = new URL(context.request.url).pathname.replace(/\/+$/, '');
  if (path === '/api/admin/login') return context.next();

  const admin = await currentAdmin(context.request, context.env);
  if (!admin) return fail(401, 'unauthorized', { 'Set-Cookie': clearAdminCookie() });

  context.data.admin = admin;
  return context.next();
}
