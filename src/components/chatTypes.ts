import { User, HelpCircle, Terminal, Zap, Cpu, Sparkles, Scale, Bot, Flame, Compass, Brain, Layers } from 'lucide-react';

export interface ChatMessage {
  id: string;
  seq?: number;
  locator?: string;
  sender: 'human' | 'claude' | 'chatgpt' | 'gemini' | 'mistral' | 'grok' | 'mimo' | 'hy3' | 'qwen' | 'deepseek' | 'court' | 'unknown' | string;
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

export interface AgentConfigItem {
  name: string;
  shortName: string;
  avatarBg: string;
  badgeBg: string;
  textColor: string;
  nodeBg: string;
  nodeBorder: string;
  nodeAccent: string;
  icon: any;
  roleDescription: string;
}

export const AGENT_CONFIGS: Record<string, AgentConfigItem> = {
  human: {
    name: 'Вы (Архитектор)',
    shortName: 'Архитектор',
    avatarBg: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40',
    badgeBg: 'bg-emerald-950/60 text-emerald-400 border-emerald-800',
    textColor: 'text-emerald-300',
    nodeBg: '#064e3b',
    nodeBorder: '#10b981',
    nodeAccent: '#34d399',
    icon: User,
    roleDescription: 'Человек-архитектор и постановщик задач'
  },
  unknown: {
    name: 'Unknown sender',
    shortName: 'Unknown',
    avatarBg: 'bg-slate-600/20 text-slate-400 border-slate-500/40',
    badgeBg: 'bg-slate-950/60 text-slate-400 border-slate-800',
    textColor: 'text-slate-300',
    nodeBg: '#1e293b',
    nodeBorder: '#64748b',
    nodeAccent: '#94a3b8',
    icon: HelpCircle,
    roleDescription: 'Отправитель, не описанный в этом интерфейсе'
  },
  claude: {
    name: 'Claude Code (Sonnet 3.5)',
    shortName: 'Claude',
    avatarBg: 'bg-amber-600/20 text-amber-400 border-amber-500/40',
    badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-800',
    textColor: 'text-amber-300',
    nodeBg: '#451a03',
    nodeBorder: '#d97706',
    nodeAccent: '#fbbf24',
    icon: Terminal,
    roleDescription: 'Инициатор, генератор распределенных схем и кода'
  },
  chatgpt: {
    name: 'ChatGPT (GPT-4o Adversary)',
    shortName: 'ChatGPT',
    avatarBg: 'bg-teal-600/20 text-teal-400 border-teal-500/40',
    badgeBg: 'bg-teal-950/60 text-teal-300 border-teal-800',
    textColor: 'text-teal-300',
    nodeBg: '#042f2e',
    nodeBorder: '#0d9488',
    nodeAccent: '#2dd4bf',
    icon: Zap,
    roleDescription: 'Состязательный оппонент (Притчи 18:17, поиск race conditions)'
  },
  mistral: {
    name: 'Mistral (Codestral)',
    shortName: 'Mistral',
    avatarBg: 'bg-orange-600/20 text-orange-400 border-orange-500/40',
    badgeBg: 'bg-orange-950/60 text-orange-300 border-orange-800',
    textColor: 'text-orange-300',
    nodeBg: '#431407',
    nodeBorder: '#ea580c',
    nodeAccent: '#fb923c',
    icon: Cpu,
    roleDescription: 'Инвариантный верификатор и стресс-тестировщик'
  },
  gemini: {
    name: 'Gemini (Criterion Guard)',
    shortName: 'Gemini',
    avatarBg: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40',
    badgeBg: 'bg-indigo-950/60 text-indigo-300 border-indigo-800',
    textColor: 'text-indigo-300',
    nodeBg: '#1e1b4b',
    nodeBorder: '#6366f1',
    nodeAccent: '#818cf8',
    icon: Sparkles,
    roleDescription: 'Хранитель критериев, аудит SPEC MUST 1-8 и HLC'
  },
  court: {
    name: 'Суд Притчей 18:17 (Adjudication)',
    shortName: 'Суд',
    avatarBg: 'bg-purple-600/20 text-purple-400 border-purple-500/40',
    badgeBg: 'bg-purple-950/60 text-purple-300 border-purple-800',
    textColor: 'text-purple-300',
    nodeBg: '#3b0764',
    nodeBorder: '#a855f7',
    nodeAccent: '#c084fc',
    icon: Scale,
    roleDescription: 'Судебное постановление и окончательный вердикт'
  },
  grok: {
    name: 'xAI Grok',
    shortName: 'Grok',
    avatarBg: 'bg-rose-600/20 text-rose-400 border-rose-500/40',
    badgeBg: 'bg-rose-950/60 text-rose-300 border-rose-800',
    textColor: 'text-rose-300',
    nodeBg: '#4c0519',
    nodeBorder: '#f43f5e',
    nodeAccent: '#fb7185',
    icon: Flame,
    roleDescription: 'xAI Grok — бескомпромиссный состязательный анализ'
  },
  mimo: {
    name: 'Xiaomi MiMo',
    shortName: 'MiMo',
    avatarBg: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/40',
    badgeBg: 'bg-cyan-950/60 text-cyan-300 border-cyan-800',
    textColor: 'text-cyan-300',
    nodeBg: '#083344',
    nodeBorder: '#06b6d4',
    nodeAccent: '#38bdf8',
    icon: Bot,
    roleDescription: 'Xiaomi MiMo — встраиваемый агент быстрой валидации'
  },
  hy3: {
    name: 'Tencent Hunyuan 3',
    shortName: 'Hunyuan 3',
    avatarBg: 'bg-fuchsia-600/20 text-fuchsia-400 border-fuchsia-500/40',
    badgeBg: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800',
    textColor: 'text-fuchsia-300',
    nodeBg: '#4a044e',
    nodeBorder: '#d946ef',
    nodeAccent: '#e879f9',
    icon: Compass,
    roleDescription: 'Tencent Hunyuan — многоаспектный синтез аргументов'
  },
  qwen: {
    name: 'Alibaba Qwen 2.5',
    shortName: 'Qwen',
    avatarBg: 'bg-sky-600/20 text-sky-400 border-sky-500/40',
    badgeBg: 'bg-sky-950/60 text-sky-300 border-sky-800',
    textColor: 'text-sky-300',
    nodeBg: '#0c4a6e',
    nodeBorder: '#0284c7',
    nodeAccent: '#38bdf8',
    icon: Brain,
    roleDescription: 'Alibaba Qwen — масштабируемый мультиязычный анализ'
  },
  deepseek: {
    name: 'DeepSeek (V3/R1)',
    shortName: 'DeepSeek',
    avatarBg: 'bg-blue-600/20 text-blue-400 border-blue-500/40',
    badgeBg: 'bg-blue-950/60 text-blue-300 border-blue-800',
    textColor: 'text-blue-300',
    nodeBg: '#172554',
    nodeBorder: '#2563eb',
    nodeAccent: '#60a5fa',
    icon: Layers,
    roleDescription: 'DeepSeek — глубокий математический рефлектор'
  }
};

// Dynamic color palette generator for future/unregistered agents (e.g. llama4, phi4, etc.)
const DYNAMIC_AGENT_PALETTES = [
  { avatarBg: 'bg-violet-600/20 text-violet-400 border-violet-500/40', badgeBg: 'bg-violet-950/60 text-violet-300 border-violet-800', textColor: 'text-violet-300', nodeBg: '#2e1065', nodeBorder: '#8b5cf6', nodeAccent: '#a78bfa' },
  { avatarBg: 'bg-lime-600/20 text-lime-400 border-lime-500/40', badgeBg: 'bg-lime-950/60 text-lime-300 border-lime-800', textColor: 'text-lime-300', nodeBg: '#1a2e05', nodeBorder: '#65a30d', nodeAccent: '#a3e635' },
  { avatarBg: 'bg-pink-600/20 text-pink-400 border-pink-500/40', badgeBg: 'bg-pink-950/60 text-pink-300 border-pink-800', textColor: 'text-pink-300', nodeBg: '#500724', nodeBorder: '#db2777', nodeAccent: '#f472b6' },
  { avatarBg: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40', badgeBg: 'bg-emerald-950/60 text-emerald-300 border-emerald-800', textColor: 'text-emerald-300', nodeBg: '#064e3b', nodeBorder: '#059669', nodeAccent: '#34d399' },
  { avatarBg: 'bg-amber-600/20 text-amber-400 border-amber-500/40', badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-800', textColor: 'text-amber-300', nodeBg: '#451a03', nodeBorder: '#d97706', nodeAccent: '#fbbf24' },
];

export function getAgentConfig(sender: string): AgentConfigItem {
  const normalized = sender.toLowerCase().replace(/^(agent:|bee\.)/, '').trim();
  
  if (AGENT_CONFIGS[normalized]) {
    return AGENT_CONFIGS[normalized];
  }

  // Check partial key matches
  for (const key of Object.keys(AGENT_CONFIGS)) {
    if (normalized.includes(key)) {
      return AGENT_CONFIGS[key];
    }
  }

  // Deterministically generate config for any future or external agent name
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const palette = DYNAMIC_AGENT_PALETTES[Math.abs(hash) % DYNAMIC_AGENT_PALETTES.length];
  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return {
    name: `Agent: ${capitalized}`,
    shortName: capitalized.slice(0, 10),
    avatarBg: palette.avatarBg,
    badgeBg: palette.badgeBg,
    textColor: palette.textColor,
    nodeBg: palette.nodeBg,
    nodeBorder: palette.nodeBorder,
    nodeAccent: palette.nodeAccent,
    icon: Bot,
    roleDescription: `Внешний агент консилиума: ${capitalized}`
  };
}
