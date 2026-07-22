import { getStore } from '@netlify/blobs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

// GET ?code=...          -> { versions: [{ts, s}, ...] } newest first (from the state record — consistent)
// GET ?code=...&ts=<ts>  -> { ts, data, s } a specific snapshot (immutable blob)
export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return json({ error: 'missing code' }, 400);

  const ts = url.searchParams.get('ts');
  if (ts) {
    const hist = getStore('tracker-history');
    const snap = await hist.get('snap:' + code + ':' + ts, { type: 'json' });
    return snap ? json(snap) : json({ error: 'not found' }, 404);
  }

  const store = getStore('tracker-state');
  const rec = await store.get('state:' + code, { type: 'json' });
  const versions = (rec && Array.isArray(rec.versions)) ? rec.versions.slice().reverse() : [];
  return json({ versions });
};
