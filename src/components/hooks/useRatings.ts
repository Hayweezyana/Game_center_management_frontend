import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

/**
 * What players thought, for the customer-facing game grid.
 *
 * Separate from the admin feedback view on purpose: this endpoint is public and
 * carries no customer identity, and it hides any experience with too few
 * ratings to mean anything.
 */

export interface PublicComment {
  id: string;
  rating: number;
  comment: string;
  /** First name and an initial — never the full record. */
  name: string;
  created_at: string;
}

export interface GameRating {
  game_id: string;
  title: string;
  responses: number;
  average_rating: number;
  comments: PublicComment[];
}

const BACKEND = process.env.REACT_APP_BACKEND_URL?.replace(/\/+$/, '') || '';

/** Ratings move slowly — no need to poll them like wait times. */
const REFRESH_MS = 5 * 60_000;

export const useRatings = () => {
  const [byGameId, setByGameId] = useState<Record<string, GameRating>>({});
  const [minResponses, setMinResponses] = useState(3);

  const fetchRatings = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/v1/games/ratings`);
      const data = res.data?.data;
      const next: Record<string, GameRating> = {};
      for (const row of data?.games ?? []) {
        next[String(row.game_id)] = row;
      }
      setByGameId(next);
      if (typeof data?.min_responses === 'number') setMinResponses(data.min_responses);
    } catch (_error) {
      // Ratings are decoration on this page — a failure must never stop someone
      // choosing a game, so this stays silent and the cards simply show none.
    }
  }, []);

  useEffect(() => {
    void fetchRatings();
    const timer = window.setInterval(fetchRatings, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchRatings]);

  return useMemo(() => ({ byGameId, minResponses, refresh: fetchRatings }), [byGameId, minResponses, fetchRatings]);
};

/** Rounded to halves, which is what the star row can actually draw. */
export const starFill = (average: number): number => Math.round(average * 2) / 2;
