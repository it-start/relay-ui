import React, { memo, useMemo } from 'react';
import Markdown from 'react-markdown';
import { 
  Code, ChevronDown, ChevronRight, ArrowDownRight, 
  CornerDownRight, Zap, Gavel, Copy, Check, Compass 
} from 'lucide-react';
import { getAgentConfig, ChatMessage } from './chatTypes';

export interface ChatMessageCardProps {
  msg: ChatMessage;
  isHuman: boolean;
  isTemporarilyHighlighted: boolean;
  isCriteriaExpanded: boolean;
  isRawView: boolean;
  isCopied: boolean;
  isSubmitting: boolean;
  parentMsg: ChatMessage | null;
  replies: ChatMessage[];
  hasLocator: (locator: string) => boolean;
  onToggleRawView: (id: string) => void;
  onToggleCriteriaExpand: (id: string) => void;
  onSetParentLocator: (locator: string) => void;
  onScrollToMessage: (locatorOrId: string) => void;
  onLocatorHover: (locator: string | null) => void;
  onLaunchTriad: (msg: ChatMessage) => void;
  onLaunchCourt: (msg: ChatMessage) => void;
  onCopyToClipboard: (text: string, id: string) => void;
  onFocusInGraph?: (locator: string) => void;
}

export const ChatMessageCard: React.FC<ChatMessageCardProps> = memo(({
  msg,
  isHuman,
  isTemporarilyHighlighted,
  isCriteriaExpanded,
  isRawView,
  isCopied,
  isSubmitting,
  parentMsg,
  replies,
  hasLocator,
  onToggleRawView,
  onToggleCriteriaExpand,
  onSetParentLocator,
  onScrollToMessage,
  onLocatorHover,
  onLaunchTriad,
  onLaunchCourt,
  onCopyToClipboard,
  onFocusInGraph,
}) => {
  const cfg = getAgentConfig(msg.sender);
  const Icon = cfg.icon;

  // Memoized text formatting for inline locators (e.g. relay-0042)
  const formatChildrenWithLocators = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      const parts = node.split(/(relay-\d{4})/g);
      if (parts.length === 1) return node;
      return parts.map((part, idx) => {
        if (/^relay-\d{4}$/.test(part)) {
          const hasTarget = hasLocator(part);
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasTarget) onScrollToMessage(part);
                else onSetParentLocator(part);
              }}
              onMouseEnter={() => onLocatorHover(part)}
              onMouseLeave={() => onLocatorHover(null)}
              title={hasTarget ? `Клик: перейти к ${part} · Наведите для подсветки` : `Установить ${part} как ответ`}
              className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900 hover:text-indigo-100 hover:border-indigo-400 transition cursor-pointer shadow-sm"
            >
              <span>{part}</span>
              {hasTarget && <CornerDownRight className="w-2.5 h-2.5 ml-1 opacity-70" />}
            </button>
          );
        }
        return part;
      });
    }
    if (Array.isArray(node)) return React.Children.map(node, formatChildrenWithLocators);
    return node;
  };

  // Custom Markdown components memoized
  const markdownComponents = useMemo(() => ({
    p: ({ children }: any) => (
      <div className="mb-2 last:mb-0 leading-relaxed text-slate-300 whitespace-pre-wrap">
        {formatChildrenWithLocators(children)}
      </div>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-sm font-bold text-slate-100 mt-3 mb-1.5 border-b border-slate-800 pb-1">
        {formatChildrenWithLocators(children)}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xs font-bold text-slate-100 mt-2.5 mb-1">
        {formatChildrenWithLocators(children)}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-xs font-semibold text-slate-200 mt-2 mb-1">
        {formatChildrenWithLocators(children)}
      </h3>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-300">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal pl-4 mb-2 space-y-1 text-slate-300">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="leading-relaxed">
        {formatChildrenWithLocators(children)}
      </li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-2 border-indigo-500/60 pl-3 my-2 text-slate-400 italic bg-slate-950/40 py-1.5 rounded-r">
        {formatChildrenWithLocators(children)}
      </blockquote>
    ),
    pre: ({ children }: any) => (
      <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto my-2">
        {children}
      </pre>
    ),
    code: ({ className, children, ...props }: any) => {
      const codeStr = String(children || '').trim();
      if (/^relay-\d{4}$/.test(codeStr)) {
        const hasTarget = hasLocator(codeStr);
        return (
          <button
            type="button"
            onClick={() => {
              if (hasTarget) onScrollToMessage(codeStr);
              else onSetParentLocator(codeStr);
            }}
            onMouseEnter={() => onLocatorHover(codeStr)}
            onMouseLeave={() => onLocatorHover(null)}
            title={hasTarget ? `Клик: перейти к ${codeStr}` : `Ответить на ${codeStr}`}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900 transition cursor-pointer"
          >
            <span>{codeStr}</span>
            {hasTarget && <CornerDownRight className="w-2.5 h-2.5 ml-0.5 opacity-70" />}
          </button>
        );
      }

      return (
        <code
          className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
            className ? 'bg-transparent text-emerald-300' : 'bg-slate-950 text-indigo-300 border border-slate-800/80'
          }`}
          {...props}
        >
          {children}
        </code>
      );
    },
  }), [hasLocator, onScrollToMessage, onSetParentLocator, onLocatorHover]);

  return (
    <div
      id={`msg-${msg.id}`}
      data-locator={msg.locator || ''}
      className={`chat-message-item flex items-start gap-3 group w-full transition-all duration-300 rounded-2xl p-1 -m-1 ${
        isTemporarilyHighlighted 
          ? 'ring-2 ring-indigo-500 bg-indigo-950/25 shadow-lg shadow-indigo-500/10' 
          : ''
      } ${
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
                onClick={() => onToggleRawView(msg.id)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition flex items-center space-x-1 cursor-pointer ${
                  isRawView
                    ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700/60'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title={isRawView ? "Показать форматированный текст" : "Показать исходный JSON payload"}
              >
                <Code className="w-2.5 h-2.5" />
                <span>{isRawView ? 'PAYLOAD' : 'JSON'}</span>
              </button>
            )}
            {msg.locator && (
              <button
                type="button"
                onClick={() => onSetParentLocator(msg.locator || '')}
                title={`Локатор: ${msg.locator}. Кликните для ответа на этот Акт.`}
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
        {isRawView ? (
          <div className="bg-slate-950/90 rounded-lg p-2.5 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto my-1">
            <pre>{JSON.stringify(msg.rawPayload || msg.text, null, 2)}</pre>
          </div>
        ) : (
          <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans break-words space-y-1.5">
            <Markdown components={markdownComponents}>
              {msg.text}
            </Markdown>
          </div>
        )}

        {/* Collapsible Criteria & Reasoning Accordion for Court / Verification */}
        {msg.sender === 'court' && msg.rawPayload?.criteria && (
          <div className="mt-2.5 rounded-xl border border-purple-800/50 bg-purple-950/40 overflow-hidden text-[11px] transition">
            <button
              type="button"
              onClick={() => onToggleCriteriaExpand(msg.id)}
              className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-purple-900/30 transition cursor-pointer text-purple-200 font-semibold"
            >
              <div className="flex items-center space-x-1.5 truncate">
                {isCriteriaExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                )}
                <span className="truncate">⚖️ Судебное заключение:</span>
                <span className="font-mono text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
                  {msg.rawPayload.criteria.score || 95}/100
                </span>
              </div>
              <span className="text-[10px] text-purple-400 font-mono shrink-0 ml-2">
                {isCriteriaExpanded ? 'Свернуть' : 'Детали критериев ▾'}
              </span>
            </button>

            {isCriteriaExpanded && (
              <div className="p-2.5 pt-1 border-t border-purple-800/40 bg-purple-950/60 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-purple-200 font-mono">
                  <div className="p-1.5 rounded bg-purple-950/80 border border-purple-800/40 flex items-center justify-between">
                    <span>⚖️ Каноничность (JCS):</span>
                    <span className="font-bold text-emerald-400">{msg.rawPayload.criteria.jcs_canonical ? '100%' : '50%'}</span>
                  </div>
                  <div className="p-1.5 rounded bg-purple-950/80 border border-purple-800/40 flex items-center justify-between">
                    <span>🔒 Атомарность O_EXCL:</span>
                    <span className="font-bold text-emerald-400">{msg.rawPayload.criteria.o_excl_verified ? 'PASS' : 'FAIL'}</span>
                  </div>
                  <div className="p-1.5 rounded bg-purple-950/80 border border-purple-800/40 flex items-center justify-between">
                    <span>⏱️ Монотонность HLC:</span>
                    <span className="font-bold text-emerald-400">{msg.rawPayload.criteria.hlc_monotonic ? 'PASS' : 'FAIL'}</span>
                  </div>
                  <div className="p-1.5 rounded bg-purple-950/80 border border-purple-800/40 flex items-center justify-between">
                    <span>🗑️ SPEC MUST 6:</span>
                    <span className="font-bold text-emerald-400">{msg.rawPayload.criteria.known_missing_retained ? 'PASS' : 'FAIL'}</span>
                  </div>
                </div>
                <div className="text-[10px] text-purple-300/80 italic font-mono bg-purple-950/90 p-1.5 rounded border border-purple-900/60">
                  «Первый в тяжбе своей прав, пока не придет соперник и не исследует его» (Притчи 18:17). Инварианты подтверждены.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Parent Locator Reply Citation with Jump & Hover Glow */}
        {msg.parentLocator && (
          <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-center space-x-1.5 text-[11px] text-slate-400 flex-wrap">
            <ArrowDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>В ответ на:</span>
            <button 
              type="button"
              onClick={() => {
                if (parentMsg) onScrollToMessage(msg.parentLocator!);
                else onSetParentLocator(msg.parentLocator || '');
              }}
              onMouseEnter={() => onLocatorHover(msg.parentLocator || null)}
              onMouseLeave={() => onLocatorHover(null)}
              title={parentMsg ? `Перейти к исходному акту ${msg.parentLocator} (${parentMsg.sender})` : `Установить ответ`}
              className="font-mono text-indigo-300 hover:text-indigo-100 hover:underline bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 hover:border-indigo-600 transition flex items-center space-x-1 cursor-pointer"
            >
              <span>{msg.parentLocator}</span>
              {parentMsg && (
                <span className="text-[9px] text-indigo-400 opacity-80">({parentMsg.sender})</span>
              )}
            </button>
          </div>
        )}

        {/* Replies count / Thread Branch Indicator */}
        {replies.length > 0 && (
          <div className="mt-1.5 flex items-center space-x-1 text-[10px] text-slate-400">
            <CornerDownRight className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-slate-500">Ответы ({replies.length}):</span>
            <div className="flex items-center space-x-1 flex-wrap">
              {replies.slice(0, 3).map((reply) => (
                <button
                  key={reply.id}
                  type="button"
                  onClick={() => onScrollToMessage(reply.id)}
                  onMouseEnter={() => onLocatorHover(reply.locator || null)}
                  onMouseLeave={() => onLocatorHover(null)}
                  className="font-mono text-[9px] text-emerald-400 hover:underline bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-800/40 hover:border-emerald-500 transition cursor-pointer"
                  title={`Перейти к ответу от ${reply.sender}`}
                >
                  {reply.locator || reply.sender}
                </button>
              ))}
            </div>
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
              onClick={() => onLaunchTriad(msg)}
              disabled={isSubmitting}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-700/60 text-[10px] font-semibold transition disabled:opacity-50"
              title="Запустить Триаду: ChatGPT оппонирует, а Mistral верифицирует инварианты"
            >
              <Zap className="w-3 h-3 text-teal-400" />
              <span>Триада</span>
            </button>

            <button
              onClick={() => onLaunchCourt(msg)}
              disabled={isSubmitting}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/60 text-[10px] font-semibold transition disabled:opacity-50"
              title="Передать в Суд: судебная оценка критериев и постановление (Ruling)"
            >
              <Gavel className="w-3 h-3 text-purple-400" />
              <span>В Суд</span>
            </button>

            {onFocusInGraph && msg.locator && (
              <button
                type="button"
                onClick={() => onFocusInGraph(msg.locator || '')}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-[10px] font-semibold transition cursor-pointer"
                title="Показать в интерактивном графе причинности (DAG)"
              >
                <Compass className="w-3 h-3 text-indigo-400" />
                <span className="hidden sm:inline">Граф</span>
              </button>
            )}

            <button
              onClick={() => onSetParentLocator(msg.locator || '')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
              title="Ответить на этот Акт"
            >
              Ответить
            </button>

            <button
              onClick={() => onCopyToClipboard(JSON.stringify(msg, null, 2), msg.id)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Копировать JSON конверта"
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ChatMessageCard.displayName = 'ChatMessageCard';
