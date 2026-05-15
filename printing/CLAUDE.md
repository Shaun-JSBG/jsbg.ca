# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Static HTML/CSS website hosted at `jsbg.ca/printing` via GitHub Pages — a personal 3D printing side project, separate from the main jsbg.ca business. No build system, no framework, no package manager. Open HTML files directly in a browser to preview.

**Hosting constraints (GitHub Pages, free tier):**
- Static files only — no server-side code, no databases, no backend
- No server-side redirects (`.htaccess` etc. won't work; use `<meta http-equiv="refresh">` or JS for any redirects if needed)
- All internal links use absolute root-relative paths (`/products.html`, `/css/printing.css`). This works when the repo root maps to the domain/subdomain root. If deployed to a subpath (e.g. `jsbg.ca/printing/`), add `<base href="/printing/">` to every page `<head>`.

**Isolation:** This site stands completely alone. No shared nav, no links to jsbg.ca, no shared assets with the main site.

## Site Structure

```
/                            ← repo root = domain root when deployed
├── index.html               ← homepage
├── products.html            ← product listing grid
├── custom.html              ← custom print requests
├── css/
│   └── printing.css         ← entire design system (all tokens here)
├── images/
│   ├── site/                ← branding: icon-noBG.png, logo-noBG.png, logo-slogan-noBG.png
│   └── apologies-game/      ← Apologies Game gallery photos (15 .jpg files)
├── products/                ← one subfolder per product
│   ├── desktoys/index.html
│   ├── organizers/index.html
│   ├── spikes/index.html
│   └── apologies-game/
│       ├── index.html       ← product detail + gallery
│       └── rules/
│           ├── index.html   ← full rules page
│           ├── print.html   ← print-optimized rules
│           └── *.jpg        ← rules diagram images (5 files)
├── PRODUCT.md
├── DESIGN.md
└── CLAUDE.md
```

Adding a new product: create `products/[name]/index.html` and add a card to `products.html`. See `ADDING-PRODUCTS.md` for the full checklist. Product images go in `images/[name]/`.

## Design System (`printing.css`)

All visual tokens are CSS custom properties on `:root`. Do not hardcode colors or fonts.

**Palette:**
- `--primary`: Hot Pink `#ac2471`
- `--primary-container`: Pink `#ff69b4`
- `--secondary-container`: Sun Yellow `#fcd400`
- `--tertiary-container`: Sky Blue `#00abe5`
- `--quaternary`: Lime Green `#4ade80`
- `--true-black`: `#000000`

**Typography:**
- `--font-display`: Bricolage Grotesque (headings, brand mark)
- `--font-body`: Plus Jakarta Sans (body text)
- `--font-label`: Space Grotesk (nav, badges, uppercase labels)

**Elevation (pop-art style — no blurred shadows):**
- `--hard-shadow`: `6px 6px 0px 0px var(--true-black)`
- `--hard-shadow-sm`: `4px 4px 0px 0px var(--true-black)`
- `--border-bold`: `3px solid var(--true-black)`

Hover states use offset translation (`transform: translate(-2px, -2px)`) combined with increased shadow, not color change alone. Interactive elements always have a hard-shadow + bold-border treatment.

## Purchase Flow

There is no shopping cart or payment system. All purchasing is via email to `printing@jsbg.ca`. CTAs should use `mailto:printing@jsbg.ca` with a pre-filled `?subject=` where relevant.

## Brand Rules (from DESIGN.md / PRODUCT.md)

- Unapologetically vibrant pop-art aesthetic — inspired by Takashi Murakami's energy, **not** his copyrighted artwork
- Flat surfaces with depth conveyed via offset hard shadows and snappy hover transitions, not blurred/realistic shadows
- 3–4 palette colors used deliberately; do not retreat to neutrals
- Dark mode is a stated goal (not yet implemented)
- Reject: corporate/SaaS aesthetics, excessive scroll-driven animations, trapped scrolling workflows
