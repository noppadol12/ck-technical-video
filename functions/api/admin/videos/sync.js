import { db } from '../../../../lib/supabase.js';
import { bunnyConfigured } from '../../../../lib/bunny.js';
import { syncOne, PENDING_FIELDS } from '../../../../lib/bunny-sync.js';
import { json, fail } from '../../../../lib/http.js';

// ตรวจสถานะวิดีโอที่กำลังย้าย/แปลงไฟล์ใน Bunny (หน้าหลังบ้านเรียกทุก ~10 วินาที)
export async function onRequestPost({ env }) {
  if (!bunnyConfigured(env)) return fail(503, 'bunny_not_configured');
  const pending = await db(env).select(`videos?select=${PENDING_FIELDS}&bunny_status=in.(fetching,processing)&order=bunny_requested_at.asc&limit=25`);
  const results = [];
  for (const v of pending) {
    try {
      const u = await syncOne(env, v);
      results.push({ id: v.id, bunny_status: u?.bunny_status ?? v.bunny_status });
    } catch (err) {
      console.error('[sync]', v.id, err);
      results.push({ id: v.id, error: true });
    }
  }
  return json({ checked: results.length, results });
}
