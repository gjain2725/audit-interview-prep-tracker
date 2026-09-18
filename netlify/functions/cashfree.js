import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

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

// Live and test mode sign webhooks with different secrets, so accept either.
// Add CASHFREE_CLIENT_SECRET_TEST while testing; remove it once you go live.
const SECRETS = [process.env.CASHFREE_CLIENT_SECRET, process.env.CASHFREE_CLIENT_SECRET_TEST].filter(Boolean);
const SECRET = SECRETS[0] || '';
const ACCESS_DAYS = parseInt(process.env.CASHFREE_ACCESS_DAYS || '365', 10);
const ENGLISH_DAYS = parseInt(process.env.ENGLISH_ACCESS_DAYS || '365', 10);

// ---- which product was bought? -------------------------------------------
// The main plan and the KPMG English Test pack both cost Rs 199, so the amount
// cannot tell them apart. Each product has its own Cashfree payment form, and
// the form's identity travels in the order (order_tags / order_note / link id).
// CASHFREE_ENGLISH_FORM holds the English form's slug or id; the words
// "english" and "kpmg" are matched as well so the default form name just works.
const ENGLISH_FORM = String(process.env.CASHFREE_ENGLISH_FORM || '').toLowerCase().trim();
const MAIN_FORM = String(process.env.CASHFREE_MAIN_FORM || 'missionbig4access').toLowerCase().trim();
const englishActive = (u) => !!(u && u.english && u.english.active !== false
  && (!u.english.expiresAt || Date.parse(u.english.expiresAt) > Date.now()));

function productOf(d, existingUser) {
  const order = d.order || {};
  const signals = {
    tags: order.order_tags || {}, note: order.order_note || '', id: order.order_id || '',
    link: d.payment_link || d.link || d.form || d.payment_form || {},
    meta: order.order_meta || {},
  };
  const hay = JSON.stringify(signals).toLowerCase();
  const needles = [ENGLISH_FORM, 'english', 'kpmg'].filter(Boolean);
  if (needles.some((n) => hay.includes(n))) return { product: 'english', how: 'form', signals };
  if (MAIN_FORM && hay.includes(MAIN_FORM)) return { product: 'main', how: 'form', signals };
  // No form signal at all. A member with most of the year still to run is far
  // more likely to be buying the English pack than renewing early. The admin
  // page shows which rule fired, and can grant or revoke the pack by hand.
  if (existingUser && existingUser.tier !== 'free' && existingUser.expiresAt
      && Date.parse(existingUser.expiresAt) - Date.now() > 60 * 86400000 && !englishActive(existingUser)) {
    return { product: 'english', how: 'inferred', signals };
  }
  return { product: 'main', how: 'default', signals };
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(10);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 10; i++) a[i] = Math.floor(Math.random() * 256); }
  let s = ''; for (const b of a) s += chars[b % chars.length];
  return 'MB4-' + s.slice(0, 5) + '-' + s.slice(5, 10);
}

// Cashfree signs: base64( HMAC_SHA256( timestamp + rawBody, secret ) )
function verify(rawBody, timestamp, signature) {
  if (!SECRETS.length || !signature || !timestamp) return false;
  const given = Buffer.from(String(signature));
  for (const sec of SECRETS) {
    try {
      const expected = Buffer.from(crypto.createHmac('sha256', sec).update(timestamp + rawBody).digest('base64'));
      if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return true;
    } catch (e) { /* try the next secret */ }
  }
  return false;
}


// ---- optional receipt email -------------------------------------------------
// Sends the access details when RESEND_API_KEY is configured. If it is not set,
// provisioning still works and the buyer uses the on-screen claim page instead.
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'Mission Big 4 <onboarding@resend.dev>';
const SITE = process.env.SITE_URL || 'https://missionbig4.in';

const SMTP = {
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
};
const mailReady = () => !!(SMTP.host && SMTP.user && SMTP.pass) || !!RESEND_KEY;

async function sendViaSmtp(to, subject, html) {
  const transporter = nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.port === 465,
    auth: { user: SMTP.user, pass: SMTP.pass },
  });
  const info = await transporter.sendMail({ from: MAIL_FROM || SMTP.user, to, subject, html });
  return { ok: true, via: 'smtp', id: info && info.messageId };
}

