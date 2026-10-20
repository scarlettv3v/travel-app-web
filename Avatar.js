import React from 'react';
import Svg, { Path, Circle, Ellipse, Rect, G } from 'react-native-svg';

const INK = '#263a48';

export const SKINS = ['#ffe1bd', '#f5cba7', '#e0ac80', '#c68642', '#8d5524', '#5c3a21'];
export const HAIR_COLORS = ['#2b2b33', '#584b5a', '#76594d', '#a0522d', '#d9a441', '#b8bcc8', '#9aa5b1', '#ec7869', '#4a90e2'];
export const OUTFITS = ['#ff9289', '#ff9f4d', '#ffc773', '#8ecdc0', '#5ba3c7', '#f9a8d4', '#93c5fd', '#2b2b33'];
// Order matters: a saved look stores the INDEX, so never reorder this list.
// 'Short Wavy' = the tousled "Short" in the reference sheet.
export const HAIR_STYLES = ['Short Wavy', 'Long', 'Bun', 'Ponytail', 'Curly', 'Bob', 'Braids', 'Wavy', 'Short Smooth'];
export const ACCESSORIES = ['None', 'Glasses', 'Cap', 'Beanie', 'Headphones', 'Hairband', 'Sunglasses', 'Scarf'];

const KEYS = ['skin', 'hairStyle', 'hair', 'outfit', 'accessory'];
const LIMITS = [SKINS.length, HAIR_STYLES.length, HAIR_COLORS.length, OUTFITS.length, ACCESSORIES.length];

export const defaultLook = () => ({ skin: 0, hairStyle: 0, hair: 1, outfit: 0, accessory: 0 });

// A look is saved as a short text code like "av1-2-1-3-4-0".
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

/* ------------------------------------------------------------------ */
/*  SHAPE DATA  (viewBox 0 0 100 130)                                  */
/*                                                                    */
/*  Every hair style is described by 4 things:                         */
/*   back     closed silhouette, drawn BEHIND body + face (full outline)*/
/*   hairline open line across the forehead (this is the only outline  */
/*            drawn on top of the face)                                */
/*   close    how the fill above the hairline is closed (hidden shape) */
/*   ears     true = ears stay visible, false = hair covers them       */
/*   extra    optional back piece: 'bun' | 'ponytail' | 'braids'       */
/* ------------------------------------------------------------------ */
// <HAIR_DATA>
const SHAPES = {
  face: `
    M 22 51 C 22 40, 34 34, 50 34 C 66 34, 78 40, 78 51
    L 78 68 C 78 80, 70 87, 59 88 Q 50 89, 41 88
    C 30 87, 22 80, 22 68 Z`,
  // full jaw line, used when the ears show or hair does not hide the cheeks
  cheeks: `
    M 22 63 L 22 68 C 22 80, 30 87, 41 88
    Q 50 89, 59 88 C 70 87, 78 80, 78 68 L 78 63`,
  // chin only, used when hair hangs over the cheeks (no stray line by the ears)
  chin: `
    M 31 85 C 34 87, 38 88, 41 88 Q 50 89, 59 88
    C 62 88, 66 87, 69 85`,
  shirt: `
    M 26 112 L 26 99 C 26 91, 33 87, 42 87 L 58 87
    C 67 87, 74 91, 74 99 L 74 109 Q 74 112, 71 112 Z`,
};

// Hidden closing shapes for the fill above the hairline. They follow the face
// edge (x = 22 / 78) so they never sit on top of the hair's own outline.
const NARROW = 'L 78 52 C 78 38, 66 31, 50 31 C 34 31, 22 38, 22 52 Z';
const WIDE = 'L 78 85 L 78 44 C 76 24, 24 24, 22 44 L 22 85 Z';
const HAT_WIDE = 'L 82 43 C 68 27, 32 27, 18 43 Z';

// Smooth dome for Bun / Ponytail / Braids. The lower sides sit just outside
// the face edge, so the outline keeps its full thickness there.
const DOME = `
  M 19 62 C 16 46, 24 28, 50 25 C 76 28, 84 46, 81 62
  L 77 72 L 23 72 Z`;

const BUN_PATH = `
  M 36 28 C 29 24, 29 15, 35 10 C 42 4, 53 6, 58 12
  C 63 18, 60 26, 54 29 Z`;
const PONYTAIL_PATH = `
  M 69 28 C 73 15, 86 16, 92 27 C 97 37, 90 44, 94 49
  Q 96 52, 98 51 C 89 57, 80 51, 81 42 C 82 34, 77 31, 72 33 Z`;
