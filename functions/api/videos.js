import { db } from '../../lib/supabase.js';
import { currentCustomer } from '../../lib/auth.js';
import { clearCookie } from '../../lib/session.js';
import { json, fail } from '../../lib/http.js';
import { bunnyThumbnail, isDocument } from '../../lib/bunny.js';
import { missingTable } from '../../lib/wiring.js';

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

  // แผนผังวงจรที่วาดในหลังบ้าน แสดงในกลุ่มเดียวกับแผนผัง PDF
  // ถ้าดึงไม่ได้ (เช่น ยังไม่ได้รัน phase5.sql) ให้แสดงวิดีโอตามปกติ ไม่ให้หน้าลูกค้าพัง
  try {
    const diagrams = await db(env).select(
      'diagrams?select=id,title,sort_order,category:categories(name,sort_order)&is_published=eq.true&order=sort_order.asc,title.asc',
    );
    for (const g of diagrams) {
      videos.push({
        id: g.id,
        title: g.title,
        description: null,
        category: g.category?.name || DEFAULT_CATEGORY,
        kind: 'pdf',
        diagram: true,
        categoryOrder: g.category?.sort_order ?? 9999,
        thumbnail: null,
      });
    }
  } catch (err) {
    if (!missingTable(err)) console.error('[videos] diagrams:', err);
  }

  return json({ videos });
}
