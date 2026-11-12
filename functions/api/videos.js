import { db } from '../../lib/supabase.js';
import { currentCustomer } from '../../lib/auth.js';
import { clearCookie } from '../../lib/session.js';
import { json, fail } from '../../lib/http.js';
import { bunnyThumbnail, isDocument } from '../../lib/bunny.js';

const DEFAULT_CATEGORY = 'ทั่วไป';

function thumbnailOf(env, v) {
  if (v.source === 'bunny') return bunnyThumbnail(env, v.bunny_video_id);
  if (v.drive_file_id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(v.drive_file_id)}&sz=w1000`;
  return null;
}

export async function onRequestGet({ request, env }) {
  const c = await currentCustomer(request, env);
  if (!c) return fail(401, 'unauthorized', { 'Set-Cookie': clearCookie() });

  const rows = await db(env).select(
    'videos?select=id,title,description,source,drive_file_id,bunny_video_id,sort_order,category:categories(name,sort_order)' +
    '&is_published=eq.true&status=eq.ready&order=sort_order.asc,created_at.asc',
  );

  const videos = rows.map(v => ({
    id: v.id,
    title: v.title,
    description: v.description,
    category: v.category?.name || DEFAULT_CATEGORY,
    kind: isDocument(v.title, v.category?.name) ? 'pdf' : 'video',
    categoryOrder: v.category?.sort_order ?? 9999,
    thumbnail: thumbnailOf(env, v),
  }));

  return json({ videos });
}
