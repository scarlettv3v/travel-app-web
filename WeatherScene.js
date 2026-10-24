import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Platform, StyleSheet } from 'react-native';
import { P } from './ui';

const NATIVE = Platform.OS !== 'web';

// ---------- weather helpers ----------

// WMO weather code (from Open-Meteo) -> a simple scene type
export function weatherKind(code, cloudCover) {
  if (code === null || code === undefined) {
    if (cloudCover === null || cloudCover === undefined) return 'clear';
    if (cloudCover < 20) return 'clear';
    return cloudCover < 60 ? 'partly' : 'cloudy';
  }
  if ([95, 96, 99].includes(code)) return 'storm';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([45, 48].includes(code)) return 'fog';
  if (code === 3) return 'cloudy';
  if (code === 2) return 'partly';
  return 'clear';
}

const LABELS = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};
const KIND_LABEL = {
  clear: 'Clear sky',
  partly: 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Thunderstorm',
};

export function weatherLabel(code, kind) {
  return LABELS[code] || KIND_LABEL[kind] || '';
}

export function skyColor(kind, daylight) {
  const day = {
    clear: '#bfeaf0',
    partly: '#c4e3ee',
    cloudy: '#cfdadf',
    fog: '#dbe2e3',
    rain: '#a9bcc8',
    snow: '#e4edf2',
    storm: '#8493a1',
  };
  const night = {
    clear: '#33476f',
    partly: '#384b72',
    cloudy: '#3f4d68',
    fog: '#46526b',
    rain: '#2f3b52',
    snow: '#4a5878',
    storm: '#262f42',
  };
  return (daylight ? day : night)[kind] || (daylight ? day.clear : night.clear);
}

function cloudColor(kind, daylight) {
  const day = {
    clear: '#ffffff',
    partly: '#ffffff',
    cloudy: '#f1f4f6',
    fog: '#f5f7f7',
    rain: '#cfd8de',
    snow: '#ffffff',
    storm: '#9aa6b1',
  };
  const night = {
    clear: '#6b7b9c',
    partly: '#6b7b9c',
    cloudy: '#56647f',
    fog: '#5e6b86',
    rain: '#465169',
    snow: '#6d7ca0',
    storm: '#37405a',
  };
  return (daylight ? day : night)[kind] || '#ffffff';
}

// where the clouds go: [left %, top, size]
const CLOUDS = {
  clear: [[12, 34, 0.7]],
  partly: [[8, 30, 1], [56, 54, 0.9], [66, 18, 0.7]],
  cloudy: [[2, 18, 1.1], [30, 46, 1.3], [54, 14, 1.2], [70, 52, 1], [12, 70, 0.9]],
  fog: [[10, 30, 1], [58, 42, 1]],
  rain: [[0, 12, 1.2], [26, 32, 1.4], [52, 10, 1.3], [70, 36, 1.2]],
  storm: [[0, 12, 1.2], [26, 32, 1.4], [52, 10, 1.3], [70, 36, 1.2]],
  snow: [[6, 14, 1.1], [44, 28, 1.3], [68, 8, 1]],
};

// ---------- pieces ----------

