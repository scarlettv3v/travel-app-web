import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

// Small helpers so the app keeps working when the signal drops.
// Data is kept in the browser's localStorage (web). On other platforms it only
// lasts until the app is closed.

const memory = {};

export const store = {
  get(key, fallback) {
    try {
      let raw = null;
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(key);
      } else {
        raw = memory[key] ?? null;
      }
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      const raw = JSON.stringify(value);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, raw);
      } else {
        memory[key] = raw;
      }
    } catch (e) {
      // storage full or blocked: the app still works, it just won't remember
    }
  },
  // Removes every saved item whose key starts with one of the prefixes (used on log out)
  clear(prefixes) {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
          const key = localStorage.key(i);
          if (key && prefixes.some(p => key.startsWith(p))) localStorage.removeItem(key);
        }
      } else {
        Object.keys(memory).forEach(key => {
          if (prefixes.some(p => key.startsWith(p))) delete memory[key];
        });
      }
    } catch (e) {
      // nothing to clear
    }
  },
};

export const isOnlineNow = () =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

// true / false, updates by itself when the phone goes offline or comes back
export function useOnline() {
  const [online, setOnline] = useState(isOnlineNow);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return undefined;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

// True when a request failed because there is no connection (not because the server said no)
export function isNetworkError(error) {
  const text = String((error && error.message) || '');
  return (
    (error && error.name === 'TypeError') ||
    /Failed to fetch|Load failed|NetworkError|Network request failed/i.test(text)
  );
}

// Exchange rate: 1 `from` = ? `to`.
// Uses the live rate when online and remembers it. Offline it falls back to the
// last saved rate (or the inverse of a saved opposite rate).
export async function getRate(from, to) {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await response.json();
    if (data && data.rates) {
      store.set(`rates-${from}`, { rates: data.rates, time: Date.now() });
      if (data.rates[to]) return { rate: data.rates[to], cached: false };
    }
  } catch (e) {
    // offline: fall through to the saved rates
  }

  const direct = store.get(`rates-${from}`, null);
  if (direct && direct.rates && direct.rates[to]) {
    return { rate: direct.rates[to], cached: true };
  }
  const reverse = store.get(`rates-${to}`, null);
  if (reverse && reverse.rates && reverse.rates[from]) {
    return { rate: 1 / reverse.rates[from], cached: true };
  }
  return { rate: null, cached: false };
}