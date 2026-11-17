import { db } from '../../../../lib/supabase.js';
import { logAction } from '../../../../lib/admin.js';
import { json, fail } from '../../../../lib/http.js';
import { readJson, text } from '../../../../lib/validate.js';
import { DIAGRAM_LIST_FIELDS, DIAGRAM_FIELDS, shapeDiagram, diagramData, missingTable } from '../../../../lib/wiring.js';

// รายการแผนผังทั้งหมด (ไม่รวมข้อมูลภาพ)
export async function onRequestGet({ env }) {
  try {
    const d = db(env);
    const [rows, logs] = await Promise.all([
      d.select(`diagrams?select=${DIAGRAM_LIST_FIELDS}&order=updated_at.desc`),
      d.select('watch_logs?select=diagram_id,customer_id&diagram_id=not.is.null'),
    ]);
    // ยอดเปิดดูของลูกค้า (ทั้งหมด + จำนวนคน)
    const stats = new Map();
    for (const l of logs) {
      const s = stats.get(l.diagram_id) || { views: 0, viewers: new Set() };
      s.views++;
      if (l.customer_id) s.viewers.add(l.customer_id);
      stats.set(l.diagram_id, s);
    }
    return json({
      diagrams: rows.map(r => {
        const s = stats.get(r.id);
        return { ...shapeDiagram(r), total_views: s?.views ?? 0, unique_viewers: s?.viewers.size ?? 0 };
      }),
    });
  } catch (err) {
    if (missingTable(err)) return fail(503, 'not_ready');
    throw err;
  }
}

// สร้างแผนผังใหม่ (ฉบับร่าง ลูกค้ายังไม่เห็น)
export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const d = db(context.env);
  const last = await d.one('diagrams?select=sort_order&order=sort_order.desc&limit=1');
  const created = await d.insertReturning('diagrams', {
    title: text(body.title, 'title', { max: 200, required: true }),
    data: diagramData(body.data),
    sort_order: (last?.sort_order ?? 0) + 1,
  }, DIAGRAM_FIELDS);
  logAction(context, 'diagram.create', 'diagram', created.id, { title: created.title });
  return json({ diagram: shapeDiagram(created) }, 201);
}
