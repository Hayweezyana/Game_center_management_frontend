/* eslint-disable no-console */
/**
 * Post-build: the Immersion Technologies section at /technologies.
 *
 * Immersion Technologies is Immersia's software studio, so it lives on the same
 * domain but deliberately outside the arcade app — no React bundle, no arcade
 * theme, WhatsApp button or Meta pixel. Each page is plain static HTML that
 * crawlers and link previews can read without running JavaScript.
 *
 * Writes into the build folder:
 *   technologies/index.html          landing page — studio, proof, all work
 *   technologies/<slug>/index.html   one case study per project
 * and adds those URLs to sitemap.xml (created by prerender-rentals.js).
 *
 * Copy comes from scripts/technologies/content.js. Static assets (stylesheet,
 * script, screenshots) live in public/technologies/ and are copied by CRA.
 * public/_redirects maps the clean URLs onto these files ahead of the SPA
 * fallback. Runs automatically as part of npm's `postbuild`.
 */
const fs = require('fs');
const path = require('path');
const C = require('./technologies/content');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.resolve(ROOT, process.env.BUILD_PATH || 'build');
const SITE_URL = ((process.env.REACT_APP_SITE_URL || '').trim() || 'https://immersiavr.com').replace(/\/+$/, '');
const BASE = C.STUDIO.basePath;
const ASSETS = `${BASE}/assets`;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const abs = (p) => `${SITE_URL}${p}`;
const projectPath = (p) => `${BASE}/${p.slug}`;
const hue = (sector) => C.SECTOR_HUES[sector] || '#6D7684';
const dotClass = (s) => (s === 'Live' ? 'live' : s === 'Offline' ? 'off' : s === 'Delivered' ? 'done' : '');
const statusLabel = (p) => p.status + (p.statusNote ? ` · ${p.statusNote}` : '');
const waUrl = (text) => `https://wa.me/${C.STUDIO.whatsapp}?text=${encodeURIComponent(text)}`;
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const ORG = {
  '@type': 'Organization',
  '@id': `${abs(BASE)}#org`,
  name: C.STUDIO.name,
  url: abs(BASE),
  logo: `${SITE_URL}/logo512.png`,
  email: C.STUDIO.email,
  description: C.SEO.description,
  address: { '@type': 'PostalAddress', addressLocality: 'Lagos', addressRegion: 'Lagos', addressCountry: 'NG' },
  parentOrganization: { '@type': 'Organization', name: 'Immersia', url: `${SITE_URL}/` },
  contactPoint: { '@type': 'ContactPoint', email: C.STUDIO.email, telephone: `+${C.STUDIO.whatsapp}`, contactType: 'sales' },
};

// ── Shared chrome ───────────────────────────────────────────────────────────
function head({ title, description, pathname, image, ld }) {
  const url = abs(pathname);
  return `<!doctype html>
<html lang="en-NG" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0A0D13" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#E7E9ED" media="(prefers-color-scheme: light)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(C.STUDIO.name)}">
<meta property="og:locale" content="en_NG">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(abs(image))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(abs(image))}">
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300&display=swap">
<link rel="stylesheet" href="${BASE}/technologies.css">
<script>try{var t=localStorage.getItem('it-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
${jsonLd({ '@context': 'https://schema.org', '@graph': ld })}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>`;
}

function siteHeader(active) {
  const cur = (k) => (active === k ? ' aria-current="page"' : '');
  return `
<header class="site-head">
  <div class="wrap bar">
    <a class="mark" href="${BASE}">
      <span class="glyph" aria-hidden="true">IT</span>
      <span><b>${esc(C.STUDIO.name)}</b><i>${esc(C.STUDIO.tagline)}</i></span>
    </a>
    <nav class="hnav" aria-label="Immersion Technologies">
      <a href="${BASE}#work"${cur('work')}>Work</a>
      <a class="hide-sm" href="${BASE}#practice">Practice</a>
      <a class="hide-sm" href="#contact">Contact</a>
      <a class="hide-sm" href="/">Immersia&nbsp;VR&nbsp;↗</a>
    </nav>
    <button class="themebtn" id="theme" type="button" aria-label="Switch colour theme" title="Switch colour theme">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 0 1 11.2 3a7 7 0 1 0 9.8 9.8z"/></svg>
    </button>
  </div>
</header>`;
}

