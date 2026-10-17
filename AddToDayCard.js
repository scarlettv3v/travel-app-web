import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { DAYS } from './trip';
import Avatar from './Avatar';

export default function AddToDayCard({ spot, authToken, profile, onClose }) {
  const [date, setDate] = useState(DAYS[0].iso);
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('planned');
  const [members, setMembers] = useState([]);
  const [joining, setJoining] = useState([profile.name]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await firestoreFetch(`${FIRESTORE_BASE}/profiles?pageSize=300`, authToken);
        const data = await res.json();
        setMembers(
          (data.documents || [])
            .map(doc => ({
              name: doc.fields?.name?.stringValue || '',
              character: doc.fields?.character?.stringValue || 'fox',
            }))
            .filter(m => m.name)
        );
      } catch (error) {
        console.error('Error loading members:', error);
      }
    })();
  }, [authToken]);

  const toggle = name =>
    setJoining(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));

  const save = async () => {
    if (time && !/^\d{1,2}:\d{2}$/.test(time.trim())) {
      alert('Time should look like 09:30, or leave it empty.');
      return;
    }
    setBusy(true);
    try {
      await firestoreFetch(`${FIRESTORE_BASE}/plans`, authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            spotName: { stringValue: spot.name },
            category: { stringValue: spot.category || 'spot' },
            note: { stringValue: spot.note || '' },
            lat: { doubleValue: spot.lat ?? 0 },
            lng: { doubleValue: spot.lng ?? 0 },
            date: { stringValue: date },
            time: { stringValue: time.trim().padStart(time.trim().length === 4 ? 5 : 0, '0') },
            status: { stringValue: status },
            joining: { arrayValue: { values: joining.map(n => ({ stringValue: n })) } },
            addedByName: { stringValue: profile.name },
            addedByCharacter: { stringValue: profile.character },
          },
        }),
      });
      onClose();
    } catch (error) {
      console.error('Error adding to day:', error);
      alert('Could not add to the itinerary.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📅 Add "{spot.name}" to a day</Text>

      <Text style={styles.label}>Which day?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {DAYS.map(d => (
          <TouchableOpacity
            key={d.iso}
            style={[styles.chip, date === d.iso && styles.chipOn]}
            onPress={() => setDate(d.iso)}
          >
            <Text style={styles.chipText}>D{d.dayNumber} · {d.short}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput
        style={styles.input}
        placeholder="Time (optional, e.g. 09:30)"
        placeholderTextColor={colors.textDim}
        value={time}
        onChangeText={setTime}
      />

      <Text style={styles.label}>Status</Text>
      <View style={styles.row}>
        {[['planned', '📝 Planned'], ['booked', '✅ Booked']].map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.chip, status === id && styles.chipOn]}
            onPress={() => setStatus(id)}
          >
            <Text style={styles.chipText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Who's joining?</Text>
      <View style={styles.row}>
        {members.map(m => (
          <TouchableOpacity
            key={m.name}
            style={[styles.chip, styles.personChip, joining.includes(m.name) && styles.chipOn]}
            onPress={() => toggle(m.name)}
          >
            <Avatar characterId={m.character} size={20} />
            <Text style={[styles.chipText, { marginLeft: 6 }]}>{m.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.row, { marginTop: 6 }]}>
        <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginRight: 6 }]} onPress={save} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Saving...' : 'Add to day'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelBtn, { flex: 0.4 }]} onPress={onClose}>
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardDark, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.primary },
  title: { color: colors.primary, fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 6, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: colors.input },
  personChip: { flexDirection: 'row', alignItems: 'center' },
  chipOn: { borderColor: colors.primary, backgroundColor: '#1f3a5f' },
  chipText: { color: colors.text, fontSize: 13 },
  input: { backgroundColor: colors.input, color: colors.text, padding: 10, borderRadius: 8, fontSize: 14, marginBottom: 4 },
  saveBtn: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.danger, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
});