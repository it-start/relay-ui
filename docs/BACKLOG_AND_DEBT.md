# Engineering Insights, Backlog, Debt & Roadmap

This document captures deep technical insights, identified technical debt, potential failure vectors, and a prioritized product backlog for the **Agent Relay & Adjudication Protocol**.

---

## 🔍 Part 1: Deep Architectural Insights

### 1.1 Filesystem POSIX `O_EXCL` in Distributed / Cloud Environments
- **Insight**: While `O_CREAT | O_EXCL` works with absolute hardware atomicity on local NVMe / SSD drives, network-attached filesystems (NFSv3, CIFS, older SMB) may exhibit client-side metadata caching issues where `EEXIST` isn't reported synchronously.
- **Recommendation**: For multi-node cloud deployments (Kubernetes, multiple container instances), add an optional CAS storage driver adapter (e.g., S3 Conditional Writes `If-None-Match: *`, DynamoDB conditional puts, or Google Cloud Storage generation preconditions).

### 1.2 HLC Clock Skew Tolerance (NTP Drifts)
- **Insight**: If an agent node's physical clock drifts forward by more than max drift window $\Delta$ (e.g., > 60 seconds), it will artifically pull all future HLC physical components forward.
- **Mitigation**: Implement a drift clamp: reject any incoming envelope whose $l_m > physical\_now + MAX\_CLOCK\_SKEW\_MS$ (e.g. 30,000ms) with `ERR_HLC_FUTURE_SKEW_EXCEEDED`.

### 1.3 LLM Non-Determinism in Adjudication
- **Insight**: Prompt-based adjudication (Court) can produce minor variations across runs.
- **Mitigation**: Structure Court rulings with strict JSON Schema output validation via Gemini structured outputs, caching previous rulings for identical claim hashes.

---

## 📋 Part 2: Product & Technical Backlog

### 🟢 High Priority (P0 — Near-Term Milestones)
- [x] **Interactive Causal DAG / Lamport Graph (Delivered)**: Interactive visual tree / directed acyclic graph (`CausalGraphView.tsx` with D3.js pan/zoom + SVG canvas) rendering causal message chains via `parentLocator` and HLC clocks. Features Sugiyama topological layering, dynamic agent color palettes (Claude, ChatGPT, Gemini, Mistral, Court, Grok, MiMo, Qwen, DeepSeek), ancestor/descendant lineage tracing on hover, two-way sync with virtualized chat stream, and flexible Split/Graph/Chat view modes.
- [ ] **One-Click Invariant Cryptographic Verifier (Audit Replay)**: In-app real-time integrity verification engine validating:
  - Strict SHA-256 digests according to RFC 8785 JSON Canonicalization Scheme (JCS).
  - Monotonic physical/logical increments of Hybrid Logical Clocks ($l_m, c_m$).
  - SPEC MUST 6 adherence (guaranteed retention of `KNOWN_MISSING` markers with original hashes).
  - One-click export of verifiable cryptographic audit certificates (JSON-LD / Attestation).
- [ ] **E2E WebSocket Fallback**: Add native WebSocket / WebTransport bidirectional stream alongside SSE for ultra low-latency bi-directional agent pairing.
- [ ] **Zstandard Payload Compression**: Optional compression layer for payloads > 64KB with digest computed pre-compression according to RFC 8785.
- [ ] **Ed25519 Cryptographic Signatures**: Add real public-key signatures in `envelope.signature` so agents can sign with local private keys (`auth: ed25519:<pubkey>`).
- [ ] **Automated Benchmark Suite & Concurrence Arena**: Microbenchmarking throughput and live visual arena for `O_EXCL` slot contention under 100 concurrent workers showing real-time `EEXIST` collision resolution.

### 🟡 Medium Priority (P1 — Enhancements & Integrations)
- [ ] **MCP (Model Context Protocol) Server Package**: Expose SSE / stdio endpoints conforming to the Model Context Protocol specification (`@agent-relay/mcp-server`), allowing real external CLI agents (Claude Code, Cursor, Windsurf, Ollama) to autonomously poll inboxes, deposit proposals, and challenge claims in the ledger.
- [ ] **Rust Core FFI / WASM Module**: Export the RFC 8785 canonizer and HLC engine as a high-performance WebAssembly module for sub-microsecond parsing.
- [ ] **Multi-Room & Channel Segregation**: Support namespaces/topics (`channel: security-audit`, `channel: pr-review-swarm`) while keeping global sequence causality.
- [ ] **SQLite / RocksDB Embedded Engine Driver**: Alternative atomic storage engine option alongside the flat-file POSIX store.

### 🔵 Low Priority / Experimental (P2)
- [ ] **Zero-Knowledge Proofs (zk-SNARKs)**: Prove envelope inclusion in sequence tree without revealing private business payloads.
- [ ] **Vector Memory Semantic Indexing**: Auto-embed envelope payloads with Gemini Embeddings for similarity lookup across thousands of historic dispute rulings.

---

## 🛠️ Part 3: Known Technical Debt & Refactoring Targets

| Area | Current State | Target State | Severity |
| :--- | :--- | :--- | :--- |
| **Store Cleanup** | Flat `.relay_store` directory without date sharding. | Shard into `.relay_store/YYYY-MM/` or 10k chunk subdirectories to prevent large directory inode scan penalties. | Medium |
| **Agent Exec Mocking** | Simulated fallback heuristics when external LLM API keys are absent. | Clean graceful offline queue with visual banner indicating simulated vs live LLM inference. | Low |
| **SSE Reconnect Sync** | Client re-syncs all records on reconnection. | Client sends `Last-Event-ID: <seq>` to only receive delta logs since disconnection. | Medium |
| **Memory Buffer** | In-memory records cache in `server.ts` grows unbounded. | Implement an LRU memory ring buffer with disk pagination for query endpoints. | Medium |
| **Bundle Size** | Single bundle for workbench components. | Dynamic lazy loading (`React.lazy`) for heavy modules (RosettaMatrix, FailureSandbox). | Low |

---

## 🐛 Part 4: Bug Watchlist & Edge Cases

1. **Browser Tab Sleep State (SSE Stalling)**:
   - *Symptom*: When a background tab wakes up, the EventSource stream might have dropped silently.
   - *Fix*: Implemented heartbeats (`: ping\n\n` every 15s) and automatic client-side ping watchdog.

2. **Extreme Payload Characters**:
   - *Symptom*: Unescaped Unicode control characters in raw string payloads could fail naive regex JSON cleaners.
   - *Fix*: Verified with RFC 8785 recursive UTF-16 code-point sorting and standard `JSON.stringify` escape normalization.
