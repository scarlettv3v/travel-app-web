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
import { P, ui } from './ui';

export default function EditPlanModal({ plan, onSave, onClose }) {
  const { days: DAYS } = useTrip();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (plan) {
      setDate(plan.date);
      setTime(plan.time || '');
    }
  }, [plan]);

  const save = () => {
    const t = time.trim();
    if (t && !/^\d{1,2}:\d{2}$/.test(t)) {
      alert('Time should look like 09:30, or leave it empty.');
      return;
    }
    const padded = t.length === 4 ? '0' + t : t;
    onSave(plan, date, padded);
    onClose();
  };

  return (
    <Modal visible={!!plan} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={ui.kicker}>EDIT PLAN</Text>
          <Text style={ui.h2}>{plan ? plan.spotName : ''}</Text>

          <Text style={ui.label}>Day</Text>
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

          <Text style={ui.label}>Time</Text>
          <TextInput
            style={ui.field}
            placeholder="e.g. 09:30 (optional)"
            placeholderTextColor="#8a9ca6"
            value={time}
            onChangeText={setTime}
          />

          <View style={[ui.row, { marginTop: 18 }]}>
            <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={save}>
              <Text style={ui.pillText}>Save plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.pill} onPress={onClose}>
              <Text style={ui.pillText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
    padding: 15,
  },
  card: {
    backgroundColor: P.paper,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 22,
    padding: 18,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
});