---
target: search-experience (split-hero layout)
total_score: 37
p0_count: 0
p1_count: 0
timestamp: 2026-06-01T16-49-54Z
slug: app-search-experience-js
---
# Critique — search→results flow (split-hero layout)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Board on load, blur validation, aria-live |
| 2 | Match System / Real World | 4 | Plain language, board metaphor |
| 3 | User Control and Freedom | 3 | Esc + edit; no reset/clear |
| 4 | Consistency and Standards | 4 | Tokenized |
| 5 | Error Prevention | 4 | Date min + submit guards + blur validation |
| 6 | Recognition Rather Than Recall | 4 | Autocomplete, board preview |
| 7 | Flexibility and Efficiency | 3 | Raw IATA + keyboard; no recents |
| 8 | Aesthetic and Minimalist | 4 | Composition fixed (split hero) |
| 9 | Error Recovery | 4 | role=alert + inline field error near source |
| 10 | Help and Documentation | 3 | Product is the help; no contextual layer |
| **Total** | | **37/40** | **Excellent** |

## Anti-Patterns Verdict
LLM: PASS. Split hero + form-in-card are conventional shapes but carried by board, mono labels, single-amber discipline — not SaaS chrome. formTitle/kicker/sectionLabel each used once as functional labels, not per-section eyebrows.
Deterministic scan: detect.mjs on JSX = 0 findings. Only 1px hairline border-left remains.

## Cognitive Load: LOW (0/8 failures)
Each hero column single-focus (read pitch / fill form). Progressive disclosure intact in results.

## Emotional Journey
Stronger entry peak: board greets on load, first impression signals what the product does instead of a stranded form. Peak-end unchanged (honest verdict + warm footer).

## What's Working
1. First impression matches the product: composed split hero + board-on-load reads as a finished tool.
2. End-to-end error story: prevent (date min) -> catch at blur (inline) -> recover (role=alert). Drove heuristics 5 and 9 to 4.

## Priority Issues
- [P2] Mobile form sits below the pitch (~400px scroll to reach it). Consider form-first order on stacked layout. Command: /impeccable adapt
- [P3] No reset / "new search" affordance after results. Command: /impeccable harden
- [P3] Ghost board sample ~1.8:1 contrast — decorative/labeled, optional bump to ~45%.

## Persona Red Flags
- Casey (mobile): form-below-pitch scroll is the one snag; full-width submit + stacking otherwise solid.
- Jordan (first-timer): improved — titled form card + board preview show what to do.
- Sam (screen-reader): contrast green, aria-live, inline errors, ghost board labeled. Clean.

## Minor Observations
- Ghost board could read as "broken" to some; a "sample" caption would disambiguate.
- After results the 78vh hero compacts (heroCompact) — good, avoids a tall push.

## Questions to Consider
- On mobile, should the form lead and the pitch follow?
- After results, would a "search again" / collapsed-form affordance cut the scroll back up?
