import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComparisonError, generateProductComparison } from './lib/comparison.mjs';
import { ChatError, generateChatReply } from './lib/chat.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const MAX_BODY_BYTES = 32 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.md': 'text/markdown; charset=utf-8'
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendJson(res, status, payload) {
  securityHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ComparisonError('Anfrage ist zu gross.', 413, 'payload_too_large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  try { return JSON.parse(raw); } catch { throw new ComparisonError('Ungültiges JSON.', 400, 'invalid_json'); }
}

async function handleCompare(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Nur POST ist erlaubt.', code: 'method_not_allowed' });
  }
  const body = await readJson(req);
  const articleA = String(body.articleA || '').trim();
  const articleB = String(body.articleB || '').trim();
  if (!/^\d{2,12}$/.test(articleA) || !/^\d{2,12}$/.test(articleB)) {
    return sendJson(res, 400, { error: 'Ungültige Artikelnummer.', code: 'invalid_article' });
  }
  const result = await generateProductComparison({ articleA, articleB });
  return sendJson(res, 200, result);
}

async function handleChat(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Nur POST ist erlaubt.', code: 'method_not_allowed' });
  }
  const body = await readJson(req);
  const result = await generateChatReply({
    mode: body.mode,
    message: body.message,
    history: body.history,
    articleNo: body.articleNo
  });
  return sendJson(res, 200, result);
}

function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/index.html' : decoded;
  const relative = requested.replace(/^\/+/, '');
  const allowed = relative === 'index.html' || relative === '404.html' || relative.startsWith('assets/') || relative.startsWith('data/');
  if (!allowed || relative.includes('..')) return null;
  return path.join(ROOT, relative);
}

async function handleStatic(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return sendJson(res, 405, { error: 'Methode nicht erlaubt.' });
  const filePath = resolveStaticPath(req.url || '/');
  if (!filePath) return sendJson(res, 404, { error: 'Nicht gefunden.' });
  try {
    const body = await fs.readFile(filePath);
    securityHeaders(res);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  } catch {
    try {
      const fallback = await fs.readFile(path.join(ROOT, '404.html'));
      securityHeaders(res);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fallback);
    } catch {
      sendJson(res, 404, { error: 'Nicht gefunden.' });
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url || '').split('?')[0] === '/api/compare') return await handleCompare(req, res);
    if ((req.url || '').split('?')[0] === '/api/chat') return await handleChat(req, res);
    return await handleStatic(req, res);
  } catch (error) {
    if (error instanceof ComparisonError || error instanceof ChatError) return sendJson(res, error.status, { error: error.message, code: error.code });
    console.error(error);
    return sendJson(res, 500, { error: 'Unerwarteter Serverfehler.', code: 'internal_error' });
  }
});

server.listen(PORT, () => {
  console.log(`LANDI Prototype v9 läuft auf http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) console.log('Hinweis: OPENAI_API_KEY fehlt. KI-Vergleich und Chat-Assistenten zeigen bis zur Konfiguration eine verständliche Fehlermeldung.');
});
