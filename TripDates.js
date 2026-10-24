import React, { useState } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { useTrip, dayCount, MAX_DAYS } from './trip';
import DatePicker, { formatDate } from './DatePicker';
import Popup from './Popup';
import { ui } from './ui';

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
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          marginTop: 14,
        }}
      >
        <Text style={[ui.sub, { flex: 1, marginTop: 0, marginRight: 8 }]}>🗓️ Trip: {label}</Text>
        <TouchableOpacity
          style={[ui.pill, ui.pillSmall, { marginRight: 0, marginBottom: 0 }]}
          onPress={openEditor}
        >
          <Text style={[ui.pillText, ui.pillTextSmall]}>✏️ Change dates</Text>
        </TouchableOpacity>
      </View>

      <Popup visible={open} onClose={() => setOpen(false)}>
        <Text style={ui.kicker}>TRIP DATES</Text>
        <Text style={ui.h2}>Change trip dates</Text>

        <Text style={ui.label}>Start date</Text>
        <TouchableOpacity style={ui.field} onPress={() => setPickerKey('start')}>
          <Text style={newStart ? ui.fieldText : ui.fieldPlaceholder}>
            📅 {newStart ? formatDate(newStart) : 'Tap to pick a date'}
          </Text>
        </TouchableOpacity>

        <Text style={ui.label}>End date</Text>
        <TouchableOpacity style={ui.field} onPress={() => setPickerKey('end')}>
          <Text style={newEnd ? ui.fieldText : ui.fieldPlaceholder}>
            📅 {newEnd ? formatDate(newEnd) : 'Tap to pick a date'}
          </Text>
        </TouchableOpacity>

        <View style={[ui.row, { marginTop: 18 }]}>
          <TouchableOpacity
            style={[ui.pill, ui.pillPrimary, busy && { opacity: 0.5 }]}
            onPress={save}
            disabled={busy}
          >
            <Text style={ui.pillText}>{busy ? 'Saving...' : 'Save dates'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ui.pill} onPress={() => setOpen(false)}>
            <Text style={ui.pillText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Popup>

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