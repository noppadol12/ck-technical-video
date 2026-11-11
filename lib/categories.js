import { db, q } from './supabase.js';
import { text, int, BadInput } from './validate.js';

// รับ category_id (ตัวเลข) หรือ category_name (สร้างหมวดใหม่ถ้ายังไม่มี) → คืน id หรือ null
export async function resolveCategory(env, body) {
  const d = db(env);
  if (body.category_name !== undefined && body.category_name !== null && String(body.category_name).trim()) {
    const name = text(body.category_name, 'category_name', { max: 80, required: true });
    const found = await d.one(`categories?name=eq.${q(name)}&select=id`);
    if (found) return found.id;
    const last = await d.one('categories?select=sort_order&order=sort_order.desc&limit=1');
    const created = await d.insertReturning('categories', { name, sort_order: (last?.sort_order ?? 0) + 1 }, 'id');
    return created.id;
  }
  if (body.category_id === undefined) return undefined;
  if (body.category_id === null || body.category_id === '') return null;
  const id = int(body.category_id, 'category_id', { min: 1 });
  if (!(await d.one(`categories?id=eq.${id}&select=id`))) throw new BadInput('category_id', 'not_found');
  return id;
}
