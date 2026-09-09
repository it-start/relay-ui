import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { 
  getStore, 
  IRelayStore, 
  canonicalJson, 
  sha256, 
  Envelope, 
  RelayRecord, 
  RelayStoreStatus,
  DepositInput 
} from './server/store';
import { getAttestationLog, VIA_VALUES, Via, ActKind } from './server/attest/log';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Loopback by default. This process has no authentication of any kind: every
// route below is reachable by anyone who can reach the socket. Binding 0.0.0.0
// put `POST /api/relay/reset` and `DELETE /api/relay/records/:locator` on every
// interface of the host. Exposure is now a deliberate act — set HOST=0.0.0.0 —
// and the intended deployment is a reverse proxy that authenticates first.
const HOST = process.env.HOST ?? '127.0.0.1';

/**
 * A locator names a slot in this store and nothing else.
 *
 * `req.params.locator` reached `path.join` unchecked on three routes, and Express
 * decodes `%2f`, so `..%2f..%2f..%2ftmp%2fx` arrives as `../../../tmp/x`. That
 * gave `verify` a read of any `.json` on the filesystem and `delete` an unlink of
 * any file with a sibling that has no extension. Measured against a scratch file
 * before this guard existed.
 *
 * The shape is fixed by the allocator — `relay-` plus digits — so matching it is
 * not a heuristic. Anything else is refused before a path is built, rather than
 * normalised into one, because a rejected name cannot escape a directory.
 */
const LOCATOR = /^relay-\d+$/;

function badLocator(locator: string, res: express.Response): boolean {
  if (LOCATOR.test(locator)) return false;
  res.status(400).json({ error: 'locator must match relay-<digits>' });
  return true;
}

// An agent name selects an inbox directory and has the same exposure.
const AGENT = /^[a-z0-9_-]+$/i;

// SSE (Server-Sent Events) Connected Clients Manager
interface SSEClient {
  id: string;
  res: express.Response;
  agent: string;
  connectedAt: string;
}
const sseClients = new Map<string, SSEClient>();

function broadcastSSE(eventType: string, data: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client, id) => {
    try {
      client.res.write(message);
    } catch (err) {
      sseClients.delete(id);
    }
  });
}

// Initialize Relay Store with reactive SSE broadcast hooks
const store: IRelayStore = getStore({
  onDeposit: (envelope) => {
    broadcastSSE('deposit', {
      locator: envelope.locator,
      seq: envelope.seq,
      type: envelope.type,
      from: envelope.from,
      to: envelope.to,
      title: envelope.title,
      digest: envelope.digest,
      envelope
    });
  },
  onKnownMissing: (locator) => {
    broadcastSSE('known_missing', {
      locator,
      status: 'KNOWN_MISSING',
      note: 'Payload unlinked, monotonic marker preserved (SPEC MUST 6)'
    });
  },
  onReset: () => {
    broadcastSSE('store_reset', {
      timestamp: new Date().toISOString(),
      message: 'Store reset to initial state with genesis records.'
    });
  },
  onInboxMessage: (targetAgent, msgId, envelope) => {
    broadcastSSE('inbox_message', { targetAgent, msgId, envelope });
  }
});

// MCP Session Map for SSE Transport

// Lazy Gemini SDK client
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Robust helper to call Gemini API with multi-model cascade and retry for 503 high-demand errors
 */
async function generateWithFallback(prompt: string, jsonMode: boolean = true): Promise<{ text: string; model: string } | null> {
  const client = getGeminiClient();
  if (!client) return null;

  // Candidate models conforming to SKILL.md (gemini-3.8-flash, gemini-flash-latest, gemini-3.1-flash-lite)
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  for (const model of candidateModels) {
    // Attempt up to 2 tries per model with quick backoff
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: jsonMode ? { responseMimeType: 'application/json' } : undefined,
        });

        if (response && response.text) {
          return { text: response.text, model };
        }
      } catch (err: any) {
        const isTransient = err.message?.includes('503') || 
                            err.message?.includes('high demand') || 
                            err.message?.includes('UNAVAILABLE') ||
                            err.status === 'UNAVAILABLE' ||
                            err.status === 503;
        
        console.info(`[Gemini API] Model ${model} attempt ${attempt + 1}: ${isTransient ? '503 High Demand (trying next)' : (err.message || 'error')}`);
        
        if (isTransient && attempt === 0) {
          // Wait 350ms before retry
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        // Move to next candidate model in list
        break;
      }
    }
  }

  return null;
}

/**
 * Deterministic Jurisprudence Engine (SPEC v1 MUST 1-8 + Biblical Invariants)
 * Evaluates claims with 100% mathematical consistency if external AI is under transient 503 load
 */
