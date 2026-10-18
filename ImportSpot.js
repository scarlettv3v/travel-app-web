import React, { useState, useEffect, useRef } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { CATEGORIES } from './categories';
import { readTextFromImage, ocrEnabled } from './ocr';
import { openInGoogleMaps } from './maps';

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

// Turns the text into tickable lines. The best guess is ticked already.
function buildLines(text, guess) {
  const seen = new Set();
  const out = [];
  const add = (t, on) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ text: t, on });
  };

  if (guess) add(guess, true);

  text
    .split('\n')
    .map(l => l.replace(/[#@]\S+/g, '').trim())
    .filter(l => l.length >= 3 && l.length <= 60)
    .slice(0, 40)
    .forEach(l => add(l, false));

  return out;
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

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export default function ImportSpot({ visible, authToken, profile, onClose, onSaved }) {
  const cancelled = useRef(false);

  const [step, setStep] = useState('input'); // input | pick | review
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [lines, setLines] = useState([]);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (visible) {
      cancelled.current = false;
      setStep('input');
      setInput('');
      setMsg('');
      setSourceNote('');
      setLines([]);
      setItems([]);
      setBusy(false);
      setScanning(false);
    } else {
      cancelled.current = true;
    }
  }, [visible]);

  const patchItem = (key, patch) =>
    setItems(prev =>
      prev.map(it =>
        it.key === key ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it
      )
    );

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
        setMsg('No text found in that screenshot. Try a clearer one, or type the names.');
      } else {
        setInput(prev => (prev ? prev + '\n' : '') + text);
      }
    } catch (error) {
      console.error('Screenshot read failed:', error);
      setMsg('Could not read the screenshot. Try a smaller one, or type the names.');
    } finally {
      setScanning(false);
    }
  };

  // Step 1 -> reads the pasted text and either shows the tick list or goes straight to review
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
    let noteText = '';
    let found = null;
    let label = '';
    let message = '';

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
          message = 'Could not read the location from that link. Search for it below.';
        }
      } else if (url && /youtu\.be|youtube\.com/i.test(url)) {
        const info = await youtubeInfo(url);
        if (info) {
          guess = info.title.split(/[|–—-]/)[0].trim();
          noteText = `${info.title}${info.author ? ' (' + info.author + ')' : ''}`;
        } else {
          message = 'Could not read the YouTube title. Type the place name below.';
        }
      } else if (url && /instagram\.com/i.test(url) && !text) {
        message = 'Instagram links cannot be read. Choose a screenshot, or paste the caption.';
      }
    } finally {
      setBusy(false);
    }

    if (!guess) guess = guessNameFromText(text);

    const note = [noteText, source ? `Source: ${source}` : ''].filter(Boolean).join('\n');
    setSourceNote(note);

    if (found) {
      setItems([
        {
          key: 'maps-0',
          name: guess,
          note,
          category: 'spot',
          coords: found,
          label,
          results: [],
          showResults: false,
          status: 'done',
        },
      ]);
      setMsg(message);
      setStep('review');
      return;
    }

    const list = buildLines(text, guess);
    if (!list.length) {
      setMsg(message || 'Nothing readable found. Type or paste the place names.');
      return;
    }

    setLines(list);
    setMsg(message);
    setStep('pick');
  };

  const toggleLine = index =>
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, on: !l.on } : l)));

  const setAllLines = on => setLines(prev => prev.map(l => ({ ...l, on })));

  // Searches one item. "auto" picks the top match straight away.
  const searchItem = async (key, query, auto) => {
    if (!query.trim()) return;
    patchItem(key, { status: 'searching' });

    try {
      const data = await searchPlaces(query.trim());
      if (cancelled.current) return;

      patchItem(key, it => {
        const patch = {
          results: data,
          status: data.length ? 'done' : 'none',
          showResults: !auto && data.length > 0,
        };
        if (auto && !it.coords && data.length) {
          patch.coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          patch.label = data[0].display_name;
        }
        return patch;
      });
    } catch (error) {
      patchItem(key, { status: 'error' });
    }
  };

  // Step 2 -> builds a card for every ticked line, then searches them one by one
  const startSearch = async () => {
    const chosen = lines.filter(l => l.on);
    if (!chosen.length) {
      setMsg('Tick at least one line first.');
      return;
    }

    const base = Date.now();
    const fresh = chosen.map((l, i) => ({
      key: `${base}-${i}`,
      name: l.text,
      note: sourceNote,
      category: 'spot',
      coords: null,
      label: '',
      results: [],
      showResults: false,
      status: 'waiting',
    }));

    setItems(fresh);
    setMsg('');
    setStep('review');

    // The free map service allows about one search per second
    for (let i = 0; i < fresh.length; i++) {
      if (cancelled.current) return;
      await searchItem(fresh[i].key, fresh[i].name, true);
      if (i < fresh.length - 1) await wait(1100);
    }
  };

  const pickResult = (key, r) =>
    patchItem(key, {
      coords: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
      label: r.display_name,
      showResults: false,
    });

  const removeItem = key => setItems(prev => prev.filter(it => it.key !== key));

  
