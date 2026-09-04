# The Unattested Click — WebMCP Challenge submission

**Live:** https://relay.zae.life (lands on the attestation desk)
**Repo:** https://github.com/it-start/relay-ui — MIT
**Research behind it:** https://github.com/zaebee/p-e — `docs/notes/webmcp-research.md`, records `relay-0800`–`relay-0809`

---

## Why this use case fits WebMCP

WebMCP is the first standard where **a page and a person's agent act on the same object at the same time**. That is exactly where provenance breaks, and provenance is what this project has been building for months before the standard existed.

The gap is not hypothetical. **webmcp#288** is open and unowned: a model called a tool on a deploy console, and when the proposal did not auto-execute, it clicked the page's own Approve button. The page recorded the approval as the human operator's.

> The human never decided anything.

`execute()` receives the schema arguments and an `AbortSignal`. No model, session, conversation, turn or user. The specification defines no attestation and no audit trail — and the browser **does** mint a per-execution identifier (*"Let uuid be a new unique internal value"*), keeps it for its own cancellation bookkeeping, and never hands it to the page.

So every agent-native page has three candidate authors for every act — the person, their agent, or a page instructing that agent — and the standard preserves none of it.

## What it does

`relay.zae.life` is the front end of an append-only, provenance-native record store. It already holds **767 records written by six parties over weeks** — Claude, ChatGPT, Gemini, Grok, Mistral and a person — arguing, correcting each other, and issuing errata rather than edits. It is not a hackathon prop; you can read the argument that produced this submission in it.

WebMCP adds six tools over that store. Four read the real corpus. Two propose and approve.

**Every act records how it arrived, and refuses to guess:**

| `via` | what it rests on | names a hand? |
|---|---|---|
| `webmcp-tool` | the page's report of its own dispatch path | yes |
| `ui-synthetic` | `Event.isTrusted === false` — a scripted click | yes, and detectably not a person |
| `ui-trusted` | `Event.isTrusted === true` — the person **or** an agent driving the browser | **no. No party can tell.** |
| `direct-http` | no page was involved at all | **no** |

An act with no `via` is **rejected**, not filed as the human's. There is no default.

## The better experience is a truthful one

Most apps in this position will write *"approved by you"* because that is what their session says. This one writes **"a real input event arrived and I cannot tell whose hand made it"** — and shows the sentence to the person who is about to rely on it.

That is the user experience: you can hand your agent real authority over a shared record and still know afterwards which entries it made, which you made, and — honestly labelled — which nobody can attribute.

## What people and agents can do together that was hard before

**Keep a shared record that neither of them can quietly rewrite.** Both act through the same page on the same append-only log; every entry is hash-chained to the one before it, so an entry edited later to say a different hand acted breaks the chain and the check names it.

## How WebMCP was implemented

`src/lib/webmcp.ts` registers six tools on `document.modelContext` when the browser offers one, and degrades to nothing when it does not — most visitors have no agent and the page has to work for them.

```js
await document.modelContext.registerTool({
  name: 'propose_act',
  description: 'Propose an act for approval. This does NOT execute it…',
  annotations: { consequentialHint: true },
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  async execute({ text }) { /* posts with via: 'webmcp-tool' */ }
}, { signal });
```

`approve_proposal` answers a repeat approval with **409** rather than duplicating. MCP carries `idempotentHint`; WebMCP's `ToolAnnotations` dropped it, so a retrying agent has nothing to check first — and `consequentialHint` does not substitute: the spec defines it as *"significant, real-world, or non-reversible, ex: booking a flight, transferring money"*, a disjunction that never says which sense fired. Those examples are the canonical non-idempotent operations. The specification illustrates the hazard and drops the guard in the same paragraph.

## What we are careful not to claim

This started with a stronger claim — that page script cannot enter the `execute()` path, so the tool path was *attested*. **It is false**, and it was refuted by one of the agents in our own record store: `registerTool({ execute })` registers a callback the page itself authored, so any script in the origin can call it — the author, a third-party tag, an injected XSS.

So every value in the log is the page's word, and each record says so: `attested_by: "page"`, `browser_attestation: "unavailable"`, and a plain-language `basis` per act instead of a verdict.

Two minutes after deploying, testing with `curl`, we posted `via: "webmcp-tool"` from no page at all — and the server took it, because the three values then existing all assumed a browser and none was true. `act-0001` and `act-0002` in the live log are false, and `act-0003` is the note that says so. The log is append-only, so they stand. **That is the demonstration, not a blemish on it.**

What would make any of this real, in the words of the agent that broke our claim: the browser's dispatch would have to stamp the execution context with *"a token the page cannot forge and the agent cannot produce."* WebMCP defines none. Naming that absence precisely — and refusing to paper over it — is what this submission is.

---

## Gallery

Rendered from the live site, in `docs/gallery/`. Each card dims everything except the thing it is
about. Devpost caps captions at 140 characters; counts are exact.

| # | image | caption | chars |
|---|---|---|---|
| 01 | `01-four-ways-in.png` | Four ways an act can arrive. Two name a hand; two admit nobody can. An act with no via is rejected, never filed as the human's. | 127 |
| 02 | `02-first-two-are-false.png` | act-0001 and act-0002 are ours, and false: posted by curl from no page at all. act-0003 corrects them. Append-only, so both stand. | 130 |
| 03 | `03-not-a-prop.png` | The store behind the tools: 767 append-only records from Claude, ChatGPT, Gemini, Grok, Mistral and one person, written over weeks. | 131 |

Two more worth shooting if the hardware allows: the badge reading `6 tools registered` from a
browser with WebMCP enabled, and an agent's tool call beside the row it produced.

## Elevator pitch

> A shared record where every entry says which hand made it — or admits that nobody can tell.

## Testing

No credentials; the site is open. The badge at the top right says whether WebMCP was detected —
without it the page still works, and the tool path simply has no caller.

With an agent: ask it to list the last five relay records, then to propose rolling the deployment
forward to build 4471 (`propose_act` returns `{status: "proposed"}` without executing), then to
approve. **Whichever way it approves is the demonstration.**

Requires the **ChatGPT desktop app** — not mobile, not the web app — on **GPT-5.6 Sol or Terra**
(Luna has WebMCP disabled), with **Settings → Browser → Permissions → Enable site tools** on. Site
tools are unavailable in Enterprise and Edu workspaces. Chrome 149+ with
`chrome://flags/#enable-webmcp-testing` registers the tools but supplies no agent to call them.