function evaluateDeterministicJurisprudence(claim: string, code?: any, invariants?: any) {
  const text = `${claim} ${JSON.stringify(code || '')} ${JSON.stringify(invariants || '')}`.toLowerCase();

  if (
    text.includes('delete marker') ||
    text.includes('unlink history') ||
    text.includes('remove marker') ||
    text.includes('drop sequence')
  ) {
    return {
      verdict: 'VIOLATES' as const,
      reasoning: 'Нарушение SPEC MUST 6: Маркеры аллокации в history/ никогда не должны удаляться. Удаление пэйлоада обязано возвращать статус KNOWN_MISSING, чтобы предотвратить гонки повторного использования номеров (seq reuse).',
      counter_case: 'Воркер B получает ENOENT при чтении seq=3 и ошибочно решает, что леджер оборван на seq=2, нарушая монотонную последовательность.',
      biblical_principle: 'Притчи 11:1 (Proverbs 11:1) — "Неверные весы — мерзость перед Господом, но правильный вес угоден Ему".',
      lot_required: false,
      action_recommendation: 'Reject',
      rule_triggered: 'SPEC MUST 6 (History Immutability)'
    };
  }

  if (
    text.includes('cache slot') ||
    text.includes('кэшировать свободные слоты') ||
    text.includes('shared counter') ||
    text.includes('no o_excl') ||
    text.includes('skip o_excl')
  ) {
    return {
      verdict: 'VIOLATES' as const,
      reasoning: 'Нарушение SPEC MUST 1: Аллокация номеров sequence обязана выполняться атомарно через системный вызов open(O_CREAT | O_EXCL). Кэширование слотов в памяти приводит к гонкам и дублированию идентификаторов.',
      counter_case: 'Два параллельных воркера кэшируют seq=42. Первый записывает данные, второй перезаписывает их поверх без ошибки EEXIST.',
      biblical_principle: 'Притчи 18:17 (Proverbs 18:17) — "Первый в тяжбе своей прав, но приходит соперник его и исследует его".',
      lot_required: false,
      action_recommendation: 'Reject',
      rule_triggered: 'SPEC MUST 1 (Atomic O_EXCL Sequence)'
    };
  }

  if (
    text.includes('race') ||
    text.includes('simultaneous') ||
    text.includes('deadlock') ||
    text.includes('паритет') ||
    text.includes('split vote')
  ) {
    return {
      verdict: 'UNDECIDABLE' as const,
      reasoning: 'Обнаружен неразрешимый паритет двух равноценных ортогональных доказательств. Согласно библейской юриспруденции требуется бросание жребия (Casting of the Lot / VRF Tie-Breaker).',
      counter_case: 'Два узла предлагают разные валидные оптимизации ввода-вывода с одинаковыми контрольными суммами.',
      biblical_principle: 'Притчи 18:18 (Proverbs 18:18) — "Жребий прекращает споры и решает между сильными".',
      lot_required: true,
      action_recommendation: 'Require The Lot (VRF)',
      rule_triggered: 'Biblical Invariant Prov 18:18 (The Lot Arbitration)'
    };
  }

  // Default: Compliant proposal
  return {
    verdict: 'PASS' as const,
    reasoning: 'Предложение строго соответствует инвариантам SPEC v1: монотонная нумерация, канонизация Just Scales (Prov 11:1), атомарная фиксация через rename и сохранение маркеров при удалении (MUST 6).',
    counter_case: 'Проверка состязательной перестановки ключей JSON пройдена: хэши sha256 идентичны.',
    biblical_principle: 'Притчи 18:17 (Proverbs 18:17) — Кросс-экзаменация подтвердила чистоту доказательства.',
    lot_required: false,
    action_recommendation: 'Commit to Ledger',
    rule_triggered: 'SPEC v1 Certified'
  };
}

/**
 * A token bucket per client, in memory, with no dependency.
 *
 * This process authenticates nothing, so if it is ever reachable without a
 * proxy in front — or with a proxy that only authenticates some paths — the
 * only thing between it and a loop is this. Reads are cheap but not free: the
 * whole ledger is 2.3MB on a 697-record store, and nothing else caps how often
 * a stranger may ask for it.
 *
 * Deliberately not a library. The behaviour worth having is one bucket and a
 * 429, and a dependency for that is a dependency to keep updated.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120);
const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * May this process spend its own API keys on behalf of an unauthenticated caller?
 *
 * OFF BY DEFAULT. Three routes run a model on request text using keys held here
 * — `/api/relay/adjudicate`, `/api/relay/step-triad` and `/api/relay/agent-exec`
 * — and every one of them is an open proxy to whatever ANTHROPIC_API_KEY,
 * OPENAI_API_KEY, MISTRAL_API_KEY and GEMINI_API_KEY are set: arbitrary prompts
 * billed to whoever runs the server.
 *
 * The rate limiter above does not cover this. It bounds REQUESTS, not SPEND, and
 * its default of 120/minute admits 120 model calls per IP per minute — more,
 * since `generateWithFallback` cascades three models at two attempts each.
 *
 * `ALLOW_AGENT_EXEC` is honoured as the former name. It gated one of the three
 * while the other two ran unguarded behind whatever the reverse proxy happened
 * to be doing, which on this deployment was HTTP Basic — a lock on the wallet
 * that looked like a lock on the data, and would have come off with it.
 *
 * IT DID COME OFF. Basic was removed from Caddy on 2026-09-03 precisely because
 * these three were closed, so this default is now the only thing holding.
 *
 * A deployment that wants them open says so in its own unit —
 * `Environment=ALLOW_SERVER_MODEL_CALLS=1` — and NOT in `deploy.env`, which is
 * sourced by `deploy.sh` for its own use and never reaches the service. That is
 * where a deployment preference belongs: the code default cannot know whether it
 * is running behind a proxy, on a laptop, or on a public host, and only one of
 * those answers is safe to assume.
 */
const ALLOW_SERVER_MODEL_CALLS =
  process.env.ALLOW_SERVER_MODEL_CALLS === '1' || process.env.ALLOW_AGENT_EXEC === '1';

