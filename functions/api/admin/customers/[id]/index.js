import { db, q } from '../../../../../lib/supabase.js';
import { logAction } from '../../../../../lib/admin.js';
import { json, fail, normCode, isUuid } from '../../../../../lib/http.js';
import { readJson, text, bool, expiryDate, clean, BadInput } from '../../../../../lib/validate.js';
import { CUSTOMER_ADMIN_FIELDS as FIELDS, CODE_RE, customerState } from '../../../../../lib/customers.js';

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const body = await readJson(request);
  const d = db(env);

  const patch = clean({
    name: text(body.name, 'name', { max: 120, required: body.name !== undefined }),
    phone: text(body.phone, 'phone', { max: 40 }),
    company: text(body.company, 'company', { max: 160 }),
    note: text(body.note, 'note', { max: 1000 }),
    active: bool(body.active, 'active'),
    expires_at: expiryDate(body.expires_at, 'expires_at'),
  });

  if (body.code !== undefined) {
    const code = normCode(body.code);
    if (!CODE_RE.test(code)) throw new BadInput('code', 'invalid');
    const other = await d.one(`customers?code=eq.${q(code)}&id=neq.${q(params.id)}&select=id`);
    if (other) return fail(409, 'code_taken');
    patch.code = code;
  }
  // เปลี่ยนรหัส = รหัสเก่าอาจหลุด → เครื่องที่ล็อกอินด้วยรหัสเก่าต้องหลุดด้วย
  if (patch.code !== undefined) {
    const cur = await d.one(`customers?id=eq.${q(params.id)}&select=code,session_version`);
    if (!cur) return fail(404, 'not_found');
    if (cur.code !== patch.code) patch.session_version = cur.session_version + 1;
  }
  if (!Object.keys(patch).length) throw new BadInput('body', 'empty');

  const [customer] = await d.update(`customers?id=eq.${q(params.id)}&select=${FIELDS}`, patch);
  if (!customer) return fail(404, 'not_found');

  logAction(context, 'customer.update', 'customer', customer.id, patch);
  return json({ customer: { ...customer, state: customerState(customer) } });
}
