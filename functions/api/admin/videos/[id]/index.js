import { db, q } from '../../../../../lib/supabase.js';
import { logAction, isOwner } from '../../../../../lib/admin.js';
import { extractDriveFileId } from '../../../../../lib/drive.js';
import { resolveCategory } from '../../../../../lib/categories.js';
import { json, fail, isUuid } from '../../../../../lib/http.js';
import { readJson, text, bool, clean, BadInput } from '../../../../../lib/validate.js';
import { VIDEO_ADMIN_FIELDS as FIELDS, shapeVideo } from '../../../../../lib/videos.js';
import { bunny, bunnyConfigured } from '../../../../../lib/bunny.js';

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const body = await readJson(request);
  const d = db(env);

  const patch = clean({
    title: text(body.title, 'title', { max: 200, required: body.title !== undefined }),
    description: text(body.description, 'description', { max: 2000 }),
    is_published: bool(body.is_published, 'is_published'),
    category_id: await resolveCategory(env, body),
  });

  if (body.drive !== undefined) {
    const fileId = extractDriveFileId(body.drive);
    if (!fileId) throw new BadInput('drive', 'invalid');
    if (await d.one(`videos?drive_file_id=eq.${q(fileId)}&id=neq.${q(params.id)}&select=id`)) return fail(409, 'video_exists');
    patch.drive_file_id = fileId;
  }
  if (!Object.keys(patch).length) throw new BadInput('body', 'empty');

  const [video] = await d.update(`videos?id=eq.${q(params.id)}&select=${FIELDS}`, patch);
  if (!video) return fail(404, 'not_found');
  logAction(context, 'video.update', 'video', video.id, patch);
  return json({ video: shapeVideo(video, null, env) });
}

// ลบถาวร (owner เท่านั้น) — ประวัติการดูยังอยู่ แต่ไม่ผูกกับวิดีโอ
export async function onRequestDelete(context) {
  const { env, params, data } = context;
  if (!isOwner(data.admin)) return fail(403, 'owner_only');
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const d = db(env);
  const v = await d.one(`videos?id=eq.${q(params.id)}&select=id,title,bunny_video_id`);
  if (!v) return fail(404, 'not_found');
  await d.remove(`videos?id=eq.${q(v.id)}`);
  // ลบไฟล์ใน Bunny ด้วย (ไฟล์บน Google Drive ไม่ถูกลบ)
  if (v.bunny_video_id && bunnyConfigured(env)) context.waitUntil(bunny.deleteVideo(env, v.bunny_video_id).catch(err => console.error('[bunny delete]', err)));
  logAction(context, 'video.delete', 'video', v.id, { title: v.title });
  return json({ ok: true });
}
