import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import { colors } from './theme';
import Avatar from './Avatar';
import AddToDayCard from './AddToDayCard';
import { openInGoogleMaps } from './maps';
import { CATEGORIES, getCategory } from './categories';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import { DAYS } from './trip';

let MapView, Marker;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

const DB_URL = `${FIRESTORE_BASE}/spots`;

const DEFAULT_REGION = {
  latitude: -43.8826,
  longitude: 170.4789,
  latitudeDelta: 3.5,
  longitudeDelta: 3.5,
};
function CategoryPicker({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
      {CATEGORIES.map(c => (
        <TouchableOpacity
          key={c.id}
          onPress={() => onChange(c.id)}
          style={[styles.catChip, value === c.id && styles.catChipOn]}
        >
          <Text style={styles.catText}>
            {c.emoji} {c.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
export default function SpotsScreen({ authToken, profile }) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeNote, setPlaceNote] = useState('');
  const [placesList, setPlacesList] = useState([]);

  const [editingSpot, setEditingSpot] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [placeCategory, setPlaceCategory] = useState('spot');
  const [editCategory, setEditCategory] = useState('spot');
    const [planningSpot, setPlanningSpot] = useState(null);
      const [filter, setFilter] = useState('all');
        const [plans, setPlans] = useState([]);
  const [planFilter, setPlanFilter] = useState('any');
  const loadSpots = useCallback(async () => {
    try {
      const response = await firestoreFetch(DB_URL, authToken);
      const data = await response.json();

      if (data.documents) {
        const loadedSpots = data.documents.map(doc => ({
          id: doc.name,
          name: doc.fields.name?.stringValue || 'Unnamed Spot',
          note: doc.fields.note?.stringValue || '',
          lat: doc.fields.lat
            ? parseFloat(
                doc.fields.lat.doubleValue || doc.fields.lat.integerValue
              )
            : null,
          lng: doc.fields.lng
            ? parseFloat(
                doc.fields.lng.doubleValue || doc.fields.lng.integerValue
              )
            : null,
                      createdByName: doc.fields.createdByName?.stringValue || '',
          createdByCharacter: doc.fields.createdByCharacter?.stringValue || '',
                 category: doc.fields.category?.stringValue || 'spot',
        }));

        setPlacesList(loadedSpots);
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

    useEffect(() => {
    if (!authToken) return;

    const loadPlans = async () => {
      try {
        const res = await firestoreFetch(`${FIRESTORE_BASE}/plans?pageSize=300`, authToken);
        const data = await res.json();
        setPlans(
          (data.documents || []).map(doc => ({
            spotName: doc.fields?.spotName?.stringValue || '',
            date: doc.fields?.date?.stringValue || '',
            lat: Number(doc.fields?.lat?.doubleValue ?? doc.fields?.lat?.integerValue ?? 0),
            lng: Number(doc.fields?.lng?.doubleValue ?? doc.fields?.lng?.integerValue ?? 0),
          }))
        );
      } catch (error) {
        console.error('Error loading plans:', error);
      }
    };

    loadPlans();
    const timer = setInterval(loadPlans, 5000);
    return () => clearInterval(timer);
  }, [authToken]);

     const handleGetDirections = (lat, lng, name) => openInGoogleMaps(lat, lng, name);

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

  const handleStartEdit = spot => {
    setEditCategory(spot.category || 'spot');
    setEditingSpot(spot);
    setEditName(spot.name);
    setEditNote(spot.note);
    setSelectedPlace(null);
  };

    const handleSaveEdit = async () => {
    if (!editingSpot || !editName.trim()) return;

    try {
      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${editingSpot.id}?updateMask.fieldPaths=name&updateMask.fieldPaths=note&updateMask.fieldPaths=category`,
        authToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
            category: { stringValue: editCategory },
              name: { stringValue: editName.trim() },
              note: { stringValue: editNote },
            },
          }),
        }
      );

      setEditingSpot(null);
      await loadSpots();
    } catch (error) {
      console.error('Error updating spot:', error);
      alert('Error updating spot!');
    }
  };

  const handleFocusSpot = spot => {
    if (spot.lat && spot.lng) {
      setRegion({
        latitude: spot.lat,
        longitude: spot.lng,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const query =
        searchQuery.toLowerCase().includes('new zealand') ||
        searchQuery.toLowerCase().includes('nz')
          ? searchQuery
          : `${searchQuery}, New Zealand`;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`
      );
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      alert('Error searching location!');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = item => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const shortName = item.display_name.split(',')[0];

    setSelectedPlace({
      name: shortName,
      fullName: item.display_name,
      lat: lat,
      lng: lng,
    });

    setRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    });

    setSearchResults([]);
    setSearchQuery('');
    setEditingSpot(null);
  };

  const handleSaveNew = async () => {
    if (!selectedPlace) return;

    try {
      await firestoreFetch(DB_URL, authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: selectedPlace.name },
            note: { stringValue: placeNote },
            lat: { doubleValue: selectedPlace.lat },
            lng: { doubleValue: selectedPlace.lng },
                        createdByName: { stringValue: profile.name },
            createdByCharacter: { stringValue: profile.character },
                        category: { stringValue: placeCategory },
          },
        }),
      });

      setSelectedPlace(null);
      setPlaceNote('');
            setPlaceCategory('spot');
      await loadSpots();
    } catch (error) {
      console.error('Error saving spot:', error);
      alert('Error saving spot!');
    }
  };
    const daysFor = spot =>
    plans
      .filter(
        p =>
          p.spotName === spot.name &&
          Math.abs(p.lat - (spot.lat || 0)) < 0.0001 &&
          Math.abs(p.lng - (spot.lng || 0)) < 0.0001
      )
      .map(p => DAYS.find(d => d.iso === p.date))
      .filter(Boolean);

  const visibleSpots = placesList
    .filter(p => filter === 'all' || (p.category || 'spot') === filter)
    .filter(p => {
      if (planFilter === 'any') return true;
      const planned = daysFor(p).length > 0;
      return planFilter === 'planned' ? planned : !planned;
    });

  const handleFitAll = () => {
    const pts = visibleSpots.filter(s => s.lat && s.lng);
    if (!pts.length) return;
    const lats = pts.map(s => s.lat);
    const lngs = pts.map(s => s.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    setRegion({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.05),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.05),
    });
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🇳🇿 NZ Route Planner</Text>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search NZ location (e.g., Lake Tekapo)..."
            placeholderTextColor={colors.textDim}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.buttonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {isSearching && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
        )}

        {searchResults.length > 0 && (
          <ScrollView style={styles.searchResultsContainer}>
            {searchResults.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.searchResultItem}
                onPress={() => handleSelectSearchResult(item)}
              >
                <Text style={styles.resultTitle}>
                  {item.display_name.split(',')[0]}
                </Text>
                <Text style={styles.resultSubtitle} numberOfLines={1}>
                  {item.display_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {[
            ['any', 'Any'],
            ['planned', '📅 Planned'],
            ['unplanned', '⏳ Not planned'],
          ].map(([id, label]) => (
            <TouchableOpacity
              key={id}
              onPress={() => setPlanFilter(id)}
              style={[styles.catChip, planFilter === id && styles.catChipOn]}
            >
              <Text style={styles.catText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      {/* Interactive Map */}
      <View style={styles.mapContainer}>
        {Platform.OS !== 'web' && MapView ? (
          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
          >
            {visibleSpots.map((spot, index) =>
              spot.lat && spot.lng ? (
                <Marker
                  key={index}
                  coordinate={{ latitude: spot.lat, longitude: spot.lng }}
                  title={spot.name}
                  description={spot.note}
                  pinColor={colors.danger}
                />
              ) : null
            )}

            {selectedPlace && (
              <Marker
                coordinate={{
                  latitude: selectedPlace.lat,
                  longitude: selectedPlace.lng,
                }}
                title={selectedPlace.name}
                pinColor={colors.success}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.webMapFallback}>
            <Text style={styles.webMapText}>🗺️ Live Location Map</Text>
            <Text style={styles.webMapSubtext}>
              Switch to iOS/Android tab to see live map movements and search pins
            </Text>
          </View>
        )}
      </View>

      {/* Form / Saved List Section */}
      <View style={styles.listSection}>
        {selectedPlace && (
          <View style={styles.saveCard}>
            <Text style={styles.selectedTitle}>📍 Add: {selectedPlace.name}</Text>
              <CategoryPicker value={placeCategory} onChange={setPlaceCategory} />
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Notes (e.g. Camera settings, gear...)"
              placeholderTextColor={colors.textDim}
              value={placeNote}
              onChangeText={setPlaceNote}
              multiline={true}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.saveButton, { flex: 1, marginRight: 5 }]}
                onPress={handleSaveNew}
              >
                <Text style={styles.buttonText}>Save Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelButton, { flex: 0.4 }]}
                onPress={() => setSelectedPlace(null)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {editingSpot && (
          <View style={[styles.saveCard, { borderColor: colors.highlight }]}>
            <Text style={[styles.selectedTitle, { color: colors.highlight }]}>
              ✏️ Edit Spot
            </Text>
              <CategoryPicker value={editCategory} onChange={setEditCategory} />
            <TextInput
              style={styles.input}
              placeholder="Location name"
              placeholderTextColor={colors.textDim}
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Notes..."
              placeholderTextColor={colors.textDim}
              value={editNote}
              onChangeText={setEditNote}
              multiline={true}
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { flex: 1, marginRight: 5, backgroundColor: colors.highlight },
                ]}
                onPress={handleSaveEdit}
              >
                <Text style={[styles.buttonText, { color: '#000' }]}>
                  Update Spot
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelButton, { flex: 0.4 }]}
                onPress={() => setEditingSpot(null)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
                <Modal
          visible={!!planningSpot}
          transparent
          animationType="slide"
          onRequestClose={() => setPlanningSpot(null)}
        >
          <View style={styles.modalBackdrop}>
            <ScrollView
              contentContainerStyle={{ padding: 15, paddingTop: 60, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {planningSpot && (
                <AddToDayCard
                  spot={planningSpot}
                  authToken={authToken}
                  profile={profile}
                  onClose={() => setPlanningSpot(null)}
                />
              )}
            </ScrollView>
          </View>
        </Modal>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 6 }}>
          {[{ id: 'all', emoji: '🗂️', label: 'All' }, ...CATEGORIES].map(c => {
            const count =
              c.id === 'all'
                ? placesList.length
                : placesList.filter(p => (p.category || 'spot') === c.id).length;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setFilter(c.id)}
                style={[styles.catChip, filter === c.id && styles.catChipOn]}
              >
                <Text style={styles.catText}>
                  {c.emoji} {c.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { marginBottom: 0 }]}>
            Showing {visibleSpots.length} of {placesList.length}
          </Text>
          <TouchableOpacity style={styles.fitBtn} onPress={handleFitAll}>
            <Text style={styles.actionBtnText}>🔍 Show all on map</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.listContainer}>
          {visibleSpots.map((place, index) => (
            <TouchableOpacity
              key={index}
              style={styles.placeCard}
              onPress={() => handleFocusSpot(place)}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.placeText, { flex: 1 }]}>
                  {getCategory(place.category).emoji} {place.name}
                </Text>
                {place.createdByCharacter ? (
                  <Avatar characterId={place.createdByCharacter} size={30} />
                ) : null}
              </View>

              {place.createdByName ? (
                <Text style={styles.byText}>Added by {place.createdByName}</Text>
              ) : null}

              {place.note ? (
                <Text style={styles.noteText}>📝 {place.note}</Text>
              ) : null}

              {(() => {
                const days = daysFor(place);
                return days.length ? (
                  <Text style={styles.plannedText}>
                    📅 {days.map(d => `Day ${d.dayNumber} · ${d.short}`).join(', ')}
                  </Text>
                ) : (
                  <Text style={styles.unplannedText}>⏳ Not planned yet</Text>
                );
              })()}

              <TouchableOpacity
                style={styles.planBtn}
                onPress={() => {
                  setPlanningSpot(place);
                  setSelectedPlace(null);
                  setEditingSpot(null);
                }}
          
              >
                <Text style={styles.actionBtnText}>📅 Add to day</Text>
              </TouchableOpacity>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtnNav}
                    onPress={() => handleGetDirections(place.lat, place.lng, place.name)}
                >
                  <Text style={styles.actionBtnText}>🧭 Google Maps</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnEdit}
                  onPress={() => handleStartEdit(place)}
                >
                  <Text style={styles.actionBtnText}>✏️ Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnDelete}
                  onPress={() => handleDeleteSpot(place.id)}
                >
                  <Text style={styles.actionBtnText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 10 },
  searchSection: { paddingHorizontal: 15, zIndex: 10, marginBottom: 10 },
  searchBar: { flexDirection: 'row' },
  searchInput: { flex: 1, backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 8, fontSize: 14, marginRight: 8 },
  searchButton: { backgroundColor: colors.primary, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  searchResultsContainer: { backgroundColor: colors.card, maxHeight: 150, borderRadius: 8, marginTop: 5 },
  searchResultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultTitle: { color: colors.success, fontWeight: 'bold', fontSize: 14 },
  resultSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  mapContainer: { height: Dimensions.get('window').height * 0.35, width: '100%' },
  map: { flex: 1 },
  webMapFallback: { flex: 1, backgroundColor: colors.mapFallback, justifyContent: 'center', alignItems: 'center', padding: 20, marginHorizontal: 15, borderRadius: 8 },
  webMapText: { color: colors.text, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  webMapSubtext: { color: colors.textSoft, fontSize: 12, textAlign: 'center', marginTop: 6 },
  listSection: { flex: 1, padding: 15 },
  saveCard: { backgroundColor: colors.cardDark, padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.success },
  selectedTitle: { color: colors.success, fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 8, textAlign: 'center' },
  listContainer: { flex: 1, width: '100%' },
  placeCard: { backgroundColor: colors.card, padding: 12, borderRadius: 8, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placeText: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  noteText: { color: colors.textSoft, fontSize: 13, marginTop: 4, fontStyle: 'italic' },
    byText: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  cardActions: { flexDirection: 'row', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, justifyContent: 'space-between' },
  actionBtnNav: { backgroundColor: colors.googleBlue, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  actionBtnEdit: { backgroundColor: colors.warning, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  actionBtnDelete: { backgroundColor: colors.danger, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  actionBtnText: { color: colors.text, fontSize: 12, fontWeight: 'bold' },
  saveButton: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: colors.danger, padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
  formButtons: { flexDirection: 'row', marginTop: 5 },
  input: { backgroundColor: colors.input, color: colors.text, padding: 10, borderRadius: 8, fontSize: 14, marginBottom: 8 },
  noteInput: { height: 45, textAlignVertical: 'top' },
    catChip: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: colors.input },
  catChipOn: { borderColor: colors.primary, backgroundColor: '#1f3a5f' },
  catText: { color: colors.text, fontSize: 13 },
    planBtn: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start', marginTop: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fitBtn: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  plannedText: { color: colors.success, fontSize: 12, marginTop: 6 },
  unplannedText: { color: colors.textDim, fontSize: 12, marginTop: 6 },
});