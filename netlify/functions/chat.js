import { getStore } from '@netlify/blobs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const DAILY_CAP = parseInt(process.env.CHAT_DAILY_CAP || '800', 10);

const SYSTEM = `You are "Audit Buddy", a friendly, sharp tutor helping a Chartered Accountant (Himanshi) prepare for Big 4 Global Delivery Center (EY GDS, KPMG KGS, PwC AC, Deloitte USI) audit interviews in India.

Your expertise: statutory audit, Ind AS / IFRS, SA / ISA auditing standards, CARO 2020, Schedule III, internal financial controls (IFC), audit procedures and assertions, fraud (SA 240), materiality, sampling, and behavioural / HR interview questions.

How to answer:
- Be concise and practical, like an interviewer or mentor — give the crisp answer first, then a short real-world example if it helps retention.
- Use Indian GAAP / Ind AS context by default.
- For "how do I answer this in an interview" questions, give a tight, confident model answer.
- If a question is outside audit / finance / interview prep, answer briefly but gently steer back to interview prep.
- Keep it focused: a few short paragraphs at most unless the user asks to go deeper. Use simple formatting (short paragraphs, dashes for lists).`;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Accept a few env-var names (avoid Netlify's auto-injected, invalid GEMINI_API_KEY)
  const key = process.env.GEMINI_KEY || process.env.Gemini || process.env.GEMINI;
  if (!key) {
    return json({
      reply: "⚠️ The AI tutor isn't switched on yet — a Gemini API key still needs to be added to the site's environment variables. (One-time setup by the site owner.)",
      unconfigured: true,
    });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }
  const messages = (body && body.messages) || [];
  if (!messages.length) return json({ error: 'no messages' }, 400);

  // keep the request small and safe
  const trimmed = messages.slice(-12).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    text: String(m.text || '').slice(0, 4000),
  }));

  // soft daily cap protects the owner's Gemini quota on a public endpoint
  try {
    const store = getStore('chat-usage');
    const day = new Date().toISOString().slice(0, 10);
    const n = (await store.get('count:' + day, { type: 'json' })) || 0;
    if (n >= DAILY_CAP) return json({ reply: "⏳ The AI tutor has reached today's usage limit. Please try again tomorrow." });
    await store.setJSON('count:' + day, n + 1);
  } catch (e) { /* best-effort */ }

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: trimmed.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
  };

  // Try several models and use the first one available on this key's free tier
  const candidates = [MODEL, 'gemini-flash-latest', 'gemini-flash-lite-latest']
    .filter((m, i, a) => m && a.indexOf(m) === i);
  let lastErr = '';
  for (const model of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const cand = (data.candidates || [])[0] || {};
        const parts = (cand.content && cand.content.parts) || [];
        const reply = parts.map(p => p.text || '').join('').trim() || "(I didn't get a response — please try rephrasing.)";
        return json({ reply, model });
      }
      lastErr = (data && data.error && data.error.message) || ('HTTP ' + r.status);
      // stop early only for a clearly fatal auth/key problem; otherwise try the next model
      if (/api key not valid|invalid api key|api_key_invalid|permission denied on resource/i.test(lastErr)) {
        return json({ reply: "Sorry — the API key looks invalid: " + lastErr });
      }
    } catch (e) { lastErr = e.message; }
  }
  return json({ reply: "Sorry — none of the available models worked. Last error: " + lastErr });
};