const BRAID_PATHS = [
  `M 22 55 C 16 60, 16 67, 19 71 C 13 76, 14 82, 18 85
   C 12 90, 14 96, 18 99 C 15 103, 17 108, 22 109
   C 28 107, 30 102, 26 98 C 31 93, 29 87, 25 84
   C 30 79, 28 73, 25 70 C 29 64, 28 59, 22 55 Z`,
  `M 78 55 C 84 60, 84 67, 81 71 C 87 76, 86 82, 82 85
   C 88 90, 86 96, 82 99 C 85 103, 83 108, 78 109
   C 72 107, 70 102, 74 98 C 69 93, 71 87, 75 84
   C 70 79, 72 73, 75 70 C 71 64, 72 59, 78 55 Z`,
];
const BRAID_BANDS = 'M 18 103 L 25 103 M 75 103 L 82 103';

// back     closed silhouette drawn behind body + face
// hairline open line across the forehead (the only outline over the face)
// close    hidden shape that fills the hair above the hairline
// ears     true = ears visible, false = hair covers them
// chin     true = only the chin is outlined (hair covers the cheeks)
const HAIR = {
  'Short Wavy': {
    ears: true,
    back: `
      M 21 65 L 18 52 Q 14 47, 19 42 L 17 35 L 27 32 L 29 25
      L 39 28 L 46 23 L 54 27 L 63 25 L 67 31 L 76 32 L 77 39
      Q 85 43, 80 51 L 79 65 L 73 72 L 27 72 Z`,
    hairline: `
      M 22 59 L 28 53 Q 34 55, 40 48 Q 43 55, 50 48
      Q 56 53, 63 47 Q 67 53, 74 52 L 78 59`,
    close: NARROW,
  },

  Long: {
    ears: false,
    chin: true,
    back: `
      M 18 54 C 16 36, 29 22, 49 22 C 69 22, 83 36, 82 54
      C 82 64, 87 72, 88 82 C 89 94, 84 106, 72 108
      L 28 108 C 16 106, 11 94, 12 82 C 13 72, 18 64, 18 54 Z`,
    hairline: `
      M 31 85 C 26 80, 23 70, 25 58 C 36 55, 46 48, 50 37
      C 54 48, 64 55, 75 58 C 77 70, 74 80, 69 85`,
    close: WIDE,
  },

  Bun: {
    ears: true,
    extra: 'bun',
    back: DOME,
    hairline: `
      M 22 58 C 30 57, 37 53, 42 46 Q 45 52, 51 55
      Q 55 52, 58 45 C 63 52, 70 57, 78 58`,
    close: NARROW,
  },

  Ponytail: {
    ears: true,
    extra: 'ponytail',
    back: DOME,
    hairline: `
      M 22 57 C 37 58, 51 52, 57 42 C 61 51, 69 57, 78 58`,
    close: NARROW,
  },

  Curly: {
    ears: false,
    back: `
      M 19 44 Q 12 36, 23 32 Q 21 23, 32 25 Q 36 17, 44 23
      Q 51 15, 58 23 Q 68 18, 72 27 Q 84 25, 83 36
      Q 94 39, 88 48 Q 97 55, 89 63 Q 97 72, 88 78
      Q 91 89, 80 91 Q 77 100, 67 95 L 33 95
      Q 23 100, 20 91 Q 9 89, 12 78 Q 3 72, 11 63
      Q 3 55, 12 48 Q 11 44, 19 44 Z`,
    hairline: `
      M 22 63 Q 24 55, 30 57 Q 32 48, 39 52 Q 43 43, 50 49
      Q 56 42, 61 51 Q 69 47, 71 56 Q 77 54, 78 63`,
    close: NARROW,
  },

  // your blocky fringe, now with side strands that hide the ears and cheeks
  Bob: {
    ears: false,
    chin: true,
    back: `
      M 17 78 L 18 51 C 19 33, 31 24, 50 24 C 69 24, 81 33, 82 51
      L 83 78 Q 83 86, 73 87 L 27 87 Q 17 86, 17 78 Z`,
    hairline: `
      M 31 85 C 27 78, 25 68, 25 61 L 26 53 L 40 53 L 43 46
      L 43 53 L 59 53 L 60 45 L 62 53 L 74 53 L 75 61
      C 75 68, 73 78, 69 85`,
    close: WIDE,
  },

  Braids: {
    ears: false,
    extra: 'braids',
    back: DOME,
    hairline: `
      M 22 59 C 35 57, 47 51, 53 41 C 56 49, 66 57, 78 59`,
    close: NARROW,
  },

  Wavy: {
    ears: false,
    chin: true,
    back: `
      M 20 52 C 19 36, 32 24, 49 24 C 67 23, 80 36, 80 51
      Q 87 60, 82 69 Q 91 79, 84 88 C 90 100, 78 105, 69 101
      L 31 101 C 22 105, 10 100, 16 88 Q 9 79, 18 69
      Q 13 60, 20 52 Z`,
    hairline: `
      M 31 85 C 26 80, 23 70, 25 58 C 36 56, 44 49, 51 39
      C 55 49, 65 58, 75 58 C 77 70, 74 80, 69 85`,
    close: WIDE,
  },

  'Short Smooth': {
    ears: true,
    back: `
      M 17 63 C 12 51, 17 34, 31 27 C 43 20, 60 21, 72 28
      C 84 35, 88 50, 83 63 L 78 73 L 22 73 Z`,
    hairline: `
      M 17 61 Q 21 61, 25 58 C 34 58, 41 54, 46 48
      Q 50 56, 57 56 Q 64 55, 68 50 Q 73 58, 83 61`,
    close: HAT_WIDE,
  },
};
// </HAIR_DATA>

