import { getStore } from '@netlify/blobs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const FOLDER = 'mb4-shared-workspace';           // fixed master attachment namespace
const keyFor = (id) => `${FOLDER}/${id}`;
const sanitize = (s) => String(s || 'file').replace(/["\r\n]/g, '');

async function roleFor(token) {
  if (!token) return 'none';
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) return 'admin';
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[token];
    if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) return 'member';
  } catch (e) {}
  return 'none';
}

// Master attachments. GET: any approved user (auth via ?auth= since iframes/img
// can't send headers). POST/DELETE: admin only (via x-auth header).
export default async (req) => {
  const store = getStore('tracker-files');
  const url = new URL(req.url);

  if (req.method === 'POST') {
    if ((await roleFor(req.headers.get('x-auth'))) !== 'admin') return json({ error: 'admin only' }, 403);
    const id = req.headers.get('x-att-id');
    const name = decodeURIComponent(req.headers.get('x-file-name') || 'file');
    const type = req.headers.get('x-file-type') || 'application/octet-stream';
    if (!id) return json({ error: 'missing id' }, 400);
    const buf = await req.arrayBuffer();
    await store.set(keyFor(id), buf, { metadata: { name, type, size: buf.byteLength } });
    return json({ ok: true, size: buf.byteLength });
  }

  if (req.method === 'GET') {
    if ((await roleFor(url.searchParams.get('auth'))) === 'none') return json({ error: 'unauthorized' }, 401);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'missing id' }, 400);
    const res = await store.getWithMetadata(keyFor(id), { type: 'arrayBuffer' });
    if (!res || !res.data) return json({ error: 'not found' }, 404);
    const md = res.metadata || {};
    const disp = url.searchParams.get('dl') ? 'attachment' : 'inline';
    return new Response(res.data, {
      status: 200,
      headers: {
        'content-type': md.type || 'application/octet-stream',
        'content-disposition': `${disp}; filename="${sanitize(md.name)}"`,
        'cache-control': 'private, max-age=3600',
      },
    });
  }

  if (req.method === 'DELETE') {
    if ((await roleFor(req.headers.get('x-auth') || url.searchParams.get('auth'))) !== 'admin') return json({ error: 'admin only' }, 403);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'missing id' }, 400);
    await store.delete(keyFor(id));
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};