function siteFooter(enquiry) {
  return `
<footer class="site-foot wrap" id="contact">
  <div class="foot-grid rv">
    <div>
      <p class="eyebrow">Next</p>
      <h2>${esc(C.CONTACT_COPY.title)}</h2>
      <p class="prose">${esc(C.CONTACT_COPY.body)}</p>
    </div>
    <div class="contact">
      <p class="eyebrow" style="margin-bottom:2px">Get in touch</p>
      <a href="${esc(waUrl(enquiry))}" target="_blank" rel="noopener">WhatsApp · ${esc(C.STUDIO.phoneDisplay)}</a>
      <a href="mailto:${esc(C.STUDIO.email)}?subject=${encodeURIComponent('Project enquiry — Immersion Technologies')}">${esc(C.STUDIO.email)}</a>
    </div>
  </div>
  <div class="colophon">
    <span>${esc(C.STUDIO.name)} · An Immersia company · Lagos, Nigeria</span>
    <span>Figures are live production values as at ${esc(C.FIGURES_AS_AT)}</span>
    <span><a href="/">← immersiavr.com</a></span>
  </div>
</footer>
<script src="${BASE}/technologies.js" defer></script>
</body>
</html>
`;
}

function frame(p, img, { lazy, alt } = {}) {
  const [file, w, h] = img;
  return `<div class="frame">
      <div class="frame-bar"><i></i><i></i><i></i><span class="frame-url">${esc(p.domain)}</span></div>
      <div class="frame-shot"><img src="${ASSETS}/${file}" width="${w}" height="${h}" alt="${esc(alt || '')}"${lazy ? ' loading="lazy" decoding="async"' : ''} style="object-position:${p.focus || 'top left'}"></div>
    </div>`;
}

const metricsHTML = (p) =>
  p.metrics.map(([k, v]) => `<div><span class="mk">${esc(k)}</span><span class="mv">${esc(v)}</span></div>`).join('');

function featureHTML([title, detail]) {
  const sep = /^[,;:]/.test(detail) ? '' : /[.]$/.test(title) ? ' ' : ' — ';
  return `<li><span><b>${esc(title)}</b>${sep}${esc(detail)}</span></li>`;
}

