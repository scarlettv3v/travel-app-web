import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import { TRIP_LABEL, PICK_DAYS } from './trip';

const TYPES = [
  { id: 'flight', emoji: '✈️', label: 'Flight' },
  { id: 'car', emoji: '🚗', label: 'Car' },
  { id: 'train', emoji: '🚆', label: 'Train/Bus' },
  { id: 'ferry', emoji: '⛴️', label: 'Ferry' },
];
const typeOf = id => TYPES.find(t => t.id === id) || TYPES[0];

const TRANSPORT_FORM = [
  ['provider', 'Airline / company (e.g. Air NZ)'],
  ['reference', 'Flight / booking no. (e.g. NZ 123)'],
  ['from', 'From (e.g. Auckland AKL)'],
  ['to', 'To (e.g. Queenstown ZQN)'],
  ['departDate', 'Departure date'],
  ['departTime', 'Departure time (e.g. 14:35)'],
  ['arriveDate', 'Arrival date'],
  ['arriveTime', 'Arrival time (e.g. 16:10)'],
  ['confirmation', 'Confirmation code'],
  ['notes', 'Notes (baggage, terminal...)'],
];

const STAY_FORM = [
  ['name', 'Hotel name'],
  ['address', 'Address'],
  ['checkIn', 'Check-in date'],
  ['checkOut', 'Check-out date'],
  ['confirmation', 'Confirmation code'],
  ['notes', 'Notes (breakfast, parking...)'],
];

const DATE_KEYS = ['departDate', 'arriveDate', 'checkIn', 'checkOut'];
const isDate = text => /^\d{4}-\d{2}-\d{2}$/.test(text);
const str = (doc, key) => doc.fields?.[key]?.stringValue || '';

function toFields(values) {
  const out = {};
  Object.keys(values).forEach(key => {
    out[key] = { stringValue: String(values[key] ?? '') };
  });
  return out;
}

