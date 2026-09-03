import React, { useState, useEffect, useMemo, useRef } from 'react';
import Markdown from 'react-markdown';
import { 
  Terminal, Play, RefreshCw, Send, Trash2, CheckCircle2, 
  AlertTriangle, ShieldCheck, Sparkles, Server, MessageSquare, 
  ArrowRight, FileJson, FileText, Copy, Check, Eye, Lock, Scale, Zap, Info,
  Clock, GitCommit, GitBranch, ArrowUpRight, Share2, Layers
} from 'lucide-react';
import {
  publishMessage,
  evaluateCausalLink,
  canonicalJCS,
  computeJCSDigest,
  formatHLC,
  HybridLogicalClock,
  RelayMessage,
  RelayMessageType,
  HLC,
  CausalEvaluationResult
} from '../lib/relay';

interface RelayRecordItem {
  locator: string;
  status: 'PRESENT' | 'KNOWN_MISSING' | 'CORRUPTED';
  envelope?: {
    id: string;
    seq: number;
    locator: string;
    store_id: string;
    digest: string;
    type: RelayMessageType;
    title: string;
    from: string;
    to: string;
    timestamp: string;
    payload: Record<string, any>;
    parent_locator?: string;
    parents?: string[];
    hlc?: HLC;
    metadata?: Record<string, any>;
  };
  note?: string;
}

interface RelayStatus {
  status: string;
  storeType?: string;
  storeRoot: string;
  capabilities?: {
    write: boolean;
    delete: boolean;
    reset: boolean;
  };
  totalSequencesAllocated: number;
  presentRecordsCount: number;
  knownMissingCount: number;
  inboxes: {
    claude: number;
    chatgpt: number;
    gemini: number;
    court: number;
  };
  geminiAvailable: boolean;
  model: string;
  specVersion: string;
}

