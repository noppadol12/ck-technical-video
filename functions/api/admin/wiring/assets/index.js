import { db } from '../../../../../lib/supabase.js';
import { json, fail } from '../../../../../lib/http.js';
import { MAX_ASSET_BYTES, ASSET_MIMES, bytesToB64, sha256Hex } from '../../../../../lib/wiring.js';

// อัปโหลดรูป 1 ไฟล์ (ส่งเป็นไฟล์ดิบ ไม่ใช่ JSON) → คืน id = sha256
export async function onRequestPost({ request, env }) {
  const mime = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!ASSET_MIMES.includes(mime)) return fail(415, 'unsupported_type');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return fail(400, 'empty');
  if (bytes.length > MAX_ASSET_BYTES) return fail(413, 'too_large');
  const id = await sha256Hex(bytes);
  await db(env).insertIgnore('wiring_assets', { id, mime, data: bytesToB64(bytes), size: bytes.length });
  return json({ id, size: bytes.length }, 201);
}
