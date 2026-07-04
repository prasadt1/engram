# Engram — demo video script (target 2:45, hard cap 3:00)

**Setup before recording:** backend + frontend running; seed data verified (`/?judge=1` shows the graduation card); browser at 1280×800, dark theme; close other tabs; mic check. Rehearse once with a timer — the cap is real (judges are not required to watch past 3:00).

**Recording tip:** capture each scene as its own clip and cut together; don't one-take it. Speak ~10% slower than feels natural.

---

## Cold open — the claim (0:00–0:20)

**Screen:** the Journey page via `/?judge=1` — the graduation card visible.

**VO:**
> "Every AI photo tool today is an amnesiac critic — upload a photo, get advice, and tomorrow it's forgotten you exist. Engram is a photography coach with a real memory. It remembers your journey, it *forgets what you've mastered* — and I can prove both, with numbers."

*(Beat. Point cursor at the graduation card.)*

> "This card says composition **cleared** — three sessions above the bar — 'I've stopped coaching this.' That's not copy. That's the memory engine deciding."

## Act 1 — critique that knows you (0:20–1:00)

**Screen:** My Work → upload a photo (pre-pick one that analyzes well; the ~60s analysis is CUT in editing — show the narrated loading states for ~3 seconds, then jump-cut to the result).

**VO over upload + loading states:**
> "Every upload gets a glass-box critique from Qwen-VL — five scored dimensions, visible reasoning, grounded in a photography-principles corpus."

**Screen:** the critique result — point at the genre chip, then expand the **Memory Receipt**.

**VO:**
> "But look under the critique. This is the Memory Receipt — on every single reply. What the coach *recalled* about me, with the actual retrieval scores — importance, recency, relevance. What it *excluded* because I've outgrown it. And what got dropped to fit the context budget. Retrieval you can audit, in the product — not in an appendix."

## Act 2 — the conversation (1:00–1:40)

**Screen:** click a photo in the library → the split view opens. Type: **"How's my composition coming along?"** (response is cut-trimmed in editing).

**VO:**
> "Chat is scoped to the photo I clicked — the mentor recalls memories about *this shot*. And when I ask about my progress…"

**Screen:** the reply lands. Highlight the sentence acknowledging graduation.

**VO (read the actual reply line on screen):**
> "…it says: 'you've officially cleared composition — I've stopped coaching you on it — our focus is shifting toward lighting.' Remembering, forgetting, and the next step — in one answer. That's Track 1's brief, speaking."

## Act 3 — proof, not vibes (1:40–2:30)

**Screen:** footer → Glass box page. Click **"Serve via engram-mcp"**; let the badge appear (trim the wait).

**VO:**
> "Under the hood, the memory engine is exposed as engram-mcp — a standard MCP server any Qwen agent can mount. This button just round-tripped a live request through it — a real subprocess speaking the real protocol."

**Screen:** scroll to the benchmark table; hold on the summary strip.

**VO:**
> "And here's the benchmark. Twenty-six frozen memory traces. With forgetting: FAMA one-point-oh. Without it — same engine, forgetting ablated — zero-point-six-four, because stale facts leak back into context. Recall accuracy? *Identical in both.* Forgetting costs nothing — and it cuts context tokens by 1.7×. One command reproduces all of it."

**Screen:** flash the worked example box (Canon/Sony) for ~4 seconds.

**VO:**
> "Ask 'what camera do I use?' — the baseline answers Canon *and* Sony. Engram answers Sony. Because I switched, and it *knows the difference between my history and my present.*"

## Close (2:30–2:50)

**Screen:** split: architecture diagram (left), repo README (right) — 3 seconds each; end on the Journey page.

**VO:**
> "Engram runs on Qwen Cloud — vision, reasoning, and fast tiers — backend on Alibaba Cloud, memory in MongoDB. It began as Iris, my Gemini-era mentor; this hackathon, it got a brain transplant and a real memory. The memory layer is open source — any Qwen agent can mount it. Engram: the coach that remembers you — and knows what to forget."

**End card (3s, no VO):** Engram — Track 1: MemoryAgent · github.com/prasadt1/engram · try it: /?judge=1

---

## Cut-if-over-time (in order)
1. The worked-example flash in Act 3 (the VO line can carry it).
2. The architecture/README split in the close (end card covers it).
3. Shorten Act 1's upload to result-only (skip loading states).

## Do NOT cut
The graduation card open · the Memory Receipt expansion · the chat graduation reply · the FAMA table.
