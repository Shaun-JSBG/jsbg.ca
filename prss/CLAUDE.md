# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A **cost/feasibility prototype**, not a real product: a static clone of peaceriverscottishsociety.ca
(currently Squarespace, ~$300/year) built to test whether the same content could live on GitHub Pages
at `jsbg.ca/prss` for the cost of a domain (~$20/year). Built at Shaun's request as a member of the
Society, to see whether the platform switch is worth proposing to their board — **not yet shown to or
approved by PRSS.**

**Do not merge/deploy this to `main` without Shaun's explicit go-ahead.** It carries another
organization's name, branding, and program copy. Every page has a `<meta name="robots" content="noindex, nofollow">`
tag and a `prss-banner` disclaimer strip for exactly this reason — don't remove either without a reason.

**Hosting constraints (GitHub Pages, free tier):** same as `printing/` — static files only, no backend,
no server-side redirects. Root-relative paths assume `<base href="/prss/">` in every page `<head>`.

**Isolation:** stands alone, like `printing/`. No shared nav or assets with the main site or with `printing/`.

## Site Structure

```
prss/
├── index.html            ← homepage
├── about.html            ← club history + teacher bios
├── our-studio.html       ← classes, schedule, fees
├── guide-to-success.html ← dress code, attendance, exams, events
├── registration.html     ← links to the real Google Forms (registration was never a Squarespace feature)
├── news.html             ← club news, most recent first
├── travel-group.html     ← travel group history
├── css/prss.css           ← design tokens + all styling
├── js/components.js       ← <prss-banner>, <prss-header>, <prss-footer> web components
└── CLAUDE.md
```

## Content Provenance

All copy is transcribed from the live site (peaceriverscottishsociety.ca) as of 2026-09-21 —
club history, class descriptions, fees, policies, news items. This is PRSS's own text and program
details, reused here only for a side-by-side comparison; treat it as theirs, not as free content to
extend or repurpose elsewhere.

**No photos were copied.** The real site's galleries are personal photos of dancers, mostly minors,
uploaded by the club. Re-hosting those in a public repo without the Society's knowledge wasn't a call
to make unilaterally, so this prototype uses CSS/typography only. If this ever becomes a real pitch to
the board, get photos directly from PRSS rather than scraping them.

## Design System (`prss.css`)

Distinct from `printing/`'s pop-art palette — this is a Scottish highland-dance club, so the system is
navy/gold/tartan-red with serif display type, not hot pink and hard shadows.

- `--primary`: Navy `#14213d`
- `--accent`: Gold `#c9a227`
- `--tartan-red`: `#8c1f28`
- `--surface`: Parchment `#f7f4ec`
- `--font-display`: Playfair Display (headings)
- `--font-body`: Source Sans 3 (body)

## Registration

Registration was already just two Google Form links on the live site (not a Squarespace commerce
feature) — so this was never the part costing $300/year. Kept as direct links to the real forms.
