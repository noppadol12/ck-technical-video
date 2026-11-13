import { fail, json } from '../../lib/http.js';
import { BadInput } from '../../lib/validate.js';

const MAX_BODY_BYTES = 512 * 1024;

// ใช้กับทุก /api/*: กัน cross-site request, จำกัดขนาดข้อมูล และจับ error ไม่ให้รายละเอียดหลุดไปหน้าเว็บ
export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return fail(403, 'forbidden_origin');
    // เบราว์เซอร์รุ่นใหม่บอกเองว่าคำขอมาจากเว็บอื่นหรือไม่ (เซิร์ฟเวอร์อย่าง Bunny webhook ไม่ส่ง header นี้)
    const site = request.headers.get('Sec-Fetch-Site');
    if (site && site !== 'same-origin' && site !== 'none') return fail(403, 'forbidden_origin');
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return fail(413, 'too_large');
  }

  let res;
  try {
    res = await context.next();
  } catch (err) {
    if (err instanceof BadInput) return json({ error: 'invalid_input', field: err.field, reason: err.message }, 400);
    console.error(`[api] ${request.method} ${new URL(request.url).pathname}:`, err?.stack || err);
    return fail(500, 'server_error');
  }
  res = new Response(res.body, res); // header ของ response บางชนิดแก้ไม่ได้
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.headers.set('Referrer-Policy', 'no-referrer');
  if (!res.headers.has('Cache-Control')) res.headers.set('Cache-Control', 'no-store');
  return res;
}
