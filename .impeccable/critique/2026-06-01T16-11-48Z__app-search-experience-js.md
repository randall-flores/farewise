---
target: search-experience (search→results flow)
total_score: 34
p0_count: 0
p1_count: 2
timestamp: 2026-06-01T16-11-48Z
slug: app-search-experience-js
---
# Critique — FareWise search→results flow

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Spinner + live board great; no inline validation, no aria-live |
| 2 | Match System / Real World | 4 | Plain-language discipline exemplary |
| 3 | User Control and Freedom | 3 | Esc closes dropdown; no form reset / clear |
| 4 | Consistency and Standards | 4 | Fully tokenized; consistent warning + label patterns |
| 5 | Error Prevention | 3 | Required fields, date pickers, IATA guard; no date sanity check |
| 6 | Recognition Rather Than Recall | 4 | Grouped autocomplete, friendly labels, visible cabin choices |
| 7 | Flexibility and Efficiency | 3 | Raw-IATA typing + keyboard nav; no recents (fine for Phase 1) |
| 8 | Aesthetic and Minimalist | 4 | Progressive disclosure done right |
| 9 | Error Recovery | 3 | Plain non-blocking errors; not near source, no role=alert |
| 10 | Help and Documentation | 3 | Product is the help; footer explains model; no separate help |
| **Total** | | **34/40** | **Good (top of band)** |

## Anti-Patterns Verdict
LLM: PASS. Distinctive split-flap board, single-amber discipline, serif/sans/mono split. No gradient text, glass, hero-metric, or identical card grid.
Deterministic scan: detect.mjs on both JSX files = 0 findings. Detector scans markup not CSS, so it does not see the border-left side-stripe flagged in audit (page.module.css:301) — that one stands.
Visual overlays: none — no dev server running this run.

## Cognitive Load: LOW (0/8 failures)
Single focus, ≤3 fields/row, route persists on board, reasoning hidden until asked. Textbook progressive disclosure.

## Emotional Journey
Strong peak-end. Peak = honest verdict ("their problem, not yours"); risky fare met with full-sentence warning where reassurance is needed; close ("what we'd tell a friend") lands warm. Empty initial state is just a form — fine.

## What's Working
1. Plain-language layer is the product and delivers (Heuristic 2 = 4).
2. Three-layer disclosure: verdict → always-on warnings → Explain reasoning.
3. Honesty signals accessible by construction (color + icon + mono label).

## Priority Issues
- [P1] Most important copy is faintest text. Total-cost line + footer use cream-40 at 3.77:1 (below AA). Fix: bump to cream-60 (6.7:1). Command: /impeccable colorize
- [P1] Results + errors silent to screen readers. No aria-live. Fix: role=status on loading, role=alert on error. Command: /impeccable harden
- [P2] Validation only fires on submit. Typed-but-unpicked city fails silently until Search. Fix: flag at blur. Command: /impeccable clarify
- [P2] Mobile reach + tap size. Submit out of thumb zone; suggestion rows ~38px (<44). Command: /impeccable adapt
- [P3] No date sanity guard. Depart can be past; return can precede depart. Command: /impeccable harden

## Persona Red Flags
- Jordan (first-timer): clear first action, plain errors; typed-but-unpicked city fails silently until submit.
- Sam (screen-reader/low-vision): cream-40 contrast fail; no live-region announcements; caution + high-risk share "!" glyph (color does extra work).
- Casey (mobile): fields stack OK, but primary button not in thumb zone, tap targets small; state lost on refresh (acceptable Phase 1).
- Twice-a-year flyer (project persona): flow speaks their language; IATA only as board glyphs with friendly picker labels.

## Minor Observations
- Verdict block has no heading — h1 jumps to card h2s.
- No genuine zero-result state ("No flights for this route").
- Footer + meta repeat "demo" — good honesty, keep.

## Questions to Consider
- What does a zero-results search look like? Currently an absence, not an answer.
- Should surfaced total cost be the headline per card, base fare secondary?
- Would one worked example ("Try MIA → BER") lower first-timer hesitation without noise?
