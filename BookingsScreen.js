import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
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

// The filter row at the top of the list
const FILTERS = [
  ['all', '🗂️ All'],
  ['transport', '✈️ Transport'],
  ['stay', '🏨 Stays'],
  ['activity', '🎟️ Activities'],
  ['restaurant', '🍽️ Restaurants'],
];

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
const nice = d => (d ? formatDate(d) : ''); // Nov 21, 2026 (Sat)
const niceShort = d => (d ? formatDate(d, { year: false }) : ''); // Nov 21 (Sat)
const joinList = doc =>
  (doc.fields?.joining?.arrayValue?.values || []).map(v => v.stringValue);
const joinValue = names => ({
  arrayValue: { values: names.map(n => ({ stringValue: n })) },
});
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
  const [characters, setCharacters] = useState({});
  const [formKind, setFormKind] = useState(null); // 'transport' | 'stay' | 'activity' | 'restaurant' | null
  const [editingId, setEditingId] = useState(null);
  const [values, setValues] = useState({});
  const [joiningSel, setJoiningSel] = useState([]); // who is on the booking being added / edited
  const [pickerKey, setPickerKey] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState({}); // which cards are expanded

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
        joining: joinList(doc),
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
        joining: joinList(doc),
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
          joining: joinList(doc),
        }));
      rList.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      setReservations(rList);

      const prRes = await firestoreFetch(`${FIRESTORE_BASE}/profiles?pageSize=300`, authToken);
      const prData = await prRes.json();
      const map = {};
      (prData.documents || []).forEach(doc => {
        map[str(doc, 'name')] = str(doc, 'character') || 'fox';
      });
      setCharacters(map);
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
    setJoiningSel([profile.name]);
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
    setJoiningSel(item.joining || []);
    setEditingId(item.id);
    setFormKind(kind);
    scrollTop();
  };

  const closeForm = () => {
    setFormKind(null);
    setEditingId(null);
  };

  const setValue = (key, text) => setValues(prev => ({ ...prev, [key]: text }));

  const toggleSel = name =>
    setJoiningSel(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));

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
      joining: joinValue(joiningSel),
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
        // Editing: change only the form fields (and who is on it), keep "Added by" as it was
        const editFields = { ...toFields(values), joining: joinValue(joiningSel) };
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
            fields: {
              ...toFields({
                ...values,
                addedByName: profile.name,
                addedByCharacter: profile.character,
              }),
              joining: joinValue(joiningSel),
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

  // ---------- filter + search ----------
  const q = query.trim().toLowerCase();
  const hit = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);

  const tList = transport.filter(t =>
    hit(t.from, t.to, t.provider, t.reference, t.confirmation, t.notes, typeOf(t.type).label)
  );
  const sList = stays.filter(h => hit(h.name, h.address, h.confirmation, h.notes));
  const aAll = reservations.filter(r => r.kind !== 'restaurant');
  const rAll = reservations.filter(r => r.kind === 'restaurant');
  const aList = aAll.filter(r => hit(r.name, r.address, r.confirmation, r.notes));
  const rList2 = rAll.filter(r => hit(r.name, r.address, r.confirmation, r.notes));

  const counts = {
    all: transport.length + stays.length + reservations.length,
    transport: transport.length,
    stay: stays.length,
    activity: aAll.length,
    restaurant: rAll.length,
  };

  const showT = filter === 'all' || filter === 'transport';
  const showS = filter === 'all' || filter === 'stay';
  const showA = filter === 'all' || filter === 'activity';
  const showR = filter === 'all' || filter === 'restaurant';

  const visibleItems = [
    ...(showT ? tList : []),
    ...(showS ? sList : []),
    ...(showA ? aList : []),
    ...(showR ? rList2 : []),
  ];
  const allOpen = visibleItems.length > 0 && visibleItems.every(i => openIds[i.id]);
  const toggleAll = () => {
    if (allOpen) {
      setOpenIds({});
    } else {
      const next = {};
      visibleItems.forEach(i => {
        next[i.id] = true;
      });
      setOpenIds(next);
    }
  };
  const toggleOpen = id => setOpenIds(prev => ({ ...prev, [id]: !prev[id] }));

  const memberNames = [
    ...new Set([profile.name, ...Object.keys(characters), ...joiningSel].filter(Boolean)),
  ];

  // ---------- small render helpers ----------
  // Everyone sees every booking. Each person taps "I'm on this" if it applies to them.
  const toggleJoin = async item => {
    const current = item.joining || [];
    const next = current.includes(profile.name)
      ? current.filter(n => n !== profile.name)
      : [...current, profile.name];
    try {
      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${item.id}?updateMask.fieldPaths=joining`,
        authToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { joining: joinValue(next) } }),
        }
      );
      await loadAll();
    } catch (error) {
      console.error('Error updating who is on this booking:', error);
      alert('Could not update.');
    }
  };

  const renderWho = item => (
    <View style={{ marginTop: 6 }}>
      <Text style={[ui.sub, { marginTop: 0 }]}>Who's on this?</Text>
      <View style={[ui.row, { marginTop: 3 }]}>
        {(item.joining || []).length === 0 ? (
          <Text style={[ui.sub, { marginTop: 0 }]}>Nobody yet. Tap "I'm on this".</Text>
        ) : (
          item.joining.map(name => (
            <View key={name} style={{ alignItems: 'center', marginRight: 8 }}>
              <Avatar characterId={characters[name] || 'fox'} size={20} />
              <Text style={{ color: '#526873', fontSize: 10 }}>{name}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const joinPill = (item, label = "I'm on this", leave = 'Leave') => {
    const on = (item.joining || []).includes(profile.name);
    return (
      <TouchableOpacity
        style={[ui.pill, ui.pillSmall, !on && ui.pillPrimary]}
        onPress={() => toggleJoin(item)}
      >
        <Text style={[ui.pillText, ui.pillTextSmall]}>{on ? leave : label}</Text>
      </TouchableOpacity>
    );
  };

  const renderAddedBy = item =>
  item.addedByName ? (
    <Text style={[ui.sub, { marginTop: 1 }]}>Added by {item.addedByName}</Text>
  ) : null;

  const renderButtons = (kind, item, extra) => (
    <View style={[ui.row, { marginTop: 6 }]}>
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

  // "View itinerary" jumps to the exact day of this booking (only if that day is in the trip)
  const itineraryPill = date =>
    onOpenItinerary && DAYS.some(d => d.iso === date) ? (
      <TouchableOpacity
        style={[ui.pill, ui.pillSmall, ui.pillPrimary]}
        onPress={() => onOpenItinerary(date)}
      >
        <Text style={[ui.pillText, ui.pillTextSmall]}>View itinerary</Text>
      </TouchableOpacity>
    ) : null;

  const renderWarning = text => (
    <View style={[ui.notice, ui.noticeWarn]}>
      <Text style={ui.noticeText}>⚠ {text}</Text>
    </View>
  );

  // The always-visible top of a card: tag, who is on it, the title and one line of summary.
  // Tap it to open or close the details.
  const renderHead = (item, tagText, title, summary) => {
    const open = !!openIds[item.id];
    const names = item.joining || [];
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => toggleOpen(item.id)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={ui.tag}>
            <Text style={ui.tagText}>{tagText}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {names.slice(0, 3).map(n => (
            <View key={n} style={{ marginLeft: 2 }}>
              <Avatar characterId={characters[n] || 'fox'} size={16} />
            </View>
          ))}
          {names.length > 3 ? (
            <Text style={{ color: P.muted, fontSize: 10, marginLeft: 3 }}>+{names.length - 3}</Text>
          ) : null}
          <Text style={[ui.sub, { marginTop: 0, marginLeft: 7, fontSize: 13 }]}>{open ? '▴' : '▾'}</Text>
        </View>
        <Text style={[ui.h3, { marginTop: 2 }]}>{title}</Text>
        {!open && summary ? <Text style={ui.sub}>{summary}</Text> : null}
      </TouchableOpacity>
    );
  };

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
          <View style={[ui.row, { marginTop: 8 }]}>
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

  const sectionTitle = (text, first) => (
    <Text style={[ui.h3, { marginTop: first ? 8 : 12 }]}>{text}</Text>
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

      {/* Add buttons: one row, thin box */}
      <View style={[ui.card, { paddingVertical: 6 }]}>
        <View style={styles.addRow}>
          {[
            ['transport', '+ Transport'],
            ['stay', '+ Stay'],
            ['activity', '+ Activity'],
            ['restaurant', '+ Restaurant'],
          ].map(([kind, label]) => (
            <TouchableOpacity
              key={kind}
              style={styles.addPill}
              onPress={() => openForm(kind)}
            >
              <Text style={styles.addText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {outsideCount > 0
          ? renderWarning(
              `${outsideCount} booking${outsideCount > 1 ? 's are' : ' is'} outside your trip dates. They won't show on the Itinerary tab.`
            )
          : null}
      </View>

      {/* Find a booking: search + category filter */}
      <View style={ui.card}>
        <TextInput
          style={[ui.field, { paddingVertical: 5 }]}
          placeholder="🔎 Search name, place, confirmation..."
          placeholderTextColor="#8a9ca6"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />

        {/* All filters in view: the row wraps instead of scrolling sideways */}
        <View style={[ui.row, { marginTop: 6 }]}>
          {FILTERS.map(([id, label]) => (
            <TouchableOpacity
              key={id}
              style={[ui.pill, ui.pillSmall, filter === id && ui.pillActive]}
              onPress={() => setFilter(id)}
            >
              <Text style={[ui.pillText, ui.pillTextSmall]} numberOfLines={1}>
                {label}
                <Text style={styles.count}> {counts[id]}</Text>
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* The count text and Expand all share one row */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText} numberOfLines={1}>
            {visibleItems.length}
            {q || filter !== 'all' ? ` match${visibleItems.length === 1 ? '' : 'es'}` : ' bookings'}
            {' · tap a card to open'}
          </Text>
          {visibleItems.length > 1 ? (
            <TouchableOpacity
              style={[ui.pill, ui.pillSmall, { marginRight: 0, marginBottom: 0, marginLeft: 6 }]}
              onPress={toggleAll}
            >
              <Text style={[ui.pillText, ui.pillTextSmall]} numberOfLines={1}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {visibleItems.length === 0 && (
          <View style={ui.notice}>
            <Text style={ui.noticeText}>
              {counts.all === 0
                ? 'No bookings yet. Add one above.'
                : 'Nothing matches. Try another word or choose All.'}
            </Text>
          </View>
        )}

        {/* Transport */}
        {showT && tList.length > 0 && sectionTitle(`✈️ Transport (${tList.length})`, filter !== 'all')}
        {showT &&
          tList.map(t => {
            const open = !!openIds[t.id];
            const warn = outside(t.departDate);
            return (
              <View key={t.id} style={ui.listCard}>
                {renderHead(
                  t,
                  `${typeOf(t.type).emoji} ${typeOf(t.type).label}`,
                  `${t.from} → ${t.to}`,
                  `${niceShort(t.departDate)} ${t.departTime}`.trim() +
                    (t.provider ? ` · ${t.provider}` : '') +
                    (warn ? ' · ⚠ outside trip' : '')
                )}
                {open ? (
                  <View>
                    {renderAddedBy(t)}
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
                    {warn ? renderWarning('Departs outside your trip dates') : null}
                    {renderWho(t)}
                    {renderButtons('transport', t, (
                      <>
                        {joinPill(t)}
                        {itineraryPill(t.departDate)}
                      </>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}

        {/* Stays */}
        {showS && sList.length > 0 && sectionTitle(`🏨 Stays (${sList.length})`, filter !== 'all')}
        {showS &&
          sList.map(h => {
            const open = !!openIds[h.id];
            const warn = outside(h.checkIn) || outside(h.checkOut);
            return (
              <View key={h.id} style={ui.listCard}>
                {renderHead(
                  h,
                  '🏨 Stay',
                  h.name,
                  `${niceShort(h.checkIn)} → ${niceShort(h.checkOut)}` +
                    (warn ? ' · ⚠ outside trip' : '')
                )}
                {open ? (
                  <View>
                    {renderAddedBy(h)}
                    <Text style={ui.sub}>
                      {nice(h.checkIn)} {h.checkInTime} check-in
                    </Text>
                    <Text style={ui.sub}>
                      {nice(h.checkOut)} {h.checkOutTime} check-out
                    </Text>
                    {h.address ? <Text style={ui.sub}>📍 {h.address}</Text> : null}
                    {h.confirmation ? <Text style={ui.sub}>Confirmation: {h.confirmation}</Text> : null}
                    {h.notes ? <LinkText style={ui.sub}>{`📝 ${h.notes}`}</LinkText> : null}
                    {warn ? renderWarning('Dates fall outside your trip') : null}
                    {renderWho(h)}
                    {renderButtons('stay', h, (
                      <>
                        {joinPill(h)}
                        {itineraryPill(h.checkIn)}
                        {directionsPill(h)}
                      </>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}

        {/* Activities and restaurants */}
        {[
          [showA, aList, '🎟️ Activities'],
          [showR, rList2, '🍽️ Restaurants'],
        ].map(([show, list, title]) =>
          show && list.length > 0 ? (
            <View key={title}>
              {sectionTitle(`${title} (${list.length})`, filter !== 'all')}
              {list.map(r => {
                const open = !!openIds[r.id];
                const day = DAYS.find(d => d.iso === r.date);
                const isRestaurant = r.kind === 'restaurant';
                return (
                  <View key={r.id} style={ui.listCard}>
                    {renderHead(
                      r,
                      isRestaurant ? '🍽️ Restaurant' : '🎟️ Activity',
                      r.name,
                      `${niceShort(r.date)} ${r.time}`.trim() +
                        (r.partySize ? ` · party of ${r.partySize}` : '') +
                        (!day ? ' · ⚠ outside trip' : '')
                    )}
                    {open ? (
                      <View>
                        {renderAddedBy(r)}
                        <Text style={ui.sub}>
                          {nice(r.date)} {r.time}
                        </Text>
                        {r.partySize ? <Text style={ui.sub}>Party of {r.partySize}</Text> : null}
                        {r.address ? <Text style={ui.sub}>📍 {r.address}</Text> : null}
                        {r.confirmation ? <Text style={ui.sub}>Confirmation: {r.confirmation}</Text> : null}
                        {r.notes ? <LinkText style={ui.sub}>{`📝 ${r.notes}`}</LinkText> : null}
                        {day ? (
                          <Text style={[ui.sub, { fontWeight: '800', color: P.ink, marginTop: 4 }]}>
                            📅 On the itinerary: Day {day.dayNumber} · {day.short} (Booked)
                          </Text>
                        ) : (
                          renderWarning('This date is outside your trip, so it is not on the itinerary')
                        )}
                        {renderWho(r)}
                        {renderButtons(r.kind, r, (
                          <>
                            {joinPill(r, "I'm in")}
                            {itineraryPill(r.date)}
                            {directionsPill(r)}
                          </>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null
        )}
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

            {/* Add other people to this booking, like when adding a spot to a day */}
            <Text style={ui.label}>Who's on this?</Text>
            <View style={ui.row}>
              {memberNames.map(name => {
                const on = joiningSel.includes(name);
                return (
                  <TouchableOpacity
                    key={name}
                    style={[
                      ui.pill,
                      ui.pillSmall,
                      on && ui.pillActive,
                      { flexDirection: 'row', alignItems: 'center' },
                    ]}
                    onPress={() => toggleSel(name)}
                  >
                    <Avatar characterId={characters[name] || profile.character || 'fox'} size={18} />
                    <Text style={[ui.pillText, ui.pillTextSmall, { marginLeft: 5 }]}>
                      {on ? '✓ ' : ''}
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={ui.hint}>
              {isPlanKind(formKind)
                ? 'It will appear on this day in the Itinerary, marked as Booked.'
                : 'Dates with a blue edge are your trip days.'}
            </Text>

            <View style={[ui.row, { marginTop: 12 }]}>
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

const styles = StyleSheet.create({
  // the four "+ Transport / + Stay ..." buttons: normal separate pills at their natural width
  // (not stretched), with a clear gap between them. If a phone is too narrow they wrap
  // onto a second row instead of being squashed.
  addRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  addPill: {
    backgroundColor: P.gold,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 5,
    marginRight: 3,
    marginVertical: 2,
  },
  addText: { color: P.ink, fontWeight: '800', fontSize: 12 },

  // count after a filter name, lighter than the label
  count: { color: P.muted, fontWeight: '700' },

  // "15 bookings · tap a card to open" + Expand all on one row
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  infoText: { flex: 1, color: P.muted, fontSize: 11 },
});