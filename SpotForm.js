import React, { useState } from 'react';
import { Text, View, TouchableOpacity, TextInput } from 'react-native';
import { CATEGORIES } from './categories';
import { openPlace } from './places';
import { ui } from './ui';

// The details form for one spot: category, name, address, notes.
// Mount it fresh (use a key) each time you want it to start from new values.
export default function SpotForm({ initial, saveLabel, busy, onSave, onCancel }) {
  const start = initial || {};
  const [name, setName] = useState(start.name || '');
  const [note, setNote] = useState(start.note || '');
  const [category, setCategory] = useState(start.category || 'spot');
  const [address, setAddress] = useState(start.address || '');

  const save = () => {
    if (!name.trim()) {
      alert('Please enter a place name.');
      return;
    }
    onSave({ name: name.trim(), note, category, address: address.trim() });
  };

  return (
    <View>
      <Text style={ui.label}>Category</Text>
      <View style={ui.row}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.id}
            onPress={() => setCategory(c.id)}
            style={[ui.pill, ui.pillSmall, category === c.id && ui.pillActive]}
          >
            <Text style={[ui.pillText, ui.pillTextSmall]}>
              {c.emoji} {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={ui.label}>Place name</Text>
      <TextInput
        style={ui.field}
        placeholder="Location name"
        placeholderTextColor="#8a9ca6"
        value={name}
        onChangeText={setName}
      />

      <Text style={ui.label}>Address</Text>
      <TextInput
        style={[ui.field, { minHeight: 64, textAlignVertical: 'top' }]}
        placeholder="Paste the address from Google Maps"
        placeholderTextColor="#8a9ca6"
        value={address}
        onChangeText={setAddress}
        multiline
      />
      <View style={[ui.row, { marginTop: 10 }]}>
        <TouchableOpacity
          style={[ui.pill, ui.pillSmall]}
          onPress={() => openPlace({ name, address })}
        >
          <Text style={[ui.pillText, ui.pillTextSmall]}>🔎 Look it up in Google Maps</Text>
        </TouchableOpacity>
      </View>
      <Text style={ui.hint}>
        Tip: find the place in Google Maps, copy its address, and paste it here. The Google Maps
        button will then open the exact place.
      </Text>

      <Text style={ui.label}>Notes</Text>
      <TextInput
        style={[ui.field, { minHeight: 90, textAlignVertical: 'top' }]}
        placeholder="Notes, links..."
        placeholderTextColor="#8a9ca6"
        value={note}
        onChangeText={setNote}
        multiline
      />

      <View style={[ui.row, { marginTop: 18 }]}>
        <TouchableOpacity
          style={[ui.pill, ui.pillPrimary, busy && { opacity: 0.5 }]}
          onPress={save}
          disabled={busy}
        >
          <Text style={ui.pillText}>{busy ? 'Saving...' : saveLabel || 'Save spot'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ui.pill} onPress={onCancel}>
          <Text style={ui.pillText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}