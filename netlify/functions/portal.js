import { getStore } from '@netlify/blobs';

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

const PROFILE_FIELDS = [
  'fullName', 'email', 'mobile', 'addressLine1', 'addressLine2', 'city',
  'state', 'pinCode', 'country', 'caStatus', 'caAttempt', 'qualificationYear',
  'articleshipFirm', 'experienceYears', 'currentEmployer', 'targetRole',
  'preferredFirms', 'preferredLocations', 'noticePeriod', 'linkedIn', 'skills',
  'avatarChoice',
];

const ALLOWED_AVATARS = new Set(['🐶', '🐱', '🦁', '🐼', '🦊', '🐨', '🐯', '🐰', '🦉', '🐸', '🦄', '🐧']);

const INTERVIEW_FIELDS = [
  'id', 'company', 'role', 'interviewDate', 'round', 'mode', 'interviewerName',
  'employerEmail', 'followUpDate', 'status', 'confidenceRating',
  'experienceRating', 'questionsAsked', 'feedback', 'nextStep', 'notes',
];

const VALID_STATUSES = new Set([
  'applied', 'scheduled', 'waiting', 'follow-up', 'rejected', 'cleared',
  'offer-received', 'accepted', 'declined',
]);

const trim = (value, max = 250) => String(value == null ? '' : value).trim().slice(0, max);

function cleanQuery(input = {}) {
  return {
    id: `q-${Date.now()}-${Math.round(Math.random() * 1e7)}`,
    subject: trim(input.subject, 150),
    message: trim(input.message, 2000),
    status: 'open',
    reply: '',
    repliedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function cleanProfile(input = {}) {
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    const max = ['addressLine1', 'addressLine2', 'skills'].includes(field) ? 500 : 160;
    profile[field] = trim(input[field], max);
  }
  if (!ALLOWED_AVATARS.has(profile.avatarChoice)) profile.avatarChoice = '';
  profile.marketingConsent = input.marketingConsent === true;
  profile.consentUpdatedAt = profile.marketingConsent
    ? trim(input.consentUpdatedAt, 40) || new Date().toISOString()
    : null;
  profile.updatedAt = new Date().toISOString();
  return profile;
}

function cleanInterview(input = {}) {
  const item = {};
  for (const field of INTERVIEW_FIELDS) {
    const max = ['questionsAsked', 'feedback', 'nextStep', 'notes'].includes(field) ? 2000 : 180;
    item[field] = trim(input[field], max);
  }
  item.id = item.id || `int-${Date.now()}-${Math.round(Math.random() * 1e7)}`;
  if (!VALID_STATUSES.has(item.status)) item.status = 'applied';
  item.confidenceRating = Math.min(5, Math.max(0, Number(input.confidenceRating) || 0));
  item.experienceRating = Math.min(5, Math.max(0, Number(input.experienceRating) || 0));
  item.updatedAt = new Date().toISOString();
  return item;
}

async function resolveAuth(req) {
  const url = new URL(req.url);
  const token = req.headers.get('x-auth') || url.searchParams.get('auth') || '';
  if (!token) return { role: 'none', key: null, token: '' };
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) {
    return {
      role: 'admin',
      key: 'admin',
      token,
      account: {
        name: 'Gaurav Jain',
        email: process.env.ADMIN_EMAIL || '',
        phone: '',
      },
    };
  }
  const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
  const user = users[token];
  if (user && user.active !== false && (!user.expiresAt || Date.parse(user.expiresAt) > Date.now())) {
    return {
      role: 'member',
      key: token,
      token,
      account: {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        expiresAt: user.expiresAt || null,
      },
    };
  }
  return { role: 'none', key: null, token: '' };
}

async function recordFor(key, account = {}) {
  const profileStore = getStore('tracker-profiles');
  const interviewStore = getStore('tracker-interviews');
  const queryStore = getStore('tracker-queries');
  const [savedProfile, savedInterviews, savedQueries] = await Promise.all([
    profileStore.get(`profile:${key}`, { type: 'json' }),
    interviewStore.get(`interviews:${key}`, { type: 'json' }),
    queryStore.get(`queries:${key}`, { type: 'json' }),
  ]);
  const profile = savedProfile || {
    fullName: account.name || '',
    email: account.email || '',
    mobile: account.phone || '',
    country: 'India',
    marketingConsent: false,
  };
  return {
    profile,
    interviews: Array.isArray(savedInterviews) ? savedInterviews : [],
    queries: Array.isArray(savedQueries) ? savedQueries : [],
  };
}

async function adminRecords() {
  const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
  const progressStore = getStore('tracker-pstate');
  const entries = Object.entries(users);
  return Promise.all(entries.map(async ([code, user]) => {
    const [record, savedProgress] = await Promise.all([
      recordFor(code, {
        name: user.name,
        email: user.email,
        phone: user.phone,
      }),
      progressStore.get(`ps:${code}`, { type: 'json' }),
    ]);
    const progressQ = {};
    for (const [questionId, value] of Object.entries((savedProgress && savedProgress.q) || {})) {
      const safe = {};
      if (value && value.done) safe.done = true;
      if (value && value.flag) safe.flag = true;
      if (value && value.note) safe.hasNote = true;
      if (Object.keys(safe).length) progressQ[questionId] = safe;
    }
    return {
      code,
      active: user.active !== false,
      expiresAt: user.expiresAt || null,
      createdAt: user.createdAt || null,
      profile: record.profile,
      interviews: record.interviews,
      queries: record.queries,
      progress: {
        q: progressQ,
        updatedAt: (savedProgress && savedProgress.updatedAt) || null,
      },
    };
  }));
}

