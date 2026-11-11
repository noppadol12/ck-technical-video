// ตรวจและทำความสะอาดข้อมูลที่ส่งมาจากหน้าเว็บ

export class BadInput extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

export function text(v, field, { max = 200, required = false } = {}) {
  if (v === undefined) return undefined;
  const s = v === null ? '' : String(v).trim();
  if (required && !s) throw new BadInput(field, 'required');
  if (s.length > max) throw new BadInput(field, 'too_long');
  return s || null;
}

export function bool(v, field) {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw new BadInput(field, 'invalid');
  return v;
}

export function int(v, field, { min = -1e9, max = 1e9 } = {}) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadInput(field, 'invalid');
  return n;
}

// YYYY-MM-DD (วันหมดอายุ = สิ้นวันนั้นตามเวลาไทย) หรือ null = ไม่หมดอายุ
export function expiryDate(v, field) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new BadInput(field, 'invalid');
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T23:59:59+07:00`);
  if (Number.isNaN(t)) throw new BadInput(field, 'invalid');
  return new Date(t).toISOString();
}

export function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function readJson(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadInput('body', 'invalid');
    return body;
  } catch (e) {
    if (e instanceof BadInput) throw e;
    throw new BadInput('body', 'invalid');
  }
}
