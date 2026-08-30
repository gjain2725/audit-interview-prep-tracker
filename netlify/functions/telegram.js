import { getStore } from '@netlify/blobs';

// Telegram bot webhook.
//
// Telegram bots can only reply to people who message the bot first, so this is
// an auto-responder, never an outbound spam tool. Deep links of the form
//   https://t.me/<botname>?start=<REFCODE>
// carry the referral / campaign code through to the site link we send back, so
// a partner's group can be attributed all the way to a subscription.

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const SITE = process.env.SITE_URL || 'https://missionbig4.in';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const HOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20);

async function send(chatId, text, markup) {
  if (!TOKEN) return;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  };
  if (markup) body.reply_markup = markup;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) { /* best effort */ }
}

function pitch(link) {
  return [
    '<b>Mission Big 4 — Big 4 audit interview prep</b>',
    '',
    'Questions compiled from <b>20+ Big 4 interviewers</b> (EY · PwC · Deloitte · KPMG).',
    '',
    '<b>What you get for ₹199 a year:</b>',
    '• 80+ real interview questions with model answers',
    '• 480+ practice MCQs with full explanations',
    '• Worked examples, interviewer tips and audio revision',
    '• Mock interview panel and an interview tracker',
    '',
    `👉 <a href="${link}">Get 1 year access — ₹199</a>`,
    '',
    'That is under ₹17 a month, and access is instant.',
  ].join('\n');
}

// A DM is a warm lead — keep it so the owner can follow up.
async function remember(from, code) {
  try {
    const store = getStore('telegram-leads');
    const id = String(from.id);
    const prev = (await store.get(id, { type: 'json' })) || {};
    await store.setJSON(id, {
      id,
      username: from.username || prev.username || '',
      firstName: from.first_name || prev.firstName || '',
      lastName: from.last_name || prev.lastName || '',
      code: code || prev.code || '',
      firstSeen: prev.firstSeen || new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      messages: (prev.messages || 0) + 1,
    });
  } catch (e) { /* best effort */ }
}

export default async (req) => {
  // ---- admin read: list the people who have messaged the bot ----
  if (req.method === 'GET') {
    const token = req.headers.get('x-auth') || '';
    if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) return json({ error: 'unauthorized' }, 401);
    try {
      const store = getStore('telegram-leads');
      const { blobs } = await store.list();
      const rows = [];
      for (const b of blobs.slice(0, 500)) {
        const v = await store.get(b.key, { type: 'json' });
        if (v) rows.push(v);
      }
      rows.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
      return json({ count: rows.length, leads: rows });
    } catch (e) {
      return json({ count: 0, leads: [] });
    }
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!TOKEN) return json({ error: 'bot not configured' }, 503);

  // Telegram echoes this header back; it stops strangers POSTing to the webhook.
  if (HOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== HOOK_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  let update; try { update = await req.json(); } catch { update = null; }
  if (!update) return json({ ok: true });

  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat) return json({ ok: true });

  // Only auto-reply in private chats. Never post into groups.
  if (msg.chat.type !== 'private') return json({ ok: true });

  const text = String(msg.text || '').trim();
  const from = msg.from || {};

  // /start CODE  (from a t.me/<bot>?start=CODE deep link)
  let code = '';
  const m = /^\/start(?:\s+(\S+))?/i.exec(text);
  if (m && m[1]) code = clean(m[1]);

  await remember(from, code);

  const link = code ? `${SITE}/?ref=${encodeURIComponent(code.toLowerCase())}` : `${SITE}/?ref=telegram`;
  const markup = { inline_keyboard: [[{ text: '🎯 Start free', url: link }]] };

  const name = from.first_name ? `Hi ${from.first_name}! ` : 'Hi! ';
  await send(msg.chat.id, name + '\n\n' + pitch(link), markup);

  return json({ ok: true });
};
