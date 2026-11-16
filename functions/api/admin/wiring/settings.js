import { db } from '../../../../lib/supabase.js';
import { json, fail } from '../../../../lib/http.js';
import { readJson, BadInput } from '../../../../lib/validate.js';
import { missingTable } from '../../../../lib/wiring.js';

const KEYS = { library: 'array', title_default: 'object' };

// คลังอุปกรณ์ + ค่าเริ่มต้นกรอบชื่อบริษัท
export async function onRequestGet({ env }) {
  try {
    const rows = await db(env).select('wiring_settings?select=key,value');
    const out = { library: [], title_default: null };
    for (const r of rows) out[r.key] = r.value;
    return json(out);
  } catch (err) {
    if (missingTable(err)) return fail(503, 'not_ready');
    throw err;
  }
}

export async function onRequestPut({ request, env }) {
  const body = await readJson(request);
  const kind = KEYS[body.key];
  if (!kind) throw new BadInput('key', 'invalid');
  const v = body.value;
  const ok = kind === 'array' ? Array.isArray(v) : v && typeof v === 'object' && !Array.isArray(v);
  if (!ok) throw new BadInput('value', 'invalid');
  if (JSON.stringify(v).length > 400_000) throw new BadInput('value', 'too_long');
  await db(env).upsert('wiring_settings', { key: body.key, value: v });
  return json({ ok: true });
}
