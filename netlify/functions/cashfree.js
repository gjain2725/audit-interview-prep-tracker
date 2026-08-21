import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

// Cashfree payment webhook -> automatic access provisioning.
//
// On a successful payment Cashfree calls this endpoint. We verify the
// signature with the merchant secret, then create (or extend) a paid account
// keyed to the buyer's email. Because google-login matches on email, the buyer
// simply signs in with Google and has full access immediately - no code to
// type, no manual approval, no 4 hour wait.
//
// Secrets are read from the environment and are never stored in the repo:
//   CASHFREE_CLIENT_SECRET  (required - verifies the webhook signature)
//   CASHFREE_CLIENT_ID      (optional - kept for future API calls)

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const SECRET = process.env.CASHFREE_CLIENT_SECRET || '';
const ACCESS_DAYS = parseInt(process.env.CASHFREE_ACCESS_DAYS || '365', 10);

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(10);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 10; i++) a[i] = Math.floor(Math.random() * 256); }
  let s = ''; for (const b of a) s += chars[b % chars.length];
  return 'MB4-' + s.slice(0, 5) + '-' + s.slice(5, 10);
}

// Cashfree signs: base64( HMAC_SHA256( timestamp + rawBody, secret ) )
function verify(rawBody, timestamp, signature) {
  if (!SECRET || !signature || !timestamp) return false;
  try {
    const expected = crypto.createHmac('sha256', SECRET).update(timestamp + rawBody).digest('base64');
    const a = Buffer.from(expected); const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

const pick = (...vals) => vals.find(v => v != null && String(v).trim() !== '') || '';

export default async (req) => {
  // ---- admin: see what has been auto-provisioned ----
  if (req.method === 'GET') {
    const token = req.headers.get('x-auth') || '';
    if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) return json({ error: 'unauthorized' }, 401);
    try {
      const store = getStore('cashfree-payments');
      const { blobs } = await store.list();
      const rows = [];
      for (const b of blobs.slice(0, 300)) {
        const v = await store.get(b.key, { type: 'json' });
        if (v) rows.push(v);
      }
      rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return json({ count: rows.length, payments: rows, configured: !!SECRET });
    } catch (e) { return json({ count: 0, payments: [], configured: !!SECRET }); }
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!SECRET) return json({ error: 'CASHFREE_CLIENT_SECRET not configured' }, 503);

  const raw = await req.text();
  const ts = req.headers.get('x-webhook-timestamp') || '';
  const sig = req.headers.get('x-webhook-signature') || '';
  if (!verify(raw, ts, sig)) return json({ error: 'bad signature' }, 401);

  let body; try { body = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }

  const type = String(body.type || '');
  if (!/PAYMENT_SUCCESS/i.test(type)) return json({ ok: true, ignored: type });

  const d = body.data || {};
  const cust = d.customer_details || d.customer || {};
  const order = d.order || {};
  const pay = d.payment || {};

  const email = String(pick(cust.customer_email, cust.email)).toLowerCase().trim();
  const name  = String(pick(cust.customer_name, cust.name, email.split('@')[0])).slice(0, 80);
  const phone = String(pick(cust.customer_phone, cust.phone)).replace(/[^\d+]/g, '').slice(0, 15);
  const amount = Number(pick(pay.payment_amount, order.order_amount, 199)) || 199;
  const orderId = String(pick(order.order_id, pay.cf_payment_id, Date.now()));

  const payStore = getStore('cashfree-payments');

  // idempotency: Cashfree retries webhooks
  const seen = await payStore.get('order:' + orderId, { type: 'json' });
  if (seen) return json({ ok: true, duplicate: true, code: seen.code });

  if (!email) {
    await payStore.setJSON('order:' + orderId, { orderId, at: new Date().toISOString(), amount, error: 'no email in payload', raw: cust });
    return json({ ok: true, warning: 'no email - needs manual activation' });
  }

  const store = getStore('tracker-users');
  const users = (await store.get('users', { type: 'json' })) || {};

  // Reuse an existing account for this email (free signups get upgraded in place).
  let code = null;
  for (const [c, u] of Object.entries(users)) {
    if (u && String(u.email || '').toLowerCase().trim() === email) { code = c; break; }
  }
  const now = Date.now();
  const base = code && users[code] && users[code].expiresAt && Date.parse(users[code].expiresAt) > now
    ? Date.parse(users[code].expiresAt) : now;          // extend rather than shorten
  const expiresAt = new Date(base + ACCESS_DAYS * 86400000).toISOString();

  if (!code) code = genCode();
  const prev = users[code] || {};
  users[code] = {
    ...prev,
    name: prev.name || name,
    email,
    phone: phone || prev.phone || '',
    tier: 'paid',
    active: true,
    createdAt: prev.createdAt || new Date().toISOString(),
    expiresAt,
    devices: Array.isArray(prev.devices) ? prev.devices : [],
    amountPaid: amount,
    approvedAt: new Date().toISOString(),
    source: 'cashfree',
    referredBy: prev.campaign || prev.referredBy || null,
  };
  await store.setJSON('users', users);

  await payStore.setJSON('order:' + orderId, {
    orderId, at: new Date().toISOString(), email, name, phone, amount, code, expiresAt, auto: true,
  });

  return json({ ok: true, code, expiresAt });
};
