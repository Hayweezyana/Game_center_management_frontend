/**
 * Works out how to play a given video URL.
 *
 * YouTube and Vimeo links cannot go in a <video> tag — a watch/share URL is an
 * HTML page, not a media file, so the tag silently shows nothing. Those get
 * rewritten to their embed players; anything else is treated as a direct file.
 */
export type Embed = { kind: 'file' | 'iframe' | 'none'; src: string };

export function resolveEmbed(url: string): Embed {
  const raw = (url || '').trim();
  if (!raw) return { kind: 'none', src: '' };

  // Already an embed URL — leave it alone.
  if (/(?:youtube\.com\/embed\/|player\.vimeo\.com\/video\/)/i.test(raw)) {
    return { kind: 'iframe', src: raw };
  }

  // youtube.com/watch?v=, youtu.be/, /shorts/, /live/ — with or without extra params
  const yt = raw.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
  );
  if (yt) {
    return {
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
    };
  }

  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) {
    return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };
  }

  return { kind: 'file', src: raw };
}
