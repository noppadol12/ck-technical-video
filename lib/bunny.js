// Bunny Stream: เรียก API, เซ็นลิงก์เล่น, เซ็นการอัปโหลด (TUS)

const API = 'https://video.bunnycdn.com';
export const EMBED_TTL_SECONDS = 2 * 60 * 60;
const UPLOAD_TTL_SECONDS = 24 * 60 * 60;

export function bunnyConfigured(env) {
  return Boolean(env.BUNNY_LIBRARY_ID && env.BUNNY_API_KEY && env.BUNNY_TOKEN_KEY);
}

function need(env) {
  if (!bunnyConfigured(env)) throw new Error('ยังไม่ได้ตั้ง BUNNY_LIBRARY_ID / BUNNY_API_KEY / BUNNY_TOKEN_KEY');
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function call(env, method, path, body) {
  need(env);
  const base = env.BUNNY_API_URL || API; // BUNNY_API_URL ใช้ตอนทดสอบในเครื่องเท่านั้น
  const res = await fetch(`${base}/library/${env.BUNNY_LIBRARY_ID}${path}`, {
    method,
    headers: {
      AccessKey: env.BUNNY_API_KEY,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`Bunny ${method} ${path.split('?')[0]} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

export const bunny = {
  createVideo: (env, title) => call(env, 'POST', '/videos', { title }),
  getVideo: (env, guid) => call(env, 'GET', `/videos/${encodeURIComponent(guid)}`),
  setTitle: (env, guid, title) => call(env, 'POST', `/videos/${encodeURIComponent(guid)}`, { title }),
  deleteVideo: (env, guid) => call(env, 'DELETE', `/videos/${encodeURIComponent(guid)}`),
  fetchFromUrl: (env, url, title) => call(env, 'POST', '/videos/fetch', { url, title }),
  async findByTitle(env, title) {
    const r = await call(env, 'GET', `/videos?page=1&itemsPerPage=20&search=${encodeURIComponent(title)}`);
    return (r?.items || []).find(v => v.title === title) || null;
  },
};

// สถานะวิดีโอของ Bunny → สถานะของเรา
// 3 Finished, 4 ResolutionFinished (เล่นได้แล้ว) · 5 Failed, 8 PresignedUploadFailed
export function mapBunnyStatus(code) {
  if (code === 3 || code === 4) return 'ready';
  if (code === 5 || code === 8) return 'failed';
  return 'processing';
}

// ลิงก์เล่น (Embed view token): SHA256_HEX(token key + video id + expires)
export async function embedUrl(env, guid) {
  need(env);
  const expires = Math.floor(Date.now() / 1000) + EMBED_TTL_SECONDS;
  const token = await sha256Hex(env.BUNNY_TOKEN_KEY + guid + expires);
  const q = new URLSearchParams({ token, expires: String(expires), autoplay: 'true', preload: 'true', responsive: 'true' });
  return `https://player.mediadelivery.net/embed/${env.BUNNY_LIBRARY_ID}/${guid}?${q}`;
}

// สิทธิ์อัปโหลดแบบ TUS: SHA256(library_id + api_key + expiration_time + video_id)
export async function tusCredentials(env, guid) {
  need(env);
  const expire = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
  return {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    libraryId: String(env.BUNNY_LIBRARY_ID),
    videoId: guid,
    expire,
    signature: await sha256Hex(`${env.BUNNY_LIBRARY_ID}${env.BUNNY_API_KEY}${expire}${guid}`),
  };
}

export function bunnyThumbnail(env, guid) {
  return env.BUNNY_CDN_HOSTNAME && guid ? `https://${env.BUNNY_CDN_HOSTNAME}/${guid}/thumbnail.jpg` : null;
}

// ลิงก์ดาวน์โหลดตรงของไฟล์ Drive ที่แชร์แบบทุกคนที่มีลิงก์ (ข้ามหน้าเตือนไวรัสของไฟล์ใหญ่)
export const driveDownloadUrl = fileId =>
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;

// ไฟล์เอกสาร PDF เล่นใน Bunny ไม่ได้ → อยู่บน Drive ต่อ
export const isDocument = (title, category) => /\bpdf\b/i.test(title || '') || /\bpdf\b/i.test(category || '');

export const migrationTag = videoId => `ck-migrate-${videoId}`;
