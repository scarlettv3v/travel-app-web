import React from 'react';
import { View } from 'react-native';

const INK = '#263a48';

export const SKINS = ['#ffe1bd', '#f5cba7', '#e0ac80', '#c68642', '#8d5524', '#5c3a21'];
export const HAIR_COLORS = ['#2b2b33', '#584b5a', '#76594d', '#a0522d', '#d9a441', '#b8bcc8', '#ec7869', '#4a90e2'];
export const OUTFITS = ['#ff9289', '#8ecdc0', '#ffc773', '#a5b4fc', '#f9a8d4', '#86efac', '#fdba74', '#93c5fd', '#c4b5fd', '#fca5a5'];
export const HAIR_STYLES = ['Short', 'Long', 'Bun', 'Spiky', 'Curly'];
export const ACCESSORIES = ['None', 'Glasses', 'Cap', 'Beanie'];

const KEYS = ['skin', 'hairStyle', 'hair', 'outfit', 'accessory'];
const LIMITS = [SKINS.length, HAIR_STYLES.length, HAIR_COLORS.length, OUTFITS.length, ACCESSORIES.length];

export const defaultLook = () => ({ skin: 0, hairStyle: 0, hair: 1, outfit: 0, accessory: 0 });

// A look is saved as a short text code like "av1-2-1-3-4-0".
// It goes into the same "character" field the app already uses, so every
// screen and every old record keeps working.
export function encodeLook(look) {
  return 'av1-' + KEYS.map(k => look[k] ?? 0).join('-');
}

export function decodeLook(code) {
  const text = String(code || '');
  if (text.startsWith('av1-')) {
    const parts = text.slice(4).split('-').map(Number);
    const look = {};
    KEYS.forEach((k, i) => {
      const n = parts[i];
      look[k] = Number.isInteger(n) && n >= 0 && n < LIMITS[i] ? n : 0;
    });
    return look;
  }
  // Old animal ids (like "fox") turn into a steady look picked from the text
  let n = 0;
  text.split('').forEach(ch => {
    n += ch.charCodeAt(0);
  });
  return {
    skin: n % SKINS.length,
    hairStyle: (n >> 1) % HAIR_STYLES.length,
    hair: (n * 3) % HAIR_COLORS.length,
    outfit: (n * 7) % OUTFITS.length,
    accessory: 0,
  };
}