// ── Landing ─────────────────────────────────────────────────────────────────
function landingPage() {
  const P = C.PROJECTS;
  const strip = P.flatMap((p) => p.images.slice(0, 2).map((img) => frame(p, img, { lazy: true })));
  const sectors = [...new Set(P.map((p) => p.sector))].sort();

  const ld = [
    ORG,
    {
      '@type': 'WebPage', '@id': `${abs(BASE)}#webpage`, url: abs(BASE), name: C.SEO.title,
      description: C.SEO.description, inLanguage: 'en-NG', about: { '@id': ORG['@id'] },
      primaryImageOfPage: abs(C.SEO.ogImage),
    },
    {
      '@type': 'ItemList', name: 'Selected work', numberOfItems: P.length,
      itemListElement: P.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(projectPath(p)), name: p.name })),
    },
  ];

  return `${head({ title: C.SEO.title, description: C.SEO.description, pathname: BASE, image: C.SEO.ogImage, ld })}
${siteHeader('home')}

<main id="main">
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="eyebrow">${esc(C.HERO.eyebrow)}</p>
        <h1 class="thesis">We build the software businesses <i>actually run on.</i></h1>
        <p class="prose">${esc(C.HERO.lead)}</p>
      </div>
      <div class="ledger" role="group" aria-label="Studio ledger">
        <div class="ledger-head">
          <span class="eyebrow">Studio ledger</span>
          <span class="eyebrow" style="display:flex;align-items:center;gap:7px"><span class="pulse" aria-hidden="true"></span>Live</span>
        </div>
        ${C.HERO.ledger.map((r) => `<div class="ledger-row"><span class="k">${esc(r.k)}</span><span class="v${r.gold ? ' gold' : ''}">${esc(r.v)}</span></div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <div class="marq" aria-hidden="true"><div class="marq-track">
    ${[...strip, ...strip].map((h) => `<div class="marq-item">${h}</div>`).join('\n    ')}
  </div></div>

  <section class="proof wrap" aria-labelledby="proof-h">
    <div class="sec-head rv">
      <div><p class="eyebrow">Live numbers</p><h2 id="proof-h">Not mockups. Production.</h2></div>
      <p class="eyebrow">As at ${esc(C.FIGURES_AS_AT)}</p>
    </div>
    <div class="proof-grid">
      ${C.PROOF.map((s) => `<a class="pcard rv" href="${BASE}/${s.slug}" style="--hue:${hue(s.sector)}">
        <span class="big">${esc(s.big)}</span>
        <span class="what">${esc(s.what)}</span>
        <span class="who">${esc(s.who)}</span>
        <span class="sub">${esc(s.sub)}</span>
      </a>`).join('\n      ')}
    </div>
  </section>

  <section class="wrap" id="work" aria-labelledby="work-h">
    <div class="sec-head rv">
      <div><p class="eyebrow">The work</p><h2 id="work-h">Ten products, by sector</h2></div>
      <p class="eyebrow" id="count" aria-live="polite">Showing ${P.length}</p>
    </div>
    <div class="rail" id="rail" role="group" aria-label="Filter work by sector" hidden>
      <button class="chip" type="button" data-f="all" aria-pressed="true">All <span class="ct">${P.length}</span></button>
      ${sectors.map((s) => `<button class="chip" type="button" data-f="${esc(s)}" style="--hue:${hue(s)}" aria-pressed="false"><i></i>${esc(s)} <span class="ct">${P.filter((p) => p.sector === s).length}</span></button>`).join('\n      ')}
    </div>
    <div class="grid" id="grid">
      ${P.map((p, i) => {
        const n = p.images.length + (p.video ? 1 : 0);
        // First two and last two run wide, so ten cards fill rows of 2 / 3 / 3 / 2.
        const wide = i < 2 || i >= P.length - 2;
        return `<a class="card rv${wide ? ' feat' : ''}" href="${projectPath(p)}" data-sector="${esc(p.sector)}" style="--hue:${hue(p.sector)}">
        ${frame(p, p.images[0], { lazy: i > 1, alt: `${p.name} — ${p.domain}` })}
        <div class="card-body">
          <div class="card-top">
            <span class="sector"><i></i>${pad(i + 1)} · ${esc(p.sector)}</span>
            <span class="status"><span class="dot ${dotClass(p.status)}"></span>${esc(statusLabel(p))}</span>
          </div>
          <h3>${esc(p.name)}</h3>
          <p class="line">${esc(p.line)}</p>
          <div class="metrics">${metricsHTML(p)}</div>
          <span class="more">${n} screen${n === 1 ? '' : 's'} · read the case study →</span>
        </div>
      </a>`;
      }).join('\n      ')}
    </div>
  </section>

  <section class="band" id="practice" aria-labelledby="practice-h">
    <div class="wrap">
      <div class="sec-head rv"><div><p class="eyebrow">Practice</p><h2 id="practice-h">How the work tends to go</h2></div></div>
      <div class="cols rv">
        ${C.PRACTICE.map((c, i) => `<div><span class="eyebrow">${pad(i + 1)} · ${esc(c.kicker)}</span><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></div>`).join('\n        ')}
      </div>
      <p class="eyebrow" style="margin-top:42px">Worked with</p>
      <div class="stacklist rv">${C.STACK.map((s) => `<span class="tech">${esc(s)}</span>`).join('')}</div>
    </div>
  </section>

  <section class="parent" aria-labelledby="parent-h">
    <div class="wrap parent-grid rv">
      <a class="plogo" href="/"><img src="${ASSETS}/immersiaLogo.png" width="640" height="210" loading="lazy" alt="Immersia — Virtual Reality. feel. everything."></a>
      <div>
        <p class="eyebrow">Parent company</p>
        <h2 id="parent-h">An Immersia company.</h2>
        <p class="prose">${esc(C.PARENT.body)}</p>
        <div class="lineage">${C.PARENT.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        <a class="backlink" href="/">Visit Immersia VR →</a>
      </div>
    </div>
  </section>
</main>
${siteFooter("Hi Immersion Technologies, I'd like to talk about a project.")}`;
}

// ── Case study ──────────────────────────────────────────────────────────────
function casePage(p, i) {
  const P = C.PROJECTS;
  const prev = P[(i - 1 + P.length) % P.length];
  const next = P[(i + 1) % P.length];
  const url = projectPath(p);
  const total = p.images.length;
  const shotAlt = (n) => `${p.name} — screen ${n} of ${total}`;
  const title = `${p.name} — ${p.sector} case study | ${C.STUDIO.name}`;

  const items = [
    ...(p.video ? [{ type: 'video', src: `${ASSETS}/${p.video}`, label: `${p.domain} · film` }] : []),
    ...p.images.map(([file, w, h], n) => ({ type: 'img', src: `${ASSETS}/${file}`, w, h, alt: shotAlt(n + 1), label: p.domain })),
  ];
  const first = items[0];
  const stage = first.type === 'video'
    ? `<video src="${first.src}" poster="${ASSETS}/${p.images[0][0]}" controls autoplay muted loop playsinline preload="metadata"></video>`
    : `<img src="${first.src}" width="${first.w}" height="${first.h}" alt="${esc(first.alt)}" fetchpriority="high">`;

  const ld = [
    ORG,
    {
      '@type': 'CreativeWork', '@id': `${abs(url)}#work`, url: abs(url), name: p.name,
      headline: `${p.name} — ${p.line}`, description: p.line, abstract: p.prose,
      genre: p.sector, inLanguage: 'en-NG', creator: { '@id': ORG['@id'] },
      image: p.images.map(([f]) => abs(`${ASSETS}/${f}`)),
      keywords: p.stack.join(', '),
      ...(p.url ? { sameAs: p.url } : {}),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: C.STUDIO.name, item: abs(BASE) },
        { '@type': 'ListItem', position: 2, name: 'Work', item: `${abs(BASE)}#work` },
        { '@type': 'ListItem', position: 3, name: p.name, item: abs(url) },
      ],
    },
  ];

  return `${head({ title, description: p.line, pathname: url, image: `${ASSETS}/${p.images[0][0]}`, ld })}
${siteHeader('work')}

<main id="main" style="--hue:${hue(p.sector)}">
  <section class="cs-hero">
    <div class="wrap">
      <nav class="crumbs eyebrow" aria-label="Breadcrumb">
        <a href="${BASE}">${esc(C.STUDIO.name)}</a><span aria-hidden="true">/</span>
        <a href="${BASE}#work">Work</a><span aria-hidden="true">/</span>
        <span aria-current="page">${pad(i + 1)} of ${pad(P.length)}</span>
      </nav>
      <div class="card-top">
        <span class="sector"><i></i>${pad(i + 1)} · ${esc(p.sector)}</span>
        <span class="status"><span class="dot ${dotClass(p.status)}"></span>${esc(statusLabel(p))}</span>
      </div>
      <h1>${esc(p.name)}</h1>
      <p class="lede">${esc(p.line)}</p>
      <div class="statstrip">${metricsHTML(p)}</div>
    </div>
  </section>

  <section class="wrap gallery" aria-label="Screens">
    <div class="frame">
      <div class="frame-bar"><i></i><i></i><i></i><span class="frame-url" id="stageUrl">${esc(first.label)}</span></div>
      <div class="frame-shot" id="stage">${stage}</div>
    </div>
    ${items.length > 1 ? `<div class="thumbs" id="thumbs" role="group" aria-label="Choose a screen">
      ${items.map((it, n) => `<button type="button" aria-current="${n === 0}" data-type="${it.type}" data-src="${it.src}" data-label="${esc(it.label)}"${it.type === 'img' ? ` data-w="${it.w}" data-h="${it.h}" data-alt="${esc(it.alt)}"` : ''} aria-label="${it.type === 'video' ? 'Play the film' : `Show screen ${n + 1 - (p.video ? 1 : 0)}`}">${it.type === 'video' ? '<span class="vthumb">▶ FILM</span>' : `<img src="${it.src}" alt="" loading="lazy" decoding="async">`}</button>`).join('\n      ')}
    </div>` : ''}
  </section>

  <div class="wrap cs-body">
    <div class="cs-main">
      <p class="prose rv">${esc(p.prose)}</p>
      <section class="rv" aria-labelledby="feat-h">
        <h2 id="feat-h">${esc(p.featTitle)}</h2>
        <ul class="feat">${p.features.map(featureHTML).join('')}</ul>
      </section>
      ${p.note ? `<p class="note rv">${esc(p.note)}</p>` : ''}
    </div>
    <aside class="cs-side" aria-label="Project facts">
      <dl>
        <div><dt>Sector</dt><dd>${esc(p.sector)}</dd></div>
        <div><dt>Status</dt><dd>${esc(statusLabel(p))}</dd></div>
        <div><dt>Built by</dt><dd>${esc(C.STUDIO.name)}</dd></div>
      </dl>
      <div>
        <p class="eyebrow">Built with</p>
        <div class="stacklist">${p.stack.map((s) => `<span class="tech">${esc(s)}</span>`).join('')}</div>
      </div>
      ${p.url
        ? `<a class="visit" href="${esc(p.url)}" target="_blank" rel="noopener">Visit ${esc(p.url.replace(/^https?:\/\/(www\.)?/, ''))} ↗</a>`
        : `<p class="eyebrow">No public link — shown as a case study</p>`}
      <a class="visit ghost" href="#contact">Build something like this →</a>
    </aside>
  </div>

  <nav class="wrap pager" aria-label="More work">
    <a class="prev" href="${projectPath(prev)}" style="--hue:${hue(prev.sector)}"><span class="eyebrow">← Previous · ${esc(prev.sector)}</span><b>${esc(prev.name)}</b></a>
    <a class="next" href="${projectPath(next)}" style="--hue:${hue(next.sector)}"><span class="eyebrow">Next · ${esc(next.sector)} →</span><b>${esc(next.name)}</b></a>
  </nav>
</main>
${siteFooter(`Hi Immersion Technologies, I saw ${p.name} and I'd like to talk about a project.`)}`;
}

