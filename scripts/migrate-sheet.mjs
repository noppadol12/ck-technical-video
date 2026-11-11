#!/usr/bin/env node
// =====================================================================
// CK Technical Video — ย้ายข้อมูลจาก Google Sheet (CSV) เข้า Supabase
//
// ใช้งาน:
//   node --env-file=.env scripts/migrate-sheet.mjs            (ตรวจอย่างเดียว ไม่เขียนข้อมูล)
//   node --env-file=.env scripts/migrate-sheet.mjs --commit   (เขียนข้อมูลจริง)
//
// ตัวเลือก:
//   --dir=./data      โฟลเดอร์ที่เก็บ CSV (ค่าเริ่มต้น ./data)
//   --mdy             วันที่ใน CSV เป็นแบบ เดือน/วัน/ปี (ค่าเริ่มต้น วัน/เดือน/ปี)
//   --skip-logs       ย้ายเฉพาะลูกค้าและวิดีโอ ไม่ย้าย log
//
// รันซ้ำได้: ลูกค้า/หมวด/วิดีโอใช้ upsert, log เก่า (legacy) จะถูกลบแล้วใส่ใหม่ทุกครั้ง
// =====================================================================

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

// ---------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const MDY = args.includes('--mdy');
const SKIP_LOGS = args.includes('--skip-logs');
const SQL_OUT = (args.find(a => a.startsWith('--sql=')) || '').slice(6) || null;
const DATA_DIR = (args.find(a => a.startsWith('--dir=')) || '--dir=./data').slice(6);
const DEFAULT_CATEGORY = 'ทั่วไป';
const BANGKOK_OFFSET = '+07:00';
const CHUNK = 500;

const FILES = {
  customers: 'Customers.csv',
  videos: 'Videos.csv',
  logs: 'Logs.csv',
  watchLogs: 'WatchLogs.csv',
};

// ---------------------------------------------------------------------
// Helpers (กติกาเดียวกับ Apps Script เดิม)
// ---------------------------------------------------------------------
const str = v => (v == null ? '' : String(v)).trim();
const normCode = v => str(v).toUpperCase();

