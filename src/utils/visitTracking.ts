/**
 * First-party visit tracking.
 *
 * The Meta pixel only reports what Meta attributes, and ad blockers drop a
 * chunk of it. This runs against our own API, so it counts everyone — and it
 * records the funnel the business actually cares about:
 *
 *   landed → picked games → reached a payment page → payment confirmed
 *
 * The last step fires from the ticket page, which only renders after a sale has
 * gone through, so "payment confirmed" means a real completed transaction
 * rather than an intent.
 *
 * Nothing here throws or blocks — a dropped analytics call must never be
 * visible to a customer at the counter.
 */

const BACKEND = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

const VISITOR_KEY = 'immersia_visitor_id';   // localStorage — persists across sessions
const SESSION_KEY = 'immersia_session_id';   // sessionStorage — one browsing session
const RECORDED_KEY = 'immersia_visit_sent';
const STEPS_KEY = 'immersia_steps_sent';

export type FunnelStep = 'games' | 'payment' | 'paid';

/** Paths that mean "the customer reached this stage". */
const PAYMENT_PATHS = [
  '/paymentselection',
  '/immersiapaymentpage',
  '/funstationpaymentpage',
  '/paystackpaymentpage',
  '/gkgpaymentpage',
  '/creditpaymentpage',
];

/**
 * Staff routes. A supervisor opening the admin console is not an ad visitor,
 * and counting the counter tablet would drown the real traffic.
 */
const STAFF_PATH_PREFIXES = [
  '/admin',
  '/createadmin',
  '/operator',
  '/report',
  '/aichatbox',
  '/drinkinventory',
  '/internalcontrol',
  '/pclockdashboard',
  '/marketersreport',
];

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the manual id below.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Safe storage access — Safari private mode throws on write. */
function readStore(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store: 'local' | 'session', key: string, value: string): void {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // Tracking is best-effort; a locked-down browser simply goes uncounted.
  }
}

export function getVisitorId(): string {
  let id = readStore('local', VISITOR_KEY);
  if (!id) {
    id = newId();
    writeStore('local', VISITOR_KEY, id);
  }
  return id;
}

export function getSessionId(): string {
  let id = readStore('session', SESSION_KEY);
  if (!id) {
    id = newId();
    writeStore('session', SESSION_KEY, id);
  }
  return id;
}

export function isStaffPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return STAFF_PATH_PREFIXES.some(prefix => p.startsWith(prefix));
}

/** Which funnel step, if any, this path represents. */
export function stepForPath(pathname: string): FunnelStep | null {
  const p = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/gameselection') return 'games';
  if (PAYMENT_PATHS.includes(p)) return 'payment';
  if (p === '/ticket') return 'paid';
  return null;
}

function post(path: string, body: Record<string, unknown>): void {
  if (!BACKEND) return;
  try {
    void fetch(`${BACKEND}${path}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let analytics surface to the customer.
  }
}

/**
 * Record the landing once per browsing session.
 *
 * Attribution is read from the URL the ad sent them to. Meta appends `fbclid`
 * to every ad click, so its presence alone proves paid Meta traffic even when
 * the campaign has no utm tags.
 */
export function recordVisit(pathname: string): void {
  if (isStaffPath(pathname)) return;
  if (readStore('session', RECORDED_KEY)) return;
  writeStore('session', RECORDED_KEY, '1');

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

  post('/v1/analytics/visit', {
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    landingPath: pathname,
    referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    source: params.get('utm_source') || undefined,
    medium: params.get('utm_medium') || undefined,
    campaign: params.get('utm_campaign') || undefined,
    content: params.get('utm_content') || undefined,
    term: params.get('utm_term') || undefined,
    fbclid: params.get('fbclid') || undefined,
  });
}

/**
 * Advance the funnel, at most once per step per session.
 *
 * The backend already ignores a repeated step (it only writes when the column
 * is still null), but a customer walking back and forth between games and
 * payment — or React StrictMode double-invoking effects in development —
 * would otherwise fire the same no-op request over and over on a counter
 * tablet's connection.
 */
export function recordStep(step: FunnelStep, reference?: string): void {
  let sent: string[] = [];
  try {
    sent = JSON.parse(readStore('session', STEPS_KEY) || '[]');
  } catch {
    sent = [];
  }
  if (sent.includes(step)) return;

  writeStore('session', STEPS_KEY, JSON.stringify([...sent, step]));

  post('/v1/analytics/visit/step', {
    sessionId: getSessionId(),
    step,
    reference,
  });
}

/** Fired on every route change: records the landing, then any step it matches. */
export function trackRoute(pathname: string): void {
  if (isStaffPath(pathname)) return;

  recordVisit(pathname);

  const step = stepForPath(pathname);
  // 'paid' is stamped from the ticket page itself with the transaction
  // reference, so it is not fired here on the bare route change.
  if (step && step !== 'paid') recordStep(step);
}