/* ------------------------------------------------------------------ */

const OUTLINE = {
  stroke: INK,
  strokeWidth: 3.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function HairBack({ style, hair, hasHat }) {
  const h = HAIR[style] || HAIR['Short Smooth'];
  return (
    <G>
      {/* bun and ponytail are hidden under a cap / beanie */}
      {!hasHat && h.extra === 'bun' && (
        <Path d={BUN_PATH} fill={hair} {...OUTLINE} />
      )}

      {!hasHat && h.extra === 'ponytail' && (
        <G>
          <Path d={PONYTAIL_PATH} fill={hair} {...OUTLINE} />
          <Path
            d="M 79 24 C 88 27, 88 34, 87 39"
            fill="none"
            stroke={INK}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.25}
          />
        </G>
      )}

      {h.extra === 'braids' && (
        <G>
          {BRAID_PATHS.map((d, i) => (
            <Path key={i} d={d} fill={hair} {...OUTLINE} />
          ))}
          <Path d={BRAID_BANDS} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </G>
      )}

      <Path d={h.back} fill={hair} {...OUTLINE} />
    </G>
  );
}

function HairFront({ style, hair }) {
  const h = HAIR[style] || HAIR['Short Smooth'];
  return (
    <G>
      {/* fill only: hides the top of the face under the hair */}
      <Path
        d={`${h.hairline} ${h.close}`}
        fill={hair}
        stroke={hair}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {/* the only outline drawn over the face */}
      <Path d={h.hairline} fill="none" {...OUTLINE} />
    </G>
  );
}

