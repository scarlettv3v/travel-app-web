import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import Avatar, { SKINS, HAIR_COLORS, OUTFITS, HAIR_STYLES, ACCESSORIES } from './Avatar';

const INK = '#263a48';
const pick = n => Math.floor(Math.random() * n);

function Swatches({ colors, value, onPick }) {
  return (
    <View style={s.row}>
      {colors.map((c, i) => (
        <TouchableOpacity
          key={c}
          onPress={() => onPick(i)}
          style={[s.swatch, { backgroundColor: c }, value === i && s.swatchOn]}
        />
      ))}
    </View>
  );
}

function Chips({ labels, value, onPick }) {
  return (
    <View style={s.row}>
      {labels.map((text, i) => (
        <TouchableOpacity
          key={text}
          onPress={() => onPick(i)}
          style={[s.chip, value === i && s.chipOn]}
        >
          <Text style={s.chipText}>{text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function HairStyleChips({ value, onPick }) {
  const smoothIndex = HAIR_STYLES.indexOf('Short Smooth');
  const wavyIndex = HAIR_STYLES.indexOf('Short Wavy');

  const order = HAIR_STYLES
    .map((_, index) => index)
    .filter(index => index !== smoothIndex);

  if (smoothIndex >= 0) {
    const position = order.indexOf(wavyIndex);
    order.splice(position >= 0 ? position : 0, 0, smoothIndex);
  }

  return (
    <View style={s.row}>
      {order.map(index => (
        <TouchableOpacity
          key={index}
          onPress={() => onPick(index)}
          style={[
            s.chip,
            value === index && s.chipOn,
          ]}
        >
          <Text style={s.chipText}>
            {HAIR_STYLES[index]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
// look = { skin, hairStyle, hair, outfit, accessory } (numbers)
// onChange gets the new look every time something is tapped
export default function AvatarEditor({ look, onChange }) {
  const set = (key, value) => onChange({ ...look, [key]: value });

  const surprise = () =>
    onChange({
      skin: pick(SKINS.length),
      hairStyle: pick(HAIR_STYLES.length),
      hair: pick(HAIR_COLORS.length),
      outfit: pick(OUTFITS.length),
      accessory: pick(ACCESSORIES.length),
    });

  return (
    <View>
      <View style={s.stage}>
        <Avatar look={look} size={84} />
      </View>
      <TouchableOpacity style={s.surprise} onPress={surprise}>
        <Text style={s.surpriseText}>🎲 Surprise me</Text>
      </TouchableOpacity>

      <Text style={s.label}>Skin tone</Text>
      <Swatches colors={SKINS} value={look.skin} onPick={i => set('skin', i)} />

      <Text style={s.label}>Hair style</Text>
     <HairStyleChips
  value={look.hairStyle}
  onPick={i => set('hairStyle', i)}
/>

      <Text style={s.label}>Hair colour</Text>
      <Swatches colors={HAIR_COLORS} value={look.hair} onPick={i => set('hair', i)} />

      <Text style={s.label}>Outfit colour</Text>
      <Swatches colors={OUTFITS} value={look.outfit} onPick={i => set('outfit', i)} />

      <Text style={s.label}>Accessory</Text>
      <Chips labels={ACCESSORIES} value={look.accessory} onPick={i => set('accessory', i)} />
    </View>
  );
}

const s = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 150,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: '#d9f5e7',
  },
  surprise: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  surpriseText: { color: INK, fontWeight: '800', fontSize: 14 },
  label: { color: INK, fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#afc9bb',
    marginRight: 8,
    marginBottom: 8,
  },
  swatchOn: { borderColor: INK, borderWidth: 4 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#b6cfc3',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { borderColor: INK, backgroundColor: '#ffe1aa' },
  chipText: { color: INK, fontWeight: '700', fontSize: 14 },
});