import { getStore } from '@netlify/blobs';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const trim = (v, max = 250) => String(v == null ? '' : v).trim().slice(0, max);
const TYPES = new Set(['update', 'offer', 'general']);

async function resolveRole(req) {
  const token = req.headers.get('x-auth') || new URL(req.url).searchParams.get('auth') || '';
  if (!token) return 'none';
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) return 'admin';
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[token];
    if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) return 'member';
  } catch (e) {}
  return 'none';
}

export default async (req) => {
  const role = await resolveRole(req);
  if (role === 'none') return json({ error: 'unauthorized' }, 401);
  const store = getStore('tracker-announcements');

  if (req.method === 'GET') {
    const list = (await store.get('list', { type: 'json' })) || [];
    return json({ announcements: list });
  }

  if (req.method === 'POST') {
    if (role !== 'admin') return json({ error: 'admin only' }, 403);
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action;
    const list = (await store.get('list', { type: 'json' })) || [];

    if (action === 'create') {
      const title = trim(body.title, 150);
      const message = trim(body.message, 1000);
      const type = TYPES.has(body.type) ? body.type : 'general';
      if (!title || !message) return json({ error: 'Please enter a title and message.' }, 400);
      const item = { id: `ann-${Date.now()}-${Math.round(Math.random() * 1e7)}`, title, message, type, createdAt: new Date().toISOString() };
      list.unshift(item);
      const trimmed = list.slice(0, 200);
      await store.setJSON('list', trimmed);
      return json({ ok: true, announcements: trimmed });
    }

    if (action === 'delete') {
      const id = trim(body.id, 100);
      const next = list.filter((x) => x.id !== id);
      await store.setJSON('list', next);
      return json({ ok: true, announcements: next });
    }

    return json({ error: 'unknown action' }, 400);
  }

  return json({ error: 'method not allowed' }, 405);
};
