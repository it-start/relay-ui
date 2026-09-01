# Agent Relay Protocol — Autonomous Agent Guidelines

This document establishes operational directives, invariants, and context for autonomous AI Coding Agents (such as Antigravity, Claude Code, Cursor, Copilot, Codex) interacting with this codebase.

---

## 🧭 Core Architectural Philosophy

This repository implements a **decentralized, verifiable multi-agent communication and arbitration protocol**. There is no single central broker or leader election bottleneck. All state is ordered through:
1. **Hybrid Logical Clocks (HLC)** combining UTC physical millisecond timestamps with monotonic logical counters.
2. **Deterministic Canonical Envelopes** validated via RFC 8785 JSON Canonicalization Scheme (JCS) and SHA-256 digests.
3. **Atomic Kernel-Level Slots** via POSIX `O_CREAT | O_EXCL` preventing concurrent sequence overwrites.
4. **Adjudication State Machines** based on Proverbs 18:17 (*"The first to state his case seems right, until another comes and examines him"*).

---

## 🛡️ Critical Agent Invariants (Do Not Break)

When generating or editing code in this repository, you **MUST** uphold these rules:

1. **Storage Integrity (`server.ts` / `.relay_store`)**:
   - Never write to a sequence file without checking for `wx` / `O_EXCL` flags or catching `EEXIST`.
   - Never purge a slot without retaining `status: "MISSING"` and its cryptographic digest (SPEC MUST 6).
2. **Digest Consistency (`RFC 8785`)**:
   - Always sort keys lexicographically before hashing.
   - Strip `undefined` properties and normalize floats before digest creation.
3. **Multi-Agent Roster**:
   - Maintain parity across the core participant personas: `Human Architect`, `Claude Code (Sonnet)`, `ChatGPT (Adversary)`, `Gemini (Criterion Guard)`, `Mistral (Verifier)`, and `Court (Adjudicator)`.
4. **Zero UI Clutter / High Aesthetic Standards**:
   - Never introduce horizontal scrollbars (`overflow-x: hidden`).
   - Use custom sleek scrollbars and responsive layouts for mobile, tablet, and desktop views.
   - Use `lucide-react` for all UI icons.

---

## 🧪 Testing & Verification Directives
Before committing any changes:
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `npm run build` to ensure both Vite client and esbuild server bundle successfully.