function Cloud({ left, top, size, color }) {
  return (
    <View style={{ position: 'absolute', left: `${left}%`, top, transform: [{ scale: size }] }}>
      <View style={{ width: 64, height: 22, borderRadius: 11, backgroundColor: color }} />
      <View
        style={{
          position: 'absolute',
          left: 10,
          top: -10,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 30,
          top: -16,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// something that falls again and again (a raindrop or a snowflake)
function Falling({ left, delay, duration, from, to, children }) {
  const y = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    y.setValue(from);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, {
          toValue: to,
          duration,
          easing: Easing.linear,
          useNativeDriver: NATIVE,
        }),
        Animated.timing(y, { toValue: from, duration: 0, useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [from, to, delay, duration]);

  return (
    <Animated.View
      style={{ position: 'absolute', left, top: 0, transform: [{ translateY: y }] }}
    >
      {children}
    </Animated.View>
  );
}

function Lightning() {
  const o = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(o, { toValue: 1, duration: 60, useNativeDriver: NATIVE }),
        Animated.timing(o, { toValue: 0, duration: 120, useNativeDriver: NATIVE }),
        Animated.timing(o, { toValue: 1, duration: 60, useNativeDriver: NATIVE }),
        Animated.timing(o, { toValue: 0, duration: 200, useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={{ position: 'absolute', left: '40%', top: 52, opacity: o }}>
      <Text style={{ fontSize: 34 }}>⚡</Text>
    </Animated.View>
  );
}

// ---------- the whole sky ----------

// Draws the sky for the current weather. Put it first inside the scene, then the hill and
// the traveller on top.
export default function SkyLayer({ kind, daylight }) {
  const showSun = daylight && (kind === 'clear' || kind === 'partly');
  const showMoon = !daylight; // the moon is always there at night, dimmer when the weather is poor
  const showStars = !daylight && (kind === 'clear' || kind === 'partly');
  const moonOpacity =
    { clear: 1, partly: 0.85, cloudy: 0.5, fog: 0.4, snow: 0.45, rain: 0.4, storm: 0.3 }[kind] || 1;
  const color = cloudColor(kind, daylight);
  const clouds = CLOUDS[kind] || CLOUDS.clear;

  const rainCount = kind === 'storm' ? 24 : 16;
  const dropColor = daylight ? '#5b8db0' : '#9ec3e0';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {showStars ? <Text style={styles.stars}>✦   ✧   ✦   ✧   ✦</Text> : null}

      {showSun ? <View style={[styles.orb, styles.sun]} /> : null}
      {showMoon ? <View style={[styles.orb, styles.moon, { opacity: moonOpacity }]} /> : null}

      {clouds.map(([left, top, size], i) => (
        <Cloud key={i} left={left} top={top} size={size} color={color} />
      ))}

      {kind === 'fog' ? (
        <View>
          <View
            style={[
              styles.fogBand,
              { top: 90, backgroundColor: daylight ? 'rgba(255,255,255,0.45)' : 'rgba(200,210,230,0.18)' },
            ]}
          />
          <View
            style={[
              styles.fogBand,
              { top: 122, backgroundColor: daylight ? 'rgba(255,255,255,0.35)' : 'rgba(200,210,230,0.14)' },
            ]}
          />
        </View>
      ) : null}

      {kind === 'rain' || kind === 'storm'
        ? Array.from({ length: rainCount }).map((_, i) => (
            <Falling
              key={i}
              left={`${(i * 37 + 11) % 100}%`}
              delay={(i * 113) % 900}
              duration={650 + ((i * 71) % 450)}
              from={40}
              to={190}
            >
              <View
                style={{
                  width: 2,
                  height: 12,
                  borderRadius: 1,
                  backgroundColor: dropColor,
                  transform: [{ rotate: '14deg' }],
                }}
              />
            </Falling>
          ))
        : null}

      {kind === 'snow'
        ? Array.from({ length: 14 }).map((_, i) => (
            <Falling
              key={i}
              left={`${(i * 43 + 7) % 100}%`}
              delay={(i * 289) % 2500}
              duration={3200 + ((i * 197) % 2200)}
              from={30}
              to={190}
            >
              <Text style={{ fontSize: 12, color: '#ffffff' }}>❄</Text>
            </Falling>
          ))
        : null}

      {kind === 'storm' ? <Lightning /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { position: 'absolute', top: 18, left: 20, color: '#ffe6a1', fontSize: 20 },
  orb: {
    position: 'absolute',
    right: 30,
    top: 22,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: P.ink,
  },
  sun: { backgroundColor: '#ffdc78' },
  moon: { backgroundColor: '#f9f2cf' },
  fogBand: { position: 'absolute', left: 0, right: 0, height: 26 },
});