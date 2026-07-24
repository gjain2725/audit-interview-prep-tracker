import { getStore } from '@netlify/blobs';
import { OAuth2Client } from 'google-auth-library';

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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '415640736608-v21kq5d32csvtqovptdcg1l4ckdjesjt.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function authRole(token, users) {
  const admin = process.env.ADMIN_SECRET;
  if (admin && token && token === admin) return { role: 'admin', name: 'Gaurav Jain', email: process.env.ADMIN_EMAIL || '' };
  const u = token && users[token];
  if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) {
    return { role: 'member', name: u.name, code: token, expiresAt: u.expiresAt };
  }
  return { role: 'none' };
}

async function verifyGoogleCredential(token) {
  try {
    if (!token || String(token).length > 10000) return null;
    const ticket = await googleClient.verifyIdToken({
      idToken: String(token),
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || payload.email_verified !== true) return null;
    return payload;
  } catch (e) {
    return null;
  }
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
  if (action === 'google-login') {
    const credential = body.credential;
    const payload = await verifyGoogleCredential(credential);
    if (!payload || !payload.email) {
      return json({ ok: false, error: 'Invalid Google credential token.' }, 400);
    }
    const email = String(payload.email).toLowerCase().trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'gjain2725@gmail.com').toLowerCase().trim();
    const adminSecret = process.env.ADMIN_SECRET;

    if (adminEmail && email === adminEmail && adminSecret) {
      return json({ ok: true, role: 'admin', token: adminSecret, name: payload.name || 'Gaurav Jain', email: payload.email });
    }

    let foundCode = null;
    let foundUser = null;
    for (const [code, u] of Object.entries(users)) {
      if (u && u.email && String(u.email).toLowerCase().trim() === email && u.active !== false) {
        if (!u.expiresAt || Date.parse(u.expiresAt) > Date.now()) {
          foundCode = code;
          foundUser = u;
          break;
        }
      }
    }

    if (!foundCode || !foundUser) {
      return json({ ok: false, error: 'unregistered', email: payload.email, name: payload.name || '' });
    }

    const deviceId = String(body.device || '').trim().slice(0, 100);
    if (deviceId) {
      const devices = Array.isArray(foundUser.devices) ? foundUser.devices : [];
      const existing = devices.find((d) => d.id === deviceId);
      if (existing) {
        existing.lastSeen = new Date().toISOString();
        await store.setJSON('users', users);
      } else if (devices.length >= 2) {
        return json({ ok: false, error: 'This account is in use on 2 devices. Ask admin to reset devices.' });
      } else {
        devices.push({ id: deviceId, lastSeen: new Date().toISOString() });
        foundUser.devices = devices;
        await store.setJSON('users', users);
      }
    }

    return json({
      ok: true,
      role: 'member',
      token: foundCode,
      name: foundUser.name || payload.name,
      email: payload.email,
      expiresAt: foundUser.expiresAt || null
    });
  }

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
    if (a.role === 'member') {
      const code = body.token;
      const user = users[code];
      const deviceId = String(body.device || '').trim().slice(0, 100);
      if (deviceId) {
        const devices = Array.isArray(user.devices) ? user.devices : [];
        const existing = devices.find((d) => d.id === deviceId);
        if (existing) {
          existing.lastSeen = new Date().toISOString();
          await store.setJSON('users', users);
        } else if (devices.length >= 2) {
          return json({ ok: false, error: 'This access code is already in use on 2 devices. Ask the admin to reset devices for this code.' });
        } else {
          devices.push({ id: deviceId, lastSeen: new Date().toISOString() });
          user.devices = devices;
          await store.setJSON('users', users);
        }
      }
    }
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
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return json({ error: 'Access duration must be between 1 and 3650 days.' }, 400);
    }
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
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return json({ error: 'Extension must be between 1 and 3650 days.' }, 400);
    }
    if (users[body.code]) { const base = Math.max(Date.now(), Date.parse(users[body.code].expiresAt || 0) || Date.now()); users[body.code].expiresAt = new Date(base + days * 86400000).toISOString(); await store.setJSON('users', users); }
    return json({ ok: true, expiresAt: users[body.code] && users[body.code].expiresAt });
  }
  if (action === 'set-expiry') {
    if (!users[body.code]) return json({ error: 'Unknown code.' }, 404);
    const time = Date.parse(body.expiresAt || '');
    if (!time) return json({ error: 'Invalid date.' }, 400);
    users[body.code].expiresAt = new Date(time).toISOString();
    await store.setJSON('users', users);
    return json({ ok: true, expiresAt: users[body.code].expiresAt });
  }
  if (action === 'reset-devices') {
    if (!users[body.code]) return json({ error: 'Unknown code.' }, 404);
    users[body.code].devices = [];
    await store.setJSON('users', users);
    return json({ ok: true });
  }
  if (action === 'delete') { delete users[body.code]; await store.setJSON('users', users); return json({ ok: true }); }
  if (action === 'dismiss') { const pending = await pendingOf(store); await store.setJSON('pending', pending.filter(x => x.id !== body.id)); return json({ ok: true }); }

  return json({ error: 'unknown action' }, 400);
};
