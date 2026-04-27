// the-bridge daemon — HTTP/SSE server
// The persistent process that holds the agent registry, message queue, and router.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const viewscreenHtml = readFileSync(join(__dirname, 'viewscreen.html'), 'utf-8');
import config from '../bridge.config.js';
import { Registry } from './registry.js';
import { Queue } from './queue.js';
import { Router } from './router.js';

const registry = new Registry(config.dbPath);
const queue = new Queue(config.dbPath);
const router = new Router(registry, queue);

// Parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Extract route parameters from URL
function matchRoute(url, pattern) {
  const urlParts = url.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (urlParts.length !== patternParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

const server = createServer(async (req, res) => {
  // CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  try {
    // ── Viewscreen ─────────────────────────────────────────
    if (method === 'GET' && (path === '/' || path === '/viewscreen')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(viewscreenHtml);
      return;
    }

    // ── Health ──────────────────────────────────────────────
    if (method === 'GET' && path === '/health') {
      return json(res, {
        status: 'ok',
        uptime: process.uptime(),
        agents: registry.query().length,
      });
    }

    // ── List agents ────────────────────────────────────────
    if (method === 'GET' && path === '/agents') {
      const filter = {};
      if (url.searchParams.has('status')) filter.status = url.searchParams.get('status');
      if (url.searchParams.has('name')) filter.name = url.searchParams.get('name');
      if (url.searchParams.has('protocol')) filter.protocol = url.searchParams.get('protocol');
      return json(res, registry.query(filter));
    }

    // ── Announce agent ─────────────────────────────────────
    if (method === 'POST' && path === '/agents/announce') {
      const body = await parseBody(req);
      if (!body.name) return json(res, { error: 'name is required' }, 400);

      const result = registry.announce(body);
      console.log(`[daemon] agent announced: ${body.name} (${result.id}) ${result.reannounced ? '[reannounced]' : ''}`);

      // Broadcast to SSE clients
      router.broadcast({ type: 'agent_joined', agent: result });

      return json(res, result, 201);
    }

    // ── Depart agent ───────────────────────────────────────
    let params = matchRoute(path, '/agents/:id/depart');
    if (method === 'POST' && params) {
      const success = registry.depart(params.id);
      if (!success) return json(res, { error: 'agent not found' }, 404);

      router.broadcast({ type: 'agent_departed', agentId: params.id });
      console.log(`[daemon] agent departed: ${params.id}`);

      return json(res, { departed: true });
    }

    // ── Heartbeat ──────────────────────────────────────────
    params = matchRoute(path, '/agents/:id/heartbeat');
    if (method === 'POST' && params) {
      const success = registry.heartbeat(params.id);
      if (!success) return json(res, { error: 'agent not found or already departed' }, 404);
      return json(res, { ok: true });
    }

    // ── Send message ───────────────────────────────────────
    if (method === 'POST' && path === '/messages') {
      const body = await parseBody(req);
      if (!body.from || !body.to) {
        return json(res, { error: 'from and to are required' }, 400);
      }

      const result = router.route(body);
      console.log(`[daemon] message queued: ${result.id}`);
      return json(res, result, 201);
    }

    // ── Recent messages (viewscreen) ──────────────────────
    if (method === 'GET' && path === '/messages/recent') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      return json(res, queue.recent(limit));
    }

    // ── Poll inbox ─────────────────────────────────────────
    params = matchRoute(path, '/messages/:agentName');
    if (method === 'GET' && params) {
      const messages = queue.dequeue(params.agentName);
      return json(res, messages);
    }

    // ── Message status ─────────────────────────────────────
    params = matchRoute(path, '/messages/:id/status');
    if (method === 'GET' && params) {
      const status = queue.status(params.id);
      if (!status) return json(res, { error: 'message not found' }, 404);
      return json(res, status);
    }

    // ── Acknowledge / update message ───────────────────────
    params = matchRoute(path, '/messages/:id/ack');
    if (method === 'POST' && params) {
      const body = await parseBody(req);
      const success = queue.acknowledge(params.id, body);
      if (!success) return json(res, { error: 'message not found or already acknowledged' }, 404);
      return json(res, { acknowledged: true });
    }

    // ── Mark delivered ─────────────────────────────────────
    params = matchRoute(path, '/messages/:id/delivered');
    if (method === 'POST' && params) {
      const success = queue.markDelivered(params.id);
      if (!success) return json(res, { error: 'message not found or not pending' }, 404);
      return json(res, { delivered: true });
    }

    // ── SSE event stream ───────────────────────────────────
    if (method === 'GET' && path === '/events') {
      const agentName = url.searchParams.get('agent');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      if (agentName) {
        router.addSSEClient(agentName, res);
        console.log(`[daemon] SSE client connected: ${agentName}`);
      }

      // Viewscreen always gets broadcast events
      router.addSSEClient('__broadcast__', res);

      return; // keep connection open
    }

    // ── 404 ────────────────────────────────────────────────
    json(res, { error: 'not found', path }, 404);
  } catch (e) {
    console.error(`[daemon] error handling ${method} ${path}:`, e.message);
    json(res, { error: e.message }, 500);
  }
});

// Graceful shutdown
function shutdown() {
  console.log('\n[daemon] shutting down...');
  server.close();
  registry.close();
  queue.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(config.port, config.host, () => {
  console.log(`[the-bridge] listening on http://${config.host}:${config.port}`);
  console.log(`[the-bridge] database: ${config.dbPath}`);
});
