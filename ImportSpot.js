import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { CATEGORIES } from './categories';
import * as ImagePicker from 'expo-image-picker';
import { readTextFromImage, ocrEnabled } from './ocr';

const URL_RE = /https?:\/\/[^\s]+/i;

function parseMapsUrl(url) {
  const m =
    url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
    url.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/);
  const coords = m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;

  const p = url.match(/\/place\/([^/@?]+)/);
  let name = '';
  if (p) {
    try {
      name = decodeURIComponent(p[1].replace(/\+/g, ' '));
    } catch (e) {
      name = p[1].replace(/\+/g, ' ');
    }
  }
  return { coords, name };
}

function guessNameFromText(text) {
  if (!text) return '';
  const pin = text.match(/📍\s*([^\n#@]+)/);
  let line = pin ? pin[1] : text.split('\n').find(l => l.trim()) || '';
  line = line
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[#@]\S+/g, '')
    .trim();
  return line.slice(0, 60);
}

async function youtubeInfo(url) {
  const tries = [
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
  ];
  for (const t of tries) {
    try {
      const r = await fetch(t);
      if (!r.ok) continue;
      const d = await r.json();
      if (d.title) return { title: d.title, author: d.author_name || '' };
    } catch (e) {
      // try the next one
    }
  }
  return null;
}

async function searchPlaces(query) {
  const q = /new zealand|\bnz\b/i.test(query) ? query : `${query}, New Zealand`;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`
  );
  return res.json();
}

export default function ImportSpot({ visible, authToken, profile, onClose, onSaved }) {
  const [step, setStep] = useState('input'); // input | preview
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('spot');
  const [coords, setCoords] = useState(null);
  const [coordsLabel, setCoordsLabel] = useState('');
  const [results, setResults] = useState([]);
    const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('input');
      setInput('');
      setMsg('');
      setName('');
      setNotes('');
      setCategory('spot');
      setCoords(null);
      setCoordsLabel('');
      setResults([]);
    }
  }, [visible]);

  const runSearch = async query => {
    if (!query.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const data = await searchPlaces(query.trim());
      setResults(data);
      if (!data.length) setMsg('No map results. Try a shorter name or add the town.');
    } catch (error) {
      setMsg('Search failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  const pickScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.4,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      setScanning(true);
      setMsg('');

      const text = await readTextFromImage(asset.base64, asset.mimeType || 'image/jpeg');
      if (!text) {
        setMsg('No text found in that screenshot. Try a clearer one, or type the name.');
      } else {
        setInput(prev => (prev ? prev + '\n' : '') + text);
      }
    } catch (error) {
      console.error('Screenshot read failed:', error);
      setMsg('Could not read the screenshot. Try a smaller one, or type the name.');
    } finally {
      setScanning(false);
    }
  };
  const read = async () => {
    const raw = input.trim();
    if (!raw) return;

    setBusy(true);
    setMsg('');

    const urlMatch = raw.match(URL_RE);
    const source = urlMatch ? urlMatch[0] : '';
    let url = source;
    const text = raw.replace(URL_RE, '').trim();

    let guess = '';
    let noteText = text.slice(0, 300);
    let found = null;
    let label = '';

    try {
      if (url && /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) {
        try {
          const r = await fetch(url);
          if (r.url) url = r.url;
        } catch (e) {
          // short link could not be opened (common on web)
        }
      }

      if (url && /google\.[a-z.]+\/maps|maps\.google/i.test(url)) {
        const parsed = parseMapsUrl(url);
        guess = parsed.name;
        if (parsed.coords) {
          found = parsed.coords;
          label = 'Location from your Google Maps link';
        } else {
          setMsg('Could not read the location from that link. Search for it below.');
        }
      } else if (url && /youtu\.be|youtube\.com/i.test(url)) {
        const info = await youtubeInfo(url);
        if (info) {
          guess = info.title.split(/[|–—-]/)[0].trim();
          noteText = `${info.title}${info.author ? ' (' + info.author + ')' : ''}`;
        } else {
          setMsg('Could not read the YouTube title. Type the place name below.');
        }
      } else if (url && /instagram\.com/i.test(url) && !text) {
        setMsg('Instagram links cannot be read. Type the place name, or paste the caption with the link.');
      }

      if (!guess) guess = guessNameFromText(text);
    } finally {
      setBusy(false);
    }

    setName(guess);
    setNotes([noteText, source ? `Source: ${source}` : ''].filter(Boolean).join('\n'));
    setCoords(found);
    setCoordsLabel(label);
    setResults([]);
    setStep('preview');

    if (!found && guess) runSearch(guess);
  };

  const pickResult = item => {
    setCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setCoordsLabel(item.display_name);
    setResults([]);
  };

  const confirm = async () => {
    if (!name.trim()) {
      alert('Please enter a name for the spot.');
      return;
    }
    if (!coords) {
      alert('Please pick a location from the search results first.');
      return;
    }

    setBusy(true);
    try {
      await firestoreFetch(`${FIRESTORE_BASE}/spots`, authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: name.trim() },
            note: { stringValue: notes },
            lat: { doubleValue: coords.lat },
            lng: { doubleValue: coords.lng },
            category: { stringValue: category },
            createdByName: { stringValue: profile.name },
            createdByCharacter: { stringValue: profile.character },
          },
        }),
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error importing spot:', error);
      alert('Could not save the spot.');
      setBusy(false);
    }
  };

  const lines = input
    .replace(URL_RE, '')
    .split('\n')
    .map(l => l.replace(/[#@]\S+/g, '').trim())
    .filter(l => l.length >= 3 && l.length <= 60)
    .slice(0, 12);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={{ padding: 15, paddingTop: 60, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {step === 'input' ? (
              <View>
                <Text style={styles.title}>🔗 Import a spot</Text>
                <Text style={styles.hint}>
                  Paste a YouTube link, a Google Maps link, or an Instagram caption (with or
                  without the link). You can check everything before it is saved.
                </Text>
                {ocrEnabled ? (
                  <TouchableOpacity style={styles.photoBtn} onPress={pickScreenshot} disabled={scanning}>
                    <Text style={styles.btnText}>
                      {scanning ? 'Reading screenshot...' : '📷 Choose a screenshot'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {msg ? <Text style={styles.warn}>{msg}</Text> : null}
                <TextInput
                  style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                  placeholder="Paste link or caption here..."
                  placeholderTextColor={colors.textDim}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  autoCapitalize="none"
                />

                <Text style={styles.tip}>
                  Instagram tip: open the post, tap ••• then Copy link, and also copy the
                  caption if your app allows it. If not, just type the place name.
                </Text>

                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.greenBtn, { flex: 1, marginRight: 8 }]}
                    onPress={read}
                    disabled={busy}
                  >
                    <Text style={styles.btnText}>{busy ? 'Reading...' : 'Read it'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.redBtn} onPress={onClose}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.title}>Check before saving</Text>
                {msg ? <Text style={styles.warn}>{msg}</Text> : null}

                <Text style={styles.label}>Place name</Text>
                <View style={{ flexDirection: 'row' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Name of the place"
                    placeholderTextColor={colors.textDim}
                    onSubmitEditing={() => runSearch(name)}
                  />
                  <TouchableOpacity style={styles.searchBtn} onPress={() => runSearch(name)}>
                    <Text style={styles.btnText}>Search</Text>
                  </TouchableOpacity>
                </View>

                {busy && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
                {lines.length > 0 && (
                  <View>
                    <Text style={styles.label}>Tap a line to use it as the name</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {lines.map((l, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.chip}
                          onPress={() => {
                            setName(l);
                            runSearch(l);
                          }}
                        >
                          <Text style={styles.chipText} numberOfLines={1}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {results.map((item, i) => (
                  <TouchableOpacity key={i} style={styles.result} onPress={() => pickResult(item)}>
                    <Text style={styles.resultTitle}>{item.display_name.split(',')[0]}</Text>
                    <Text style={styles.resultSub} numberOfLines={1}>{item.display_name}</Text>
                  </TouchableOpacity>
                ))}

                <Text style={styles.label}>Location</Text>
                {coords ? (
                  <Text style={styles.ok}>
                    ✅ {coordsLabel || 'Location chosen'}
                  </Text>
                ) : (
                  <Text style={styles.warn}>
                    Not chosen yet. Tap Search, then pick a result.
                  </Text>
                )}

                <Text style={styles.label}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, category === c.id && styles.chipOn]}
                      onPress={() => setCategory(c.id)}
                    >
                      <Text style={styles.chipText}>{c.emoji} {c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Notes"
                  placeholderTextColor={colors.textDim}
                />

                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <TouchableOpacity
                    style={[styles.greenBtn, { flex: 1, marginRight: 8 }]}
                    onPress={confirm}
                    disabled={busy}
                  >
                    <Text style={styles.btnText}>Confirm & save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.greyBtn, { marginRight: 8 }]} onPress={() => setStep('input')}>
                    <Text style={styles.btnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.redBtn} onPress={onClose}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  card: { backgroundColor: colors.cardDark, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.primary },
  title: { color: colors.primary, fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: 10 },
  tip: { color: colors.textDim, fontSize: 12 },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 8 },
  warn: { color: colors.highlight, fontSize: 13, marginBottom: 4 },
  ok: { color: colors.success, fontSize: 13 },
  result: { backgroundColor: colors.card, padding: 10, borderRadius: 8, marginTop: 6 },
  resultTitle: { color: colors.success, fontWeight: 'bold', fontSize: 14 },
  resultSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  chip: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: colors.input },
  chipOn: { borderColor: colors.primary, backgroundColor: '#1f3a5f' },
  chipText: { color: colors.text, fontSize: 13 },
  greenBtn: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  redBtn: { backgroundColor: colors.danger, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  greyBtn: { backgroundColor: colors.input, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  btnText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
    photoBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
});