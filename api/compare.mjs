import { ComparisonError, generateProductComparison } from '../lib/comparison.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Nur POST ist erlaubt.', code: 'method_not_allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const articleA = String(body.articleA || '').trim();
    const articleB = String(body.articleB || '').trim();

    if (!/^\d{2,12}$/.test(articleA) || !/^\d{2,12}$/.test(articleB)) {
      return res.status(400).json({ error: 'Ungültige Artikelnummer.', code: 'invalid_article' });
    }

    const result = await generateProductComparison({ articleA, articleB });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'Ungültiges JSON.', code: 'invalid_json' });
    }
    if (error instanceof ComparisonError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error(error);
    return res.status(500).json({ error: 'Unerwarteter Serverfehler.', code: 'internal_error' });
  }
}
