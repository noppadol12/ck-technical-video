import { db } from '../../../../lib/supabase.js';
import { json, fail } from '../../../../lib/http.js';
import { logAction, isOwner } from '../../../../lib/admin.js';
import { BadInput, readJson } from '../../../../lib/validate.js';
import { LOG_TABLES, logFilter } from './logs.js';

const MAX_IDS = 500;

// ลบประวัติการดูวิดีโอ / การเข้าระบบ (เจ้าของระบบเท่านั้น)
// body: { type: 'watch'|'login', ids?: number[], from?, to?, q?, dry_run?: boolean }
//  - มี ids → ลบเฉพาะรายการนั้น
//  - ไม่มี ids → ลบทุกรายการที่ตรงตัวกรอง (เหมือนที่เห็นในตาราง)
//  - dry_run → นับอย่างเดียว ไม่ลบ
export async function onRequestPost(context) {
  const { request, env, data } = context;
  if (!isOwner(data.admin)) return fail(403, 'owner_only');

  const body = await readJson(request);
  const type = body.type;
  if (!LOG_TABLES[type]) throw new BadInput('type', 'invalid');
  const { table } = LOG_TABLES[type];

  let filter;
  let ids = null;
  if (body.ids !== undefined) {
    if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > MAX_IDS) throw new BadInput('ids', 'invalid');
    ids = [...new Set(body.ids.map(Number))];
    if (!ids.every(n => Number.isSafeInteger(n) && n > 0)) throw new BadInput('ids', 'invalid');
    filter = `&id=in.(${ids.join(',')})`;
  } else {
    filter = logFilter(type, { from: body.from, to: body.to, q: body.q });
  }
  // PostgREST/Supabase ไม่ยอมให้ DELETE ที่ไม่มีเงื่อนไข — ใส่เงื่อนไขที่จริงเสมอไว้
  const path = `${table}?id=gt.0${filter}`;

  const d = db(env);
  if (body.dry_run) return json({ count: await d.count(`${table}?select=id&id=gt.0${filter}`) });

  const deleted = await d.removeCount(path);
  logAction(context, 'logs.purge', 'logs', table, {
    type, deleted,
    ...(ids ? { ids: ids.length } : { from: body.from || null, to: body.to || null, q: body.q || null }),
  });
  return json({ ok: true, deleted });
}
