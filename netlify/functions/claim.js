import { getStore } from '@netlify/blobs';

// Post-payment claim endpoint.
//
// Cashfree redirects the buyer back to /#/paid?order_id=... after checkout.
// The order was already verified by signature when the webhook stored it, so
// here we only need to confirm the person in front of us is the buyer. We ask
// for the email used at checkout and require it to match the stored order,
// which means an order id alone is not enough to claim an account.

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body; try { body = await req.json(); } catch { body = {}; }
  const orderId = String(body.order_id || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 120);
  const email = String(body.email || '').toLowerCase().trim();
  if (!orderId) return json({ ok: false, error: 'Missing order reference.' }, 400);
  if (!email) return json({ ok: false, error: 'Enter the email address you paid with.' }, 400);

  const payStore = getStore('cashfree-payments');
  const rec = await payStore.get('order:' + orderId, { type: 'json' });

  // The webhook can land a moment after the browser redirect.
  if (!rec) return json({ ok: false, pending: true, error: 'We have not received confirmation for this payment yet. Wait a few seconds and try again.' });
  if (rec.error || !rec.code) return json({ ok: false, error: 'This payment needs manual activation. Please contact support.' });
  if (String(rec.email || '').toLowerCase().trim() !== email) {
    return json({ ok: false, error: 'That email does not match this payment. Use the email you entered at checkout.' });
  }

  // Report the live account state, so the browser knows which role to sign in
  // as (a first-time English buyer holds a free-tier account with the add-on).
  let role = 'member', english = false, mainExpiresAt = rec.expiresAt || null;
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[rec.code];
    if (u) {
      const now = Date.now();
      const mainAlive = !u.expiresAt || Date.parse(u.expiresAt) > now;
      english = !!(u.english && u.english.active !== false && (!u.english.expiresAt || Date.parse(u.english.expiresAt) > now));
      role = (u.tier === 'free' || !mainAlive) ? 'free' : 'member';
      mainExpiresAt = u.expiresAt || null;
    }
  } catch (e) { /* fall back to the payment record */ }

  return json({
    ok: true,
    code: rec.code,
    name: rec.name || '',
    email: rec.email,
    expiresAt: mainExpiresAt,
    amount: rec.amount || 199,
    product: rec.product || 'main',
    englishExpiresAt: rec.product === 'english' ? (rec.expiresAt || null) : null,
    role,
    english,
  });
};
