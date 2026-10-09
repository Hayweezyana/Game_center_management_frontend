/**
 * Meta Pixel — dual-path tracking.
 *
 * Every event goes out twice: once through the browser pixel (`fbq`) and once
 * through our own backend, which relays it to Meta's Conversions API. Both
 * carry the same `eventId`, so Meta deduplicates them into a single conversion.
 *
 * Why bother: ad blockers, iOS ITP and flaky networks silently drop 10–30% of
 * browser-side events. The server relay goes to our own domain, so it survives.
 *
 * Nothing here ever throws or blocks — analytics must not be able to break a
 * checkout.
 */

const BACKEND = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

type MetaEventName = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Contact';

// The backend relay only accepts these; anything else goes browser-side only.
const RELAYED_EVENTS: ReadonlySet<MetaEventName> = new Set<MetaEventName>([
  'PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase',
]);

export interface TrackedItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

export interface CustomerIdentity {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}

const CURRENCY = 'NGN';

/** True once the loader in index.html has run with a configured pixel ID. */
const isPixelEnabled = (): boolean => typeof window !== 'undefined' && Boolean(window.fbq);

function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the manual id below.
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split(';').find(c => c.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
}

/**
 * Fire-and-forget relay to our own backend.
 *
 * `keepalive` is what lets a Purchase finish after the ticket page navigates
 * away. sendBeacon would do the same, but it always sends credentials, and the
 * API answers with `Access-Control-Allow-Origin: *` — a combination browsers
 * reject outright, so every beacon failed CORS preflight. We need no cookies
 * here (fbp/fbc travel in the body), so `credentials: 'omit'` keeps the
 * wildcard origin legal.
 */
function relayToServer(
  eventName: MetaEventName,
  eventId: string,
  customData: Record<string, unknown>,
  identity?: CustomerIdentity,
) {
  if (!BACKEND) return;

  const payload = JSON.stringify({
    eventName,
    eventId,
    eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    customData,
    userData: identity,
    fbp: readCookie('_fbp'),
    fbc: readCookie('_fbc'),
  });

  const url = `${BACKEND}/v1/meta/track`;

  try {
    void fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A dropped analytics event is not worth surfacing to the customer.
  }
}

/** Sends the event down both paths under one shared event id. */
function track(
  eventName: MetaEventName,
  customData: Record<string, unknown> = {},
  identity?: CustomerIdentity,
) {
  const eventId = newEventId();

  if (isPixelEnabled()) {
    window.fbq!('track', eventName, customData, { eventID: eventId });
  }

  if (RELAYED_EVENTS.has(eventName)) {
    relayToServer(eventName, eventId, customData, identity);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export const trackPageView = () => track('PageView');

// ── Rentals (/rentals) ──────────────────────────────────────────────────────
// No prices on the rentals page, so these carry no value — they exist to build
// audiences ("watched the VR racing clip") and count enquiries.

const RENTALS_CATEGORY = 'Rentals';

/** A visitor opened a rental's video (or the showreel). */
export const trackRentalView = (item: { id: string; name: string; category?: string }) =>
  track('ViewContent', {
    content_name: item.name,
    content_ids: [item.id],
    content_type: 'product',
    content_category: item.category ? `${RENTALS_CATEGORY} > ${item.category}` : RENTALS_CATEGORY,
  });

/** A visitor tapped WhatsApp or Call. `source` says which button. */
export const trackRentalContact = (
  method: 'whatsapp' | 'call',
  source: string,
  item?: { id: string; name: string },
) =>
  track('Contact', {
    content_category: RENTALS_CATEGORY,
    contact_method: method,
    contact_source: source,
    ...(item ? { content_name: item.name, content_ids: [item.id] } : {}),
  });

export const trackAddToCart = (item: TrackedItem) =>
  track('AddToCart', {
    content_name: item.title,
    content_ids: [item.id],
    content_type: 'product',
    value: item.price * item.quantity,
    currency: CURRENCY,
  });

export const trackInitiateCheckout = (total: number, cartItems: TrackedItem[]) =>
  track('InitiateCheckout', {
    value: total,
    currency: CURRENCY,
    content_type: 'product',
    content_ids: cartItems.map(i => i.id),
    contents: cartItems.map(i => ({ id: i.id, quantity: i.quantity })),
    num_items: cartItems.reduce((sum, i) => sum + i.quantity, 0),
  });

export const trackPurchase = (
  total: number,
  cartItems: TrackedItem[],
  reference?: string,
  identity?: CustomerIdentity,
) =>
  track(
    'Purchase',
    {
      value: total,
      currency: CURRENCY,
      content_type: 'product',
      transaction_id: reference,
      content_ids: cartItems.map(i => i.id),
      contents: cartItems.map(i => ({ id: i.id, quantity: i.quantity })),
      num_items: cartItems.reduce((sum, i) => sum + i.quantity, 0),
    },
    identity,
  );
