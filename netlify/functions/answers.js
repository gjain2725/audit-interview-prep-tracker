import { getStore } from '@netlify/blobs';
import { PAID_ANSWERS } from './paid-answers-data.js';

// Model answers for the PAID areas. These are deliberately absent from the
// public HTML, so they cannot be read with View Source. Only an authenticated
// paying account (or admin) can fetch them.

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function roleFor(token) {
  if (!token) return 'none';
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) return 'admin';
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[token];
    if (!u || u.active === false) return 'none';
    if (u.expiresAt && Date.parse(u.expiresAt) <= Date.now()) return 'none';
    return u.tier === 'free' ? 'free' : 'member';
  } catch (e) { return 'none'; }
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const role = await roleFor(req.headers.get('x-auth') || new URL(req.url).searchParams.get('auth') || '');
  if (role !== 'member' && role !== 'admin') {
    return json({ error: 'unauthorized', message: 'Full access is required to read these answers.' }, 401);
  }

  // Optionally narrow to one area, so a page load only fetches what it shows.
  const area = String(new URL(req.url).searchParams.get('area') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  if (!area) return json({ answers: PAID_ANSWERS });

  const out = {};
  const prefix = area + '-';
  for (const id in PAID_ANSWERS) if (id.startsWith(prefix)) out[id] = PAID_ANSWERS[id];
  return json({ area, answers: out });
};