// ── Sitemap ─────────────────────────────────────────────────────────────────
function addToSitemap(paths) {
  const file = path.join(BUILD, 'sitemap.xml');
  const today = new Date().toISOString().slice(0, 10);
  const entries = paths
    .map((p, i) => `  <url>\n    <loc>${esc(abs(p))}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${i === 0 ? '0.8' : '0.6'}</priority>\n  </url>`)
    .join('\n');
  let xml = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8')
    : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';
  if (xml.includes(`<loc>${esc(abs(BASE))}</loc>`)) return; // already added on a previous run
  xml = xml.replace('</urlset>', `${entries}\n</urlset>`);
  fs.writeFileSync(file, xml);
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(BUILD)) {
    console.warn(`[build-technologies] ${BUILD} not found — skipping.`);
    return;
  }
  const slugs = new Set();
  for (const p of C.PROJECTS) {
    if (slugs.has(p.slug)) throw new Error(`duplicate slug ${p.slug}`);
    slugs.add(p.slug);
    for (const [file] of p.images) {
      if (!fs.existsSync(path.join(ROOT, 'public', 'technologies', 'assets', file))) {
        throw new Error(`missing asset public/technologies/assets/${file} for ${p.slug}`);
      }
    }
  }

  const out = path.join(BUILD, 'technologies');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), landingPage());
  C.PROJECTS.forEach((p, i) => {
    fs.mkdirSync(path.join(out, p.slug), { recursive: true });
    fs.writeFileSync(path.join(out, p.slug, 'index.html'), casePage(p, i));
  });
  addToSitemap([BASE, ...C.PROJECTS.map(projectPath)]);

  console.log(`[build-technologies] wrote ${C.PROJECTS.length + 1} pages under ${out} for ${abs(BASE)}`);
}

main();
