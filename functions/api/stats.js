import { db } from '../../lib/supabase.js';
import { isDocument } from '../../lib/bunny.js';
import { json } from '../../lib/http.js';

// ตัวเลขสรุปสำหรับหน้าล็อกอิน (ไม่เปิดเผยชื่อหรือไฟล์ใดๆ)
export async function onRequestGet({ env }) {
  const rows = await db(env).select('videos?select=title,category_id,category:categories(name)&is_published=eq.true&status=eq.ready');
  const pdf = rows.filter(v => isDocument(v.title, v.category?.name)).length;
  const categories = new Set(rows.map(v => v.category_id ?? 0)).size;
  return json({ videos: rows.length - pdf, documents: pdf, categories }, 200, { 'Cache-Control': 'public, max-age=600' });
}
