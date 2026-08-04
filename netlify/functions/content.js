import { getStore } from '@netlify/blobs';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function resolveRole(req) {
  const token = req.headers.get('x-auth') || new URL(req.url).searchParams.get('auth') || '';
  if (!token) return 'none';
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) return 'admin';
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[token];
    if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) {
      return u.tier === 'free' ? 'free' : 'member';
    }
  } catch (e) {}
  return 'none';
}

// Areas open on the free plan (the 'concepts' category). Must stay in step with
// FREE_Q_CATEGORY in index.html.
const FREE_AREA_IDS = ['process','materiality','risk','controls','fraud','assertions','sampling','analytical','documentation'];
const isFreeQid = (qid) => FREE_AREA_IDS.some((a) => String(qid).startsWith(a + '-'));

// A free plan must never receive the paid areas' edited answers over the API.
function filterContentForFree(content) {
  const c = content || {};
  const q = {};
  for (const id in (c.q || {})) if (isFreeQid(id)) q[id] = c.q[id];
  const custom = {};
  for (const areaId in (c.custom || {})) if (FREE_AREA_IDS.includes(areaId)) custom[areaId] = c.custom[areaId];
  const attach = {};
  for (const k in (c.attach || {})) if (isFreeQid(String(k).split('::')[0])) attach[k] = c.attach[k];
  return { q, custom, areas: c.areas || {}, order: c.order || {}, attach, trash: [] };
}

// One-time migration: split the old shared workspace into admin-owned CONTENT
// (question/answer/example edits, custom Qs, order, attachments, trash) and the
// admin's own PERSONAL state (flags/done/notes). Runs only if content is absent.
const nonEmpty = (o) => o && (Object.keys(o.q || {}).length || Object.keys(o.custom || {}).length || Object.keys(o.areas || {}).length || Object.keys(o.attach || {}).length);

async function seedIfNeeded(cstore) {
  const existing = await cstore.get('master', { type: 'json' });
  let old = null;
  try { old = await getStore('tracker-state').get('state:mb4-shared-workspace', { type: 'json' }); } catch (e) {}
  const d = (old && old.data) || {};
  const oldHasData = nonEmpty(d);
  // Keep a good existing master; also keep an empty one only if there's nothing to migrate.
  if (existing && (nonEmpty(existing) || !oldHasData)) return existing;
  if (!oldHasData) return existing || { q: {}, custom: {}, areas: {}, order: {}, attach: {}, trash: [] };
  // (Re)migrate from the old shared state — heals a previously empty master too.
  const cq = {}, pq = {};
  for (const id in (d.q || {})) {
    const v = d.q[id] || {}; const c = {}, p = {};
    if (v.qOverride != null) c.qOverride = v.qOverride;
    if (v.aOverride != null) c.aOverride = v.aOverride;
    if (Array.isArray(v.examples)) c.examples = v.examples;
    if (v.flag) p.flag = v.flag;
    if (v.done) p.done = v.done;
    if (v.note) p.note = v.note;
    if (Object.keys(c).length) cq[id] = c;
    if (Object.keys(p).length) pq[id] = p;
  }
  const content = { q: cq, custom: d.custom || {}, areas: d.areas || {}, order: d.order || {}, attach: d.attach || {}, trash: d.trash || [] };
  await cstore.setJSON('master', content);
  try { const ps = getStore('tracker-pstate'); if (!(await ps.get('ps:admin', { type: 'json' }))) await ps.setJSON('ps:admin', { q: pq }); } catch (e) {}
  return content;
}

export default async (req) => {
  const cstore = getStore('tracker-content');
  const role = await resolveRole(req);

  if (req.method === 'GET') {
    if (role === 'none') return json({ error: 'unauthorized' }, 401);
    const content = await seedIfNeeded(cstore);
    if (role === 'free') return json({ content: filterContentForFree(content) });
    return json({ content });
  }
  if (req.method === 'POST') {
    if (role !== 'admin') return json({ error: 'admin only' }, 403);
    let body; try { body = await req.json(); } catch { body = null; }
    if (!body || !body.content) return json({ error: 'no content' }, 400);
    await cstore.setJSON('master', body.content);
    return json({ ok: true, updated_at: new Date().toISOString() });
  }
  return json({ error: 'method not allowed' }, 405);
};
