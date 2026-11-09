import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { useTrip } from './trip';
import { CATEGORIES } from './categories';
import Avatar from './Avatar';
import HScroll from './HScroll';
import { P, ui } from './ui';

// Edit an itinerary item: name, address, notes, category, day, time and who is joining.
// For items made from a Spot, the Spot is updated too (but "who is joining" belongs to this day only).
// For activities and restaurants booked in the Bookings tab, this edits the booking itself.
// (The saving is done in ItineraryScreen.) onSave(plan, values) should return true when it worked,
// so the popup can close. characters = { name: characterId } for everyone on the trip.
export default function EditPlanModal({ plan, characters = {}, onSave, onClose }) {
  const { days: DAYS } = useTrip();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('spot');
  const [confirmation, setConfirmation] = useState('');
  const [partySize, setPartySize] = useState('');
  const [joining, setJoining] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (plan) {
      setDate(plan.date);
      setTime(plan.time || '');
      setName(plan.spotName || '');
      setAddress(plan.address || '');
      setNote(plan.note || '');
      setCategory(plan.category || 'spot');
      setConfirmation(plan.confirmation || '');
      setPartySize(plan.partySize || '');
      setJoining(plan.joining || []);
      setBusy(false);
    }
  }, [plan]);

  const locked = !!plan && plan.source === 'booking';

  // everyone on the trip, plus anyone already on this item
  const people = [...new Set([...Object.keys(characters), ...joining])].filter(Boolean);
  const toggle = who =>
    setJoining(prev => (prev.includes(who) ? prev.filter(n => n !== who) : [...prev, who]));

  const save = async () => {
    const t = time.trim();
    if (!name.trim()) {
      alert('Please enter a name.');
      return;
    }
    if (t && !/^\d{1,2}:\d{2}$/.test(t)) {
      alert('Time should look like 09:30, or leave it empty.');
      return;
    }
    const padded = t.length === 4 ? '0' + t : t;

    setBusy(true);
    const ok = await onSave(plan, {
      date,
      time: padded,
      name: name.trim(),
      address: address.trim(),
      note: note.trim(),
      category,
      confirmation: confirmation.trim(),
      partySize: partySize.trim(),
      joining,
    });
    setBusy(false);
    if (ok !== false) onClose();
  };

  return (
    <Modal visible={!!plan} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={ui.kicker}>EDIT ITINERARY ITEM</Text>
            <Text style={ui.h2}>{plan ? plan.spotName : ''}</Text>
            <Text style={ui.hint}>
              {locked
                ? 'This is a booking, so changes here also update it in Bookings.'
                : 'Name, address, notes and category also update the matching spot in Spots.'}
            </Text>

            <Text style={ui.label}>Name</Text>
            <TextInput
              style={ui.field}
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor="#8a9ca6"
            />

            <Text style={ui.label}>Address</Text>
            <TextInput
              style={ui.field}
              value={address}
              onChangeText={setAddress}
              placeholder="Address (used for Google Maps)"
              placeholderTextColor="#8a9ca6"
            />

            <Text style={ui.label}>Notes</Text>
            <TextInput
              style={[ui.field, { minHeight: 56, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Notes or links"
              placeholderTextColor="#8a9ca6"
            />

            {!locked ? (
              <View>
                <Text style={ui.label}>Category</Text>
                <View style={ui.row}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[ui.pill, ui.pillSmall, category === c.id && ui.pillActive]}
                      onPress={() => setCategory(c.id)}
                    >
                      <Text style={[ui.pillText, ui.pillTextSmall]}>
                        {c.emoji} {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View>
                <Text style={ui.label}>Confirmation</Text>
                <TextInput
                  style={ui.field}
                  value={confirmation}
                  onChangeText={setConfirmation}
                  placeholder="Confirmation code"
                  placeholderTextColor="#8a9ca6"
                  autoCapitalize="characters"
                />
                {plan && plan.bookingKind === 'restaurant' ? (
                  <View>
                    <Text style={ui.label}>Party size</Text>
                    <TextInput
                      style={ui.field}
                      value={partySize}
                      onChangeText={setPartySize}
                      placeholder="e.g. 4"
                      placeholderTextColor="#8a9ca6"
                    />
                  </View>
                ) : null}
              </View>
            )}

            <Text style={ui.label}>Day</Text>
            <HScroll style={{ flexGrow: 0 }}>
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
            </HScroll>

            <Text style={ui.label}>Time</Text>
            <TextInput
              style={ui.field}
              placeholder="e.g. 09:30 (optional)"
              placeholderTextColor="#8a9ca6"
              value={time}
              onChangeText={setTime}
            />

            <Text style={ui.label}>Who's joining?</Text>
            <View style={ui.row}>
              {people.map(who => {
                const on = joining.includes(who);
                return (
                  <TouchableOpacity
                    key={who}
                    style={[
                      ui.pill,
                      ui.pillSmall,
                      on && ui.pillActive,
                      { flexDirection: 'row', alignItems: 'center' },
                    ]}
                    onPress={() => toggle(who)}
                  >
                    <Avatar characterId={characters[who] || 'fox'} size={18} />
                    <Text style={[ui.pillText, ui.pillTextSmall, { marginLeft: 5 }]}>
                      {on ? '✓ ' : ''}
                      {who}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={ui.hint}>
              {joining.length === 0 ? 'Nobody selected yet.' : `${joining.length} joining.`}
            </Text>

            <View style={[ui.row, { marginTop: 12 }]}>
              <TouchableOpacity
                style={[ui.pill, ui.pillPrimary, busy && { opacity: 0.5 }]}
                onPress={save}
                disabled={busy}
              >
                <Text style={ui.pillText}>{busy ? 'Saving...' : 'Save changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ui.pill} onPress={onClose}>
                <Text style={ui.pillText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(38,58,72,0.6)',
    justifyContent: 'center',
    padding: 12,
  },
  card: {
    backgroundColor: P.paper,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 18,
    padding: 14,
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    alignSelf: 'center',
  },
});