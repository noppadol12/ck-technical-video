import { db, q } from './supabase.js';
import { bunny, mapBunnyStatus, migrationTag } from './bunny.js';

export const PENDING_FIELDS = 'id,title,source,status,drive_file_id,bunny_video_id,bunny_status,bunny_requested_at';
const FETCH_GIVE_UP_MS = 60 * 60_000;

// อัปเดตสถานะวิดีโอ 1 เรื่องจากข้อมูลจริงใน Bunny (ใช้ทั้งปุ่มตรวจสถานะและ webhook)
export async function syncOne(env, v) {
  const d = db(env);
  let bv;

  if (!v.bunny_video_id) {
    if (v.bunny_status !== 'fetching') return v;
    bv = await bunny.findByTitle(env, migrationTag(v.id));
    if (!bv) {
      const age = Date.now() - Date.parse(v.bunny_requested_at || 0);
      if (age > FETCH_GIVE_UP_MS) {
        const [u] = await d.update(`videos?id=eq.${q(v.id)}&select=${PENDING_FIELDS}`, {
          bunny_status: 'failed', bunny_error: 'Bunny ดึงไฟล์จาก Google Drive ไม่สำเร็จ (ตรวจว่าไฟล์แชร์แบบทุกคนที่มีลิงก์)',
        });
        return u;
      }
      return v;
    }
    await bunny.setTitle(env, bv.guid, v.title).catch(() => {});
  } else {
    bv = await bunny.getVideo(env, v.bunny_video_id);
    if (!bv) {
      const patch = { bunny_status: 'failed', bunny_error: 'ไม่พบวิดีโอนี้ใน Bunny แล้ว' };
      if (v.source === 'bunny') Object.assign(patch, v.drive_file_id ? { source: 'drive' } : { status: 'failed' });
      const [u] = await d.update(`videos?id=eq.${q(v.id)}&select=${PENDING_FIELDS}`, patch);
      return u;
    }
  }

  const st = mapBunnyStatus(bv.status);
  const patch = { bunny_video_id: bv.guid, bunny_status: st };
  if (st === 'ready') Object.assign(patch, { source: 'bunny', status: 'ready', bunny_error: null });
  if (st === 'failed') {
    patch.bunny_error = 'Bunny แปลงไฟล์ไม่สำเร็จ';
    if (!v.drive_file_id) patch.status = 'failed'; // ไฟล์ที่อัปโหลดตรง ไม่มี Drive สำรอง
  }
  const [u] = await d.update(`videos?id=eq.${q(v.id)}&select=${PENDING_FIELDS}`, patch);
  return u;
}
