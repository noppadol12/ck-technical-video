import { db, q, ilikeAny } from '../../../../lib/supabase.js';
import { json } from '../../../../lib/http.js';
import { BadInput } from '../../../../lib/validate.js';

const LIMIT = 5000;

function dayBoundary(v, field, endOfDay) {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadInput(field, 'invalid');
  const t = Date.parse(`${v}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`);
  if (Number.isNaN(t)) throw new BadInput(field, 'invalid');
  return new Date(t).toISOString();
}

const bkk = iso => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
const csvCell = v => {
  const s = v == null ? '' : String(v);
  // กันสูตร Excel ที่แฝงมาในข้อมูล
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'login' ? 'login' : 'watch';
  const from = dayBoundary(url.searchParams.get('from'), 'from', false);
  const to = dayBoundary(url.searchParams.get('to'), 'to', true);
  const term = url.searchParams.get('q') || '';

  const table = type === 'login' ? 'login_logs' : 'watch_logs';
  const cols = type === 'login'
    ? 'created_at,code_snapshot,name_snapshot,ip,user_agent,legacy'
    : 'created_at,code_snapshot,name_snapshot,video_title_snapshot,legacy';
  const searchCols = type === 'login' ? ['code_snapshot', 'name_snapshot'] : ['code_snapshot', 'name_snapshot', 'video_title_snapshot'];

  let path = `${table}?select=${cols}&order=created_at.desc&limit=${LIMIT}`;
  if (from) path += `&created_at=gte.${q(from)}`;
  if (to) path += `&created_at=lte.${q(to)}`;
  path += ilikeAny(searchCols, term);

  const rows = await db(env).select(path);

  if (url.searchParams.get('format') === 'csv') {
    const header = type === 'login'
      ? ['วันเวลา (เวลาไทย)', 'รหัสลูกค้า', 'ชื่อลูกค้า', 'IP', 'อุปกรณ์']
      : ['วันเวลา (เวลาไทย)', 'รหัสลูกค้า', 'ชื่อลูกค้า', 'วิดีโอ'];
    const lines = rows.map(r => (type === 'login'
      ? [bkk(r.created_at), r.code_snapshot, r.name_snapshot, r.ip, r.user_agent]
      : [bkk(r.created_at), r.code_snapshot, r.name_snapshot, r.video_title_snapshot]).map(csvCell).join(','));
    const name = `ck-${type === 'login' ? 'login' : 'watch'}-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response('﻿' + [header.join(','), ...lines].join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return json({ type, rows, truncated: rows.length === LIMIT });
}
