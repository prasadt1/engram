# Cursor gallery-annotation report

**Contract:** `docs/reviews/claude-to-cursor-gallery-annotation-spec.md`  
**Date:** 2026-07-15  
**Scope:** Rail rewrite only — six screenshot frames; **05 dark architecture left untouched** (SHA `c25f041e…`).

## Tooling

- `tools/devpost-gallery/screens.json` — each of 00/01/02/03/04/06 has exactly 3 `{role,text}` beats from §1; `05.cards = []`
- `tools/devpost-gallery/compositor.py` — `TechCard{role,text}`; header **WHAT MEMORY DOES HERE**; no FRONT→BACK; no rail chip row; role-branched draw (MOVE serif / WHY amber-number / HOW mono code-chip); beat fonts; `cards[:3]` + `max_gap=48`
- Regenerated via `render.py batch --variant split --screen {00,01,02,03,04,06}` from existing `docs/devpost-screenshots/standalone-*` (no app re-capture)
- **No PNG commit/push** (gitignored local gallery assets)

## Rails as rendered

### 00 · judge-entry
| Beat | Text |
|------|------|
| THE MOVE | Opens already knowing your whole history |
| WHY IT'S REAL | **16** photos · 7.5/10 mentor read |
| HOW | `GET /api/v1/journey` |

**WHY on-screen:** Home mentor-read shows **7.5/10**; library/thread UI implies the photo count backing the demo (rail cites **16 photos**).

### 01 · home
| Beat | Text |
|------|------|
| THE MOVE | Recalls every past shoot, not just your last upload |
| WHY IT'S REAL | **7** photos: 5.9 → 7.5 (Landscape thread) |
| HOW | `GET /api/v1/journey` |

**WHY on-screen:** Landscape memory thread and hero mentor-read show the **7.5** score / thread progress the WHY cites.

### 02 · my-work
| Beat | Text |
|------|------|
| THE MOVE | Recalls and finds any frame you've shot, scored |
| WHY IT'S REAL | **16** photos · Avg 6.7 · 100% consistent |
| HOW | `GET /api/v1/portfolio/search` |

**WHY on-screen:** My Work status bar literally reads **16 photos · Avg 6.7 · 100% consistent**.

### 03 · mentor
| Beat | Text |
|------|------|
| THE MOVE | Recalls only what matters, answers within a token budget |
| WHY IT'S REAL | **8** recalled · packed under 1200 tokens |
| HOW | `build_memory_context(k=8, token_budget=1200)` |

**WHY on-screen:** Open Memory Receipt on the mentor reply shows **8 recalled · packed under 1200 tokens**.

### 04 · proof-room
| Beat | Text |
|------|------|
| THE MOVE | Forgets the camera you sold; recalls only current gear |
| WHY IT'S REAL | **1.00** vs 0.64 (never-forgets) |
| HOW | `eval/run.py · compute_fama()` |

**WHY on-screen:** FAMA rings show shipped **1.00** beside the dual **0.64** baselines (recency-only + never-forgets).

### 06 · photo-detail
| Beat | Text |
|------|------|
| THE MOVE | Recalls only this photo's own history |
| WHY IT'S REAL | **1** recalled · packed under 1200 tokens |
| HOW | `recall(scope=storageKey)` |

**WHY on-screen:** Photo-scoped chat Memory Receipt shows **1 recalled · packed under 1200 tokens**.

## Spot checks
- Header is **WHAT MEMORY DOES HERE** on all six; no FRONT→BACK; exactly 3 cards; MOVE is dominant serif; first WHY numeral amber; HOW is mono code-chip
- `annotated-05-architecture.png` SHA unchanged (dark poster exempt)
