import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import { DAYS } from './trip';
import { getCategory } from './categories';
import DayMap from './DayMap';

const str = (doc, key) => doc.fields?.[key]?.stringValue || '';
const num = (doc, key) => {
  const f = doc.fields && doc.fields[key];
  if (!f) return 0;
  return Number(f.doubleValue !== undefined ? f.doubleValue : f.integerValue || 0);
};
const TRANSPORT_EMOJI = { flight: '✈️', car: '🚗', train: '🚆', ferry: '⛴️' };

export default function ItineraryScreen({ authToken, profile }) {
  const [selected, setSelected] = useState(0);
  const [transport, setTransport] = useState([]);
  const [stays, setStays] = useState([]);
  const [plans, setPlans] = useState([]);
  const [characters, setCharacters] = useState({});

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

      const pRes = await firestoreFetch(`${FIRESTORE_BASE}/plans?pageSize=300`, authToken);
      const pData = await pRes.json();
      setPlans(
        (pData.documents || []).map(doc => ({
          id: doc.name,
          spotName: str(doc, 'spotName'),
          category: str(doc, 'category') || 'spot',
          note: str(doc, 'note'),
          date: str(doc, 'date'),
          time: str(doc, 'time'),
          status: str(doc, 'status') || 'planned',
                    lat: Number(doc.fields?.lat?.doubleValue ?? doc.fields?.lat?.integerValue ?? 0),
          lng: Number(doc.fields?.lng?.doubleValue ?? doc.fields?.lng?.integerValue ?? 0),
          joining: (doc.fields?.joining?.arrayValue?.values || []).map(v => v.stringValue),
          addedByName: str(doc, 'addedByName'),
        }))
      );

      const prRes = await firestoreFetch(`${FIRESTORE_BASE}/profiles?pageSize=300`, authToken);
      const prData = await prRes.json();
      const map = {};
      (prData.documents || []).forEach(doc => {
        map[str(doc, 'name')] = str(doc, 'character') || 'fox';
      });
      setCharacters(map);
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

  const patchPlan = async (plan, fields, masks) => {
    try {
      const mask = masks.map(m => `updateMask.fieldPaths=${m}`).join('&');
      await firestoreFetch(`https://firestore.googleapis.com/v1/${plan.id}?${mask}`, authToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      await loadAll();
    } catch (error) {
      console.error('Error updating plan:', error);
      alert('Could not update.');
    }
  };

  const toggleJoin = plan => {
    const next = plan.joining.includes(profile.name)
      ? plan.joining.filter(n => n !== profile.name)
      : [...plan.joining, profile.name];
    patchPlan(
      plan,
      { joining: { arrayValue: { values: next.map(n => ({ stringValue: n })) } } },
      ['joining']
    );
  };

  const toggleStatus = plan =>
    patchPlan(
      plan,
      { status: { stringValue: plan.status === 'booked' ? 'planned' : 'booked' } },
      ['status']
    );

  const removePlan = async plan => {
    try {
      await firestoreFetch(`https://firestore.googleapis.com/v1/${plan.id}`, authToken, {
        method: 'DELETE',
      });
      await loadAll();
    } catch (error) {
      console.error('Error removing plan:', error);
      alert('Could not remove.');
    }
  };

  const day = DAYS[selected];

  const departing = transport
    .filter(t => t.departDate === day.iso)
    .sort((a, b) => a.departTime.localeCompare(b.departTime));
  const arriving = transport.filter(t => t.arriveDate === day.iso && t.departDate !== day.iso);
  const stayingTonight = stays.filter(s => s.checkIn <= day.iso && day.iso < s.checkOut);
  const checkingOut = stays.filter(s => s.checkOut === day.iso);
  const dayPlans = plans
    .filter(p => p.date === day.iso)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const mapStops = dayPlans.filter(p => p.lat && p.lng);
  const nothing =
    !departing.length && !arriving.length && !stayingTonight.length &&
    !checkingOut.length && !dayPlans.length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📅 Itinerary</Text>

      <View style={{ height: 70 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
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
        <DayMap stops={mapStops} />
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
            {t.confirmation ? <Text style={styles.hint}>Confirmation: {t.confirmation}</Text> : null}
          </View>
        ))}

        {dayPlans.length > 0 && <Text style={styles.section}>Plans</Text>}
        {dayPlans.map(p => {
          const iAmIn = p.joining.includes(profile.name);
          return (
            <View key={p.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={[styles.cardTitle, { flex: 1 }]}>
                  {getCategory(p.category).emoji} {p.time ? `${p.time} · ` : ''}{p.spotName}
                </Text>
                <Text style={p.status === 'booked' ? styles.booked : styles.planned}>
                  {p.status === 'booked' ? '✅ Booked' : '📝 Planned'}
                </Text>
              </View>

              {p.note ? <Text style={styles.noteText}>{p.note}</Text> : null}

              <View style={[styles.row, { marginTop: 8 }]}>
                <Text style={styles.hint}>Joining: </Text>
                {p.joining.length === 0 && <Text style={styles.hint}>nobody yet</Text>}
                {p.joining.map(name => (
                  <View key={name} style={{ marginRight: 4 }}>
                    <Avatar characterId={characters[name] || 'fox'} size={24} />
                  </View>
                ))}
              </View>

              <View style={[styles.row, { marginTop: 10 }]}>
                <TouchableOpacity style={styles.smallBtn} onPress={() => toggleJoin(p)}>
                  <Text style={styles.smallBtnText}>{iAmIn ? 'Leave' : "I'm in"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallBtn} onPress={() => toggleStatus(p)}>
                  <Text style={styles.smallBtnText}>
                    {p.status === 'booked' ? 'Mark planned' : 'Mark booked'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: colors.danger }]} onPress={() => removePlan(p)}>
                  <Text style={styles.smallBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

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
            {s.confirmation ? <Text style={styles.hint}>Confirmation: {s.confirmation}</Text> : null}
          </View>
        ))}

        {nothing && (
          <Text style={[styles.hint, { textAlign: 'center', marginTop: 20 }]}>
            Nothing planned for this day yet. Add spots from the Spots tab with "Add to day".
          </Text>
        )}

        <View style={{ height: 30 }} />
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
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: 'bold' },
  line: { color: colors.text, fontSize: 14, marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  noteText: { color: colors.textSoft, fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  booked: { color: colors.success, fontSize: 12, fontWeight: 'bold' },
  planned: { color: colors.highlight, fontSize: 12, fontWeight: 'bold' },
  smallBtn: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 },
  smallBtnText: { color: colors.text, fontSize: 12, fontWeight: 'bold' },
});