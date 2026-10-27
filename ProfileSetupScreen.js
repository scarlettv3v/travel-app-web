import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import AvatarEditor from './AvatarEditor';
import { defaultLook, encodeLook } from './Avatar';

const INK = '#263a48';

export default function ProfileSetupScreen({ authToken, uid, onSaved }) {
  const [name, setName] = useState('');
  const [look, setLook] = useState(defaultLook());
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      alert('Please enter your name.');
      return;
    }

    setBusy(true);
    const code = encodeLook(look);
    try {
      await firestoreFetch(`${FIRESTORE_BASE}/profiles/${uid}`, authToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: name.trim() },
            character: { stringValue: code },
          },
        }),
      });
      onSaved({ name: name.trim(), character: code });
    } catch (error) {
      console.error('Error saving profile:', error);
      const blocked = String(error.message).includes('(403)');
      alert(blocked
        ? 'This email is not on the invite list. Ask the trip organiser to add it.'
        : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Who are you?</Text>
      <Text style={styles.subtitle}>Add your name and build your look</Text>

      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor="#8aa09a"
        value={name}
        onChangeText={setName}
        maxLength={30}
      />

      <AvatarEditor look={look} onChange={setLook} />

      <TouchableOpacity style={styles.button} onPress={save} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Saving...' : "Let's go!"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => signOut(auth)} style={{ marginTop: 18 }}>
  <Text style={{ color: '#526873', textAlign: 'center' }}>Not you? Log out</Text>
</TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f8ed' },
  title: { color: INK, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#526873', textAlign: 'center', marginBottom: 20, marginTop: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#b6cfc3',
    borderRadius: 11,
    padding: 12,
    color: INK,
    fontSize: 15,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#ffd388',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: INK, fontWeight: '800', fontSize: 16 },
});