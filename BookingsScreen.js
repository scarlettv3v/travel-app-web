import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import { useTrip } from './trip';
import DatePicker, { formatDate } from './DatePicker';
import LinkText from './LinkText';
import { openPlace } from './places';
import Popup from './Popup';
import { P, ui, screenContent } from './ui';

const TYPES = [
  { id: 'flight', emoji: '✈️', label: 'Flight' },
  { id: 'car', emoji: '🚗', label: 'Car' },
  { id: 'train', emoji: '🚆', label: 'Train/Bus' },
  { id: 'ferry', emoji: '⛴️', label: 'Ferry' },
];
const typeOf = id => TYPES.find(t => t.id === id) || TYPES[0];

// [key, label, placeholder]
const TRANSPORT_FORM = [
  ['provider', 'Provider', 'Airline / company (e.g. Air NZ)'],
  ['reference', 'Reference', 'Flight / booking no. (e.g. NZ 123)'],
  ['from', 'From', 'e.g. Auckland AKL'],
  ['to', 'To', 'e.g. Queenstown ZQN'],
  ['departDate', 'Departure date', ''],
  ['departTime', 'Departure time', 'e.g. 14:35'],
  ['arriveDate', 'Arrival date', ''],
  ['arriveTime', 'Arrival time', 'e.g. 16:10'],
  ['confirmation', 'Confirmation', 'Confirmation code'],
  ['notes', 'Notes', 'Baggage, terminal...'],
];

const STAY_FORM = [
  ['name', 'Stay name', 'Hotel name'],
  ['address', 'Address', ''],
  ['checkIn', 'Check-in date', ''],
  ['checkInTime', 'Check-in time', 'e.g. 15:00'],
  ['checkOut', 'Check-out date', ''],
  ['checkOutTime', 'Check-out time', 'e.g. 11:00'],
  ['confirmation', 'Confirmation', 'Confirmation code'],
  ['notes', 'Notes', 'Breakfast, parking...'],
];

const ACTIVITY_FORM = [
  ['name', 'Activity name', 'e.g. Milford Sound cruise'],
  ['address', 'Address / meeting point', ''],
  ['date', 'Date', ''],
  ['time', 'Time', 'e.g. 09:30'],
  ['confirmation', 'Confirmation', 'Confirmation code'],
  ['notes', 'Notes', 'What to bring, ticket link...'],
];

const RESTAURANT_FORM = [
  ['name', 'Restaurant name', ''],
  ['address', 'Address', ''],
  ['date', 'Date', ''],
  ['time', 'Time', 'e.g. 19:00'],
  ['partySize', 'Party size', 'e.g. 4'],
  ['confirmation', 'Confirmation', 'Confirmation code'],
  ['notes', 'Notes', 'Allergies, booking link...'],
];

const formFor = kind =>
  kind === 'transport'
    ? TRANSPORT_FORM
    : kind === 'stay'
    ? STAY_FORM
    : kind === 'activity'
    ? ACTIVITY_FORM
    : RESTAURANT_FORM;
// Activities and restaurants are saved as "plans" so they show on the itinerary day
const isPlanKind = kind => kind === 'activity' || kind === 'restaurant';

const DATE_KEYS = ['departDate', 'arriveDate', 'checkIn', 'checkOut', 'date'];
const MIN_FROM = { arriveDate: 'departDate', checkOut: 'checkIn' };
const isDate = text => /^\d{4}-\d{2}-\d{2}$/.test(text);
const str = (doc, key) => doc.fields?.[key]?.stringValue || '';
const nice = d => (d ? formatDate(d) : '');
function toFields(values) {
  const out = {};
  Object.keys(values).forEach(key => {
    out[key] = { stringValue: String(values[key] ?? '') };
  });
  return out;
}

