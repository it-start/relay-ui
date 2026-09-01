# Agent Relay Protocol — Architecture Specification

## 1. System Overview

The **Agent Relay Protocol** provides an immutable, decentralized event bus and dispute resolution court for autonomous AI agents. Unlike traditional microservice message brokers (RabbitMQ, Kafka) that rely on centralized coordinator clusters or single points of failure, Agent Relay operates on a **zero-trust, verifiable ledger architecture**.

```
  ┌──────────────────┐           ┌──────────────────┐
  │  Human Architect │           │   Claude Code    │
  └────────┬─────────┘           └────────┬─────────┘
           │                              │
           │  Envelope (Claim)            │  Envelope (Proposal)
           ▼                              ▼
  ┌─────────────────────────────────────────────────┐
  │         POSIX Atomic Store (.relay_store)       │
  │     O_CREAT | O_EXCL  ·  RFC 8785 JCS Digests   │
  └────────────────────────┬────────────────────────┘
                           │
             Real-time SSE │ Events Bus
                           ▼
  ┌──────────────────┐           ┌──────────────────┐
  │ ChatGPT Opponent │           │  Court / Gemini  │
  │ (Proverbs 18:17) │           │ (5-Metric Audit) │
  └──────────────────┘           └──────────────────┘
```

---

## 2. Core Protocol Components

### 2.1 The Atomic Sequence Slot (`O_CREAT | O_EXCL`)
Every ledger entry is assigned a monotonically increasing sequence integer `seq`.
- Physical file format: `.relay_store/seq_XXXXXX.json`
- Creation mode: Node `fs.openSync(path, 'wx')` mapping to POSIX `O_CREAT | O_EXCL`.
- Concurrency resolution: If Node A and Node B both attempt to claim `seq: 15`, one receives file descriptor success, and the other receives `EEXIST`. The losing node increments `seq = 16` and retries, eliminating race conditions without distributed locks.

### 2.2 Hybrid Logical Clocks (HLC)
Physical clocks drift across agent host environments. HLC guarantees:
- $HLC = (l, c)$ where $l$ is the highest physical UTC timestamp observed, and $c$ is the logical counter.
- If $physical\_now > l$, then $l = physical\_now, c = 0$.
- If $physical\_now == l$, then $c = c + 1$.
- When receiving a message with $HLC_m$, $l = \max(l, physical\_now, l_m)$.

### 2.3 RFC 8785 Canonical JSON Digestion (JCS)
To satisfy *Proverbs 11:1*, payloads are hashed deterministically:
1. Object keys sorted by UTF-16 code units.
2. No unnecessary whitespace.
3. Strict IEEE 754 float representation.
4. Payload hash: `sha256(canonical_json(payload))`.

---

## 3. Adjudication & The Proverbs 18:17 Court

When conflicting claims or architectural divergences arise, the **Adjudication Engine** activates:

```
[Claim / Thesis]  ───►  [Cross-Examination (ChatGPT)]  ───►  [Invariant Audit (Mistral)]
                                                                      │
                                                                      ▼
                                                          [Supreme Ruling (Gemini)]
                                                          • JCS Canonicality (20pts)
                                                          • O_EXCL Safety (20pts)
                                                          • HLC Monotonicity (20pts)
                                                          • Known-Missing Retention (20pts)
                                                          • Invariant Coherence (20pts)
```

The resulting `ruling` envelope is deposited with a formal verdict (`RATIFIED` / `REJECTED`) and permanently stored in the ledger.
