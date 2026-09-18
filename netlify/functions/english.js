import { getStore } from '@netlify/blobs';
import { ENGLISH_TESTS, ENGLISH_TEST_META } from './english-tests-data.js';

// KPMG English Test practice: the paid add-on's question bank.
//
// The tests live only on the server (english-tests-data.js) so they cannot be
// read from the page source. Anyone may fetch the test list (titles only);
// the questions go only to admin or to an account holding the English add-on.
//
// GET ?list=1   -> { tests:[{id,title,focus,count}], access:boolean }
// GET ?test=N   -> { test:{id,title,focus,questions:[...]} }   (add-on required)

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const englishActive = (u) => !!(u && u.english && u.english.active !== false
  && (!u.english.expiresAt || Date.parse(u.english.expiresAt) > Date.now()));

async function accessFor(req) {
  const token = req.headers.get('x-auth') || new URL(req.url).searchParams.get('auth') || '';
  if (!token) return { signedIn: false, access: false };
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) return { signedIn: true, access: true, admin: true };
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[token];
    if (!u || u.active === false) return { signedIn: false, access: false };
    return { signedIn: true, access: englishActive(u), expiresAt: (u.english && u.english.expiresAt) || null };
  } catch (e) { return { signedIn: false, access: false }; }
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const url = new URL(req.url);
  const who = await accessFor(req);

  if (url.searchParams.get('list') === '1') {
    return json({ tests: ENGLISH_TEST_META, access: who.access, expiresAt: who.expiresAt || null });
  }

  const id = parseInt(url.searchParams.get('test') || '', 10);
  const test = ENGLISH_TESTS.find((t) => t.id === id);
  if (!test) return json({ error: 'unknown test' }, 404);
  if (!who.signedIn) return json({ error: 'unauthorized', message: 'Sign in to open the tests.' }, 401);
  if (!who.access) return json({ error: 'payment_required', message: 'The KPMG English Test pack is a separate purchase.' }, 402);
  return json({ test });
};
