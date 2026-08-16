import fs from 'node:fs';

const PRODUCTS_URL = new URL('../data/products.json', import.meta.url);
const PRODUCTS = JSON.parse(fs.readFileSync(PRODUCTS_URL, 'utf8'));
const CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getProduct(articleNo) {
  return PRODUCTS.find(product => String(product.articleNo) === String(articleNo)) || null;
}

function safeReview(review) {
  return {
    rating: Number(review?.rating || 0),
    title: String(review?.title || '').slice(0, 180),
    text: String(review?.text || '').slice(0, 1200)
  };
}

function promptProduct(product) {
  return {
    articleNo: product.articleNo,
    name: product.name,
    category: product.category,
    brand: product.brand,
    priceCHF: product.price,
    description: product.description,
    featureSummary: product.featureSummary,
    attributes: product.attributes || {},
    reviewSummary: product.reviews?.summary || '',
    exampleReviews: Array.isArray(product.reviews?.items)
      ? product.reviews.items.slice(0, 6).map(safeReview)
      : []
  };
}

function extractOutputText(payload) {
  if (!payload || !Array.isArray(payload.output)) return '';
  return payload.output
    .filter(item => item?.type === 'message' && Array.isArray(item.content))
    .flatMap(item => item.content)
    .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export class ComparisonError extends Error {
  constructor(message, status = 500, code = 'comparison_error') {
    super(message);
    this.name = 'ComparisonError';
    this.status = status;
    this.code = code;
  }
}

export async function generateProductComparison({ articleA, articleB }) {
  const a = getProduct(articleA);
  const b = getProduct(articleB);

  if (!a || !b) {
    throw new ComparisonError('Mindestens eines der Produkte wurde nicht gefunden.', 404, 'product_not_found');
  }
  if (a.articleNo === b.articleNo) {
    throw new ComparisonError('Bitte zwei unterschiedliche Produkte auswählen.', 400, 'same_product');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new ComparisonError('OPENAI_API_KEY ist auf dem Server nicht konfiguriert.', 503, 'missing_api_key');
  }

  const cacheKey = `${a.articleNo}:${b.articleNo}:${process.env.OPENAI_MODEL || 'gpt-5.6'}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.value;

  const model = process.env.OPENAI_MODEL || 'gpt-5.6';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28_000);

  const instructions = [
    'Du bist ein neutraler Produktvergleichsassistent für einen Schweizer Detailhändler.',
    'Schreibe auf Deutsch in Schweizer Rechtschreibung (ss statt ß).',
    'Verwende ausschliesslich die gelieferten Produktdaten. Erfinde keine technischen Eigenschaften, Preise, Verfügbarkeiten oder Kundenmeinungen.',
    'Die gelieferten Rezensionen sind Beispielrezensionen des Prototyps. Bezeichne sie ausdrücklich als Beispielrezensionen und niemals als echte Kundenbewertungen.',
    'Erstelle einen kompakten, gut lesbaren Vergleichstext mit ungefähr 140 bis 190 Wörtern.',
    'Vergleiche insbesondere Einsatzzweck, Preis, Komfort/Handhabung, relevante technische Unterschiede und das Muster in den Beispielrezensionen.',
    'Nenne klare Vor- und Nachteile beider Produkte, ohne einen Sieger zu erfinden.',
    'Schliesse mit einem Satz, der mit "Kurz gesagt:" beginnt und erklärt, für welchen Käufertyp welches Produkt besser passt.',
    'Keine Markdown-Überschriften, keine Aufzählungszeichen und keine Tabelle. Schreibe 2 kurze Absätze plus den abschliessenden Satz.'
  ].join(' ');

  const input = JSON.stringify({
    productA: promptProduct(a),
    productB: promptProduct(b)
  });

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        max_output_tokens: 520
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ComparisonError('Die KI-Anfrage hat zu lange gedauert.', 504, 'openai_timeout');
    }
    throw new ComparisonError('Die Verbindung zum KI-Dienst ist fehlgeschlagen.', 502, 'openai_network_error');
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  try { payload = await response.json(); } catch {}

  if (!response.ok) {
    const upstreamMessage = payload?.error?.message;
    console.error('OpenAI API error', response.status, upstreamMessage || payload);
    throw new ComparisonError(
      response.status === 429
        ? 'Die KI ist momentan ausgelastet oder das API-Limit wurde erreicht.'
        : 'Der KI-Vergleich konnte momentan nicht erstellt werden.',
      response.status === 429 ? 429 : 502,
      'openai_api_error'
    );
  }

  const text = extractOutputText(payload);
  if (!text) {
    throw new ComparisonError('Die KI hat keinen Vergleichstext zurückgegeben.', 502, 'empty_ai_response');
  }

  const value = {
    text,
    model: payload?.model || model,
    generatedAt: new Date().toISOString(),
    articles: [a.articleNo, b.articleNo]
  };
  CACHE.set(cacheKey, { createdAt: Date.now(), value });
  return value;
}
