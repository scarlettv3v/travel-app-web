import React from 'react';
import { View } from 'react-native';
import Svg, {
  Path,
  Circle,
  Ellipse,
  Rect,
  G,
} from 'react-native-svg';

const INK = '#263a48';

export const SKINS = ['#ffe1bd', '#f5cba7', '#e0ac80', '#c68642', '#8d5524', '#5c3a21'];
export const HAIR_COLORS = ['#2b2b33', '#584b5a', '#76594d', '#a0522d', '#d9a441', '#b8bcc8', '#9aa5b1', '#ec7869', '#4a90e2'];
export const OUTFITS = ['#ff9289', '#ff9f4d', '#ffc773', '#8ecdc0', '#5ba3c7', '#f9a8d4', '#93c5fd', '#2b2b33'];
export const HAIR_STYLES = ['Short Wavy', 'Long', 'Bun', 'Ponytail', 'Curly', 'Bob', 'Braids', 'Wavy', 'Short Smooth'];
export const ACCESSORIES = ['None', 'Glasses', 'Cap', 'Beanie', 'Headphones', 'Hairband', 'Sunglasses', 'Scarf'];

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
function LegacyAvatar({ characterId, look, size = 28, outfit, sleeping = false }) {
  const l = look || decodeLook(characterId);
  const skin = SKINS[l.skin];
  const hair = HAIR_COLORS[l.hair];
  const shirt = outfit || OUTFITS[l.outfit];
  const style = l.hairStyle;
  const acc = l.accessory;
  const hat = acc === 2 || acc === 3;

  const u = size / 30; // drawn 30 wide, 43 tall, plus 4 spare at the top for hats, buns and ponytails
  const p = v => v * u;
  const line = Math.max(1, Math.round(2 * u));
  const thin = Math.max(1, Math.round(1.5 * u));
  const box = { position: 'absolute', borderColor: INK };

  return (
    <View style={{ width: size, height: p(47), opacity: sleeping ? 0.85 : 1 }}>
      <View style={{ position: 'absolute', top: p(4), left: 0, width: size, height: p(43) }}>

        {/* long / bob / wavy hair hangs behind the face */}
        {style === 1 || style === 5 || style === 7 ? (
          <>
            <View
              style={[
                box,
                {
                  left: p(2),
                  top: p(9),
                  width: p(6),
                  height: style === 1 ? p(22) : style === 7 ? p(18) : p(14),
                  borderWidth: line,
                  borderRadius: p(3),
                  backgroundColor: hair,
                },
              ]}
            />
            <View
              style={[
                box,
                {
                  left: p(22),
                  top: p(9),
                  width: p(6),
                  height: style === 1 ? p(22) : style === 7 ? p(18) : p(14),
                  borderWidth: line,
                  borderRadius: p(3),
                  backgroundColor: hair,
                },
              ]}
            />
          </>
        ) : null}

        {/* braids hang lower and thinner, with little bands */}
        {style === 6 ? (
          <>
            <View style={[box, { left: p(2.5), top: p(9), width: p(4.5), height: p(23), borderWidth: line, borderRadius: p(2.5), backgroundColor: hair }]} />
            <View style={[box, { left: p(23), top: p(9), width: p(4.5), height: p(23), borderWidth: line, borderRadius: p(2.5), backgroundColor: hair }]} />
            <View style={{ position: 'absolute', left: p(2.5), top: p(20), width: p(4.5), height: thin, backgroundColor: INK }} />
            <View style={{ position: 'absolute', left: p(23), top: p(20), width: p(4.5), height: thin, backgroundColor: INK }} />
          </>
        ) : null}

        {/* ponytail trails to one side */}
        {!hat && style === 3 ? (
          <View style={[box, { left: p(23), top: p(2), width: p(6), height: p(16), borderWidth: line, borderRadius: p(3), backgroundColor: hair, transform: [{ rotate: '20deg' }] }]} />
        ) : null}

        {/* hair cap on top of the head */}
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
          {acc === 6 ? (
            <>
              <View style={[box, { left: p(1), top: p(3), width: p(6), height: p(6), borderWidth: thin, borderRadius: p(2), backgroundColor: '#2b2b33' }]} />
              <View style={[box, { left: p(9), top: p(3), width: p(6), height: p(6), borderWidth: thin, borderRadius: p(2), backgroundColor: '#2b2b33' }]} />
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

        {/* headphones sit over the ears, on top of any hair */}
        {acc === 4 ? (
          <>
            <View style={[box, { left: p(1), top: p(2), width: p(28), height: p(14), borderWidth: line, borderTopLeftRadius: p(14), borderTopRightRadius: p(14), borderBottomWidth: 0, backgroundColor: 'transparent' }]} />
            <View style={[box, { left: p(0), top: p(11), width: p(6), height: p(8), borderWidth: line, borderRadius: p(2), backgroundColor: '#f4f4f4' }]} />
            <View style={[box, { left: p(24), top: p(11), width: p(6), height: p(8), borderWidth: line, borderRadius: p(2), backgroundColor: '#f4f4f4' }]} />
          </>
        ) : null}

        {/* hairband sits across the top of the hair */}
        {acc === 5 ? (
          <View style={[box, { left: p(5), top: p(3), width: p(20), height: p(4), borderWidth: thin, borderRadius: p(2), backgroundColor: '#f6d860' }]} />
        ) : null}

        {/* scarf wraps the neck, over the shirt */}
        {acc === 7 ? (
          <View style={[box, { left: p(5), top: p(24), width: p(20), height: p(5), borderWidth: line, borderRadius: p(2), backgroundColor: '#e0605a' }]} />
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
function SweptHairAvatar({
  look,
  size = 28,
  outfit,
  sleeping = false,
  ponytail = false,
}) {
  const skin = SKINS[look.skin] || SKINS[0];
  const hair = HAIR_COLORS[look.hair] || HAIR_COLORS[0];
  const shirt = outfit || OUTFITS[look.outfit] || OUTFITS[0];

  const accessory = ACCESSORIES[look.accessory] || 'None';
  const hasHat = accessory === 'Cap' || accessory === 'Beanie';

  const outline = {
    stroke: INK,
    strokeWidth: 3.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <Svg
      width={size}
      height={size * (47 / 30)}
      viewBox="0 0 100 156.6667"
      style={{ opacity: sleeping ? 0.85 : 1 }}
    >
      {/* Back hair: drawn behind the face. */}
      {!hasHat && (
        ponytail ? (
          <G>
            {/* High ponytail with a curved, tapered end. */}
            <Path
              d="
                M 68 29
                C 71 16, 86 16, 92 28
                C 97 38, 91 47, 94 53
                Q 95 56, 98 56
                C 89 62, 81 55, 81 46
                C 82 37, 78 32, 72 34
                Z
              "
              fill={hair}
              {...outline}
            />

            {/* Subtle strand following the ponytail's curve. */}
            <Path
              d="M 78 25 C 88 27, 88 35, 87 42"
              fill="none"
              stroke={INK}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.3}
            />

            {/* Hair tie at the attachment point. */}
            <Path
              d="M 71 28 L 77 33"
              fill="none"
              stroke={INK}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </G>
        ) : (
          <G>
            {/* Bun: slightly flattened where it meets the head. */}
            <Path
              d="
                M 35 30
                C 29 26, 29 16, 35 11
                C 42 5, 53 7, 58 13
                C 62 19, 59 27, 54 31
                Z
              "
              fill={hair}
              {...outline}
            />

            {/* A small curved strand, not a separate outlined lump. */}
            <Path
              d="M 36 22 C 38 14, 48 12, 54 18"
              fill="none"
              stroke={INK}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.25}
            />
          </G>
        )
      )}

      {/* Main hair silhouette. */}
      {/* Solid backing behind the face; the fringe draws the top outline. */}
<Path
  d="
    M 22 63
    C 20 49, 28 35, 42 31
    C 57 27, 72 35, 77 49
    L 79 72
    L 73 83
    L 27 83
    L 21 72
    Z
  "
  fill={hair}
/>

      {/* Feet, behind the shirt. */}
      <Path
        d="M 32 141 L 32 153 L 43 153 L 43 141 Z"
        fill={INK}
      />
      <Path
        d="M 57 141 L 57 153 L 68 153 L 68 141 Z"
        fill={INK}
      />

      {/* Neck. */}
      <Rect
        x={43}
        y={94}
        width={14}
        height={14}
        rx={4}
        fill={skin}
        {...outline}
      />

      {/* Shirt: rounded shoulders, straighter lower edge. */}
      <Path
        d="
          M 24 142
          L 24 118
          C 24 108, 32 103, 42 103
          L 58 103
          C 68 103, 76 108, 76 118
          L 76 142
          Z
        "
        fill={shirt}
        {...outline}
      />

      {/* Small neckline highlight. */}
      <Path
        d="M 43 106 Q 50 110, 57 106"
        fill="none"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.32}
      />

      {/* Ears behind the face. */}
      <Ellipse
        cx={22}
        cy={72}
        rx={5}
        ry={7}
        fill={skin}
        {...outline}
      />
      <Ellipse
        cx={78}
        cy={72}
        rx={5}
        ry={7}
        fill={skin}
        {...outline}
      />

      {/* Rounded face, with space above the eyes for the fringe. */}
      <Path
        d="
          M 23 58
          C 23 46, 34 39, 50 39
          C 66 39, 77 47, 77 59
          L 77 77
          C 77 91, 66 99, 50 99
          C 34 99, 23 91, 23 77
          Z
        "
        fill={skin}
        {...outline}
      />

      {/* Each style gets its own forehead/fringe outline. */}
      {ponytail ? (
        <Path
          d="
            M 20 62
            C 17 47, 26 31, 42 28
            C 59 24, 74 33, 79 46
            L 79 62
            C 69 61, 61 55, 57 45
            C 53 55, 39 62, 20 62
            Z
          "
          fill={hair}
          {...outline}
        />
      ) : (
        <Path
          d="
            M 20 62
            C 17 47, 27 32, 42 28
            C 60 23, 76 34, 80 49
            L 80 63
            C 71 62, 63 56, 58 48
            Q 55 55, 51 58
            Q 45 55, 42 49
            C 37 56, 30 60, 20 62
            Z
          "
          fill={hair}
          {...outline}
        />
      )}

      {/* Small tapered side locks instead of rectangular side bars. */}
      <Path
        d="
          M 22 61
          Q 19 74, 25 84
          Q 19 81, 18 72
          L 18 63
          Z
        "
        fill={hair}
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="
          M 77 61
          Q 82 73, 76 84
          Q 83 80, 82 69
          L 81 63
          Z
        "
        fill={hair}
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Eyes. */}
      {sleeping ? (
        <G
          fill="none"
          stroke={INK}
          strokeWidth={3}
          strokeLinecap="round"
        >
          <Path d="M 33 76 Q 37 79, 41 76" />
          <Path d="M 59 76 Q 63 79, 67 76" />
        </G>
      ) : (
        <G fill={INK}>
          <Ellipse cx={37} cy={75} rx={2.5} ry={3.5} />
          <Ellipse cx={63} cy={75} rx={2.5} ry={3.5} />
        </G>
      )}

      {/* Glasses. */}
      {accessory === 'Glasses' && (
        <G
          fill="none"
          stroke={INK}
          strokeWidth={2.8}
          strokeLinecap="round"
        >
          <Circle cx={37} cy={75} r={9} />
          <Circle cx={63} cy={75} r={9} />
          <Path d="M 46 74 Q 50 71, 54 74" />
          <Path d="M 23 72 L 28 73 M 72 73 L 77 72" />
        </G>
      )}

      {/* Sunglasses. */}
      {accessory === 'Sunglasses' && (
        <G>
          <Path
            d="
              M 26 69 L 46 69 L 44 80
              Q 37 86, 29 80 Z
            "
            fill={INK}
            stroke={INK}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path
            d="
              M 54 69 L 74 69 L 71 80
              Q 63 86, 56 80 Z
            "
            fill={INK}
            stroke={INK}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path
            d="M 46 72 Q 50 70, 54 72"
            fill="none"
            stroke={INK}
            strokeWidth={3}
          />
          <Path
            d="M 30 71 L 38 71 M 58 71 L 66 71"
            stroke="#ffffff"
            strokeWidth={2}
            opacity={0.25}
          />
        </G>
      )}

      {/* Cap: bun/ponytail is hidden when wearing a hat. */}
      {accessory === 'Cap' && (
        <G>
          <Path
            d="
              M 19 51
              L 19 43
              C 19 26, 32 20, 49 20
              C 66 20, 79 28, 79 44
              L 79 51
              Z
            "
            fill="#ef6a60"
            {...outline}
          />
          <Path
            d="
              M 16 52
              Q 45 42, 78 49
              L 89 53
              Q 94 57, 88 60
              L 76 60
              Q 47 51, 18 59
              Q 12 59, 16 52
              Z
            "
            fill="#df584f"
            {...outline}
          />
        </G>
      )}

      {/* Beanie. */}
      {accessory === 'Beanie' && (
        <G>
          <Circle
            cx={50}
            cy={21}
            r={8}
            fill="#8cb8ee"
            {...outline}
          />
          <Path
            d="
              M 20 49
              C 21 30, 33 24, 50 24
              C 67 24, 79 32, 80 49
              Z
            "
            fill="#8cb8ee"
            {...outline}
          />
          <G
            fill="none"
            stroke={INK}
            strokeWidth={1.8}
            opacity={0.55}
          >
            <Path d="M 36 29 Q 31 39, 31 48" />
            <Path d="M 46 27 L 44 48" />
            <Path d="M 55 27 L 57 48" />
            <Path d="M 65 30 Q 70 39, 70 48" />
          </G>
          <Rect
            x={18}
            y={47}
            width={64}
            height={13}
            rx={4}
            fill="#719ed9"
            {...outline}
          />
          {[27, 38, 49, 60, 71].map(x => (
            <Path
              key={x}
              d={`M ${x} 50 L ${x} 57`}
              stroke={INK}
              strokeWidth={1.8}
              opacity={0.55}
            />
          ))}
        </G>
      )}

      {/* Headphones. */}
      {accessory === 'Headphones' && (
        <G>
          <Path
            d="M 16 74 L 16 61 C 16 20, 84 20, 84 61 L 84 74"
            fill="none"
            stroke={INK}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <Path
            d="M 16 74 L 16 61 C 16 20, 84 20, 84 61 L 84 74"
            fill="none"
            stroke="#f4f1e9"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Rect
            x={13}
            y={65}
            width={10}
            height={23}
            rx={4}
            fill="#f4f1e9"
            {...outline}
          />
          <Rect
            x={77}
            y={65}
            width={10}
            height={23}
            rx={4}
            fill="#f4f1e9"
            {...outline}
          />
        </G>
      )}

      {/* Bow hairband. */}
      {accessory === 'Hairband' && (
        <G>
          <Path
            d="M 24 47 Q 49 26, 76 47"
            fill="none"
            stroke={INK}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <Path
            d="M 24 47 Q 49 26, 76 47"
            fill="none"
            stroke="#f5d46e"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Path
            d="
              M 49 36
              C 36 24, 29 30, 36 36
              Q 42 40, 49 36
              Z
            "
            fill="#f5d46e"
            {...outline}
          />
          <Path
            d="
              M 51 36
              C 64 24, 71 30, 64 36
              Q 58 40, 51 36
              Z
            "
            fill="#f5d46e"
            {...outline}
          />
          <Circle
            cx={50}
            cy={36}
            r={3.5}
            fill="#f5d46e"
            stroke={INK}
            strokeWidth={2}
          />
        </G>
      )}

      {/* Scarf: drawn after the shirt so it stays visible. */}
      {accessory === 'Scarf' && (
        <G>
          <Path
            d="M 37 108 L 36 129 L 45 131 L 47 110 Z"
            fill="#ed7669"
            {...outline}
          />
          <Path
            d="
              M 29 98
              Q 50 108, 71 98
              L 72 109
              Q 50 120, 28 109
              Z
            "
            fill="#ed7669"
            {...outline}
          />
          <Path
            d="M 35 107 Q 50 113, 65 107"
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.3}
          />
        </G>
      )}
    </Svg>
  );
}

export default function Avatar(props) {
  const look = props.look || decodeLook(props.characterId);

  return (
    <CompactPonytailAvatar
      {...props}
      look={look}
    />
  );
}
function CompactPonytailAvatar({
  look,
  size = 28,
  outfit,
  sleeping = false,
}) {
  const skin = SKINS[look.skin] || SKINS[0];
  const hair = HAIR_COLORS[look.hair] || HAIR_COLORS[0];
  const shirt = outfit || OUTFITS[look.outfit] || OUTFITS[0];
  const accessory = ACCESSORIES[look.accessory] || 'None';
  const hasHat = accessory === 'Cap' || accessory === 'Beanie';
const hairstyle = HAIR_STYLES[look.hairStyle] || 'Short';
  const outline = {
    stroke: INK,
    strokeWidth: 3.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <Svg
      width={size}
      height={size * 1.3}
      viewBox="0 0 100 130"
      style={{ opacity: sleeping ? 0.85 : 1 }}
    >
  {/* Back hair is drawn before the body and face. */}
<CompactHairBack
  hairstyle={hasHat ? 'Short Smooth' : hairstyle}
  hair={hair}
  outline={outline}
/>
{/* Compact body, keeping your tested +2 position. */}
<G transform="translate(0, 2)">
  <Rect
    x={33}
    y={111}
    width={10}
    height={9}
    rx={1}
    fill={INK}
  />
  <Rect
    x={57}
    y={111}
    width={10}
    height={9}
    rx={1}
    fill={INK}
  />

  {/* Softer shoulders and a shorter shirt. */}
  <Path
    d="
      M 26 112
      L 26 99
      C 26 91, 33 87, 42 87
      L 58 87
      C 67 87, 74 91, 74 99
      L 74 109
      Q 74 112, 71 112
      Z
    "
    fill={shirt}
    {...outline}
  />
</G>
      {/* Long hair covers the ears unless a hat is selected. */}
{(hairstyle !== 'Long' || hasHat) && (
  <G>
    <Ellipse
      cx={22}
      cy={66}
      rx={4.5}
      ry={6}
      fill={skin}
      {...outline}
    />
    <Ellipse
      cx={78}
      cy={66}
      rx={4.5}
      ry={6}
      fill={skin}
      {...outline}
    />
  </G>
)}

  {/* Face fill: no upper outline underneath the hair. */}
<Path
  d="
    M 22 51
    C 22 40, 34 34, 50 34
    C 66 34, 78 40, 78 51
    L 78 68
    C 78 80, 70 87, 59 88
    Q 50 89, 41 88
    C 30 87, 22 80, 22 68
    Z
  "
  fill={skin}
  stroke="none"
/>

{/* Only outline the visible cheeks and chin. */}
<Path
  d="
    M 22 63
    L 22 68
    C 22 80, 30 87, 41 88
    Q 50 89, 59 88
    C 70 87, 78 80, 78 68
    L 78 63
  "
  fill="none"
  {...outline}
/>    

   {/* Front hair fill and fringe line. */}
<CompactHairFront
  hairstyle={hasHat ? 'Short Smooth' : hairstyle}
  hair={hair}
  outline={outline}
/>

      {/* Eyes. */}
      {sleeping ? (
        <G
          fill="none"
          stroke={INK}
          strokeWidth={2.8}
          strokeLinecap="round"
        >
          <Path d="M 33 68 Q 37 71, 41 68" />
          <Path d="M 59 68 Q 63 71, 67 68" />
        </G>
      ) : (
        <G fill={INK}>
          <Ellipse cx={37} cy={68} rx={2.5} ry={3.2} />
          <Ellipse cx={63} cy={68} rx={2.5} ry={3.2} />
        </G>
      )}

      {accessory === 'Glasses' && (
        <G
          fill="none"
          stroke={INK}
          strokeWidth={2.6}
          strokeLinecap="round"
        >
          <Circle cx={37} cy={68} r={8.5} />
          <Circle cx={63} cy={68} r={8.5} />
          <Path d="M 46 67 Q 50 64, 54 67" />
          <Path d="M 23 65 L 28 66 M 72 66 L 77 65" />
        </G>
      )}

      {accessory === 'Sunglasses' && (
        <G>
          <Path
            d="
              M 26 62 L 46 62 L 44 73
              Q 37 78, 29 73 Z
              M 54 62 L 74 62 L 71 73
              Q 63 78, 56 73 Z
            "
            fill={INK}
            stroke={INK}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path
            d="M 46 65 Q 50 63, 54 65"
            fill="none"
            stroke={INK}
            strokeWidth={3}
          />
        </G>
      )}

      {accessory === 'Cap' && (
        <G>
          <Path
            d="
              M 19 46 L 19 39
              C 19 23, 33 18, 49 18
              C 66 18, 79 25, 79 40
              L 79 46 Z
            "
            fill="#ef6a60"
            {...outline}
          />
          <Path
            d="
              M 16 47
              Q 46 38, 78 44
              L 89 48
              Q 94 52, 88 55
              L 76 55
              Q 47 46, 18 54
              Q 12 54, 16 47 Z
            "
            fill="#df584f"
            {...outline}
          />
        </G>
      )}

      {accessory === 'Beanie' && (
        <G>
          <Circle
            cx={50}
            cy={17}
            r={7}
            fill="#8cb8ee"
            {...outline}
          />
          <Path
            d="
              M 20 44
              C 21 26, 34 21, 50 21
              C 66 21, 79 28, 80 44 Z
            "
            fill="#8cb8ee"
            {...outline}
          />
          <Rect
            x={18}
            y={42}
            width={64}
            height={12}
            rx={4}
            fill="#719ed9"
            {...outline}
          />
          {[28, 39, 50, 61, 72].map(x => (
            <Path
              key={x}
              d={`M ${x} 45 L ${x} 51`}
              stroke={INK}
              strokeWidth={1.6}
              opacity={0.5}
            />
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
          <Rect
            x={13}
            y={59}
            width={10}
            height={20}
            rx={4}
            fill="#f4f1e9"
            {...outline}
          />
          <Rect
            x={77}
            y={59}
            width={10}
            height={20}
            rx={4}
            fill="#f4f1e9"
            {...outline}
          />
        </G>
      )}

      {accessory === 'Hairband' && (
        <G>
          <Path
            d="M 25 42 Q 50 23, 75 42"
            fill="none"
            stroke={INK}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <Path
            d="M 25 42 Q 50 23, 75 42"
            fill="none"
            stroke="#f5d46e"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Path
            d="
              M 49 31
              C 36 19, 29 25, 36 31
              Q 42 35, 49 31 Z
              M 51 31
              C 64 19, 71 25, 64 31
              Q 58 35, 51 31 Z
            "
            fill="#f5d46e"
            {...outline}
          />
          <Circle
            cx={50}
            cy={31}
            r={3.5}
            fill="#f5d46e"
            stroke={INK}
            strokeWidth={2}
          />
        </G>
      )}

      {accessory === 'Scarf' && (
        <G>
          <Path
            d="M 37 94 L 36 109 L 45 111 L 47 96 Z"
            fill="#ed7669"
            {...outline}
          />
          <Path
            d="
              M 30 85
              Q 50 94, 70 85
              L 71 95
              Q 50 105, 29 95 Z
            "
            fill="#ed7669"
            {...outline}
          />
        </G>
      )}
    </Svg>
  );
}
function CompactHairBack({ hairstyle, hair, outline }) {
  const smoothDome = `
    M 21 61
    C 17 47, 23 31, 38 26
    C 54 20, 72 26, 79 41
    Q 83 50, 79 62
    L 76 73
    L 24 73
    Z
  `;

  let silhouette = smoothDome;

  switch (hairstyle) {
    case 'Short':
case 'Short Wavy':
      silhouette = `
        M 21 65
        L 18 52
        Q 14 47, 19 42
        L 17 35
        L 27 32
        L 29 25
        L 39 28
        L 46 23
        L 54 27
        L 63 25
        L 67 31
        L 76 32
        L 77 39
        Q 85 43, 80 51
        L 79 65
        L 73 72
        L 27 72
        Z
      `;
      break;

    case 'Long':
  silhouette = `
    M 17 53
    C 16 36, 29 23, 47 22
    C 66 20, 82 34, 83 51
    Q 84 63, 88 74
    Q 85 80, 89 87
    C 94 100, 85 109, 71 106
    L 29 106
    C 15 109, 6 100, 11 87
    Q 15 80, 12 74
    Q 16 63, 17 53
    Z
  `;
  break;

    case 'Bob':
      silhouette = `
        M 17 78
        L 18 51
        C 19 33, 31 24, 50 24
        C 69 24, 81 33, 82 51
        L 83 78
        Q 83 86, 73 87
        L 27 87
        Q 17 86, 17 78
        Z
      `;
      break;

    case 'Wavy':
      silhouette = `
        M 20 52
        C 19 36, 32 24, 49 24
        C 67 23, 80 36, 80 51
        Q 87 60, 82 69
        Q 91 79, 84 88
        C 90 100, 78 105, 69 101
        L 31 101
        C 22 105, 10 100, 16 88
        Q 9 79, 18 69
        Q 13 60, 20 52
        Z
      `;
      break;

    case 'Curly':
      silhouette = `
        M 19 44
        Q 12 36, 23 32
        Q 21 23, 32 25
        Q 36 17, 44 23
        Q 51 15, 58 23
        Q 68 18, 72 27
        Q 84 25, 83 36
        Q 94 39, 88 48
        Q 97 55, 89 63
        Q 97 72, 88 78
        Q 91 89, 80 91
        Q 77 100, 67 95
        L 33 95
        Q 23 100, 20 91
        Q 9 89, 12 78
        Q 3 72, 11 63
        Q 3 55, 12 48
        Q 11 44, 19 44
        Z
      `;
      break;

    case 'Spiky':
      silhouette = `
        M 21 65
        L 17 44
        L 24 43
        L 21 30
        L 34 34
        L 38 20
        L 49 31
        L 59 20
        L 63 34
        L 77 29
        L 75 43
        L 83 44
        L 79 65
        L 73 72
        L 27 72
        Z
      `;
      break;
case 'Short Smooth':
  silhouette = `
    M 17 63
    C 12 51, 17 34, 31 27
    C 43 20, 60 21, 72 28
    C 84 35, 88 50, 83 63
    L 78 73
    L 22 73
    Z
  `;
  break;
    default:
      break;
  }

  return (
    <G>
      {/* Bun and ponytail sit behind the main silhouette. */}
      {hairstyle === 'Bun' && (
        <Path
          d="
            M 36 28
            C 29 24, 29 15, 35 10
            C 42 4, 53 6, 58 12
            C 63 18, 60 26, 54 29
            Z
          "
          fill={hair}
          {...outline}
        />
      )}

      {hairstyle === 'Ponytail' && (
        <G>
          <Path
            d="
              M 69 28
              C 73 15, 86 16, 92 27
              C 97 37, 90 44, 94 49
              Q 96 52, 98 51
              C 89 57, 80 51, 81 42
              C 82 34, 77 31, 72 33
              Z
            "
            fill={hair}
            {...outline}
          />
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

      {hairstyle === 'Braids' && (
        <G>
          <Path
            d="
              M 22 55
              C 16 60, 16 67, 19 71
              C 13 76, 14 82, 18 85
              C 12 90, 14 96, 18 99
              C 15 103, 17 108, 22 109
              C 28 107, 30 102, 26 98
              C 31 93, 29 87, 25 84
              C 30 79, 28 73, 25 70
              C 29 64, 28 59, 22 55
              Z
            "
            fill={hair}
            {...outline}
          />
          <Path
            d="
              M 78 55
              C 84 60, 84 67, 81 71
              C 87 76, 86 82, 82 85
              C 88 90, 86 96, 82 99
              C 85 103, 83 108, 78 109
              C 72 107, 70 102, 74 98
              C 69 93, 71 87, 75 84
              C 70 79, 72 73, 75 70
              C 71 64, 72 59, 78 55
              Z
            "
            fill={hair}
            {...outline}
          />
          <Path
            d="M 18 103 L 25 103 M 75 103 L 82 103"
            fill="none"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </G>
      )}

      {/* One continuous outer outline for the main hair. */}
      <Path
        d={silhouette}
        fill={hair}
        {...outline}
      />
    </G>
  );
}

function CompactHairFront({ hairstyle, hair, outline }) {
  let hairline;

  switch (hairstyle) {
    case 'Short':
case 'Short Wavy':
      hairline = `
        M 22 59
        L 28 53
        Q 34 55, 40 48
        Q 43 55, 50 48
        Q 56 53, 63 47
        Q 67 53, 74 52
        L 78 59
      `;
      break;

    case 'Short Smooth':
  hairline = `
    M 17 61
    Q 21 61, 25 58
    C 34 58, 41 54, 46 48
    Q 50 56, 57 56
    Q 64 55, 68 50
    Q 73 58, 83 61
  `;
  break;

    case 'Bun':
      hairline = `
        M 22 58
        C 30 57, 37 53, 42 46
        Q 45 52, 51 55
        Q 55 52, 58 45
        C 63 52, 70 57, 78 58
      `;
      break;

    case 'Bob':
      hairline = `
        M 22 61
        L 25 61
        L 26 53
        L 40 53
        L 43 46
        L 43 53
        L 59 53
        L 60 45
        L 62 53
        L 74 53
        L 75 61
        L 78 61
      `;
      break;

    case 'Curly':
      hairline = `
        M 22 63
        Q 24 55, 30 57
        Q 32 48, 39 52
        Q 43 43, 50 49
        Q 56 42, 61 51
        Q 69 47, 71 56
        Q 77 54, 78 63
      `;
      break;

    case 'Long':
  hairline = `
    M 18 76
    L 24 76
    L 25 56
    C 36 53, 46 46, 50 37
    C 54 47, 64 54, 75 56
    L 76 76
    L 82 76
  `;
  break;

case 'Wavy':
  hairline = `
    M 22 61
    C 35 59, 46 50, 51 39
    C 55 49, 65 58, 78 61
  `;
  break;

    case 'Braids':
      hairline = `
        M 22 59
        C 35 57, 47 51, 53 41
        C 56 49, 66 57, 78 59
      `;
      break;

    case 'Spiky':
      hairline = `
        M 22 59
        L 34 48
        L 43 53
        L 52 45
        L 60 52
        L 69 47
        L 78 59
      `;
      break;

    case 'Ponytail':
    default:
      hairline = `
        M 22 57
        C 37 58, 51 52, 57 42
        C 61 51, 69 57, 78 58
      `;
      break;
  }

  /*
   * The fill closes across the upper forehead.
   * Only the open hairline below receives a stroke.
   * This avoids drawing a second dome-shaped outline.
   */
  const wideFront =
  hairstyle === 'Long' || hairstyle === 'Short Smooth';

const foreheadFill = wideFront
  ? `
    ${hairline}
    L 82 43
    C 68 27, 32 27, 18 43
    Z
  `
  : `
    ${hairline}
    L 78 42
    C 67 29, 34 29, 22 43
    Z
  `;

  return (
    <G>
      <Path
        d={foreheadFill}
        fill={hair}
        stroke="none"
      />

      <Path
        d={hairline}
        fill="none"
        {...outline}
      />
    </G>
  );
}