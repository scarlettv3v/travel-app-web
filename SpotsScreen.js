import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import Avatar from './Avatar';
import AddToDayCard from './AddToDayCard';
import AddSpotModal from './AddSpotModal';
import SpotForm from './SpotForm';
import Popup from './Popup';
import { CATEGORIES, getCategory } from './categories';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import LinkText from './LinkText';
import { openPlace } from './places';
import { ui, screenContent } from './ui';

const DB_URL = `${FIRESTORE_BASE}/spots`;

export default function SpotsScreen({ authToken, profile }) {
  const [placesList, setPlacesList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState(null);
  const [planningSpot, setPlanningSpot] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadSpots = useCallback(async () => {
    try {
      const response = await firestoreFetch(DB_URL, authToken);
      const data = await response.json();

      if (data.documents) {
        setPlacesList(
          data.documents.map(doc => ({
            id: doc.name,
            name: doc.fields.name?.stringValue || 'Unnamed Spot',
            note: doc.fields.note?.stringValue || '',
            address: doc.fields.address?.stringValue || '',
            createdByName: doc.fields.createdByName?.stringValue || '',
            createdByCharacter: doc.fields.createdByCharacter?.stringValue || '',
            category: doc.fields.category?.stringValue || 'spot',
          }))
        );
      } else {
        setPlacesList([]);
      }
    } catch (error) {
      console.error('Error loading spots:', error);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    loadSpots();
    const timer = setInterval(loadSpots, 5000);
    return () => clearInterval(timer);
  }, [authToken, loadSpots]);

  const handleDeleteSpot = async docPath => {
    try {
      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${docPath}`,
        authToken,
        { method: 'DELETE' }
      );
      await loadSpots();
    } catch (error) {
      console.error('Error deleting spot:', error);
      alert('Error deleting spot!');
    }
  };

  const handleSaveEdit = async data => {
    if (!editingSpot) return;
    setSaving(true);
    try {
      const fields = {
        name: { stringValue: data.name },
        note: { stringValue: data.note || '' },
        category: { stringValue: data.category },
        address: { stringValue: data.address || '' },
      };
      const mask = Object.keys(fields)
        .map(key => `updateMask.fieldPaths=${key}`)
        .join('&');

      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${editingSpot.id}?${mask}`,
        authToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        }
      );

      setEditingSpot(null);
      await loadSpots();
    } catch (error) {
      console.error('Error updating spot:', error);
      alert('Error updating spot!');
    } finally {
      setSaving(false);
    }
  };

  const visibleSpots = placesList.filter(
    p => filter === 'all' || (p.category || 'spot') === filter
  );

  const categoryItems = [['all', `🗂️ All (${placesList.length})`]].concat(
    CATEGORIES.map(c => [
      c.id,
      `${c.emoji} ${c.label} (${placesList.filter(p => (p.category || 'spot') === c.id).length})`,
    ])
  );

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={screenContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={ui.card}>
          <View style={{ paddingRight: 44 }}>
            <Text style={ui.kicker}>PLACES TO REMEMBER</Text>
            <Text style={ui.h2}>Spots</Text>
            <Text style={ui.sub}>Save a place with its address, then add it to a day.</Text>
          </View>

          <View style={[ui.row, { marginTop: 14 }]}>
            <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={() => setAddOpen(true)}>
              <Text style={ui.pillText}>+ Add new spot</Text>
            </TouchableOpacity>
          </View>
          <Text style={ui.hint}>Type it in, or import it from a link, caption or screenshot.</Text>
        </View>

        {/* Saved spots */}
        <View style={ui.card}>
          <Text style={ui.h3}>Saved spots</Text>
          <Text style={ui.sub}>
            Showing {visibleSpots.length} of {placesList.length}
          </Text>

          <Text style={ui.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {categoryItems.map(([id, label]) => (
              <TouchableOpacity
                key={id}
                onPress={() => setFilter(id)}
                style={[ui.pill, ui.pillSmall, filter === id && ui.pillActive]}
              >
                <Text style={[ui.pillText, ui.pillTextSmall]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {visibleSpots.length === 0 && (
            <View style={ui.notice}>
              <Text style={ui.noticeText}>
                {placesList.length
                  ? 'No spots match this filter.'
                  : 'No spots saved yet. Tap Add new spot to get started.'}
              </Text>
            </View>
          )}

          {visibleSpots.map(place => (
            <View key={place.id} style={ui.listCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={ui.tag}>
                  <Text style={ui.tagText}>
                    {getCategory(place.category).emoji} {getCategory(place.category).label}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                {place.createdByCharacter ? (
                  <Avatar characterId={place.createdByCharacter} size={30} />
                ) : null}
              </View>

              <Text style={[ui.h3, { marginTop: 8 }]}>{place.name}</Text>

              {place.address ? (
                <Text style={ui.sub}>📍 {place.address}</Text>
              ) : (
                <Text style={[ui.sub, { fontStyle: 'italic' }]}>
                  No address yet. Tap Edit to add one.
                </Text>
              )}

              {place.note ? <LinkText style={ui.sub}>{`📝 ${place.note}`}</LinkText> : null}

              {place.createdByName ? (
                <Text style={[ui.sub, { fontSize: 12 }]}>Added by {place.createdByName}</Text>
              ) : null}

              <View style={[ui.row, { marginTop: 12 }]}>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, ui.pillPrimary]}
                  onPress={() => setPlanningSpot(place)}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall]}>📅 Add to day</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall]}
                  onPress={() => openPlace({ name: place.name, address: place.address })}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall]}>Google Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall]}
                  onPress={() => setEditingSpot(place)}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, ui.pillDanger]}
                  onPress={() => handleDeleteSpot(place.id)}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall, ui.pillDangerText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add new spot: type it in / import */}
      <AddSpotModal
        visible={addOpen}
        authToken={authToken}
        profile={profile}
        onClose={() => setAddOpen(false)}
        onSaved={loadSpots}
      />

      {/* Edit a spot */}
      <Popup visible={!!editingSpot} onClose={() => setEditingSpot(null)}>
        {editingSpot ? (
          <View>
            <Text style={ui.kicker}>EDIT SPOT</Text>
            <Text style={ui.h2}>{editingSpot.name}</Text>
            <SpotForm
              key={editingSpot.id}
              initial={{
                name: editingSpot.name,
                note: editingSpot.note,
                category: editingSpot.category || 'spot',
                address: editingSpot.address || '',
              }}
              saveLabel="Update spot"
              busy={saving}
              onSave={handleSaveEdit}
              onCancel={() => setEditingSpot(null)}
            />
          </View>
        ) : null}
      </Popup>

      {/* Add a spot to a day */}
      <Popup visible={!!planningSpot} onClose={() => setPlanningSpot(null)}>
        {planningSpot ? (
          <AddToDayCard
            spot={planningSpot}
            authToken={authToken}
            profile={profile}
            onClose={() => setPlanningSpot(null)}
          />
        ) : null}
      </Popup>
    </View>
  );
}