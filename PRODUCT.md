# Product

## Register

product

## Users

People who fly twice a year, not power travelers. They land on FareWise mid-decision: they have a trip in mind, a rough budget, and a quiet worry that the cheap option has a catch they can't see. They don't know airline jargon and shouldn't need to. Their job is to make one flight decision fast and trust it enough to book — then leave to book directly with the airline or a partner.

Context of use: a person comparing a handful of fares, trying to answer "is the cheap one actually fine, or is it cheap because something's wrong?" before they spend real money.

## Product Purpose

FareWise is an AI-powered flight search whose differentiator is **honesty, not lower prices**. It searches, compares, and explains trade-offs in plain language, then redirects the user to book directly (the Google Flights model — never the merchant of record). Claude reasons only over the live flight data returned for the current search and explains it; it never invents fares, routes, schedules, or policies.

Success: the user makes a genuinely better-informed decision than the big apps give them, with no hidden costs sprung at checkout, and trusts the result enough to recommend it to friends and family. "Better" means smarter and surprise-free, not a magically lower headline fare — FareWise draws from the same fare data as everyone else.

## Brand Personality

A sharp, honest operator who respects your time. Three words: **honest, transactional, plain-spoken.**

Voice: state the fact, then why it matters, then stop. No mood words, no padding, no hedging, one idea per line. Plain language only — if a twice-a-year flyer wouldn't understand a word instantly, swap it ("wait" not "layover", "separate tickets" not "self-transfer", "no stops" not "nonstop"). The one exception: risk warnings stay full, blunt, complete sentences — clarity beats brevity exactly where the user must understand the danger.

Visual identity (already committed, preserve it): "the record" — cool paper grey page, white cards, every fact a labelled row with its value right-aligned, and the verdict printed as a finding in deep record navy. One alert red for the catch. Light, high-contrast, phone-first. Calm and authoritative, not loud.

## Anti-references

- **Kiwi.com** — became merchant of record, broke refunds and rebooking. FareWise never books in-app; it redirects. The liability model is a feature, not a footnote.
- **Travel-blogger / AI-essay voice** — "embark on your relaxed journey through sun-drenched Lisbon." Banned. Adjectives that set a mood, padding, and aphoristic cadence all break the operator voice.
- **Generic SaaS dashboard** — cards-everywhere, gradient hero-metric template, blue-and-white tool aesthetic, identical icon+heading+text grids. The AI-slop look. FareWise is editorial and typographic, not a control panel.
- **Booking-site urgency** (Expedia / Booking.com) — red banners, "2 seats left!", countdowns, fake scarcity. A non-negotiable: money never reorders results and nothing manufactures pressure.

## Design Principles

1. **Truth over persuasion.** Every screen helps the user decide, never nudges them. Money (affiliate/referral) must never reorder results or trigger urgency. Ranking is by genuine value only.
2. **Live data only — never invent.** Claude reasons over the data actually returned for this search. No recalled fares, no estimated schedules, no airline policy stated as fact from memory.
3. **Warn loudly where it matters.** Separate tickets, tight connections, hidden-city tricks, suspiciously low fares — the risk is spelled out in plain, complete sentences, never sold silently. This is the moment the product exists for.
4. **Total cost upfront.** Surface the checkout surprises (bag, seat, payment fees) as part of the read, so the headline price isn't a bait number.
5. **Promise only what we control.** "We don't inflate prices based on your search history" — yes. But be explicit that the airline's final price at booking can still move by market/currency; that part is outside our control.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA.** Body text ≥4.5:1 against its background (watch cream-40/cream-60 on charcoal — verify, don't assume); large text ≥3:1; placeholders meet body contrast too. Visible focus on every interactive element (amber outline already in use). Full keyboard operation of the search form, autocomplete, and result toggles. Reduced-motion path for every animation (already global in `globals.css`). Risk signals must never rely on color alone — pair the red/amber/green with text and an icon/label so color-blind users get the same warning.