// เหมือน extractDriveFileId() เดิม
function extractDriveFileId(url) {
  const s = str(url);
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  const m = s.match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

// รองรับ: 2026-11-11 20:11:00 / 2026-11-11T20:11 / 11/11/2026 20:11:00 / ปี พ.ศ. (2569)
function parseSheetDate(value) {
  const s = str(value);
  if (!s) return null;

  let y, mo, d, h = 0, mi = 0, se = 0;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    [y, mo, d] = [m[1], m[2], m[3]].map(Number);
    if (m[4]) [h, mi, se] = [m[4], m[5], m[6] || 0].map(Number);
  } else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2]);
    [d, mo] = MDY ? [b, a] : [a, b];
    y = Number(m[3]);
    if (m[4]) [h, mi, se] = [m[4], m[5], m[6] || 0].map(Number);
  }

  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;

  const pad = n => String(n).padStart(2, '0');
  const iso = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(se)}${BANGKOK_OFFSET}`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  // ตรวจว่าวันที่มีอยู่จริง (กัน 31/02)
  const check = new Date(t + 7 * 3600e3);
  if (check.getUTCDate() !== d) return null;
  return new Date(t).toISOString();
}

async function readCsv(name, { required }) {
  const file = path.join(DATA_DIR, name);
  if (!existsSync(file)) {
    if (required) throw new Error(`ไม่พบไฟล์ ${file}`);
    console.warn(`  ! ไม่พบ ${file} — ข้าม`);
    return [];
  }
  const text = (await readFile(file, 'utf8')).replace(/^﻿/, '');
  const rows = parse(text, { relax_column_count: true, skip_empty_lines: false });
  return rows.slice(1); // ข้ามแถวหัวตาราง เหมือน loop i = 1 ในโค้ดเดิม
}

// overrides.json (ไม่บังคับ): { "exclude": ["ADMINCK"], "names": { "CK-...": "ชื่อที่ต้องการ" } }
async function loadOverrides() {
  const file = path.join(DATA_DIR, 'overrides.json');
  if (!existsSync(file)) return { exclude: new Set(), names: new Map() };
  const o = JSON.parse(await readFile(file, 'utf8'));
  return {
    exclude: new Set((o.exclude || []).map(normCode)),
    names: new Map(Object.entries(o.names || {}).map(([k, v]) => [normCode(k), str(v)])),
  };
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ---------------------------------------------------------------------
// 1) อ่านและตรวจข้อมูล
// ---------------------------------------------------------------------
async function load() {
  const report = { warnings: [] };
  const warn = msg => report.warnings.push(msg);
  const ov = await loadOverrides();
  const notes = report.notes = [];
  let excludedLogs = 0;

  // Customers: A = code, B = name
  const customers = [];
  const seenCodes = new Map();
  (await readCsv(FILES.customers, { required: true })).forEach((r, i) => {
    const rowNo = i + 2;
    const code = normCode(r[0]);
    const name = str(r[1]);
    if (!code && !name) return; // แถวว่าง
    if (!code) return warn(`Customers แถว ${rowNo}: ไม่มีรหัส (ชื่อ "${name}") — ข้าม`);
    if (ov.exclude.has(code)) return notes.push(`Customers แถว ${rowNo}: ${code} ไม่ย้ายตาม overrides.json`);
    if (code.length > 64) return warn(`Customers แถว ${rowNo}: รหัสยาวเกิน 64 ตัวอักษร — ข้าม`);
    if (seenCodes.has(code)) {
      if (ov.names.has(code)) return notes.push(`Customers แถว ${rowNo}: ${code} ซ้ำกับแถว ${seenCodes.get(code)} — รวมเป็นรายการเดียว`);
      return warn(`Customers แถว ${rowNo}: รหัส ${code} ซ้ำกับแถว ${seenCodes.get(code)} — ใช้แถวแรก`);
    }
    seenCodes.set(code, rowNo);
    if (ov.names.has(code)) notes.push(`Customers: ${code} ใช้ชื่อ "${ov.names.get(code)}" ตาม overrides.json`);
    customers.push({ code, name: ov.names.get(code) || name || code });
    if (!name) warn(`Customers แถว ${rowNo}: รหัส ${code} ไม่มีชื่อ — ใช้รหัสเป็นชื่อชั่วคราว`);
  });

  // Videos: A = title, B = link, C = category
  const videos = [];
  const categories = new Set();
  const seenFiles = new Map();
  (await readCsv(FILES.videos, { required: true })).forEach((r, i) => {
    const rowNo = i + 2;
    const title = str(r[0]);
    const link = str(r[1]);
    if (!title && !link) return;
    if (!title || !link) return warn(`Videos แถว ${rowNo}: ไม่มี${title ? 'ลิงก์' : 'ชื่อเรื่อง'} — ข้าม`);
    const fileId = extractDriveFileId(link);
    if (!fileId) return warn(`Videos แถว ${rowNo}: อ่าน Drive file ID จาก "${link}" ไม่ได้ — ข้าม`);
    if (seenFiles.has(fileId)) {
      return warn(`Videos แถว ${rowNo}: ไฟล์ซ้ำกับแถว ${seenFiles.get(fileId)} — ใช้แถวแรก`);
    }
    seenFiles.set(fileId, rowNo);
    const category = str(r[2]) || DEFAULT_CATEGORY;
    categories.add(category);
    videos.push({ title, drive_file_id: fileId, category, sort_order: videos.length + 1 });
  });

  // Logs: A = date, B = code, C = name
  const logs = [];
  const watchLogs = [];
  if (!SKIP_LOGS) {
    let badDates = 0;
    (await readCsv(FILES.logs, { required: false })).forEach((r, i) => {
      const code = normCode(r[1]);
      if (!str(r[0]) && !code) return;
      const at = parseSheetDate(r[0]);
      if (!at) { badDates++; if (badDates <= 5) warn(`Logs แถว ${i + 2}: อ่านวันที่ "${str(r[0])}" ไม่ได้ — ข้าม`); return; }
      if (!code) return;
      if (ov.exclude.has(code)) { excludedLogs++; return; }
      logs.push({ created_at: at, code, name: str(r[2]) || null });
    });

    // WatchLogs: A = date, B = code, C = name, D = video title
    (await readCsv(FILES.watchLogs, { required: false })).forEach((r, i) => {
      const code = normCode(r[1]);
      if (!str(r[0]) && !code) return;
      const at = parseSheetDate(r[0]);
      if (!at) { badDates++; if (badDates <= 5) warn(`WatchLogs แถว ${i + 2}: อ่านวันที่ "${str(r[0])}" ไม่ได้ — ข้าม`); return; }
      if (!code) return;
      if (ov.exclude.has(code)) { excludedLogs++; return; }
      watchLogs.push({ created_at: at, code, name: str(r[2]) || null, title: str(r[3]) || null });
    });
    if (badDates > 5) warn(`...และวันที่ที่อ่านไม่ได้อีก ${badDates - 5} แถว (ดูหัวข้อ "รูปแบบวันที่" ใน README)`);
  }

  if (excludedLogs) notes.push(`ไม่ย้าย log ของรหัสที่ยกเว้น ${excludedLogs} แถว`);

  // log ที่อ้างรหัส/วิดีโอที่ไม่มีแล้ว — ยังย้ายมา แต่ customer_id/video_id เป็น null
  const unknownLogCodes = new Set([...logs, ...watchLogs].map(l => l.code).filter(c => !seenCodes.has(c)));
  if (unknownLogCodes.size) {
    warn(`มี log จากรหัสที่ไม่อยู่ใน Customers แล้ว ${unknownLogCodes.size} รหัส — ย้ายมาโดยไม่ผูกกับลูกค้า`);
  }
  const titles = new Set(videos.map(v => v.title));
  const unknownTitles = new Set(watchLogs.map(w => w.title).filter(t => t && !titles.has(t)));
  if (unknownTitles.size) {
    warn(`มี WatchLogs ของวิดีโอที่ไม่อยู่ใน Videos แล้ว ${unknownTitles.size} เรื่อง — ย้ายมาโดยไม่ผูกกับวิดีโอ`);
  }

  return { customers, videos, categories: [...categories].sort((a, b) => a.localeCompare(b, 'th')), logs, watchLogs, report };
}

// ---------------------------------------------------------------------
// 2) เขียนลง Supabase
// ---------------------------------------------------------------------
async function commit(data) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const must = (res, what) => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
    return res.data;
  };

  // Customers — upsert ตามรหัส (อัปเดตชื่อ ไม่แตะวันหมดอายุ/สถานะที่แอดมินอาจแก้ไปแล้ว)
  const customerIds = new Map();
  for (const part of chunks(data.customers, CHUNK)) {
    const rows = must(
      await db.from('customers').upsert(part, { onConflict: 'code' }).select('id, code'),
      'บันทึก customers',
    );
    rows.forEach(r => customerIds.set(r.code, r.id));
  }
  console.log(`  ✓ customers  ${customerIds.size}`);

  // Categories
  const catRows = must(
    await db.from('categories')
      .upsert(data.categories.map((name, i) => ({ name, sort_order: i + 1 })), { onConflict: 'name' })
      .select('id, name'),
    'บันทึก categories',
  );
  const catIds = new Map(catRows.map(r => [r.name, r.id]));
  console.log(`  ✓ categories ${catIds.size}`);

  // Videos — upsert ตาม drive_file_id
  const videoIds = new Map();
  for (const part of chunks(data.videos, CHUNK)) {
    const rows = must(
      await db.from('videos').upsert(
        part.map(v => ({
          title: v.title,
          drive_file_id: v.drive_file_id,
          category_id: catIds.get(v.category) ?? null,
          sort_order: v.sort_order,
          source: 'drive',
          status: 'ready',
        })),
        { onConflict: 'drive_file_id' },
      ).select('id, title'),
      'บันทึก videos',
    );
    rows.forEach(r => { if (!videoIds.has(r.title)) videoIds.set(r.title, r.id); });
  }
  console.log(`  ✓ videos     ${data.videos.length}`);

  if (SKIP_LOGS) return;

  // Logs — ลบ legacy เดิมก่อน แล้วใส่ใหม่ (รันซ้ำได้ไม่ซ้ำซ้อน)
  must(await db.from('login_logs').delete().eq('legacy', true), 'ล้าง login_logs เก่า');
  for (const part of chunks(data.logs, CHUNK)) {
    must(await db.from('login_logs').insert(part.map(l => ({
      customer_id: customerIds.get(l.code) ?? null,
      code_snapshot: l.code,
      name_snapshot: l.name,
      legacy: true,
      created_at: l.created_at,
    }))), 'บันทึก login_logs');
  }
  console.log(`  ✓ login_logs ${data.logs.length}`);

  must(await db.from('watch_logs').delete().eq('legacy', true), 'ล้าง watch_logs เก่า');
  for (const part of chunks(data.watchLogs, CHUNK)) {
    must(await db.from('watch_logs').insert(part.map(w => ({
      customer_id: customerIds.get(w.code) ?? null,
      video_id: (w.title && videoIds.get(w.title)) ?? null,
      code_snapshot: w.code,
      name_snapshot: w.name,
      video_title_snapshot: w.title,
      legacy: true,
      created_at: w.created_at,
    }))), 'บันทึก watch_logs');
  }
  console.log(`  ✓ watch_logs ${data.watchLogs.length}`);

  // ตรวจนับหลังเขียน
  const counts = {};
  for (const t of ['customers', 'categories', 'videos']) {
    const res = await db.from(t).select('*', { count: 'exact', head: true });
    if (res.error) throw new Error(`นับ ${t}: ${res.error.message}`);
    counts[t] = res.count;
  }
  console.log(`\nใน Supabase ตอนนี้: ลูกค้า ${counts.customers} · หมวด ${counts.categories} · วิดีโอ ${counts.videos}`);
}

// ---------------------------------------------------------------------
// 3) สร้างไฟล์ SQL (ใช้แทน --commit: วางใน Supabase SQL Editor แล้วกด Run)
// ---------------------------------------------------------------------
function buildSql(data) {
  const q = v => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
  const rows = (list, fn) => list.map(fn).join(',\n  ');
  const out = [];
  out.push('-- CK Technical Video — ย้ายข้อมูลจาก Google Sheet');
  out.push(`-- สร้างเมื่อ ${new Date().toISOString()} · รันซ้ำได้`);
  out.push('begin;\n');

  if (data.customers.length) out.push(`insert into public.customers (code, name) values\n  ${rows(data.customers, c => `(${q(c.code)}, ${q(c.name)})`)}\non conflict (code) do update set name = excluded.name;\n`);
  if (data.categories.length) out.push(`insert into public.categories (name, sort_order) values\n  ${rows(data.categories, (n, i) => `(${q(n)}, ${i + 1})`)}\non conflict (name) do update set sort_order = excluded.sort_order;\n`);
  if (data.videos.length) out.push(`insert into public.videos (title, drive_file_id, category_id, sort_order, source, status)
