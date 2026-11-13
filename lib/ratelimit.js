import { q } from './supabase.js';
import { clientIp } from './http.js';

// กุญแจนับครั้ง: IPv6 ใช้แค่ /64 (ผู้โจมตีเครื่องเดียวมีที่อยู่ IPv6 ได้นับล้าน)
export function rateKey(request, prefix = '') {
  let ip = clientIp(request);
  if (ip.includes(':')) {
    const head = ip.split('::')[0].split(':').filter(Boolean);
    ip = `${ip.includes('::') && head.length < 4 ? ip : head.slice(0, 4).join(':')}/64`;
  }
  return `${prefix}${ip}`.slice(0, 80);
}

// บันทึก "ก่อน" แล้วค่อยนับ — ยิงพร้อมกันกี่คำขอก็ผ่านได้ไม่เกิน max ครั้งต่อช่วงเวลา
// (แบบเดิมนับก่อนบันทึก ทำให้ยิงพร้อมกันหลายร้อยคำขอแล้วหลุดการนับได้)
export async function hit(d, key, max, windowMin) {
  const row = await d.insertReturning('login_attempts', { ip: key }, 'id');
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();
  const n = await d.count(`login_attempts?ip=eq.${q(key)}&created_at=gte.${q(since)}`);
  return { blocked: n > max, id: row?.id };
}

// ล็อกอินสำเร็จ → ไม่นับครั้งนี้
export const forgive = (d, id) => (id ? d.remove(`login_attempts?id=eq.${Number(id)}`) : Promise.resolve());

export function sweep(d, waitUntil) {
  if (Math.random() < 0.05) {
    waitUntil(d.remove(`login_attempts?created_at=lt.${q(new Date(Date.now() - 86_400_000).toISOString())}`).catch(() => {}));
  }
}
