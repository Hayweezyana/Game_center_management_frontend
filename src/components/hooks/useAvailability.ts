import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';

/**
 * Next-available times for every experience, kept fresh.
 *
 * Polls on a slow timer as the floor, and listens for the backend's
 * `availability.updated` push so a card reacts the moment a station frees up
 * rather than waiting out the poll interval.
 */

export interface Availability {
  game_id: string;
  title: string;
  stations_total: number;
  stations_online: number;
  stations_free: number;
  units_ahead: number;
  /** Turns waiting — fewer than units_ahead wherever a station seats a group. */
  sessions_ahead: number;
  players_per_session: number;
  /** This game's own declared count, as opposed to its shared pool's. */
  own_stations: number;
  station_group: string | null;
  /** Other experiences drawing on the same physical stations. */
  shares_with: string[];
  service_minutes: number;
  next_available_at: string | null;
  wait_minutes: number | null;
  confidence: 'high' | 'estimate' | 'unavailable';
  /** False when the experience is deliberately not on offer. */
  bookable: boolean;
}

const POLL_MS = 30_000;

/** Under this, "free now" is more honest than a countdown. */
const FREE_NOW_MINUTES = 5;

/**
 * Minutes until a station frees up, measured against a live clock.
 *
 * Derived from the absolute `next_available_at` rather than the server's
 * `wait_minutes` snapshot, so the card counts down between polls instead of
 * holding a stale number for thirty seconds at a time.
 */
const minutesUntil = (iso: string | null, now: number): number | null => {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.round((at - now) / 60_000));
};

export const formatWait = (
  entry: Availability | undefined,
  now: number = Date.now()
): string | null => {
  if (!entry) return null;
  // Not on offer at all, versus on offer but we cannot quote a wait because the
  // lock-app machines dropped off. The second is still sellable.
  if (!entry.bookable) return 'Not available';
  if (entry.confidence === 'unavailable') return 'Wait time unavailable';

  const minutes = minutesUntil(entry.next_available_at, now) ?? entry.wait_minutes;
  if (minutes === null || minutes === undefined) return null;
  if (minutes <= FREE_NOW_MINUTES) return 'Free now';
  if (minutes < 60) return `~${minutes} min wait`;

  // Past an hour a clock time reads better than "83 minutes".
  if (entry.next_available_at) {
    const when = new Date(entry.next_available_at);
    if (!Number.isNaN(when.getTime())) {
      return `Next at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
  }
  return `~${Math.round(minutes / 60)} hr wait`;
};

export const waitTone = (
  entry: Availability | undefined,
  now: number = Date.now()
): 'free' | 'short' | 'long' | 'none' => {
  if (!entry || !entry.bookable || entry.confidence === 'unavailable') return 'none';
  const minutes = minutesUntil(entry.next_available_at, now) ?? entry.wait_minutes;
  if (minutes === null || minutes === undefined) return 'none';
  if (minutes <= FREE_NOW_MINUTES) return 'free';
  if (minutes < 30) return 'short';
  return 'long';
};

export const useAvailability = () => {
  const [byGameId, setByGameId] = useState<Record<string, Availability>>({});
  const [loaded, setLoaded] = useState(false);
  // Minute-granularity display, so a 15s tick is smooth enough and cheap.
  const [now, setNow] = useState<number>(() => Date.now());
  const socketRef = useRef<Socket | null>(null);

  const fetchAvailability = useCallback(async () => {
    try {
      const res = await axios.get<{ status: boolean; data: Availability[] }>(
        `${process.env.REACT_APP_BACKEND_URL}/v1/games/availability`
      );
      const rows = res.data?.data ?? [];
      const next: Record<string, Availability> = {};
      for (const row of rows) next[row.game_id] = row;
      setByGameId(next);
    } catch (_error) {
      // A missing wait time is not worth an error message — the grid still works.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    void fetchAvailability();
    const timer = window.setInterval(fetchAvailability, POLL_MS);

    const socket = io(`${process.env.REACT_APP_BACKEND_URL}`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('availability.updated', () => {
      void fetchAvailability();
    });

    return () => {
      window.clearInterval(timer);
      socket.off('availability.updated');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchAvailability]);

  return useMemo(
    () => ({ byGameId, loaded, now, refresh: fetchAvailability }),
    [byGameId, loaded, now, fetchAvailability]
  );
};
