import { db, q } from '../../../../lib/supabase.js';
import { json } from '../../../../lib/http.js';
import { customerState } from '../../../../lib/customers.js';

const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString();

export async function onRequestGet({ env }) {
  const d = db(env);
  const [customers, activity, logins7, views7, views30, videos] = await Promise.all([
    d.select('customers?select=id,code,name,active,expires_at,created_at'),
    d.select('customer_activity?select=id,last_login_at,total_views'),
    d.count(`login_logs?created_at=gte.${q(daysAgo(7))}`),
    d.count(`watch_logs?created_at=gte.${q(daysAgo(7))}`),
    d.select(`watch_logs?select=video_id,video_title_snapshot,customer_id&created_at=gte.${q(daysAgo(30))}`),
    d.select('videos?select=id,is_published'),
  ]);

  const act = new Map(activity.map(a => [a.id, a]));
  const in30 = Date.now() + 30 * 86_400_000;
  const withState = customers.map(c => ({ ...c, state: customerState(c), last_login_at: act.get(c.id)?.last_login_at ?? null }));
  const active = withState.filter(c => c.state === 'active');

  const top = new Map();
  for (const w of views30) {
    const key = w.video_id || `t:${w.video_title_snapshot}`;
    const t = top.get(key) || { video_id: w.video_id, title: w.video_title_snapshot, views: 0, viewers: new Set() };
    t.views++;
    if (w.customer_id) t.viewers.add(w.customer_id);
    top.set(key, t);
  }

  return json({
    customers: {
      active: active.length,
      expired: withState.filter(c => c.state === 'expired').length,
      disabled: withState.filter(c => c.state === 'disabled').length,
    },
    videos: { total: videos.length, published: videos.filter(v => v.is_published).length },
    logins_7d: logins7,
    views_7d: views7,
    views_30d: views30.length,
    top_videos_30d: [...top.values()]
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map(t => ({ video_id: t.video_id, title: t.title, views: t.views, viewers: t.viewers.size })),
    expiring_soon: active
      .filter(c => c.expires_at && Date.parse(c.expires_at) <= in30)
      .sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at))
      .map(({ id, code, name, expires_at }) => ({ id, code, name, expires_at })),
    inactive_30d: active
      .filter(c => !c.last_login_at || Date.parse(c.last_login_at) < Date.now() - 30 * 86_400_000)
      .sort((a, b) => (Date.parse(a.last_login_at || 0) || 0) - (Date.parse(b.last_login_at || 0) || 0))
      .map(({ id, code, name, last_login_at }) => ({ id, code, name, last_login_at })),
  });
}
