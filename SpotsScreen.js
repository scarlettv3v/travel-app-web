import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Avatar from './Avatar';
import AddToDayCard from './AddToDayCard';
import AddSpotModal from './AddSpotModal';
import SpotForm from './SpotForm';
import Popup from './Popup';
import { CATEGORIES, getCategory } from './categories';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { pushSpotToPlans } from './linkSync';
import LinkText from './LinkText';
import { openPlace } from './places';
import { P, ui, screenContent } from './ui';

// pageSize=300 so every spot is returned (the database only sends a short first page otherwise)
const DB_URL = `${FIRESTORE_BASE}/spots?pageSize=300`;

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

      // Also update the itinerary items made from this spot, so both stay the same
      try {
        await pushSpotToPlans(
          editingSpot.id,
          editingSpot.name,
          {
            name: data.name,
            address: data.address || '',
            note: data.note || '',
            category: data.category,
          },
          authToken
        );
      } catch (syncError) {
        console.error('Error updating itinerary from spot:', syncError);
        alert('The spot was saved, but the itinerary items made from it could not be updated.');
      }

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

  // [id, emoji + label, count]. The count is shown lighter, after the label.
  const categoryItems = [['all', '🗂️ All', placesList.length]].concat(
    CATEGORIES.map(c => [
      c.id,
      `${c.emoji} ${c.label}`,
      placesList.filter(p => (p.category || 'spot') === c.id).length,
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

          <View style={[ui.row, { marginTop: 6 }]}>
            <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={() => setAddOpen(true)}>
              <Text style={ui.pillText}>+ Add new spot</Text>
            </TouchableOpacity>
          </View>
         
        </View>

        {/* Saved spots */}
        <View style={ui.card}>
          <Text style={ui.h3}>Saved spots</Text>
          <Text style={ui.sub}>
            Showing {visibleSpots.length} of {placesList.length}
          </Text>

          {/* All categories in view: the row wraps instead of scrolling sideways */}
          {/* One row: tight padding inside each pill, and no wrapping */}
<View style={{ flexDirection: 'row', flexWrap: 'nowrap', marginTop: 6 }}>
  {categoryItems.map(([id, label, count]) => (
    <TouchableOpacity
      key={id}
      onPress={() => setFilter(id)}
      style={[
        ui.pill,
        ui.pillSmall,
        { paddingHorizontal: 4, marginRight: 3, flexShrink: 1 },
        filter === id && ui.pillActive,
      ]}
    >
      <Text style={[ui.pillText, ui.pillTextSmall]} numberOfLines={1}>
        {label}
        <Text style={styles.count}> {count}</Text>
      </Text>
    </TouchableOpacity>
  ))}
</View>

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
              <View style={ui.tag}>
                <Text style={ui.tagText}>
                  {getCategory(place.category).emoji} {getCategory(place.category).label}
                </Text>
              </View>

              <Text style={[ui.h3, { marginTop: 2 }]}>{place.name}</Text>

              {place.address ? (
                <Text style={ui.sub}>📍 {place.address}</Text>
              ) : (
                <Text style={[ui.sub, { fontStyle: 'italic' }]}>
                  No address yet. Tap Edit to add one.
                </Text>
              )}

              {place.note ? <LinkText style={ui.sub}>{`📝 ${place.note}`}</LinkText> : null}

              {place.createdByName ? (
                <View style={[ui.byRow, { marginTop: 3 }]}>
                  {place.createdByCharacter ? (
                    <Avatar characterId={place.createdByCharacter} size={16} />
                  ) : null}
                  <Text style={[ui.sub, { fontSize: 10.5, marginTop: 0, marginLeft: 4 }]}>
                    Added by {place.createdByName}
                  </Text>
                </View>
              ) : null}

              {/* All four buttons on one row */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, ui.pillPrimary, styles.rowPill]}
                  onPress={() => setPlanningSpot(place)}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall, styles.rowText]} numberOfLines={1}>
                    📅 Add to day
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, styles.rowPill]}
                  onPress={() => openPlace({ name: place.name, address: place.address })}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall, styles.rowText]} numberOfLines={1}>
                    Google Maps
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, styles.rowPill]}
                  onPress={() => setEditingSpot(place)}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall, styles.rowText]} numberOfLines={1}>
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, ui.pillDanger, styles.rowPill, { marginRight: 0 }]}
                  onPress={() => handleDeleteSpot(place.id)}
                >
                  <Text
                    style={[ui.pillText, ui.pillTextSmall, ui.pillDangerText, styles.rowText]}
                    numberOfLines={1}
                  >
                    Delete
                  </Text>
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
            <Text style={ui.hint}>
              Changes also update this spot on the days you added it to in the Itinerary.
            </Text>
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

const styles = StyleSheet.create({
  // the count after a category name, lighter than the label
  count: { color: P.muted, fontWeight: '700' },
  // one row, no wrapping. Pills shrink a little (and clip with ...) rather than drop to a new line
  btnRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', marginTop: 6 },
  rowPill: { flexShrink: 1, marginBottom: 0, paddingHorizontal: 6 },
  rowText: { fontSize: 11 },
});