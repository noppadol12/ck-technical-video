import { db, q, ilikeAny } from '../../../../lib/supabase.js';
import { logAction } from '../../../../lib/admin.js';
import { json, fail, normCode } from '../../../../lib/http.js';
import { readJson, text, expiryDate, clean, BadInput } from '../../../../lib/validate.js';

import { CUSTOMER_ADMIN_FIELDS as FIELDS, CODE_RE, customerState } from '../../../../lib/customers.js';

// รหัสอัตโนมัติ: CK-<เบอร์โทร> ถ้ามีเบอร์ ไม่งั้น CK-<สุ่ม 6 หลัก>
async function generateCode(d, phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const candidates = [];
  if (digits.length >= 9 && digits.length <= 10) candidates.push(`CK-${digits}`);
  for (let i = 0; i < 5; i++) candidates.push(`CK-${String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000)}`);
  for (const code of candidates) {
    if (!(await d.one(`customers?code=eq.${q(code)}&select=id`))) return code;
  }
  throw new Error('สร้างรหัสไม่สำเร็จ');
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const d = db(env);
  const search = ilikeAny(['code', 'name', 'phone', 'company'], url.searchParams.get('q') || '');

  const [rows, activity] = await Promise.all([
    d.select(`customers?select=${FIELDS}${search}&order=created_at.desc`),
    d.select('customer_activity?select=id,last_login_at,total_views'),
  ]);
  const act = new Map(activity.map(a => [a.id, a]));

  const status = url.searchParams.get('status');
  const customers = rows
    .map(c => ({ ...c, state: customerState(c), last_login_at: act.get(c.id)?.last_login_at ?? null, total_views: act.get(c.id)?.total_views ?? 0 }))
    .filter(c => !status || c.state === status);

  return json({ customers });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const d = db(env);

  const input = clean({
    name: text(body.name, 'name', { max: 120, required: true }),
    phone: text(body.phone, 'phone', { max: 40 }),
    company: text(body.company, 'company', { max: 160 }),
    note: text(body.note, 'note', { max: 1000 }),
    expires_at: expiryDate(body.expires_at, 'expires_at'),
  });

  let code = normCode(body.code);
  if (code) {
    if (!CODE_RE.test(code)) throw new BadInput('code', 'invalid');
    if (await d.one(`customers?code=eq.${q(code)}&select=id`)) return fail(409, 'code_taken');
  } else {
    code = await generateCode(d, input.phone);
  }

  const customer = await d.insertReturning('customers', { ...input, code }, FIELDS);
  logAction(context, 'customer.create', 'customer', customer.id, { code: customer.code, name: customer.name });
  return json({ customer: { ...customer, state: customerState(customer), last_login_at: null, total_views: 0 } }, 201);
}
