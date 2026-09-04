import React, { useState } from 'react';
import { 
  Scale, Sparkles, Binary, ShieldAlert, Terminal, 
  BookOpen, Radio, MessageSquare, Menu, X, ShieldQuestion 
} from 'lucide-react';

export type TabType = 'chat' | 'live_relay' | 'workbench' | 'rosetta' | 'envelope' | 'sandbox' | 'bridge' | 'attest';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * VISIBLE_TABS is the whole edit. Every tab below still exists, still routes,
   * and still renders — this list decides which reach the header.
   *
   * `chat` is out for this deployment rather than for good. It calls
   * `/api/relay/agent-exec` six times and `/api/relay/adjudicate` once, and both
   * answer 503 here because model calls are opt-in and this process holds no
   * keys; it also deposits, which the p-e store refuses because it is
   * append-only and written through its own guarded path. A "Live" badge over a
   * feature that returns errors in every direction is worse than an absent tab.
   *
   * The right fix is to make it say so — agents connect INWARD over /api/mcp
   * carrying their own credentials — and then it comes back.
   */
  const VISIBLE_TABS: TabType[] = ['attest', 'live_relay', 'bridge'];

  const allNavItems: { id: TabType; shortLabel: string; fullLabel: string; icon: React.ReactNode; badge?: string; badgeColor?: string }[] = [
    { 
      id: 'attest', 
      shortLabel: 'Hand', 
      fullLabel: 'Whose hand', 
      icon: <ShieldQuestion className="w-4 h-4 text-rose-400 shrink-0" />,
      badge: 'WebMCP',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    { 
      id: 'live_relay', 
      shortLabel: 'Ledger', 
      fullLabel: 'Relay ledger', 
      icon: <Radio className="w-4 h-4 text-emerald-400 shrink-0" />, 
      badge: 'LIVE',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    { 
      id: 'bridge', 
      shortLabel: 'MCP', 
      fullLabel: 'Bridges & MCP', 
      icon: <Terminal className="w-4 h-4 text-cyan-400 shrink-0" /> 
    },
    { 
      id: 'chat', 
      shortLabel: 'Chat', 
      fullLabel: 'Agent chat', 
      icon: <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
    },
    { 
      id: 'workbench', 
      shortLabel: 'Court', 
      fullLabel: 'Adjudication', 
      icon: <Scale className="w-4 h-4 text-purple-400 shrink-0" />
    },
    { 
      id: 'rosetta', 
      shortLabel: 'Rosetta', 
      fullLabel: 'Rosetta matrix', 
      icon: <BookOpen className="w-4 h-4 text-blue-400 shrink-0" /> 
    },
    { 
      id: 'envelope', 
      shortLabel: 'Scales', 
      fullLabel: 'Scales & RFC 8785', 
      icon: <Binary className="w-4 h-4 text-amber-400 shrink-0" /> 
    },
    { 
      id: 'sandbox', 
      shortLabel: 'Sandbox', 
      fullLabel: 'Failure sandbox', 
      icon: <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" /> 
    },
  ];

  const navItems = allNavItems.filter((item) => VISIBLE_TABS.includes(item.id));

  return (
    <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800 sticky top-0 z-40 w-full overflow-hidden shrink-0">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-12 sm:h-13 gap-2">
          {/* Logo & Title */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-100 tracking-tight text-xs sm:text-sm">
                  Agent Relay
                </span>
                <span className="px-1 py-0.2 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded shrink-0">
                  v1 Spec
                </span>
              </div>
              <span className="text-[9px] text-slate-400 hidden xl:inline">
                Prov 18:17 · JCS 8785 · O_EXCL
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links (No scrollbar, auto-fitted) */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-btn-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                  title={item.fullLabel}
                >
                  {item.icon}
                  <span className="hidden xl:inline">{item.fullLabel}</span>
                  <span className="inline xl:hidden">{item.shortLabel}</span>
                  {item.badge && (
                    <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                      isActive ? 'bg-indigo-700 text-indigo-100 border-indigo-500/50' : (item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700')
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Tablet & Small Desktop Navigation (Compact items) */}
          <nav className="hidden md:flex lg:hidden items-center space-x-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                  title={item.fullLabel}
                >
                  {item.icon}
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-slate-900 pb-3">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`mobile-nav-btn-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold transition text-left ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-300 bg-slate-950/60 hover:bg-slate-800 border border-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.fullLabel}</span>
                  {item.badge && (
                    <span className="ml-auto text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