// characterId = the look code (or an old animal id)
// look = a look object, used by the editor for the live preview
// outfit = optional colour that overrides the outfit (kept for the old Home colour picker)
// size = width of the figure. Its height is about 1.5 times that.
// sleeping = closed eyes and a faded look
export default function Avatar({ characterId, look, size = 28, outfit, sleeping = false }) {
  const l = look || decodeLook(characterId);
  const skin = SKINS[l.skin];
  const hair = HAIR_COLORS[l.hair];
  const shirt = outfit || OUTFITS[l.outfit];
  const style = l.hairStyle;
  const acc = l.accessory;
  const hat = acc === 2 || acc === 3;

  const u = size / 30; // drawn 30 wide, 43 tall, plus 4 spare at the top for hats and buns
  const p = v => v * u;
  const line = Math.max(1, Math.round(2 * u));
  const thin = Math.max(1, Math.round(1.5 * u));
  const box = { position: 'absolute', borderColor: INK };

  return (
    <View style={{ width: size, height: p(47), opacity: sleeping ? 0.85 : 1 }}>
      <View style={{ position: 'absolute', top: p(4), left: 0, width: size, height: p(43) }}>
        {/* long hair hangs behind the face */}
        {style === 1 ? (
          <>
            <View style={[box, { left: p(2), top: p(9), width: p(6), height: p(20), borderWidth: line, borderRadius: p(3), backgroundColor: hair }]} />
            <View style={[box, { left: p(22), top: p(9), width: p(6), height: p(20), borderWidth: line, borderRadius: p(3), backgroundColor: hair }]} />
          </>
        ) : null}

        {/* hair on top */}
        <View
          style={[
            box,
            {
              left: p(3),
              top: 0,
              width: p(24),
              height: p(17),
              borderWidth: line,
              borderTopLeftRadius: p(10),
              borderTopRightRadius: p(10),
              borderBottomLeftRadius: p(5),
              borderBottomRightRadius: p(5),
              backgroundColor: hair,
            },
          ]}
        />

        {/* hair extras (hidden under hats) */}
        {!hat && style === 2 ? (
          <View style={[box, { left: p(10), top: p(-5), width: p(10), height: p(10), borderWidth: line, borderRadius: p(5), backgroundColor: hair }]} />
        ) : null}
        {!hat && style === 3
          ? [6, 13, 20].map(x => (
              <View
                key={x}
                style={{
                  position: 'absolute',
                  left: p(x),
                  top: p(-5),
                  width: 0,
                  height: 0,
                  borderLeftWidth: p(3.5),
                  borderRightWidth: p(3.5),
                  borderBottomWidth: p(7),
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderBottomColor: hair,
                }}
              />
            ))
          : null}
        {!hat && style === 4
          ? [2, 10.5, 19].map(x => (
              <View key={x} style={[box, { left: p(x), top: p(-3), width: p(9), height: p(9), borderWidth: line, borderRadius: p(5), backgroundColor: hair }]} />
            ))
          : null}

        {/* face */}
        <View
          style={[
            box,
            { left: p(5), top: p(9), width: p(20), height: p(17), borderWidth: line, borderRadius: p(7), backgroundColor: skin },
          ]}
        >
          {sleeping ? (
            <>
              <View style={{ position: 'absolute', left: p(3), top: p(6), width: p(4), height: thin, backgroundColor: INK }} />
              <View style={{ position: 'absolute', left: p(10), top: p(6), width: p(4), height: thin, backgroundColor: INK }} />
            </>
          ) : (
            <>
              <View style={{ position: 'absolute', left: p(3), top: p(5), width: p(3), height: p(3), borderRadius: p(1.5), backgroundColor: INK }} />
              <View style={{ position: 'absolute', left: p(11), top: p(5), width: p(3), height: p(3), borderRadius: p(1.5), backgroundColor: INK }} />
            </>
          )}
          {acc === 1 ? (
            <>
              <View style={[box, { left: p(1), top: p(3), width: p(6), height: p(6), borderWidth: thin, borderRadius: p(1) }]} />
              <View style={[box, { left: p(9), top: p(3), width: p(6), height: p(6), borderWidth: thin, borderRadius: p(1) }]} />
              <View style={{ position: 'absolute', left: p(7), top: p(5), width: p(2), height: thin, backgroundColor: INK }} />
            </>
          ) : null}
        </View>

        {/* hats */}
        {acc === 2 ? (
          <>
            <View style={[box, { left: p(3), top: p(-2), width: p(24), height: p(10), borderWidth: line, borderTopLeftRadius: p(10), borderTopRightRadius: p(10), backgroundColor: '#e0605a' }]} />
            <View style={[box, { left: p(16), top: p(7), width: p(13), height: p(4), borderWidth: line, borderRadius: p(2), backgroundColor: '#e0605a' }]} />
          </>
        ) : null}
        {acc === 3 ? (
          <>
            <View style={[box, { left: p(3), top: p(-3), width: p(24), height: p(11), borderWidth: line, borderTopLeftRadius: p(10), borderTopRightRadius: p(10), backgroundColor: '#7aa2e3' }]} />
            <View style={[box, { left: p(2), top: p(6), width: p(26), height: p(4), borderWidth: line, borderRadius: p(2), backgroundColor: '#5d86c9' }]} />
          </>
        ) : null}

        {/* outfit */}
        <View
          style={[
            box,
            {
              left: p(4),
              top: p(27),
              width: p(22),
              height: p(12),
              borderWidth: line,
              borderTopLeftRadius: p(5),
              borderTopRightRadius: p(5),
              borderBottomLeftRadius: p(2),
              borderBottomRightRadius: p(2),
              backgroundColor: shirt,
            },
          ]}
        />
        {/* feet */}
        <View style={{ position: 'absolute', left: p(7), bottom: 0, width: p(5), height: p(5), backgroundColor: INK }} />
        <View style={{ position: 'absolute', left: p(18), bottom: 0, width: p(5), height: p(5), backgroundColor: INK }} />
      </View>
    </View>
  );
}