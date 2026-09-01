import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, Sparkles, User, Scale, ShieldCheck, 
  Terminal, RefreshCw, Paperclip, ChevronDown, Check,
  Clock, Hash, ArrowDownRight, Layers, Play, Radio,
  MessageSquare, Zap, Cpu, AlertCircle, Copy, Gavel, HelpCircle
} from 'lucide-react';

interface ChatMessage {
  id: string;
  seq?: number;
  locator?: string;
  sender: 'human' | 'claude' | 'chatgpt' | 'gemini' | 'mistral' | 'court' | 'unknown';
  senderLabel: string;
  type: 'claim' | 'challenge' | 'finding' | 'ruling' | 'attestation' | 'system';
  title?: string;
  text: string;
  timestamp: string;
  hlc?: string;
  digest?: string;
  parentLocator?: string;
  status?: 'delivered' | 'pending' | 'adjudicated';
  rawPayload?: any;
}

const AGENT_CONFIGS: Record<string, {
  name: string;
  shortName: string;
  avatarBg: string;
  badgeBg: string;
  textColor: string;
  icon: any;
  roleDescription: string;
}> = {
  human: {
    name: 'Вы (Архитектор)',
    shortName: 'Архитектор',
    avatarBg: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40',
    badgeBg: 'bg-emerald-950/60 text-emerald-400 border-emerald-800',
    textColor: 'text-emerald-300',
    icon: User,
    roleDescription: 'Человек-архитектор и постановщик задач'
  },
  // A sender this UI does not recognise is rendered as itself. It used to fall
  // back to `human`, which showed records written by someone else as written by
  // the person reading them — 230 of 694 in the store this was first pointed at.
  // A default that names a specific author is a claim; this one is not.
  unknown: {
    name: 'Unknown sender',
    shortName: 'Unknown',
    avatarBg: 'bg-slate-600/20 text-slate-400 border-slate-500/40',
    badgeBg: 'bg-slate-950/60 text-slate-400 border-slate-800',
    textColor: 'text-slate-300',
    icon: HelpCircle,
    roleDescription: 'Отправитель, не описанный в этом интерфейсе'
  },
  claude: {
    name: 'Claude Code (Sonnet 3.5)',
    shortName: 'Claude',
    avatarBg: 'bg-amber-600/20 text-amber-400 border-amber-500/40',
    badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-800',
    textColor: 'text-amber-300',
    icon: Terminal,
    roleDescription: 'Инициатор, генератор распределенных схем и кода'
  },
  chatgpt: {
    name: 'ChatGPT (GPT-4o Adversary)',
    shortName: 'ChatGPT',
    avatarBg: 'bg-teal-600/20 text-teal-400 border-teal-500/40',
    badgeBg: 'bg-teal-950/60 text-teal-300 border-teal-800',
    textColor: 'text-teal-300',
    icon: Zap,
    roleDescription: 'Состязательный оппонент (Притчи 18:17, поиск race conditions)'
  },
  mistral: {
    name: 'Mistral (Codestral)',
    shortName: 'Mistral',
    avatarBg: 'bg-orange-600/20 text-orange-400 border-orange-500/40',
    badgeBg: 'bg-orange-950/60 text-orange-300 border-orange-800',
    textColor: 'text-orange-300',
    icon: Cpu,
    roleDescription: 'Инвариантный верификатор и стресс-тестировщик'
  },
  gemini: {
    name: 'Gemini (Criterion Guard)',
    shortName: 'Gemini',
    avatarBg: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40',
    badgeBg: 'bg-indigo-950/60 text-indigo-300 border-indigo-800',
    textColor: 'text-indigo-300',
    icon: Sparkles,
    roleDescription: 'Хранитель критериев, аудит SPEC MUST 1-8 и HLC'
  },
  court: {
    name: 'Суд Притчей 18:17 (Adjudication)',
    shortName: 'Суд',
    avatarBg: 'bg-purple-600/20 text-purple-400 border-purple-500/40',
    badgeBg: 'bg-purple-950/60 text-purple-300 border-purple-800',
    textColor: 'text-purple-300',
    icon: Scale,
    roleDescription: 'Судебное постановление и окончательный вердикт'
  }
};

