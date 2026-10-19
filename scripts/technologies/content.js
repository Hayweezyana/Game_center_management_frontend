/**
 * Immersion Technologies — the software arm of Immersia.
 *
 * Single source for the /technologies section: the landing page and one case
 * study per project. scripts/build-technologies.js turns this into static HTML
 * after `npm run build`. Copy follows "Immersion Technologies — Selected Work"
 * (figures as at 27 August 2026); edit here, never in the generated HTML.
 *
 * Images live in public/technologies/assets/ and are listed as
 * [file, width, height] so the pages can reserve space before they load.
 */

const FIGURES_AS_AT = '27 August 2026';

const STUDIO = {
  name: 'Immersion Technologies',
  tagline: 'An Immersia company · Lagos',
  basePath: '/technologies',
  whatsapp: '2348137013560',
  phoneDisplay: '0813 701 3560',
  email: 'engineering@immersiavr.com',
};

const SEO = {
  title: 'Immersion Technologies — Software Studio in Lagos | An Immersia Company',
  description:
    'Immersion Technologies is the software arm of Immersia. Point of sale, commerce, compliance, hiring and AI brand experiences built in Lagos — ten products, seven live, just under ₦350m taken through them.',
  ogImage: '/technologies/assets/pos-1.jpg',
};

const HERO = {
  eyebrow: 'Selected work · 2024–2026',
  lead:
    'Most of what we ship is unglamorous and load-bearing — the till that has to balance, the stock count that has to reconcile, the licence that expires on a date somebody forgot. We also build the other kind: AI experiences that put people inside a brand for three minutes. Ten products across eight sectors, seven of them live, and just under ₦350m taken through them.',
  ledger: [
    { k: 'Products shipped', v: '10' },
    { k: 'Live in production', v: '07' },
    { k: 'Sectors served', v: '08' },
    { k: 'Money through our systems', v: '₦349M+', gold: true },
  ],
};

const PROOF = [
  { big: '₦263.6M', what: 'booked through the storefront', who: 'Preorder with Seye', slug: 'preorder-with-seye', sub: '2,179 orders · 1.2K customers · ₦120,982 average order', sector: 'Commerce' },
  { big: '₦82.9M', what: 'processed across the arcade floor', who: 'Immersia POS', slug: 'immersia-pos', sub: '9,889 transactions · 6,438 customers since May 2025', sector: 'Operations' },
  { big: '404', what: 'users against 89 live job posts', who: 'GoHire', slug: 'gohire', sub: '334 candidates · 67 recruiters · 174 applications', sector: 'Hiring' },
  { big: '92.4%', what: 'gross margin, tracked live', who: 'Thegoodstuff', slug: 'thegoodstuff', sub: '₦2.7m in the month · 143 SKUs across branches', sector: 'Commerce' },
];

const PRACTICE = [
  { kicker: 'The money has to balance', title: 'Books before dashboards', body: 'Every commerce system we ship carries a real accounting layer — cost of goods, gross margin, daily P&L, exportable. A store owner should be able to answer “did I make money today” without a spreadsheet.' },
  { kicker: 'Assume someone will try', title: 'Internal control as a feature', body: 'Camera-verified counts reconciled against the till, audited bypass trails, role-scoped permissions, activity logs. The arcade system has five modules that exist only to make theft visible.' },
  { kicker: 'Nigeria is the constraint', title: 'Built for the rails that exist', body: 'Paystack and Moniepoint side by side. Card, transfer, USSD, POS and cash in the same order table. NIN identity verification. Naira and dollar pricing. SMS where email will not reach.' },
  { kicker: 'Ship, then stay', title: 'Admin is half the product', body: 'The public page is the smaller build. Behind every one of these is a console with staff accounts, permissions, reporting and an audit trail — because that is where the operator actually lives.' },
];

const STACK = [
  'TypeScript', 'React 18/19', 'Next.js', 'Vite', 'Node · Express', 'Knex · SQL', 'Socket.IO', 'Tailwind', 'MUI',
  'Paystack', 'Moniepoint', 'Shopify', 'Gemini 2.5', 'Vertex AI Imagen', 'Grok Imagine', 'SSE streaming',
  'Vercel', 'Netlify', 'Render', 'Cloudinary',
];

