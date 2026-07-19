<!--
BLOG / SOCIAL POST — copy-paste ready. Three versions below:
  A) Long-form (dev.to / Hashnode / Medium)  — the canonical post
  B) LinkedIn                                 — short, 1 image
  C) X / Twitter thread                       — 7 tweets
Images are live GitHub raw links (they render on dev.to, Hashnode, Medium, LinkedIn article, GitHub).
Put the dev.to URL in the Devpost "Blog/social post" bonus field.
-->

# ═══════════════════════════════════════════════════════
# A) LONG-FORM  →  dev.to (canonical) · Hashnode · Medium
# ═══════════════════════════════════════════════════════

**Title:** Teaching a Qwen agent to forget

**Cover image:** https://raw.githubusercontent.com/prasadt1/engram/main/docs/media/devpost-inline-architecture.png

[Full-scale data-flow diagram →](https://raw.githubusercontent.com/prasadt1/engram/main/docs/architecture/system-flow.svg?v=2)

**Tags:** ai · machinelearning · showdev · qwen

---

Every AI photo tool today is an amnesiac critic. Lightroom edits, culling apps, and ChatGPT/Gemini/Qwen will happily critique a single photo — then forget you exist. You re-explain yourself every session, get the same beginner advice forever, and nothing knows whether you're actually improving.

Memory is the difference between a **critic** and a **coach**: someone who knows where you started, notices what you've mastered, and moves the goalposts as you grow.

So for the Global AI Hackathon with Qwen Cloud (Track 1: MemoryAgent), I built **Engram** — an AI photography coach whose most important organ isn't the critique. It's a **forgetting-aware memory engine**.

![Engram Home — a memory, not a dashboard](https://raw.githubusercontent.com/prasadt1/engram/main/docs/media/devpost-inline-home-threads.png)

## The loop

Engram runs one loop, forever:

1. **Critique** — upload a photo; `qwen-vl-max` scores five dimensions with glass-box reasoning grounded in real photography principles.
2. **Remember** — every critique writes memory: salience-scored facts, skill evidence, a genre identity. The app then tells you *what it learned from this photo*.
3. **Focus** — skills you're working on are *watched*; three consecutive strong sessions and a skill **graduates** — celebrated on your timeline, then retired from coaching.
4. **Adapt** — the next critique and every chat reply are built from what's *still true* about you.

Home stops being a dashboard and becomes a memory: a mentor's read of you, genre "memory threads" you step through like a photo-app Memories reel, and a coaching plan that changes as you do.

## The hard part wasn't remembering — it was forgetting

Anyone can append facts to a database. The interesting problem Track 1 named is **timely forgetting**: what happens when a fact stops being true?

You switch from a Canon body to a Sony mirrorless. A memory that *remembers everything forever* keeps coaching you on a camera you sold last month. So Engram does two things most "memory" layers don't:

- **Supersession.** A contradicted fact gets a `superseded_by` link — excluded from recall, but kept in an audit trail. Forgetting you can't inspect is just data loss.
- **Graduation.** A mastered skill is *retired* from active coaching — forgetting rendered as promotion, not deletion.

![The Memory Proof Room — watch a stale fact retire, live](https://raw.githubusercontent.com/prasadt1/engram/main/docs/media/devpost-inline-proof-room.png)

## Proving it: the FAMA benchmark

Claims are cheap. I froze 26 scripted photographer histories — gear switches, twice-replaced habits, multi-hop questions, and controls where nothing changes — and scored the engine against two baselines with a metric I called **FAMA** (Forgetting-Aware Memory Accuracy: rewards recalling every still-true fact, penalizes surfacing outdated ones).

| config | mean FAMA | recall of still-true facts | context tokens |
|---|---|---|---|
| **Engram (forgetting on)** | **1.00** | 100% | **1.72× fewer** |
| recency-only (keep the 5 newest facts) | 0.64 | 100% | baseline |
| never-forgets (full history) | 0.64 | 100% | baseline |

The result worth sitting with: the two baselines **tie**. Keeping only the newest facts scores exactly the same as keeping everything — because recency can't tell that a newer fact *invalidates* an older one. The win isn't about trimming context; it's about knowing what's **stale**. And recall stays at 100% across all three, so the engine isn't trading recall for forgetting — it gets both, at 1.72× lower token cost.

One command reproduces it: `python -m eval.run --compare`.

## Building on Qwen Cloud

Every model call goes through Alibaba's DashScope (OpenAI-compatible) endpoint, across three tiers behind one client:

- `qwen-vl-max` — vision critique + genre
- `qwen3.7-max` — reasoning / shape repair
- `qwen3.6-flash` — mentor chat (SSE streaming), summaries, cheap repairs

Two things I learned building on it:

**Qwen trusts your prompt where other stacks enforce a schema.** My first live critique came back with the *critique* as prose, an invented `overall` score, and dropped arrays. The fix was a defense-in-depth chain: an explicit JSON skeleton in the prompt, then a **local deterministic salvage layer** that repairs known deviations (near-miss enums, out-of-range scores) in ~0.1ms — replacing a model-based repair loop that once burned **93 seconds** and 502'd in front of me. Reliability became a feature.

**Sometimes the model is right and your schema is wrong.** One early response returned `genre: "still_life"` — refusing my enum because the photo genuinely *was* a still life and my taxonomy lacked it. It's in the enum now.

The whole thing — SPA, API, memory engine, and a custom **`engram-mcp`** server (so any Qwen agent can mount the same memory over MCP: `recall` / `forget` / `get_memory_stats`) — ships as one Docker image on an **Alibaba Cloud ECS** instance in Singapore, behind Caddy TLS, with photo storage one env flip from Alibaba OSS.

## The takeaway

Users don't care that facts persist. They care that the *coaching changes* because of them. Committing to a forgetting metric didn't just measure the product — it *shaped* it: supersession semantics, audit trails, receipts on every reply. Memory is a behavior, not a store.

**Try it (no login):** https://engram.prasadtilloo.com/?judge=1
**Code (Apache-2.0):** https://github.com/prasadt1/engram

*Built with Qwen Cloud (DashScope) + Alibaba Cloud ECS for the Global AI Hackathon, Track 1: MemoryAgent.*


# ═══════════════════════════════════════════════════════
# B) LINKEDIN  (paste as a post; attach the home-threads image)
# ═══════════════════════════════════════════════════════

Every AI photo tool is an amnesiac critic — it grades one photo, then forgets you exist.

For the Global AI Hackathon with Qwen Cloud, I built **Engram**: an AI photography coach whose core isn't the critique — it's a *forgetting-aware* memory engine.

The hard part wasn't remembering. It was **forgetting on time**. When you switch from a Canon to a Sony, a mentor that remembers everything keeps coaching you on gear you sold. Engram retires stale facts to an audit trail and graduates skills you've mastered — so the coaching actually changes as you grow.

I proved it with a frozen 26-scenario benchmark: forgetting-on scores a perfect 1.00 vs 0.64 for both a recency baseline and a never-forgets baseline — same recall, 1.72× fewer tokens. The two baselines tie, because recency can't tell that a fact went stale. Only supersession-aware forgetting can.

Built on Qwen Cloud (DashScope: qwen-vl-max / qwen3.7-max / qwen3.6-flash) and Alibaba Cloud ECS, exposed to any agent over MCP.

Try it (no login): https://engram.prasadtilloo.com/?judge=1
Full write-up: [dev.to link]

#AI #Qwen #AlibabaCloud #MachineLearning #BuildInPublic


# ═══════════════════════════════════════════════════════
# C) X / TWITTER THREAD  (tag @Alibaba_Qwen)
# ═══════════════════════════════════════════════════════

1/ Every AI photo tool is an amnesiac critic: grades one photo, forgets you exist.

So I built Engram — an AI photography coach whose core is a *forgetting-aware* memory engine.

For the Global AI Hackathon w/ @Alibaba_Qwen Cloud 🧵

2/ The insight: memory is the difference between a critic and a coach. A coach knows where you started, notices what you've mastered, and moves the goalposts.

3/ The hard part wasn't remembering. It was FORGETTING on time.

Switch from a Canon to a Sony → a "remember everything" mentor keeps coaching gear you sold. Engram retires stale facts to an audit trail (supersession) and graduates skills you've mastered.

4/ Proof, not vibes. 26 frozen scenarios, a metric called FAMA:

forgetting-on: 1.00
recency baseline: 0.64
never-forgets: 0.64

Same recall, 1.72× fewer tokens. The baselines tie — recency can't tell a fact went stale. Only supersession can.

5/ Built on Qwen Cloud (DashScope), 3 tiers behind one client:
• qwen-vl-max — vision critique
• qwen3.7-max — reasoning/repair
• qwen3.6-flash — chat + summaries

Fun bug: the model refused my enum & returned genre:"still_life" — because it WAS one. It's in the enum now.

6/ Ships as one Docker image on Alibaba Cloud ECS (Singapore), and the memory engine is exposed over MCP — any Qwen agent can mount recall / forget / get_memory_stats.

7/ Try it, no login → https://engram.prasadtilloo.com/?judge=1
Code (Apache-2.0) → https://github.com/prasadt1/engram

Memory is a behavior, not a store. 🧠📸
