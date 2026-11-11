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
    async insertReturning(table, row, select = '*') {
      const res = await request('POST', `${table}?select=${select}`, { body: row, headers: { Prefer: 'return=representation' } });
      const rows = await res.json();
      return rows[0] ?? null;
    },
    async update(path, patch) {
      const res = await request('PATCH', path, { body: patch, headers: { Prefer: 'return=representation' } });
      return res.json();
    },
    async rpc(fn, args = {}) {
      const res = await request('POST', `rpc/${fn}`, { body: args });
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },
    async remove(path) {
      await request('DELETE', path, { headers: { Prefer: 'return=minimal' } });
    },
  };
}

// ค่าใน query string ของ PostgREST
export const q = v => encodeURIComponent(String(v));

// ตรวจอีเมล/รหัสผ่านแอดมินกับ Supabase Auth → คืน user id หรือ null
export async function verifyAdminPassword(env, email, password) {
  const base = env.SUPABASE_AUTH_URL || `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1`;
  const res = await fetch(`${base}/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 400 || res.status === 401 || res.status === 422) return null;
  if (!res.ok) throw new Error(`Auth ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.user?.id ?? null;
}

// สร้าง filter ค้นหาแบบ or ของ PostgREST จากคำค้นที่ผู้ใช้พิมพ์
export function ilikeAny(columns, term) {
  const clean = String(term).replace(/[(),*\\]/g, ' ').trim();
  if (!clean) return '';
  return `&or=(${columns.map(c => `${c}.ilike.*${encodeURIComponent(clean)}*`).join(',')})`;
}
