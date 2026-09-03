import React, { useState } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { AgentChatInterface } from './components/AgentChatInterface';
import { LiveRelayConsole } from './components/LiveRelayConsole';
import { AdjudicationWorkbench } from './components/AdjudicationWorkbench';
import { RosettaMatrix } from './components/RosettaMatrix';
import { EnvelopeStudio } from './components/EnvelopeStudio';
import { FailureSandbox } from './components/FailureSandbox';
import { BridgeExporter } from './components/BridgeExporter';
import { AttestationDesk } from './components/AttestationDesk';
import { Scale, HeartHandshake, ShieldCheck, Github, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  const isChat = activeTab === 'chat';

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation - hidden in focus mode for ultra-compact screens */}
      {!isFocusMode && (
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 overflow-hidden flex flex-col ${isChat ? 'w-full h-full' : 'max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 overflow-y-auto'}`}>
        {activeTab === 'chat' && (
          <AgentChatInterface
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
          />
        )}
        {activeTab === 'live_relay' && <LiveRelayConsole />}
        {activeTab === 'workbench' && <AdjudicationWorkbench />}
        {activeTab === 'rosetta' && <RosettaMatrix />}
        {activeTab === 'envelope' && <EnvelopeStudio />}
        {activeTab === 'sandbox' && <FailureSandbox />}
        {activeTab === 'bridge' && <BridgeExporter />}
        {activeTab === 'attest' && <AttestationDesk />}
      </main>

      {/* Footer - Only shown on documentation / tool tabs, hidden on chat to preserve vertical space */}
      {!isChat && !isFocusMode && (
        <footer className="bg-slate-900/60 border-t border-slate-800/80 py-2.5 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-1.5">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[11px] text-slate-300">
                SPEC v1 Conformance: MUST 1-8 Guaranteed · Just Scales · O_EXCL Monotonic Markers
              </span>
            </div>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400">
              <span>Claude Code ↔ ChatGPT ↔ Gemini ↔ Mistral</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
