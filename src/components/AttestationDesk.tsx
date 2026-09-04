import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Bot, Hand, Plug, PlugZap, RefreshCw } from 'lucide-react';
import { registerRelayTools, webmcpAvailable, postAct } from '../lib/webmcp';

type Via = 'webmcp-tool' | 'ui-synthetic' | 'ui-trusted';

interface Act {
  id: string;
  seq: number;
  ts: string;
  kind: 'note' | 'proposal' | 'approval';
  text: string | null;
  target: string | null;
  via: Via;
  distinguishes_hands: boolean;
  basis: string;
  digest: string;
}

const VIA_STYLE: Record<Via, { label: string; icon: React.ReactNode; cls: string }> = {
  'webmcp-tool': {
    label: 'agent · tool path',
    icon: <Bot className="w-3.5 h-3.5" />,
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  'ui-synthetic': {
    label: 'script · not a human',
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  'ui-trusted': {
    label: 'unknown hand',
    icon: <ShieldQuestion className="w-3.5 h-3.5" />,
    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  }
};

/**
 * `isTrusted` is the page's only checkable signal, and it separates a scripted
 * click from a real input event — not a person from an agent. An agent driving
 * the browser through automation injects input that arrives trusted, which is
 * precisely webmcp#288.
 */
const viaFromEvent = (event: React.SyntheticEvent): Via =>
  event.nativeEvent.isTrusted ? 'ui-trusted' : 'ui-synthetic';

export const AttestationDesk: React.FC = () => {
  const [acts, setActs] = useState<Act[]>([]);
  const [pending, setPending] = useState<Act[]>([]);
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/attest/acts');
      const data = await res.json();
      setActs(data.acts ?? []);
      setPending(data.pending ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const controller = new AbortController();
    registerRelayTools({ signal: controller.signal, onChange: load })
      .then(setToolCount)
      .catch(() => setToolCount(0));
    return () => controller.abort();
  }, [load]);

  const act = async (body: Parameters<typeof postAct>[0]) => {
    setBusy(true);
    setError(null);
    try {
      await postAct(body);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const available = webmcpAvailable();
  const unknownHands = acts.filter((a) => !a.distinguishes_hands).length;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* ---- what this page is ---- */}
      <header className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-100">Attestation desk</h2>
            <p className="text-sm text-slate-400 max-w-2xl">
              WebMCP lets this page hand tools to your agent. Nothing in a tool call says who used
              them. Every act below records how it arrived — and says so plainly when that is not
              enough to name a hand.
            </p>
          </div>
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-mono shrink-0 ${
              available
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700'
            }`}
          >
            {available ? <PlugZap className="w-3.5 h-3.5" /> : <Plug className="w-3.5 h-3.5" />}
            {available ? `${toolCount ?? '…'} tools registered` : 'no WebMCP in this browser'}
          </div>
        </div>

        {!available && (
          <p className="text-xs text-slate-500 border-t border-slate-800 pt-3">
            Open this in ChatGPT's in-app browser, or Chrome with{' '}
            <code className="text-slate-400">chrome://flags/#enable-webmcp-testing</code>. The page
            works without it; the tool path simply has no caller.
          </p>
        )}
      </header>

      {/* ---- the three verdicts, stated before anything uses them ---- */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/70">
        {(Object.keys(VIA_STYLE) as Via[]).map((via) => (
          <div key={via} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <code className="text-xs text-slate-300 font-mono sm:w-40 shrink-0">{via}</code>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium w-fit ${VIA_STYLE[via].cls}`}
            >
              {VIA_STYLE[via].icon}
              {VIA_STYLE[via].label}
            </span>
            <p className="text-xs text-slate-400 flex-1">
              {via === 'webmcp-tool' &&
                'The page reports that document.modelContext dispatched it. An agent cannot produce this value. Any script in this origin can, since execute() is a callback the page authored.'}
              {via === 'ui-synthetic' &&
                'Event.isTrusted was false. A scripted click, and detectably not a person.'}
              {via === 'ui-trusted' &&
                'Event.isTrusted was true. The human, or an agent driving the browser. No party can tell — this is webmcp#288.'}
            </p>
          </div>
        ))}
      </section>

      {/* ---- do something ---- */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Propose an act</h3>
          <p className="text-xs text-slate-500">
            A proposal is recorded and not executed. Your agent can make one with{' '}
            <code className="text-slate-400">propose_act</code>; you can make one here.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Roll the deployment forward to build 4471."
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y"
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={(e) => {
              const via = viaFromEvent(e);
              act({ kind: 'proposal', text: draft.trim(), via }).then(() => setDraft(''));
            }}
            className="self-start px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            Record proposal
          </button>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Awaiting approval
            <span className="ml-2 text-xs font-normal text-slate-500">{pending.length} pending</span>
          </h3>
          {pending.length === 0 && (
            <p className="text-xs text-slate-500">Nothing pending. Propose something first.</p>
          )}
          <ul className="flex flex-col gap-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="border border-slate-800 rounded-md p-3 flex flex-col gap-2 bg-slate-950/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-300 break-words">{p.text}</p>
                  <code className="text-[11px] text-slate-500 font-mono shrink-0">{p.id}</code>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={(e) => act({ kind: 'approval', target: p.id, via: viaFromEvent(e) })}
                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-40 transition-colors"
                >
                  <Hand className="w-3.5 h-3.5" />
                  Approve
                </button>
                <p className="text-[11px] text-slate-500">
                  Approving here records an unknown hand. Ask your agent for{' '}
                  <code className="text-slate-400">approve_proposal</code> and the record names it.
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {error && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* ---- the log ---- */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200">
            Attestation log
            <span className="ml-2 text-xs font-normal text-slate-500">
              {acts.length} acts · {unknownHands} with an unknown hand
            </span>
          </h3>
          <button
            type="button"
            onClick={load}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Reload the log"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {acts.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-500">Empty. Nothing has been recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {[...acts].reverse().map((a) => {
              const style = VIA_STYLE[a.via];
              return (
                <li key={a.id} className="px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-[11px] text-slate-500 font-mono">{a.id}</code>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">{a.kind}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${style.cls}`}
                    >
                      {style.icon}
                      {style.label}
                    </span>
                    {a.target && (
                      <code className="text-[11px] text-slate-500 font-mono">→ {a.target}</code>
                    )}
                  </div>
                  {a.text && <p className="text-sm text-slate-300 break-words">{a.text}</p>}
                  <p className="text-[11px] text-slate-500">{a.basis}</p>
                </li>
              );
            })}
          </ul>
        )}

        <p className="px-4 py-3 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed">
          <ShieldCheck className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
          Every value above is the page's word. The server checks the request origin and nothing else
          about who acted, and records that limit rather than implying a verification it did not
          perform. What would make any of it attestable is a browser-stamped execution context the
          page cannot forge and the agent cannot produce — which WebMCP does not define.
        </p>
      </section>
    </div>
  );
};
