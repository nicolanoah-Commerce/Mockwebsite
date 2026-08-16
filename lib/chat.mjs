import fs from 'node:fs';

const PRODUCTS_URL = new URL('../data/products.json', import.meta.url);
const PRODUCTS = JSON.parse(fs.readFileSync(PRODUCTS_URL, 'utf8'));

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

function reviewStats(product) {
  const items = Array.isArray(product?.reviews?.items) ? product.reviews.items : [];
  const average = items.length ? items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length : 0;
  return { count: items.length, average: Number(average.toFixed(1)) };
}

function compactProduct(product, withAttributes = false) {
  const stats = reviewStats(product);
  const base = {
    articleNo: product.articleNo,
    name: product.name,
    category: product.category,
    brand: product.brand,
    priceCHF: product.price,
    description: product.description,
    featureSummary: product.featureSummary,
    demoReviewSummary: product.reviews?.summary || '',
    demoReviewCount: stats.count,
    demoReviewAverage: stats.average
  };
  if (withAttributes) base.attributes = product.attributes || {};
  return base;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-8)
    .map(item => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').trim().slice(0, 1800)
    }))
    .filter(item => item.content);
}

export class ChatError extends Error {
  constructor(message, status = 500, code = 'chat_error') {
    super(message);
    this.name = 'ChatError';
    this.status = status;
    this.code = code;
  }
}

export async function generateChatReply({ mode, message, history, articleNo }) {
  const safeMode = mode === 'service' ? 'service' : 'shopping';
  const cleanMessage = String(message || '').trim().slice(0, 1800);
  if (!cleanMessage) throw new ChatError('Bitte eine Nachricht eingeben.', 400, 'empty_message');
  if (!process.env.OPENAI_API_KEY) throw new ChatError('OPENAI_API_KEY ist auf dem Server nicht konfiguriert.', 503, 'missing_api_key');

  const selectedProduct = articleNo ? PRODUCTS.find(p => String(p.articleNo) === String(articleNo)) : null;
  const model = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6';

  const common = [
    'Du bist ein freundlicher LANDI Assistent für einen klickbaren Schweizer Detailhandels-Prototyp.',
    'Antworte auf Deutsch in Schweizer Rechtschreibung (ss statt ß).',
    'Halte Antworten kompakt und konkret, normalerweise 60 bis 140 Wörter.',
    'Erfinde keine Preise, technischen Daten, Verfügbarkeiten, Garantieleistungen oder Kundenmeinungen.',
    'Rezensionen im bereitgestellten Datensatz sind ausdrücklich Beispielrezensionen des Prototyps und müssen als solche bezeichnet werden.',
    'Wenn benötigte Informationen fehlen, sage das klar statt zu raten.'
  ];

  let instructions;
  let context;
  if (safeMode === 'service') {
    instructions = [
      ...common,
      'Du bist jetzt der KI-Serviceassistent.',
      'Hilf dem Nutzer, ein Problem sicher einzugrenzen und sinnvolle, risikoarme Prüfungen vorzuschlagen.',
      'Bei Arbeiten an Messern, rotierenden Teilen, Netzspannung, Benzin/Kraftstoff, Akku-Innenleben oder geöffneten elektrischen Komponenten sollst du von einer Eigenreparatur abraten und einen Serviceauftrag empfehlen.',
      'Fordere bei Bedarf zuerst einfache Informationen an, zum Beispiel Fehlermeldung, Geräusch, Zeitpunkt des Auftretens oder Ladezustand.',
      'Wenn ein Produkt ausgewählt ist, beziehe dich auf dessen bereitgestellte Produktdaten. Wenn nicht, bitte um die Auswahl des betroffenen Produkts.',
      'Du kannst am Ende sagen: "Wenn Sie möchten, übernehmen Sie die Problembeschreibung direkt in den Serviceauftrag."'
    ].join(' ');
    context = {
      selectedProduct: selectedProduct ? compactProduct(selectedProduct, true) : null,
      knownPurchasedArticlesInPrototype: ['108065', '100788']
    };
  } else {
    instructions = [
      ...common,
      'Du bist jetzt der KI-Produktberater auf der LANDI Landingpage.',
      'Empfehle ausschliesslich Produkte aus dem bereitgestellten Prototyp-Sortiment.',
      'Erkläre kurz, warum ein Produkt zur genannten Fläche, Nutzung oder zum Budget passt.',
      'Wenn mehrere Produkte passen, nenne höchstens drei mit Preis und Artikelnummer.',
      'Wenn der Nutzer nach einem Produkt ausserhalb des Datensatzes fragt, erkläre, dass der Prototyp nur das hinterlegte Sortiment kennt.'
    ].join(' ');
    context = { catalogue: PRODUCTS.map(product => compactProduct(product, false)) };
  }

  const input = [
    ...sanitizeHistory(history).map(item => ({ role: item.role, content: item.content })),
    {
      role: 'user',
      content: `${cleanMessage}\n\nKontextdaten des Prototyps:\n${JSON.stringify(context)}`
    }
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, instructions, input, max_output_tokens: 420 }),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new ChatError('Die KI-Anfrage hat zu lange gedauert.', 504, 'openai_timeout');
    throw new ChatError('Die Verbindung zum KI-Dienst ist fehlgeschlagen.', 502, 'openai_network_error');
  } finally {
    clearTimeout(timeout);
  }

  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    console.error('OpenAI chat API error', response.status, payload?.error?.message || payload);
    throw new ChatError(
      response.status === 429 ? 'Die KI ist momentan ausgelastet oder das API-Limit wurde erreicht.' : 'Der KI-Assistent ist momentan nicht verfügbar.',
      response.status === 429 ? 429 : 502,
      'openai_api_error'
    );
  }

  const text = extractOutputText(payload);
  if (!text) throw new ChatError('Die KI hat keine Antwort zurückgegeben.', 502, 'empty_ai_response');
  return { text, model: payload?.model || model, mode: safeMode };
}
