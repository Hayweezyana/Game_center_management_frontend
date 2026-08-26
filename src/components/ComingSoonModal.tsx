import React, { useCallback, useEffect, useRef, useState } from 'react';
import './ComingSoonModal.css';
import { resolveEmbed } from './comingSoonVideo';

/**
 * Video source. Set REACT_APP_COMING_SOON_VIDEO_URL to override without a code
 * change; the constant below is the fallback so the URL can also just be edited
 * here. Accepts a direct file (.mp4/.webm) or a YouTube/Vimeo link — the right
 * player is chosen automatically.
 */
const VIDEO_URL = process.env.REACT_APP_COMING_SOON_VIDEO_URL || '';

interface ComingSoonModalProps {
  open: boolean;
  onClose: () => void;
  /** Rendered as the primary action; omit to show only the close button. */
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
  message?: string;
  videoUrl?: string;
}

const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  open,
  onClose,
  onContinue,
  continueLabel = 'Continue to games',
  title = 'Coming Soon',
  message = 'Something new is landing at Immersia. Here is a first look.',
  videoUrl = VIDEO_URL,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocused = useRef<Element | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const embed = resolveEmbed(videoUrl);

  // Reset the error state whenever a new source is shown, so a transient
  // failure doesn't permanently hide a video that was later fixed.
  useEffect(() => { setVideoFailed(false); }, [embed.src, open]);

  // Close on Escape, and keep Tab inside the dialog while it is open.
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !dialogRef.current) return;

    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    lastFocused.current = document.activeElement;
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the overlay from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the close button so keyboard and screen-reader users start at a way out.
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(t);
      // Return focus to whatever opened the dialog.
      const prev = lastFocused.current as HTMLElement | null;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  const showFallback = embed.kind === 'none' || videoFailed;

  return (
    <div
      className="cs-overlay"
      // Backdrop click closes; the guard stops clicks inside the card bubbling up.
      onClick={onClose}
      role="presentation"
    >
      <div
        className="cs-card"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-title"
        aria-describedby="cs-message"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="cs-close"
          onClick={onClose}
          ref={closeBtnRef}
          aria-label="Close"
          type="button"
        >
          ×
        </button>

        <span className="cs-badge">Coming Soon</span>
        <h2 className="cs-title" id="cs-title">{title}</h2>
        <p className="cs-message" id="cs-message">{message}</p>

        <div className="cs-media">
          {showFallback ? (
            <div className="cs-media-fallback">
              <span className="cs-media-icon" aria-hidden="true">🎬</span>
              <p>
                {embed.kind === 'none'
                  ? 'Trailer dropping soon.'
                  : 'The trailer could not be loaded right now.'}
              </p>
            </div>
          ) : embed.kind === 'iframe' ? (
            <iframe
              className="cs-media-frame"
              src={embed.src}
              title="Coming soon trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              className="cs-media-frame"
              src={embed.src}
              controls
              autoPlay
              muted
              playsInline
              loop
              onError={() => setVideoFailed(true)}
            />
          )}
        </div>

        <div className="cs-actions">
          {onContinue && (
            <button className="cs-btn cs-btn-primary" onClick={onContinue} type="button">
              {continueLabel}
            </button>
          )}
          <button className="cs-btn cs-btn-ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonModal;
