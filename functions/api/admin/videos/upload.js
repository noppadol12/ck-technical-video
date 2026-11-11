import { db, q } from '../../../../lib/supabase.js';
import { logAction } from '../../../../lib/admin.js';
import { bunny, bunnyConfigured, tusCredentials } from '../../../../lib/bunny.js';
import { resolveCategory } from '../../../../lib/categories.js';
import { json, fail } from '../../../../lib/http.js';
import { readJson, text, bool, clean } from '../../../../lib/validate.js';

// เตรียมอัปโหลดไฟล์ใหม่: สร้างวิดีโอเปล่าใน Bunny + แถวในฐานข้อมูล แล้วคืนลายเซ็นให้หน้าเว็บอัปโหลดตรงไป Bunny
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!bunnyConfigured(env)) return fail(503, 'bunny_not_configured');
  const body = await readJson(request);
  const title = text(body.title, 'title', { max: 200, required: true });
  const d = db(env);

  const meta = clean({
    description: text(body.description, 'description', { max: 2000 }),
    is_published: bool(body.is_published, 'is_published'),
    category_id: await resolveCategory(env, body),
  });

  const bv = await bunny.createVideo(env, title);
  if (!bv?.guid) throw new Error('Bunny ไม่คืน video id');

  const last = await d.one('videos?select=sort_order&order=sort_order.desc&limit=1');
  const row = await d.insertReturning('videos', {
    ...meta,
    title,
    source: 'bunny',
    bunny_video_id: bv.guid,
    status: 'processing',
    bunny_status: 'processing',
    bunny_requested_at: new Date().toISOString(),
    sort_order: (last?.sort_order ?? 0) + 1,
  }, 'id');

  logAction(context, 'video.upload', 'video', row.id, { title });
  return json({ id: row.id, tus: await tusCredentials(env, bv.guid) }, 201);
}
