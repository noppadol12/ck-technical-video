// แผนผังวงจร (CK Wiring) — ใช้ร่วมกันระหว่าง API หลังบ้านและหน้าลูกค้า
import { db } from './supabase.js';
import { BadInput } from './validate.js';
import { fail } from './http.js';

export const DIAGRAM_LIST_FIELDS =
  'id,title,category_id,revision,published_revision,published_at,is_published,replaces_video_id,sort_order,created_at,updated_at,category:categories(name)';
export const DIAGRAM_FIELDS = `${DIAGRAM_LIST_FIELDS},data`;

export const PAGE_SIZES = ['A4L', 'A4P', 'A3L', 'A3P'];
export const MAX_ASSET_BYTES = 500 * 1024; // ต่ำกว่าเพดาน 512 KB ของ _middleware
export const ASSET_MIMES = ['image/webp', 'image/png', 'image/jpeg'];

export function shapeDiagram(r) {
  const { category, ...rest } = r;
  return {
    ...rest,
    category: category?.name ?? null,
    // เผยแพร่แล้ว แต่แก้ต่อหลังจากนั้น → ลูกค้ายังเห็นฉบับเก่า
    has_changes: !!r.is_published && r.published_revision !== r.revision,
  };
}

// ตรวจข้อมูลแผนผังที่ส่งมาจากโปรแกรมวาด
export function diagramData(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadInput('data', 'invalid');
  if (!Array.isArray(v.items) || !Array.isArray(v.wires)) throw new BadInput('data', 'invalid');
  if (v.items.length > 3000 || v.wires.length > 6000) throw new BadInput('data', 'too_long');
  return { page: PAGE_SIZES.includes(v.page) ? v.page : 'A4L', items: v.items, wires: v.wires };
}

// ตารางยังไม่ถูกสร้าง (ยังไม่ได้รัน supabase/phase5.sql)
export const missingTable = err => /PGRST20[0-5]|42P01|42703|does not exist|Could not find/i.test(String(err?.message || err));

export const isAssetId = v => /^[0-9a-f]{64}$/.test(String(v));

export function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ส่งไฟล์รูป (id = sha256 ของไฟล์ → แคชได้ถาวร)
export async function assetResponse(env, id) {
  if (!isAssetId(id)) return fail(404, 'not_found');
  const a = await db(env).one(`wiring_assets?id=eq.${id}&select=mime,data`);
  if (!a) return fail(404, 'not_found');
  return new Response(b64ToBytes(a.data), {
    headers: { 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
