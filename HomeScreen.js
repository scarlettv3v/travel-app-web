import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import { useTrip } from './trip';
import DatePicker, { formatDate } from './DatePicker';
import SkyLayer, { weatherKind, weatherLabel, skyColor } from './WeatherScene';

// Home uses its own light palette from the design, the other tabs stay dark for now
const P = {
  ink: '#263a48',
  paper: '#fffdf6',
  bg: '#f3f8ed',
  line: '#b4d9c7',
  muted: '#526873',
  soft: '#e7f5e9',
  mint: '#d9f5e7',
  sun: '#ffe1aa',
  coral: '#ec7869',
  night: '#33476f',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const short = iso => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const utc = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const dayDiff = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const toMin = t => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export default function HomeScreen({ authToken, profile, uid, onOpenPlan }) {
  const { name, destination, latitude, longitude, start, end, label, days } = useTrip();
  const scrollRef = useRef(null);

  const [travelers, setTravelers] = useState([]);
  const [sky, setSky] = useState(null);
  const [skyError, setSkyError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState(null);
  const [trackW, setTrackW] = useState(0); // width of the day timeline on screen

  const [picker, setPicker] = useState(null); // 'join'

  // ---------- people ----------
  const loadTravelers = useCallback(async () => {
    try {
      const res = await firestoreFetch(`${FIRESTORE_BASE}/profiles?pageSize=100`, authToken);
      const data = await res.json();
      setTravelers(
        (data.documents || []).map(doc => ({
          uid: doc.name.split('/').pop(),
          name: doc.fields?.name?.stringValue || 'Traveler',
          character: doc.fields?.character?.stringValue || 'fox',
          join: doc.fields?.joinDate?.stringValue || '',
        }))
      );
    } catch (error) {
      console.error('Error loading travelers:', error);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    loadTravelers();
    const timer = setInterval(loadTravelers, 15000);
    return () => clearInterval(timer);
  }, [authToken, loadTravelers]);

  // ---------- clock ----------
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const offsetSec = sky ? sky.offset : -new Date().getTimezoneOffset() * 60;
  const localIso = new Date(now + offsetSec * 1000).toISOString().slice(0, 16);
  const today = localIso.slice(0, 10);
  const timeStr = localIso.slice(11);

  // ---------- sky + live weather (free Open-Meteo service, no key needed) ----------
  const loadSky = useCallback(async () => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        '&current=temperature_2m,weather_code,cloud_cover&daily=sunrise,sunset&timezone=auto&forecast_days=1';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather service unavailable');
      const d = await res.json();
      if (!d.daily?.sunrise?.[0] || !d.daily?.sunset?.[0]) throw new Error('Incomplete data');
      setSky({
        temp: d.current?.temperature_2m,
        code: d.current?.weather_code,
        cloud: d.current?.cloud_cover,
        sunrise: d.daily.sunrise[0],
        sunset: d.daily.sunset[0],
        offset: d.utc_offset_seconds || 0,
      });
      setSkyError(false);
    } catch (error) {
      console.error('Error loading sky:', error);
      setSkyError(true);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    loadSky();
    const timer = setInterval(loadSky, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadSky, today]);

  const skyOk = !!sky && sky.sunrise.slice(0, 10) === today;
  const hour = Number(timeStr.slice(0, 2));
  const daylight = skyOk ? localIso >= sky.sunrise && localIso < sky.sunset : hour >= 6 && hour < 18;
  const riseMin = skyOk ? toMin(sky.sunrise.slice(11, 16)) : 360;
  const setMin = skyOk ? toMin(sky.sunset.slice(11, 16)) : 1080;
  const nowMin = toMin(timeStr);

  const kind = sky ? weatherKind(sky.code, sky.cloud) : 'clear';
  const weatherText = sky ? weatherLabel(sky.code, kind) : '';

  // ---------- journey ----------
  const clamped = today < start ? start : today > end ? end : today;
  const todayIndex = Math.max(0, days.findIndex(d => d.iso === clamped));
  const joinedBy = iso => travelers.filter(t => (t.join || start) <= iso);

  // Day timeline sizing: up to 6 days fill the screen, more than that show about 5 and a half
  // so you can see there is more to scroll to.
  const dayCount = Math.max(1, days.length);
  const colW = trackW
    ? Math.max(52, Math.floor(trackW / (dayCount <= 6 ? dayCount : 5.5)))
    : 70;
  const avatarSize = Math.max(22, Math.min(30, Math.floor(colW * 0.45)));
  const narrow = colW < 70;

  // Keep today's day in the middle of the screen (you can still scroll left and right)
  useEffect(() => {
    if (!trackW || !scrollRef.current) return;
    const x = Math.max(0, todayIndex * colW - (trackW / 2 - colW / 2));
    scrollRef.current.scrollTo({ x, animated: false });
  }, [trackW, todayIndex, colW, days.length]);

  let statusText;
  if (today < start) {
    const n = dayDiff(today, start);
    statusText = `Starts in ${n} day${n === 1 ? '' : 's'}`;
  } else if (today > end) {
    statusText = 'Trip finished';
  } else {
    statusText = `Day ${dayDiff(start, today) + 1} of ${days.length}`;
  }

  const me = travelers.find(t => t.uid === uid);
  const myJoin = me?.join || start;

  // ---------- saving ----------
  const saveJoin = async iso => {
    try {
      await firestoreFetch(
        `${FIRESTORE_BASE}/profiles/${uid}?updateMask.fieldPaths=joinDate`,
        authToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { joinDate: { stringValue: iso } } }),
        }
      );
      await loadTravelers();
    } catch (error) {
      console.error('Error saving join date:', error);
      alert('Could not save your join date.');
    }
  };

  const selectedDay = days.find(d => d.iso === selected);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ padding: 15, paddingTop: 44, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[s.card, { paddingRight: 56 }]}>
        <Text style={s.kicker}>YOUR LITTLE BIG ADVENTURE</Text>
        <Text style={s.title}>{name}</Text>
        <Text style={s.sub}>{destination}</Text>
        <Text style={s.sub}>{label}</Text>
        <Text style={s.hint}>Change trip details from your icon at the top right.</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>
            {days.length} DAYS · {statusText.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Journey path */}
      <View style={s.card}>
        <Text style={s.kicker}>THE WHOLE ADVENTURE</Text>
        <Text style={s.h2}>Our journey path</Text>
        <Text style={s.sub}>
          {days.length > 6
            ? 'Swipe left and right · Tap a day to explore'
            : 'Tap a day to explore'}
        </Text>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={e => setTrackW(e.nativeEvent.layout.width)}
          contentContainerStyle={{ paddingVertical: 12 }}
        >
          <View style={{ width: dayCount * colW, height: 200 }}>
            <View style={[s.pathLine, { left: colW / 2, right: colW / 2 }]} />
            <View style={{ flexDirection: 'row' }}>
              {days.map((d, i) => {
                const isToday = i === todayIndex;
                const isSel = d.iso === selected;
                const visited = i < todayIndex;
                const here = isToday
  ? joinedBy(clamped)
  : d.iso > clamped
    ? travelers.filter(t => (t.join || start) === d.iso)
    : [];
                return (
                  <View key={d.iso} style={{ width: colW, alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => setSelected(d.iso)}
                      style={[
                        s.dayBtn,
                        { width: colW - 8 },
                        isToday && s.dayToday,
                        isSel && s.daySel,
                      ]}
                    >
                      <Text style={[s.dayNum, narrow && { fontSize: 12 }]}>Day {d.dayNumber}</Text>
                      <Text style={[s.dayDate, narrow && { fontSize: 11 }]}>{d.short}</Text>
                    </TouchableOpacity>
                    <View style={[s.node, (visited || isToday) && s.nodeDone, isSel && s.nodeSel]} />
                    <View style={s.stack}>
                      {here.map(t => (
  <View key={t.uid} style={!isToday ? { opacity: 0.5 } : null}>
    <Avatar characterId={t.character} size={avatarSize} />
  </View>
))}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {selectedDay ? (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>
              Day {selectedDay.dayNumber} · {selectedDay.weekday} {selectedDay.short}
            </Text>
            <Text style={s.sub}>
              {joinedBy(selectedDay.iso).length
                ? 'On the trip: ' + joinedBy(selectedDay.iso).map(t => t.name).join(', ')
                : 'Nobody has joined by this day yet.'}
            </Text>
            {onOpenPlan ? (
              <TouchableOpacity style={s.smallBtn} onPress={onOpenPlan}>
                <Text style={s.smallBtnText}>Open Plan</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={s.notice}>
            <Text style={s.sub}>Tap a day on the path to see who is on the trip.</Text>
          </View>
        )}

        <View style={s.divider} />
        <Text style={s.h3}>Travel companions</Text>
        <Text style={s.sub}>See who has joined and who is arriving later.</Text>
        {travelers.map(t => {
          const join = t.join || start;
          const joined = today >= join;
          const mine = t.uid === uid;
          return (
            <View key={t.uid} style={s.travelerRow}>
              <View style={mine ? s.meFrame : null}>
                <Avatar characterId={t.character} size={32} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
   <Text style={s.travelerName}>{t.name}{mine ? ' (You)' : ''}</Text>
             <Text style={s.sub}>{joined ? 'Joined on' : 'Joins on'} {short(join)}</Text>
              </View>
              <View style={[s.status, joined && s.statusOn]}>
                <Text style={s.statusText}>{joined ? 'Joined' : 'Not joined yet'}</Text>
              </View>
            </View>
          );
        })}
        <TouchableOpacity style={s.pill} onPress={() => setPicker('join')}>
          <Text style={s.pillText}>📅 My join date: {formatDate(myJoin)}</Text>
        </TouchableOpacity>

      </View>

      {/* Sky and time */}
      <View style={s.card}>
        <Text style={s.kicker}>RIGHT HERE, RIGHT NOW</Text>
        <Text style={s.h2}>Local sky & time</Text>

        <View style={[s.scene, { backgroundColor: skyColor(kind, daylight) }]}>
          <SkyLayer kind={kind} daylight={daylight} />
          <View style={[s.hill, { backgroundColor: daylight ? '#a9dabb' : '#527989' }]} />
          <View style={s.me}>
            <View style={!daylight ? s.meSleep : null}>
              <Avatar characterId={profile.character} sleeping={!daylight} size={50} />
            </View>
            {/* the zzz sits inside the same box as the character, so it stays next to them */}
            {!daylight ? <Text style={s.zzz}>💤</Text> : null}
          </View>
        </View>

        <Text style={s.state}>
          {daylight ? '☀ Daytime' : '☾ Sleeping'}
          {weatherText ? ` · ${weatherText}` : ''}
        </Text>
        <Text style={s.time}>{timeStr}</Text>
        <Text style={s.sub}>{today} · destination time</Text>

        <View style={s.metrics}>
          <View style={s.metric}>
            <Text style={s.metricLabel}>TEMP</Text>
            <Text style={s.metricValue}>
              {sky && Number.isFinite(sky.temp) ? `${Math.round(sky.temp)}°C` : '—'}
            </Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricLabel}>☀ SUNRISE</Text>
            <Text style={s.metricValue}>{skyOk ? sky.sunrise.slice(11, 16) : '—'}</Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricLabel}>☾ SUNSET</Text>
            <Text style={s.metricValue}>{skyOk ? sky.sunset.slice(11, 16) : '—'}</Text>
          </View>
        </View>

        <Text style={[s.sub, { marginTop: 14 }]}>Local day / night cycle</Text>
        <View style={s.cycleWrap}>
          <View style={s.cycle}>
            <View style={{ flex: riseMin, backgroundColor: '#42627f' }} />
            <View style={{ flex: Math.max(1, setMin - riseMin), backgroundColor: '#ffe3a0' }} />
            <View style={{ flex: Math.max(1, 1440 - setMin), backgroundColor: '#42627f' }} />
          </View>
          <View style={[s.cyclePin, { left: `${(nowMin / 1440) * 100}%` }]} />
        </View>
        <View style={s.cycleLabels}>
          <Text style={s.tiny}>00:00</Text>
          <Text style={s.tiny}>06:00</Text>
          <Text style={s.tiny}>12:00</Text>
          <Text style={s.tiny}>18:00</Text>
          <Text style={s.tiny}>24:00</Text>
        </View>

        {skyError ? (
          <Text style={s.error}>
            Could not load sunrise and sunset. Using 6:00 to 18:00 as daytime for now.
          </Text>
        ) : null}
        <TouchableOpacity style={s.pill} onPress={loadSky}>
          <Text style={s.pillText}>↻ Refresh sky data</Text>
        </TouchableOpacity>
      </View>

      <DatePicker
        visible={!!picker}
        title="Your join date"
        value={myJoin}
        minDate=""
        onPick={iso => {
          saveJoin(iso);
          setPicker(null);
        }}
        onClear={() => {
          saveJoin('');
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </ScrollView>
  );
}

const border = { borderWidth: 2, borderColor: P.ink };

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },
  card: { backgroundColor: P.paper, ...border, borderRadius: 22, padding: 16, marginBottom: 16 },
  kicker: { color: '#52756b', fontSize: 12, letterSpacing: 1.5, marginBottom: 4 },
  title: { color: P.ink, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  h2: { color: P.ink, fontSize: 22, fontWeight: '800', marginBottom: 2 },
  h3: { color: P.ink, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  sub: { color: P.muted, fontSize: 14, marginTop: 2 },
  tiny: { color: P.muted, fontSize: 11 },
  hint: { color: '#52756b', fontSize: 12, marginTop: 6 },
  badge: { alignSelf: 'flex-start', ...border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 10, backgroundColor: '#fff' },
  badgeText: { color: P.ink, fontWeight: '800', fontSize: 12 },

  pathLine: { position: 'absolute', top: 73, height: 8, backgroundColor: P.line, ...border, borderRadius: 9 },
 dayBtn: { height: 52, justifyContent: 'center', borderRadius: 14, borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  dayToday: { backgroundColor: P.mint, borderColor: '#54a887' },
  daySel: { backgroundColor: P.sun, borderColor: P.ink },
  dayNum: { color: P.ink, fontWeight: '800', fontSize: 14 },
  dayDate: { color: P.muted, fontSize: 12 },
  node: { width: 22, height: 22, marginTop: 14, backgroundColor: '#fff', borderWidth: 3, borderColor: P.ink, borderRadius: 6, transform: [{ rotate: '45deg' }] },
  nodeDone: { backgroundColor: '#8ecdc0' },
  nodeSel: { backgroundColor: '#ffae79' },
  stack: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16, minHeight: 52 },

  notice: { backgroundColor: P.soft, borderWidth: 2, borderColor: P.line, borderRadius: 12, padding: 12, marginTop: 4 },
  noticeTitle: { color: P.ink, fontWeight: '800', fontSize: 15 },
  smallBtn: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#fff', ...border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  smallBtnText: { color: P.ink, fontWeight: '800', fontSize: 13 },
  divider: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#afc9bb', marginVertical: 16 },

  travelerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#afc9bb' },
  travelerName: { color: P.ink, fontWeight: '800', fontSize: 15 },
  meFrame: { padding: 4, borderWidth: 2, borderColor: '#db7868', borderRadius: 14, backgroundColor: '#fff1d9' },
  status: { borderWidth: 1, borderColor: '#afc9bb', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff' },
  statusOn: { backgroundColor: P.mint },
  statusText: { color: P.ink, fontWeight: '800', fontSize: 11 },

pill: { alignSelf: 'flex-start', backgroundColor: '#fff', ...border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, marginTop: 12 },
  pillText: { color: P.ink, fontWeight: '800', fontSize: 14 },

  scene: { height: 190, ...border, borderRadius: 18, overflow: 'hidden', marginTop: 10 },
  hill: { position: 'absolute', bottom: -70, left: '-15%', width: '130%', height: 130, borderRadius: 200, borderWidth: 3, borderColor: P.ink },
  me: { position: 'absolute', bottom: 34, left: '42%' },
  meSleep: { transform: [{ rotate: '-82deg' }], opacity: 0.85 },
  zzz: { position: 'absolute', left: -6, top: -18, fontSize: 22 },

  state: { color: P.ink, fontWeight: '800', fontSize: 16, marginTop: 12 },
  time: { color: P.ink, fontSize: 44, fontWeight: '800', marginTop: 2 },
  metrics: { flexDirection: 'row', marginTop: 12 },
  metric: { flex: 1, ...border, borderRadius: 16, padding: 10, backgroundColor: '#f1f8ed', marginRight: 8 },
  metricLabel: { color: '#395a53', fontSize: 11, letterSpacing: 1 },
  metricValue: { color: P.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  cycleWrap: { marginTop: 8, height: 26, justifyContent: 'center' },
  cycle: { flexDirection: 'row', height: 17, ...border, borderRadius: 20, overflow: 'hidden' },
  cyclePin: { position: 'absolute', top: -1, width: 26, height: 26, marginLeft: -13, borderRadius: 13, borderWidth: 3, borderColor: P.ink, backgroundColor: '#fff' },
  cycleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  error: { color: '#832c2b', backgroundColor: '#fff0ec', borderWidth: 2, borderColor: '#b64d48', borderRadius: 12, padding: 10, marginTop: 10, fontSize: 13 },
});