export default function BookingsScreen({ authToken, profile }) {
  const scrollRef = useRef(null);
  const [transport, setTransport] = useState([]);
  const [stays, setStays] = useState([]);
  const [formKind, setFormKind] = useState(null); // 'transport' | 'stay' | null
  const [editingId, setEditingId] = useState(null);
  const [values, setValues] = useState({});

  const loadAll = useCallback(async () => {
    try {
      const tRes = await firestoreFetch(
        `${FIRESTORE_BASE}/transport?pageSize=300`,
        authToken
      );
      const tData = await tRes.json();
      const tList = (tData.documents || []).map(doc => ({
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
        notes: str(doc, 'notes'),
        addedByName: str(doc, 'addedByName'),
        addedByCharacter: str(doc, 'addedByCharacter'),
      }));
      tList.sort((a, b) =>
        (a.departDate + a.departTime).localeCompare(b.departDate + b.departTime)
      );
      setTransport(tList);

      const sRes = await firestoreFetch(
        `${FIRESTORE_BASE}/stays?pageSize=300`,
        authToken
      );
      const sData = await sRes.json();
      const sList = (sData.documents || []).map(doc => ({
        id: doc.name,
        name: str(doc, 'name'),
        address: str(doc, 'address'),
        checkIn: str(doc, 'checkIn'),
        checkOut: str(doc, 'checkOut'),
        confirmation: str(doc, 'confirmation'),
        notes: str(doc, 'notes'),
        addedByName: str(doc, 'addedByName'),
        addedByCharacter: str(doc, 'addedByCharacter'),
      }));
      sList.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      setStays(sList);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [authToken, loadAll]);

  const scrollTop = () => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true });
  };

  const openForm = kind => {
    setEditingId(null);
    setValues(kind === 'transport' ? { type: 'flight' } : {});
    setFormKind(kind);
    scrollTop();
  };

  const startEdit = (kind, item) => {
    const keys = (kind === 'transport' ? TRANSPORT_FORM : STAY_FORM).map(([k]) => k);
    const v = {};
    keys.forEach(k => {
      v[k] = item[k] || '';
    });
    if (kind === 'transport') v.type = item.type || 'flight';
    setValues(v);
    setEditingId(item.id);
    setFormKind(kind);
    scrollTop();
  };

  const closeForm = () => {
    setFormKind(null);
    setEditingId(null);
  };

  const setValue = (key, text) => setValues(prev => ({ ...prev, [key]: text }));

  const save = async () => {
    if (formKind === 'transport') {
      if (!values.from || !values.to || !isDate(values.departDate || '')) {
        alert('Please fill in From, To and pick a departure date.');
        return;
      }
      if (values.arriveDate && !isDate(values.arriveDate)) {
        alert('Please pick a valid arrival date.');
        return;
      }
    } else {
      if (!values.name || !isDate(values.checkIn || '') || !isDate(values.checkOut || '')) {
        alert('Please fill in the hotel name and pick check-in and check-out dates.');
        return;
      }
    }

    const collection = formKind === 'transport' ? 'transport' : 'stays';

    try {
      if (editingId) {
        // Editing: change only the form fields, keep "Added by" as it was
        const mask = Object.keys(values)
          .map(key => `updateMask.fieldPaths=${key}`)
          .join('&');
        await firestoreFetch(
          `https://firestore.googleapis.com/v1/${editingId}?${mask}`,
          authToken,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: toFields(values) }),
          }
        );
      } else {
        await firestoreFetch(`${FIRESTORE_BASE}/${collection}`, authToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: toFields({
              ...values,
              addedByName: profile.name,
              addedByCharacter: profile.character,
            }),
          }),
        });
      }
      closeForm();
      await loadAll();
    } catch (error) {
      console.error('Error saving booking:', error);
      alert('Could not save booking.');
    }
  };

  const remove = async id => {
    try {
      await firestoreFetch(`https://firestore.googleapis.com/v1/${id}`, authToken, {
        method: 'DELETE',
      });
      if (id === editingId) closeForm();
      await loadAll();
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('Could not delete.');
    }
  };

  const AddedBy = ({ item }) =>
    item.addedByCharacter ? (
      <View style={styles.byRow}>
        <Avatar characterId={item.addedByCharacter} size={20} />
        <Text style={styles.hint}> Added by {item.addedByName}</Text>
      </View>
    ) : null;

  const Buttons = ({ kind, item }) => (
    <View style={{ flexDirection: 'row', marginTop: 8 }}>
      <TouchableOpacity
        style={[styles.editButton, { marginRight: 8 }]}
        onPress={() => startEdit(kind, item)}
      >
        <Text style={styles.buttonText}>✏️ Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.redButton} onPress={() => remove(item.id)}>
        <Text style={styles.buttonText}>🗑️ Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const formFields = formKind === 'transport' ? TRANSPORT_FORM : STAY_FORM;
  const kindLabel = formKind === 'transport' ? 'transport' : 'stay';

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={{ padding: 15, paddingTop: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>🧳 Bookings</Text>
      <Text style={[styles.hint, { textAlign: 'center' }]}>Trip: {TRIP_LABEL}</Text>

      {formKind ? (
        <View style={[styles.card, editingId && { borderWidth: 1, borderColor: colors.highlight }]}>
          <Text style={[styles.section, editingId && { color: colors.highlight }]}>
            {editingId ? `✏️ Edit ${kindLabel}` : `New ${kindLabel}`}
          </Text>

          {formKind === 'transport' && (
            <View style={styles.chipRow}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, values.type === t.id && styles.chipOn]}
                  onPress={() => setValue('type', t.id)}
                >
                  <Text style={styles.chipText}>
                    {t.emoji} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {formFields.map(([key, placeholder]) =>
            DATE_KEYS.includes(key) ? (
              <View key={key} style={{ marginBottom: 8 }}>
                <Text style={styles.hint}>
                  {placeholder}
                  {values[key] ? `: ${values[key]}` : ''}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 6 }}
                >
                  {PICK_DAYS.map(d => (
                    <TouchableOpacity
                      key={d.iso}
                      style={[
                        styles.chip,
                        d.inTrip && styles.chipTrip,
                        values[key] === d.iso && styles.chipOn,
                      ]}
                      onPress={() => setValue(key, values[key] === d.iso ? '' : d.iso)}
                    >
                      <Text style={styles.chipText}>{d.short}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <TextInput
                key={key}
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={colors.textDim}
                value={values[key] || ''}
                onChangeText={text => setValue(key, text)}
                autoCapitalize={key === 'confirmation' ? 'characters' : 'sentences'}
              />
            )
          )}

          <Text style={styles.hint}>Dates with a blue edge are your trip days.</Text>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.greenButton, { flex: 1, marginRight: 8 }]}
              onPress={save}
            >
              <Text style={styles.buttonText}>{editingId ? 'Save Changes' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.redButton} onPress={closeForm}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', marginVertical: 10 }}>
          <TouchableOpacity
            style={[styles.blueButton, { flex: 1, marginRight: 8 }]}
            onPress={() => openForm('transport')}
          >
            <Text style={styles.buttonText}>+ Transport</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.blueButton, { flex: 1 }]}
            onPress={() => openForm('stay')}
          >
            <Text style={styles.buttonText}>+ Stay</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.section}>Transport ({transport.length})</Text>
      {transport.length === 0 && <Text style={styles.hint}>Nothing added yet.</Text>}
      {transport.map(t => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {typeOf(t.type).emoji} {t.provider || typeOf(t.type).label}
            {t.reference ? ` · ${t.reference}` : ''}
          </Text>
          <Text style={styles.line}>
            {t.from} → {t.to}
          </Text>
          <Text style={styles.hint}>
            Departs {t.departDate} {t.departTime}
          </Text>
          {t.arriveDate || t.arriveTime ? (
            <Text style={styles.hint}>
              Arrives {t.arriveDate} {t.arriveTime}
            </Text>
          ) : null}
          {t.confirmation ? (
            <Text style={styles.hint}>Confirmation: {t.confirmation}</Text>
          ) : null}
          {t.notes ? <Text style={styles.note}>📝 {t.notes}</Text> : null}
          <AddedBy item={t} />
          <Buttons kind="transport" item={t} />
        </View>
      ))}

      <Text style={styles.section}>Stays ({stays.length})</Text>
      {stays.length === 0 && <Text style={styles.hint}>Nothing added yet.</Text>}
      {stays.map(h => (
        <View key={h.id} style={styles.card}>
          <Text style={styles.cardTitle}>🏨 {h.name}</Text>
          <Text style={styles.line}>
            {h.checkIn} → {h.checkOut}
          </Text>
          {h.address ? <Text style={styles.hint}>{h.address}</Text> : null}
          {h.confirmation ? (
            <Text style={styles.hint}>Confirmation: {h.confirmation}</Text>
          ) : null}
          {h.notes ? <Text style={styles.note}>📝 {h.notes}</Text> : null}
          <AddedBy item={h} />
          <Buttons kind="stay" item={h} />
        </View>
      ))}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 4 },
  section: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 14, marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  line: { color: colors.text, fontSize: 15, marginTop: 4 },
  note: { color: colors.textSoft, fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  card: { backgroundColor: colors.card, padding: 12, borderRadius: 8, marginBottom: 10 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  byRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: colors.input },
  chipTrip: { borderColor: '#2f5d8f' },
  chipOn: { borderColor: colors.primary, backgroundColor: '#1f3a5f' },
  chipText: { color: colors.text, fontSize: 13 },
  input: { backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 8 },
  blueButton: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  greenButton: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  redButton: { backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  editButton: { backgroundColor: colors.warning, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
});