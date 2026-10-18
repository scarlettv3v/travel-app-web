import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

export const MAX_DAYS = 60;
export const DEFAULT_START = '2026-11-21';
export const DEFAULT_END = '2026-12-02';

const toUtc = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const toIso = t => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

export function dayCount(start, end) {
  return Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1;
}

export function buildDays(start, end) {
  const days = [];
  for (let t = toUtc(start); t <= toUtc(end) && days.length < MAX_DAYS; t += DAY_MS) {
    const d = new Date(t);
    days.push({
      iso: toIso(t),
      dayNumber: days.length + 1,
      short: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
      weekday: WEEKDAYS[d.getUTCDay()],
    });
  }
  return days;
}

export function formatRange(start, end) {
  const [, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

const TripContext = createContext({
  start: DEFAULT_START,
  end: DEFAULT_END,
  label: formatRange(DEFAULT_START, DEFAULT_END),
  days: buildDays(DEFAULT_START, DEFAULT_END),
  saveTrip: async () => false,
});

export function TripProvider({ authToken, children }) {
  const [range, setRange] = useState({ start: DEFAULT_START, end: DEFAULT_END });

  const load = useCallback(async () => {
    try {
      const res = await firestoreFetch(`${FIRESTORE_BASE}/settings/trip`, authToken);
      const doc = await res.json();
      const s = doc.fields?.start?.stringValue;
      const e = doc.fields?.end?.stringValue;
      if (s && e) {
        setRange(prev => (prev.start === s && prev.end === e ? prev : { start: s, end: e }));
      }
    } catch (error) {
      // 404 just means the dates were never set, so the defaults are used
      if (!String(error.message).includes('(404)')) {
        console.error('Error loading trip dates:', error);
      }
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [authToken, load]);

  const saveTrip = useCallback(
    async (start, end) => {
      try {
        await firestoreFetch(`${FIRESTORE_BASE}/settings/trip`, authToken, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              start: { stringValue: start },
              end: { stringValue: end },
            },
          }),
        });
        setRange({ start, end });
        return true;
      } catch (error) {
        console.error('Error saving trip dates:', error);
        return false;
      }
    },
    [authToken]
  );

  const value = useMemo(
    () => ({
      start: range.start,
      end: range.end,
      label: formatRange(range.start, range.end),
      days: buildDays(range.start, range.end),
      saveTrip,
    }),
    [range, saveTrip]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  return useContext(TripContext);
}