import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useTrip } from './trip';
import { formatDate } from './dateFormat';

// Same name as before, so screens that import { formatDate } from './DatePicker' still work.
// The look (Nov 21, 2026 (Sat)) lives in dateFormat.js
export { formatDate };

// ---------------------------------------------------------------------------------------------
// COLOURS of the date picker popup. Change them here. Any hex colour works.
// It uses the same light look as the rest of the app (it used to be dark).
// ---------------------------------------------------------------------------------------------
const C = {
  backdrop: 'rgba(38,58,72,0.6)', // the dimmed area behind the popup
  card: '#fffdf6', // popup background
  ink: '#263a48', // text and outlines
  muted: '#526873', // weekday letters, small text
  tripBorder: '#54a887', // outline on days that are inside your trip
  inRange: '#d9f5e7', // days between the start and end date
  selected: '#ffe1aa', // the day you picked
  buttonBg: '#ffffff', // Clear button
  cancelBg: '#fff0ec', // Cancel button
  cancelText: '#973c39',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad = n => String(n).padStart(2, '0');
const makeIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function DatePicker({ visible, title, value, minDate, onPick, onClear, onClose }) {
  const { start: TRIP_START, end: TRIP_END } = useTrip();
  const seed = value || minDate || TRIP_START;
  const [year, setYear] = useState(Number(seed.split('-')[0]));
  const [month, setMonth] = useState(Number(seed.split('-')[1]) - 1);

  useEffect(() => {
    if (visible) {
      const [y, m] = seed.split('-').map(Number);
      setYear(y);
      setMonth(m - 1);
    }
  }, [visible]);

  const shift = delta => {
    let m = month + delta;
    let y = year;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(d);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.header}>
            <TouchableOpacity style={styles.nav} onPress={() => shift(-12)}>
              <Text style={styles.navText}>«</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nav} onPress={() => shift(-1)}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.month}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity style={styles.nav} onPress={() => shift(1)}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nav} onPress={() => shift(12)}>
              <Text style={styles.navText}>»</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {WEEKDAYS.map(w => (
              <View key={w} style={styles.cell}>
                <Text style={styles.weekday}>{w[0]}</Text>
              </View>
            ))}

            {cells.map((d, i) => {
              if (d === null) return <View key={'e' + i} style={styles.cell} />;

              const id = makeIso(year, month, d);
              const disabled = !!minDate && id < minDate;
              const selected = id === value;
              const inRange = !!minDate && !!value && id > minDate && id < value;
              const isStart = !!minDate && id === minDate;
              const inTrip = id >= TRIP_START && id <= TRIP_END;

              return (
                <View key={id} style={styles.cell}>
                  <TouchableOpacity
                    disabled={disabled}
                    onPress={() => onPick(id)}
                    style={[
                      styles.day,
                      inTrip && styles.dayTrip,
                      (inRange || isStart) && styles.dayRange,
                      selected && styles.daySelected,
                    ]}
                  >
                    <Text style={[styles.dayText, disabled && styles.dayDisabled]}>{d}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Text style={styles.legend}>Green edge = your trip days</Text>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity style={[styles.clearBtn, { flex: 1, marginRight: 8 }]} onPress={onClear}>
              <Text style={styles.btnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: C.cancelText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.backdrop, justifyContent: 'center', padding: 12 },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 2,
    borderColor: C.ink,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: { color: C.ink, fontWeight: '800', fontSize: 15, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  nav: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  navText: { color: C.ink, fontSize: 22, fontWeight: '700' },
  month: { flex: 1, color: C.ink, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', height: 38, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: C.muted, fontSize: 12, fontWeight: '700' },
  day: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  dayTrip: { borderColor: C.tripBorder },
  dayRange: { backgroundColor: C.inRange },
  daySelected: { backgroundColor: C.selected, borderColor: C.ink },
  dayText: { color: C.ink, fontSize: 14, fontWeight: '600' },
  dayDisabled: { opacity: 0.3 },
  legend: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 4 },
  clearBtn: { backgroundColor: C.buttonBg, borderWidth: 2, borderColor: C.ink, padding: 8, borderRadius: 999, alignItems: 'center' },
  cancelBtn: { backgroundColor: C.cancelBg, borderWidth: 2, borderColor: C.ink, padding: 8, borderRadius: 999, alignItems: 'center' },
  btnText: { color: C.ink, fontWeight: '800', fontSize: 14 },
});