import { db, q } from '../../../../lib/supabase.js';
import { currentCustomer } from '../../../../lib/auth.js';
import { clearCookie } from '../../../../lib/session.js';
import { json, fail, isUuid } from '../../../../lib/http.js';

const LINK_TTL_SECONDS = 2 * 60 * 60; // ลิงก์ Bunny หมดอายุใน 2 ชั่วโมง

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// เฟส 3: Bunny Stream embed token = SHA256(token key + video id + expires)
async function bunnyEmbedUrl(env, videoId) {
  if (!env.BUNNY_LIBRARY_ID || !env.BUNNY_TOKEN_KEY) throw new Error('ยังไม่ได้ตั้ง BUNNY_LIBRARY_ID / BUNNY_TOKEN_KEY');
  const expires = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const token = await sha256Hex(env.BUNNY_TOKEN_KEY + videoId + expires);
  return `https://iframe.mediadelivery.net/embed/${env.BUNNY_LIBRARY_ID}/${videoId}?token=${token}&expires=${expires}&autoplay=true&preload=true`;
}

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
  if (v.source === 'bunny') url = await bunnyEmbedUrl(env, v.bunny_video_id);
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