async function sendAccessEmail(to, name, code, expiresAt) {
  if (!to || !mailReady()) return { skipped: true };
  const nice = (() => { try { return new Date(expiresAt).toDateString(); } catch (e) { return ''; } })();
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0d1330">',
    '<h2 style="margin:0 0 4px">Welcome to Mission Big 4</h2>',
    '<p style="color:#5b6784;margin:0 0 18px">Your payment of Rs 199 is confirmed. You have full access for one year',
    nice ? ' (until ' + nice + ')' : '', '.</p>',
    '<p style="margin:0 0 6px"><b>Your access code</b></p>',
    '<p style="font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:2px;background:#eef2fb;padding:12px 16px;border-radius:10px;margin:0 0 18px">', code, '</p>',
    '<p style="margin:0 0 8px">Two ways to get in:</p>',
    '<ol style="color:#334155;line-height:1.7;margin:0 0 18px;padding-left:20px">',
    '<li>Sign in with Google using <b>', to, '</b> - your access is already linked to it.</li>',
    '<li>Or enter the access code above on the login page.</li>',
    '</ol>',
    '<p style="margin:0 0 18px"><a href="', SITE, '" style="background:#3a5bef;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">Open Mission Big 4</a></p>',
    '<p style="color:#5b6784;font-size:13px;margin:0">Once inside you can set your own password from the sidebar, so you never need the code again.</p>',
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:22px 0">',
    '<p style="color:#94a3b8;font-size:11px;margin:0">Need help? Reply to this email or WhatsApp +91 8968549488.</p>',
    '</div>',
  ].join('');
  const subject = 'Your Mission Big 4 access is ready';
  // Prefer your own mailbox over a third party when SMTP is configured.
  if (SMTP.host && SMTP.user && SMTP.pass) {
    try { return await sendViaSmtp(to, subject, html); }
    catch (e) { if (!RESEND_KEY) return { ok: false, via: 'smtp', error: String(e && e.message) }; }
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + RESEND_KEY },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
    });
    return { ok: r.ok, via: 'resend', status: r.status };
  } catch (e) { return { ok: false, via: 'resend', error: String(e && e.message) }; }
}

async function sendEnglishEmail(to, name, code, expiresAt) {
  if (!to || !mailReady()) return { skipped: true };
  const nice = (() => { try { return new Date(expiresAt).toDateString(); } catch (e) { return ''; } })();
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0d1330">',
    '<h2 style="margin:0 0 4px">Your KPMG English Test pack is ready</h2>',
    '<p style="color:#5b6784;margin:0 0 18px">Your payment of Rs 199 is confirmed. All six timed mock tests are unlocked',
    nice ? ' until ' + nice : '', '.</p>',
    '<p style="margin:0 0 6px"><b>Your access code</b></p>',
    '<p style="font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:2px;background:#eef2fb;padding:12px 16px;border-radius:10px;margin:0 0 18px">', code, '</p>',
    '<p style="margin:0 0 8px">How to start:</p>',
    '<ol style="color:#334155;line-height:1.7;margin:0 0 18px;padding-left:20px">',
    '<li>Open <a href="', SITE, '/#/english">', SITE.replace(/^https?:\/\//, ''), '/#/english</a>.</li>',
    '<li>Sign in with Google using <b>', to, '</b>, or enter the access code above.</li>',
    '<li>Sit the tests one at a time with the 15-minute timer on.</li>',
    '</ol>',
    '<p style="margin:0 0 18px"><a href="', SITE, '/#/english" style="background:#3a5bef;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">Open the English tests</a></p>',
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:22px 0">',
    '<p style="color:#94a3b8;font-size:11px;margin:0">Need help? Reply to this email or WhatsApp +91 8968549488.</p>',
    '</div>',
  ].join('');
  const subject = 'Your KPMG English Test practice is unlocked';
  if (SMTP.host && SMTP.user && SMTP.pass) {
    try { return await sendViaSmtp(to, subject, html); }
    catch (e) { if (!RESEND_KEY) return { ok: false, via: 'smtp', error: String(e && e.message) }; }
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + RESEND_KEY },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html }),
    });
    return { ok: r.ok, via: 'resend', status: r.status };
  } catch (e) { return { ok: false, via: 'resend', error: String(e && e.message) }; }
}

const pick = (...vals) => vals.find(v => v != null && String(v).trim() !== '') || '';

