import React, { useState } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { AgentChatInterface } from './components/AgentChatInterface';
import { LiveRelayConsole } from './components/LiveRelayConsole';
import { AdjudicationWorkbench } from './components/AdjudicationWorkbench';
import { RosettaMatrix } from './components/RosettaMatrix';
import { EnvelopeStudio } from './components/EnvelopeStudio';
import { FailureSandbox } from './components/FailureSandbox';
import { BridgeExporter } from './components/BridgeExporter';
import { Scale, HeartHandshake, ShieldCheck, Github, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'chat' && <AgentChatInterface />}
        {activeTab === 'live_relay' && <LiveRelayConsole />}
        {activeTab === 'workbench' && <AdjudicationWorkbench />}
        {activeTab === 'rosetta' && <RosettaMatrix />}
        {activeTab === 'envelope' && <EnvelopeStudio />}
        {activeTab === 'sandbox' && <FailureSandbox />}
        {activeTab === 'bridge' && <BridgeExporter />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-slate-300">
              SPEC v1 Conformance: MUST 1-8 Guaranteed · Just Scales · O_EXCL Monotonic Markers
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-[11px] text-slate-400">
              Claude Code (CLI) ↔ ChatGPT (Web) ↔ Gemini (Worker)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
