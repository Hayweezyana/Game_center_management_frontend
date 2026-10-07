import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../logo/immersia.png';
import './RentalsPage.css';
import {
  ALL_ITEMS,
  CATEGORIES,
  CONTACT,
  FAQS,
  REVIEWS,
  SERVICES,
  SHOWREEL_URL,
  videoUrlFor,
  whatsappLink,
} from './rentalsCatalog';

type Item = (typeof ALL_ITEMS)[number];

// What the player is showing: a catalogue item (with its neighbours for
// prev/next) or the brand showreel.
type Playing =
  | { kind: 'item'; list: Item[]; index: number }
  | { kind: 'showreel' };

const WaIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.87.85-.87 2.07s.89 2.4 1.02 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z"
    />
  </svg>
);

const PhoneIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
  </svg>
);

const PlayIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
);

// Sets `data-in` on every [data-reveal] element as it scrolls into view.
// Re-scans when `deps` change so freshly rendered cards animate too.
const useReveal = (rootRef: React.RefObject<HTMLElement | null>, deps: unknown[]) => {
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-in])'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.setAttribute('data-in', ''));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', '');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

const CountUp: React.FC<{ to: number; suffix?: string }> = ({ to, suffix = '' }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1400);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    if (!('IntersectionObserver' in window)) { setValue(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { run(); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{value}{suffix}</span>;
};

// Card that leans toward the pointer.
const tilt = (e: React.MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--ry', `${x * 10}deg`);
  el.style.setProperty('--rx', `${-y * 10}deg`);
  el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
  el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
};
const untilt = (e: React.MouseEvent<HTMLElement>) => {
  e.currentTarget.style.setProperty('--ry', '0deg');
  e.currentTarget.style.setProperty('--rx', '0deg');
};

const Thumb: React.FC<{ item: Item }> = ({ item }) =>
  item.emoji ? (
    <div className="rp-thumb-emoji" aria-hidden="true">{item.emoji}</div>
  ) : (
    <img
      src={item.thumb}
      alt=""
      loading="lazy"
      decoding="async"
      className={item.contain ? 'is-contain' : undefined}
    />
  );

const VideoModal: React.FC<{
  playing: Playing;
  onClose: () => void;
  onNav: (dir: 1 | -1) => void;
}> = ({ playing, onClose, onNav }) => {
  const item = playing.kind === 'item' ? playing.list[playing.index] : null;
  const src = item ? videoUrlFor(item) : SHOWREEL_URL;
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const canNav = playing.kind === 'item' && playing.list.length > 1;

  React.useEffect(() => { setStatus('loading'); }, [src]);

  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (canNav && e.key === 'ArrowRight') onNav(1);
      else if (canNav && e.key === 'ArrowLeft') onNav(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, onNav, canNav]);

  const title = item ? item.name : 'Immersia showreel';
  const askText = item
    ? `Hi Immersia! I'd like to rent the ${item.name}. Is it available for my event?`
    : "Hi Immersia! I'd like to book rentals for my event.";

  return (
    <div className="rp-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="rp-modal-scrim" onClick={onClose} />
      <div className="rp-modal-card">
        <button ref={closeRef} type="button" className="rp-modal-close" aria-label="Close video" onClick={onClose}>×</button>
        <div className="rp-modal-stage">
          {status !== 'ready' && item && !item.emoji ? (
            <img className="rp-modal-poster" src={item.thumb} alt="" aria-hidden="true" />
          ) : null}
          {status === 'loading' ? (
            <div className="rp-modal-loading" role="status">
              <span className="rp-spinner" />
              <span>Loading video…</span>
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="rp-modal-missing">
              <span className="rp-modal-missing-icon" aria-hidden="true">🎬</span>
              <strong>Video coming soon</strong>
              <span>Ask us on WhatsApp and we&apos;ll send you a clip of this one in action.</span>
            </div>
          ) : null}
          <video
            key={src}
            src={src}
            className={status === 'ready' ? 'is-ready' : undefined}
            autoPlay
            controls
            playsInline
            preload="auto"
            onCanPlay={() => setStatus('ready')}
            onError={() => setStatus('error')}
          />
          {canNav ? (
            <>
              <button type="button" className="rp-modal-nav is-prev" aria-label="Previous rental" onClick={() => onNav(-1)}>‹</button>
              <button type="button" className="rp-modal-nav is-next" aria-label="Next rental" onClick={() => onNav(1)}>›</button>
            </>
          ) : null}
        </div>
        <div className="rp-modal-info">
          <div>
            {item ? <span className="rp-modal-cat">{item.categoryName}</span> : null}
            <h3>{title}</h3>
            {item ? <p>{item.blurb}</p> : <p>A taste of what we bring to your event.</p>}
          </div>
          <div className="rp-modal-acts">
            <a className="rp-btn rp-btn-wa" href={whatsappLink(askText)} target="_blank" rel="noopener noreferrer">
              <WaIcon /> Ask on WhatsApp
            </a>
            <a className="rp-btn rp-btn-ghost" href={`tel:${CONTACT.phone}`}>
              <PhoneIcon /> Call
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const RentalsPage: React.FC = () => {
  const navigate = useNavigate();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const catalogRef = React.useRef<HTMLElement>(null);
  const chipsRef = React.useRef<HTMLDivElement>(null);
  const [activeCat, setActiveCat] = React.useState<string>('all');
  const [query, setQuery] = React.useState('');
  const [playing, setPlaying] = React.useState<Playing | null>(null);
  const [openFaq, setOpenFaq] = React.useState<number>(0);
  const [pill, setPill] = React.useState({ left: 0, width: 0 });
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    document.title = 'Immersia Rentals · VR, booths, games and rides in Lagos';
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const q = query.trim().toLowerCase();
  const visibleCats = React.useMemo(
    () =>
      CATEGORIES
        .filter((c) => activeCat === 'all' || c.id === activeCat)
        .map((c) => ({
          ...c,
          items: ALL_ITEMS.filter(
            (it) => it.categoryId === c.id && (!q || it.name.toLowerCase().includes(q) || it.blurb.toLowerCase().includes(q)),
          ),
        }))
        .filter((c) => c.items.length > 0),
    [activeCat, q],
  );
  const visibleItems = React.useMemo(() => visibleCats.flatMap((c) => c.items), [visibleCats]);

  useReveal(rootRef, [activeCat, q]);

  // Slide the highlight pill under the active category chip.
  React.useLayoutEffect(() => {
    const wrap = chipsRef.current;
    const el = wrap?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
    if (!wrap || !el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
    // Centre the chip horizontally only — scrollIntoView would also move the page.
    wrap.scrollTo({ left: el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [activeCat]);

  // Re-measure when chip sizes change (web font arriving, window resize).
  React.useEffect(() => {
    const wrap = chipsRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const el = wrap.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    });
    wrap.querySelectorAll('.rp-chip').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [activeCat]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const jumpToCategory = (id: string) => {
    setActiveCat(id);
    setQuery('');
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openItem = (item: Item) => {
    const index = visibleItems.findIndex((it) => it.id === item.id);
    setPlaying({ kind: 'item', list: visibleItems, index: Math.max(0, index) });
  };

  const closePlayer = React.useCallback(() => setPlaying(null), []);
  const navPlayer = React.useCallback((dir: 1 | -1) => {
    setPlaying((p) => {
      if (!p || p.kind !== 'item') return p;
      const n = p.list.length;
      return { ...p, index: (p.index + dir + n) % n };
    });
  }, []);

  const orbit = React.useMemo(
    () => ['q3', 'aibooth', 'karts', 'f1', 'tunnel', 'motion', 'dance', 'holo3d', 'carousel', 'v360']
      .map((id) => ALL_ITEMS.find((it) => it.id === id)!)
      .filter(Boolean),
    [],
  );

  const marquee = ALL_ITEMS.filter((it) => !it.id.startsWith('tv') && !it.id.startsWith('ts'));
  const generalWa = whatsappLink("Hi Immersia! I'd like to book rentals for my event.");

  return (
    <div className="rp" ref={rootRef}>
      <div className="rp-aurora" aria-hidden="true">
        <span className="rp-blob rp-blob-1" />
        <span className="rp-blob rp-blob-2" />
        <span className="rp-blob rp-blob-3" />
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className={`rp-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="rp-wrap rp-header-row">
          <button type="button" className="rp-brand" onClick={() => navigate('/')} aria-label="Back to Immersia home">
            <img src={logo} alt="Immersia" />
            <span>Rentals</span>
          </button>
          <nav className="rp-nav" aria-label="Rentals sections">
            <button type="button" onClick={() => scrollTo('rp-catalog')}>Rentals</button>
            <button type="button" onClick={() => scrollTo('rp-how')}>How it works</button>
            <button type="button" onClick={() => scrollTo('rp-reviews')}>Reviews</button>
            <button type="button" onClick={() => scrollTo('rp-contact')}>Contact</button>
          </nav>
          <a className="rp-btn rp-btn-wa rp-header-cta" href={generalWa} target="_blank" rel="noopener noreferrer">
            <WaIcon /><span>Chat with us</span>
          </a>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="rp-hero">
          <div className="rp-floor" aria-hidden="true" />
          <div className="rp-wrap rp-hero-grid">
            <div className="rp-hero-copy">
              <span className="rp-eyebrow rp-rise" style={{ animationDelay: '0ms' }}>
                <span className="rp-dot" /> Immersia XR Studios · Lagos
              </span>
              <h1 className="rp-rise" style={{ animationDelay: '90ms' }}>
                See, feel <span className="rp-gradient-text">everything.</span>
              </h1>
              <p className="rp-sub rp-rise" style={{ animationDelay: '180ms' }}>
                VR, simulators, holograms, photo booths, games and party rides. Tap any rental to watch it in action, then message us — we bring the experience to your event.
              </p>
              <div className="rp-ctas rp-rise" style={{ animationDelay: '270ms' }}>
                <button type="button" className="rp-btn rp-btn-primary" onClick={() => scrollTo('rp-catalog')}>
                  Explore rentals
                </button>
                <a className="rp-btn rp-btn-wa" href={generalWa} target="_blank" rel="noopener noreferrer"><WaIcon /> WhatsApp</a>
                <a className="rp-btn rp-btn-ghost" href={`tel:${CONTACT.phone}`}><PhoneIcon /> Call us</a>
              </div>
              <ul className="rp-terms rp-rise" style={{ animationDelay: '360ms' }}>
                <li><b>6-hour</b> rental per booking</li>
                <li>Tech support on site</li>
                <li>Setup at your venue</li>
              </ul>
            </div>

            <div className="rp-hero-art" aria-hidden="false">
              <div className="rp-orbit" aria-hidden="true">
                <div className="rp-orbit-ring">
                  {orbit.map((it, i) => (
                    <div
                      key={it.id}
                      className="rp-orbit-card"
                      style={{ transform: `rotateY(${(360 / orbit.length) * i}deg) translateZ(var(--orbit-r))` }}
                    >
                      <img src={it.thumb} alt="" />
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" className="rp-showreel" onClick={() => setPlaying({ kind: 'showreel' })}>
                <span className="rp-showreel-ring" aria-hidden="true" />
                <span className="rp-showreel-btn"><PlayIcon /></span>
                <span className="rp-showreel-label">Watch showreel</span>
              </button>
            </div>
          </div>

          <div className="rp-marquee" aria-hidden="true">
            <div className="rp-marquee-track">
              {[...marquee, ...marquee].map((it, i) => (
                <span key={`${it.id}-${i}`}>{it.name}<i>✦</i></span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats + services ─────────────────────────────── */}
        <section className="rp-wrap rp-stats">
          <div className="rp-stat" data-reveal><b><CountUp to={ALL_ITEMS.length} suffix="+" /></b><span>Experiences to rent</span></div>
          <div className="rp-stat" data-reveal style={{ transitionDelay: '80ms' }}><b><CountUp to={CATEGORIES.length} /></b><span>Categories</span></div>
          <div className="rp-stat" data-reveal style={{ transitionDelay: '160ms' }}><b><CountUp to={6} suffix=" hrs" /></b><span>Per booking</span></div>
          <div className="rp-stat" data-reveal style={{ transitionDelay: '240ms' }}><b>1 tap</b><span>From a quote on WhatsApp</span></div>
        </section>

        <section className="rp-wrap rp-services">
          {SERVICES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className="rp-service"
              data-reveal
              style={{ transitionDelay: `${i * 90}ms` }}
              onClick={() => jumpToCategory(s.jump)}
              onMouseMove={tilt}
              onMouseLeave={untilt}
            >
              <img src={s.thumb} alt="" loading="lazy" />
              <span className="rp-service-shade" />
              <span className="rp-service-copy">
                <strong>{s.title}</strong>
                <span>{s.text}</span>
                <em>Explore →</em>
              </span>
            </button>
          ))}
        </section>

        {/* ── Catalogue ────────────────────────────────────── */}
        <section className="rp-block" id="rp-catalog" ref={catalogRef}>
          <div className="rp-wrap">
            <div className="rp-head" data-reveal>
              <div>
                <span className="rp-kicker">The collection</span>
                <h2>Rentals</h2>
                <p>Tap any thumbnail to watch it in action. Like what you see? Ask about it on WhatsApp in one tap.</p>
              </div>
              <label className="rp-search">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search rentals"
                  aria-label="Search rentals"
                />
              </label>
            </div>

            <div className="rp-chips-bar">
              <div className="rp-chips" ref={chipsRef} role="tablist" aria-label="Categories">
                <span className="rp-chip-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} aria-hidden="true" />
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCat === 'all'}
                  data-cat="all"
                  className={`rp-chip${activeCat === 'all' ? ' is-active' : ''}`}
                  onClick={() => setActiveCat('all')}
                >
                  ✨ All <span className="rp-chip-n">{ALL_ITEMS.length}</span>
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={activeCat === c.id}
                    data-cat={c.id}
                    className={`rp-chip${activeCat === c.id ? ' is-active' : ''}`}
                    onClick={() => setActiveCat(c.id)}
                  >
                    {c.icon} {c.short} <span className="rp-chip-n">{c.items.length}</span>
                  </button>
                ))}
              </div>
            </div>

            <div key={`${activeCat}|${q}`} className="rp-sections">
              {visibleCats.length === 0 ? (
                <div className="rp-empty">
                  <span aria-hidden="true">🔍</span>
                  <p>No rentals match “{query}”.</p>
                  <a className="rp-btn rp-btn-wa" href={whatsappLink(`Hi Immersia! Do you have ${query} for rent?`)} target="_blank" rel="noopener noreferrer">
                    <WaIcon /> Ask us anyway
                  </a>
                </div>
              ) : visibleCats.map((c) => (
                <div key={c.id} className="rp-sec">
                  <div className="rp-sec-head" data-reveal>
                    <h3><span aria-hidden="true">{c.icon}</span> {c.name}</h3>
                    <span>{c.items.length} {c.items.length === 1 ? 'rental' : 'rentals'}</span>
                  </div>
                  <div className="rp-grid">
                    {c.items.map((it, i) => (
                      <button
                        key={it.id}
                        type="button"
                        className="rp-card"
                        data-reveal
                        style={{ transitionDelay: `${(i % 4) * 70}ms` }}
                        onClick={() => openItem(it)}
                        onMouseMove={tilt}
                        onMouseLeave={untilt}
                        aria-label={`Watch ${it.name}`}
                      >
                        <span className="rp-card-media">
                          <Thumb item={it} />
                          {it.badge ? <span className="rp-card-badge">{it.badge}</span> : null}
                          <span className="rp-card-play" aria-hidden="true"><PlayIcon /></span>
                          <span className="rp-card-shine" aria-hidden="true" />
                        </span>
                        <span className="rp-card-body">
                          <strong>{it.name}</strong>
                          <span>{it.blurb}</span>
                          <em>Watch video</em>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="rp-block" id="rp-how">
          <div className="rp-wrap">
            <div className="rp-head" data-reveal>
              <div>
                <span className="rp-kicker">Simple as 1-2-3</span>
                <h2>How it works</h2>
              </div>
            </div>
            <ol className="rp-steps">
              {[
                { icon: '🎬', title: 'Watch & pick', text: 'Browse the collection and tap any rental to see it in action.' },
                { icon: '💬', title: 'Message us', text: 'Send your picks, event date and venue on WhatsApp or give us a call.' },
                { icon: '🚀', title: 'We bring the fun', text: 'We deliver, set up and stay on hand with tech support for your 6-hour booking.' },
              ].map((s, i) => (
                <li key={s.title} className="rp-step" data-reveal style={{ transitionDelay: `${i * 120}ms` }}>
                  <span className="rp-step-n">0{i + 1}</span>
                  <span className="rp-step-icon" aria-hidden="true">{s.icon}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Reviews + FAQs ───────────────────────────────── */}
        <section className="rp-block" id="rp-reviews">
          <div className="rp-wrap rp-two">
            <div>
              <div className="rp-head" data-reveal>
                <div>
                  <span className="rp-kicker">Loved by hosts</span>
                  <h2>What clients say</h2>
                </div>
              </div>
              <div className="rp-reviews">
                {REVIEWS.map((r, i) => (
                  <figure key={r.name} className="rp-review" data-reveal style={{ transitionDelay: `${i * 110}ms` }}>
                    <div className="rp-stars" aria-label="5 out of 5 stars">★★★★★</div>
                    <blockquote>“{r.quote}”</blockquote>
                    <figcaption>
                      <span className="rp-avatar" aria-hidden="true">{r.name.charAt(0)}</span>
                      <span><b>{r.name}</b><small>{r.place}</small></span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
            <div>
              <div className="rp-head" data-reveal>
                <div>
                  <span className="rp-kicker">Good to know</span>
                  <h2>FAQs</h2>
                </div>
              </div>
              <div className="rp-faqs">
                {FAQS.map((f, i) => {
                  const open = openFaq === i;
                  return (
                    <div key={f.q} className={`rp-faq${open ? ' is-open' : ''}`} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                      <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? -1 : i)}>
                        {f.q}<span aria-hidden="true">+</span>
                      </button>
                      <div className="rp-faq-a"><div><p>{f.a}</p></div></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────── */}
        <section className="rp-block" id="rp-contact">
          <div className="rp-wrap">
            <div className="rp-contact" data-reveal>
              <div className="rp-contact-glow" aria-hidden="true" />
              <div>
                <h2>Let&apos;s make your event unforgettable.</h2>
                <p>Send us your event date, venue and the rentals you love. We&apos;ll confirm availability, logistics and a quote.</p>
              </div>
              <div className="rp-contact-acts">
                <a className="rp-btn rp-btn-wa rp-btn-lg" href={generalWa} target="_blank" rel="noopener noreferrer"><WaIcon /> Chat on WhatsApp</a>
                <a className="rp-btn rp-btn-dark rp-btn-lg" href={`tel:${CONTACT.phone}`}><PhoneIcon /> Call {CONTACT.phoneDisplay}</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="rp-footer">
        <div className="rp-wrap rp-footer-row">
          <img src={logo} alt="Immersia" />
          <span>Immersia XR Studios · Rental services · Lagos, Nigeria</span>
          <button type="button" onClick={() => navigate('/')}>← Back to Immersia</button>
        </div>
      </footer>

      {/* Floating contact dock */}
      <div className="rp-dock">
        <a className="rp-dock-btn is-call" href={`tel:${CONTACT.phone}`} aria-label={`Call Immersia on ${CONTACT.phoneDisplay}`}><PhoneIcon /></a>
        <a className="rp-dock-btn is-wa" href={generalWa} target="_blank" rel="noopener noreferrer" aria-label="Chat with Immersia on WhatsApp"><WaIcon /></a>
      </div>

      {playing ? <VideoModal playing={playing} onClose={closePlayer} onNav={navPlayer} /> : null}
    </div>
  );
};

export default RentalsPage;
