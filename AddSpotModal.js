import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import Popup from './Popup';
import SpotForm from './SpotForm';
import ImportSpot from './ImportSpot';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { ui } from './ui';

const TABS = [
  ['own', '✍️ Type it in'],
  ['import', '🔗 Import'],
];

// One popup for adding a spot: type the details yourself, or import from a link / caption / screenshot.
export default function AddSpotModal({ visible, authToken, profile, onClose, onSaved }) {
  const [mode, setMode] = useState('own');
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (visible) {
      setMode('own');
      setSaving(false);
      setFormKey(k => k + 1);
    }
  }, [visible]);

  const saveSpot = async data => {
    setSaving(true);
    try {
      await firestoreFetch(`${FIRESTORE_BASE}/spots`, authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: data.name },
            note: { stringValue: data.note || '' },
            category: { stringValue: data.category },
            address: { stringValue: data.address || '' },
            createdByName: { stringValue: profile.name },
            createdByCharacter: { stringValue: profile.character },
          },
        }),
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving spot:', error);
      alert('Could not save the spot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popup visible={visible} onClose={onClose} wide>
      <Text style={ui.kicker}>ADD A NEW SPOT</Text>
      <Text style={ui.h2}>Add new spot</Text>

      <View style={[ui.row, { marginTop: 12 }]}>
        {TABS.map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[ui.pill, ui.pillSmall, mode === id && ui.pillActive]}
            onPress={() => setMode(id)}
          >
            <Text style={[ui.pillText, ui.pillTextSmall]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'own' && (
        <SpotForm
          key={formKey}
          saveLabel="Save spot"
          busy={saving}
          onSave={saveSpot}
          onCancel={onClose}
        />
      )}

      {mode === 'import' && (
        <View style={{ marginTop: 6 }}>
          <ImportSpot
            visible={visible && mode === 'import'}
            authToken={authToken}
            profile={profile}
            onClose={onClose}
            onSaved={onSaved}
          />
        </View>
      )}
    </Popup>
  );
}