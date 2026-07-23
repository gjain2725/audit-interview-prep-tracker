import { getStore } from '@netlify/blobs';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const CHAT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DRAFT_MODEL = process.env.GEMINI_DRAFT_MODEL || 'gemini-2.5-flash';
const DAILY_CAP = parseInt(process.env.CHAT_DAILY_CAP || '800', 10);

const SYSTEM = `You are "Audit Buddy", a friendly, sharp tutor helping Chartered Accountancy candidates prepare for Big 4 Global Delivery Center (EY GDS, KPMG KGS, PwC AC, Deloitte USI) audit interviews in India.

Your expertise: statutory audit, Ind AS / IFRS, SA / ISA auditing standards, CARO 2020, Schedule III, internal financial controls (IFC), audit procedures and assertions, fraud (SA 240), materiality, sampling, and behavioural / HR interview questions.

How to answer:
- Be concise and practical, like an interviewer or mentor — give the crisp answer first, then a short real-world example if it helps retention.
- Use Indian GAAP / Ind AS context by default.
- For "how do I answer this in an interview" questions, give a tight, confident model answer.
- If a question is outside audit / finance / interview prep, answer briefly but gently steer back to interview prep.
- Keep it focused: a few short paragraphs at most unless the user asks to go deeper. Use simple formatting (short paragraphs, dashes for lists).`;

const DRAFT_SYSTEM = `You are an expert Chartered Accountant and a Big 4 (EY/KPMG/PwC/Deloitte) audit interview coach in India. You write model answers a candidate can actually SPEAK in a technical interview.

Rules:
- Ground everything in Indian context: Ind AS / IFRS, SA (Standards on Auditing), CARO 2020, Schedule III, Companies Act.
- Be practical and structured, not textbook-vague. Show you understand how it works in real audit fieldwork.
- Prefer numbered points or short paragraphs. Include specific standard numbers, thresholds, and procedures where relevant.
- The answer should be interview-ready and confident, roughly 130–260 words.
- The example must be ONE concrete, memorable, real-world scenario (with small illustrative numbers if useful) that reinforces the answer.`;

async function roleFor(token) {
  if (!token) return 'none';
  if (process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) return 'admin';
  try {
    const users = (await getStore('tracker-users').get('users', { type: 'json' })) || {};
    const u = users[token];
    if (u && u.active !== false && (!u.expiresAt || Date.parse(u.expiresAt) > Date.now())) return 'member';
  } catch (e) {}
  return 'none';
}

async function callGemini(key, payload, models) {
  const list = models.filter((m, i, a) => m && a.indexOf(m) === i);
  const baseUrl = (process.env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  let lastErr = '';
  for (const model of list) {
    try {
      const url = `${baseUrl}/v1beta/models/${model}:generateContent`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const parts = (((d.candidates || [])[0] || {}).content || {}).parts || [];
        return { text: parts.map(p => p.text || '').join('').trim(), model };
      }
      lastErr = (d && d.error && d.error.message) || ('HTTP ' + r.status);
      if (/api key not valid|invalid api key|api_key_invalid|permission denied on resource/i.test(lastErr)) return { error: lastErr, fatal: true };
    } catch (e) { lastErr = e.message; }
  }
  return { error: lastErr };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.Gemini || process.env.GEMINI;
  if (!key) {
    return json({
      reply: "⚠️ The AI tutor isn't switched on yet — a Gemini API key still needs to be added to the site's environment variables. (One-time setup by the site owner.)",
      unconfigured: true,
    });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body) return json({ error: 'bad request' }, 400);

  // auth: chat needs an approved user; draft/refine (content generation) needs admin
  const role = await roleFor(req.headers.get('x-auth') || body.token);
  if (role === 'none') return json({ error: 'unauthorized', reply: 'Please log in to use the AI tutor.' }, 401);
  if ((body.task === 'draft' || body.task === 'refine') && role !== 'admin') return json({ error: 'admin only' }, 403);

  // soft daily cap protects the owner's Gemini quota on a public endpoint
  try {
    const store = getStore('chat-usage');
    const day = new Date().toISOString().slice(0, 10);
    const n = (await store.get('count:' + day, { type: 'json' })) || 0;
    if (n >= DAILY_CAP) return json({ reply: "⏳ The AI has reached today's usage limit. Please try again tomorrow.", error: "daily limit reached" });
    await store.setJSON('count:' + day, n + 1);
  } catch (e) { /* best-effort */ }

  // ---------- DRAFT / REFINE: generate or revise a model answer + example ----------
  if (body.task === 'draft' || body.task === 'refine') {
    const question = String(body.question || '').slice(0, 2000);
    if (!question && body.task === 'draft') return json({ error: 'no question' }, 400);
    let prompt;
    if (body.task === 'refine') {
      const answer = String(body.answer || '').slice(0, 6000);
      const example = String(body.example || '').slice(0, 3000);
      const instruction = String(body.instruction || '').slice(0, 1000);
      if (!instruction) return json({ error: 'no instruction' }, 400);
      prompt = `Interview question: "${question}"

Current model answer:
"""${answer}"""

${example ? 'Current example:\n"""' + example + '"""\n\n' : ''}Revise the answer (and the example if relevant) according to this instruction from the candidate: "${instruction}"

Keep everything correct and useful; apply the instruction faithfully. Output EXACTLY in this format — the answer first, then the delimiter on its own line, then the example. Do NOT use JSON, headings, or code fences:

<the revised model answer>
###EXAMPLE###
<the revised or new example>`;
    } else {
      const existing = String(body.answer || '').slice(0, 4000);
      prompt = `Interview question: "${question}"

${existing ? 'There is an existing answer to improve and enrich (keep what is correct, make it sharper and more complete):\n"""' + existing + '"""\n\n' : ''}Produce TWO things:
1) A strong model answer the candidate can speak in the interview.
2) ONE concrete example that aids memory.

Format your reply EXACTLY like this — the answer first, then the delimiter on its own line, then the example. Do NOT use JSON, headings, or code fences:

<the model answer>
###EXAMPLE###
<the example>`;
    }
    const payload = {
      system_instruction: { parts: [{ text: DRAFT_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
    };
    const res = await callGemini(key, payload, [DRAFT_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']);
    if (res.error) return json({ error: res.error });
    let answer = (res.text || '').trim();
    let example = '';
    const idx = answer.indexOf('###EXAMPLE###');
    if (idx >= 0) { example = answer.slice(idx + 13).trim(); answer = answer.slice(0, idx).trim(); }
    answer = answer.replace(/^(answer|model answer)\s*[:.-]\s*/i, '').trim();
    example = example.replace(/^(example)\s*[:.-]\s*/i, '').trim();
    return json({ answer, example, model: res.model });
  }

  // ---------- CHAT mode ----------
  const messages = (body && body.messages) || [];
  if (!messages.length) return json({ error: 'no messages' }, 400);
  const trimmed = messages.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: String(m.text || '').slice(0, 4000) }));
  const payload = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: trimmed.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
  };
  const res = await callGemini(key, payload, [CHAT_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']);
  if (res.error) return json({ reply: "Sorry, I couldn't reach Gemini right now — " + res.error });
  return json({ reply: res.text || "(I didn't get a response — please try rephrasing.)", model: res.model });
};