const PARENT = {
  body: 'Immersion Technologies is the software arm of Immersia, a virtual reality company in Lagos. Immersia POS was built for Immersia’s own arcade floor and now runs two further venue brands besides, and the AI & XR Bootcamp in the work above is Immersia’s own programme. Some of what we ship, we also operate — which is a way to find out what breaks, and a considerably more honest one.',
  tags: ['VR arcades', 'AI & XR education', 'Software studio', 'Lagos, Nigeria'],
};

const CONTACT_COPY = {
  title: 'Tell us what has to work.',
  body: 'We take on operational software — commerce, point of sale, compliance, booking, internal control — and AI-driven brand experiences. Send the problem rather than the spec; we will tell you honestly whether we are the right studio for it.',
};

/* Mid-tone sector hues, legible on either ground. */
const SECTOR_HUES = {
  Operations: '#7A6FC4',
  Commerce: '#C08A2E',
  Compliance: '#3F8F5F',
  'AI & Brand': '#C4543F',
  Hiring: '#2E8B8B',
  Health: '#4FA07A',
  Energy: '#C97A3A',
  Education: '#4A7FC4',
};

/*
 * features: [title, detail]. The renderer joins them with an em dash unless the
 * title ends a sentence or the detail continues one (starts with a comma).
 * focus: CSS object-position for crops — consoles read best from the top left,
 * centre-composed marketing pages from the top middle.
 */
