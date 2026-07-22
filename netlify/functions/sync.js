import { getStore } from '@netlify/blobs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const MAX_VERSIONS = 100;    // keep the last N snapshots
const COALESCE_MS = 10000;   // merge edits made within 10s into one version

function statOf(data) {
  const q = data.q || {};
  let flags = 0, done = 0, notes = 0, edits = 0;
  for (const k in q) {
    const v = q[k] || {};
    if (v.flag) flags++;
    if (v.done) done++;
    if (v.note && String(v.note).trim()) notes++;
    if (v.qOverride != null || v.aOverride != null || Array.isArray(v.examples)) edits++;
  }
  let files = 0;
  const at = data.attach || {};
  for (const s in at) files += (at[s] || []).length;
  return { q: Object.keys(q).length, flags, done, notes, edits, files, trash: (data.trash || []).length };
}

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
    const code = body.code;
    const ts = Date.now();
    const data = body.data ?? {};

    // The version index lives on the state record (exact-key reads are consistent).
    // Snapshot DATA lives in separate immutable blobs, so nothing is ever lost.
    let versions = [];
    let prevHistTs = null;
    try {
      const prev = await store.get('state:' + code, { type: 'json' });
      if (prev) { versions = Array.isArray(prev.versions) ? prev.versions : []; prevHistTs = prev.histTs; }
    } catch (e) {}

    const coalesce = prevHistTs && (ts - prevHistTs) < COALESCE_MS;
    try {
      const hist = getStore('tracker-history');
      if (coalesce) {
        await hist.delete('snap:' + code + ':' + prevHistTs).catch(() => {});
        versions = versions.filter(v => v.ts !== prevHistTs);
      }
      await hist.setJSON('snap:' + code + ':' + ts, { ts, data, s: statOf(data) });
      versions.push({ ts, s: statOf(data) });
      while (versions.length > MAX_VERSIONS) {
        const old = versions.shift();
        await hist.delete('snap:' + code + ':' + old.ts).catch(() => {});
      }
    } catch (e) { /* history is best-effort — never break a save */ }

    const rec = { data, updated_at: new Date(ts).toISOString(), histTs: ts, versions };
    await store.setJSON('state:' + code, rec);
    return json({ updated_at: rec.updated_at, ts });
  }

  return json({ error: 'method not allowed' }, 405);
};
