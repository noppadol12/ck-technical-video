import { db, q } from '../../../../lib/supabase.js';
import { currentCustomer } from '../../../../lib/auth.js';
import { clearCookie } from '../../../../lib/session.js';
import { json, fail, isUuid } from '../../../../lib/http.js';
import { embedUrl } from '../../../../lib/bunny.js';

export async function onRequestPost({ request, env, params, waitUntil }) {
  const c = await currentCustomer(request, env);
  if (!c) return fail(401, 'unauthorized', { 'Set-Cookie': clearCookie() });
  if (!isUuid(params.id)) return fail(404, 'not_found');

  const d = db(env);
  const v = await d.one(
    `videos?id=eq.${q(params.id)}&is_published=eq.true&status=eq.ready&select=id,title,source,drive_file_id,bunny_video_id`,
  );
  if (!v) return fail(404, 'not_found');

  let url;
  if (v.source === 'bunny') url = await embedUrl(env, v.bunny_video_id);
  else url = `https://drive.google.com/file/d/${encodeURIComponent(v.drive_file_id)}/preview`;

  waitUntil(d.insert('watch_logs', {
    customer_id: c.id,
    video_id: v.id,
    code_snapshot: c.code,
    name_snapshot: c.name,
    video_title_snapshot: v.title,
  }).catch(err => console.error('[play] log failed', err)));

  return json({ title: v.title, url });
}
