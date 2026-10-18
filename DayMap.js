import React, { useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { colors } from './theme';
import { openInGoogleMaps } from './maps';

let MapView, Marker, Polyline;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
}

export default function DayMap({ stops, routeCoords }) {
  const mapRef = useRef(null);
  const key = stops.map(s => s.id).join('|');

  const fit = () => {
    if (!mapRef.current || stops.length === 0) return;
    const coords = stops.map(s => ({ latitude: s.lat, longitude: s.lng }));

    if (coords.length === 1) {
      mapRef.current.animateToRegion(
        { ...coords[0], latitudeDelta: 0.2, longitudeDelta: 0.2 },
        400
      );
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    fit();
  }, [key]);

  if (stops.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          🗺️ Add spots to this day to see the route
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>🗺️ Route map</Text>
        <Text style={styles.placeholderSub}>
          {stops.map((s, i) => `${i + 1}. ${s.spotName}`).join('  →  ')}
        </Text>
        <Text style={styles.placeholderSub}>Open on your phone to see the map</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapBox}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: stops[0].lat,
          longitude: stops[0].lng,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
        onMapReady={fit}
      >
        {stops.length > 1 && (
          <Polyline
                      coordinates={
              routeCoords && routeCoords.length
                ? routeCoords
                : stops.map(s => ({ latitude: s.lat, longitude: s.lng }))
            }
            strokeColor={colors.primary}
            strokeWidth={3}
          />
        )}

        {stops.map((s, i) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={`${i + 1}. ${s.spotName}`}
                        description={`${s.time ? s.time + ' · ' : ''}Tap to open in Google Maps`}
             onCalloutPress={() => openInGoogleMaps(s.lat, s.lng, s.spotName)}
          >
            <View style={styles.pin}>
              <Text style={styles.pinText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapBox: { height: 220, borderRadius: 8, overflow: 'hidden', marginVertical: 10 },
  placeholder: {
    backgroundColor: colors.mapFallback,
    borderRadius: 8,
    padding: 16,
    marginVertical: 10,
    alignItems: 'center',
  },
  placeholderText: { color: colors.text, fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  placeholderSub: { color: colors.textSoft, fontSize: 12, marginTop: 6, textAlign: 'center' },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});