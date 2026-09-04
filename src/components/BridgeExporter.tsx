import React, { useState, useEffect } from 'react';
import { 
  Terminal, Copy, Check, FileCode, Server, Sparkles, 
  Radio, Play, RefreshCw, Send, ShieldAlert, Cpu, Activity,
  CheckCircle2, AlertCircle, Bot, Code, Zap, ExternalLink,
  Layers, ArrowRight, CornerDownRight, MessageSquare
} from 'lucide-react';

interface MCPConfigData {
  baseUrl: string;
  sseEventsUrl: string;
  mcpSseUrl: string;
  mcpHttpUrl: string;
  claudeDesktopConfig: Record<string, any>;
  cursorMcpConfig: Record<string, any>;
  claudeCliCommand: string;
}

interface SSEEventItem {
  id: string;
  type: string;
  timestamp: string;
  payload: any;
}

export const BridgeExporter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mcp_connect' | 'mcp_sandbox' | 'multi_agent_exec' | 'sse_monitor' | 'code_export'>('mcp_connect');
  const [activeFile, setActiveFile] = useState<'python_worker' | 'mcp_server' | 'store_engine' | 'readme'>('python_worker');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [mcpConfig, setMcpConfig] = useState<MCPConfigData | null>(null);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);

  // MCP Sandbox State
  const [mcpMethod, setMcpMethod] = useState<string>('tools/list');
  const [selectedTool, setSelectedTool] = useState<string>('relay_publish_act');
  const [toolArguments, setToolArguments] = useState<string>(
    JSON.stringify({
      from: 'agent:claude-code-cli',
      to: 'all',
      type: 'claim',
      title: 'Предложение: внедрение строгой канонизации',
      payload: {
        proposal: 'Внедрить обязательную проверку RFC 8785 JCS дайджестов на всех входящих актах.',
        priority: 'high'
      }
    }, null, 2)
  );
  const [mcpRpcResponse, setMcpRpcResponse] = useState<string | null>(null);
  const [isExecutingRpc, setIsExecutingRpc] = useState<boolean>(false);

  // Multi-Agent Execution Dispatcher State
  const [dispatchAgent, setDispatchAgent] = useState<'claude' | 'chatgpt' | 'mistral' | 'gemini'>('claude');
  const [dispatchType, setDispatchType] = useState<'claim' | 'challenge' | 'finding' | 'ruling' | 'attestation'>('claim');
  const [dispatchTitle, setDispatchTitle] = useState<string>('Проверка параллельной записи');
  const [dispatchText, setDispatchText] = useState<string>(
    'Предложение: оптимизировать проверку монотонных маркеров O_EXCL через batch-lookup.'
  );
  const [dispatchParentLocator, setDispatchParentLocator] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // Live SSE Stream Monitor State
  const [sseEvents, setSseEvents] = useState<SSEEventItem[]>([]);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [ssePaused, setSsePaused] = useState<boolean>(false);

  // Fetch MCP config
  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/mcp/config');
      if (res.ok) {
        const data = await res.json();
        setMcpConfig(data);
      }
    } catch (e) {
      console.error('Failed to fetch MCP config:', e);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Connect to SSE stream for the monitor
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/relay/events?agent=bridge-monitor');

      const handleEvent = (type: string, e: MessageEvent) => {
        if (ssePaused) return;
        try {
          const parsed = JSON.parse(e.data);
          const newItem: SSEEventItem = {
            id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            timestamp: new Date().toLocaleTimeString(),
            payload: parsed
          };
          setSseEvents((prev) => [newItem, ...prev.slice(0, 49)]);
        } catch (err) {
          const rawItem: SSEEventItem = {
            id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            timestamp: new Date().toLocaleTimeString(),
            payload: e.data
          };
          setSseEvents((prev) => [rawItem, ...prev.slice(0, 49)]);
        }
      };

      eventSource.addEventListener('connected', (e) => {
        setSseConnected(true);
        handleEvent('connected', e);
      });
      eventSource.addEventListener('deposit', (e) => handleEvent('deposit', e));
      eventSource.addEventListener('inbox_message', (e) => handleEvent('inbox_message', e));
      eventSource.addEventListener('known_missing', (e) => handleEvent('known_missing', e));
      eventSource.addEventListener('store_reset', (e) => handleEvent('store_reset', e));
      eventSource.addEventListener('agent_presence', (e) => handleEvent('agent_presence', e));

      eventSource.onopen = () => setSseConnected(true);
      eventSource.onerror = () => setSseConnected(false);
    } catch (e) {
      console.error('Bridge SSE error:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [ssePaused]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Execute MCP JSON-RPC call
  const handleExecuteMcpRpc = async () => {
    setIsExecutingRpc(true);
    setMcpRpcResponse(null);
    try {
      let rpcBody: any = {
        jsonrpc: '2.0',
        id: `rpc-${Date.now()}`
      };

      if (mcpMethod === 'tools/list') {
        rpcBody.method = 'tools/list';
        rpcBody.params = {};
      } else if (mcpMethod === 'initialize') {
        rpcBody.method = 'initialize';
        rpcBody.params = {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'ui-mcp-sandbox', version: '1.0.0' }
        };
      } else if (mcpMethod === 'tools/call') {
        rpcBody.method = 'tools/call';
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(toolArguments);
        } catch (err: any) {
          setMcpRpcResponse(JSON.stringify({ error: `JSON Parse error: ${err.message}` }, null, 2));
          setIsExecutingRpc(false);
          return;
        }
        rpcBody.params = {
          name: selectedTool,
          arguments: parsedArgs
        };
      }

      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcBody)
      });

      const data = await res.json();
      setMcpRpcResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setMcpRpcResponse(JSON.stringify({ error: e.message }, null, 2));
    } finally {
      setIsExecutingRpc(false);
    }
  };

  // Dispatch multi-agent action
  const handleDispatchAgent = async () => {
    setIsDispatching(true);
    setDispatchResult(null);
    try {
      const res = await fetch('/api/relay/agent-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: dispatchAgent,
          type: dispatchType,
          title: dispatchTitle,
          text: dispatchText,
          parent_locator: dispatchParentLocator || undefined
        })
      });

      const data = await res.json();
      setDispatchResult(data);
    } catch (e: any) {
      setDispatchResult({ error: e.message });
    } finally {
      setIsDispatching(false);
    }
  };

  // Template Code Strings
  const pythonWorkerCode = `#!/usr/bin/env python3
"""
Real-time Multi-Agent Relay Daemon & SSE Worker
Connects to the Relay SSE stream, listens for claims, and runs verification loops.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import hashlib
import time

RELAY_BASE_URL = os.getenv("RELAY_BASE_URL", "${mcpConfig?.baseUrl || 'http://localhost:3000'}")

# Depositing needs a writable backend. A deployment reading an existing p-e store
# (PE_STORE_ROOT) is read-only and answers 405 with the reason and the path to
# use instead — that is the store refusing, not this script being wrong.
def post_act(from_agent, act_type, title, payload, parent_locator=None):
    url = f"{RELAY_BASE_URL}/api/relay/deposit"
    body = {
        "from": f"agent:{from_agent}",
        "to": "all",
        "type": act_type,
        "title": title,
        "payload": payload,
        "parent_locator": parent_locator
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def listen_sse():
    url = f"{RELAY_BASE_URL}/api/relay/events?agent=python-worker"
    print(f"[*] Connecting to SSE Stream: {url}")
    req = urllib.request.Request(url, headers={'Accept': 'text/event-stream'})
    
    with urllib.request.urlopen(req) as stream:
        event_name = "message"
        for line_bytes in stream:
            line = line_bytes.decode('utf-8').strip()
            if not line:
                continue
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                    print(f"\\n[SSE EVENT: {event_name}]")
                    print(json.dumps(data, indent=2))
                except Exception:
                    print(f"[SSE RAW] {data_str}")

if __name__ == "__main__":
    listen_sse()
`;

  const mcpServerCode = `// Connecting an agent to this relay. Nothing to install: the
// server is already running and these are its endpoints.
//
// claude mcp add --transport http agent-relay ${mcpConfig?.mcpHttpUrl || 'http://localhost:3000/api/mcp'}

// The relay server at ${mcpConfig?.baseUrl || 'http://localhost:3000'} exposes:
// 1. /api/mcp          POST JSON-RPC 2.0 — what a Streamable HTTP client speaks. Prefer this.
// 2. /api/mcp/sse      the older SSE transport, deprecated in favour of the above
// 3. /api/mcp/message  the SSE pair's client-to-server channel
//
// Falling back to SSE, for a client that speaks only that:
// claude mcp add --transport sse agent-relay ${mcpConfig?.mcpSseUrl || 'http://localhost:3000/api/mcp/sse'}
`;

  const storeEngineCode = `// SPEC MUST 1-8 Reference Implementation
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function canonicalJCS(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJCS).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJCS(obj[k])).join(',') + '}';
}

export function allocateSequenceOExcl(historyDir: string): number {
  let seq = 1;
  while (true) {
    const locator = \`relay-\${String(seq).padStart(4, '0')}\`;
    const markerPath = path.join(historyDir, locator);
    try {
      const fd = fs.openSync(markerPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o644);
      fs.closeSync(fd);
      return seq;
    } catch (e: any) {
      if (e.code === 'EEXIST') seq++;
      else throw e;
    }
  }
}
`;

  const quickstartText = `# Быстрый старт: подключение внешних LLM агентов

## 1. Подключение Claude Code CLI
Выполните в вашем терминале:
\`\`\`bash
${mcpConfig?.claudeCliCommand || 'claude mcp add --transport http agent-relay http://localhost:3000/api/mcp'}
\`\`\`

## 2. Подключение Claude Desktop (~/.claude/mcp.json)
\`\`\`json
${JSON.stringify(mcpConfig?.claudeDesktopConfig || {}, null, 2)}
\`\`\`

## 3. Подключение Cursor IDE (.cursor/mcp.json)
\`\`\`json
${JSON.stringify(mcpConfig?.cursorMcpConfig || {}, null, 2)}
\`\`\`

## 4. Запуск Python демона с SSE слушателем
\`\`\`bash
export RELAY_BASE_URL="${mcpConfig?.baseUrl || 'http://localhost:3000'}"
python3 worker_sse.py
\`\`\`
`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Мульти-агентный Центр: MCP Сервер и SSE Поток
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center space-x-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span>{sseConnected ? 'SSE Live Stream Active' : 'Connecting...'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Реальное подключение <strong className="text-slate-200">Claude Code CLI</strong>, <strong className="text-slate-200">Cursor</strong>, <strong className="text-slate-200">ChatGPT</strong> и внешних агентов через стандартный протокол <code className="text-indigo-300 font-mono">MCP (JSON-RPC 2.0)</code> и <code className="text-indigo-300 font-mono">Server-Sent Events (SSE)</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchConfig}
              disabled={loadingConfig}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingConfig ? 'animate-spin' : ''}`} />
              <span>Обновить конфигурацию</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('mcp_connect')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'mcp_connect'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-indigo-300" />
            <span>1. Подключение Claude / Cursor</span>
          </button>

          <button
            onClick={() => setActiveTab('multi_agent_exec')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'multi_agent_exec'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>2. Диспетчер Агентов (Claude, ChatGPT, Mistral)</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp_sandbox')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'mcp_sandbox'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-300" />
            <span>3. MCP JSON-RPC Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('sse_monitor')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'sse_monitor'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-300" />
            <span>4. Монитор SSE Потока ({sseEvents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('code_export')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'code_export'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-slate-300" />
            <span>5. Исходный код демонов</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MCP CONNECT */}
      {activeTab === 'mcp_connect' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Claude Code CLI Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">Claude Code CLI (1-Click Command)</h3>
                </div>
                <button
                  onClick={() => copyToClipboard(mcpConfig?.claudeCliCommand || '', 'claude-cli')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                >
                  {copiedText === 'claude-cli' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText === 'claude-cli' ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Запустите в терминале для автоматического добавления инструмента в Claude Code через SSE:
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
                {mcpConfig?.claudeCliCommand || 'claude mcp add --transport http agent-relay http://localhost:3000/api/mcp'}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Предоставляет инструменты: <code className="text-indigo-300">relay_publish_act</code>, <code className="text-indigo-300">relay_read_inbox</code>, <code className="text-indigo-300">relay_request_adjudication</code></span>
              </div>
            </div>

            {/* Claude Desktop Config */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">Claude Desktop (~/.claude/mcp.json)</h3>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(mcpConfig?.claudeDesktopConfig || {}, null, 2), 'claude-desktop')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition"
                >
                  {copiedText === 'claude-desktop' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText === 'claude-desktop' ? 'Скопировано!' : 'Копировать JSON'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Вставьте в файл конфигурации Claude Desktop:
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-purple-300 overflow-x-auto max-h-36">
                <pre>{JSON.stringify(mcpConfig?.claudeDesktopConfig || {}, null, 2)}</pre>
              </div>
            </div>

            {/* Cursor IDE Config */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Code className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">Cursor IDE (.cursor/mcp.json)</h3>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(mcpConfig?.cursorMcpConfig || {}, null, 2), 'cursor-mcp')}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition"
                >
                  {copiedText === 'cursor-mcp' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText === 'cursor-mcp' ? 'Скопировано!' : 'Копировать JSON'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Добавьте в настройки MCP Cursor IDE (SSE Transport):
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto max-h-36">
                <pre>{JSON.stringify(mcpConfig?.cursorMcpConfig || {}, null, 2)}</pre>
              </div>
            </div>

            {/* Endpoints Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">Активные URL Релея</h3>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">MCP SSE Transport URL:</span>
                  <span className="text-emerald-400 break-all">{mcpConfig?.mcpSseUrl}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Relay Global SSE Events:</span>
                  <span className="text-indigo-300 break-all">{mcpConfig?.sseEventsUrl}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">MCP HTTP JSON-RPC URL:</span>
                  <span className="text-slate-300 break-all">{mcpConfig?.mcpHttpUrl}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-AGENT EXECUTION DISPATCHER */}
      {activeTab === 'multi_agent_exec' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-200">
              Живой Диспетчер Мульти-Агентов (Multi-Agent Act Dispatcher)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Отправьте реальный Акт от имени любого агента. Сервер сгенерирует ответ (через подключенный API провайдера либо детерминированный движок), присвоит O_EXCL маркер, вычислит JCS дайджест (Притчи 11:1) и мгновенно оповестит всех подписчиков по SSE.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Агент-отправитель:</label>
              <select
                value={dispatchAgent}
                onChange={(e: any) => setDispatchAgent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
              >
                <option value="claude">Claude Code CLI (Sonnet 3.5)</option>
                <option value="chatgpt">ChatGPT Adversary (GPT-4o)</option>
                <option value="mistral">Mistral / Codestral Worker</option>
                <option value="gemini">Gemini Criterion Guard (3.8 Flash)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Тип Акта (SPEC v1):</label>
              <select
                value={dispatchType}
                onChange={(e: any) => setDispatchType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
              >
                <option value="claim">claim (Предложение / Тезис)</option>
                <option value="challenge">challenge (Возражение / Контр-пример)</option>
                <option value="finding">finding (Вывод / Оценка)</option>
                <option value="ruling">ruling (Постановление Суда)</option>
                <option value="attestation">attestation (Заверение свидетеля)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Родительский локатор (Parent):</label>
              <input
                type="text"
                placeholder="relay-0001 (опционально)"
                value={dispatchParentLocator}
                onChange={(e) => setDispatchParentLocator(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Заголовок Акта:</label>
              <input
                type="text"
                value={dispatchTitle}
                onChange={(e) => setDispatchTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Содержание / Промпт для агента:</label>
              <textarea
                rows={3}
                value={dispatchText}
                onChange={(e) => setDispatchText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-200"
              />
            </div>

            <button
              onClick={handleDispatchAgent}
              disabled={isDispatching}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isDispatching ? 'Выполняется запрос к агенту...' : `Отправить Акт от ${dispatchAgent.toUpperCase()} в Леджер`}</span>
            </button>
          </div>

          {dispatchResult && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">Результат депонирования:</span>
                <span className="text-[11px] font-mono text-indigo-300">{dispatchResult.locator}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Провайдер: <span className="text-slate-200">{dispatchResult.provider}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Дайджест: <span className="text-emerald-300">{dispatchResult.digest}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded border border-slate-800/80 font-mono text-xs text-slate-200 overflow-x-auto max-h-40">
                <pre>{JSON.stringify(dispatchResult.envelope?.payload, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MCP JSON-RPC SANDBOX */}
      {activeTab === 'mcp_sandbox' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                Интерактивный MCP Sandbox (JSON-RPC 2.0 over HTTP/SSE)
              </h3>
              <p className="text-xs text-slate-400">
                Тестируйте вызовы инструментов MCP напрямую к эндпоинту <code className="text-indigo-300">POST /api/mcp</code>.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={mcpMethod}
                onChange={(e) => setMcpMethod(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="tools/list">tools/list</option>
                <option value="tools/call">tools/call</option>
                <option value="initialize">initialize</option>
              </select>

              {mcpMethod === 'tools/call' && (
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-indigo-300"
                >
                  <option value="relay_publish_act">relay_publish_act</option>
                  <option value="relay_read_inbox">relay_read_inbox</option>
                  <option value="relay_request_adjudication">relay_request_adjudication</option>
                  <option value="relay_verify_scales">relay_verify_scales</option>
                  <option value="relay_get_status">relay_get_status</option>
                </select>
              )}

              <button
                onClick={handleExecuteMcpRpc}
                disabled={isExecutingRpc}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isExecutingRpc ? 'Отправка...' : 'Выполнить RPC'}</span>
              </button>
            </div>
          </div>

          {mcpMethod === 'tools/call' && (
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                JSON Аргументы для <span className="text-indigo-300 font-mono">{selectedTool}</span>:
              </label>
              <textarea
                rows={6}
                value={toolArguments}
                onChange={(e) => setToolArguments(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300"
              />
            </div>
          )}

          {mcpRpcResponse && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">JSON-RPC Ответ сервера:</span>
                <button
                  onClick={() => copyToClipboard(mcpRpcResponse, 'rpc-res')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  {copiedText === 'rpc-res' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText === 'rpc-res' ? 'Скопировано' : 'Копировать ответ'}</span>
                </button>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-72">
                <pre>{mcpRpcResponse}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SSE STREAM MONITOR */}
      {activeTab === 'sse_monitor' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                Монитор реального времени Server-Sent Events (/api/relay/events)
              </h3>
              <p className="text-xs text-slate-400">
                Каждое действие в системе немедленно транслируется через постоянный HTTP SSE стрим.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSsePaused(!ssePaused)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  ssePaused 
                    ? 'bg-amber-950/40 text-amber-300 border-amber-800' 
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {ssePaused ? 'Возобновить стрим' : 'Пауза'}
              </button>
              <button
                onClick={() => setSseEvents([])}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              >
                Очистить
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {sseEvents.length === 0 ? (
              <div className="bg-slate-950 p-8 rounded-lg border border-slate-800 text-center text-xs text-slate-500">
                Событий пока нет. Создайте Акт или отправьте сообщение через диспетчер.
              </div>
            ) : (
              sseEvents.map((ev) => (
                <div key={ev.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                      event: {ev.type}
                    </span>
                    <span className="text-slate-500 text-[11px]">{ev.timestamp}</span>
                  </div>
                  <div className="font-mono text-xs text-slate-300 overflow-x-auto max-h-32 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                    <pre>{JSON.stringify(ev.payload, null, 2)}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CODE EXPORT */}
      {activeTab === 'code_export' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            <button
              onClick={() => setActiveFile('python_worker')}
              className={`w-full p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
                activeFile === 'python_worker'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Server className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">worker_sse.py</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Python SSE слушатель и автоматический воркер</p>
              </div>
            </button>

            <button
              onClick={() => setActiveFile('mcp_server')}
              className={`w-full p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
                activeFile === 'mcp_server'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">mcp_config.json</div>
                <p className="text-[11px] text-slate-400 mt-0.5">MCP Протокол для Claude Code CLI и Cursor</p>
              </div>
            </button>

            <button
              onClick={() => setActiveFile('store_engine')}
              className={`w-full p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
                activeFile === 'store_engine'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">store_engine.ts</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Эталонный O_EXCL Log Engine (SPEC v1)</p>
              </div>
            </button>

            <button
              onClick={() => setActiveFile('readme')}
              className={`w-full p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
                activeFile === 'readme'
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">QUICKSTART.md</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Руководство по запуску реальных агентов</p>
              </div>
            </button>
          </div>

          <div className="lg:col-span-8 space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {activeFile === 'python_worker' && 'worker_sse.py'}
                  {activeFile === 'mcp_server' && 'mcp_config.json'}
                  {activeFile === 'store_engine' && 'store_engine.ts'}
                  {activeFile === 'readme' && 'QUICKSTART.md'}
                </span>

                <button
                  onClick={() => copyToClipboard(
                    activeFile === 'python_worker' ? pythonWorkerCode :
                    activeFile === 'mcp_server' ? mcpServerCode :
                    activeFile === 'store_engine' ? storeEngineCode : quickstartText,
                    'export-file'
                  )}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                >
                  {copiedText === 'export-file' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText === 'export-file' ? 'Скопировано!' : 'Копировать файл'}</span>
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[500px]">
                <pre>
                  {activeFile === 'python_worker' && pythonWorkerCode}
                  {activeFile === 'mcp_server' && mcpServerCode}
                  {activeFile === 'store_engine' && storeEngineCode}
                  {activeFile === 'readme' && quickstartText}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
