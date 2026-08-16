import { ChatError, generateChatReply } from '../lib/chat.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Nur POST ist erlaubt.', code: 'method_not_allowed' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const result = await generateChatReply({
      mode: body.mode,
      message: body.message,
      history: body.history,
      articleNo: body.articleNo
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Ungültiges JSON.', code: 'invalid_json' });
    if (error instanceof ChatError) return res.status(error.status).json({ error: error.message, code: error.code });
    console.error(error);
    return res.status(500).json({ error: 'Unerwarteter Serverfehler.', code: 'internal_error' });
  }
}
