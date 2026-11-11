import { db, q } from '../../../../../lib/supabase.js';
import { logAction, isOwner } from '../../../../../lib/admin.js';
import { json, fail } from '../../../../../lib/http.js';
import { readJson, text } from '../../../../../lib/validate.js';

const idOf = p => (/^\d{1,12}$/.test(p) ? Number(p) : null);

export async function onRequestPatch(context) {
  const id = idOf(context.params.id);
  if (!id) return fail(404, 'not_found');
  const body = await readJson(context.request);
  const name = text(body.name, 'name', { max: 80, required: true });
  const d = db(context.env);
  if (await d.one(`categories?name=eq.${q(name)}&id=neq.${id}&select=id`)) return fail(409, 'category_exists');
  const [category] = await d.update(`categories?id=eq.${id}&select=id,name,sort_order`, { name });
  if (!category) return fail(404, 'not_found');
  logAction(context, 'category.update', 'category', id, { name });
  return json({ category });
}

// ลบหมวด (owner เท่านั้น) — วิดีโอในหมวดนี้จะกลายเป็น "ทั่วไป"
export async function onRequestDelete(context) {
  if (!isOwner(context.data.admin)) return fail(403, 'owner_only');
  const id = idOf(context.params.id);
  if (!id) return fail(404, 'not_found');
  const d = db(context.env);
  const c = await d.one(`categories?id=eq.${id}&select=id,name`);
  if (!c) return fail(404, 'not_found');
  await d.remove(`categories?id=eq.${id}`);
  logAction(context, 'category.delete', 'category', id, { name: c.name });
  return json({ ok: true });
}
