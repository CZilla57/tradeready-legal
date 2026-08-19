# TradeReady Guides — Editorial & Build Standard

Internal reference for anyone writing or editing a guide under `/guides/`.
Not a published page (unlinked, not in the sitemap). The public expression of
these rules lives in [`about.html`](about.html); this file is the contributor
checklist behind it.

Last updated: 2026-08-19.

---

## 1. Voice

- Plain English, direct, practical. Write for a tradesperson on a lunch break.
- No jargon for its own sake, no padding, no hype.
- Second person ("you"), active voice, short sentences.
- Match the existing guides' rhythm — read one before writing a new one.

## 2. Truthfulness (non-negotiable)

Never invent any of the following:

- Rates, statistics, percentages, or "average" figures presented as fact.
- Legal, tax, or licensing requirements.
- Author or reviewer credentials.
- Customer research, testimonials, ratings, or download counts.
- Product capabilities TradeReady does not have.

Rules that follow from this:

- **Market ranges are estimates, not surveys.** Any "$X–$Y an hour" figure is a
  marketplace estimate offered as a sanity-check. Label it as such (see §6) and
  link to the methodology. Never dress it up as a statistic.
- **Worked examples are illustrative.** Numbers in a build-up or worked example
  are chosen to show the method, not pulled from a real business. Label them
  "Illustrative example" (see §6).
- **Byline is organizational.** Guides are "By the TradeReady team." TradeReady
  is built by its founder, Chad Rector, a software developer — *not* a licensed
  tradesperson. Do not manufacture an individual expert byline.
- **Wage/occupational facts cite a primary source.** Prefer government sources.
  For US trade wages, link the BLS Occupational Outlook Handbook (§7). Note that
  BLS reports *employee wages*, which differ from a self-employed billing rate —
  don't conflate them.

## 3. Page skeleton

Every guide is a standalone HTML file that links the shared stylesheet — there
is **no inline `<style>` block**.

```html
<link rel="stylesheet" href="/guides/guides.css">
```

Required `<head>`: `<title>`, `<meta name="description">`, `rel="canonical"`
(extensionless URL, e.g. `/guides/how-to-price-a-job`), Open Graph
(`og:title`/`og:description`/`og:image`/`og:url`/`og:type`), `twitter:card`,
`theme-color`, favicon + apple-touch-icon. Keep `canonical` and `og:url`
identical.

Structure: `.skip-link` → `.topbar` nav → `<main id="main">` →
`.article-head` (hero) → `<article class="prose">` → `<footer>`.

## 4. Metadata block (byline)

Visible dateline inside `.article-head`, replacing the old `.meta` line:

```html
<div class="byline">
  <span>By the <a href="/guides/about">TradeReady team</a></span>
  <span><time datetime="YYYY-MM-DD">Published Mon D, YYYY</time></span>
  <span><time datetime="YYYY-MM-DD">Last reviewed Mon D, YYYY</time></span>
  <span>N min read</span>
</div>
```

- **Published** = the date the guide first went live (use the first commit date;
  never backdate).
- **Last reviewed** = the date of the most recent real review/edit. Bump it
  whenever you touch the guide, and keep it in sync with `dateModified` (§5).

## 5. Article JSON-LD

Keep the `Article` block truthful and complete:

```json
"datePublished": "YYYY-MM-DD",
"dateModified":  "YYYY-MM-DD",
"author":    { "@type": "Organization", "name": "TradeReady", "url": "https://gettradereadyapp.com/guides/about" },
"publisher": { "@type": "Organization", "name": "TradeReady", "url": "https://gettradereadyapp.com/", "logo": { ... } }
```

Dates here must match the visible byline. Also keep the `BreadcrumbList` block.

## 6. Numeric ranges & example tables

Directly under any table of numbers, add a one-line note linking the methodology:

- Market range table (e.g. "typical pricing"):
  ```html
  <p class="est-note">Marketplace estimate, not a formal survey &mdash;
  <a href="/guides/about#methodology">how we source figures</a>.</p>
  ```
- Illustrative / worked-example / math table:
  ```html
  <p class="est-note">Illustrative example &mdash; figures chosen to show the
  method, not a quote. <a href="/guides/about#methodology">How we source figures</a>.</p>
  ```

## 7. Sources & notes + disclaimer

Near the end of the article, before "Keep reading":

