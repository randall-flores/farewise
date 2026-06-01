---
target: search-experience (post-backlog)
total_score: 38
p0_count: 0
p1_count: 0
timestamp: 2026-06-01T17-03-58Z
slug: app-search-experience-js
---
# Critique — search→results flow (post-backlog)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Board on load, blur validation, aria-live |
| 2 | Match System / Real World | 4 | Plain language, board metaphor |
| 3 | User Control and Freedom | 4 | "New search" reset = escape/start-over |
| 4 | Consistency and Standards | 4 | Tokenized |
| 5 | Error Prevention | 4 | Date min + submit guards + blur validation |
| 6 | Recognition Rather Than Recall | 4 | Autocomplete, board preview |
| 7 | Flexibility and Efficiency | 3 | No recents/shortcuts (Phase 2+) |
| 8 | Aesthetic and Minimalist | 4 | Split hero, mobile form-first, ghost-board polish |
| 9 | Error Recovery | 4 | role=alert + inline field error near source |
| 10 | Help and Documentation | 3 | Product is its own help (Phase 2+) |
| **Total** | | **38/40** | **Excellent** |

## Anti-Patterns Verdict
LLM: PASS. Distinctive board + single-amber discipline; no SaaS chrome, no slop tells.
Deterministic scan: detect.mjs on JSX = 0 findings.

## Cognitive Load: LOW (0/8 failures)

## Emotional Journey
Complete control loop: prevent -> catch at blur -> recover (role=alert) -> start over. User can't get stuck. Board greets on load; warm honest-read peak; trust-line close.

## What's Working
1. Control loop complete (prevent/catch/recover/reset).
2. Mobile thumb-first: form leads stacked hero; reset scrolls back to it.

## Priority Issues
None P0/P1/P2. Remaining are Phase 2+ scope:
- [P3] Flexibility: no saved searches / recents / keyboard shortcuts (needs persistence).
- [P3] Help: no contextual help layer; the honest-read is the help.

## Persona Red Flags
- Casey (mobile): clean — form-first, full-width submit, reset to top.
- Jordan (first-timer): clean — titled card, board preview, plain errors.
- Sam (screen-reader): clean — AA+ contrast, aria-live, inline errors, labeled board, reset is a real focusable button.

## Questions to Consider
- Phase 2: would recents + a saved-search push Flexibility to 4?
- Does a single-flow tool ever need a Help layer, or is the honest-read enough?