export default async (req) => {
  const auth = await resolveAuth(req);
  if (auth.role === 'none') return json({ error: 'unauthorized' }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'me';
  const profileStore = getStore('tracker-profiles');
  const interviewStore = getStore('tracker-interviews');
  const queryStore = getStore('tracker-queries');
  const avatarStore = getStore('tracker-profile-files');

  if (req.method === 'GET' && action === 'me') {
    return json(await recordFor(auth.key, auth.account));
  }

  if (req.method === 'GET' && action === 'admin-list') {
    if (auth.role !== 'admin') return json({ error: 'admin only' }, 403);
    return json({ records: await adminRecords() });
  }

  if (req.method === 'GET' && action === 'avatar') {
    const requestedKey = auth.role === 'admin' && url.searchParams.get('code')
      ? url.searchParams.get('code')
      : auth.key;
    const result = await avatarStore.getWithMetadata(`avatar:${requestedKey}`, { type: 'arrayBuffer' });
    if (!result || !result.data) return json({ error: 'not found' }, 404);
    return new Response(result.data, {
      status: 200,
      headers: {
        'content-type': (result.metadata && result.metadata.type) || 'image/jpeg',
        'cache-control': 'no-store',
      },
    });
  }

  if (req.method === 'POST' && action === 'save-profile') {
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const profile = cleanProfile(body.profile);
    if (!profile.fullName) return json({ error: 'Name is required.' }, 400);
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }
    await profileStore.setJSON(`profile:${auth.key}`, profile);
    return json({ ok: true, profile });
  }

  if (req.method === 'POST' && action === 'save-avatar-choice') {
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const avatarChoice = trim(body.avatarChoice, 8);
    if (!ALLOWED_AVATARS.has(avatarChoice)) return json({ error: 'Invalid avatar choice.' }, 400);
    const current = (await profileStore.get(`profile:${auth.key}`, { type: 'json' })) || {
      fullName: auth.account.name || '',
      email: auth.account.email || '',
      mobile: auth.account.phone || '',
      country: 'India',
      marketingConsent: false,
    };
    current.avatarChoice = avatarChoice;
    current.updatedAt = new Date().toISOString();
    await profileStore.setJSON(`profile:${auth.key}`, current);
    return json({ ok: true, avatarChoice });
  }

  if (req.method === 'POST' && action === 'save-interviews') {
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const source = Array.isArray(body.interviews) ? body.interviews : [];
    if (source.length > 100) return json({ error: 'Maximum 100 interview entries.' }, 400);
    const interviews = source.map(cleanInterview);
    await interviewStore.setJSON(`interviews:${auth.key}`, interviews);
    return json({ ok: true, interviews });
  }

  if (req.method === 'POST' && action === 'submit-query') {
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const subject = trim(body.subject, 150);
    const message = trim(body.message, 2000);
    if (!subject || !message) return json({ error: 'Please enter a subject and your question.' }, 400);
    const list = (await queryStore.get(`queries:${auth.key}`, { type: 'json' })) || [];
    if (list.length >= 50) return json({ error: 'Maximum 50 queries reached. Please wait for replies before sending more.' }, 400);
    list.push(cleanQuery({ subject, message }));
    await queryStore.setJSON(`queries:${auth.key}`, list);
    return json({ ok: true, queries: list });
  }

  if (req.method === 'POST' && action === 'close-query') {
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const id = trim(body.id, 100);
    const list = (await queryStore.get(`queries:${auth.key}`, { type: 'json' })) || [];
    const item = list.find((x) => x.id === id);
    if (!item) return json({ error: 'Query not found.' }, 404);
    item.status = 'closed';
    await queryStore.setJSON(`queries:${auth.key}`, list);
    return json({ ok: true, queries: list });
  }

  if (req.method === 'POST' && action === 'reply-query') {
    if (auth.role !== 'admin') return json({ error: 'admin only' }, 403);
    let body;
    try { body = await req.json(); } catch { body = {}; }
    const code = trim(body.code, 100);
    const id = trim(body.id, 100);
    const reply = trim(body.reply, 3000);
    if (!code || !id || !reply) return json({ error: 'Missing reply details.' }, 400);
    const list = (await queryStore.get(`queries:${code}`, { type: 'json' })) || [];
    const item = list.find((x) => x.id === id);
    if (!item) return json({ error: 'Query not found.' }, 404);
    item.reply = reply;
    item.status = 'answered';
    item.repliedAt = new Date().toISOString();
    await queryStore.setJSON(`queries:${code}`, list);
    return json({ ok: true, queries: list });
  }

  if (req.method === 'POST' && action === 'avatar') {
    const type = trim(req.headers.get('content-type'), 100).toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      return json({ error: 'Use a JPG, PNG or WebP image.' }, 400);
    }
    const data = await req.arrayBuffer();
    if (!data.byteLength || data.byteLength > 2 * 1024 * 1024) {
      return json({ error: 'Profile picture must be under 2 MB.' }, 400);
    }
    await avatarStore.set(`avatar:${auth.key}`, data, {
      metadata: { type, size: data.byteLength, updatedAt: new Date().toISOString() },
    });
    return json({ ok: true });
  }

  if (req.method === 'DELETE' && action === 'avatar') {
    await avatarStore.delete(`avatar:${auth.key}`);
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
};
