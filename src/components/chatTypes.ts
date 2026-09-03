import { User, HelpCircle, Terminal, Zap, Cpu, Sparkles, Scale } from 'lucide-react';

export interface ChatMessage {
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

export const AGENT_CONFIGS: Record<string, {
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
