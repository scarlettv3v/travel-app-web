import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import Popup from './Popup';
import { searchPlaces, openPlace } from './places';
import { P, ui } from './ui';

let MapView, Marker;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

// A small map showing where the chosen match is, so you can check it
function Preview({ place }) {
  if (!place) return null;

  if (Platform.OS === 'web') {
    const d = 0.004;
    const src =
      `https://www.openstreetmap.org/export/embed.html?bbox=` +
      `${place.lng - d * 1.6},${place.lat - d},${place.lng + d * 1.6},${place.lat + d}` +
      `&layer=mapnik&marker=${place.lat},${place.lng}`;
    return (
      <View style={styles.preview}>
        {React.createElement('iframe', {
          src,
          title: 'Map preview',
          style: { border: 0, width: '100%', height: '100%' },
        })}
      </View>
    );
  }

  if (!MapView) return null;
  return (
    <View style={styles.preview}>
      <MapView
        key={`${place.lat},${place.lng}`}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: place.lat,
          longitude: place.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker coordinate={{ latitude: place.lat, longitude: place.lng }} />
      </MapView>
    </View>
  );
}

// "Find on map": shows the matches for an address with a map, so you can check and choose.
// onPick receives { lat, lng, address, name }.
export default function AddressCheckModal({ visible, initialQuery, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async q => {
    if (!q.trim()) {
      setMsg('Type an address to look for.');
      return;
    }
    setBusy(true);
    setMsg('');
    setResults([]);
    const found = await searchPlaces(q.trim());
    setBusy(false);
    if (found === null) {
      setMsg('Search is unavailable right now. Check your connection and try again.');
    } else if (!found.length) {
      setMsg('No match found. Try adding the suburb, town or postcode.');
    } else {
      setResults(found);
      setFocus(0);
    }
  };

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery || '');
      setResults([]);
      setMsg('');
      if ((initialQuery || '').trim()) run(initialQuery);
    }
  }, [visible]);

  return (
    <Popup visible={visible} onClose={onClose}>
      <Text style={ui.kicker}>CHECK THE ADDRESS</Text>
      <Text style={ui.h2}>Find on map</Text>
      <Text style={ui.sub}>
        Check the pin, then choose the right match. It also fills in the address.
      </Text>

      <Text style={ui.label}>Address</Text>
      <TextInput
        style={ui.field}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => run(query)}
        placeholder="Street, town..."
        placeholderTextColor="#8a9ca6"
        returnKeyType="search"
      />
      <View style={[ui.row, { marginTop: 10 }]}>
        <TouchableOpacity style={[ui.pill, ui.pillSmall]} onPress={() => run(query)}>
          <Text style={[ui.pillText, ui.pillTextSmall]}>Search</Text>
        </TouchableOpacity>
      </View>

      {busy ? <ActivityIndicator color={P.ink} style={{ marginTop: 8 }} /> : null}

      {msg ? (
        <View style={[ui.notice, ui.noticeWarn]}>
          <Text style={ui.noticeText}>{msg}</Text>
        </View>
      ) : null}

      {results.length > 0 ? <Preview place={results[focus]} /> : null}

      {results.map((r, i) => (
        <TouchableOpacity
          key={i}
          activeOpacity={0.85}
          style={[ui.listCard, i === focus && { borderColor: P.ink }]}
          onPress={() => setFocus(i)}
        >
          <Text style={ui.strong}>
            {i === focus ? '📍 ' : ''}
            {r.name}
          </Text>
          <Text style={[ui.sub, { fontSize: 12 }]}>{r.address}</Text>
          <View style={[ui.row, { marginTop: 10 }]}>
            <TouchableOpacity
              style={[ui.pill, ui.pillSmall]}
              onPress={() => openPlace({ name: r.name, address: r.address, lat: r.lat, lng: r.lng })}
            >
              <Text style={[ui.pillText, ui.pillTextSmall]}>🔎 Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ui.pill, ui.pillSmall, ui.pillPrimary]}
              onPress={() => {
                onPick(r);
                onClose();
              }}
            >
              <Text style={[ui.pillText, ui.pillTextSmall]}>Use this location</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}

      <View style={[ui.row, { marginTop: 16 }]}>
        <TouchableOpacity style={ui.pill} onPress={onClose}>
          <Text style={ui.pillText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Popup>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 200,
    marginTop: 14,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 17,
    overflow: 'hidden',
  },
});