select v.title, v.drive_file_id, c.id, v.sort_order, 'drive', 'ready'
from (values\n  ${rows(data.videos, v => `(${q(v.title)}, ${q(v.drive_file_id)}, ${q(v.category)}, ${v.sort_order})`)}
) as v(title, drive_file_id, category, sort_order)
left join public.categories c on c.name = v.category
on conflict (drive_file_id) do update
  set title = excluded.title, category_id = excluded.category_id, sort_order = excluded.sort_order;\n`);

  if (!SKIP_LOGS) {
    out.push('delete from public.login_logs where legacy;');
    if (data.logs.length) out.push(`insert into public.login_logs (customer_id, code_snapshot, name_snapshot, legacy, created_at)
select cu.id, l.code, l.name, true, l.at::timestamptz
from (values\n  ${rows(data.logs, l => `(${q(l.code)}, ${q(l.name)}, ${q(l.created_at)})`)}
) as l(code, name, at)
left join public.customers cu on cu.code = l.code;\n`);
    out.push('delete from public.watch_logs where legacy;');
    if (data.watchLogs.length) out.push(`insert into public.watch_logs (customer_id, video_id, code_snapshot, name_snapshot, video_title_snapshot, legacy, created_at)
select cu.id, (select v.id from public.videos v where v.title = w.title order by v.sort_order limit 1), w.code, w.name, w.title, true, w.at::timestamptz
from (values\n  ${rows(data.watchLogs, w => `(${q(w.code)}, ${q(w.name)}, ${q(w.title)}, ${q(w.created_at)})`)}
) as w(code, name, title, at)
left join public.customers cu on cu.code = w.code;\n`);
  }

  out.push('commit;\n');
  out.push(`-- ตรวจผล: ควรได้ ลูกค้า ${data.customers.length} · หมวด ${data.categories.length} · วิดีโอ ${data.videos.length}${SKIP_LOGS ? '' : ` · login_logs ${data.logs.length} · watch_logs ${data.watchLogs.length}`}`);
  out.push(`select
  (select count(*) from public.customers)  as customers,
  (select count(*) from public.categories) as categories,
  (select count(*) from public.videos)     as videos,
  (select count(*) from public.login_logs where legacy) as login_logs,
  (select count(*) from public.watch_logs where legacy) as watch_logs;`);
  return out.join('\n');
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------
try {
  console.log(`อ่าน CSV จาก ${path.resolve(DATA_DIR)} (วันที่แบบ ${MDY ? 'เดือน/วัน/ปี' : 'วัน/เดือน/ปี'})\n`);
  const data = await load();

  console.log('สรุปข้อมูลที่จะย้าย');
  console.log(`  ลูกค้า     ${data.customers.length}`);
  console.log(`  หมวดหมู่   ${data.categories.length}  (${data.categories.join(', ')})`);
  console.log(`  วิดีโอ     ${data.videos.length}`);
  if (!SKIP_LOGS) {
    console.log(`  Logs       ${data.logs.length}`);
    console.log(`  WatchLogs  ${data.watchLogs.length}`);
  }

  if (data.report.notes.length) {
    console.log(`\nปรับตาม overrides.json (${data.report.notes.length})`);
    data.report.notes.forEach(n => console.log(`  - ${n}`));
  }

  if (data.report.warnings.length) {
    console.log(`\nข้อควรตรวจ (${data.report.warnings.length})`);
    data.report.warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (data.customers.length) {
    const sample = data.customers.slice(0, 5).map(c => c.code).join(', ');
    console.log(`\nตัวอย่างรหัสสำหรับทดสอบหลังย้าย: ${sample}`);
  }

  if (SQL_OUT) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(SQL_OUT, buildSql(data), 'utf8');
    console.log(`\nสร้างไฟล์ SQL แล้ว: ${path.resolve(SQL_OUT)} — วางใน Supabase SQL Editor แล้วกด Run`);
    process.exit(0);
  }

  if (!COMMIT) {
    console.log('\nโหมดตรวจอย่างเดียว ยังไม่ได้เขียนข้อมูล — ถ้าถูกต้องให้รันซ้ำพร้อม --commit');
    process.exit(0);
  }

  console.log('\nกำลังเขียนลง Supabase...');
  await commit(data);
  console.log('\nเสร็จแล้ว');
} catch (err) {
  console.error(`\nผิดพลาด: ${err.message}`);
  process.exit(1);
}
