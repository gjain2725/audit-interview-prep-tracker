import { getStore } from '@netlify/blobs';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Per-user PERSONAL state (flags / done / notes). Keyed by the caller's token:
// admin -> 'admin', member -> their access code. Each user only ever touches their own.
async function keyFor(req) {
  const token = req.headers.get('x-auth') || new URL(req.url).searchParams.get('auth') || '';
  if (!token) return null;
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) return 'admin';
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[token];
    if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) return token;
  } catch (e) {}
  return null;
}

export default async (req) => {
  const store = getStore('tracker-pstate');
  const key = await keyFor(req);
  if (!key) return json({ error: 'unauthorized' }, 401);

  if (req.method === 'GET') {
    const st = (await store.get('ps:' + key, { type: 'json' })) || { q: {} };
    return json({ pstate: st });
  }
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { body = null; }
    if (!body) return json({ error: 'bad request' }, 400);
    await store.setJSON('ps:' + key, body.pstate || { q: {} });
    return json({ ok: true, updated_at: new Date().toISOString() });
  }
  return json({ error: 'method not allowed' }, 405);
};
