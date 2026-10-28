import { Platform, Linking } from 'react-native';

// Google Maps helpers. No built-in maps: we save the address as text and let Google find the place.

const enc = encodeURIComponent;

const isMobileWeb = () =>
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// On a phone's browser, open in the same tab so Google Maps (or its app) opens directly and
// you come back with the Back button, with no extra tab to close. On a computer, a new tab.
export const openExternal = url => {
  if (Platform.OS === 'web') {
    if (isMobileWeb()) window.location.assign(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => {});
  }
};

const openUrl = openExternal;

// "Name, address" as one search text (no doubling when the address already starts with the name)
function placeText({ name, address }) {
  const n = (name || '').trim();
  const a = (address || '').trim();
  if (n && a && !a.toLowerCase().startsWith(n.toLowerCase())) return `${n}, ${a}`;
  return a || n;
}

// Opens the place in Google Maps as a search by name and address,
// so Google shows the real listing (reviews, photos, hours).
export function openPlace({ name, address }) {
  const text = placeText({ name, address });
  if (!text) return;
  openUrl(`https://www.google.com/maps/search/?api=1&query=${enc(text)}`);
}

// Opens a driving route through several places, in order, in Google Maps.
// stops: [{ name, address }]
export function openRoute(stops) {
  const texts = (stops || []).map(placeText).filter(Boolean);
  if (texts.length === 0) return;
  if (texts.length === 1) {
    openUrl(`https://www.google.com/maps/search/?api=1&query=${enc(texts[0])}`);
    return;
  }
  const origin = texts[0];
  const destination = texts[texts.length - 1];
  const middle = texts.slice(1, -1).slice(0, 8);
  let url =
    `https://www.google.com/maps/dir/?api=1&travelmode=driving` +
    `&origin=${enc(origin)}&destination=${enc(destination)}`;
  if (middle.length) url += `&waypoints=${enc(middle.join('|'))}`;
  openUrl(url);
}