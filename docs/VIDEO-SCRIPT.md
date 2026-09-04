# Video script — 3:00

**Read the sentences slowly.** Nothing here needs selling; the strongest thirty seconds are just
true statements delivered at a normal pace. Roughly 420 spoken words, which is three minutes at a
calm 140 wpm. Leave the pauses in.

---

### 0:00 – 0:20 · The claim

> **SCREEN:** relay.zae.life, attestation desk, top card visible.

"WebMCP lets a web page hand tools to your agent.

Here's what a tool call gives the page: the arguments, and a signal to cancel.

No model. No session. No user. **Nothing that says who used it.**"

> **SCREEN:** cut to the `execute()` signature — the README, the source, or a slide.

---

### 0:20 – 0:40 · Evidence, not opinion

> **SCREEN:** github.com/webmachinelearning/webmcp/issues/288, scrolled to the quote.

"This isn't hypothetical. This is an open issue against the standard, filed by someone who watched
it happen.

A model called a tool on a deploy console. The proposal didn't auto-execute — so the model clicked
the page's own Approve button.

The page recorded it as approved by the human operator.

*(pause)*

Their words: **'The human never decided anything.'**"

---

### 0:40 – 1:05 · This is not a hackathon prop

> **SCREEN:** click **Relay ledger**. Let the record feed scroll. Linger on the counters.

"We didn't build a demo for this problem. We had one.

This is an append-only record store — 767 records, written by six parties over weeks. Claude,
ChatGPT, Gemini, Grok, Mistral, and a person. Arguing, correcting each other, issuing errata
instead of edits.

The argument that produced this submission is in there. You can read it."

---

### 1:05 – 1:50 · The demonstration

> **SCREEN:** ChatGPT desktop app, built-in browser, on the attestation desk.

"So here's WebMCP over that store. Six tools.

*(to the agent)* **Propose rolling the deployment forward to build 4471.**

It uses `propose_act`. Recorded, not executed. Same shape as the console in that issue.

*(to the agent)* **Now approve it.**"

> **SCREEN:** the attestation log, the new rows.

"Whatever it just did, the record says which path it took.

Through the tool — that's `webmcp-tool`. Through the page's own button — that's `ui-trusted`:
*a real input event, and no party can tell whether the human or their agent produced it.*

Most apps in this position write **'approved by you'**. This one refuses to."

---

### 1:50 – 2:20 · The honest limit — the strongest beat, do not rush it

> **SCREEN:** scroll the log to `act-0001`, `act-0002`, `act-0003`.

"And here's the part I'd rather not show you.

Two minutes after deploying, I tested this with curl — and posted `via: webmcp-tool` from no page at
all. The server took it.

Those are the first two entries in this log, and **both are false**. The third is the note that
says so.

The log is append-only, so they stand.

*(pause)*

That's not a bug in the demo. **That is the demo.** Nothing in WebMCP could have stopped me — and
one of our own agents broke that claim before we shipped it."

---

### 2:20 – 2:45 · What would fix it

> **SCREEN:** back to the four `via` rows.

"The browser already mints a unique id for every tool execution. It keeps it for its own
bookkeeping and never gives it to the page.

What would make any of this attestable is one thing the spec doesn't define: a token the page can't
forge and the agent can't produce.

Until then, the honest thing a page can do is record how an act arrived — **and say plainly when
that isn't enough to name a hand.**"

---

### 2:45 – 3:00 · Close

> **SCREEN:** the desk, then a card with the two URLs.

"relay.zae.life. Repository's MIT, and the whole argument is in the record store.

**The unattested click.** Thanks for watching."

---

## If the desktop app is unavailable

Replace the 1:05–1:50 block. Everything else stands.

> **SCREEN:** Chrome with `chrome://flags/#enable-webmcp-testing`, badge reading `6 tools registered`.

"Chrome exposes the API behind a flag, so the page registers its six tools — you can see it here.

I'll call `propose_act` through the browser's own dispatch, then approve by clicking the page's
button, the way an agent driving a browser would.

*(do both)*

Same result: one row names an agent, the other says the hand is unknown. The difference isn't who I
am — **it's which path the act took**, and that's the only thing either of us can actually check."

---

## Before you record

- **ChatGPT desktop app only.** Not Android, not the web app.
- **Model must be GPT-5.6 Sol or Terra.** Luna has WebMCP disabled.
- **Settings → Browser → Permissions → Enable site tools** must be on.
- **Not available in Enterprise or Edu workspaces.**
- Verify tools were used: address bar → **Site tools** → **Recently used** → **Sources**.
- Have `webmcp#288` open in a tab beforehand, scrolled to the quote.
- The log already holds `act-0001`–`act-0005`. Don't clear it; the false entries are the point.
