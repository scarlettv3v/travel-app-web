import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import { TRIP_START, TRIP_END } from './trip';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Builds ['2026-11-22', '2026-11-23', ...] from the trip dates
function buildDays() {
  const days = [];
  const [sy, sm, sd] = TRIP_START.split('-').map(Number);
  const end = Date.UTC(...TRIP_END.split('-').map((n, i) => (i === 1 ? n - 1 : Number(n))));
  let t = Date.UTC(sy, sm - 1, sd);
  while (t <= end) {
    const d = new Date(t);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    days.push({
      iso,
      dayNumber: days.length + 1,
      short: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
      weekday: WEEKDAYS[d.getUTCDay()],
    });
    t += 24 * 60 * 60 * 1000;
  }
  return days;
}

const DAYS = buildDays();
const str = (doc, key) => doc.fields?.[key]?.stringValue || '';
const TRANSPORT_EMOJI = { flight: '✈️', car: '🚗', train: '🚆', ferry: '⛴️' };

export default function ItineraryScreen({ authToken }) {
  const [selected, setSelected] = useState(0);
  const [transport, setTransport] = useState([]);
  const [stays, setStays] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const tRes = await firestoreFetch(`${FIRESTORE_BASE}/transport?pageSize=300`, authToken);
      const tData = await tRes.json();
      setTransport(
        (tData.documents || []).map(doc => ({
          id: doc.name,
          type: str(doc, 'type') || 'flight',
          provider: str(doc, 'provider'),
          reference: str(doc, 'reference'),
          from: str(doc, 'from'),
          to: str(doc, 'to'),
          departDate: str(doc, 'departDate'),
          departTime: str(doc, 'departTime'),
          arriveDate: str(doc, 'arriveDate'),
          arriveTime: str(doc, 'arriveTime'),
          confirmation: str(doc, 'confirmation'),
          addedByCharacter: str(doc, 'addedByCharacter'),
        }))
      );

      const sRes = await firestoreFetch(`${FIRESTORE_BASE}/stays?pageSize=300`, authToken);
      const sData = await sRes.json();
      setStays(
        (sData.documents || []).map(doc => ({
          id: doc.name,
          name: str(doc, 'name'),
          address: str(doc, 'address'),
          checkIn: str(doc, 'checkIn'),
          checkOut: str(doc, 'checkOut'),
          confirmation: str(doc, 'confirmation'),
          addedByCharacter: str(doc, 'addedByCharacter'),
        }))
      );
    } catch (error) {
      console.error('Error loading itinerary:', error);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [authToken, loadAll]);

  const day = DAYS[selected];

  // Transport leaving this day, or arriving this day (if it lands on a different date)
  const departing = transport
    .filter(t => t.departDate === day.iso)
    .sort((a, b) => a.departTime.localeCompare(b.departTime));
  const arriving = transport.filter(
    t => t.arriveDate === day.iso && t.departDate !== day.iso
  );

  // Hotel for tonight: check-in <= day < check-out
  const stayingTonight = stays.filter(s => s.checkIn <= day.iso && day.iso < s.checkOut);
  const checkingOut = stays.filter(s => s.checkOut === day.iso);

  const nothing =
    !departing.length && !arriving.length && !stayingTonight.length && !checkingOut.length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📅 Itinerary</Text>

      <View style={{ height: 70 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {DAYS.map((d, index) => (
            <TouchableOpacity
              key={d.iso}
              style={[styles.dayChip, index === selected && styles.dayChipOn]}
              onPress={() => setSelected(index)}
            >
              <Text style={styles.dayNum}>Day {d.dayNumber}</Text>
              <Text style={styles.dayDate}>{d.weekday} {d.short}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 15 }}>
        <Text style={styles.dayHeading}>
          Day {day.dayNumber} · {day.weekday} {day.short}
        </Text>

        {arriving.length > 0 && <Text style={styles.section}>Arriving</Text>}
        {arriving.map(t => (
          <View key={t.id + 'a'} style={styles.card}>
            <Text style={styles.cardTitle}>
              {TRANSPORT_EMOJI[t.type] || '✈️'} Arrives {t.arriveTime}
            </Text>
            <Text style={styles.line}>{t.from} → {t.to}</Text>
            <Text style={styles.hint}>{t.provider} {t.reference}</Text>
          </View>
        ))}

        {departing.length > 0 && <Text style={styles.section}>Transport</Text>}
        {departing.map(t => (
          <View key={t.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>
                {TRANSPORT_EMOJI[t.type] || '✈️'} {t.departTime || 'Time TBC'} · {t.provider}
                {t.reference ? ` ${t.reference}` : ''}
              </Text>
              {t.addedByCharacter ? <Avatar characterId={t.addedByCharacter} size={24} /> : null}
            </View>
            <Text style={styles.line}>{t.from} → {t.to}</Text>
            {t.arriveTime ? (
              <Text style={styles.hint}>
                Arrives {t.arriveDate !== day.iso ? `${t.arriveDate} ` : ''}{t.arriveTime}
              </Text>
            ) : null}
            {t.confirmation ? (
              <Text style={styles.hint}>Confirmation: {t.confirmation}</Text>
            ) : null}
          </View>
        ))}

        {checkingOut.length > 0 && <Text style={styles.section}>Check-out today</Text>}
        {checkingOut.map(s => (
          <View key={s.id + 'o'} style={styles.card}>
            <Text style={styles.cardTitle}>🧳 Check out of {s.name}</Text>
          </View>
        ))}

        {stayingTonight.length > 0 && <Text style={styles.section}>Staying tonight</Text>}
        {stayingTonight.map(s => (
          <View key={s.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>🏨 {s.name}</Text>
              {s.addedByCharacter ? <Avatar characterId={s.addedByCharacter} size={24} /> : null}
            </View>
            {s.address ? <Text style={styles.hint}>{s.address}</Text> : null}
            {s.checkIn === day.iso ? <Text style={styles.hint}>Check-in today</Text> : null}
            {s.confirmation ? (
              <Text style={styles.hint}>Confirmation: {s.confirmation}</Text>
            ) : null}
          </View>
        ))}

        {nothing && (
          <Text style={[styles.hint, { textAlign: 'center', marginTop: 20 }]}>
            Nothing planned for this day yet.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 10 },
  dayChip: { backgroundColor: colors.input, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.input },
  dayChipOn: { borderColor: colors.primary, backgroundColor: '#1f3a5f' },
  dayNum: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
  dayDate: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  dayHeading: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  section: { color: colors.textMuted, fontSize: 13, fontWeight: 'bold', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  card: { backgroundColor: colors.card, padding: 12, borderRadius: 8, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: 'bold' },
  line: { color: colors.text, fontSize: 14, marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
});