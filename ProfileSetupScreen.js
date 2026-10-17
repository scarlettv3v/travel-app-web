import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { CHARACTERS } from './characters';

export default function ProfileSetupScreen({ authToken, uid, onSaved }) {
  const [name, setName] = useState('');
  const [characterId, setCharacterId] = useState(CHARACTERS[0].id);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      alert('Please enter your name.');
      return;
    }

    setBusy(true);
    try {
      await firestoreFetch(`${FIRESTORE_BASE}/profiles/${uid}`, authToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: name.trim() },
            character: { stringValue: characterId },
          },
        }),
      });
      onSaved({ name: name.trim(), character: characterId });
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who are you?</Text>
      <Text style={styles.subtitle}>Pick your name and character</Text>

      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor={colors.textDim}
        value={name}
        onChangeText={setName}
      />

      <View style={styles.grid}>
        {CHARACTERS.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[
              styles.avatar,
              { backgroundColor: c.color + '33' },
              characterId === c.id && { borderColor: c.color, borderWidth: 3 },
            ]}
            onPress={() => setCharacterId(c.id)}
          >
            <Text style={styles.emoji}>{c.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={save} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Saving...' : "Let's go!"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginBottom: 24, marginTop: 6 },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  emoji: { fontSize: 36 },
  button: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: colors.text, fontWeight: 'bold' },
});