export const AgentChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<'claude' | 'chatgpt' | 'gemini' | 'mistral' | 'all'>('all');
  const [selectedActType, setSelectedActType] = useState<'claim' | 'challenge' | 'finding' | 'ruling' | 'attestation'>('claim');
  const [parentLocator, setParentLocator] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeAdjudicatingId, setActiveAdjudicatingId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load existing records on mount and map to chat messages
  const loadInitialChatFromLedger = async () => {
    try {
      const res = await fetch('/api/relay/records');
      if (res.ok) {
        const data = await res.json();
        const initialMessages: ChatMessage[] = (data.records || [])
          .filter((rec: any) => rec.status === 'PRESENT' && rec.envelope)
          .map((rec: any) => {
            const env = rec.envelope;
            // Default `unknown`, not `human`: an unrecognised name is not
            // evidence that the reader wrote it.
            let sender: ChatMessage['sender'] = 'unknown';
            const from = env.from || '';
            if (from.includes('claude')) sender = 'claude';
            else if (from.includes('chatgpt')) sender = 'chatgpt';
            else if (from.includes('gemini')) sender = 'gemini';
            else if (from.includes('mistral')) sender = 'mistral';
            else if (from.includes('court')) sender = 'court';

            const payloadText = typeof env.payload === 'string' 
              ? env.payload 
              : env.payload?.body || env.payload?.proposal || env.payload?.claim || env.payload?.reasoning || JSON.stringify(env.payload, null, 2);

            return {
              id: env.locator || `msg-${Date.now()}-${Math.random()}`,
              seq: env.seq,
              locator: env.locator,
              sender,
              senderLabel: AGENT_CONFIGS[sender]?.name || from,
              type: env.type || 'claim',
              title: env.title,
              text: payloadText,
              timestamp: env.hlc ? new Date(parseInt(env.hlc.split(':')[0], 10)).toLocaleTimeString() : new Date().toLocaleTimeString(),
              hlc: env.hlc,
              digest: env.digest,
              parentLocator: env.parent_locator,
              status: 'delivered',
              rawPayload: env.payload
            };
          });

        setMessages(initialMessages);
      }
    } catch (e) {
      console.error('Failed to load ledger chat history:', e);
    }
  };

  useEffect(() => {
    loadInitialChatFromLedger();

    // Connect to SSE stream to receive live messages in real-time
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/relay/events?agent=chat-interface');

      eventSource.addEventListener('connected', () => {
        setSseConnected(true);
      });

      eventSource.addEventListener('deposit', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const env = data.envelope;
          if (!env) return;

          let sender: ChatMessage['sender'] = 'human';
          const from = env.from || '';
          if (from.includes('claude')) sender = 'claude';
          else if (from.includes('chatgpt')) sender = 'chatgpt';
          else if (from.includes('gemini')) sender = 'gemini';
          else if (from.includes('mistral')) sender = 'mistral';
          else if (from.includes('court')) sender = 'court';

          const payloadText = typeof env.payload === 'string'
            ? env.payload
            : env.payload?.body || env.payload?.proposal || env.payload?.claim || env.payload?.reasoning || JSON.stringify(env.payload, null, 2);

          const newMsg: ChatMessage = {
            id: env.locator || `msg-${Date.now()}`,
            seq: env.seq,
            locator: env.locator,
            sender,
            senderLabel: AGENT_CONFIGS[sender]?.name || from,
            type: env.type || 'claim',
            title: env.title,
            text: payloadText,
            timestamp: new Date().toLocaleTimeString(),
            hlc: env.hlc,
            digest: env.digest,
            parentLocator: env.parent_locator,
            status: 'delivered',
            rawPayload: env.payload
          };

          setMessages((prev) => {
            if (prev.some((m) => m.locator === env.locator)) return prev;
            return [...prev, newMsg];
          });
        } catch (err) {}
      });

      eventSource.onopen = () => setSseConnected(true);
      eventSource.onerror = () => setSseConnected(false);
    } catch (err) {
      console.error('SSE Chat connection error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Send message from Architect or invoke specific LLM Agent
  const handleSendMessage = async () => {
    if (!inputText.trim() || isSubmitting) return;

    const userText = inputText.trim();
    setInputText('');
    setIsSubmitting(true);

    try {
      if (selectedAgent === 'all' || selectedAgent === 'claude') {
        // Send as human act first
        const res = await fetch('/api/relay/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'agent:human-architect',
            to: selectedAgent === 'all' ? 'all' : `agent:${selectedAgent}`,
            type: selectedActType,
            title: userText.slice(0, 40) + (userText.length > 40 ? '...' : ''),
            parent_locator: parentLocator || undefined,
            payload: {
              body: userText,
              author_role: 'Human Architect'
            }
          })
        });
        const data = await res.json();

        // If user asked a specific agent or broadcasted, trigger autonomous agent response
        if (selectedAgent === 'claude') {
          await triggerAgentExecution('claude', 'claim', `Ответ Claude на: ${userText}`, data.locator);
        } else if (selectedAgent === 'chatgpt') {
          await triggerAgentExecution('chatgpt', 'challenge', `Кросс-экзаменация ChatGPT: ${userText}`, data.locator);
        } else if (selectedAgent === 'gemini') {
          await triggerAgentExecution('gemini', 'finding', `Аудит Gemini: ${userText}`, data.locator);
        }
      } else {
        // Trigger chosen agent directly
        await triggerAgentExecution(
          selectedAgent,
          selectedActType,
          userText,
          parentLocator || undefined
        );
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setIsSubmitting(false);
      setParentLocator('');
    }
  };

  const triggerAgentExecution = async (
    agent: 'claude' | 'chatgpt' | 'gemini' | 'mistral',
    type: string,
    text: string,
    parent?: string
  ) => {
    await fetch('/api/relay/agent-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        type,
        title: text.slice(0, 45),
        text,
        parent_locator: parent
      })
    });
  };

  // Launch a Triad on a specific message: Opponent (ChatGPT) challenges -> Verifier (Mistral) examines
  const handleLaunchTriadOnMessage = async (msg: ChatMessage) => {
    setIsSubmitting(true);
    setActiveAdjudicatingId(msg.id);
    try {
      // 1. ChatGPT Cross-Examination (Proverbs 18:17)
      await fetch('/api/relay/agent-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'chatgpt',
          type: 'challenge',
          title: `Оппонирование к [${msg.locator || 'Акту'}]: ${msg.title || 'Тезис'}`,
          text: `Состязательный аудит (Притчи 18:17) к тезису «${msg.text.slice(0, 100)}...»: Проверка граничных условий, консистентности RFC 8785 и гарантий POSIX O_EXCL.`,
          parent_locator: msg.locator
        })
      });

      // 2. Mistral Verification Finding
      await fetch('/api/relay/agent-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'mistral',
          type: 'finding',
          title: `Верификация инвариантов к [${msg.locator || 'Акту'}]`,
          text: `Анализ инвариантов: HLC монотонность валидирована, конфликт слотов отсутствует, causal order сохранен.`,
          parent_locator: msg.locator
        })
      });
    } catch (e) {
      console.error('Launch triad error:', e);
    } finally {
      setIsSubmitting(false);
      setActiveAdjudicatingId(null);
    }
  };

  // Launch Full Court Adjudication on a specific message: Court Judge (Gemini) evaluates criteria & issues Ruling
  const handleLaunchCourtOnMessage = async (msg: ChatMessage) => {
    setIsSubmitting(true);
    setActiveAdjudicatingId(msg.id);
    try {
      const res = await fetch('/api/relay/adjudicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: msg.text,
          proponent: msg.senderLabel || 'Архитектор',
          opponent: 'ChatGPT (Adversary)',
          parent_locator: msg.locator
        })
      });

      if (res.ok) {
        const rulingData = await res.json();
        // Deposit ruling into ledger
        await fetch('/api/relay/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'agent:court-proverbs-18-17',
            to: 'all',
            type: 'ruling',
            title: `Постановление Суда: ${rulingData.verdict === 'RATIFIED' ? 'УТВЕРЖДЕНО' : 'ОТКЛОНЕНО'} (Счет: ${rulingData.criteria?.score || 95}/100)`,
            parent_locator: msg.locator,
            payload: {
              verdict: rulingData.verdict,
              summary: rulingData.ruling_text || rulingData.reasoning,
              criteria: rulingData.criteria,
              biblical_basis: 'Притчи 18:17 (Первый в тяжбе кажется правым, но приходит соперник его и исследует его)'
            }
          })
        });
      }
    } catch (e) {
      console.error('Launch court error:', e);
    } finally {
      setIsSubmitting(false);
      setActiveAdjudicatingId(null);
    }
  };

  // Quick Swarm Debate: triggers human proposal -> Claude code -> ChatGPT challenge -> Gemini court verdict
  const handleTriggerSwarmDebate = async () => {
    setIsSubmitting(true);
    try {
      // 1. Human Architect defines problem
      const pRes = await fetch('/api/relay/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'agent:human-architect',
          to: 'all',
          type: 'claim',
          title: 'Задача: протокол синхронизации без центрального лидера',
          payload: {
            body: 'Требуется распределенный протокол консенсуса для 4 независимых LLM с гарантией каузальной причинности HLC и неизменяемым леджером O_EXCL.'
          }
        })
      });
      const pData = await pRes.json();

      // 2. Claude responds with technical architecture
      await fetch('/api/relay/agent-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'claude',
          type: 'claim',
          title: 'Спецификация Claude: HLC + JCS Verifiable Bus',
          text: 'Предлагаю протокол HLC (Logical Time) с RFC 8785 канонизацией дайджестов (Притчи 11:1). Каждый агент ставит подпись в свой локальный slot.',
          parent_locator: pData.locator
        })
      });

      // 3. ChatGPT cross-examines (Proverbs 18:17)
      await fetch('/api/relay/agent-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'chatgpt',
          type: 'challenge',
          title: 'Возражение ChatGPT: уязвимость к гонке в POSIX open',
          text: 'Первый в тяжбе кажется правым (Притчи 18:17). Если два агента вызывают O_EXCL на одном NFS маунте без fsync, возможна коллизия маркеров.',
          parent_locator: pData.locator
        })
      });

      // 4. Gemini Criterion Guard issues Ruling
      await fetch('/api/relay/agent-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'gemini',
          type: 'ruling',
          title: 'Постановление Суда: Инвариант O_EXCL подтвержден',
          text: 'Судебное заключение: SPEC MUST 3 требует атомарного POSIX-флага O_CREAT | O_EXCL. В случае EEXIST агент обязан инкрементировать seq. Нарушений нет.',
          parent_locator: pData.locator
        })
      });
    } catch (e) {
      console.error('Swarm debate error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] min-h-[560px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl w-full">
      {/* Top Chat Bar */}
      <div className="bg-slate-950 px-3 sm:px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                Мульти-Агентный Консилиум
              </h2>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="hidden xs:inline">{sseConnected ? 'SSE Live' : 'Connecting...'}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate hidden sm:block">
              Архитектор · Claude Code · ChatGPT Adversary · Mistral · Gemini Guard
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <button
            onClick={handleTriggerSwarmDebate}
            disabled={isSubmitting}
            className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[11px] sm:text-xs font-bold shadow transition disabled:opacity-50 shrink-0"
            title="Запустить полный цикл дебатов: Архитектор -> Claude -> ChatGPT -> Gemini"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Раунд дебатов (Swarm)</span>
            <span className="sm:hidden">Swarm</span>
          </button>

          <button
            onClick={loadInitialChatFromLedger}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shrink-0"
            title="Синхронизировать с леджером"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Agents Roster Strip - Flex Wrapped to avoid any horizontal scrollbar */}
      <div className="bg-slate-900/90 px-3 sm:px-4 py-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-1.5 shrink-0">
        <span className="font-semibold text-slate-300 shrink-0 text-[10px] sm:text-xs">Участники:</span>
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {Object.entries(AGENT_CONFIGS).map(([key, cfg]) => {
            return (
              <div key={key} className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800/80 shrink-0 text-[10px] sm:text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${key === 'human' ? 'bg-emerald-400' : key === 'claude' ? 'bg-amber-400' : key === 'chatgpt' ? 'bg-teal-400' : 'bg-indigo-400'}`} />
                <span className="font-medium text-slate-200">{cfg.shortName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Feed */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-slate-950/40"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-500 space-y-3">
            <MessageSquare className="w-10 h-10 text-slate-700 animate-bounce" />
            <p className="text-xs sm:text-sm font-medium text-slate-400">Чат пуст. Начните диалог или нажмите «Раунд дебатов».</p>
            <p className="text-[11px] max-w-md text-slate-500">
              Каждое отправленное сообщение превращается в канонический Акт (Envelope) с SHA-256 хешем (Притчи 11:1) и немедленно попадает в атомарный леджер O_EXCL.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const cfg = AGENT_CONFIGS[msg.sender] || AGENT_CONFIGS.unknown;
            const Icon = cfg.icon;
            const isHuman = msg.sender === 'human';
            const isTargeted = activeAdjudicatingId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-2 sm:space-x-3 group ${
                  isHuman ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.avatarBg} shadow-md`}>
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>

                {/* Message Bubble */}
                <div className={`max-w-2xl w-full sm:w-auto rounded-2xl p-3.5 sm:p-4 border transition-all ${
                  isHuman 
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-100 rounded-tr-none' 
                    : msg.sender === 'court'
                    ? 'bg-purple-950/30 border-purple-800/60 text-slate-100 rounded-tl-none'
                    : 'bg-slate-900 border-slate-800 text-slate-100 rounded-tl-none'
                }`}>
                  {/* Header info */}
                  <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-slate-800/60 flex-wrap">
                    <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                      <span className={`text-xs font-bold truncate ${cfg.textColor}`}>
                        {cfg.name}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold border ${cfg.badgeBg} shrink-0`}>
                        {msg.type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400 shrink-0 ml-auto">
                      {msg.locator && (
                        <span className="text-indigo-400 font-bold bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/60">
                          {msg.locator}
                        </span>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* Title if present */}
                  {msg.title && (
                    <div className="text-xs font-semibold text-slate-200 mb-1 flex items-center space-x-1">
                      <span>{msg.title}</span>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>

                  {/* Criteria Scores Box for Court Rulings */}
                  {msg.sender === 'court' && msg.rawPayload?.criteria && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/50 space-y-1.5 text-[11px]">
                      <div className="font-semibold text-purple-200 flex items-center justify-between">
                        <span>Оценка критериев Суда (Притчи 18:17):</span>
                        <span className="font-mono text-emerald-400 font-bold">{msg.rawPayload.criteria.score || 95}/100</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-purple-300 font-mono">
                        <div>⚖️ Каноничность (JCS): {msg.rawPayload.criteria.jcs_canonical ? '100%' : '50%'}</div>
                        <div>🔒 Атомарность O_EXCL: {msg.rawPayload.criteria.o_excl_verified ? 'PASS' : 'FAIL'}</div>
                        <div>⏱️ Монотонность HLC: {msg.rawPayload.criteria.hlc_monotonic ? 'PASS' : 'FAIL'}</div>
                        <div>🗑️ SPEC MUST 6: {msg.rawPayload.criteria.known_missing_retained ? 'PASS' : 'FAIL'}</div>
                      </div>
                    </div>
                  )}

                  {/* Parent Locator Reply Badge */}
                  {msg.parentLocator && (
                    <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-center space-x-1.5 text-[11px] text-slate-400 flex-wrap">
                      <ArrowDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>В ответ на:</span>
                      <button 
                        onClick={() => setParentLocator(msg.parentLocator || '')}
                        className="font-mono text-indigo-300 hover:underline bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                      >
                        {msg.parentLocator}
                      </button>
                    </div>
                  )}

                  {/* Footer metadata & Action Triggers */}
                  <div className="mt-2.5 pt-1.5 border-t border-slate-800/40 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 gap-2">
                    <div className="flex items-center space-x-2 truncate max-w-full">
                      {msg.digest && (
                        <span className="text-slate-400 truncate" title={`JCS SHA-256 Digest: ${msg.digest}`}>
                          ⚖️ {msg.digest.slice(0, 16)}...
                        </span>
                      )}
                      {msg.hlc && (
                        <span className="text-indigo-400 truncate hidden sm:inline">
                          ⏱️ HLC:{msg.hlc.slice(0, 14)}
                        </span>
                      )}
                    </div>

                    {/* Interactive Action Buttons for Triad & Court */}
                    <div className="flex items-center space-x-1.5 shrink-0 ml-auto flex-wrap">
                      {/* Launch Triad Button */}
                      <button
                        onClick={() => handleLaunchTriadOnMessage(msg)}
                        disabled={isSubmitting}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-700/60 text-[10px] font-semibold transition disabled:opacity-50"
                        title="Запустить Триаду: ChatGPT проведет состязательное оппонирование (Притчи 18:17), а Mistral верифицирует инварианты"
                      >
                        <Zap className="w-3 h-3 text-teal-400" />
                        <span>Триада</span>
                      </button>

                      {/* Launch Court Adjudication Button */}
                      <button
                        onClick={() => handleLaunchCourtOnMessage(msg)}
                        disabled={isSubmitting}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/60 text-[10px] font-semibold transition disabled:opacity-50"
                        title="Передать в Суд: Gemini 3.7 проведет судебную оценку критериев и вынесет каноническое постановление (Ruling)"
                      >
                        <Gavel className="w-3 h-3 text-purple-400" />
                        <span>В Суд</span>
                      </button>

                      {/* Reply Button */}
                      <button
                        onClick={() => setParentLocator(msg.locator || '')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                        title="Ответить на этот Акт"
                      >
                        Ответить
                      </button>

                      {/* Copy JSON */}
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(msg, null, 2), msg.id)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                        title="Копировать JSON конверта"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Replying banner */}
      {parentLocator && (
        <div className="bg-indigo-950/80 px-4 py-1.5 border-t border-indigo-800 flex items-center justify-between text-xs text-indigo-300 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <ArrowDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">Ответ на Акт: <strong className="font-mono text-white">{parentLocator}</strong></span>
          </div>
          <button
            onClick={() => setParentLocator('')}
            className="text-[11px] text-indigo-400 hover:text-white shrink-0 ml-2"
          >
            Отменить
          </button>
        </div>
      )}

      {/* Input Composer Section */}
      <div className="bg-slate-950 p-3 sm:p-4 border-t border-slate-800 space-y-2.5 shrink-0">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <span className="text-slate-400 font-medium text-[11px] sm:text-xs">Адресовать:</span>
            <select
              value={selectedAgent}
              onChange={(e: any) => setSelectedAgent(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-medium text-[11px] sm:text-xs focus:ring-1 focus:ring-indigo-500 max-w-[180px] sm:max-w-none"
            >
              <option value="all">📢 Всем (Consensus)</option>
              <option value="claude">🤖 Claude Code</option>
              <option value="chatgpt">⚡ ChatGPT Adversary</option>
              <option value="gemini">✨ Gemini Guard</option>
              <option value="mistral">⚙️ Mistral</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <span className="text-slate-400 font-medium text-[11px] sm:text-xs">Тип:</span>
            <select
              value={selectedActType}
              onChange={(e: any) => setSelectedActType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 font-medium text-[11px] sm:text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="claim">claim (Предложение)</option>
              <option value="challenge">challenge (Возражение)</option>
              <option value="finding">finding (Вывод)</option>
              <option value="ruling">ruling (Суд)</option>
              <option value="attestation">attestation (Заверение)</option>
            </select>
          </div>
        </div>

        {/* Text Input and Send Button */}
        <div className="flex items-end space-x-2">
          <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition min-w-0">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Напишите задачу или тезис (Enter для отправки в леджер O_EXCL, Shift+Enter для новой строки)..."
              className="w-full bg-transparent border-0 text-slate-100 text-xs placeholder-slate-500 focus:outline-none resize-none font-sans"
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isSubmitting}
            className="h-10 sm:h-11 px-3.5 sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Отправить</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