const PROJECTS = [
  {
    slug: 'immersia-pos', name: 'Immersia POS', sector: 'Operations', status: 'Live',
    url: 'https://immersia-pos.netlify.app', domain: 'immersia-pos.netlify.app/admin',
    line: 'The operating system for a games arcade — tills, queues, PC assignment, and a loss-prevention layer that reconciles camera counts against the till.',
    metrics: [['Processed', '₦82.9M'], ['Transactions', '9,889'], ['Customers', '6,438'], ['Modules', '12']],
    prose: 'An arcade loses money in a dozen quiet ways: a session that never got rung up, a drink off the shelf, a PC unlocked as a favour. Immersia POS closes those gaps. It runs the floor — game selection, the operator queue, PC lock and release, tickets, drinks — and then it runs the audit on top, because the hard part of a venue business is not taking payment, it is knowing that everything taken was recorded. It has been running the floor since May 2025 and has processed just under ₦83m in that time.',
    featTitle: 'The twelve modules',
    features: [
      ['PC Control', 'lock or unlock machines and watch live status across the floor.'],
      ['Operator Queue', 'verify payment, then assign the customer to an available PC.'],
      ['Bypass Logs', 'every emergency override recorded and reviewable.'],
      ['Games', 'catalogue, pricing and time slots.'],
      ['Drinks', 'stock levels and inventory updates.'],
      ['Reports', 'analytics plus sales, customer and consumed-game reporting.'],
      ['Admins', 'accounts and per-role permissions; the console shows only what your role owns.'],
      ['Manual Transaction', 'manual and split transactions recorded from the desk.'],
      ['Internal Control — Entry', 'camera-review counts filed by station, editable for 24 hours.'],
      ['Internal Control — Review', 'recorded counts compared against actual sales, colour-coded by variance.'],
      ['Table Tennis Score', 'live scoring that customers watch on a public scoreboard.'],
      ['Credit Report', 'outstanding balances tracked and cleared when customers pay.'],
    ],
    stack: ['React 18', 'MUI', 'Tailwind', 'Socket.IO', 'Node · TypeScript', 'Express', 'Knex', 'Paystack', 'Recharts', 'jsPDF', 'XLSX export'],
    note: 'Live since 1 May 2025: ₦82,948,600 processed across 9,889 transactions and 6,438 unique customers, 23,041 games played, at an ₦8,388 average ticket. Five of the twelve modules exist purely for loss prevention — camera-verified counts, a 24-hour edit window, colour-coded variance review, an audited bypass trail and credit tracking. That reconciliation loop is the hardest thing in this portfolio to copy.',
    images: [['pos-1.jpg', 1280, 571], ['pos-2.jpg', 1280, 571], ['pos-3.jpg', 1280, 571], ['pos-4.jpg', 1280, 571], ['pos-5.jpg', 1280, 571]],
  },
  {
    slug: 'preorder-with-seye', name: 'Preorder with Seye', sector: 'Commerce', status: 'Live',
    url: 'https://www.preorderwithseyehub.com', domain: 'pw-seye.vercel.app/admin',
    line: 'Pre-order import commerce: customers buy months ahead, stock arrives in batches, and the ledger has to hold the whole way through.',
    metrics: [['Booked', '₦263.6M'], ['Orders', '2,179'], ['Customers', '1.2K'], ['AOV', '₦120,982']],
    prose: 'Pre-order retail breaks ordinary commerce software. Money arrives two to three months before goods do, orders are grouped into import runs rather than shipped one by one, and shipping is priced on arrival by size and weight. So the storefront runs on Shopify and everything that matters runs on a custom console behind it — batches, stock, customers and eight reporting modules that answer the questions a pre-order business actually asks.',
    featTitle: 'Inside the console',
    features: [
      ['Batches', 'orders grouped by import run, the concept ordinary commerce tools have no word for.'],
      ['Inventory', 'stock levels and full movement history, SKU and variant level, with per-product thresholds and inline adjustment.'],
      ['Orders Collection', 'monthly breakdown with item collation, customer detail and CSV export.'],
      ['Product Sales Analytics', 'units, revenue and current stock down to the variant.'],
      ['Customer Insights', 'segments, lifetime value and acquisition trends.'],
      ['Conversion Funnel', 'cart to checkout to payment success.'],
      ['Sales by City', 'geographic distribution of orders and revenue.'],
      ['Discount Usage', 'redemption rates and revenue impact.'],
      ['Inventory Health', 'turnover rate and dead stock.'],
      ['Audit Logs and Team', 'who changed what, and who is allowed to.'],
    ],
    stack: ['Next.js', 'Vercel', 'Shopify Storefront', 'CSV / XLSX export'],
    note: '₦263,619,358.58 booked across 2,179 orders and 1.2K customers, with unpaid pre-orders tracked separately — the dashboard distinguishes booked from paid, because in pre-order those are months apart.',
    images: [['preorder-1.jpg', 1280, 571], ['preorder-2.jpg', 1280, 571], ['preorder-3.jpg', 1280, 571]],
  },
  {
    slug: 'thegoodstuff', name: 'Thegoodstuff', sector: 'Commerce', status: 'Live',
    url: 'https://thegoodstuff.com.ng', domain: 'thegoodstuff.com.ng/dashboard',
    line: 'Multi-store retail with real books — daily P&L, stock transfers between branches, and access scoped down to the individual permission.',
    metrics: [['Revenue / mo', '₦2,706,000'], ['Gross margin', '92.4%'], ['SKUs tracked', '143']],
    prose: 'Most small retailers in Nigeria run on a notebook and a POS terminal, and reconcile at the end of the month if at all. Thegoodstuff replaces both. It is multi-store from the first screen — a store switcher in the sidebar, a store column on every table, a store comparison chart on the dashboard — and it treats accounting as a first-class module rather than an export you assemble later.',
    featTitle: 'What it runs',
    features: [
      ['Accounting', 'revenue, cost, gross profit and margin over today, seven days, month, year or a custom range, with daily P&L and monthly trend charts and one-click XLSX export.'],
      ['Inventory', 'stock levels, inter-store transfers and full history, with per-product low-stock alerts and search by product, SKU or store.'],
      ['Orders', 'online and walk-in in the same table, with payment rail, fulfilment status and delivery state per row.'],
      ['Payments', 'Paystack and Moniepoint side by side, plus cash and POS.'],
      ['Discounts', 'campaigns, codes, manual verification and an approvals workflow.'],
      ['Users, Roles and Permissions', 'Super Admin, Manager and Sales Rep as shipped, extensible per site.'],
      ['Audit modules and activity log', 'a record of who did what.'],
      ['Customer portal', 'magic-link sign-in, profile and order history.'],
      ['Support chat', 'started from any page in the console.'],
    ],
    stack: ['React', 'React Router', 'Paystack', 'Moniepoint', 'XLSX export', 'PWA'],
    note: '₦2,706,000 revenue against ₦205,000 cost in the month shown — a 92.4% gross margin, tracked automatically rather than reconstructed.',
    images: [['tgs-1.jpg', 1280, 571], ['tgs-2.jpg', 1280, 571], ['tgs-3.jpg', 1280, 571], ['tgs-4.jpg', 1280, 571], ['tgs-5.jpg', 1280, 571]],
  },
  {
    slug: 'transport-advisory', name: 'Transport Advisory', sector: 'Compliance', status: 'Live',
    url: 'https://transportadvisory.ng', domain: 'transportadvisory.ng/admin',
    line: 'Nigerian vehicle documents expire quietly and cost you at a checkpoint. This tracks every expiry, reminds you free, and renews online.',
    metrics: [['Document classes', '3 core'], ['Reminders', 'Free forever'], ['Delivery', 'Doorstep']],
    prose: 'Insurance, vehicle licence and roadworthiness all expire on dates nobody diarises, and the reminder usually arrives in the form of a checkpoint. Transport Advisory holds those dates for you, sends SMS and email before they land, and lets you renew in the app — soft copy immediately, hard copy delivered. It charges nothing to remind you and takes a service fee only at the point of renewal, which is the only honest way to price it. It is also explicit that it is not government owned.',
    featTitle: 'Covered',
    features: [
      ['Core expiries', 'vehicle insurance, vehicle licence, roadworthiness certificate.'],
      ['Beyond the basics', 'change of ownership, hackney and commercial permits, ride-hailing permits, articulated vehicle registration, Lagos ANPR fines.'],
      ['Free SMS and email reminders', 'the service charge applies only when you renew.'],
      ['Magic-link onboarding', 'submit vehicle and document details, get a one-time sign-in link.'],
      ['Fleet-capable', 'multiple vehicles under one account with per-vehicle detail.'],
      ['Admin console', 'applications, plate registry, deliveries, reminders needing follow-up, users, admin staff and service-fee revenue.'],
      ['Installable', 'PWA with offline-tolerant shell.'],
    ],
    stack: ['React', 'Vite', 'Magic-link auth', 'Paystack', 'PWA'],
    note: 'Screens shown are from a staging tenant, so the counts are small. They are here for the information design and the admin surface, not as a claim about scale.',
    images: [['tas-1.jpg', 1280, 571], ['tas-2.jpg', 1280, 571]],
  },
  {
    slug: 'hennessy-made-for-more', name: 'Hennessy — Made For More + Glitz', sector: 'AI & Brand', status: 'Delivered',
    statusNote: 'client', url: null, domain: 'Hennessy · Made For More + Glitz',
    line: 'An AI runway booth for Hennessy: upload a selfie, pick a look and a stage, and walk away with an eight-second film of yourself on the runway.',
    metrics: [['Pipeline', '6 stages'], ['Turnaround', '< 3 min'], ['Output', '8s · 9:16']],
    prose: 'Hennessy’s Made For More + Glitz campaign needed a digital experience that put consumers inside the brand world rather than in front of it. The booth takes one selfie, a chosen look and a chosen runway, and returns a photorealistic vertical video of that person walking it — generated end to end in under three minutes, formatted to share without editing. The interesting engineering is not the generation, it is the orchestration: six models in sequence, progress streamed live so the wait feels like a countdown rather than a hang.',
    featTitle: 'How it runs',
    features: [
      ['Six-stage AI pipeline', 'Gemini 2.5, Vertex AI Imagen and Grok Imagine chained from face validation through to video animation.'],
      ['Face validation first', 'the pipeline refuses bad input at stage one rather than failing expensively at stage six.'],
      ['Six looks, two edits', 'Street Noir, Puffer Edit, Tailored Motion, Heritage Layer, Varsity Night and Runway Utility, split across men’s and women’s.'],
      ['Four runway scenes', 'Golden Hall, Midnight Spotlight and two further sets, each a branded stage the finished look is composited into.'],
      ['Real-time SSE progress', 'Styling Your Look, Choosing the Scene, Lights Camera Runway, streamed with live percentage.'],
      ['Brand IP protection', 'prompt sanitisation prevents the model being steered off-brand or into misuse of the marks.'],
      ['Share-native output', '9:16, eight seconds, no edit step between generation and posting.'],
    ],
    stack: ['Gemini 2.5', 'Vertex AI Imagen', 'Grok Imagine', 'Server-Sent Events', 'Prompt sanitisation'],
    note: 'Client engagement for Hennessy. Designed as a live activation — the three-minute ceiling and the streamed progress were product requirements, not optimisations.',
    video: 'hennessyVideo.mp4',
    focus: 'center top',
    images: [['hennessy-1.jpg', 946, 942], ['hennessy-2.jpg', 947, 946], ['hennessy-3.jpg', 947, 942], ['hennessy-4.jpg', 947, 941], ['hennessy-5.jpg', 952, 937]],
  },
  {
    slug: 'gohire', name: 'GoHire', sector: 'Hiring', status: 'Live',
    url: 'https://gohire.ng', domain: 'gohire.ng/admin', focus: 'center top',
    line: 'Two-sided hiring for Nigeria. Job seekers build a profile without a CV; recruiters post roles and work their applicants — matched by an engine that scores skills, experience and preference.',
    metrics: [['Users', '404'], ['Live jobs', '89'], ['Applications', '174'], ['Subscriptions', '33']],
    prose: 'GoHire serves both sides of the same market and neither is an afterthought. For job seekers — particularly people from low-income backgrounds applying for entry-level work — the barrier is the CV itself, so the platform replaces it with a guided structured profile and verified skill levels. For recruiters, the barrier is volume and noise, so they get posting, applicant management, direct messaging and scored matches rather than a stack of attachments. The matching engine sits between them.',
    featTitle: 'Both sides of it',
    features: [
      ['For job seekers — no CV required.', 'A guided structured profile stands in for a résumé, with verified skill levels and experience history.'],
      ['For job seekers — one dashboard.', 'Every application tracked in one place, with featured roles surfaced in the candidate feed.'],
      ['For recruiters — post and manage.', 'Active job posts, applicant pipelines and a monthly contact allowance per plan.'],
      ['For recruiters — reach candidates directly.', 'Integrated chat straight to matched candidates, no third-party channel.'],
      ['Shared — the matching engine.', 'Applications scored on skills (40%), experience (50%) and job preferences (10%).'],
      ['Shared — AI calls.', 'An assisted screening call layer sitting between the two sides.'],
      ['Nationwide.', 'All 36 states plus the FCT, with remote categories — warehouse, drivers, care workers, retail and skilled trades.'],
      ['Plans.', 'Base ₦15,000/mo, Masterpiece ₦40,000/mo, Enterprise custom — with one free trial post and no card required.'],
      ['Ops console — live overview.', 'A staff-facing console refreshed every 30 seconds: users, candidates, recruiters, active jobs, applications, subscriptions, messages and reviews on one screen.'],
      ['Ops console — CAC verification.', 'Recruiters are checked against their Nigerian corporate registration before they can hire; pending checks sit in a queue with its own header badge.'],
      ['Ops console — trust and safety.', 'A support inbox, an activity trail and an open-flags queue, each surfaced as a live counter so nothing waits unseen.'],
      ['Ops console — job management.', 'Search across title, location and company, per-post view and application counts, status changes and bulk-close for stale listings.'],
      ['Ops console — money.', 'Revenue, payments, subscriptions and refunds as first-class sections rather than a reporting afterthought.'],
    ],
    stack: ['Next.js', 'App Router', 'Vercel', 'Paystack', 'CAC verification'],
    note: 'Console figures as at 27 August 2026: 404 users — 334 candidates and 67 recruiters — against 89 live posts of 104 total, 174 applications, 33 active subscriptions and 779 messages sent. Zero open support tickets and zero open trust-and-safety flags at time of capture.',
    images: [['gohire-1.jpg', 1280, 571], ['gohire-2.jpg', 1280, 571], ['gohire-3.jpg', 1280, 571], ['gohire-4.jpg', 1280, 571]],
  },
  {
    slug: 'scottslexhire', name: 'ScottsLexHire', sector: 'Hiring', status: 'Live',
    url: 'https://scottlexhire.com', domain: 'scottlexhire.com',
    line: 'Young Nigerian lawyers build an identity-verified profile; firms find them and open a video interview straight from the profile.',
    metrics: [['Identity', 'NIN verified'], ['Interview', 'In-profile'], ['Setup', '60 seconds'], ['Roles', '3 tiers']],
    prose: 'Legal hiring in Nigeria runs on referral, which is slow for firms and closed to anyone without a network. ScottsLexHire replaces the referral chain with a verified directory: lawyers add their LL.B, B.L and class of degree and verify identity by NIN at no cost, and firms — themselves verified by email, phone and government ID before they see anybody — search, filter by location and start a call from the candidate’s profile. The stated ambition is that hiring counsel should feel like ordering anything else online.',
    featTitle: 'How it works',
    features: [
      ['Verified lawyer profiles', 'LL.B, B.L, class of degree and areas of interest, with NIN identity verification free to the candidate.'],
      ['Employer verification', 'email, phone and government ID confirmed before an employer gets access to candidates.'],
      ['Instant video interviews', 'join a call directly from a candidate profile, no scheduling round-trip.'],
      ['Location filtering', 'Lagos, Abuja, Port Harcourt or anywhere nationwide.'],
      ['Free for candidates', 'a verified profile is searchable without a subscription.'],
      ['Premium employer tier', 'unlocks First Class and 2:1 candidates, top ranking, the Premium Verified badge, pitch messaging, analytics and a case showcase.'],
      ['Sign-in', 'Google, LinkedIn or Facebook, or email with confirmation.'],
      ['Admin overview', 'platform health at a glance: total users split by lawyers, employers and admins, plus pending verifications, suspensions, premium employers and subscribed lawyers.'],
      ['Rolling 30-day counters', 'new users, interviews held and successful payments, so the team can see whether the marketplace is actually clearing.'],
      ['User management', 'filter by All, Pending verification, Verified, Suspended or Email-unconfirmed, and cross-filter by role: lawyer, employer or admin.'],
      ['Per-user drill-down', 'open any account to review credentials and act on a pending verification.'],
    ],
    stack: ['React', 'Vite', 'React Router', 'Tailwind', 'Node API', 'NIN verification'],
    note: 'Early-stage: the console showed 12 accounts — 8 lawyers, 2 employers, 2 admins — with 3 verifications pending and 10 new users in the preceding 30 days. Shown here for the verification workflow and admin surface rather than as a claim about scale.',
    images: [['scottlex-1.jpg', 1280, 571], ['scottlex-2.jpg', 1280, 571], ['scottlex-3.jpg', 1280, 571], ['scottlex-4.jpg', 1280, 571]],
  },
  {
    slug: 'therapy-with-sharon', name: 'TherapywithSharon', sector: 'Health', status: 'Pre-launch',
    url: null, domain: 'therapywithsharon.com', focus: 'center top',
    line: 'Online therapy you book, pay for and keep up with yourself — live availability in your own timezone, naira or dollars, and a private space between sessions.',
    metrics: [['Currencies', '₦ and $'], ['Reschedule', 'Up to 48h'], ['Confirmation', 'Same sitting']],
    prose: 'Booking therapy usually means an email thread, a wait, and a second wait to pay. This removes all of it. You see the hours Sharon genuinely has free, rendered in your own timezone, pick one, pay by card, transfer or USSD, and the session is confirmed before you close the tab. The private video link is already on your dashboard, with reminders the day before and an hour before. Between sessions you keep a space of your own — the exercises she sets you, the notes she shares, your receipts and a private thread with her.',
    featTitle: 'What clients get',
    features: [
      ['Real-time availability', 'open slots shown instantly in your own timezone. No email back-and-forth, no waiting rooms.'],
      ['Paid and confirmed in one sitting', 'card, bank transfer or USSD through Paystack, in naira from Lagos or dollars from abroad.'],
      ['Private video link on your dashboard', 'Google Meet, nothing to install.'],
      ['Reminders', 'the day before and an hour before.'],
      ['Flexible rescheduling', 'up to 48 hours ahead, from the dashboard, without penalty.'],
      ['Between-session support', 'the exercises Sharon sets, the notes she shares, and a private message thread.'],
      ['Private and encrypted', 'notes, reflections and history stay encrypted; only Sharon sees them.'],
      ['Services', 'first consultations, individual therapy, couples sessions, screening, and coaching for individuals and teams.'],
    ],
    stack: ['Paystack (card · transfer · USSD)', 'Google Meet', 'Multi-currency', 'NDPR / GDPR'],
    note: 'Not an emergency service. Anyone in crisis is directed to their local emergency number. Build is complete and pre-launch; screens are from the finished frontend.',
    images: [['sharon-1.jpg', 1280, 989], ['sharon-2.jpg', 1280, 914], ['sharon-3.jpg', 1280, 1068], ['sharon-4.jpg', 1280, 1164]],
  },
  {
    slug: 'proximity-power', name: 'Proximity Power', sector: 'Energy', status: 'Offline',
    url: null, domain: 'proximitypower.ng', focus: 'center top',
    line: 'Gas-powered captive electricity for commercial and industrial property — an editorial site for a company whose entire product is uptime.',
    metrics: [['Uptime claim', '99.9%'], ['vs diesel', '−40% cost'], ['Service lines', '4']],
    prose: 'Proximity Power Nigeria sells captive gas generation to commercial and industrial properties — power that does not depend on the grid or on diesel pricing. The site had to carry two things at once: the engineering credibility of an energy contractor and the confidence of a company telling businesses their growth is bottlenecked by electricity. It runs as a numbered editorial sequence — homepage, details, specifications, gallery — with a flared display face in all caps against near-black, and a single signal green doing all the accent work.',
    featTitle: 'The site',
    features: [
      ['Chaptered structure', 'homepage, details, specifications and gallery numbered as a sequence rather than stacked as sections.'],
      ['Four service lines', 'captive power generation, smart metering solutions, gas-powered efficiency and energy consulting, in an expanding accordion.'],
      ['Proof in the numbers', '99.9% uptime guarantee, 40% cost saving against diesel, 24/7 monitoring and support.'],
      ['Two pillars up front', 'gas-powered efficiency and transparent billing through smart metering.'],
      ['Project gallery', 'deployed systems presented as Zero Downtime Operations and Smart Energy Monitoring.'],
      ['Quote-led conversion', 'a full-width quote slider rather than a buried contact form.'],
      ['Power Purchase Agreements', 'carried in the service list as a commercial route, not just an engineering one.'],
    ],
    stack: ['Editorial front-end', 'Responsive media', 'Accordion specifications'],
    note: 'The build is complete but proximitypower.ng is not currently resolving in DNS, so there is no live link to give. Shown here as a case study.',
    images: [['proximity-1.jpg', 1280, 635], ['proximity-2.jpg', 1280, 646], ['proximity-3.jpg', 1280, 935], ['proximity-4.jpg', 1280, 637], ['proximity-5.jpg', 1280, 638]],
  },
  {
    slug: 'ai-xr-bootcamp', name: 'AI & XR Bootcamp', sector: 'Education', status: 'Live',
    statusNote: 'own product', url: 'https://aixrbootcamp.com', domain: 'aixrbootcamp.com',
    line: 'Immersia’s own summer programme — and the site that fills it. Two weeks in Lagos, fifty places, ending in a live pitch to a jury.',
    metrics: [['Ages', '10–17'], ['Places', '50'], ['Fee', '₦100,000'], ['Length', '2 weeks']],
    prose: 'This one is ours rather than a client’s. The bootcamp is Nigeria’s only summer programme where children aged ten to seventeen ship a deployed AI app, build a VR world, produce an AI-assisted track and deliver a startup pitch to a jury — and the site exists to sell fifty places against a hard start date. Which makes it a conversion problem more than a brochure: real footage over stock, the curriculum legible in seconds, and instalment pricing surfaced early because it is the objection that actually stops parents.',
    featTitle: 'The programme',
    features: [
      ['Six rotating courses', 'vibe coding and AI prompt engineering, entrepreneurship and pitching (compulsory), content creation, 3D character and VR world creation, AI music production, and robotics and embedded systems as a paid elective.'],
      ['No experience required', 'the curriculum takes complete beginners and offers stretch projects to the advanced.'],
      ['Two weeks, in person', 'Monday to Friday, 9:00am to 1:30pm, at Leisure Mall, Lagos.'],
      ['Fifty places per cohort', 'scarcity that is real, and stated.'],
      ['₦100,000', ', plus ₦25,000 for the robotics elective, with an instalment option at ₦75,000 deposit.'],
      ['Demo Day', 'the programme ends with a live pitch to a jury, which is also what the parents come to watch.'],
      ['Side attractions', 'go-kart racing, table tennis, FIFA ’26 and VR between sessions.'],
    ],
    stack: ['Next.js', 'App Router', 'Vercel'],
    note: 'Immersia’s own education programme rather than delivered client software — included here because it is a shipped product, and flagged so the distinction is clear.',
    images: [['aixr-1.jpg', 1280, 571], ['aixr-2.jpg', 1280, 571], ['aixr-3.jpg', 1280, 571]],
  },
];

module.exports = {
  FIGURES_AS_AT, STUDIO, SEO, HERO, PROOF, PRACTICE, STACK, PARENT, CONTACT_COPY, SECTOR_HUES, PROJECTS,
};
