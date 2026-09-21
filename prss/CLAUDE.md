# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A **cost/feasibility prototype**, not a real product: a literal clone of peaceriverscottishsociety.ca
(currently Squarespace, ~$300/year) built to test whether the same site could be served from GitHub
Pages at `jsbg.ca/prss` for the cost of a domain (~$20/year). Built at Shaun's request as a member of
the Society, to see whether the platform switch is worth proposing to their board — **not yet shown
to or approved by PRSS.**

**Do not merge/deploy this to `main` without Shaun's explicit go-ahead.** It carries another
organization's exact name, branding, layout and content. Every page has a `<meta name="robots"
content="noindex, nofollow">` tag and a red disclaimer banner injected right after `<body>` for
exactly this reason — don't remove either without a reason.

**Hosting constraints (GitHub Pages, free tier):** static files only, no backend, no server-side
redirects. Unlike `printing/`, these pages don't use `<base href>` — Squarespace's own asset/CSS/JS
references are all absolute CDN URLs already, so nothing but the seven internal nav links needed
rewriting (see below).

**Isolation:** stands alone. No shared nav or assets with the main site or with `printing/`.

## What "clone" means here

These are the **actual rendered Squarespace pages**, downloaded with `curl` and lightly patched —
not a rebuild. Fonts, layout, CSS, and photos are all real, loaded live from Squarespace's own CDN
(`static1.squarespace.com`, `images.squarespace-cdn.com`, `definitions.sqspcdn.com`) exactly as the
real site loads them — confirmed those CDN URLs aren't referrer-locked, so they render fine from
`jsbg.ca`. **No image files were copied into this repo** — the photos (mostly of dancers, many
minors) stay hosted on Squarespace's own infrastructure under PRSS's account; this page only
references them by URL, the same way any browser tab would when visiting the real site.

Two categories of patch were applied on top of the raw download, identically on all seven pages:
1. **Internal nav links rewritten** — the seven root-relative links Squarespace generates
   (`/`, `/new-page`, `/general-2`, `/guide-to-success`, `/registration`, `/prss-news`,
   `/travel-group`, `/cart`) point at the *domain root* by design, which would send visitors back to
   `jsbg.ca/whatever` instead of staying under `/prss/`. Rewritten to the local filenames below;
   `/cart` (present but unused — PRSS registration runs through Google Forms, not Squarespace
   commerce) points out to the real site since there's no static equivalent.
2. **Disclaimer banner + `noindex` meta tag injected** — see above.

Everything else — Squarespace's own runtime JS, analytics/error-reporting scripts, the component
definition bundles — is untouched. That means things Squarespace's backend actually powers (site
search, cart count, any member-account features) won't functionally work here, and some of those
scripts may still phone home to Squarespace under PRSS's site ID. Harmless, but worth knowing before
treating this as a 1:1 production replacement.

## Site Structure

```
prss/
├── index.html            ← homepage
├── about.html            ← from new-page — club history + teacher bios
├── our-studio.html       ← from general-2 — classes, schedule, fees
├── guide-to-success.html ← dress code, attendance, exams, events
├── registration.html     ← links to the real Google Forms
├── news.html             ← from prss-news — club news, most recent first
├── travel-group.html     ← travel group history
└── CLAUDE.md
```

## Content Provenance

Downloaded verbatim from the live site (peaceriverscottishsociety.ca) on 2026-09-21. All copy,
layout, styling and photos belong to PRSS; this exists only for Shaun's own side-by-side cost
comparison as a Society member, not as content to extend, repurpose, or present as jsbg.ca's own.

## Registration

Registration was already just two Google Form links on the live site (not a Squarespace commerce
feature) — so it was never the part costing $300/year. Links point at the real forms.
