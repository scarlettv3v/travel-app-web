import React, { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { useTrip, dayCount, MAX_DAYS } from './trip';
import DatePicker, { formatDate } from './DatePicker';
import AvatarEditor from './AvatarEditor';
import { decodeLook, encodeLook } from './Avatar';

const INK = '#263a48';

export default function ProfileScreen({ authToken, profile, uid, onSaved }) {
  const trip = useTrip();
  const [section, setSection] = useState('profile'); // 'profile' | 'trip'

  // ----- profile -----
  const [name, setName] = useState(profile.name);
  const [look, setLook] = useState(decodeLook(profile.character));
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const saveProfile = async () => {
    if (!name.trim()) {
      setProfileMsg('Please enter your name.');
      return;
    }
    setProfileBusy(true);
    setProfileMsg('');
    const code = encodeLook(look);
    try {
      await firestoreFetch(
        `${FIRESTORE_BASE}/profiles/${uid}?updateMask.fieldPaths=name&updateMask.fieldPaths=character`,
        authToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              name: { stringValue: name.trim() },
              character: { stringValue: code },
            },
          }),
        }
      );
      onSaved({ name: name.trim(), character: code });
      setProfileMsg('Saved ✓');
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileMsg('Could not save your profile. Please try again.');
    } finally {
      setProfileBusy(false);
    }
  };

  // ----- trip settings -----
  const [draft, setDraft] = useState({
    name: trip.name,
    destination: trip.destination,
    latitude: trip.latitude,
    longitude: trip.longitude,
    start: trip.start,
    end: trip.end,
  });
  const [picker, setPicker] = useState(null); // 'start' | 'end'
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tripMsg, setTripMsg] = useState('');

  const searchPlace = async () => {
    if (!q.trim()) return;
    setSearching(true);
    setResults([]);
    setTripMsg('');
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=5&language=en`
      );
      const data = await res.json();
      setResults(data.results || []);
      if (!data.results?.length) setTripMsg('No places found. Try another name.');
    } catch (error) {
      setTripMsg('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const pickPlace = r => {
    const text = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
    setDraft(d => ({ ...d, destination: text, latitude: r.latitude, longitude: r.longitude }));
    setResults([]);
    setQ('');
  };

  const saveTripSettings = async () => {
    if (!draft.name.trim()) {
      setTripMsg('Give the trip a name.');
      return;
    }
    if (draft.end < draft.start) {
      setTripMsg('The end date must be on or after the start date.');
      return;
    }
    if (dayCount(draft.start, draft.end) > MAX_DAYS) {
      setTripMsg(`A trip can be at most ${MAX_DAYS} days.`);
      return;
    }
    const ok = await trip.saveTrip(draft.start, draft.end, {
      name: draft.name.trim(),
      destination: draft.destination,
      latitude: draft.latitude,
      longitude: draft.longitude,
    });
    setTripMsg(ok ? 'Saved ✓' : 'Could not save the trip. Please try again.');
  };

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ padding: 15, paddingTop: 44, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[s.tabs, { marginRight: 56 }]}>
        <TouchableOpacity
          style={[s.tab, section === 'profile' && s.tabOn]}
          onPress={() => setSection('profile')}
        >
          <Text style={s.tabText}>👤 Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, section === 'trip' && s.tabOn]}
          onPress={() => setSection('trip')}
        >
          <Text style={s.tabText}>🗺️ Trip settings</Text>
        </TouchableOpacity>
      </View>

      {section === 'profile' ? (
        <View>
          <View style={s.card}>
            <Text style={s.h2}>Your avatar</Text>
            <AvatarEditor look={look} onChange={setLook} />

            <Text style={s.label}>Your name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              maxLength={30}
              placeholder="Your name"
              placeholderTextColor="#8aa09a"
            />

            {profileMsg ? <Text style={s.msg}>{profileMsg}</Text> : null}
            <TouchableOpacity style={s.saveBtn} onPress={saveProfile} disabled={profileBusy}>
              <Text style={s.btnText}>{profileBusy ? 'Saving...' : 'Save profile'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.logout} onPress={() => signOut(auth)}>
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.h2}>Trip settings</Text>
          <Text style={s.sub}>Everyone on the trip sees these changes.</Text>

          <Text style={s.label}>Trip name</Text>
          <TextInput
            style={s.input}
            value={draft.name}
            onChangeText={t => setDraft(d => ({ ...d, name: t }))}
            maxLength={50}
          />

          <Text style={s.label}>Destination</Text>
          <Text style={s.sub}>{draft.destination}</Text>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <TextInput
              style={[s.input, { flex: 1, marginRight: 8 }]}
              placeholder="Search for a city or town"
              placeholderTextColor="#8aa09a"
              value={q}
              onChangeText={setQ}
              onSubmitEditing={searchPlace}
            />
            <TouchableOpacity style={s.pill} onPress={searchPlace} disabled={searching}>
              <Text style={s.btnText}>{searching ? '...' : 'Find'}</Text>
            </TouchableOpacity>
          </View>
          {results.map(r => (
            <TouchableOpacity key={r.id} style={s.result} onPress={() => pickPlace(r)}>
              <Text style={s.btnText}>{[r.name, r.admin1, r.country].filter(Boolean).join(', ')}</Text>
            </TouchableOpacity>
          ))}

          <Text style={s.label}>Trip start</Text>
          <TouchableOpacity style={s.input} onPress={() => setPicker('start')}>
            <Text style={s.inputText}>📅 {formatDate(draft.start)}</Text>
          </TouchableOpacity>
          <Text style={s.label}>Trip end</Text>
          <TouchableOpacity style={s.input} onPress={() => setPicker('end')}>
            <Text style={s.inputText}>📅 {formatDate(draft.end)}</Text>
          </TouchableOpacity>

          {tripMsg ? <Text style={s.msg}>{tripMsg}</Text> : null}
          <TouchableOpacity style={[s.saveBtn, { marginTop: 14 }]} onPress={saveTripSettings}>
            <Text style={s.btnText}>Save trip settings</Text>
          </TouchableOpacity>
        </View>
      )}

      <DatePicker
        visible={!!picker}
        title={picker === 'start' ? 'Trip start' : 'Trip end'}
        value={picker ? draft[picker] : ''}
        minDate={picker === 'end' ? draft.start : ''}
        onPick={iso => {
          setDraft(d => ({ ...d, [picker]: iso }));
          setPicker(null);
        }}
        onClear={() => setPicker(null)}
        onClose={() => setPicker(null)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f8ed' },
  tabs: { flexDirection: 'row', marginBottom: 14 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: '#fff',
    marginRight: 8,
    borderRadius: 999,
  },
  tabOn: { backgroundColor: '#ffe1aa' },
  tabText: { color: INK, fontWeight: '800', fontSize: 14 },
  card: {
    backgroundColor: '#fffdf6',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  h2: { color: INK, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  sub: { color: '#526873', fontSize: 14, marginTop: 2 },
  label: { color: INK, fontSize: 14, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#b6cfc3',
    borderRadius: 11,
    padding: 10,
    color: INK,
    fontSize: 15,
  },
  inputText: { color: INK, fontSize: 15 },
  msg: { color: '#395a53', fontWeight: '700', marginTop: 12 },
  saveBtn: {
    backgroundColor: '#ffd388',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  pill: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  result: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
  },
  btnText: { color: INK, fontWeight: '800', fontSize: 14 },
  logout: {
    alignSelf: 'center',
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  logoutText: { color: '#fff', fontWeight: 'bold' },
});