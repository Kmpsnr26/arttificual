import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerLocally } from './lib/local-assistant.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_WEB_ROOT = join(PROJECT_ROOT, 'web');
const MAX_BODY_BYTES = 64 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function loadLocalEnv(path = join(PROJECT_ROOT, '.env.local')) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const splitAt = line.indexOf('=');
    if (splitAt < 1) continue;
    const key = line.slice(0, splitAt).trim();
    const value = line.slice(splitAt + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Payload terlalu besar.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    const error = new Error('JSON tidak valid.');
    error.statusCode = 400;
    throw error;
  }
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' http://127.0.0.1:* http://localhost:*; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
}

function safeStaticPath(webRoot, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const fullPath = resolve(webRoot, normalize(relative));
  const root = resolve(webRoot) + sep;
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

export function createAleServer({ webRoot = DEFAULT_WEB_ROOT } = {}) {
  const resolvedRoot = resolve(webRoot);
  return createHttpServer(async (req, res) => {
    securityHeaders(res);
    const requestUrl = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        service: 'ALE Private AI',
        version: '0.2.0',
        mode: 'local',
        providers: { offline: true, ollama: true, openai: false },
      });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/chat') {
      try {
        const body = await readJson(req);
        const result = await answerLocally({
          message: body.message,
          history: body.history,
          provider: body.provider === 'offline' || body.provider === 'ollama' ? body.provider : 'auto',
          ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
          model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
        });
        json(res, 200, result);
      } catch (error) {
        json(res, error.statusCode || 500, {
          error: error.statusCode && error.statusCode < 500 ? error.message : 'Layanan AI lokal mengalami kesalahan.',
        });
      }
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { error: 'Metode tidak didukung.' });
      return;
    }

    let filePath;
    try {
      filePath = safeStaticPath(resolvedRoot, requestUrl.pathname);
    } catch {
      filePath = null;
    }
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      json(res, 404, { error: 'Tidak ditemukan.' });
      return;
    }

    const headers = {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'Content-Length': statSync(filePath).size,
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else createReadStream(filePath).pipe(res);
  });
}

export async function startServer({
  host = process.env.HOST || '127.0.0.1',
  port = Number(process.env.PORT || 8080),
  webRoot = DEFAULT_WEB_ROOT,
  log = true,
} = {}) {
  const server = createAleServer({ webRoot });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolvePromise);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://${host}:${actualPort}`;
  if (log) console.log(`ALE Private AI: ${url}`);
  return { server, url };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv();
  startServer().catch((error) => {
    console.error(`ALE gagal dimulai: ${error.message}`);
    process.exitCode = 1;
  });
}

