import { db } from '../../../../lib/supabase.js';
import { logAction } from '../../../../lib/admin.js';
import { json, isUuid } from '../../../../lib/http.js';
import { readJson, BadInput } from '../../../../lib/validate.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const ids = body.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 5000 || !ids.every(isUuid) || new Set(ids).size !== ids.length) {
    throw new BadInput('ids', 'invalid');
  }
  await db(context.env).rpc('reorder_videos', { ids });
  logAction(context, 'video.reorder', 'video', null, { count: ids.length });
  return json({ ok: true });
}
