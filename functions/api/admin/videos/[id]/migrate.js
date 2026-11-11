import { db, q } from '../../../../../lib/supabase.js';
import { logAction } from '../../../../../lib/admin.js';
import { bunny, bunnyConfigured, driveDownloadUrl, isDocument, migrationTag } from '../../../../../lib/bunny.js';
import { json, fail, isUuid } from '../../../../../lib/http.js';

// สั่งให้ Bunny ดึงไฟล์จาก Google Drive (ไม่ผ่านเครื่องเรา) — ระหว่างนี้ลูกค้ายังดูจาก Drive ได้ตามปกติ
export async function onRequestPost(context) {
  const { env, params } = context;
  if (!bunnyConfigured(env)) return fail(503, 'bunny_not_configured');
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const d = db(env);
  const v = await d.one(`videos?id=eq.${q(params.id)}&select=id,title,source,drive_file_id,bunny_video_id,bunny_status,category:categories(name)`);
  if (!v) return fail(404, 'not_found');
  if (v.source === 'bunny') return fail(409, 'already_on_bunny');
  if (!v.drive_file_id) return fail(400, 'no_drive_file');
  if (isDocument(v.title, v.category?.name)) return fail(400, 'is_document');
  if (v.bunny_status === 'fetching' || v.bunny_status === 'processing') return json({ ok: true, already: true });

  // ลองใหม่หลังล้มเหลว: ลบวิดีโอเก่าใน Bunny ก่อน
  if (v.bunny_video_id) await bunny.deleteVideo(env, v.bunny_video_id).catch(() => {});

  await d.update(`videos?id=eq.${q(v.id)}&select=id`, {
    bunny_video_id: null, bunny_status: 'fetching', bunny_error: null, bunny_requested_at: new Date().toISOString(),
  });

  try {
    const r = await bunny.fetchFromUrl(env, driveDownloadUrl(v.drive_file_id), migrationTag(v.id));
    if (r && r.success === false) throw new Error(r.message || 'fetch rejected');
  } catch (err) {
    await d.update(`videos?id=eq.${q(v.id)}&select=id`, { bunny_status: 'failed', bunny_error: `สั่ง Bunny ดึงไฟล์ไม่สำเร็จ: ${String(err.message).slice(0, 200)}` });
    return fail(502, 'bunny_fetch_failed');
  }

  logAction(context, 'video.migrate', 'video', v.id, { title: v.title });
  return json({ ok: true });
}
