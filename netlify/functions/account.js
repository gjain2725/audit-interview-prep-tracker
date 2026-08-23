import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
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
const refsOf = async (store) => (await store.get('referrals', { type: 'json' })) || {};
const cleanRef = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
function gen5(refs) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let tries = 0; tries < 50; tries++) {
    let c = ''; const a = new Uint8Array(5);
    try { globalThis.crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 5; i++) a[i] = Math.floor(Math.random() * 256); }
    for (const b of a) c += chars[b % chars.length];
    if (!refs[c]) return c;
  }
  return 'R' + Date.now().toString(36).toUpperCase().slice(-4);
}
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '415640736608-v21kq5d32csvtqovptdcg1l4ckdjesjt.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// ---- password hashing (scrypt, per-user salt; no external dependency) ----
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(String(password), s, 64).toString('hex');
  return s + ':' + dk;
}
function verifyPassword(password, stored) {
  try {
    if (!stored || typeof stored !== 'string' || stored.indexOf(':') < 0) return false;
    const [salt, dk] = stored.split(':');
    const calc = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(calc, 'hex'), b = Buffer.from(dk, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}
function passwordProblem(pw) {
  const v = String(pw || '');
  if (v.length < 8) return 'Password must be at least 8 characters.';
  if (v.length > 200) return 'Password is too long.';
  if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return 'Password must contain at least one letter and one number.';
  return null;
}

function authRole(token, users) {
  const admin = process.env.ADMIN_SECRET;
  if (admin && token && token === admin) return { role: 'admin', name: 'Gaurav Jain', email: process.env.ADMIN_EMAIL || '' };
  const u = token && users[token];
  if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) {
    // Free accounts are logged in but do NOT get paid content.
    if (u.tier === 'free') return { role: 'free', name: u.name, email: u.email, code: token };
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
      // No paid subscription for this email -> create (or reuse) a FREE account.
      // Free accounts can browse the free tier and are captured as leads.
      let freeCode = null;
      for (const [code, u] of Object.entries(users)) {
        if (u && u.tier === 'free' && String(u.email || '').toLowerCase().trim() === email) { freeCode = code; break; }
      }
      if (!freeCode) {
        freeCode = genCode();
        users[freeCode] = {
          name: payload.name || email.split('@')[0],
          email: payload.email,
          phone: '',
          tier: 'free',
          active: true,
          createdAt: new Date().toISOString(),
          expiresAt: null,
          devices: [],
          source: 'google',
        };
        await store.setJSON('users', users);
      }
      return json({ ok: true, role: 'free', token: freeCode, name: users[freeCode].name, email: payload.email, tier: 'free', needsPhone: !users[freeCode].phone });
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
    const ref = cleanRef(body.ref);
    const pending = await pendingOf(store);
    pending.push({ id: 'req-' + Date.now() + '-' + Math.round(Math.random() * 1e6), name, email, phone, ref: ref || null, requestedAt: new Date().toISOString() });
    await store.setJSON('pending', pending.slice(-1000));
    return json({ ok: true });
  }
  // Free account signup: captures name + email + phone as a lead, grants free tier.
  if (action === 'free-signup') {
    const name = String(body.name || '').slice(0, 80).trim();
    const email = String(body.email || '').slice(0, 120).trim().toLowerCase();
    const phone = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
    if (!name || !email || !phone) return json({ error: 'Please provide your name, email and phone number.' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
    if (phone.replace(/\D/g, '').length < 10) return json({ error: 'Please enter a valid phone number.' }, 400);

    // Already has a PAID subscription on this email -> tell them to use their code.
    for (const [code, u] of Object.entries(users)) {
      if (u && u.tier !== 'free' && String(u.email || '').toLowerCase().trim() === email && u.active !== false) {
        return json({ ok: true, role: 'member', token: code, name: u.name, email: u.email, expiresAt: u.expiresAt || null });
      }
    }
    // Reuse an existing free account for this email, topping up the phone if missing.
    for (const [code, u] of Object.entries(users)) {
      if (u && u.tier === 'free' && String(u.email || '').toLowerCase().trim() === email) {
        if (!u.phone) { u.phone = phone; await store.setJSON('users', users); }
        return json({ ok: true, role: 'free', token: code, name: u.name, email: u.email, tier: 'free' });
      }
    }
    const code = genCode();
    users[code] = {
      name, email, phone, tier: 'free', active: true,
      createdAt: new Date().toISOString(), expiresAt: null, devices: [],
      source: String(body.source || 'form').slice(0, 20),
      ref: cleanRef(body.ref) || null,
    };
    await store.setJSON('users', users);
    return json({ ok: true, role: 'free', token: code, name, email, tier: 'free' });
  }

  // Attach a phone number to an existing free account (used after Google sign-in).
  if (action === 'set-phone') {
    const phone = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
    if (phone.replace(/\D/g, '').length < 10) return json({ error: 'Please enter a valid phone number.' }, 400);
    const u = users[token];
    if (!u) return json({ error: 'unauthorized' }, 401);
    u.phone = phone;
    await store.setJSON('users', users);
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

  // ----- password login -----
  if (action === 'set-password') {
    // caller must already be signed in (google / code / admin token)
    const u = users[token];
    if (!u) return json({ error: 'unauthorized' }, 401);
    const problem = passwordProblem(body.password);
    if (problem) return json({ error: problem }, 400);
    u.passwordHash = hashPassword(body.password);
    u.passwordSetAt = new Date().toISOString();
    await store.setJSON('users', users);
    return json({ ok: true });
  }

  if (action === 'password-login') {
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    if (!email || !password) return json({ ok: false, error: 'Enter your email and password.' }, 400);
    let code = null, user = null;
    for (const [c, u] of Object.entries(users)) {
      if (u && u.passwordHash && String(u.email || '').toLowerCase().trim() === email) { code = c; user = u; break; }
    }
    // Same message either way, so this cannot be used to discover which emails exist.
    const bad = () => json({ ok: false, error: 'Incorrect email or password.' });
    if (!user || !verifyPassword(password, user.passwordHash)) return bad();
    if (user.active === false) return json({ ok: false, error: 'This account has been deactivated.' });
    if (user.expiresAt && Date.parse(user.expiresAt) <= Date.now()) {
      return json({ ok: false, error: 'Your subscription has expired. Please renew to continue.' });
    }
    const deviceId = String(body.device || '').trim().slice(0, 100);
    if (deviceId && user.tier !== 'free') {
      const devices = Array.isArray(user.devices) ? user.devices : [];
      const existing = devices.find((d) => d.id === deviceId);
      if (existing) { existing.lastSeen = new Date().toISOString(); await store.setJSON('users', users); }
      else if (devices.length >= 2) return json({ ok: false, error: 'This account is in use on 2 devices. Ask admin to reset devices.' });
      else { devices.push({ id: deviceId, lastSeen: new Date().toISOString() }); user.devices = devices; await store.setJSON('users', users); }
    }
    return json({
      ok: true,
      role: user.tier === 'free' ? 'free' : 'member',
      token: code,
      name: user.name,
      email: user.email,
      expiresAt: user.expiresAt || null,
      tier: user.tier || 'paid',
      needsPhone: !user.phone,
    });
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
    const amt = parseInt(body.amount != null ? body.amount : '199', 10);
    users[code] = {
      name: (body.name || (p && p.name) || 'Member'),
      email: (body.email || (p && p.email) || ''),
      phone: (body.phone || (p && p.phone) || ''),
      role: 'member', active: true,
      referredBy: cleanRef(body.ref != null ? body.ref : (p && p.ref)) || null,
      amountPaid: Number.isFinite(amt) ? amt : 199,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
    };
    await store.setJSON('users', users);
    if (p) await store.setJSON('pending', pending.filter(x => x.id !== body.id));
    return json({ ok: true, code, name: users[code].name, referredBy: users[code].referredBy, expiresAt: users[code].expiresAt });
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

  // ----- referral partners -----
  if (action === 'ref-create') {
    const refs = await refsOf(store);
    let rc = cleanRef(body.code).replace(/[^A-Z]/g, '').slice(0, 5);
    if (rc.length < 3) rc = gen5(refs);
    if (refs[rc]) return json({ error: 'Referral code "' + rc + '" already exists.' }, 400);
    refs[rc] = {
      code: rc,
      partner: String(body.partner || '').slice(0, 100).trim(),
      contact: String(body.contact || '').slice(0, 120).trim(),
      commissionPct: Math.min(100, Math.max(0, parseInt(body.commissionPct != null ? body.commissionPct : '50', 10) || 0)),
      note: String(body.note || '').slice(0, 200).trim(),
      createdAt: new Date().toISOString(),
    };
    await store.setJSON('referrals', refs);
    return json({ ok: true, code: rc, referral: refs[rc] });
  }
  if (action === 'ref-delete') {
    const refs = await refsOf(store); delete refs[cleanRef(body.code)]; await store.setJSON('referrals', refs);
    return json({ ok: true });
  }
  if (action === 'ref-report') {
    const refs = await refsOf(store);
    const rep = {};
    for (const u of Object.values(users)) {
      const rb = cleanRef(u.referredBy); if (!rb) continue;
      const amt = Number(u.amountPaid) || 199;
      if (!rep[rb]) rep[rb] = { code: rb, count: 0, gross: 0 };
      rep[rb].count++; rep[rb].gross += amt;
    }
    const rows = [];
    const seen = new Set();
    // referrals that have registered partners
    for (const code of Object.keys(refs)) {
      const r = rep[code] || { count: 0, gross: 0 };
      rows.push({ code, partner: refs[code].partner || '', contact: refs[code].contact || '', commissionPct: refs[code].commissionPct != null ? refs[code].commissionPct : 50, note: refs[code].note || '', count: r.count, gross: r.gross, commission: Math.round(r.gross * (refs[code].commissionPct != null ? refs[code].commissionPct : 50) / 100), registered: true });
      seen.add(code);
    }
    // codes used by buyers that were never registered (typos / ad-hoc) — default 50%
    for (const code of Object.keys(rep)) {
      if (seen.has(code)) continue;
      rows.push({ code, partner: '(unregistered)', contact: '', commissionPct: 50, note: '', count: rep[code].count, gross: rep[code].gross, commission: Math.round(rep[code].gross * 0.5), registered: false });
    }
    rows.sort((a, b) => b.gross - a.gross || b.count - a.count);
    return json({
      rows,
      totals: {
        gross: rows.reduce((s, r) => s + r.gross, 0),
        commission: rows.reduce((s, r) => s + r.commission, 0),
        referredUsers: rows.reduce((s, r) => s + r.count, 0),
      },
    });
  }

  return json({ error: 'unknown action' }, 400);
};