export default function BookingsScreen({ authToken, profile, onOpenItinerary }) {
  const { label: TRIP_LABEL, start: TRIP_START, end: TRIP_END, days: DAYS } = useTrip();
  const scrollRef = useRef(null);
  const [transport, setTransport] = useState([]);
  const [stays, setStays] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [formKind, setFormKind] = useState(null); // 'transport' | 'stay' | 'activity' | 'restaurant' | null
  const [editingId, setEditingId] = useState(null);
  const [values, setValues] = useState({});
  const [pickerKey, setPickerKey] = useState(null);

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
        checkInTime: str(doc, 'checkInTime'),
        checkOutTime: str(doc, 'checkOutTime'),
        confirmation: str(doc, 'confirmation'),
        notes: str(doc, 'notes'),
        addedByName: str(doc, 'addedByName'),
        addedByCharacter: str(doc, 'addedByCharacter'),
      }));
      sList.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      setStays(sList);

      // Activities + restaurants live in "plans" (source = booking)
      const pRes = await firestoreFetch(
        `${FIRESTORE_BASE}/plans?pageSize=300`,
        authToken
      );
      const pData = await pRes.json();
      const rList = (pData.documents || [])
        .filter(doc => str(doc, 'source') === 'booking')
        .map(doc => ({
          id: doc.name,
          kind: str(doc, 'bookingKind') || 'activity',
          name: str(doc, 'spotName'),
          address: str(doc, 'address'),
          date: str(doc, 'date'),
          time: str(doc, 'time'),
          partySize: str(doc, 'partySize'),
          confirmation: str(doc, 'confirmation'),
          notes: str(doc, 'note'),
          addedByName: str(doc, 'addedByName'),
          addedByCharacter: str(doc, 'addedByCharacter'),
        }));
      rList.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      setReservations(rList);
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
    const keys = formFor(kind).map(([k]) => k);
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

  const savePlanBooking = async () => {
    if (!(values.name || '').trim() || !isDate(values.date || '')) {
      alert('Please enter a name and pick a date.');
      return;
    }
    const t = (values.time || '').trim();
    if (t && !/^\d{1,2}:\d{2}$/.test(t)) {
      alert('Time should look like 19:30, or leave it empty.');
      return;
    }
    const time = t.length === 4 ? '0' + t : t;

    const planFields = {
      spotName: { stringValue: values.name.trim() },
      address: { stringValue: values.address || '' },
      date: { stringValue: values.date },
      time: { stringValue: time },
      partySize: { stringValue: values.partySize || '' },
      confirmation: { stringValue: values.confirmation || '' },
      note: { stringValue: values.notes || '' },
    };

    try {
      if (editingId) {
        const mask = Object.keys(planFields)
          .map(key => `updateMask.fieldPaths=${key}`)
          .join('&');
        await firestoreFetch(
          `https://firestore.googleapis.com/v1/${editingId}?${mask}`,
          authToken,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: planFields }),
          }
        );
      } else {
        await firestoreFetch(`${FIRESTORE_BASE}/plans`, authToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              ...planFields,
              category: { stringValue: 'spot' },
              status: { stringValue: 'booked' },
              source: { stringValue: 'booking' },
              bookingKind: { stringValue: formKind },
              joining: { arrayValue: { values: [{ stringValue: profile.name }] } },
              addedByName: { stringValue: profile.name },
              addedByCharacter: { stringValue: profile.character },
            },
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

  const save = async () => {
    if (isPlanKind(formKind)) return savePlanBooking();

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
        const editFields = toFields(values);
        const mask = Object.keys(editFields)
          .map(key => `updateMask.fieldPaths=${key}`)
          .join('&');
        await firestoreFetch(
          `https://firestore.googleapis.com/v1/${editingId}?${mask}`,
          authToken,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: editFields }),
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

  const outside = d => !!d && (d < TRIP_START || d > TRIP_END);

  const outsideCount =
    transport.filter(t => outside(t.departDate)).length +
    stays.filter(s => outside(s.checkIn) || outside(s.checkOut)).length +
    reservations.filter(r => outside(r.date)).length;

  const formFields = formKind ? formFor(formKind) : [];

  // ---------- small render helpers ----------
  const renderAddedBy = item =>
    item.addedByCharacter ? (
      <View style={ui.byRow}>
        <Avatar characterId={item.addedByCharacter} size={22} />
        <Text style={[ui.sub, { marginTop: 0, marginLeft: 8 }]}>Added by {item.addedByName}</Text>
      </View>
    ) : null;

  const renderButtons = (kind, item, extra) => (
    <View style={[ui.row, { marginTop: 12 }]}>
      {extra}
      <TouchableOpacity style={[ui.pill, ui.pillSmall]} onPress={() => startEdit(kind, item)}>
        <Text style={[ui.pillText, ui.pillTextSmall]}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[ui.pill, ui.pillSmall, ui.pillDanger]} onPress={() => remove(item.id)}>
        <Text style={[ui.pillText, ui.pillTextSmall, ui.pillDangerText]}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const directionsPill = item => (
    <TouchableOpacity
      style={[ui.pill, ui.pillSmall]}
      onPress={() =>
        openPlace({
          address: item.address,
          name: item.name,
        })
      }
    >
      <Text style={[ui.pillText, ui.pillTextSmall]}>Google Maps</Text>
    </TouchableOpacity>
  );

  const renderWarning = text => (
    <View style={[ui.notice, ui.noticeWarn]}>
      <Text style={ui.noticeText}>⚠ {text}</Text>
    </View>
  );

  const renderField = ([key, label, placeholder]) => (
    <View key={key}>
      <Text style={ui.label}>{label}</Text>
      {DATE_KEYS.includes(key) ? (
        <TouchableOpacity style={ui.field} onPress={() => setPickerKey(key)}>
          <Text style={values[key] ? ui.fieldText : ui.fieldPlaceholder}>
            📅 {values[key] ? formatDate(values[key]) : 'Tap to pick a date'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TextInput
          style={[ui.field, key === 'notes' && { minHeight: 64, textAlignVertical: 'top' }]}
          placeholder={placeholder}
          placeholderTextColor="#8a9ca6"
          value={values[key] || ''}
          onChangeText={text => {
            setValue(key, text);
          }}
          multiline={key === 'notes'}
          autoCapitalize={key === 'confirmation' ? 'characters' : 'sentences'}
        />
      )}
      {key === 'address' && formKind !== 'transport' ? (
        <View>
          <View style={[ui.row, { marginTop: 10 }]}>
            <TouchableOpacity
              style={[ui.pill, ui.pillSmall]}
              onPress={() => openPlace({ name: values.name, address: values.address })}
            >
              <Text style={[ui.pillText, ui.pillTextSmall]}>🔎 Look it up in Google Maps</Text>
            </TouchableOpacity>
          </View>
          <Text style={ui.hint}>
            Tip: find the place in Google Maps, copy its address, and paste it here. The Google
            Maps button will then open the exact place.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={ui.screen}
      contentContainerStyle={screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[ui.card, { paddingRight: 56 }]}>
        <Text style={ui.kicker}>THE PRACTICAL BITS</Text>
        <Text style={ui.h2}>Bookings</Text>
        <Text style={ui.sub}>Keep your rides, stays, activities and tables in one place.</Text>
        <Text style={ui.hint}>Trip: {TRIP_LABEL}</Text>
      </View>

      {/* Add buttons + form */}
      <View style={ui.card}>
        <View style={ui.row}>
          <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={() => openForm('transport')}>
            <Text style={ui.pillText}>+ Transport</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={() => openForm('stay')}>
            <Text style={ui.pillText}>+ Stay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={() => openForm('activity')}>
            <Text style={ui.pillText}>+ Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={() => openForm('restaurant')}>
            <Text style={ui.pillText}>+ Restaurant</Text>
          </TouchableOpacity>
        </View>

        {outsideCount > 0
          ? renderWarning(
              `${outsideCount} booking${outsideCount > 1 ? 's are' : ' is'} outside your trip dates. They won't show on the Itinerary tab.`
            )
          : null}

      </View>

      {/* Lists */}
      <View style={ui.card}>
        <Text style={ui.h3}>Transport ({transport.length})</Text>
        {transport.length === 0 && (
          <View style={ui.notice}>
            <Text style={ui.noticeText}>No transport yet. Add a ride above.</Text>
          </View>
        )}
        {transport.map(t => (
          <View key={t.id} style={ui.listCard}>
            <View style={ui.tag}>
              <Text style={ui.tagText}>
                {typeOf(t.type).emoji} {typeOf(t.type).label}
              </Text>
            </View>
            <Text style={[ui.h3, { marginTop: 8 }]}>
              {t.from} → {t.to}
            </Text>
            <Text style={ui.sub}>
              {t.provider || typeOf(t.type).label}
              {t.reference ? ` · ${t.reference}` : ''}
            </Text>
            <Text style={ui.sub}>
              Departs {nice(t.departDate)} {t.departTime}
            </Text>
            {t.arriveDate || t.arriveTime ? (
              <Text style={ui.sub}>
                Arrives {nice(t.arriveDate)} {t.arriveTime}
              </Text>
            ) : null}
            {t.confirmation ? <Text style={ui.sub}>Confirmation: {t.confirmation}</Text> : null}
            {t.notes ? <LinkText style={ui.sub}>{`📝 ${t.notes}`}</LinkText> : null}
            {outside(t.departDate) ? renderWarning('Departs outside your trip dates') : null}
            {renderAddedBy(t)}
            {renderButtons('transport', t)}
          </View>
        ))}

        <Text style={[ui.h3, { marginTop: 22 }]}>Stays ({stays.length})</Text>
        {stays.length === 0 && (
          <View style={ui.notice}>
            <Text style={ui.noticeText}>No stays yet. Add a place to sleep above.</Text>
          </View>
        )}
        {stays.map(h => (
          <View key={h.id} style={ui.listCard}>
            <View style={ui.tag}>
              <Text style={ui.tagText}>🏨 Stay</Text>
            </View>
            <Text style={[ui.h3, { marginTop: 8 }]}>{h.name}</Text>
            <Text style={ui.sub}>
              {nice(h.checkIn)} {h.checkInTime} check-in
            </Text>
            <Text style={ui.sub}>
              {nice(h.checkOut)} {h.checkOutTime} check-out
            </Text>
            {h.address ? <Text style={ui.sub}>📍 {h.address}</Text> : null}
            {h.confirmation ? <Text style={ui.sub}>Confirmation: {h.confirmation}</Text> : null}
            {h.notes ? <LinkText style={ui.sub}>{`📝 ${h.notes}`}</LinkText> : null}
            {outside(h.checkIn) || outside(h.checkOut)
              ? renderWarning('Dates fall outside your trip')
              : null}
            {renderAddedBy(h)}
            {renderButtons('stay', h, directionsPill(h))}
          </View>
        ))}

        <Text style={[ui.h3, { marginTop: 22 }]}>
          Activities & restaurants ({reservations.length})
        </Text>
        {reservations.length === 0 && (
          <View style={ui.notice}>
            <Text style={ui.noticeText}>
              Nothing booked yet. Add an activity or restaurant above and it will appear on its day in the Itinerary.
            </Text>
          </View>
        )}
        {reservations.map(r => {
          const day = DAYS.find(d => d.iso === r.date);
          const isRestaurant = r.kind === 'restaurant';
          return (
            <View key={r.id} style={ui.listCard}>
              <View style={ui.tag}>
                <Text style={ui.tagText}>{isRestaurant ? '🍽️ Restaurant' : '🎟️ Activity'}</Text>
              </View>
              <Text style={[ui.h3, { marginTop: 8 }]}>{r.name}</Text>
              <Text style={ui.sub}>
                {nice(r.date)} {r.time}
              </Text>
              {r.partySize ? <Text style={ui.sub}>Party of {r.partySize}</Text> : null}
              {r.address ? <Text style={ui.sub}>📍 {r.address}</Text> : null}
              {r.confirmation ? <Text style={ui.sub}>Confirmation: {r.confirmation}</Text> : null}
              {r.notes ? <LinkText style={ui.sub}>{`📝 ${r.notes}`}</LinkText> : null}
              {day ? (
                <Text style={[ui.sub, { fontWeight: '800', color: P.ink, marginTop: 6 }]}>
                  📅 On the itinerary: Day {day.dayNumber} · {day.short} (Booked)
                </Text>
              ) : (
                renderWarning('This date is outside your trip, so it is not on the itinerary')
              )}
              {renderAddedBy(r)}
              {renderButtons(
                r.kind,
                r,
                <>
                  {day && onOpenItinerary ? (
                    <TouchableOpacity
                      style={[ui.pill, ui.pillSmall, ui.pillPrimary]}
                      onPress={onOpenItinerary}
                    >
                      <Text style={[ui.pillText, ui.pillTextSmall]}>View itinerary</Text>
                    </TouchableOpacity>
                  ) : null}
                  {directionsPill(r)}
                </>
              )}
            </View>
          );
        })}
      </View>

      {/* Add / edit popup */}
      <Popup visible={!!formKind} onClose={closeForm}>
        <View>
            <Text style={ui.kicker}>BOOKING</Text>
            <Text style={ui.h2}>{editingId ? `Edit ${formKind}` : `Add ${formKind}`}</Text>

            {formKind === 'transport' && (
              <View>
                <Text style={ui.label}>Transport type</Text>
                <View style={ui.row}>
                  {TYPES.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[ui.pill, ui.pillSmall, values.type === t.id && ui.pillActive]}
                      onPress={() => setValue('type', t.id)}
                    >
                      <Text style={[ui.pillText, ui.pillTextSmall]}>
                        {t.emoji} {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {formFields.map(renderField)}

            <Text style={ui.hint}>
              {isPlanKind(formKind)
                ? 'It will appear on this day in the Itinerary, marked as Booked.'
                : 'Dates with a blue edge are your trip days.'}
            </Text>

            <View style={[ui.row, { marginTop: 14 }]}>
              <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={save}>
                <Text style={ui.pillText}>{editingId ? 'Save changes' : 'Save booking'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ui.pill} onPress={closeForm}>
                <Text style={ui.pillText}>Cancel</Text>
              </TouchableOpacity>
            </View>
        </View>
      </Popup>

      <DatePicker
        visible={!!pickerKey}
        title={pickerKey ? formFields.find(f => f[0] === pickerKey)?.[1] : ''}
        value={pickerKey ? values[pickerKey] : ''}
        minDate={pickerKey && MIN_FROM[pickerKey] ? values[MIN_FROM[pickerKey]] : ''}
        onPick={iso => {
          setValue(pickerKey, iso);
          setPickerKey(null);
        }}
        onClear={() => {
          setValue(pickerKey, '');
          setPickerKey(null);
        }}
        onClose={() => setPickerKey(null)}
      />
    </ScrollView>
  );
}