export default async (req) => {
  // ---- admin: see what has been auto-provisioned ----
  if (req.method === 'GET') {
    const token = req.headers.get('x-auth') || '';
    if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) return json({ error: 'unauthorized' }, 401);

    // Read-only check that the mail provider key authenticates. Sends nothing.
    if (new URL(req.url).searchParams.get('mailcheck') === '1') {
      const smtpCfg = { host: SMTP.host || null, port: SMTP.port, user: SMTP.user ? SMTP.user.replace(/(.{2}).*(@.*)/, '$1***$2') : null, hasPass: !!SMTP.pass };
      if (SMTP.host && SMTP.user && SMTP.pass) {
        try {
          const t = nodemailer.createTransport({ host: SMTP.host, port: SMTP.port, secure: SMTP.port === 465, auth: { user: SMTP.user, pass: SMTP.pass } });
          await t.verify();
          return json({ mail: { configured: true, via: 'smtp', smtp: smtpCfg, keyValid: true, from: MAIL_FROM } });
        } catch (e) {
          return json({ mail: { configured: true, via: 'smtp', smtp: smtpCfg, keyValid: false, error: String(e && e.message) } });
        }
      }
      if (!RESEND_KEY) return json({ mail: { configured: false, smtp: smtpCfg, reason: 'No SMTP_* variables and no RESEND_API_KEY set' } });
      try {
        const r = await fetch('https://api.resend.com/domains', { headers: { authorization: 'Bearer ' + RESEND_KEY } });
        const txt = await r.text();
        let parsed = null; try { parsed = JSON.parse(txt); } catch (e) {}
        const list = (parsed && (parsed.data || parsed)) || [];
        const domains = Array.isArray(list) ? list.map((d) => ({ name: d.name, status: d.status })) : [];
        return json({
          mail: {
            configured: true,
            keyValid: r.status === 200,
            httpStatus: r.status,
            from: MAIL_FROM,
            verifiedDomains: domains,
            note: domains.length ? undefined : 'No verified domain yet: the sandbox sender usually only reaches your own Resend account email and often lands in spam.',
          },
        });
      } catch (e) {
        return json({ mail: { configured: true, keyValid: false, error: String(e && e.message) } });
      }
    }
    try {
      const store = getStore('cashfree-payments');
      const { blobs } = await store.list();
      const rows = [];
      for (const b of blobs.slice(0, 300)) {
        const v = await store.get(b.key, { type: 'json' });
        if (v) rows.push(v);
      }
      rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return json({ count: rows.length, payments: rows, configured: SECRETS.length, modes: { live: !!process.env.CASHFREE_CLIENT_SECRET, test: !!process.env.CASHFREE_CLIENT_SECRET_TEST } });
    } catch (e) { return json({ count: 0, payments: [], configured: !!SECRET }); }
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!SECRETS.length) return json({ error: 'CASHFREE_CLIENT_SECRET not configured' }, 503);

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

  const { product, how, signals } = productOf(d, code ? users[code] : null);

  // ---- KPMG English Test pack: an add-on, so the main plan is left untouched ----
  if (product === 'english') {
    if (!code) code = genCode();
    const prev = users[code] || {};
    const prevEng = prev.english || {};
    const engBase = englishActive(prev) && prevEng.expiresAt && Date.parse(prevEng.expiresAt) > now
      ? Date.parse(prevEng.expiresAt) : now;                       // extend rather than shorten
    const engExpires = new Date(engBase + ENGLISH_DAYS * 86400000).toISOString();
    const mainLapsed = prev.tier && prev.tier !== 'free' && prev.expiresAt && Date.parse(prev.expiresAt) <= now;
    users[code] = {
      ...prev,
      name: prev.name || name,
      email,
      phone: phone || prev.phone || '',
      // A brand-new buyer gets a free-tier account to hang the add-on on. A paid
      // member keeps their plan; a lapsed member drops to free so they can sign in.
      tier: (!prev.tier || mainLapsed) ? 'free' : prev.tier,
      expiresAt: mainLapsed ? null : (prev.expiresAt || null),
      active: true,
      createdAt: prev.createdAt || new Date().toISOString(),
      devices: Array.isArray(prev.devices) ? prev.devices : [],
      source: prev.source || 'cashfree-english',
      referredBy: prev.campaign || prev.referredBy || null,
      english: { ...prevEng, active: true, purchasedAt: prevEng.purchasedAt || new Date().toISOString(), expiresAt: engExpires, orderId, amount, source: 'cashfree' },
    };
    await store.setJSON('users', users);
    const mail = await sendEnglishEmail(email, name, code, engExpires);
    await payStore.setJSON('order:' + orderId, {
      orderId, at: new Date().toISOString(), email, name, phone, amount, code, expiresAt: engExpires, auto: true,
      product: 'english', detectedBy: how, signals,
      emailed: !!(mail && mail.ok), mailSkipped: !!(mail && mail.skipped),
    });
    return json({ ok: true, product: 'english', code, expiresAt: engExpires });
  }
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

  const mail = await sendAccessEmail(email, name, code, expiresAt);

  await payStore.setJSON('order:' + orderId, {
    orderId, at: new Date().toISOString(), email, name, phone, amount, code, expiresAt, auto: true,
    product: 'main', detectedBy: how, signals,
    emailed: !!(mail && mail.ok), mailSkipped: !!(mail && mail.skipped),
  });

  return json({ ok: true, product: 'main', code, expiresAt });
};
