import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { useTrip } from './trip';
import Avatar from './Avatar';
import { ui } from './ui';

// The content of the "Add to day" popup (the popup frame comes from <Popup> in Spots).
export default function AddToDayCard({ spot, authToken, profile, onClose }) {
  const { days: DAYS } = useTrip();
  const [date, setDate] = useState(DAYS[0].iso);
  const [time, setTime] = useState('');
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
            address: { stringValue: spot.address || '' },
            date: { stringValue: date },
            time: { stringValue: time.trim().padStart(time.trim().length === 4 ? 5 : 0, '0') },
            status: { stringValue: 'planned' },
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
    <View>
      <Text style={ui.kicker}>ADD TO ITINERARY</Text>
      <Text style={ui.h2}>{spot.name}</Text>

      <Text style={ui.label}>Which day?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {DAYS.map(d => (
          <TouchableOpacity
            key={d.iso}
            style={[ui.pill, ui.pillSmall, date === d.iso && ui.pillActive]}
            onPress={() => setDate(d.iso)}
          >
            <Text style={[ui.pillText, ui.pillTextSmall]}>
              Day {d.dayNumber} · {d.short}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={ui.label}>Time (optional)</Text>
      <TextInput
        style={ui.field}
        placeholder="e.g. 09:30"
        placeholderTextColor="#8a9ca6"
        value={time}
        onChangeText={setTime}
      />
      <Text style={ui.hint}>With a time, it slots into the day in time order.</Text>

      <Text style={ui.label}>Who's joining?</Text>
      <View style={ui.row}>
        {members.map(m => {
          const on = joining.includes(m.name);
          return (
            <TouchableOpacity
              key={m.name}
              style={[
                ui.pill,
                ui.pillSmall,
                on && ui.pillActive,
                { flexDirection: 'row', alignItems: 'center' },
              ]}
              onPress={() => toggle(m.name)}
            >
              <Avatar characterId={m.character} size={20} />
              <Text style={[ui.pillText, ui.pillTextSmall, { marginLeft: 6 }]}>
                {on ? '✓ ' : ''}
                {m.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[ui.row, { marginTop: 18 }]}>
        <TouchableOpacity
          style={[ui.pill, ui.pillPrimary, busy && { opacity: 0.5 }]}
          onPress={save}
          disabled={busy}
        >
          <Text style={ui.pillText}>{busy ? 'Saving...' : 'Add to day'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ui.pill} onPress={onClose}>
          <Text style={ui.pillText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}