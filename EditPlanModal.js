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
import { colors } from './theme';
import { DAYS } from './trip';

export default function EditPlanModal({ plan, onSave, onClose }) {
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
          <Text style={styles.title}>✏️ Edit {plan ? plan.spotName : ''}</Text>

          <Text style={styles.label}>Day</Text>
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

          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 09:30 (optional)"
            placeholderTextColor={colors.textDim}
            value={time}
            onChangeText={setTime}
          />

          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginRight: 8 }]} onPress={save}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 15 },
  card: { backgroundColor: colors.cardDark, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.highlight },
  title: { color: colors.highlight, fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 6, marginBottom: 6 },
  chip: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, borderWidth: 1, borderColor: colors.input },
  chipOn: { borderColor: colors.primary, backgroundColor: '#1f3a5f' },
  chipText: { color: colors.text, fontSize: 13 },
  input: { backgroundColor: colors.input, color: colors.text, padding: 10, borderRadius: 8, fontSize: 14 },
  saveBtn: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.danger, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center' },
  btnText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
});