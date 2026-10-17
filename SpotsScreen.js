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
} from 'react-native';
import { colors } from './theme';
import Avatar from './Avatar';
import { CATEGORIES, getCategory } from './categories';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';

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

  const handleGetDirections = async (lat, lng) => {
    if (!lat || !lng) return;

    const gmapsAppUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
    const gmapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    try {
      if (Platform.OS === 'ios') {
        const isAppInstalled = await Linking.canOpenURL(gmapsAppUrl);
        if (isAppInstalled) {
          await Linking.openURL(gmapsAppUrl);
        } else {
          await Linking.openURL(gmapsWebUrl);
        }
      } else {
        await Linking.openURL(gmapsWebUrl);
      }
    } catch (error) {
      Linking.openURL(gmapsWebUrl);
    }
  };

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

      {/* Interactive Map */}
      <View style={styles.mapContainer}>
        {Platform.OS !== 'web' && MapView ? (
          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
          >
            {placesList.map((spot, index) =>
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

        <Text style={styles.subtitle}>Saved Spots ({placesList.length})</Text>

        <ScrollView style={styles.listContainer}>
          {placesList.map((place, index) => (
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

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtnNav}
                  onPress={() => handleGetDirections(place.lat, place.lng)}
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
});