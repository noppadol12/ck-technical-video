import { db, q } from '../../../../lib/supabase.js';
import { logAction } from '../../../../lib/admin.js';
import { extractDriveFileId } from '../../../../lib/drive.js';
import { resolveCategory } from '../../../../lib/categories.js';
import { json, fail } from '../../../../lib/http.js';
import { readJson, text, bool, clean, BadInput } from '../../../../lib/validate.js';

import { VIDEO_ADMIN_FIELDS as FIELDS, shapeVideo } from '../../../../lib/videos.js';

export async function onRequestGet({ env }) {
  const d = db(env);
  const [rows, stats] = await Promise.all([
    d.select(`videos?select=${FIELDS}&order=sort_order.asc,created_at.asc`),
    d.select('video_stats?select=id,total_views,unique_viewers,last_viewed_at'),
  ]);
  const byId = new Map(stats.map(s => [s.id, s]));
  return json({ videos: rows.map(v => shapeVideo(v, byId.get(v.id), env)) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const d = db(env);

  const fileId = extractDriveFileId(body.drive);
  if (!fileId) throw new BadInput('drive', 'invalid');
  if (await d.one(`videos?drive_file_id=eq.${q(fileId)}&select=id`)) return fail(409, 'video_exists');

  const last = await d.one('videos?select=sort_order&order=sort_order.desc&limit=1');
  const row = clean({
    title: text(body.title, 'title', { max: 200, required: true }),
    description: text(body.description, 'description', { max: 2000 }),
    is_published: bool(body.is_published, 'is_published'),
    category_id: await resolveCategory(env, body),
    source: 'drive',
    drive_file_id: fileId,
    status: 'ready',
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  const created = await d.insertReturning('videos', row, 'id');
  const video = await d.one(`videos?id=eq.${q(created.id)}&select=${FIELDS}`);
  logAction(context, 'video.create', 'video', video.id, { title: video.title });
  return json({ video: shapeVideo(video, null, env) }, 201);
}
