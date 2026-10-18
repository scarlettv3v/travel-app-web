import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from './theme';
import { useTrip, dayCount, MAX_DAYS } from './trip';
import DatePicker, { formatDate } from './DatePicker';

export default function TripDates() {
  const { start, end, label, saveTrip } = useTrip();
  const [open, setOpen] = useState(false);
  const [newStart, setNewStart] = useState(start);
  const [newEnd, setNewEnd] = useState(end);
  const [pickerKey, setPickerKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const openEditor = () => {
    setNewStart(start);
    setNewEnd(end);
    setOpen(true);
  };

  const pick = iso => {
    if (pickerKey === 'start') {
      setNewStart(iso);
      if (newEnd && newEnd < iso) setNewEnd('');
    } else {
      setNewEnd(iso);
    }
    setPickerKey(null);
  };

  const clear = () => {
    if (pickerKey === 'start') setNewStart('');
    else setNewEnd('');
    setPickerKey(null);
  };

  const save = async () => {
    if (!newStart || !newEnd) {
      alert('Please pick both a start date and an end date.');
      return;
    }
    if (newEnd < newStart) {
      alert('The end date cannot be before the start date.');
      return;
    }
    if (dayCount(newStart, newEnd) > MAX_DAYS) {
      alert(`The trip can be at most ${MAX_DAYS} days long.`);
      return;
    }

    setBusy(true);
    const ok = await saveTrip(newStart, newEnd);
    setBusy(false);

    if (ok) setOpen(false);
    else alert('Could not save the trip dates.');
  };

  return (
    <View style={styles.wrap}>
      {!open ? (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>🗓️ Trip: {label}</Text>
          <TouchableOpacity style={styles.changeBtn} onPress={openEditor}>
            <Text style={styles.btnText}>✏️ Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.title}>Trip dates</Text>

          <TouchableOpacity style={styles.field} onPress={() => setPickerKey('start')}>
            <Text style={styles.label}>Start date</Text>
            <Text style={newStart ? styles.value : styles.placeholder}>
              📅 {newStart ? formatDate(newStart) : 'Tap to pick a date'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.field} onPress={() => setPickerKey('end')}>
            <Text style={styles.label}>End date</Text>
            <Text style={newEnd ? styles.value : styles.placeholder}>
              📅 {newEnd ? formatDate(newEnd) : 'Tap to pick a date'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1, marginRight: 8 }]}
              onPress={save}
              disabled={busy}
            >
              <Text style={styles.btnText}>{busy ? 'Saving...' : 'Save dates'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <DatePicker
        visible={!!pickerKey}
        title={pickerKey === 'start' ? 'Trip start date' : 'Trip end date'}
        value={pickerKey === 'start' ? newStart : newEnd}
        minDate={pickerKey === 'end' ? newStart : ''}
        onPick={pick}
        onClear={clear}
        onClose={() => setPickerKey(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 15, marginBottom: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  changeBtn: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  card: { backgroundColor: colors.cardDark, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.highlight },
  title: { color: colors.highlight, fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  field: { backgroundColor: colors.input, padding: 12, borderRadius: 8, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  value: { color: colors.text, fontSize: 14 },
  placeholder: { color: colors.textDim, fontSize: 14 },
  saveBtn: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.danger, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center' },
  btnText: { color: colors.text, fontWeight: 'bold', fontSize: 13 },
});