const confirmAll = async () => {
  const ready = items.filter(it => it.name.trim());

  if (!ready.length) {
    alert('Please enter a name for at least one spot.');
    return;
  }

  setBusy(true);

  try {
    await Promise.all(
      ready.map(it =>
        firestoreFetch(`${FIRESTORE_BASE}/spots`, authToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              name: { stringValue: it.name.trim() },
              note: { stringValue: it.note || '' },
              ...(it.coords
                ? {
                    lat: { doubleValue: it.coords.lat },
                    lng: { doubleValue: it.coords.lng },
                  }
                : {}),
              category: { stringValue: it.category },
              createdByName: { stringValue: profile.name },
              createdByCharacter: {
                stringValue: profile.character,
              },
            },
          }),
        })
      )
    );

    onSaved();

    const left = items.filter(it => !it.name.trim());

    if (left.length === 0) {
      onClose();
    } else {
      setItems(left);
      setMsg(
        `${ready.length} saved. ${left.length} still need a name.`
      );
    }
  } catch (error) {
    console.error('Error importing spots:', error);
    alert('Could not save the spots.');
  } finally {
    setBusy(false);
  }
};

  const searchingCount = items.filter(it => it.status === 'searching' || it.status === 'waiting').length;
  const readyCount = items.filter(it => it.name.trim()).length;
  const tickedCount = lines.filter(l => l.on).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
       
<ScrollView
  contentContainerStyle={{ padding: 15, paddingTop: 60, paddingBottom: 40 }}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
