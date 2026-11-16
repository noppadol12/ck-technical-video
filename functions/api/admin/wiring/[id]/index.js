import { db, q } from '../../../../../lib/supabase.js';
import { logAction, isOwner } from '../../../../../lib/admin.js';
import { json, fail, isUuid } from '../../../../../lib/http.js';
import { readJson, text, int, clean, BadInput } from '../../../../../lib/validate.js';
import { DIAGRAM_LIST_FIELDS, DIAGRAM_FIELDS, shapeDiagram, diagramData } from '../../../../../lib/wiring.js';

export async function onRequestGet({ env, params }) {
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const g = await db(env).one(`diagrams?id=eq.${q(params.id)}&select=${DIAGRAM_FIELDS}`);
  if (!g) return fail(404, 'not_found');
  return json({ diagram: shapeDiagram(g) });
}

// บันทึกอัตโนมัติจากโปรแกรมวาด — ต้องส่ง revision ที่เปิดอยู่มาด้วย กันบันทึกทับงานที่แก้จากหน้าต่างอื่น
export async function onRequestPut({ request, env, params }) {
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const body = await readJson(request);
  const revision = int(body.revision, 'revision', { min: 1 });
  if (revision == null) throw new BadInput('revision', 'required');
  const patch = clean({
    title: text(body.title, 'title', { max: 200, required: body.title !== undefined }),
    data: body.data === undefined ? undefined : diagramData(body.data),
  });
  if (!Object.keys(patch).length) throw new BadInput('body', 'empty');
  patch.revision = revision + 1;

  const d = db(env);
  const [g] = await d.update(`diagrams?id=eq.${q(params.id)}&revision=eq.${revision}&select=${DIAGRAM_LIST_FIELDS}`, patch);
  if (g) return json({ diagram: shapeDiagram(g) });
  const cur = await d.one(`diagrams?id=eq.${q(params.id)}&select=revision`);
  return cur ? json({ error: 'conflict', revision: cur.revision }, 409) : fail(404, 'not_found');
}

// ลบถาวร (owner เท่านั้น) — ถ้าแผนผังนี้แทนที่ PDF เดิมไว้ จะเปิด PDF นั้นให้ลูกค้าเห็นอีกครั้ง
export async function onRequestDelete(context) {
  const { env, params, data } = context;
  if (!isOwner(data.admin)) return fail(403, 'owner_only');
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const d = db(env);
  const g = await d.one(`diagrams?id=eq.${q(params.id)}&select=id,title,is_published,replaces_video_id`);
  if (!g) return fail(404, 'not_found');
  if (g.is_published && g.replaces_video_id) await d.update(`videos?id=eq.${q(g.replaces_video_id)}`, { is_published: true });
  await d.remove(`diagrams?id=eq.${q(g.id)}`);
  logAction(context, 'diagram.delete', 'diagram', g.id, { title: g.title });
  return json({ ok: true });
}