export const LiveRelayConsole: React.FC = () => {
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [records, setRecords] = useState<RelayRecordItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<RelayRecordItem | null>(null);
  const [comparisonTarget, setComparisonTarget] = useState<RelayRecordItem | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[*] Initializing Relay Live Bus connection (SPEC v0.12)...',
    '[*] Hybrid Logical Clock (HLC) & JCS RFC 8785 engine initialized.',
    '[*] Just Scales (Prov 11:1) and O_EXCL Monotonic Markers active.'
  ]);

  // Composer Form
  const [author, setAuthor] = useState<string>('agent:claude-code-cli');
  const [targetAgent, setTargetAgent] = useState<string>('all');
  const [envelopeType, setEnvelopeType] = useState<RelayMessageType>('claim');
  const [claimTitle, setClaimTitle] = useState<string>('Оптимизация параллельных запросов');
  const [claimText, setClaimText] = useState<string>(
    'Предложение: Использовать atomic O_EXCL маркеры для предотвращения race condition при записи логов.'
  );
  const [selectedParents, setSelectedParents] = useState<string[]>([]);
  const [transportTarget, setTransportTarget] = useState<'ledger' | 'inbox'>('ledger');
  const [inboxTarget, setInboxTarget] = useState<'claude' | 'chatgpt' | 'gemini' | 'court'>('gemini');

  const [autoAdjudicate, setAutoAdjudicate] = useState<boolean>(true);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [isAdjudicating, setIsAdjudicating] = useState<boolean>(false);
  const [isTriadRunning, setIsTriadRunning] = useState<boolean>(false);

  // Live JCS & Digest State
  const [liveDigest, setLiveDigest] = useState<string>('');
  const [liveJCSString, setLiveJCSString] = useState<string>('');

  // Active Tab inside Console
  const [activeSubView, setActiveSubView] = useState<'ledger' | 'compose' | 'inboxes' | 'causality'>('ledger');
  const [inspectorViewMode, setInspectorViewMode] = useState<'formatted' | 'json'>('formatted');

  // Live SSE Connection State
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [sseClientId, setSseClientId] = useState<string | null>(null);
  const [sseEventCount, setSseEventCount] = useState<number>(0);

  // Hybrid Logical Clock state per agent
  const clockRef = useRef<HybridLogicalClock>(new HybridLogicalClock(author));
  const [currentHLC, setCurrentHLC] = useState<HLC>(clockRef.current.value);

  // Sync clock node ID when author changes
  useEffect(() => {
    clockRef.current = new HybridLogicalClock(author, currentHLC.wall_time, currentHLC.logical);
    setCurrentHLC(clockRef.current.value);
  }, [author]);

  // Manual HLC Tick
  const handleManualTick = () => {
    const ticked = clockRef.current.tickLocal();
    setCurrentHLC(ticked);
    addLog(`[HLC TICK] Часы узла ${author} продвинуты: ${formatHLC(ticked)}`);
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Recompute Live JCS Digest whenever claim content changes
  useEffect(() => {
    let isCancelled = false;
    const computeCurrentDigest = async () => {
      const payload = {
        proposal: claimText,
        author: author,
        title: claimTitle,
        type: envelopeType,
        invariants_claimed: ['MUST 1: O_EXCL', 'MUST 3: Just Scales (Prov 11:1)', 'MUST 8: Atomic Rename']
      };
      const jcs = canonicalJCS(payload);
      const digest = await computeJCSDigest(payload);
      if (!isCancelled) {
        setLiveJCSString(jcs);
        setLiveDigest(digest);
      }
    };
    computeCurrentDigest();
    return () => {
      isCancelled = true;
    };
  }, [claimText, author, claimTitle, envelopeType]);

  const fetchRelayState = async () => {
    setLoading(true);
    try {
      const [statusRes, recordsRes] = await Promise.all([
        fetch('/api/relay/status'),
        fetch('/api/relay/records')
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setRecords(recordsData.records || []);
      }
    } catch (err: any) {
      addLog(`[ERROR] Не удалось связаться с сервером релея: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelayState();

    // Establish real-time SSE event stream connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/relay/events?agent=ui-console');

      eventSource.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setSseConnected(true);
          setSseClientId(data.clientId);
          addLog(`[SSE STREAM] Соединение установлено (${data.clientId}). Живой приём событий активен.`);
        } catch (err) {}
      });

      eventSource.addEventListener('deposit', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setSseEventCount((c) => c + 1);
          addLog(`[SSE DEPOSIT] Новый Акт ${data.locator} (seq=${data.seq}) от ${data.from}: ${data.title}`);
          fetchRelayState();
        } catch (err) {}
      });

      eventSource.addEventListener('inbox_message', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setSseEventCount((c) => c + 1);
          addLog(`[SSE INBOX] Сообщение в инбокс [${data.targetAgent}]: ${data.msgId}`);
          fetchRelayState();
        } catch (err) {}
      });

      eventSource.addEventListener('known_missing', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setSseEventCount((c) => c + 1);
          addLog(`[SSE MUST 6] Запись ${data.locator} удалена, маркер сохранён как KNOWN_MISSING`);
          fetchRelayState();
        } catch (err) {}
      });

      eventSource.addEventListener('store_reset', () => {
        setSseEventCount((c) => c + 1);
        addLog(`[SSE RESET] Леджер сброшен к исходному состоянию.`);
        fetchRelayState();
      });

      eventSource.addEventListener('agent_presence', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          addLog(`[SSE PEER] ${data.agent} (${data.action}) — активных подключений: ${data.totalClients}`);
        } catch (err) {}
      });

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch (err) {
      console.error('SSE initialization error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Convert records into known relay message objects for causal link evaluation
  const messageGraph = useMemo(() => {
    const map = new Map<string, RelayMessage>();
    records.forEach((rec) => {
      if (rec.envelope && rec.status === 'PRESENT') {
        const env = rec.envelope;
        map.set(rec.locator, {
          id: rec.locator,
          spec_version: 'v0.12',
          type: env.type || 'claim',
          from: env.from || 'agent:unknown',
          to: env.to || 'all',
          hlc: env.hlc || {
            wall_time: env.timestamp ? new Date(env.timestamp).getTime() : Date.now(),
            logical: env.seq || 0,
            node_id: env.from || 'agent:node'
          },
          parents: env.parents || (env.parent_locator ? [env.parent_locator] : []),
          payload: env.payload || {},
          digest: env.digest || '',
          timestamp: env.timestamp || new Date().toISOString()
        });
      }
    });
    return map;
  }, [records]);

  // Live Causal Evaluation of Composed Act vs Selected Parents
  const liveCausalEvaluations = useMemo(() => {
    if (selectedParents.length === 0) return [];
    
    // Construct hypothetical draft message
    const draftMsg: RelayMessage = {
      id: 'draft:active-composition',
      spec_version: 'v0.12',
      type: envelopeType,
      from: author,
      to: targetAgent,
      hlc: currentHLC,
      parents: selectedParents,
      payload: { proposal: claimText },
      digest: liveDigest,
      timestamp: new Date(currentHLC.wall_time).toISOString()
    };

    return selectedParents.map((parentId) => {
      const parentMsg = messageGraph.get(parentId);
      if (!parentMsg) {
        return {
          parentId,
          result: {
            relationship: 'CAUSAL_VIOLATION' as const,
            hlcComparison: 1,
            directDependency: true,
            explanation: `Родительский локатор ${parentId} не найден в локальном графе или помечен как KNOWN_MISSING.`,
            biblicalPrinciple: 'Притчи 11:1 — Неизвестное основание.',
            isValidCausality: false
          }
        };
      }
      const evalResult = evaluateCausalLink(parentMsg, draftMsg, messageGraph);
      return {
        parentId,
        result: evalResult
      };
    });
  }, [selectedParents, messageGraph, envelopeType, author, targetAgent, currentHLC, claimText, liveDigest]);

  // Causal Evaluation between selected record and comparison target in ledger
  const activePairCausalResult = useMemo<CausalEvaluationResult | null>(() => {
    if (!selectedRecord?.envelope || !comparisonTarget?.envelope) return null;
    const msgA = messageGraph.get(selectedRecord.locator);
    const msgB = messageGraph.get(comparisonTarget.locator);
    if (!msgA || !msgB) return null;
    return evaluateCausalLink(msgA, msgB, messageGraph);
  }, [selectedRecord, comparisonTarget, messageGraph]);

  /**
   * Publish Act via relay.ts library and Server Transport
   */
  const handlePublishAct = async () => {
    if (!claimText.trim()) return;
    setIsPosting(true);
    addLog(`[ACT] Композиция и печать Акта (${envelopeType}) от ${author}...`);

    try {
      const payloadData = {
        proposal: claimText,
        author: author,
        title: claimTitle,
        type: envelopeType,
        invariants_claimed: ['MUST 1: O_EXCL', 'MUST 3: Just Scales (Prov 11:1)', 'MUST 8: Atomic Rename']
      };

      // 1. Seal Envelope using relay.ts publishMessage
      const sealedEnvelope = await publishMessage({
        type: envelopeType,
        from: author,
        to: targetAgent,
        payload: payloadData,
        parents: selectedParents,
        clock: clockRef.current,
        metadata: {
          title: claimTitle,
          spec: 'v0.12',
          jurisprudence: 'Prov 11:1 / Prov 18:17 / Prov 18:18'
        }
      });

      // Update UI Clock to reflect ticked value
      setCurrentHLC(sealedEnvelope.hlc);
      addLog(`[HLC STAMP] Акт запечатан HLC: ${formatHLC(sealedEnvelope.hlc)} | Digest: ${sealedEnvelope.digest.slice(0, 20)}...`);

      // 2. Dispatch via chosen Transport Interface
      if (transportTarget === 'ledger') {
        const res = await fetch('/api/relay/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: sealedEnvelope.from,
            to: sealedEnvelope.to,
            type: sealedEnvelope.type,
            title: claimTitle,
            payload: sealedEnvelope.payload,
            parent_locator: selectedParents[0] || undefined,
            metadata: {
              ...sealedEnvelope.metadata,
              hlc: sealedEnvelope.hlc,
              parents: sealedEnvelope.parents,
              act_id: sealedEnvelope.id
            }
          })
        });

        const data = await res.json();
        if (res.ok) {
          addLog(`[COMMIT] Акт зафиксирован в O_EXCL леджере: ${data.locator} (seq=${data.seq})`);
          addLog(`[JUST SCALES] Дайджест подтверждён: ${data.digest}`);
          await fetchRelayState();

          if (autoAdjudicate) {
            await triggerAdjudication(claimText, data.locator, author);
          }
        } else {
          addLog(`[ERROR] Ошибка фиксации в леджере: ${data.error}`);
        }
      } else {
        // Send directly to agent inbox queue
        const res = await fetch('/api/relay/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetAgent: inboxTarget,
            from: sealedEnvelope.from,
            type: sealedEnvelope.type,
            title: claimTitle,
            payload: {
              ...sealedEnvelope.payload,
              envelope: sealedEnvelope
            }
          })
        });

        const data = await res.json();
        if (res.ok) {
          addLog(`[INBOX DISPATCH] Акт отправлен в очередь inbox/${inboxTarget} (ID=${data.msgId})`);
          await fetchRelayState();
        } else {
          addLog(`[ERROR] Ошибка отправки в инбокс: ${data.error}`);
        }
      }
    } catch (err: any) {
      addLog(`[ERROR] Сбой публикации: ${err.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  const triggerAdjudication = async (text: string, parentLocator?: string, claimAuthor?: string) => {
    setIsAdjudicating(true);
    addLog(`[GUARD] Анализ инвариантов SPEC v1 и библейской юриспруденции: "${text.slice(0, 40)}..."`);

    try {
      const res = await fetch('/api/relay/adjudicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: text,
          parent_locator: parentLocator,
          author: claimAuthor || author
        })
      });

      let data: any = null;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const rawText = await res.text().catch(() => '');
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { error: 'Неверный ответ сервера (non-JSON)' };
        }
      }

      if (res.ok && data && !data.error) {
        const engineLabel = data.modelUsed?.includes('fallback') 
          ? 'SPEC Invariant Engine (Zero-Latency Rule Guard)' 
          : (data.modelUsed || 'Gemini 3.7 Flash');
        addLog(`[VERDICT] Вердикт: ${data.verdict} [${engineLabel}] | Локатор: ${data.locator}`);
        addLog(`[PRINCIPLE] ${data.biblicalPrinciple || 'Prov 18:17'}: ${data.reasoning.slice(0, 90)}...`);
        if (data.counterCase) {
          addLog(`[COUNTER-CASE] Контр-пример: ${data.counterCase.slice(0, 85)}...`);
        }
        await fetchRelayState();
      } else {
        addLog(`[ERROR] Сбой судилища: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] Сбой связи с судилищем: ${err.message}`);
    } finally {
      setIsAdjudicating(false);
    }
  };

  const runTriadSimulation = async () => {
    setIsTriadRunning(true);
    addLog(`[TRIAD] Запуск полного консенсусного цикла триады (Claude ↔ ChatGPT ↔ Gemini)...`);

    try {
      const res = await fetch('/api/relay/step-triad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalTitle: claimTitle || 'Консенсусное предложение',
          proposalText: claimText || 'Предложение: внедрить проверку инвариантов SPEC v1'
        })
      });

      const data = await res.json();
      if (res.ok) {
        data.steps.forEach((step: any) => {
          addLog(`[TRIAD] Шаг ${step.phase.toUpperCase()} (${step.agent}): Зафиксирован ${step.locator}`);
        });
        await fetchRelayState();
      } else {
        addLog(`[ERROR] Ошибка в цикле триады: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] Сбой триады: ${err.message}`);
    } finally {
      setIsTriadRunning(false);
    }
  };

  const deleteRecordPayload = async (locator: string) => {
    if (status?.capabilities && !status.capabilities.delete) {
      addLog(`[CAPABILITY REFUSED] Удаление невозможно: текущее хранилище (${status.storeType || 'custom'}) объявлено как неизменяемое (capabilities.delete: false).`);
      return;
    }
    addLog(`[SPEC MUST 6] Тестирование удаления payload для ${locator}...`);
    try {
      const res = await fetch(`/api/relay/records/${locator}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addLog(`[SPEC MUST 6] ${data.message}`);
        await fetchRelayState();
      } else {
        addLog(`[ERROR] ${data.error}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] ${err.message}`);
    }
  };

  const verifyRecordDigest = async (locator: string) => {
    addLog(`[VERIFY] Проверка Just Scales для ${locator}...`);
    try {
      const res = await fetch(`/api/relay/verify/${locator}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const schemeInfo = data.digestScheme 
          ? ` [Схема: ${data.digestScheme}${data.schemeDescription ? ` · ${data.schemeDescription}` : ''}]` 
          : '';
        if (data.valid) {
          addLog(`[VERIFY OK] ${locator} валиден!${schemeInfo} Дайджест: ${data.headerDigest}`);
        } else {
          addLog(`[VERIFY FAILED] НЕСОВПАДЕНИЕ ДАЙДЖЕСТА в ${locator}!${schemeInfo} Header: ${data.headerDigest} vs Calc: ${data.computedDigest}`);
        }
      } else {
        addLog(`[ERROR] ${data.error}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] ${err.message}`);
    }
  };

  const resetStore = async () => {
    if (status?.capabilities && !status.capabilities.reset) {
      addLog(`[CAPABILITY REFUSED] Сброс невозможен: хранилище (${status.storeType || 'custom'}) запрещает reset (capabilities.reset: false).`);
      return;
    }
    if (!confirm('Сбросить состояние хранилища релея к начальным эталонным записям?')) return;
    addLog('[RESET] Очистка и сброс хранилища...');
    try {
      const res = await fetch('/api/relay/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        addLog('[RESET OK] Хранилище сброшено и инициализировано.');
        await fetchRelayState();
      } else {
        addLog(`[ERROR] ${data.error || 'Сброс не удался'}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Active Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Server className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Активный Релей и Судилище (Live Relay Hub)
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>SPEC v0.12 · HLC Active</span>
                </span>
                {status?.capabilities && (
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full border ${
                    status.capabilities.write 
                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' 
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}>
                    {status.capabilities.write ? 'Store: RW' : 'Store: Immutable (RO)'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Интеграция <code className="text-indigo-300 font-mono">relay.ts</code>: штампование HLC, канонизация <code className="text-indigo-300">JCS RFC 8785</code>, проверка причинности и транспортная шина.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={runTriadSimulation}
              disabled={isTriadRunning || status?.capabilities?.write === false}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              title={status?.capabilities?.write === false ? 'Запись отключена для данного стора' : 'Запустить Триаду'}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isTriadRunning ? 'Выполняется...' : 'Запустить Триаду'}</span>
            </button>

            <button
              onClick={fetchRelayState}
              disabled={loading}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Обновить состояние"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Обновить</span>
            </button>

            <button
              onClick={resetStore}
              disabled={status?.capabilities?.reset === false}
              className={`flex items-center space-x-1 px-2.5 py-2 rounded-lg text-xs font-medium border transition ${
                status?.capabilities?.reset === false
                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-40'
                  : 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border-red-800/40'
              }`}
              title={status?.capabilities?.reset === false ? 'Сброс заблокирован (Хранилище неизменяемо)' : 'Сбросить релей к эталону'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Metrics & HLC Clock Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Текущий HLC Узла</span>
              <button
                onClick={handleManualTick}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono"
                title="Продвинуть логический счётчик часов"
              >
                +Tick
              </button>
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold font-mono text-indigo-300 truncate" title={formatHLC(currentHLC)}>
                {currentHLC.wall_time}.<span className="text-emerald-400">{currentHLC.logical}</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-medium">Аллоцировано слотов</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-indigo-400">
                {status?.totalSequencesAllocated ?? '...'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">O_EXCL</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-medium">Записей (PRESENT)</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-400">
                {status?.presentRecordsCount ?? '...'}
              </span>
              <span className="text-[10px] text-emerald-500/80 font-mono">в леджере</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-medium">SSE Live Stream</span>
            <div className="flex items-center space-x-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-xs font-mono text-slate-200 truncate">
                {sseConnected ? `Active (${sseEventCount} ev)` : 'Reconnecting...'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-medium">Судья Gemini</span>
            <div className="flex items-center space-x-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-xs font-semibold text-slate-200 truncate">
                {status?.geminiAvailable ? '3.8 Flash' : 'Deterministic'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Composer & Control (Left) + Ledger / Inboxes / Graph (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Act Composer with Live HLC & JCS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <GitCommit className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200">Составить Акт (Act Composer)</h3>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/20">
                SPEC v0.12
              </span>
            </div>

            {/* Author (From) & HLC Stamping Badge */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-400">Агент-Инициатор (From / Node ID):</label>
                <span className="text-[10px] font-mono text-emerald-400">
                  HLC: {currentHLC.logical} counter
                </span>
              </div>
              <select
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="agent:claude-code-cli">🟣 Claude Code (CLI / Proposer)</option>
                <option value="agent:chatgpt-adversary">🟢 ChatGPT (Web / Adversary)</option>
                <option value="agent:gemini-criterion-guard">🔵 Gemini 3.8 (Criterion Guard)</option>
                <option value="agent:human-architect">👤 Human Architect (User UI)</option>
              </select>
            </div>

            {/* Recipient & Envelope Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Получатель (To):</label>
                <select
                  value={targetAgent}
                  onChange={(e) => setTargetAgent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Все агенты (Public Bus)</option>
                  <option value="gemini">Gemini Criterion Guard</option>
                  <option value="claude">Claude Code CLI</option>
                  <option value="chatgpt">ChatGPT Adversary</option>
                  <option value="court">Судилище (Adjudication Court)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Тип Акта (Type):</label>
                <select
                  value={envelopeType}
                  onChange={(e) => setEnvelopeType(e.target.value as RelayMessageType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="claim">claim (Гипотеза/Код)</option>
                  <option value="challenge">challenge (Возражение)</option>
                  <option value="finding">finding (Экспертиза)</option>
                  <option value="ruling">ruling (Постановление)</option>
                  <option value="attestation">attestation (Аттестация)</option>
                  <option value="arbitration">arbitration (Жребий/VRF)</option>
                  <option value="message">message (Сообщение)</option>
                </select>
              </div>
            </div>

            {/* Causal Parents Selector */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Причинные Родители (Causal Parents / Dependencies):
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1">
                {records.filter(r => r.status === 'PRESENT').length === 0 ? (
                  <span className="text-[11px] text-slate-500">Нет доступных записей для привязки (будет корневым актом)</span>
                ) : (
                  records.filter(r => r.status === 'PRESENT').map(r => {
                    const isSelected = selectedParents.includes(r.locator);
                    return (
                      <label
                        key={r.locator}
                        className={`flex items-center space-x-2 text-xs p-1 rounded cursor-pointer transition ${
                          isSelected ? 'bg-indigo-950/50 text-indigo-200' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParents(prev => [...prev, r.locator]);
                            } else {
                              setSelectedParents(prev => prev.filter(id => id !== r.locator));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-indigo-600 bg-slate-900 border-slate-700"
                        />
                        <span className="font-mono font-bold text-[11px] text-indigo-400">{r.locator}</span>
                        <span className="text-[10px] text-slate-400 truncate">({r.envelope?.title || r.envelope?.type})</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Заголовок Акта:</label>
              <input
                type="text"
                value={claimTitle}
                onChange={(e) => setClaimTitle(e.target.value)}
                placeholder="Например: Предложение по инвариантам кэша"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Payload Content */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-400">Содержание полезной нагрузки (Payload):</label>
                <div className="flex space-x-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setClaimTitle('Предложение: TTL кэширование записей');
                      setClaimText('Мы предлагаем хранить результаты вызовов в кэше с TTL 60с для снижения нагрузки на диск.');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Пример 1
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setClaimTitle('Возражение: Нарушение MUST 6');
                      setClaimText('Удаление файлов маркерной истории в history/ приводит к сбою воркеров и потере монотонности.');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Пример 2
                  </button>
                </div>
              </div>
              <textarea
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Опишите утверждение, код, возражение или резолюцию..."
              />
            </div>

            {/* Live JCS & Just Scales Digest Preview */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center space-x-1">
                  <Scale className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold text-slate-300">Live JCS RFC 8785 Digest (Prov 11:1)</span>
                </span>
                <span className="font-mono text-[10px] text-emerald-400 truncate max-w-[170px]">
                  {liveDigest || 'Вычисление...'}
                </span>
              </div>
              <div className="font-mono text-[10px] text-slate-500 bg-slate-900/80 p-1.5 rounded border border-slate-800 truncate">
                {liveJCSString}
              </div>
            </div>

            {/* Live Causal Evaluation Badge (if parents selected) */}
            {liveCausalEvaluations.length > 0 && (
              <div className="bg-slate-950/90 p-2.5 rounded-lg border border-indigo-500/30 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-300">
                  <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Анализ причинности (evaluateCausalLink):</span>
                </div>
                {liveCausalEvaluations.map(({ parentId, result }) => (
                  <div key={parentId} className="text-[11px] space-y-0.5 border-t border-slate-800/60 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-300">{parentId} ➔ Draft:</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        result.relationship === 'CAUSALLY_PRECEDES' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        result.relationship === 'CONCURRENT' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                        'bg-red-950 text-red-300 border border-red-800'
                      }`}>
                        {result.relationship}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {result.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Transport Destination Selector */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <label className="text-[11px] font-medium text-slate-400 block">
                Транспортный интерфейс публикации:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransportTarget('ledger')}
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 border transition ${
                    transportTarget === 'ledger'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Леджер (O_EXCL Bus)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransportTarget('inbox')}
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 border transition ${
                    transportTarget === 'inbox'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Инбокс Очередь</span>
                </button>
              </div>

              {transportTarget === 'inbox' && (
                <div className="pt-1">
                  <label className="text-[10px] text-slate-400 block mb-1">Целевой инбокс агента:</label>
                  <select
                    value={inboxTarget}
                    onChange={(e) => setInboxTarget(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="gemini">inbox/gemini (Criterion Guard)</option>
                    <option value="claude">inbox/claude (Claude CLI)</option>
                    <option value="chatgpt">inbox/chatgpt (ChatGPT Adversary)</option>
                    <option value="court">inbox/court (Adjudication Court)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Auto-Adjudicate Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Авто-Судилище Gemini AI</span>
                  <span className="text-[10px] text-slate-400">Проверить по Prov 18:17 и SPEC v1 сразу после записи</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoAdjudicate}
                onChange={(e) => setAutoAdjudicate(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handlePublishAct}
                disabled={isPosting || !claimText.trim() || status?.capabilities?.write === false}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-white text-xs font-bold transition shadow-sm ${
                  status?.capabilities?.write === false
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'
                }`}
                title={status?.capabilities?.write === false ? 'Запись заблокирована: хранилище в режиме Read-Only' : undefined}
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {status?.capabilities?.write === false
                    ? 'Хранилище Read-Only'
                    : isPosting
                    ? 'Запечатывание & Публикация...'
                    : 'Опубликовать Акт (Publish Act)'}
                </span>
              </button>

              <button
                onClick={() => triggerAdjudication(claimText, selectedParents[0], author)}
                disabled={isAdjudicating || !claimText.trim()}
                className="flex items-center space-x-1.5 py-2.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-medium transition disabled:opacity-50"
                title="Судить гипотезу с помощью Gemini прямо сейчас"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{isAdjudicating ? 'Судейство...' : 'Судить AI'}</span>
              </button>
            </div>
          </div>

          {/* Live POSIX & Transport Event Log Terminal */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">POSIX & Transport Log</span>
              </div>
              <button
                onClick={() => setTerminalLogs([])}
                className="text-[10px] text-slate-500 hover:text-slate-400"
              >
                Очистить
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 max-h-48 overflow-y-auto space-y-1">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="leading-tight break-all">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Ledger, Inboxes & Causal Graph (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Sub Navigation Bar */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-2">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveSubView('ledger')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeSubView === 'ledger'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Публичный Леджер ({records.length})
              </button>

              <button
                onClick={() => setActiveSubView('causality')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1 ${
                  activeSubView === 'causality'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Граф Причинности</span>
              </button>

              <button
                onClick={() => setActiveSubView('inboxes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
                  activeSubView === 'inboxes'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>Инбоксы Агентов</span>
                {status && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                    {status.inboxes.claude + status.inboxes.chatgpt + status.inboxes.gemini + status.inboxes.court}
                  </span>
                )}
              </button>
            </div>

            <span className="text-[11px] font-mono text-slate-400 pr-2">
              JCS RFC 8785 Verified
            </span>
          </div>

          {/* SubView 1: Ledger Table */}
          {activeSubView === 'ledger' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Монотонная Лента Записей (O_EXCL Sequence Log)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Каждая запись гарантирует целостность по SPEC MUST 1-8 и HLC монотонность.
                  </p>
                </div>
                <span className="text-xs font-mono text-indigo-400 bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-500/20">
                  store:local-hub-01
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
                {records.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Хранилище пусто. Опубликуйте первый Акт через форму слева.
                  </div>
                ) : (
                  records.map((rec) => {
                    const isPresent = rec.status === 'PRESENT';
                    const isMissing = rec.status === 'KNOWN_MISSING';
                    const env = rec.envelope;
                    const isSelected = selectedRecord?.locator === rec.locator;
                    const isComparing = comparisonTarget?.locator === rec.locator;

                    return (
                      <div
                        key={rec.locator}
                        className={`p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                            : isComparing
                            ? 'bg-purple-950/30 border-l-4 border-purple-500'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-mono text-xs font-bold text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {rec.locator}
                            </span>

                            {isPresent && env && (
                              <>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                  env.type === 'finding' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50' :
                                  env.type === 'ruling' ? 'bg-purple-950/40 text-purple-300 border-purple-800/50' :
                                  env.type === 'challenge' ? 'bg-amber-950/40 text-amber-300 border-amber-800/50' :
                                  env.type === 'attestation' ? 'bg-teal-950/40 text-teal-300 border-teal-800/50' :
                                  'bg-blue-950/40 text-blue-300 border-blue-800/50'
                                }`}>
                                  {env.type}
                                </span>
                                <span className="text-xs font-semibold text-slate-200">
                                  {env.title}
                                </span>
                              </>
                            )}

                            {isMissing && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>KNOWN_MISSING (SPEC MUST 6)</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                            {isPresent && env && (
                              <>
                                <span>От: <code className="text-slate-300">{env.from}</code></span>
                                <span>·</span>
                                {env.metadata?.hlc ? (
                                  <span className="font-mono text-[10px] text-indigo-300">
                                    HLC: {formatHLC(env.metadata.hlc)}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-[130px]">
                                    {env.digest}
                                  </span>
                                )}
                                {env.parent_locator && (
                                  <>
                                    <span>·</span>
                                    <span className="text-emerald-400 font-mono text-[10px]">
                                      parent: {env.parent_locator}
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                            {isMissing && (
                              <span className="text-slate-500">
                                Маркер аллокации сохранён в history/ · Payload удалён
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {isPresent && (
                            <>
                              <button
                                onClick={() => {
                                  if (selectedRecord?.locator === rec.locator) {
                                    setSelectedRecord(null);
                                  } else {
                                    setSelectedRecord(rec);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center space-x-1 ${
                                  isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                                title="Инспектор конверта"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{isSelected ? 'Выбран (A)' : 'Конверт'}</span>
                              </button>

                              <button
                                onClick={() => {
                                  if (comparisonTarget?.locator === rec.locator) {
                                    setComparisonTarget(null);
                                  } else {
                                    setComparisonTarget(rec);
                                  }
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium transition ${
                                  isComparing ? 'bg-purple-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-purple-300'
                                }`}
                                title="Выбрать для причинного сравнения (B)"
                              >
                                <span>{isComparing ? 'Цель (B)' : 'Сравнить'}</span>
                              </button>

                              <button
                                onClick={() => verifyRecordDigest(rec.locator)}
                                className="p-1.5 rounded bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/40 text-xs transition"
                                title="Пересчитать канонический SHA-256 (Just Scales)"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => deleteRecordPayload(rec.locator)}
                                disabled={status?.capabilities?.delete === false}
                                className={`p-1.5 rounded text-xs transition border ${
                                  status?.capabilities?.delete === false
                                    ? 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed opacity-30'
                                    : 'bg-red-950/40 hover:bg-red-900/50 text-red-400 border-red-800/40'
                                }`}
                                title={status?.capabilities?.delete === false ? 'Удаление заблокировано (Хранилище неизменяемо)' : 'Удалить payload (Тест SPEC MUST 6: KNOWN_MISSING)'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {isMissing && (
                            <span className="text-[10px] text-slate-500 font-mono italic">
                              Marker Locked
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SubView 2: Causal Graph & Relation Matrix */}
          {activeSubView === 'causality' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Аудит Причинно-Следственных Связей (evaluateCausalLink)
                  </h3>
                </div>
                <span className="text-xs font-mono text-emerald-400">Lamport & HLC Strict</span>
              </div>

              <p className="text-xs text-slate-400">
                Выберите любые два акта из леджера для выполнения кросс-экзаменации (Prov 18:17) и проверки порядка Лампорта.
              </p>

              {/* Comparison Tool Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Сообщение A:</span>
                  <select
                    value={selectedRecord?.locator || ''}
                    onChange={(e) => {
                      const rec = records.find(r => r.locator === e.target.value) || null;
                      setSelectedRecord(rec);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">-- Выберите Акт A --</option>
                    {records.filter(r => r.status === 'PRESENT').map(r => (
                      <option key={r.locator} value={r.locator}>
                        {r.locator} ({r.envelope?.from}) - {r.envelope?.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Сообщение B:</span>
                  <select
                    value={comparisonTarget?.locator || ''}
                    onChange={(e) => {
                      const rec = records.find(r => r.locator === e.target.value) || null;
                      setComparisonTarget(rec);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">-- Выберите Акт B --</option>
                    {records.filter(r => r.status === 'PRESENT').map(r => (
                      <option key={r.locator} value={r.locator}>
                        {r.locator} ({r.envelope?.from}) - {r.envelope?.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Evaluation Result Card */}
              {activePairCausalResult ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Результат связи: <code className="text-indigo-300 font-mono">{selectedRecord?.locator}</code> vs <code className="text-purple-300 font-mono">{comparisonTarget?.locator}</code>
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      activePairCausalResult.relationship === 'CAUSALLY_PRECEDES' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      activePairCausalResult.relationship === 'CAUSALLY_SUCCEEDS' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                      activePairCausalResult.relationship === 'CONCURRENT' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-red-950 text-red-300 border border-red-800'
                    }`}>
                      {activePairCausalResult.relationship}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <p className="leading-relaxed">
                      {activePairCausalResult.explanation}
                    </p>
                    {activePairCausalResult.biblicalPrinciple && (
                      <div className="flex items-center space-x-1.5 text-indigo-400 font-medium pt-1">
                        <Scale className="w-3.5 h-3.5" />
                        <span>{activePairCausalResult.biblicalPrinciple}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-6 text-center text-slate-500 text-xs rounded-xl border border-slate-800">
                  Выберите оба сообщения (A и B) выше, чтобы запустить процедуру `evaluateCausalLink`.
                </div>
              )}
            </div>
          )}

          {/* SubView 3: Inboxes View */}
          {activeSubView === 'inboxes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Claude Inbox Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    <h4 className="text-xs font-bold text-slate-200">Claude Code CLI Inbox</h4>
                  </div>
                  <span className="text-[10px] font-mono bg-purple-950/50 text-purple-300 px-2 py-0.5 rounded border border-purple-800/30">
                    inbox/claude ({status?.inboxes.claude ?? 0})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Сюда приходят встречные возражения от ChatGPT и постановления суда для адаптации кода.
                </p>
              </div>

              {/* ChatGPT Inbox Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-200">ChatGPT Adversary Inbox</h4>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950/50 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/30">
                    inbox/chatgpt ({status?.inboxes.chatgpt ?? 0})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Очередь для кросс-экзаменации (Prov 18:17) и генерации враждебных контр-примеров.
                </p>
              </div>

              {/* Gemini Criterion Guard Inbox Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                    <h4 className="text-xs font-bold text-slate-200">Gemini Criterion Guard Inbox</h4>
                  </div>
                  <span className="text-[10px] font-mono bg-indigo-950/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/30">
                    inbox/gemini ({status?.inboxes.gemini ?? 0})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Очередь входящих гипотез для автоматического взвешивания на Канонических Весах (Prov 11:1).
                </p>
              </div>

              {/* Court Public Ledger */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <h4 className="text-xs font-bold text-slate-200">Court Invariant Log</h4>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-950/50 text-amber-300 px-2 py-0.5 rounded border border-amber-800/30">
                    inbox/court ({status?.inboxes.court ?? 0})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Финальные резолюции, жеребьёвки VRF Lot (Prov 18:18) и аудит консенсуса.
                </p>
              </div>
            </div>
          )}

          {/* Record Inspector Drawer / Modal */}
          {selectedRecord && selectedRecord.envelope && (
            <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <FileJson className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-100">
                    Инспектор Конверта: {selectedRecord.locator}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  ✕ Закрыть
                </button>
              </div>

              {/* 3-Tuple Citation */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">
                  3-Tuple Citation: <code className="text-indigo-300 font-bold">({selectedRecord.envelope.store_id || 'store:local-hub-01'}, {selectedRecord.locator}, {selectedRecord.envelope.digest.slice(0, 16)}...)</code>
                </span>
                <button
                  onClick={() => copyToClipboard(
                    `(${selectedRecord.envelope?.store_id || 'store:local-hub-01'}, ${selectedRecord.locator}, ${selectedRecord.envelope?.digest})`,
                    '3tuple'
                  )}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  {copiedText === '3tuple' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText === '3tuple' ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>

              {/* Tab Selector: Formatted Payload vs Raw JSON */}
              <div className="flex items-center space-x-1 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setInspectorViewMode('formatted')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                    inspectorViewMode === 'formatted'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Содержимое (Payload)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorViewMode('json')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                    inspectorViewMode === 'json'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Сырой Конверт (JSON)</span>
                </button>
              </div>

              {/* View Content */}
              {inspectorViewMode === 'formatted' ? (
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 max-h-80 overflow-y-auto space-y-3">
                  {/* If payload has string text (e.g. p-e store records) */}
                  {typeof selectedRecord.envelope.payload?.text === 'string' ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 block">
                        Текст документа (Prose / Markdown):
                      </span>
                      <div className="text-xs text-slate-200 leading-relaxed font-sans break-words bg-slate-900/50 p-3 rounded border border-slate-800/60">
                        <Markdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-slate-300 whitespace-pre-wrap">{children}</p>,
                            h1: ({ children }) => <h1 className="text-sm font-bold text-slate-100 mt-3 mb-1 border-b border-slate-800 pb-1">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xs font-bold text-slate-100 mt-2 mb-1">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-200 mt-1.5 mb-1">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-300">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-slate-300">{children}</ol>,
                            blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-500/60 pl-3 my-2 text-slate-400 italic bg-slate-950/60 py-1 rounded-r">{children}</blockquote>,
                            code: ({ inline, children, ...props }: any) => inline ? (
                              <code className="bg-slate-950 px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-300 border border-slate-800" {...props}>
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto my-2">
                                <code>{children}</code>
                              </pre>
                            ),
                          }}
                        >
                          {selectedRecord.envelope.payload.text}
                        </Markdown>
                      </div>
                    </div>
                  ) : typeof selectedRecord.envelope.payload?.body === 'string' || typeof selectedRecord.envelope.payload?.proposal === 'string' || typeof selectedRecord.envelope.payload?.claim === 'string' ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 block">
                        Утверждение / Тезис:
                      </span>
                      <div className="text-xs text-slate-200 leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800/60 whitespace-pre-wrap font-sans">
                        {selectedRecord.envelope.payload.body || selectedRecord.envelope.payload.proposal || selectedRecord.envelope.payload.claim}
                      </div>
                    </div>
                  ) : (
                    <div className="font-mono text-[11px] text-emerald-300">
                      <pre>{JSON.stringify(selectedRecord.envelope.payload, null, 2)}</pre>
                    </div>
                  )}

                  {/* Other metadata attributes if payload is an object */}
                  {selectedRecord.envelope.payload && typeof selectedRecord.envelope.payload === 'object' && Object.keys(selectedRecord.envelope.payload).some(k => !['text', 'body', 'proposal', 'claim'].includes(k)) && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                        Дополнительные атрибуты Payload:
                      </span>
                      <div className="font-mono text-[11px] text-emerald-300 bg-slate-900/50 p-2 rounded border border-slate-800/60 overflow-x-auto">
                        <pre>
                          {JSON.stringify(
                            Object.fromEntries(
                              Object.entries(selectedRecord.envelope.payload).filter(([k]) => !['text', 'body', 'proposal', 'claim'].includes(k))
                            ),
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 max-h-80 overflow-y-auto">
                  <pre>{JSON.stringify(selectedRecord.envelope, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