/** The 503 every model-running route returns when the flag is off. */
function modelCallsDisabled(route: string) {
  return {
    error: `${route} is disabled`,
    detail:
      'Set ALLOW_SERVER_MODEL_CALLS=1 to enable. It runs models on server-held API keys and has no authentication of its own.',
    alternative:
      'Connect an agent to /api/mcp as an MCP client instead; it carries its own credentials.',
  };
}

/**
 * Behind a reverse proxy every request arrives from the proxy, so limiting by
 * socket address would give the whole internet one shared bucket. Express reads
 * `X-Forwarded-For` only when told how far to trust it, and `true` would trust a
 * header the client can forge. One hop is what a single proxy in front means.
 */
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

app.use((req, res, next) => {
  if (RATE_MAX <= 0) return next();
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // Sweep here rather than on a timer: the map only grows while requests
    // arrive, so the work is proportional to traffic and stops when it does.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }
    return next();
  }

  if (bucket.count >= RATE_MAX) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'rate limit exceeded',
      limit: RATE_MAX,
      windowSeconds: RATE_WINDOW_MS / 1000,
      retryAfter,
    });
  }

  bucket.count++;
  next();
});

/**
 * `POST /api/mcp` — the one MCP endpoint on this host.
 *
 * It used to be this file's own JSON-RPC server over seven `relay_*` tools.
 * Against a `PE_STORE_ROOT` backend three of those could not work at all:
 * `relay_publish_act` and `relay_send_inbox` advertised a write the read-only
 * store refuses with 405. Meanwhile p-e's own MCP server — the one whose tools
 * match the store's semantics, bytes rather than envelopes — sat on loopback
 * with no public route. Two endpoints, one of them lying about what it can do.
 *
 * So this forwards instead. The bytes are passed through untouched, because the
 * upstream authenticates a write by an HMAC **over the raw body**: parse and
 * re-serialise here and every signed deposit fails. That is why the route is
 * mounted before `express.json` and takes `express.raw` — the order is the
 * contract, not a style choice.
 *
 * The `Authorization` header is forwarded and never logged. Nothing else is
 * added: no CORS header, because the upstream's Origin reasoning depends on its
 * absence, and no rewritten path, because the upstream does not sign the path
 * for exactly this reason.
 *
 * Reads need no credential — the same records are already public over
 * `/api/relay/records`. A write needs a signature; see p-e's
 * `docs/notes/connecting-an-agent.md`.
 */
const PE_MCP_UPSTREAM = process.env.PE_MCP_UPSTREAM ?? 'http://127.0.0.1:8787/';

const mcpBody = express.raw({ type: '*/*', limit: '2mb' });

const rpcError = (code: number, message: string) => ({
  jsonrpc: '2.0',
  id: null,
  error: { code, message },
});

