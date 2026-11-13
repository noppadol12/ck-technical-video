import { db, q } from '../../../lib/supabase.js';
import { bunny, bunnyConfigured } from '../../../lib/bunny.js';
import { syncOne, PENDING_FIELDS } from '../../../lib/bunny-sync.js';
import { json } from '../../../lib/http.js';

// Bunny แจ้งเมื่อสถานะวิดีโอเปลี่ยน — ไม่เชื่อค่าใน payload แต่ไปถามสถานะจริงจาก Bunny API อีกที
export async function onRequestPost({ request, env, waitUntil }) {
  if (!bunnyConfigured(env)) return json({ ok: true });
  let body;
  try { body = await request.json(); } catch { return json({ ok: true }); }
  if (String(body?.VideoLibraryId) !== String(env.BUNNY_LIBRARY_ID)) return json({ ok: true });
  const guid = String(body?.VideoGuid || '');
  if (!/^[0-9a-f-]{36}$/i.test(guid)) return json({ ok: true });

  waitUntil((async () => {
    const d = db(env);
    let v = await d.one(`videos?bunny_video_id=eq.${q(guid)}&select=${PENDING_FIELDS}`);
    if (!v) {
      // ไม่มีงานย้ายค้างอยู่ → ไม่ต้องถาม Bunny (กันคนนอกยิง webhook ปลอมให้เราเรียก Bunny รัวๆ)
      const waiting = await d.one('videos?bunny_status=eq.fetching&bunny_video_id=is.null&select=id&limit=1');
      if (!waiting) return;
      // วิดีโอที่ย้ายจาก Drive: Bunny ตั้งชื่อชั่วคราวเป็น ck-migrate-<id ของเรา>
      const bv = await bunny.getVideo(env, guid);
      const m = String(bv?.title || '').match(/^ck-migrate-([0-9a-f-]{36})$/i);
      if (m) v = await d.one(`videos?id=eq.${q(m[1])}&select=${PENDING_FIELDS}`);
    }
    if (v && v.bunny_status !== 'ready') await syncOne(env, v);
  })().catch(err => console.error('[webhook]', err)));

  return json({ ok: true });
}
