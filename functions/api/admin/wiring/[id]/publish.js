import { db, q } from '../../../../../lib/supabase.js';
import { logAction } from '../../../../../lib/admin.js';
import { resolveCategory } from '../../../../../lib/categories.js';
import { json, fail, isUuid } from '../../../../../lib/http.js';
import { readJson, bool, BadInput } from '../../../../../lib/validate.js';
import { DIAGRAM_LIST_FIELDS, shapeDiagram } from '../../../../../lib/wiring.js';

// เผยแพร่ / อัปเดต / หยุดเผยแพร่
// body: { publish: true|false, category_id?, replace_video_id?: uuid|null }
//   replace_video_id = PDF บน Google Drive ที่แผนผังนี้มาแทน → ซ่อน PDF นั้นจากลูกค้า (หยุดเผยแพร่เมื่อไรจะเปิดกลับให้)
export async function onRequestPost(context) {
  const { request, env, params } = context;
  if (!isUuid(params.id)) return fail(404, 'not_found');
  const body = await readJson(request);
  const publish = bool(body.publish, 'publish');
  if (publish === undefined) throw new BadInput('publish', 'required');

  const d = db(env);
  const g = await d.one(`diagrams?id=eq.${q(params.id)}&select=id,title,data,revision,is_published,replaces_video_id`);
  if (!g) return fail(404, 'not_found');
  const showVideo = (id, on) => id ? d.update(`videos?id=eq.${q(id)}`, { is_published: on }) : null;

  let patch;
  if (publish) {
    let replace = g.replaces_video_id;
    if (body.replace_video_id !== undefined) {
      if (body.replace_video_id !== null && !isUuid(body.replace_video_id)) throw new BadInput('replace_video_id', 'invalid');
      replace = body.replace_video_id;
      if (replace && !(await d.one(`videos?id=eq.${q(replace)}&select=id`))) throw new BadInput('replace_video_id', 'not_found');
    }
    patch = {
      published: g.data,
      published_revision: g.revision,
      published_at: new Date().toISOString(),
      is_published: true,
      replaces_video_id: replace,
    };
    const cat = await resolveCategory(env, body);
    if (cat !== undefined) patch.category_id = cat;
    // เปลี่ยน PDF ที่จะแทน → เปิด PDF ตัวเดิมกลับ
    if (g.is_published && g.replaces_video_id && g.replaces_video_id !== replace) await showVideo(g.replaces_video_id, true);
    await showVideo(replace, false);
  } else {
    patch = { is_published: false };
    await showVideo(g.replaces_video_id, true);
  }

  const [row] = await d.update(`diagrams?id=eq.${q(g.id)}&select=${DIAGRAM_LIST_FIELDS}`, patch);
  logAction(context, publish ? 'diagram.publish' : 'diagram.unpublish', 'diagram', g.id, {
    title: g.title, revision: g.revision, replaces_video_id: patch.replaces_video_id ?? null,
  });
  return json({ diagram: shapeDiagram(row) });
}
