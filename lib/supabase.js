// เรียก Supabase ผ่าน REST (PostgREST) ด้วย service_role key — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น

export function db(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !(env.SUPABASE_URL || env.SUPABASE_REST_URL)) {
    throw new Error('ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  // SUPABASE_REST_URL ใช้ตอนทดสอบในเครื่องเท่านั้น
  const base = env.SUPABASE_REST_URL || `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1`;
  const auth = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  async function request(method, path, { body, headers = {} } = {}) {
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: { ...auth, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DB ${method} ${path.split('?')[0]} → ${res.status} ${text.slice(0, 300)}`);
    }
    return res;
  }

  return {
    async select(path) {
      const res = await request('GET', path);
      return res.json();
    },
    async one(path) {
      const rows = await this.select(path);
      return rows[0] ?? null;
    },
    async count(path) {
      const res = await request('HEAD', path, { headers: { Prefer: 'count=exact' } });
      const range = res.headers.get('content-range') || '';
      const n = Number(range.split('/')[1]);
      return Number.isFinite(n) ? n : 0;
    },
    async insert(table, rows) {
      await request('POST', table, { body: rows, headers: { Prefer: 'return=minimal' } });
    },
    async remove(path) {
      await request('DELETE', path, { headers: { Prefer: 'return=minimal' } });
    },
  };
}

// ค่าใน query string ของ PostgREST
export const q = v => encodeURIComponent(String(v));
