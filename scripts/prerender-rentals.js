/* eslint-disable no-console */
/**
 * Post-build SEO for /rentals.
 *
 * The app is a client-rendered SPA, so every URL ships the same index.html:
 * title "Immersia POS", no description, an empty <div id="root">. Link
 * previews (WhatsApp, Facebook, X) never run JavaScript, and Google indexes
 * JS-only pages slowly and less reliably.
 *
 * This writes build/rentals.html — index.html with a rentals-specific head
 * (title, description, canonical, Open Graph, JSON-LD) and the catalogue as
 * plain HTML inside #root. React replaces that markup when it mounts, so
 * visitors see the normal page; crawlers and link previews get real content.
 * It also writes sitemap.xml and adds a Sitemap line to robots.txt.
 *
 * Copy comes from src/components/rentals/rentalsCatalog.ts so it can't drift
 * from what the page shows. Runs automatically as npm's `postbuild`.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.resolve(ROOT, process.env.BUILD_PATH || 'build');

// ── Load the catalogue (TypeScript) without a separate build step ──────────
function loadCatalog() {
  const file = path.join(ROOT, 'src/components/rentals/rentalsCatalog.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  });
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', 'process', outputText)(mod, mod.exports, require, process);
  return mod.exports;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function main() {
  const indexPath = path.join(BUILD, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn(`[prerender-rentals] ${indexPath} not found — skipping.`);
    return;
  }
  const { CATEGORIES, CONTACT, FAQS, REVIEWS, SEO, SITE_URL } = loadCatalog();
  const pageUrl = `${SITE_URL}${SEO.path}`;
  const ogImage = `${SITE_URL}${SEO.ogImage}`;
  const waUrl = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent("Hi Immersia! I'd like to book rentals for my event.")}`;

  // ── Structured data ──────────────────────────────────────────────────────
  // Services rather than Products: there are no prices, and Product markup
  // without an offer price only earns Search Console warnings.
  const business = {
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#immersia-rentals`,
    name: 'Immersia Rentals',
    alternateName: ['Immersia XR Studios', 'Immersia Virtual Reality'],
    description: SEO.description,
    url: pageUrl,
    image: ogImage,
    logo: `${SITE_URL}/logo512.png`,
    telephone: CONTACT.phone,
    address: { '@type': 'PostalAddress', addressLocality: 'Lagos', addressRegion: 'Lagos', addressCountry: 'NG' },
    areaServed: { '@type': 'City', name: 'Lagos' },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: CONTACT.phone,
      contactType: 'sales',
      availableLanguage: ['en'],
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Event equipment rentals',
      itemListElement: CATEGORIES.map((c) => ({
        '@type': 'OfferCatalog',
        name: c.name,
        itemListElement: c.items.map((it) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: `${it.name} rental`,
            description: it.blurb,
            ...(it.thumb ? { image: `${SITE_URL}${it.thumb}` } : {}),
            areaServed: 'Lagos',
          },
        })),
      })),
    },
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      business,
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: SEO.title,
        description: SEO.description,
        inLanguage: 'en-NG',
        primaryImageOfPage: ogImage,
        about: { '@id': business['@id'] },
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  // ── <head> ───────────────────────────────────────────────────────────────
  const head = [
    `<title>${esc(SEO.title)}</title>`,
    `<meta name="description" content="${esc(SEO.description)}"/>`,
    `<link rel="canonical" href="${esc(pageUrl)}"/>`,
    '<meta name="robots" content="index,follow,max-image-preview:large"/>',
    '<meta property="og:type" content="website"/>',
    '<meta property="og:site_name" content="Immersia Rentals"/>',
    '<meta property="og:locale" content="en_NG"/>',
    `<meta property="og:url" content="${esc(pageUrl)}"/>`,
    `<meta property="og:title" content="${esc(SEO.title)}"/>`,
    `<meta property="og:description" content="${esc(SEO.description)}"/>`,
    `<meta property="og:image" content="${esc(ogImage)}"/>`,
    '<meta property="og:image:width" content="1200"/>',
    '<meta property="og:image:height" content="630"/>',
    '<meta property="og:image:alt" content="Immersia Rentals — VR, photo booths and party rides in Lagos"/>',
    '<meta name="twitter:card" content="summary_large_image"/>',
    `<meta name="twitter:title" content="${esc(SEO.title)}"/>`,
    `<meta name="twitter:description" content="${esc(SEO.description)}"/>`,
    `<meta name="twitter:image" content="${esc(ogImage)}"/>`,
    '<meta name="geo.region" content="NG-LA"/>',
    '<meta name="geo.placename" content="Lagos"/>',
    '<link rel="preconnect" href="https://fonts.googleapis.com"/>',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>',
    '<link rel="preconnect" href="https://res.cloudinary.com"/>',
    // "<" escaped so catalogue text can never close the script tag early.
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('');

  // ── Static body (replaced by React on mount) ─────────────────────────────
  // Same words the live page shows; images are left to the live page so the
  // static copy doesn't download 40 photos React is about to throw away.
  const body = `
<div id="seo-static">
<style>#seo-static{background:#050913;color:#edf4ff;font:17px/1.55 system-ui,sans-serif;padding:32px 20px;max-width:1100px;margin:0 auto}#seo-static a{color:#00d1ff}#seo-static h1{font-size:2rem;margin:0 0 12px}#seo-static h2{margin:36px 0 10px}#seo-static li{margin:4px 0}#seo-static .k{color:#00d1ff;text-transform:uppercase;letter-spacing:.15em;font-size:.8rem;display:block}</style>
<header><h1><span class="k">VR, photo booth &amp; party rentals in Lagos</span>Immersia Rentals — see, feel everything.</h1>
<p>VR, simulators, holograms, photo booths, games and party rides for birthdays, weddings and corporate events across Lagos. Every booking is a 6-hour rental with technical support on site, and we set up at your venue.</p>
<p><a href="${esc(waUrl)}">Book on WhatsApp</a> · <a href="tel:${esc(CONTACT.phone)}">Call ${esc(CONTACT.phoneDisplay)}</a></p></header>
<main>
${CATEGORIES.map((c) => `<section><h2>${esc(c.name)}</h2><ul>${c.items
    .map((it) => `<li><strong>${esc(it.name)}</strong> — ${esc(it.blurb)}</li>`)
    .join('')}</ul></section>`).join('\n')}
<section><h2>How it works</h2><ol><li>Watch &amp; pick: browse the collection and watch each rental in action.</li><li>Message us: send your picks, event date and venue on WhatsApp or call us.</li><li>We bring the fun: we deliver, set up and stay on hand with tech support for your 6-hour booking.</li></ol></section>
<section><h2>What clients say</h2>${REVIEWS.map((r) => `<blockquote><p>“${esc(r.quote)}”</p><cite>${esc(r.name)}, ${esc(r.place)}</cite></blockquote>`).join('')}</section>
<section><h2>Frequently asked questions</h2>${FAQS.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>
</main>
<footer><p>Immersia XR Studios · Event rental services · Lagos, Nigeria · <a href="tel:${esc(CONTACT.phone)}">${esc(CONTACT.phoneDisplay)}</a></p></footer>
</div>`;

  let html = fs.readFileSync(indexPath, 'utf8');
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta\s+name="description"[^>]*>/, '')
    .replace('</head>', `${head}</head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  if (!html.includes('id="seo-static"')) throw new Error('could not inject rentals content into #root');
  fs.writeFileSync(path.join(BUILD, 'rentals.html'), html);

  // ── sitemap.xml + robots.txt ─────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    path.join(BUILD, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${esc(pageUrl)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
${CATEGORIES.flatMap((c) => c.items)
    .filter((it) => it.thumb)
    .filter((it, i, all) => all.findIndex((o) => o.thumb === it.thumb) === i)
    .map((it) => `    <image:image><image:loc>${esc(`${SITE_URL}${it.thumb}`)}</image:loc></image:image>`)
    .join('\n')}
  </url>
  <url>
    <loc>${esc(SITE_URL)}/</loc>
    <lastmod>${today}</lastmod>
    <priority>0.5</priority>
  </url>
</urlset>
`,
  );

  const robotsPath = path.join(BUILD, 'robots.txt');
  const robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : 'User-agent: *\nDisallow:\n';
  if (!/^Sitemap:/m.test(robots)) {
    fs.writeFileSync(robotsPath, `${robots.trimEnd()}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  }

  console.log(`[prerender-rentals] wrote rentals.html, sitemap.xml and robots.txt for ${pageUrl}`);
}

main();
