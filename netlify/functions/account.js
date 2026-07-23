import { getStore } from '@netlify/blobs';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(10);
  try { (globalThis.crypto).getRandomValues(a); } catch (e) { for (let i = 0; i < 10; i++) a[i] = Math.floor(Math.random() * 256); }
  let s = ''; for (const b of a) s += chars[b % chars.length];
  return 'MB4-' + s.slice(0, 5) + '-' + s.slice(5, 10);
}
const usersOf = async (store) => (await store.get('users', { type: 'json' })) || {};
const pendingOf = async (store) => (await store.get('pending', { type: 'json' })) || [];

function authRole(token, users) {
  const admin = process.env.ADMIN_SECRET;
  if (admin && token && token === admin) return { role: 'admin', name: 'Gaurav Jain', email: process.env.ADMIN_EMAIL || '' };
  const u = token && users[token];
  if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) {
    return { role: 'member', name: u.name, code: token, expiresAt: u.expiresAt };
  }
  return { role: 'none' };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const store = getStore('tracker-users');
  let body; try { body = await req.json(); } catch { body = {}; }
  const action = body.action;
  const token = req.headers.get('x-auth') || body.token || '';
  const users = await usersOf(store);
  const auth = authRole(token, users);

  // ----- public -----
  if (action === 'request') {
    const name = String(body.name || '').slice(0, 80).trim();
    const email = String(body.email || '').slice(0, 120).trim();
    const phone = String(body.phone || '').slice(0, 20).trim();
    if (!name || !email || !phone) return json({ error: 'Please provide name, email and phone.' }, 400);
    const pending = await pendingOf(store);
    pending.push({ id: 'req-' + Date.now() + '-' + Math.round(Math.random() * 1e6), name, email, phone, requestedAt: new Date().toISOString() });
    await store.setJSON('pending', pending.slice(-1000));
    return json({ ok: true });
  }
  if (action === 'login') {
    const a = authRole(body.token || '', users);
    if (a.role === 'none') return json({ ok: false, error: 'Invalid, inactive or expired code.' });
    return json({ ok: true, role: a.role, name: a.name, email: a.email || null, expiresAt: a.expiresAt || null });
  }
  if (action === 'me') {
    return json({ role: auth.role, name: auth.name || null, email: auth.email || null, expiresAt: auth.expiresAt || null });
  }

  // ----- admin only -----
  if (auth.role !== 'admin') return json({ error: 'unauthorized' }, 403);

  if (action === 'list') {
    const pending = await pendingOf(store);
    const list = Object.entries(users).map(([code, u]) => ({ code, ...u }));
    return json({ pending, users: list, count: { pending: pending.length, users: list.length } });
  }
  if (action === 'approve') {
    const pending = await pendingOf(store);
    const p = pending.find(x => x.id === body.id);
    const days = parseInt(body.days || '365', 10);
    const code = genCode();
    users[code] = {
      name: (body.name || (p && p.name) || 'Member'),
      email: (body.email || (p && p.email) || ''),
      phone: (body.phone || (p && p.phone) || ''),
      role: 'member', active: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
    };
    await store.setJSON('users', users);
    if (p) await store.setJSON('pending', pending.filter(x => x.id !== body.id));
    return json({ ok: true, code, name: users[code].name, expiresAt: users[code].expiresAt });
  }
  if (action === 'revoke') { if (users[body.code]) { users[body.code].active = false; await store.setJSON('users', users); } return json({ ok: true }); }
  if (action === 'reactivate') { if (users[body.code]) { users[body.code].active = true; await store.setJSON('users', users); } return json({ ok: true }); }
  if (action === 'extend') {
    const days = parseInt(body.days || '365', 10);
    if (users[body.code]) { const base = Math.max(Date.now(), Date.parse(users[body.code].expiresAt || 0) || Date.now()); users[body.code].expiresAt = new Date(base + days * 86400000).toISOString(); await store.setJSON('users', users); }
    return json({ ok: true, expiresAt: users[body.code] && users[body.code].expiresAt });
  }
  if (action === 'delete') { delete users[body.code]; await store.setJSON('users', users); return json({ ok: true }); }
  if (action === 'dismiss') { const pending = await pendingOf(store); await store.setJSON('pending', pending.filter(x => x.id !== body.id)); return json({ ok: true }); }

  return json({ error: 'unknown action' }, 400);
};