function AvatarFigure({ look, size = 28, outfit, sleeping = false }) {
  const skin = SKINS[look.skin] || SKINS[0];
  const hair = HAIR_COLORS[look.hair] || HAIR_COLORS[0];
  const shirt = outfit || OUTFITS[look.outfit] || OUTFITS[0];
  const accessory = ACCESSORIES[look.accessory] || 'None';
  const hasHat = accessory === 'Cap' || accessory === 'Beanie';
  const style = HAIR_STYLES[look.hairStyle] || 'Short Smooth';
  const showEars = HAIR[style].ears;

  return (
    <Svg
      width={size}
      height={size * 1.3}
      viewBox="0 0 100 130"
      style={{ opacity: sleeping ? 0.85 : 1 }}
    >
      {/* 1. back hair, bun / ponytail / plaits */}
      <HairBack style={style} hair={hair} hasHat={hasHat} />

      {/* 2. body */}
      <G transform="translate(0, 2)">
        <Rect x={33} y={111} width={10} height={9} rx={1} fill={INK} />
        <Rect x={57} y={111} width={10} height={9} rx={1} fill={INK} />
        <Path d={SHAPES.shirt} fill={shirt} {...OUTLINE} />
      </G>

      {/* 3. ears */}
      {showEars && (
        <G>
          <Ellipse cx={22} cy={66} rx={4.5} ry={6} fill={skin} {...OUTLINE} />
          <Ellipse cx={78} cy={66} rx={4.5} ry={6} fill={skin} {...OUTLINE} />
        </G>
      )}

      {/* 4. face */}
      <Path d={SHAPES.face} fill={skin} stroke="none" />
      <Path d={HAIR[style].chin ? SHAPES.chin : SHAPES.cheeks} fill="none" {...OUTLINE} />

      {/* 5. front hair */}
      <HairFront style={style} hair={hair} />

      {/* 6. eyes */}
      {sleeping ? (
        <G fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round">
          <Path d="M 33 68 Q 37 71, 41 68" />
          <Path d="M 59 68 Q 63 71, 67 68" />
        </G>
      ) : (
        <G fill={INK}>
          <Ellipse cx={37} cy={68} rx={2.5} ry={3.2} />
          <Ellipse cx={63} cy={68} rx={2.5} ry={3.2} />
        </G>
      )}

      {/* 7. accessories */}
      {accessory === 'Glasses' && (
        <G fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round">
          <Circle cx={37} cy={68} r={8.5} />
          <Circle cx={63} cy={68} r={8.5} />
          <Path d="M 46 67 Q 50 64, 54 67" />
          <Path d="M 23 65 L 28 66 M 72 66 L 77 65" />
        </G>
      )}

      {accessory === 'Sunglasses' && (
        <G>
          <Path
            d="M 26 62 L 46 62 L 44 73 Q 37 78, 29 73 Z
               M 54 62 L 74 62 L 71 73 Q 63 78, 56 73 Z"
            fill={INK}
            stroke={INK}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path d="M 46 65 Q 50 63, 54 65" fill="none" stroke={INK} strokeWidth={3} />
        </G>
      )}

      {accessory === 'Cap' && (
        <G>
          <Path
            d="M 19 46 L 19 39 C 19 23, 33 18, 49 18 C 66 18, 79 25, 79 40 L 79 46 Z"
            fill="#ef6a60"
            {...OUTLINE}
          />
          <Path
            d="M 16 47 Q 46 38, 78 44 L 89 48 Q 94 52, 88 55
               L 76 55 Q 47 46, 18 54 Q 12 54, 16 47 Z"
            fill="#df584f"
            {...OUTLINE}
          />
        </G>
      )}

      {accessory === 'Beanie' && (
        <G>
          <Circle cx={50} cy={17} r={7} fill="#8cb8ee" {...OUTLINE} />
          <Path
            d="M 20 44 C 21 26, 34 21, 50 21 C 66 21, 79 28, 80 44 Z"
            fill="#8cb8ee"
            {...OUTLINE}
          />
          <Rect x={18} y={42} width={64} height={12} rx={4} fill="#719ed9" {...OUTLINE} />
          {[28, 39, 50, 61, 72].map(x => (
            <Path key={x} d={`M ${x} 45 L ${x} 51`} stroke={INK} strokeWidth={1.6} opacity={0.5} />
          ))}
        </G>
      )}

      {accessory === 'Headphones' && (
        <G>
          <Path
            d="M 16 68 L 16 55 C 16 17, 84 17, 84 55 L 84 68"
            fill="none"
            stroke={INK}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <Path
            d="M 16 68 L 16 55 C 16 17, 84 17, 84 55 L 84 68"
            fill="none"
            stroke="#f4f1e9"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Rect x={13} y={59} width={10} height={20} rx={4} fill="#f4f1e9" {...OUTLINE} />
          <Rect x={77} y={59} width={10} height={20} rx={4} fill="#f4f1e9" {...OUTLINE} />
        </G>
      )}

      {accessory === 'Hairband' && (
        <G>
          <Path d="M 25 42 Q 50 23, 75 42" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <Path d="M 25 42 Q 50 23, 75 42" fill="none" stroke="#f5d46e" strokeWidth={3} strokeLinecap="round" />
          <Path
            d="M 49 31 C 36 19, 29 25, 36 31 Q 42 35, 49 31 Z
               M 51 31 C 64 19, 71 25, 64 31 Q 58 35, 51 31 Z"
            fill="#f5d46e"
            {...OUTLINE}
          />
          <Circle cx={50} cy={31} r={3.5} fill="#f5d46e" stroke={INK} strokeWidth={2} />
        </G>
      )}

      {accessory === 'Scarf' && (
        <G>
          <Path d="M 37 94 L 36 109 L 45 111 L 47 96 Z" fill="#ed7669" {...OUTLINE} />
          <Path d="M 30 85 Q 50 94, 70 85 L 71 95 Q 50 105, 29 95 Z" fill="#ed7669" {...OUTLINE} />
        </G>
      )}
    </Svg>
  );
}

export default function Avatar(props) {
  const look = props.look || decodeLook(props.characterId);
  return <AvatarFigure {...props} look={look} />;
}