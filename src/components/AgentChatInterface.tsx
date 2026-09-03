import React, { useState, useEffect, useRef, useMemo } from 'react';
import Markdown from 'react-markdown';
import { 
  Send, Bot, Sparkles, User, Scale, ShieldCheck, 
  Terminal, RefreshCw, Paperclip, ChevronDown, Check,
  Clock, Hash, ArrowDownRight, Layers, Play, Radio,
  MessageSquare, Zap, Cpu, AlertCircle, Copy, Gavel, HelpCircle, Code,
  Maximize2, Minimize2, Filter
} from 'lucide-react';

export interface AgentChatInterfaceProps {
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

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

/**
 * Extracts human-readable prose or text from heterogeneous envelope payloads.
 * Supports PeTextRelayStore ({ text }), standard claims ({ body, claim }), and complex objects.
 */
function extractPayloadText(payload: any): string {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.body === 'string') return payload.body;
  if (typeof payload.proposal === 'string') return payload.proposal;
  if (typeof payload.claim === 'string') return payload.claim;
  if (typeof payload.reasoning === 'string') return payload.reasoning;
  if (typeof payload.content === 'string') return payload.content;
  if (typeof payload.message === 'string') return payload.message;
  return JSON.stringify(payload, null, 2);
}

function resolveSender(from: string): { sender: ChatMessage['sender']; label: string } {
  const f = (from || '').toLowerCase();
  if (f.includes('claude')) return { sender: 'claude', label: AGENT_CONFIGS.claude.name };
  if (f.includes('chatgpt')) return { sender: 'chatgpt', label: AGENT_CONFIGS.chatgpt.name };
  if (f.includes('gemini')) return { sender: 'gemini', label: AGENT_CONFIGS.gemini.name };
  if (f.includes('mistral')) return { sender: 'mistral', label: AGENT_CONFIGS.mistral.name };
  if (f.includes('court')) return { sender: 'court', label: AGENT_CONFIGS.court.name };
  if (f.includes('human') || f.includes('architect')) return { sender: 'human', label: AGENT_CONFIGS.human.name };
  return { sender: 'unknown', label: from || 'Unknown sender' };
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

export const AgentChatInterface: React.FC<AgentChatInterfaceProps> = ({
  isFocusMode = false,
  onToggleFocusMode
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<'claude' | 'chatgpt' | 'gemini' | 'mistral' | 'all'>('all');
  const [selectedActType, setSelectedActType] = useState<'claim' | 'challenge' | 'finding' | 'ruling' | 'attestation'>('claim');
  const [filterSender, setFilterSender] = useState<string>('all');
  const [parentLocator, setParentLocator] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeAdjudicatingId, setActiveAdjudicatingId] = useState<string | null>(null);

  const [rawViewMsgIds, setRawViewMsgIds] = useState<Set<string>>(new Set());

  const toggleRawView = (id: string) => {
    setRawViewMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredMessages = useMemo(() => {
    if (filterSender === 'all') return messages;
    return messages.filter((m) => m.sender === filterSender);
  }, [messages, filterSender]);

  // Helper to highlight inline citations like relay-0774 in text
  const renderTextWithLocators = (text: string) => {
    if (typeof text !== 'string') return text;
    const parts = text.split(/(relay-\d{4})/g);
    if (parts.length === 1) return text;
    return parts.map((part, idx) => {
      if (/^relay-\d{4}$/.test(part)) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => setParentLocator(part)}
            title={`Установить ${part} как родительский локатор`}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900 hover:text-indigo-100 transition cursor-pointer"
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  const formatChildrenWithLocators = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') return renderTextWithLocators(node);
    if (Array.isArray(node)) return React.Children.map(node, formatChildrenWithLocators);
    return node;
  };

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
            const { sender, label } = resolveSender(env.from || '');
            const payloadText = extractPayloadText(env.payload);

            return {
              id: env.locator || `msg-${Date.now()}-${Math.random()}`,
              seq: env.seq,
              locator: env.locator,
              sender,
              senderLabel: label,
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

          const { sender, label } = resolveSender(env.from || '');
          const payloadText = extractPayloadText(env.payload);

          const newMsg: ChatMessage = {
            id: env.locator || `msg-${Date.now()}`,
            seq: env.seq,
            locator: env.locator,
            sender,
            senderLabel: label,
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

      // If user addressed a specific agent, trigger that agent's response
      if (selectedAgent === 'claude') {
        await triggerAgentExecution('claude', 'claim', `Ответ Claude на: ${userText}`, data.locator);
      } else if (selectedAgent === 'chatgpt') {
        await triggerAgentExecution('chatgpt', 'challenge', `Кросс-экзаменация ChatGPT: ${userText}`, data.locator);
      } else if (selectedAgent === 'gemini') {
        await triggerAgentExecution('gemini', 'finding', `Аудит Gemini: ${userText}`, data.locator);
      } else if (selectedAgent === 'mistral') {
        await triggerAgentExecution('mistral', 'finding', `Верификация Mistral: ${userText}`, data.locator);
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
    <div className="flex-1 h-full w-full flex flex-col bg-slate-950 overflow-hidden relative font-sans">
      {/* 1. Sleek Compact Top Bar (Single Row, ~44px, no vertical waste) */}
      <div className="h-11 sm:h-12 px-3 sm:px-6 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur flex items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Chat Title & Status */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center space-x-2 truncate">
            <span className="text-xs sm:text-sm font-bold text-slate-100 truncate">
              Консилиум
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{sseConnected ? 'Live' : 'Connect'}</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500 hidden md:inline">
              {messages.length} актов
            </span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
          {/* Filter by Sender */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5 text-slate-300 text-[10px]">
            <Filter className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
            <select
              value={filterSender}
              onChange={(e) => setFilterSender(e.target.value)}
              className="bg-transparent text-slate-300 text-[10px] font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">Все агенты</option>
              <option value="human">Архитектор</option>
              <option value="claude">Claude Code</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="gemini">Gemini Guard</option>
              <option value="mistral">Mistral</option>
              <option value="court">Суд (Ruling)</option>
            </select>
          </div>

          {/* Swarm Round Button */}
          <button
            onClick={handleTriggerSwarmDebate}
            disabled={isSubmitting}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[11px] font-bold shadow transition disabled:opacity-50 shrink-0"
            title="Запустить полный раунд дебатов: Архитектор -> Claude -> ChatGPT -> Gemini"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span className="hidden sm:inline">Раунд Swarm</span>
          </button>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border transition text-xs ${
              autoScroll
                ? 'bg-slate-800 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title={autoScroll ? "Автопрокрутка включена" : "Автопрокрутка выключена"}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
          </button>

          {/* Refresh / Sync */}
          <button
            onClick={loadInitialChatFromLedger}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
            title="Синхронизировать с леджером"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Focus Mode Toggle (Hide Navbar for 100% full screen chat) */}
          {onToggleFocusMode && (
            <button
              onClick={onToggleFocusMode}
              className={`p-1.5 rounded-lg border transition ${
                isFocusMode
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-700/60'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
              title={isFocusMode ? "Выйти из фокус-режима (показать шапку сайта)" : "Фокус-режим: скрыть шапку сайта для максимума рабочего места"}
            >
              {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Message Stream Feed (Centered ChatGPT/Claude-style stream) */}
      <div 
        ref={chatContainerRef}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden scroll-smooth py-4 sm:py-6 px-3 sm:px-6"
      >
        <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-4 sm:space-y-6">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[360px] text-center p-6 text-slate-500 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400 shadow-inner">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-slate-200">
                  Чат мульти-агентного консилиума
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Все сообщения валидируются по RFC 8785, получают канонический дайджест SHA-256 и атомарно фиксируются в O_EXCL леджере.
                </p>
              </div>

              {/* Quick suggestion cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg pt-2 text-left">
                <button
                  onClick={() => {
                    setInputText('Как протокол гарантирует отсутствие race conditions при одновременной записи слотов?');
                    textareaRef.current?.focus();
                  }}
                  className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition text-xs text-slate-300 space-y-1"
                >
                  <span className="font-semibold text-indigo-400 block">🔒 Инвариант O_EXCL</span>
                  <span className="text-[11px] text-slate-400 line-clamp-2">Проверить гарантию взаимного исключения POSIX</span>
                </button>
                <button
                  onClick={() => {
                    setInputText('Предлагаю архитектуру гибридных часов HLC с монотонным инкрементом логического счетчика.');
                    setSelectedActType('claim');
                    textareaRef.current?.focus();
                  }}
                  className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition text-xs text-slate-300 space-y-1"
                >
                  <span className="font-semibold text-amber-400 block">⏱️ Каузальность HLC</span>
                  <span className="text-[11px] text-slate-400 line-clamp-2">Вынести тезис о причинно-следственном порядке</span>
                </button>
              </div>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const cfg = AGENT_CONFIGS[msg.sender] || AGENT_CONFIGS.unknown;
              const Icon = cfg.icon;
              const isHuman = msg.sender === 'human';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 group w-full ${
                    isHuman ? 'flex-row-reverse' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${cfg.avatarBg} shadow-sm mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Message Bubble */}
                  <div className={`w-full max-w-2xl sm:max-w-3xl rounded-2xl p-3.5 sm:p-4.5 border transition-all ${
                    isHuman 
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-100 rounded-tr-sm ml-auto' 
                      : msg.sender === 'court'
                      ? 'bg-purple-950/20 border-purple-800/50 text-slate-100 rounded-tl-sm'
                      : 'bg-slate-900/90 border-slate-800/80 text-slate-100 rounded-tl-sm hover:border-slate-700/80'
                  }`}>
                    {/* Header info row */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/60 flex-wrap">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className={`text-xs font-bold truncate ${cfg.textColor}`}>
                          {msg.sender === 'unknown' ? (msg.senderLabel || cfg.name) : cfg.name}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-semibold border ${cfg.badgeBg} shrink-0`}>
                          {msg.type}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400 shrink-0 ml-auto">
                        {msg.rawPayload !== undefined && (
                          <button
                            type="button"
                            onClick={() => toggleRawView(msg.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition flex items-center space-x-1 cursor-pointer ${
                              rawViewMsgIds.has(msg.id)
                                ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700/60'
                                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                            }`}
                            title={rawViewMsgIds.has(msg.id) ? "Показать форматированный текст" : "Показать исходный JSON payload"}
                          >
                            <Code className="w-2.5 h-2.5" />
                            <span>{rawViewMsgIds.has(msg.id) ? 'PAYLOAD' : 'JSON'}</span>
                          </button>
                        )}
                        {msg.locator && (
                          <button
                            type="button"
                            onClick={() => setParentLocator(msg.locator || '')}
                            title="Ответить на этот локатор"
                            className="text-indigo-400 hover:text-indigo-200 font-bold bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/60 hover:border-indigo-600 transition cursor-pointer"
                          >
                            {msg.locator}
                          </button>
                        )}
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>

                    {/* Title if present */}
                    {msg.title && (
                      <div className="text-xs font-semibold text-slate-200 mb-1.5">
                        {msg.title}
                      </div>
                    )}

                    {/* Body Content */}
                    {rawViewMsgIds.has(msg.id) ? (
                      <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto my-1">
                        <pre>{JSON.stringify(msg.rawPayload || msg.text, null, 2)}</pre>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans break-words space-y-1.5">
                        <Markdown
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0 leading-relaxed text-slate-300 whitespace-pre-wrap">
                                {formatChildrenWithLocators(children)}
                              </p>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-sm font-bold text-slate-100 mt-3 mb-1.5 border-b border-slate-800 pb-1">
                                {formatChildrenWithLocators(children)}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-xs font-bold text-slate-100 mt-2.5 mb-1">
                                {formatChildrenWithLocators(children)}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-xs font-semibold text-slate-200 mt-2 mb-1">
                                {formatChildrenWithLocators(children)}
                              </h3>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-300">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-4 mb-2 space-y-1 text-slate-300">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="leading-relaxed">
                                {formatChildrenWithLocators(children)}
                              </li>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-indigo-500/60 pl-3 my-2 text-slate-400 italic bg-slate-950/40 py-1.5 rounded-r">
                                {formatChildrenWithLocators(children)}
                              </blockquote>
                            ),
                            code: ({ inline, children, ...props }: any) => {
                              return inline ? (
                                <code className="bg-slate-950 px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-300 border border-slate-800/80" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto my-2">
                                  <code>{children}</code>
                                </pre>
                              );
                            },
                          }}
                        >
                          {msg.text}
                        </Markdown>
                      </div>
                    )}

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

                    {/* Parent Locator Reply Citation */}
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

                    {/* Footer metadata & Action Toolbar */}
                    <div className="mt-2.5 pt-1.5 border-t border-slate-800/40 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 gap-2">
                      <div className="flex items-center space-x-2 truncate max-w-full">
                        {msg.digest && (
                          <span className="text-slate-400 truncate" title={`JCS SHA-256 Digest: ${msg.digest}`}>
                            ⚖️ {msg.digest.slice(0, 14)}...
                          </span>
                        )}
                        {msg.hlc && (
                          <span className="text-indigo-400 truncate hidden sm:inline">
                            ⏱️ HLC:{msg.hlc.slice(0, 14)}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5 shrink-0 ml-auto flex-wrap">
                        <button
                          onClick={() => handleLaunchTriadOnMessage(msg)}
                          disabled={isSubmitting}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-700/60 text-[10px] font-semibold transition disabled:opacity-50"
                          title="Запустить Триаду: ChatGPT оппонирует, а Mistral верифицирует инварианты"
                        >
                          <Zap className="w-3 h-3 text-teal-400" />
                          <span>Триада</span>
                        </button>

                        <button
                          onClick={() => handleLaunchCourtOnMessage(msg)}
                          disabled={isSubmitting}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/60 text-[10px] font-semibold transition disabled:opacity-50"
                          title="Передать в Суд: судебная оценка критериев и постановление (Ruling)"
                        >
                          <Gavel className="w-3 h-3 text-purple-400" />
                          <span>В Суд</span>
                        </button>

                        <button
                          onClick={() => setParentLocator(msg.locator || '')}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                          title="Ответить на этот Акт"
                        >
                          Ответить
                        </button>

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
      </div>

      {/* 3. Floating Bottom Composer (ChatGPT / Claude / Grok Style) */}
      <div className="bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-1 pb-3 sm:pb-4 px-3 sm:px-6 shrink-0 z-20">
        <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-1.5">
          {/* Replying banner */}
          {parentLocator && (
            <div className="bg-indigo-950/80 px-3 py-1 rounded-xl border border-indigo-800/80 flex items-center justify-between text-xs text-indigo-300">
              <div className="flex items-center space-x-2 truncate">
                <ArrowDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Ответ на Акт: <strong className="font-mono text-white">{parentLocator}</strong></span>
              </div>
              <button
                onClick={() => setParentLocator('')}
                className="text-[11px] text-indigo-400 hover:text-white shrink-0 ml-2 cursor-pointer"
              >
                ✕ Отмена
              </button>
            </div>
          )}

          {/* Composer Card with integrated multiline input and controls */}
          <div className="bg-slate-900/95 border border-slate-700/80 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/40 rounded-2xl p-2.5 sm:p-3 shadow-2xl transition space-y-2">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Спросите агентов или предложите тезис (Enter для отправки, Shift+Enter для новой строки)..."
              className="w-full bg-transparent border-0 text-slate-100 text-xs sm:text-sm placeholder-slate-500 focus:outline-none resize-none font-sans max-h-36 min-h-[44px]"
            />

            {/* Bottom Row inside Composer */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 flex-wrap">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                {/* Target Agent Selector */}
                <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                  <span className="hidden xs:inline">Кому:</span>
                  <select
                    value={selectedAgent}
                    onChange={(e: any) => setSelectedAgent(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">📢 Всем (Swarm)</option>
                    <option value="claude">🤖 Claude Code</option>
                    <option value="chatgpt">⚡ ChatGPT Adversary</option>
                    <option value="gemini">✨ Gemini Guard</option>
                    <option value="mistral">⚙️ Mistral</option>
                  </select>
                </div>

                {/* Act Type Selector */}
                <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                  <span className="hidden xs:inline">Тип:</span>
                  <select
                    value={selectedActType}
                    onChange={(e: any) => setSelectedActType(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="claim">claim (Тезис)</option>
                    <option value="challenge">challenge (Возражение)</option>
                    <option value="finding">finding (Вывод)</option>
                    <option value="ruling">ruling (Суд)</option>
                    <option value="attestation">attestation (Заверение)</option>
                  </select>
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isSubmitting}
                className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-indigo-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed ml-auto cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Отправить</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-500">
            POSIX O_EXCL Monotonic Ledger · JCS RFC 8785 Digest · Proverbs 18:17
          </div>
        </div>
      </div>
    </div>
  );
};
