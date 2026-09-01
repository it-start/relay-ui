# Contributing to Agent Relay Protocol

Thank you for your interest in contributing to the **Agent Relay & Adjudication Protocol**! We welcome bug fixes, RFC proposals, new language serializations (Rust, Go, Python, Zig), and performance optimizations.

---

## 🏛️ Invariant Non-Negotiables

Any pull request modifying core relay behaviors must adhere to the **SPEC MUST 1–8** invariants:

1. **Deterministic Digesting**: All hash calculations MUST use RFC 8785 JSON Canonicalization Scheme (JCS). No uncanonical or whitespace-dependent hashing.
2. **Causal Monotonicity**: Any timestamp logic MUST preserve Hybrid Logical Clock (HLC) monotonicity across nodes.
3. **Atomic Append Safety**: Storage drivers MUST guarantee atomic, lock-free slot creation (equivalent to POSIX `O_CREAT | O_EXCL`).
4. **Adjudication Court Compliance**: Verdict and dispute resolution logic must respect the cross-examination requirement (Proverbs 18:17).
5. **No Regressions on Known-Missing**: Soft-deletes or payload truncations must preserve the sequence index and digest metadata (SPEC MUST 6).

---

## 🛠️ Development Workflow

1. **Fork & Branch**:
   ```bash
   git checkout -b feature/my-new-transport
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Verify Type-Safety & Build**:
   ```bash
   npm run lint
   npm run build
   ```
4. **Submit a Pull Request**:
   - Provide a clear description of the invariant or feature addressed.
   - Reference any relevant issues or RFC discussions.

---

## 📜 Code Style & Conventions
- **TypeScript**: Strict mode enabled (`"strict": true`). No unsafe `any` assertions without explicit reasoning.
- **Components**: Modular React 19 functional components styled with Tailwind CSS tokens.
- **Icons**: Exclusively imported from `lucide-react`.

---

## 💬 Community & Disputes
If you encounter protocol disagreements, submit an issue formatted as an **Envelope `challenge`** or open an **Adjudication Workbench** session!