```html
<section class="sources" aria-labelledby="sources-heading">
  <span class="eyebrow" id="sources-heading">Sources &amp; notes</span>
  <ul>
    <li>…marketplace-estimate / illustrative note + methodology link…</li>
    <li>…primary source for any factual claim…</li>
  </ul>
</section>

<div class="disclaimer">
  <strong>Educational, not advice.</strong> Rates vary by location, license
  level, job type, and market conditions, and business, tax, contract, and
  licensing requirements vary by jurisdiction. This guide is educational and
  isn't legal, tax, or accounting advice.
  <a href="/guides/about">How we research these guides</a>.
</div>
```

Verified primary sources for the trade guides (BLS Occupational Outlook Handbook):

| Trade | URL |
|-------|-----|
| Plumbers, Pipefitters, Steamfitters | `https://www.bls.gov/ooh/construction-and-extraction/plumbers-pipefitters-and-steamfitters.htm` |
| Electricians | `https://www.bls.gov/ooh/construction-and-extraction/electricians.htm` |
| HVACR mechanics & installers | `https://www.bls.gov/ooh/installation-maintenance-and-repair/heating-air-conditioning-and-refrigeration-mechanics-and-installers.htm` |
| OOH landing (general) | `https://www.bls.gov/ooh/` |

BLS deep OEWS `/oes/current/oes*.htm` links redirect and are **not** stable —
use the OOH pages above. Re-check any external URL before publishing.

## 8. FAQ — visible + structured must match

Never leave FAQ content only in JSON-LD. If a guide has a `FAQPage` block, render
a matching visible section with **verbatim** wording:

```html
<section class="faq" aria-labelledby="faq-heading">
  <h2 id="faq-heading">Common questions</h2>
  <h3>Question exactly as in JSON-LD?</h3>
  <p>Answer exactly as in JSON-LD.</p>
  <!-- …one h3/p per question… -->
</section>
```

The reliable way to guarantee a match is to generate the visible section from the
`FAQPage` JSON-LD (that is how the current set was built). If you can't render it
visibly, remove the `FAQPage` markup instead.

## 9. Tables

No div-based fake tables. Use native semantics:

- Data/comparison tables: `<table class="rate">` wrapped in `.table-scroll`, with
  `<caption>`, `<thead>` + `<th scope="col">`, and `<th scope="row">` for row labels.
- Receipt/summary "calc" tables: a `<table>` inside `.calc`, with `<caption>` and
  `<th scope="row">` on the label cell. Add `class="rule"` / `class="total"` on a
  `<tr>` for the dividing/total row.

## 10. App Store badge

Use Apple's official artwork, self-hosted — never redraw it:

```html
<a class="store-badge" href="https://apps.apple.com/app/id6790681059"
   aria-label="Download TradeReady on the App Store">
  <img src="/images/app-store-badge.svg" alt="" width="120" height="40">
</a>
```

The link carries the accessible name via `aria-label`, so the `<img>` is
decorative (`alt=""`). The badge's grey border + white lettering read on both
light and dark cards. If Apple's artwork is refreshed, replace the file, keep the
markup.

## 11. Styling

All styles live in [`guides.css`](guides.css). Add new components there, not
inline. Page-specific needs are scoped with a class (e.g. `body.guides-index`).
Keep the design tokens (`:root` custom properties, light + dark) intact.

CSP note: the site's `_headers` allows `img-src 'self' data:`, `font-src 'self'`,
`style-src 'self' 'unsafe-inline'`. A self-hosted stylesheet, font, and SVG are
all fine. **Any new external host must be added to the `_headers` allowlist** or
it is silently blocked.

## 12. Pre-publish checklist

- [ ] Links `guides.css`; no inline `<style>`.
- [ ] Byline present with truthful Published + Last-reviewed dates.
- [ ] `datePublished`/`dateModified` in Article JSON-LD match the byline.
- [ ] `author.url` → `/guides/about`, `publisher.url` → site root.
- [ ] Every numeric table has an `est-note` (marketplace or illustrative).
- [ ] Sources & notes + disclaimer present; any external URL re-verified.
- [ ] Every `FAQPage` question rendered visibly, verbatim; counts match.
- [ ] All tables native (`<table>`/`<caption>`/`<th scope>`), no `role="table"` divs.
- [ ] Official App Store badge `<img>`, link keeps `aria-label`.
- [ ] `<title>`, description, canonical, OG present; canonical == og:url.
- [ ] One `<h1>`; heading levels don't skip.
- [ ] No horizontal overflow at 375px; footer/nav collapse correctly.
- [ ] Skip-link works; `:focus-visible` visible; no positive `tabindex`.
- [ ] All internal links resolve.
- [ ] Add the URL to `/sitemap.xml` (extensionless).
- [ ] No invented rates, stats, credentials, research, or capabilities.
