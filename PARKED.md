# Parked — revisit when ready

Features and ideas intentionally set aside, with the reasoning and the decisions
already made, so we can pick them up later without re-litigating.

---

## 1. AI deep-search agent

**What it is:** Conversational search. Instead of filters, the user describes what
they want in plain language and the agent runs the search for them.

Example: *"Depart around June 24, ~90-night trip, max 1 stop under 4 hours."*

**Why it's parked:** Each deep search fans out into multiple real SerpApi calls,
which costs money and runs slower than a single search. Waiting until:
- the **Starter plan** is active (1,000 calls/month), and
- the **faster response tier** is in place (so the longer wait is acceptable).

For now only a small group of selected testers is using the site, so the upgrade
isn't justified yet.

**Decisions already made (lock these into the spec when we build):**
- **Sweep the departure date only** — ~7 dates (2 before / 5 after the user's date).
- **Hold trip length fixed.** Vary one axis, not two. Letting trip length also float
  turns the search into a matrix (departures × lengths) that can hit 70+ calls per
  request and burn the free tier in a few searches.
- **~14 SerpApi calls per request** (7 dates × 2 calls per round-trip search).
  At 1,000 calls/month that's ~70 deep searches — fine for a small test group.
- **No-date-given flow:** if the user goes straight to the agent without a date, the
  agent **asks** for a date range / month / trip length rather than guessing. (This is
  the transparency principle showing up in the UX.)
- **Filtering is done by code, not Claude.** Claude reads the user's intent into
  structured parameters; the code runs the searches and applies the constraints
  (e.g. layover under 4h); Claude explains the results. Code comparing numbers never
  lies — which is what keeps a trust-first product trustworthy.
- **The wait must be designed, not silent.** Show progress ("Checking 7 dates around
  June 24…") so a 20–30s search reads as working, not frozen.

**Before building:** write a short spec (what the user types → parameters Claude
extracts → exact call count + cost ceiling → what "no match" looks like → the
no-date-given question flow → where it lives in the UI).

---

_Last updated: 2026-06-02_
