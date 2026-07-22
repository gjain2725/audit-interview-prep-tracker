import { getStore } from '@netlify/blobs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

// Stores the whole tracker state (notes, flags, edits, ordering, attachment
// metadata) as one JSON blob per sync code. The sync code is the shared secret
// that links a user's devices.
export default async (req) => {
  const store = getStore('tracker-state');
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) return json({ error: 'missing code' }, 400);
    const rec = await store.get('state:' + code, { type: 'json' });
    return json(rec || { data: null, updated_at: null });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { body = null; }
    if (!body || !body.code) return json({ error: 'missing code' }, 400);
    const rec = { data: body.data ?? {}, updated_at: new Date().toISOString() };
    await store.setJSON('state:' + body.code, rec);
    return json({ updated_at: rec.updated_at });
  }

  return json({ error: 'method not allowed' }, 405);
};
