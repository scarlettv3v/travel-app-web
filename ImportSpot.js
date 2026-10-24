import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { CATEGORIES } from './categories';
import { readTextFromImage, ocrEnabled } from './ocr';
import { openPlace } from './places';
import { P, ui } from './ui';

const URL_RE = /https?:\/\/[^\s]+/i;
const MAPS_LINK_RE = /google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps/i;

// The place name inside a long Google Maps link (…/place/Some+Name/…)
function placeNameFromUrl(url) {
  const p = url.match(/\/place\/([^/@?]+)/);
  if (!p) return '';
  try {
    return decodeURIComponent(p[1].replace(/\+/g, ' '));
  } catch (e) {
    return p[1].replace(/\+/g, ' ');
  }
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

// Sits inside the "Add new spot" popup, so there is no popup frame here.
export default function ImportSpot({ visible, authToken, profile, onClose, onSaved }) {
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
      setStep('input');
      setInput('');
      setMsg('');
      setSourceNote('');
      setLines([]);
      setItems([]);
      setBusy(false);
      setScanning(false);
    }
  }, [visible]);

  const patchItem = (key, patch) =>
    setItems(prev => prev.map(it => (it.key === key ? { ...it, ...patch } : it)));

  const newItem = (key, name, note) => ({
    key,
    name,
    note,
    address: '',
    category: 'spot',
  });

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

  // Step 1 -> reads the pasted text and shows the tick list (or goes straight to review)
  const read = async () => {
    const raw = input.trim();
    if (!raw) return;

    setBusy(true);
    setMsg('');

    const urlMatch = raw.match(URL_RE);
    const source = urlMatch ? urlMatch[0] : '';
    const text = raw.replace(URL_RE, '').trim();

    let guess = '';
    let noteText = '';
    let message = '';
    const isMapsLink = !!source && MAPS_LINK_RE.test(source);

    try {
      if (isMapsLink) {
        guess = placeNameFromUrl(source);
        if (!guess) {
          message = 'Could not read a place name from that link. Type the name below.';
        }
      } else if (source && /youtu\.be|youtube\.com/i.test(source)) {
        const info = await youtubeInfo(source);
        if (info) {
          guess = info.title.split(/[|–—-]/)[0].trim();
          noteText = `${info.title}${info.author ? ' (' + info.author + ')' : ''}`;
        } else {
          message = 'Could not read the YouTube title. Type the place name below.';
        }
      } else if (source && /instagram\.com/i.test(source) && !text) {
        message = 'Instagram links cannot be read. Choose a screenshot, or paste the caption.';
      }
    } finally {
      setBusy(false);
    }

    if (!guess) guess = guessNameFromText(text);

    const note = [noteText, source ? `Source: ${source}` : ''].filter(Boolean).join('\n');
    setSourceNote(note);

    // a Google Maps link with a place name: go straight to the check step
    if (isMapsLink && guess) {
      setItems([newItem('maps-0', guess, note)]);
      setMsg('');
      setStep('review');
      return;
    }

    const list = buildLines(text, guess);
    if (!list.length) {
      if (source) {
        // nothing readable, but keep the link: let them type the name
        setItems([newItem('link-0', '', note)]);
        setMsg(message || 'Type the place name below.');
        setStep('review');
        return;
      }
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

  // Step 2 -> one card for every ticked line
  const goReview = () => {
    const chosen = lines.filter(l => l.on);
    if (!chosen.length) {
      setMsg('Tick at least one line first.');
      return;
    }
    const base = Date.now();
    setItems(chosen.map((l, i) => newItem(`${base}-${i}`, l.text, sourceNote)));
    setMsg('');
    setStep('review');
  };

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
                address: { stringValue: (it.address || '').trim() },
                category: { stringValue: it.category },
                createdByName: { stringValue: profile.name },
                createdByCharacter: { stringValue: profile.character },
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
        setMsg(`${ready.length} saved. ${left.length} still need a name.`);
      }
    } catch (error) {
      console.error('Error importing spots:', error);
      alert('Could not save the spots.');
    } finally {
      setBusy(false);
    }
  };

  const readyCount = items.filter(it => it.name.trim()).length;
  const tickedCount = lines.filter(l => l.on).length;

  const warning = text => (
    <View style={[ui.notice, ui.noticeWarn]}>
      <Text style={ui.noticeText}>{text}</Text>
    </View>
  );

  const smallPill = (label, onPress) => (
    <TouchableOpacity style={[ui.pill, ui.pillSmall]} onPress={onPress}>
      <Text style={[ui.pillText, ui.pillTextSmall]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      {step === 'input' && (
        <View>
          <Text style={ui.h3}>Import from link / caption</Text>
          <Text style={ui.sub}>
            Choose a screenshot, or paste a YouTube link, a Google Maps link, or a caption. One
            screenshot can hold many spots, and you tick the ones you want.
          </Text>

          {ocrEnabled ? (
            <View style={[ui.row, { marginTop: 14 }]}>
              <TouchableOpacity
                style={[ui.pill, ui.pillPrimary, scanning && styles.dim]}
                onPress={pickScreenshot}
                disabled={scanning}
              >
                <Text style={ui.pillText}>
                  {scanning ? 'Reading screenshot...' : '📷 Choose a screenshot'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {msg ? warning(msg) : null}

          <Text style={ui.label}>Link or caption</Text>
          <TextInput
            style={[ui.field, { height: 130, textAlignVertical: 'top' }]}
            placeholder="Paste link or caption here, or add a screenshot..."
            placeholderTextColor="#8a9ca6"
            value={input}
            onChangeText={setInput}
            multiline
            autoCapitalize="none"
          />

          <Text style={ui.hint}>
            Add several screenshots one after another, and the text is added together. You can edit
            the text before tapping Read it.
          </Text>

          <View style={[ui.row, { marginTop: 14 }]}>
            <TouchableOpacity
              style={[ui.pill, ui.pillPrimary, busy && styles.dim]}
              onPress={read}
              disabled={busy}
            >
              <Text style={ui.pillText}>{busy ? 'Reading...' : 'Read it'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.pill} onPress={onClose}>
              <Text style={ui.pillText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'pick' && (
        <View>
          <Text style={ui.kicker}>STEP 2</Text>
          <Text style={ui.h2}>Which lines are places?</Text>
          <Text style={ui.sub}>Tick every line that is a place name. Untick anything else.</Text>
          {msg ? warning(msg) : null}

          <View style={[ui.row, { marginTop: 12 }]}>
            {smallPill('Tick all', () => setAllLines(true))}
            {smallPill('Untick all', () => setAllLines(false))}
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

          <View style={[ui.row, { marginTop: 14 }]}>
            <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={goReview}>
              <Text style={ui.pillText}>
                Continue with {tickedCount} place{tickedCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.pill} onPress={() => setStep('input')}>
              <Text style={ui.pillText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.pill} onPress={onClose}>
              <Text style={ui.pillText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'review' && (
        <View>
          <Text style={ui.kicker}>STEP 3</Text>
          <Text style={ui.h2}>Check before saving</Text>
          <Text style={ui.sub}>
            Check each spot and add its address if you have it. Tip: look it up in Google Maps,
            copy the address, and paste it in.
          </Text>
          {msg ? warning(msg) : null}

          {items.map(it => (
            <View key={it.key} style={ui.listCard}>
              <Text style={[ui.label, { marginTop: 0 }]}>Place name</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[ui.field, { flex: 1 }]}
                  value={it.name}
                  onChangeText={t => patchItem(it.key, { name: t })}
                  placeholder="Name of the place"
                  placeholderTextColor="#8a9ca6"
                />
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, ui.pillDanger, styles.removeBtn]}
                  onPress={() => removeItem(it.key)}
                >
                  <Text style={[ui.pillText, ui.pillDangerText]}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={ui.label}>Address</Text>
              <TextInput
                style={[ui.field, { minHeight: 56, textAlignVertical: 'top' }]}
                value={it.address}
                onChangeText={t => patchItem(it.key, { address: t })}
                placeholder="Paste the address (optional)"
                placeholderTextColor="#8a9ca6"
                multiline
              />
              <View style={[ui.row, { marginTop: 10 }]}>
                {smallPill('🔎 Look it up in Google Maps', () =>
                  openPlace({ name: it.name, address: it.address })
                )}
              </View>

              <Text style={ui.label}>Category</Text>
              <View style={ui.row}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[ui.pill, ui.pillSmall, it.category === c.id && ui.pillActive]}
                    onPress={() => patchItem(it.key, { category: c.id })}
                  >
                    <Text style={[ui.pillText, ui.pillTextSmall]}>
                      {c.emoji} {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={ui.label}>Notes</Text>
              <TextInput
                style={[ui.field, { minHeight: 64, textAlignVertical: 'top' }]}
                value={it.note}
                onChangeText={t => patchItem(it.key, { note: t })}
                multiline
                placeholder="Notes (optional)"
                placeholderTextColor="#8a9ca6"
              />
            </View>
          ))}

          {items.length === 0 && (
            <View style={ui.notice}>
              <Text style={ui.noticeText}>No spots left. Tap Back to start again.</Text>
            </View>
          )}

          <View style={[ui.row, { marginTop: 16 }]}>
            <TouchableOpacity
              style={[ui.pill, ui.pillPrimary, (busy || readyCount === 0) && styles.dim]}
              onPress={confirmAll}
              disabled={busy || readyCount === 0}
            >
              <Text style={ui.pillText}>
                {busy ? 'Saving...' : `Save ${readyCount} spot${readyCount === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ui.pill}
              onPress={() => {
                setStep(lines.length ? 'pick' : 'input');
              }}
            >
              <Text style={ui.pillText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.pill} onPress={onClose}>
              <Text style={ui.pillText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.5 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 11,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: P.fieldBorder,
  },
  lineRowOn: { borderColor: P.ink, backgroundColor: P.mint },
  lineBox: { color: P.ink, fontSize: 18, marginRight: 10 },
  lineText: { color: P.ink, fontSize: 14, flex: 1 },
  removeBtn: { marginLeft: 8, marginRight: 0, marginBottom: 0 },
});