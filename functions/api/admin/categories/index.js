import { db, q } from '../../../../lib/supabase.js';
import { logAction } from '../../../../lib/admin.js';
import { json, fail } from '../../../../lib/http.js';
import { readJson, text } from '../../../../lib/validate.js';

export async function onRequestGet({ env }) {
  const d = db(env);
  const [cats, vids] = await Promise.all([
    d.select('categories?select=id,name,sort_order&order=sort_order.asc,name.asc'),
    d.select('videos?select=category_id'),
  ]);
  const counts = new Map();
  vids.forEach(v => counts.set(v.category_id, (counts.get(v.category_id) || 0) + 1));
  return json({ categories: cats.map(c => ({ ...c, video_count: counts.get(c.id) || 0 })), uncategorized: counts.get(null) || 0 });
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const name = text(body.name, 'name', { max: 80, required: true });
  const d = db(context.env);
  if (await d.one(`categories?name=eq.${q(name)}&select=id`)) return fail(409, 'category_exists');
  const last = await d.one('categories?select=sort_order&order=sort_order.desc&limit=1');
  const category = await d.insertReturning('categories', { name, sort_order: (last?.sort_order ?? 0) + 1 }, 'id,name,sort_order');
  logAction(context, 'category.create', 'category', category.id, { name });
  return json({ category: { ...category, video_count: 0 } }, 201);
}
