import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { colors } from './theme';
import { TRIP_START, TRIP_END } from './trip';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad = n => String(n).padStart(2, '0');
const makeIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function formatDate(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export default function DatePicker({ visible, title, value, minDate, onPick, onClear, onClose }) {
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

          <Text style={styles.legend}>Blue edge = your trip days</Text>

          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <TouchableOpacity style={[styles.clearBtn, { flex: 1, marginRight: 8 }]} onPress={onClear}>
              <Text style={styles.btnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={onClose}>
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
  card: { backgroundColor: colors.cardDark, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.primary },
  title: { color: colors.primary, fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  nav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navText: { color: colors.text, fontSize: 22 },
  month: { flex: 1, color: colors.text, fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', height: 40, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: colors.textMuted, fontSize: 12 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  dayTrip: { borderColor: '#2f5d8f' },
  dayRange: { backgroundColor: '#1f3a5f' },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { color: colors.text, fontSize: 14 },
  dayDisabled: { color: colors.textDim, opacity: 0.4 },
  legend: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6 },
  clearBtn: { backgroundColor: colors.input, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.danger, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
});