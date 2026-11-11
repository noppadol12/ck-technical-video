import { db } from '../../../../lib/supabase.js';
import { logAction } from '../../../../lib/admin.js';
import { json } from '../../../../lib/http.js';
import { readJson, BadInput } from '../../../../lib/validate.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const ids = body.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || !ids.every(n => Number.isInteger(n) && n > 0) || new Set(ids).size !== ids.length) {
    throw new BadInput('ids', 'invalid');
  }
  await db(context.env).rpc('reorder_categories', { ids });
  logAction(context, 'category.reorder', 'category', null, { count: ids.length });
  return json({ ok: true });
}
