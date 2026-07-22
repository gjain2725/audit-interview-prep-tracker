import { getStore } from '@netlify/blobs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const keyFor = (code, id) => `${code}/${id}`;
const sanitize = (s) => String(s || 'file').replace(/["\r\n]/g, '');

// Stores/serves attachment binaries in Netlify Blobs, keyed by <syncCode>/<attId>.
// GET returns the file inline (so PDFs/images render live in the viewer).
export default async (req) => {
  const store = getStore('tracker-files');
  const url = new URL(req.url);

  if (req.method === 'POST') {
    const code = req.headers.get('x-code');
    const id = req.headers.get('x-att-id');
    const name = decodeURIComponent(req.headers.get('x-file-name') || 'file');
    const type = req.headers.get('x-file-type') || 'application/octet-stream';
    if (!code || !id) return json({ error: 'missing code/id' }, 400);
    const buf = await req.arrayBuffer();
    await store.set(keyFor(code, id), buf, { metadata: { name, type, size: buf.byteLength } });
    return json({ ok: true, size: buf.byteLength });
  }

  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    const id = url.searchParams.get('id');
    if (!code || !id) return json({ error: 'missing code/id' }, 400);
    const res = await store.getWithMetadata(keyFor(code, id), { type: 'arrayBuffer' });
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
    const code = url.searchParams.get('code');
    const id = url.searchParams.get('id');
    if (!code || !id) return json({ error: 'missing code/id' }, 400);
    await store.delete(keyFor(code, id));
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
};
