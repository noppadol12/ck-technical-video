import { db, q } from '../../../lib/supabase.js';
import { currentCustomer } from '../../../lib/auth.js';
import { clearCookie } from '../../../lib/session.js';
import { json, fail, isUuid } from '../../../lib/http.js';

// แผนผังฉบับที่เผยแพร่แล้ว (ฉบับร่างที่กำลังแก้ ลูกค้าไม่เห็น)
export async function onRequestGet({ request, env, params }) {
  const c = await currentCustomer(request, env);
  if (!c) return fail(401, 'unauthorized', { 'Set-Cookie': clearCookie() });
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const g = await db(env).one(
    `diagrams?id=eq.${q(params.id)}&is_published=eq.true&select=id,title,published,published_at,category:categories(name)`,
  );
  if (!g) return fail(404, 'not_found');
  return json({ id: g.id, title: g.title, category: g.category?.name ?? null, published_at: g.published_at, data: g.published });
}
