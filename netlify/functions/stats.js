import { getStore } from '@netlify/blobs';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Funnel events we accept. Anything else is ignored so the store cannot be spammed
// with arbitrary keys.
const EVENTS = new Set([
  'land',            // any page view
  'view_area',       // opened an area page
  'start_mcq',       // started an MCQ test
  'finish_mcq',      // completed an MCQ test
  'hit_paywall',     // saw a locked answer
  'click_getaccess', // clicked a Get Access button
  'view_request',    // opened the buy-access page
  'submit_request',  // submitted the access request form
  'free_signup',     // created a free account
  'login',           // logged in
]);

const dayKey = (d) => 'day:' + d.toISOString().slice(0, 10);
const blank = () => ({ views: 0, events: {}, vids: {}, refs: {} });

async function readDay(store, key) {
  return (await store.get(key, { type: 'json' })) || blank();
}

export default async (req) => {
  const store = getStore('tracker-stats');

  // ---------- write (public, from the browser) ----------
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch { body = {}; }
    const ev = String(body.event || '').slice(0, 40);
    if (!EVENTS.has(ev)) return json({ ok: true }); // silently ignore unknown events
    const vid = String(body.vid || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
    const ref = String(body.ref || '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40);

    const key = dayKey(new Date());
    const rec = await readDay(store, key);
    rec.events[ev] = (rec.events[ev] || 0) + 1;
    if (ev === 'land') {
      rec.views++;
      if (vid) rec.vids[vid] = 1;
      if (ref) rec.refs[ref] = (rec.refs[ref] || 0) + 1;
    }
    await store.setJSON(key, rec);
    return json({ ok: true });
  }

  // ---------- read (admin only) ----------
  if (req.method === 'GET') {
    const token = req.headers.get('x-auth') || '';
    if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }
    const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '30', 10)));
    const out = [];
    const totals = { views: 0, visitors: 0, events: {}, refs: {} };
    const seenVids = new Set();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const rec = await readDay(store, dayKey(d));
      const uniq = Object.keys(rec.vids || {});
      uniq.forEach((v) => seenVids.add(v));
      out.push({ date: d.toISOString().slice(0, 10), views: rec.views || 0, visitors: uniq.length, events: rec.events || {} });
      totals.views += rec.views || 0;
      for (const k in (rec.events || {})) totals.events[k] = (totals.events[k] || 0) + rec.events[k];
      for (const k in (rec.refs || {})) totals.refs[k] = (totals.refs[k] || 0) + rec.refs[k];
    }
    totals.visitors = seenVids.size;
    return json({ days: out, totals });
  }

  return json({ error: 'method not allowed' }, 405);
};
