import React from 'react';
import { Text, View } from 'react-native';
import { getCharacter } from './characters';

export default function Avatar({ characterId, size = 28 }) {
  const c = getCharacter(characterId);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.color + '33',
        borderWidth: 1.5,
        borderColor: c.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.55 }}>{c.emoji}</Text>
    </View>
  );
}