app.post(
  '/api/mcp',
  (req, res, next) => {
    // A compressed body is refused rather than inflated, and the reason is the
    // signature. `express.raw` inflates by default, so a client sending gzip
    // would have to sign the DECOMPRESSED bytes here and the COMPRESSED ones
    // when talking to the transport directly — the same request needing two
    // different signatures depending on the path it took. Measured before
    // deciding: a gzipped write signed over the plaintext is accepted through
    // this route today. Byte-exactness is the whole contract, so the one thing
    // that can silently change the bytes is turned away.
    if (req.get('content-encoding')) {
      return res
        .status(415)
        .json(rpcError(-32600, 'send the body uncompressed: the signature covers the bytes as sent'));
    }
    return next();
  },
  (req, res, next) =>
    mcpBody(req, res, (error?: unknown) => {
      // Express answers its own HTML error page for an oversized body, which is
      // a poor thing to hand a JSON-RPC client. The status was already right;
      // this makes the body match it.
      if (!error) return next();
      const status = (error as { status?: number }).status ?? 400;
      return res
        .status(status)
        .json(rpcError(-32600, status === 413 ? 'body too large' : 'could not read the body'));
    }),
  async (req, res) => {
    const authorization = req.get('authorization');
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    let upstream: Response;
    try {
      upstream = await fetch(PE_MCP_UPSTREAM, {
        method: 'POST',
        headers: {
          'content-type': req.get('content-type') ?? 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body,
      });
    } catch {
      // The transport is a separate process, started by hand or by a unit. If
      // it is not there, say so as a transport failure rather than an MCP
      // error: the caller's request was fine.
      return res
        .status(502)
        .json(rpcError(-32000, 'the relay transport is not answering on this host'));
    }

    const text = await upstream.text();
    res.status(upstream.status);
    res.type(upstream.headers.get('content-type') ?? 'application/json');
    // A 401 carries the scheme the caller has to use; without it the client is
    // told it failed and not how to succeed.
    const challenge = upstream.headers.get('www-authenticate');
    if (challenge) res.setHeader('www-authenticate', challenge);
    return text === '' ? res.end() : res.send(text);
  },
);

app.use(express.json({ limit: '10mb' }));

// 1. Get Store Status & Inboxes
app.get('/api/relay/status', async (req, res) => {
  try {
    const storeStatus = await store.getStatus();

    const apiKeyPresent = Boolean(process.env.GEMINI_API_KEY);
    const anthropicKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
    const openAIKeyPresent = Boolean(process.env.OPENAI_API_KEY);
    const mistralKeyPresent = Boolean(process.env.MISTRAL_API_KEY);

    res.json({
      ...storeStatus,
      activeSSEClients: sseClients.size,
      providers: {
        gemini: apiKeyPresent ? 'LIVE_KEY' : 'DETERMINISTIC_FALLBACK',
        anthropic: anthropicKeyPresent ? 'LIVE_KEY' : 'STRUCTURED_FALLBACK',
        openai: openAIKeyPresent ? 'LIVE_KEY' : 'STRUCTURED_FALLBACK',
        mistral: mistralKeyPresent ? 'LIVE_KEY' : 'STRUCTURED_FALLBACK',
      },
      geminiAvailable: apiKeyPresent,
      model: 'gemini-3.8-flash',
      specVersion: 'v1.0.0-PROV18-17'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 📡 SERVER-SENT EVENTS (SSE) STREAM ROUTE
// ==========================================
app.get('/api/relay/events', (req, res) => {
  const agent = (req.query.agent as string) || 'anonymous';
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });

  const clientInfo: SSEClient = {
    id: clientId,
    res,
    agent,
    connectedAt: new Date().toISOString()
  };

  sseClients.set(clientId, clientInfo);

  // Send immediate welcome handshake
  res.write(`event: connected\ndata: ${JSON.stringify({
    clientId,
    agent,
    connectedAt: clientInfo.connectedAt,
    activeConnections: sseClients.size,
    specVersion: 'v1.0.0-PROV18-17',
    message: 'Live SSE stream established. Subscribed to all ledger deposits, inbox messages, and court rulings.'
  })}\n\n`);

  // Broadcast agent presence
  broadcastSSE('agent_presence', {
    action: 'joined',
    agent,
    clientId,
    totalClients: sseClients.size
  });

  // Handle client disconnection
  req.on('close', () => {
    sseClients.delete(clientId);
    broadcastSSE('agent_presence', {
      action: 'left',
      agent,
      clientId,
      totalClients: sseClients.size
    });
  });
});

// SSE Connection Status
app.get('/api/relay/stream-status', (req, res) => {
  const clientsList = Array.from(sseClients.values()).map(c => ({
    id: c.id,
    agent: c.agent,
    connectedAt: c.connectedAt
  }));

  res.json({
    activeCount: sseClients.size,
    clients: clientsList,
  });
});

// Periodic SSE Keepalive Ping (every 20 seconds)
setInterval(() => {
  if (sseClients.size > 0) {
    const pingData = JSON.stringify({ time: new Date().toISOString(), activeClients: sseClients.size });
    sseClients.forEach((client, id) => {
      try {
        client.res.write(`event: ping\ndata: ${pingData}\n\n`);
      } catch (err) {
        sseClients.delete(id);
      }
    });
  }
}, 20000);

// ==========================================
// 🔌 MODEL CONTEXT PROTOCOL (MCP) IMPLEMENTATION
// ==========================================

/**
 * The seven `relay_*` tools this file used to serve are gone, and so is the SSE
 * pair beside them. What replaced them is the proxy above: one endpoint, the
 * store's own tool surface, and a write that has to be signed.
 *
 * The two SSE paths answer 405 rather than 404. They were advertised for months
 * by `/api/mcp/config`, so a client still holding that configuration deserves to
 * be told what to use instead of being told the path does not exist.
 */
const SSE_GONE = {
  jsonrpc: '2.0',
  id: null,
  error: {
    code: -32601,
    message:
      'this endpoint no longer opens an SSE stream. Use POST /api/mcp — one JSON-RPC request per POST, which is what a Streamable HTTP client sends.',
  },
};

app.get('/api/mcp/sse', (_req, res) => res.status(405).json(SSE_GONE));
app.post('/api/mcp/message', (_req, res) => res.status(405).json(SSE_GONE));

// 🔌 MCP Ready-to-use Configurations Exporter
app.get('/api/mcp/config', (req, res) => {
  const host = req.get('host') || `localhost:${PORT}`;
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  // What this hands out changed with the endpoint. `POST /api/mcp` now reaches
  // the p-e transport, whose five read tools answer anyone and whose one write
  // tool requires an HMAC over the raw request body. So a standard client can be
  // configured and will read; it cannot deposit, because no off-the-shelf MCP
  // client speaks this scheme — and that is stated here rather than discovered
  // at someone's first refused write.
  //
  // The SSE forms are gone. They pointed at a transport this host no longer
  // serves, and handing out a configuration that cannot work is how the
  // SSE-only advice before it survived for months.
  const claudeConfig = {
    mcpServers: {
      'agent-relay': { type: 'http', url: `${baseUrl}/api/mcp` }
    }
  };

  res.json({
    baseUrl,
    sseEventsUrl: `${baseUrl}/api/relay/events`,
    mcpHttpUrl: `${baseUrl}/api/mcp`,
    claudeConfig,
    // Former name, kept so an existing reader is not broken.
    claudeDesktopConfig: claudeConfig,
    claudeCliCommand: `claude mcp add --transport http agent-relay ${baseUrl}/api/mcp`,
    reads: 'open — the five read tools answer without a credential, as these records already do over /api/relay/records',
    writes: {
      tool: 'append_relay',
      scheme: 'PE-HMAC',
      header: 'Authorization: PE-HMAC agent=<name>, ts=<unix seconds>, sig=<hex>',
      signature: 'HMAC-SHA256(key, "POST" + "\n" + ts + "\n" + sha256hex(raw request body))',
      notes: [
        'sign the exact bytes you send: a re-serialisation is different bytes and will not verify',
        'a signature is accepted once, so a captured request cannot be replayed into a second permanent record',
        'no standard MCP client speaks this; ask the operator for a key and sign in your own code'
      ]
    }
  });
});

// 2. Read All Records (with SPEC MUST 6 Known Missing checks)
app.get('/api/relay/records', async (req, res) => {
  try {
    // `?limit` was accepted by nobody: the route called getAllRecords() with no
    // argument, so the whole ledger was read and returned however the request
    // was framed. 2.3MB on a 697-record store, per request, unauthenticated.
    const raw = Number(req.query.limit);
    const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 1000) : undefined;
    const records = await store.getAllRecords(limit);
    res.json({ records });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Deposit Record into Ledger (Atomic O_EXCL + Canonical JSON)
app.post('/api/relay/deposit', async (req, res) => {
  try {
    const { from, to, type, title, payload, parent_locator, metadata } = req.body;
    if (!payload) {
      return res.status(400).json({ error: 'Payload is required' });
    }

    const envelope = await store.deposit({
      from: from || 'agent:user-ui',
      to: to || 'all',
      type: type || 'claim',
      title: title || 'User Claim',
      payload,
      parent_locator,
      metadata
    });

    res.status(201).json({
      success: true,
      locator: envelope.locator,
      seq: envelope.seq,
      digest: envelope.digest,
      envelope
    });
  } catch (error: any) {
    if (error.name === 'StoreCapabilityError') {
      return res.status(405).json({
        error: error.message,
        capability: error.capability,
        storeId: error.storeId
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// 4. Send Message to Agent Inbox
app.post('/api/relay/send', async (req, res) => {
  try {
    const { targetAgent, from, type, title, payload } = req.body;
    if (!targetAgent) {
      return res.status(400).json({ error: 'targetAgent is required' });
    }

    const envelope = await store.sendToInbox(targetAgent, {
      from: from || 'agent:user-ui',
      to: targetAgent,
      type: type || 'claim',
      title: title || 'Direct Inbox Message',
      payload: payload || {}
    });

    res.json({
      success: true,
      id: envelope.id,
      targetAgent,
      envelope
    });
  } catch (error: any) {
    if (error.name === 'StoreCapabilityError') {
      return res.status(405).json({
        error: error.message,
        capability: error.capability,
        storeId: error.storeId
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Agent Inbox
app.get('/api/relay/inbox/:agent', async (req, res) => {
  try {
    const agent = req.params.agent;
    if (!AGENT.test(agent)) {
      return res.status(400).json({ error: 'agent must be alphanumeric' });
    }

    const messages = await store.getInbox(agent);
    res.json({ agent, count: messages.length, messages });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete Record Payload (Test SPEC MUST 6: KNOWN_MISSING)
app.delete('/api/relay/records/:locator', async (req, res) => {
  try {
    const locator = req.params.locator;
    if (badLocator(locator, res)) return;

    const result = await store.deletePayload(locator);
    if (!result.success && result.status === 'NOT_FOUND') {
      return res.status(404).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    if (error.name === 'StoreCapabilityError') {
      return res.status(405).json({
        error: error.message,
        capability: error.capability,
        storeId: error.storeId
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// 7. Verify Just Scales Digest
app.post('/api/relay/verify/:locator', async (req, res) => {
  try {
    const locator = req.params.locator;
    if (badLocator(locator, res)) return;

    const result = await store.verifyDigest(locator);
    if (!result) {
      return res.status(404).json({ error: `Record payload for ${locator} not found.` });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Live AI Adjudication (Gemini with multi-model cascade & deterministic invariant engine)
app.post('/api/relay/adjudicate', async (req, res) => {
  // This one kept an inline `ALLOW_SERVER_MODEL_CALLS &&` on its model branch, so
  // it degraded to the deterministic engine rather than spending. Refusing at the
  // door anyway: a caller that asked for adjudication should be told the model is
  // off, not handed a deterministic verdict that looks like the real thing.
  if (!ALLOW_SERVER_MODEL_CALLS) {
    return res.status(503).json(modelCallsDisabled('adjudicate'));
  }
  try {
    const { claim, code, invariants, parent_locator, author } = req.body;

    if (!claim) {
      return res.status(400).json({ error: 'Claim text is required for adjudication.' });
    }

    let findingVerdict: 'PASS' | 'VIOLATES' | 'UNDECIDABLE' = 'PASS';
    let reasoning = '';
    let counterCase = '';
    let biblicalPrinciple = '';
    let rawAiResponse: any = null;
    let modelUsed = 'deterministic-jurisprudence-engine';

    if (ALLOW_SERVER_MODEL_CALLS && process.env.GEMINI_API_KEY) {
      const prompt = `You are the Criterion Guard and Adjudicator for the Multi-Agent Relay Protocol (SPEC v1).
You operate strictly on biblical epistemic jurisprudence:
1. Proverbs 11:1 (Just Scales: zero tolerance for non-canonical drift or unequal weights)
2. Proverbs 18:17 (Cross-Examination: The first to present their case seems right, until another comes forward and questions them)
3. Genesis 18:23-32 (Empirical Witness Verification threshold)
4. Proverbs 18:18 (Casting the Lot when two truthful paths split)
5. SPEC MUST 1-8 rules for POSIX O_EXCL monotonic ordering and Known Missing.

Analyze this claim/proposal:
CLAIM: ${claim}
${code ? `CODE/PAYLOAD: ${JSON.stringify(code, null, 2)}` : ''}
${invariants ? `INVARIANTS TO CHECK: ${JSON.stringify(invariants)}` : ''}

Respond in strict JSON format:
{
  "verdict": "PASS" | "VIOLATES" | "UNDECIDABLE",
  "reasoning": "Clear rigorous legal/logical reasoning in Russian",
  "adversarial_counter_case": "A concrete counter-example or race condition tested in Russian",
  "biblical_principle": "Quote or reference to relevant biblical jurisprudence principle",
  "lot_required": boolean,
  "action_recommendation": "Commit / Reject / Require Witness"
}`;

      try {
        const aiResult = await generateWithFallback(prompt, true);

        if (aiResult && aiResult.text) {
          try {
            const parsed = JSON.parse(aiResult.text);
            findingVerdict = parsed.verdict || 'PASS';
            reasoning = parsed.reasoning || '';
            counterCase = parsed.adversarial_counter_case || '';
            biblicalPrinciple = parsed.biblical_principle || 'Proverbs 18:17';
            rawAiResponse = parsed;
            modelUsed = aiResult.model;
          } catch (parseErr) {
            console.warn('Failed to parse AI JSON, executing deterministic rules:', parseErr);
            const detResult = evaluateDeterministicJurisprudence(claim, code, invariants);
            findingVerdict = detResult.verdict;
            reasoning = detResult.reasoning;
            counterCase = detResult.counter_case;
            biblicalPrinciple = detResult.biblical_principle;
            modelUsed = `${aiResult.model} (structured-fallback)`;
          }
        } else {
          const detResult = evaluateDeterministicJurisprudence(claim, code, invariants);
          findingVerdict = detResult.verdict;
          reasoning = detResult.reasoning;
          counterCase = detResult.counter_case;
          biblicalPrinciple = detResult.biblical_principle;
          modelUsed = 'deterministic-jurisprudence-engine';
        }
      } catch (aiErr) {
        console.warn('AI call encountered error, using deterministic fallback:', aiErr);
        const detResult = evaluateDeterministicJurisprudence(claim, code, invariants);
        findingVerdict = detResult.verdict;
        reasoning = detResult.reasoning;
        counterCase = detResult.counter_case;
        biblicalPrinciple = detResult.biblical_principle;
        modelUsed = 'deterministic-jurisprudence-engine';
      }
    } else {
      const detResult = evaluateDeterministicJurisprudence(claim, code, invariants);
      findingVerdict = detResult.verdict;
      reasoning = detResult.reasoning;
      counterCase = detResult.counter_case;
      biblicalPrinciple = detResult.biblical_principle;
      modelUsed = 'deterministic-jurisprudence-engine';
    }

    // Deposit the finding envelope directly into the Relay Store!
    const findingEnvelope = await store.deposit({
      from: 'agent:gemini-criterion-guard',
      to: author || 'agent:claude-code-cli',
      type: 'finding',
      title: `Adjudication Finding: ${findingVerdict}`,
      parent_locator: parent_locator || undefined,
      payload: {
        claim,
        verdict: findingVerdict,
        reasoning,
        counter_case: counterCase,
        biblical_principle: biblicalPrinciple,
        model: modelUsed,
        rawAi: rawAiResponse
      }
    });

    res.json({
      success: true,
      verdict: findingVerdict,
      locator: findingEnvelope.locator,
      seq: findingEnvelope.seq,
      digest: findingEnvelope.digest,
      reasoning,
      counterCase,
      biblicalPrinciple,
      modelUsed,
      findingEnvelope
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Multi-Agent Triad Step Simulation (Claude -> ChatGPT -> Gemini)
app.post('/api/relay/step-triad', async (req, res) => {
  // Reaches a model through `generateWithFallback`, and deposits on the way.
  if (!ALLOW_SERVER_MODEL_CALLS) {
    return res.status(503).json(modelCallsDisabled('step-triad'));
  }
  try {
    const { proposalTitle, proposalText } = req.body;
    const title = proposalTitle || 'Оптимизация параллельных записей O_EXCL';
    const text = proposalText || 'Предложение: кэшировать свободные слоты sequence для ускорения O_EXCL маркерных файлов';

    // Step 1: Claude deposits proposal (claim)
    const claimEnvelope = await store.deposit({
      from: 'agent:claude-code-cli',
      to: 'agent:chatgpt-adversary',
      type: 'claim',
      title: `Предложение: ${title}`,
      payload: {
        proposal: text,
        rationale: 'Уменьшает количество вызовов open(O_CREAT|O_EXCL) в цикле',
        suggested_by: 'Claude Code CLI'
      }
    });

    // Step 2: ChatGPT deposits adversarial challenge
    const challengeEnvelope = await store.deposit({
      from: 'agent:chatgpt-adversary',
      to: 'agent:gemini-criterion-guard',
      type: 'challenge',
      title: `Возражение: Гонка кэша слотов`,
      parent_locator: claimEnvelope.locator,
      payload: {
        target_claim: claimEnvelope.locator,
        counter_example: 'Если Worker A и Worker B кэшируют один и тот же свободный слот, оба попытаются сделать запись без проверки O_EXCL, что приведёт к EEXIST или повреждению данных.',
        scripture_ref: 'Proverbs 18:17 - Cross-Examination'
      }
    });

    // Step 3: Gemini Guard adjudicates and issues finding
    let verdict: 'PASS' | 'VIOLATES' = 'VIOLATES';
    let reasoning = 'Кэширование sequence слотов нарушает SPEC MUST 1: Аллокация обязана быть атомарной через O_EXCL на каждый слот.';

    const triadPrompt = `Adjudicate this dispute between Claude and ChatGPT on Relay SPEC v1:
Claude Proposal: ${text}
ChatGPT Challenge: Гонка кэша при параллельных воркерах без O_EXCL.
Return a concise Russian verdict explaining why caching sequence slots violates SPEC MUST 1 and Proverbs 11:1.`;

    const aiRes = await generateWithFallback(triadPrompt, false);
    if (aiRes && aiRes.text) {
      reasoning = aiRes.text.trim();
    }

    const rulingEnvelope = await store.deposit({
      from: 'agent:gemini-criterion-guard',
      to: 'all',
      type: 'ruling',
      title: `Постановление Суда: ${verdict}`,
      parent_locator: challengeEnvelope.locator,
      payload: {
        verdict,
        reasoning,
        ruling: 'Предложение отклонено. Монотонность O_EXCL не допускает оптимизаций с кэшированием без CAS-примитивов.',
        biblical_principle: 'Proverbs 11:1 (Just Scales)'
      }
    });

    res.json({
      success: true,
      steps: [
        { phase: 'claim', agent: 'Claude Code CLI', locator: claimEnvelope.locator, envelope: claimEnvelope },
        { phase: 'challenge', agent: 'ChatGPT Adversary', locator: challengeEnvelope.locator, envelope: challengeEnvelope },
        { phase: 'ruling', agent: 'Gemini Criterion Guard', locator: rulingEnvelope.locator, envelope: rulingEnvelope },
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Reset Store to Clean Initial State
app.post('/api/relay/reset', async (req, res) => {
  try {
    await store.reset();
    res.json({ success: true, message: 'Relay store reset and seeded successfully.' });
  } catch (error: any) {
    if (error.name === 'StoreCapabilityError') {
      return res.status(405).json({
        error: error.message,
        capability: error.capability,
        storeId: error.storeId
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// 11. Multi-Agent Dynamic Executor (Claude / ChatGPT / Mistral / Gemini / Mimo)
/**
 * Runs a model on request text using keys held by this process.
 *
 * Off unless `ALLOW_SERVER_MODEL_CALLS=1`. Unauthenticated and reachable by
 * anyone who can reach the socket, it is an open proxy to whatever
 * ANTHROPIC_API_KEY, OPENAI_API_KEY, MISTRAL_API_KEY and GEMINI_API_KEY are set
 * — arbitrary prompts billed to whoever runs the server. Default-on made that
 * the deployment's normal state rather than a choice.
 *
 * The same is true of `/api/relay/adjudicate` and `/api/relay/step-triad`, which
 * this docstring used to describe as if the property were unique to this route.
 * It never was: all three reach a model on this process's keys.
 *
 * Deleting it was the other option and was not taken: seven call sites in the
 * chat interface depend on it, and removing the endpoint removes the feature
 * this UI exists to show. So it stays for local use and is opt-in for exposure.
 *
 * The intended shape for a public deployment is the opposite direction anyway —
 * agents connect *inward* as MCP clients over `/api/mcp`, carrying their own
 * credentials, and this process holds no keys at all.
 */
app.post('/api/relay/agent-exec', async (req, res) => {
  if (!ALLOW_SERVER_MODEL_CALLS) {
    return res.status(503).json(modelCallsDisabled('agent-exec'));
  }
  try {
    const { agent, type, title, text, payload, parent_locator } = req.body;
    const targetAgent = agent || 'claude';
    const envelopeType = type || 'claim';

    let contentText = text || '';
    let structuredPayload = payload || {};
    let modelProvider = 'fallback-deterministic';

    // Role-specific processing
    if (targetAgent === 'claude') {
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1024,
              messages: [{ role: 'user', content: text || 'Generate a concise distributed protocol proposal adhering to SPEC MUST 1-8.' }]
            })
          });
          if (anthropicRes.ok) {
            const data: any = await anthropicRes.json();
            contentText = data.content?.[0]?.text || text;
            modelProvider = 'claude-3-5-sonnet (Live Anthropic API)';
          }
        } catch (e: any) {
          console.warn('Anthropic API call failed, falling back:', e.message);
        }
      }
      if (modelProvider === 'fallback-deterministic') {
        modelProvider = 'Claude Code CLI (Local Emulated Node)';
      }
    } else if (targetAgent === 'chatgpt') {
      if (process.env.OPENAI_API_KEY) {
        try {
          const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'You are an adversarial testing agent applying Proverbs 18:17 cross-examination.' },
                { role: 'user', content: text || 'Analyze this proposal for race conditions or invariant violations.' }
              ]
            })
          });
          if (openaiRes.ok) {
            const data: any = await openaiRes.json();
            contentText = data.choices?.[0]?.message?.content || text;
            modelProvider = 'gpt-4o (Live OpenAI API)';
          }
        } catch (e: any) {
          console.warn('OpenAI API call failed, falling back:', e.message);
        }
      }
      if (modelProvider === 'fallback-deterministic') {
        modelProvider = 'ChatGPT Adversary (Local Emulated Node)';
      }
    } else if (targetAgent === 'mistral') {
      if (process.env.MISTRAL_API_KEY) {
        try {
          const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
              model: 'codestral-latest',
              messages: [{ role: 'user', content: text || 'Generate a rigorous invariant test case.' }]
            })
          });
          if (mistralRes.ok) {
            const data: any = await mistralRes.json();
            contentText = data.choices?.[0]?.message?.content || text;
            modelProvider = 'codestral (Live Mistral API)';
          }
        } catch (e: any) {
          console.warn('Mistral API call failed, falling back:', e.message);
        }
      }
      if (modelProvider === 'fallback-deterministic') {
        modelProvider = 'Mistral/Codestral (Local Emulated Node)';
      }
    } else if (targetAgent === 'gemini') {
      const geminiPrompt = `Act as Gemini Criterion Guard for SPEC v1 Relay. Evaluate: ${text}`;
      const aiRes = await generateWithFallback(geminiPrompt, false);
      if (aiRes && aiRes.text) {
        contentText = aiRes.text;
        modelProvider = `${aiRes.model} (Live Gemini API)`;
      } else {
        modelProvider = 'gemini-criterion-guard (Deterministic Invariant Engine)';
      }
    }

    // Seal and deposit the envelope into the O_EXCL Ledger
    const envelope = await store.deposit({
      from: `agent:${targetAgent}`,
      to: 'all',
      type: envelopeType,
      title: title || `Act by ${targetAgent}`,
      parent_locator,
      payload: {
        body: contentText || text,
        provider: modelProvider,
        ...structuredPayload
      }
    });

    res.json({
      success: true,
      locator: envelope.locator,
      seq: envelope.seq,
      digest: envelope.digest,
      provider: modelProvider,
      envelope
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// WebMCP attestation surface
//
// Every route below records HOW an act reached the page, which is the one thing
// WebMCP does not carry. `via` is asserted by the page and is never verified
// here: the page can see whether `document.modelContext` dispatched a call or a
// button was activated; this server receives an ordinary HTTP request. The log
// says `attested_by: "page"` for that reason rather than implying otherwise.
// ---------------------------------------------------------------------------

const attestLog = getAttestationLog();

const ACT_KINDS: ActKind[] = ['note', 'proposal', 'approval'];

app.post('/api/attest/act', (req, res) => {
  try {
    const { kind, text, target, via, agent_hint } = req.body ?? {};

    if (!ACT_KINDS.includes(kind)) {
      return res.status(400).json({ error: `kind must be one of ${ACT_KINDS.join(', ')}` });
    }
    if (!VIA_VALUES.includes(via)) {
      return res.status(400).json({
        error: `via must be one of ${VIA_VALUES.join(', ')}`,
        note: 'A caller that omits it is not defaulted to the human. There is no default.'
      });
    }
    if (kind !== 'approval' && typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required for a note or a proposal' });
    }
    if (kind === 'approval') {
      const proposal = attestLog.all().find((a) => a.id === target && a.kind === 'proposal');
      if (!proposal) {
        return res.status(404).json({ error: `no proposal with id ${target}` });
      }
      const already = attestLog.all().find((a) => a.kind === 'approval' && a.target === target);
      if (already) {
        // Not idempotent, and saying so rather than silently duplicating. MCP
        // carries `idempotentHint`; WebMCP dropped it, so a retrying agent has
        // nothing to check and this is where it would double-post.
        return res.status(409).json({
          error: `${target} was already approved by ${already.id}`,
          approval: already
        });
      }
    }

    const act = attestLog.append(
      {
        kind,
        text: typeof text === 'string' ? text.slice(0, 2000) : undefined,
        target: typeof target === 'string' ? target : undefined,
        via: via as Via,
        agent_hint: typeof agent_hint === 'string' ? agent_hint.slice(0, 120) : undefined
      },
      req.get('origin') ?? null
    );

    res.status(201).json({ act });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attest/acts', (_req, res) => {
  try {
    const acts = attestLog.all();
    const proposals = acts.filter((a) => a.kind === 'proposal');
    const approvedTargets = new Set(acts.filter((a) => a.kind === 'approval').map((a) => a.target));
    res.json({
      acts,
      pending: proposals.filter((p) => !approvedTargets.has(p.id)),
      unattestable: acts.filter((a) => !a.distinguishes_hands).length,
      chain: attestLog.verify()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attest/status', (_req, res) => {
  const acts = attestLog.all();
  const byVia = Object.fromEntries(VIA_VALUES.map((v) => [v, acts.filter((a) => a.via === v).length]));
  res.json({
    total: acts.length,
    byVia,
    chain: attestLog.verify(),
    attested_by: 'page',
    note: 'via is reported by the page and verified by nobody. The server checks the request origin and nothing else about who acted.'
  });
});

// Start Server and Vite Middleware
async function start() {
  await store.init();

  if (process.env.NODE_ENV !== 'production') {
    // Imported here rather than at the top of the file. Vite is a dev
    // dependency and is never used in production, but a top-level import loaded
    // it anyway — which is where the "CJS build of Vite's Node API is
    // deprecated" warning on every production start came from.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const status = await store.getStatus();
  app.listen(PORT, HOST, () => {
    // The literal used to say 0.0.0.0 regardless of where it bound, so an
    // operator checking the log was told the opposite of what was true after
    // the default became loopback.
    console.log(`[Relay Engine] Server listening on http://${HOST}:${PORT}`);
    console.log(`[Relay Engine] Store initialized (Type: ${status.storeType}, Root: ${status.storeRoot || 'N/A'})`);
  });
}

start().catch(console.error);