>

          <View style={styles.card}>
            {step === 'input' && (
              <View>
                <Text style={styles.title}>🔗 Import spots</Text>
                <Text style={styles.hint}>
                  Choose a screenshot, or paste a YouTube link, a Google Maps link, or a caption.
                  One screenshot can hold many spots, and you tick the ones you want.
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
                  style={[styles.input, { height: 130, textAlignVertical: 'top' }]}
                  placeholder="Paste link or caption here, or add a screenshot..."
                  placeholderTextColor={colors.textDim}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  autoCapitalize="none"
                />

                <Text style={styles.tip}>
                  Add several screenshots one after another, and the text is added together.
                  You can edit the text before tapping Read it.
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
            )}

            {step === 'pick' && (
              <View>
                <Text style={styles.title}>Which lines are places?</Text>
                <Text style={styles.hint}>
                  Tick every line that is a place name. Untick anything else.
                </Text>
                {msg ? <Text style={styles.warn}>{msg}</Text> : null}

                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <TouchableOpacity style={[styles.greyBtn, { marginRight: 8 }]} onPress={() => setAllLines(true)}>
                    <Text style={styles.btnText}>Tick all</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.greyBtn} onPress={() => setAllLines(false)}>
                    <Text style={styles.btnText}>Untick all</Text>
                  </TouchableOpacity>
                </View>

                {lines.map((l, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.lineRow, l.on && styles.lineRowOn]}
                    onPress={() => toggleLine(i)}
                  >
                    <Text style={styles.lineBox}>{l.on ? '☑' : '☐'}</Text>
                    <Text style={styles.lineText}>{l.text}</Text>
                  </TouchableOpacity>
                ))}

                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.greenBtn, { flex: 1, marginRight: 8 }]}
                    onPress={startSearch}
                  >
                    <Text style={styles.btnText}>Find {tickedCount} place{tickedCount === 1 ? '' : 's'}</Text>
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

            {step === 'review' && (
              <View>
                <Text style={styles.title}>Check before saving</Text>
                {searchingCount > 0 ? (
                  <Text style={styles.hint}>
                    Searching the map... {items.length - searchingCount} of {items.length} done
                  </Text>
                ) : (
                  <Text style={styles.hint}>
                    Check each spot, then save. The top map match is picked for you.
                  </Text>
                )}
                {msg ? <Text style={styles.warn}>{msg}</Text> : null}

                {items.map(it => (
                  <View key={it.key} style={styles.itemCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        value={it.name}
                        onChangeText={t => patchItem(it.key, { name: t })}
                        placeholder="Name of the place"
                        placeholderTextColor={colors.textDim}
                      />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(it.key)}>
                        <Text style={styles.btnText}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {(it.status === 'searching' || it.status === 'waiting') && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={[styles.hint, { marginLeft: 8, marginBottom: 0 }]}>
                          {it.status === 'waiting' ? 'Waiting...' : 'Searching...'}
                        </Text>
                      </View>
                    )}

                    {it.coords ? (
                      <Text style={styles.ok} numberOfLines={2}>✅ {it.label || 'Location chosen'}</Text>
                    ) : it.status === 'none' ? (
                      <Text style={styles.warn}>No map match. Edit the name and tap Search again.</Text>
                    ) : it.status === 'error' ? (
                      <Text style={styles.warn}>Search failed. Tap Search to retry.</Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                      {it.coords ? (
                        <TouchableOpacity
                          style={styles.gmapBtn}
                          onPress={() => openInGoogleMaps(it.coords.lat, it.coords.lng, it.name)}
                        >
                          <Text style={styles.smallText}>🔎 Google Maps</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => searchItem(it.key, it.name, false)}
                      >
                        <Text style={styles.smallText}>Search</Text>
                      </TouchableOpacity>
                      {it.results.length > 0 && !it.showResults ? (
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => patchItem(it.key, { showResults: true })}
                        >
                          <Text style={styles.smallText}>Other matches</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {it.showResults &&
                      it.results.map((r, i) => (
                        <View key={i} style={styles.result}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => pickResult(it.key, r)}>
                            <Text style={styles.resultTitle}>{r.display_name.split(',')[0]}</Text>
                            <Text style={styles.resultSub} numberOfLines={1}>{r.display_name}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.gmapBtn}
                            onPress={() =>
                              openInGoogleMaps(
                                parseFloat(r.lat),
                                parseFloat(r.lon),
                                r.display_name.split(',')[0]
                              )
                            }
                          >
                            <Text style={styles.smallText}>🔎</Text>
                          </TouchableOpacity>
                        </View>
                      ))}

                    <Text style={styles.label}>Category</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {CATEGORIES.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.chip, it.category === c.id && styles.chipOn]}
                          onPress={() => patchItem(it.key, { category: c.id })}
                        >
                          <Text style={styles.chipText}>{c.emoji} {c.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      style={[styles.input, { height: 60, textAlignVertical: 'top', marginTop: 4, marginBottom: 0 }]}
                      value={it.note}
                      onChangeText={t => patchItem(it.key, { note: t })}
                      multiline
                      placeholder="Notes (optional)"
                      placeholderTextColor={colors.textDim}
                    />
                  </View>
                ))}

                {items.length === 0 && (
                  <Text style={styles.hint}>No spots left. Tap Back to start again.</Text>
                )}

                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.greenBtn, { flex: 1, marginRight: 8 }]}
                    onPress={confirmAll}
                   disabled={busy || readyCount === 0 || searchingCount > 0}
                  >
                    <Text style={styles.btnText}>
                      {busy ? 'Saving...' : `Save ${readyCount} spot${readyCount === 1 ? '' : 's'}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.greyBtn, { marginRight: 8 }]}
                    onPress={() => {
                      setStep(lines.length ? 'pick' : 'input');
                    }}
                  >
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
  label: { color: colors.textMuted, fontSize: 13, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 8 },
  warn: { color: colors.highlight, fontSize: 13, marginBottom: 6, marginTop: 4 },
  ok: { color: colors.success, fontSize: 13, marginTop: 8 },
  itemCard: { backgroundColor: colors.card, padding: 10, borderRadius: 8, marginTop: 10 },
  result: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardDark, padding: 8, borderRadius: 8, marginTop: 6 },
  resultTitle: { color: colors.success, fontWeight: 'bold', fontSize: 14 },
  resultSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  chip: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: colors.input },
  chipOn: { borderColor: colors.primary, backgroundColor: '#1f3a5f' },
  chipText: { color: colors.text, fontSize: 13 },
  lineRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.input },
  lineRowOn: { borderColor: colors.success, backgroundColor: '#1d3a2c' },
  lineBox: { color: colors.text, fontSize: 18, marginRight: 10 },
  lineText: { color: colors.text, fontSize: 14, flex: 1 },
  greenBtn: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  redBtn: { backgroundColor: colors.danger, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  greyBtn: { backgroundColor: colors.input, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  photoBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  removeBtn: { backgroundColor: colors.danger, width: 40, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  smallBtn: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginRight: 8, marginBottom: 4 },
  gmapBtn: { backgroundColor: colors.googleBlue, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginRight: 8, marginBottom: 4 },
  smallText: { color: colors.text, fontSize: 12, fontWeight: 'bold' },
  btnText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
});