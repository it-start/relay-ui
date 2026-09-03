# Agent Relay & Adjudication Protocol (v1.0-SPEC)

[![Specification](https://img.shields.io/badge/Spec-Proverbs_18%3A17-indigo.svg)](https://github.com)
[![Canonicalization](https://img.shields.io/badge/JCS-RFC_8785-emerald.svg)](https://datatracker.ietf.org/doc/html/rfc8785)
[![Storage Invariant](https://img.shields.io/badge/Atomic-O_CREAT_%7C_O_EXCL-cyan.svg)](https://man7.org/linux/man-pages/man2/open.2.html)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

An industrial-grade, leaderless, multi-agent synchronization and dispute resolution protocol designed for autonomous LLM swarms (Claude, GPT-4o, Gemini, Mistral, and Human Architects).

Built upon canonical cryptographic digests (**RFC 8785 / Proverbs 11:1**), causal monotonicity (**Hybrid Logical Clocks / HLC**), atomic lock-free append ledgers (**POSIX `O_CREAT | O_EXCL`**), and adversarial cross-examination (**Proverbs 18:17 Adjudication Court**).

---

## 🏛️ Core Architectural Invariants (SPEC MUST 1–8)

1. **RFC 8785 JCS Canonicalization (MUST 1)**: Cryptographic SHA-256 digests are computed strictly on recursively sorted JSON keys, IEEE 754-normalized floats, and UTF-8 encoded payloads (*"A false balance is an abomination to the Lord, but a just weight is his delight" — Proverbs 11:1*).
2. **Hybrid Logical Clocks (MUST 2)**: Every envelope carries physical UTC time combined with a monotonic Lamport counter (`physical_ms:counter:node_id`) guaranteeing causal ordering across asynchronous nodes without NTP drift failure.
3. **Atomic Slot Allocation via `O_CREAT | O_EXCL` (MUST 3)**: Concurrent write races are resolved at the kernel filesystem level. If two agents attempt to claim the same sequence slot `seq: N`, the collision returns `EEXIST`, forcing the loser to increment `seq` monotonically.
4. **Adversarial Triad & Adjudication (MUST 4)**: No claim is ratified without adversarial cross-examination (*"The one who states his case first seems right, until the other comes and examines him" — Proverbs 18:17*).
5. **Zero Implicit Trust (MUST 5)**: Inter-agent envelopes must be verifiable offline and independently validated across different toolchains (TypeScript, Python, Rust, Go).
6. **Known-Missing Retention (MUST 6)**: When an envelope payload is purged/compacted or lost, the ledger retains its sequence slot, locator, and SHA-256 digest with status `MISSING` to prevent phantom slot re-use.
7. **Cross-Platform Rosetta Compatibility (MUST 7)**: Exact wire compatibility across JSON, YAML, Protocol Buffers, FlatBuffers, and MCP (Model Context Protocol).
8. **Real-time SSE & File Bus Streaming (MUST 8)**: Sub-millisecond reactive subscriptions via Server-Sent Events (SSE) and POSIX file watchers.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (the scripts run under it; this is what the hosting container has)
- Bun 1.1+ optional — a faster installer and runner for the same scripts

### Installation & Run
```bash
# Clone the repository
git clone https://github.com/your-username/agent-relay.git
cd agent-relay

# Install dependencies
npm install          # or: bun install — either produces a tree the other can run

# Start development server (Port 3000)
npm run dev          # or: bun run dev

# Build production bundle
npm run build
npm start
```

Open `http://localhost:3000` to access the full **Interactive Workbench**, **Live Relay Ledger**, and **Autonomous Agent Chat**.

The scripts stay Node-compatible on purpose: this is an AI Studio applet
(`metadata.json`), and the hosting container invokes `npm run build` and
`npm start` in a Node image with no `bun` on `PATH`. Bun is supported as the
installer and as a runner for the same scripts — `bun run build`, `bun run start`
— and `bun.lock` is committed alongside, but nothing in `package.json` requires
the binary.

### Environment

| | |
|---|---|
| `HOST` | Interface to bind. Defaults to `127.0.0.1`. This process authenticates nothing, so anything wider is a deliberate act and belongs behind a reverse proxy that does. |
| `PORT` | Defaults to `3000`. |
| `NODE_ENV` | `production` serves the built client from `dist/`. Anything else starts a Vite dev server, which is not meant to face a network. `bun run start` sets it. |
| `PE_STORE_ROOT` | Read an existing **p-e** relay store instead of this project's own. Read-only: `write`, `delete` and `reset` are declared unavailable and refused with `405`. |
| `ALLOW_SERVER_MODEL_CALLS` | `1` enables the three routes that run models on API keys held by this process — `/api/relay/adjudicate`, `/api/relay/step-triad`, `/api/relay/agent-exec` — none of which has authentication of its own. Off by default. `ALLOW_AGENT_EXEC` is accepted as the former name. |

---

## 📦 Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── AgentChatInterface.tsx    # Multi-agent chat with 1-click Triad & Court
│   │   ├── LiveRelayConsole.tsx      # Real-time ledger, sequencer & SSE observer
│   │   ├── AdjudicationWorkbench.tsx # Court state machine (Proverbs 18:17)
│   │   ├── RosettaMatrix.tsx         # Cross-language wire serializers
│   │   ├── EnvelopeStudio.tsx        # RFC 8785 canonizer & digest generator
│   │   ├── FailureSandbox.tsx        # Chaos injection & invariant stress tests
│   │   ├── BridgeExporter.tsx        # MCP & Tool definitions export
│   │   └── Navbar.tsx                # Responsive top navigation
│   ├── App.tsx                       # Root React 19 application
│   ├── main.tsx                      # Vite React mount point
│   └── index.css                     # Tailwind CSS & theme tokens
├── server.ts                         # Express + Atomic POSIX Store + SSE Hub
├── docs/                             # Architecture specs & Engineering Backlog
│   ├── ARCHITECTURE.md               # In-depth architectural blueprint
│   └── BACKLOG_AND_DEBT.md           # Engineering insights, debt & roadmap
├── metadata.json                     # AI Studio runtime metadata
├── AGENTS.md                         # Context & rules for autonomous AI coding agents
├── CONTRIBUTING.md                   # Contribution guidelines
├── LICENSE                           # MIT License
└── package.json                      # Build scripts & dependency declarations
```

---

## 🛠️ API & Wire Protocol

### Envelope Specification
```json
{
  "seq": 42,
  "locator": "agent:claude/42@2026-09-01T16:45:00.000Z",
  "from": "agent:claude-code",
  "to": "agent:chatgpt-adversary",
  "type": "claim",
  "title": "HLC Monotonic Invariant Proposal",
  "parent_locator": "agent:human/41@2026-09-01T16:44:00.000Z",
  "hlc": "1788281100000:0001:claude",
  "digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "payload": {
    "body": "Proposed RFC 8785 canonical digest validator."
  }
}
```

### Core HTTP Endpoints
- `POST /api/relay/deposit` — Atomically deposit an envelope using `O_CREAT | O_EXCL`
- `GET /api/relay/records` — Fetch current sequence ledger & envelope state
- `GET /api/relay/events` — Real-time Server-Sent Events (SSE) feed
- `POST /api/relay/adjudicate` — Execute Proverbs 18:17 Adjudication verdict via Gemini
- `POST /api/relay/agent-exec` — Autonomous agent reasoning & response dispatcher

---

## 📜 Biblical & Mathematical Foundations
* **Proverbs 11:1**: *"Dishonest scales are an abomination to the LORD, but a just weight is His delight."* — Foundational rule for bit-exact JSON Canonicalization (RFC 8785).
* **Proverbs 18:17**: *"The first to state his case seems right, until another comes and examines him."* — Protocol mandate for adversarial cross-examination prior to ledger ratification.

---

## 📄 License
MIT License. Free for open-source research and enterprise distributed agent deployments.
