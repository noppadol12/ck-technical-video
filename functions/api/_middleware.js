import { fail } from '../../lib/http.js';

// ใช้กับทุก /api/*: กัน cross-site POST และจับ error ไม่ให้รายละเอียดหลุดไปหน้าเว็บ
export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return fail(403, 'forbidden_origin');
  }

  try {
    const res = await context.next();
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  } catch (err) {
    console.error(`[api] ${request.method} ${new URL(request.url).pathname}:`, err?.stack || err);
    return fail(500, 'server_error');
  }
}
