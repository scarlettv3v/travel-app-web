import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import { useTrip } from './trip';
import TripDates from './TripDates';
import { getCategory } from './categories';
import ReorderModal from './ReorderModal';
import EditPlanModal from './EditPlanModal';
import HScroll from './HScroll';
import { syncPlanToSpot } from './linkSync';
import LinkText from './LinkText';
import { openPlace, openRoute } from './places';
import { P, ui, screenContent } from './ui';

const str = (doc, key) => doc.fields?.[key]?.stringValue || '';
const joinList = doc =>
  (doc.fields?.joining?.arrayValue?.values || []).map(v => v.stringValue);
const TRANSPORT_EMOJI = { flight: '✈️', car: '🚗', train: '🚆', ferry: '⛴️' };
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthDay = iso => {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};
const sv = v => ({ stringValue: v || '' });

// today's date on this device, like 2026-11-23 (the phone's local time, not UTC)
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------------------------
// COLOURS of the flight and stay strips in "Stay & travel". Change them here.
//   bg     = the fill colour of the strip
//   border = the thin outline of the strip
//   label  = the colour of the small label word (DEPARTS, ARRIVES, STAYING TONIGHT, CHECK-OUT)
// Use any hex colour, e.g. '#c0392b'. Each of the four has its own line, so all can differ.
// ---------------------------------------------------------------------------------------------
const STRIP = {
  depart:   { bg: '#dbeeff', border: '#5ba3c7', label: '#572002' }, // DEPARTS
  arrive:   { bg: '#dbeeff', border: '#5ba3c7', label: '#572002' }, // ARRIVES
  staying:  { bg: '#eadcf3', border: '#9b7bc4', label: '#572002' }, // STAYING TONIGHT
  checkout: { bg: '#eadcf3', border: '#9b7bc4', label: '#572002' }, // CHECK-OUT
};

// Outline colour of today's day pill. Change it here.
const TODAY_COLOUR = P.coral;

// targetDay = { iso, n } sent from Home ("Open Plan") or Bookings ("View itinerary").
// It opens this screen on that exact day. (n changes every time, so tapping again works too.)
export default function ItineraryScreen({ authToken, profile, onOpenBookings, targetDay }) {
  const { days: DAYS } = useTrip();
  const indexOfDay = iso => Math.max(0, DAYS.findIndex(d => d.iso === iso));

  // which day to open on: the tapped day, otherwise today if it is in the trip, otherwise Day 1
  const dayToOpen = () => {
    if (targetDay) return indexOfDay(targetDay.iso);
    const i = DAYS.findIndex(d => d.iso === todayIso());
    return i >= 0 ? i : 0;
  };
  const pickedRef = useRef(false); // true once you tap a day yourself
  const [selected, setSelected] = useState(dayToOpen);

  const [transport, setTransport] = useState([]);
  const [stays, setStays] = useState([]);
  const [plans, setPlans] = useState([]);
  const [characters, setCharacters] = useState({});
  const [reordering, setReordering] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // coming from Home / Bookings: open the day that was tapped
  useEffect(() => {
    if (targetDay) setSelected(indexOfDay(targetDay.iso));
  }, [targetDay && targetDay.n, DAYS.length]);

  // trip dates can arrive a moment after the screen opens: pick today again, unless you chose a day
  useEffect(() => {
    if (!targetDay && !pickedRef.current) setSelected(dayToOpen());
  }, [DAYS.length, DAYS[0] && DAYS[0].iso]);

  const loadAll = useCallback(async () => {
    try {
      const tRes = await firestoreFetch(`${FIRESTORE_BASE}/transport?pageSize=300`, authToken);
      const tData = await tRes.json();
      setTransport(
        (tData.documents || []).map(doc => ({
          id: doc.name,
          type: str(doc, 'type') || 'flight',
          provider: str(doc, 'provider'),
          reference: str(doc, 'reference'),
          from: str(doc, 'from'),
          to: str(doc, 'to'),
          departDate: str(doc, 'departDate'),
          departTime: str(doc, 'departTime'),
          arriveDate: str(doc, 'arriveDate'),
          arriveTime: str(doc, 'arriveTime'),
          confirmation: str(doc, 'confirmation'),
          addedByCharacter: str(doc, 'addedByCharacter'),
          joining: joinList(doc),
        }))
      );

      const sRes = await firestoreFetch(`${FIRESTORE_BASE}/stays?pageSize=300`, authToken);
      const sData = await sRes.json();
      setStays(
        (sData.documents || []).map(doc => ({
          id: doc.name,
          name: str(doc, 'name'),
          address: str(doc, 'address'),
          checkIn: str(doc, 'checkIn'),
          checkOut: str(doc, 'checkOut'),
          checkInTime: str(doc, 'checkInTime'),
          checkOutTime: str(doc, 'checkOutTime'),
          confirmation: str(doc, 'confirmation'),
          lat: Number(doc.fields?.lat?.doubleValue ?? doc.fields?.lat?.integerValue ?? 0),
          lng: Number(doc.fields?.lng?.doubleValue ?? doc.fields?.lng?.integerValue ?? 0),
          addedByCharacter: str(doc, 'addedByCharacter'),
          joining: joinList(doc),
        }))
      );

      const pRes = await firestoreFetch(`${FIRESTORE_BASE}/plans?pageSize=300`, authToken);
      const pData = await pRes.json();
      setPlans(
        (pData.documents || []).map(doc => ({
          id: doc.name,
          spotName: str(doc, 'spotName'),
          spotId: str(doc, 'spotId'), // the Spot this was made from (empty for older items)
          category: str(doc, 'category') || 'spot',
          note: str(doc, 'note'),
          date: str(doc, 'date'),
          time: str(doc, 'time'),
          status: str(doc, 'status') || 'planned',
          lat: Number(doc.fields?.lat?.doubleValue ?? doc.fields?.lat?.integerValue ?? 0),
          lng: Number(doc.fields?.lng?.doubleValue ?? doc.fields?.lng?.integerValue ?? 0),
          order:
            doc.fields?.order?.integerValue !== undefined
              ? Number(doc.fields.order.integerValue)
              : null,
          joining: (doc.fields?.joining?.arrayValue?.values || []).map(v => v.stringValue),
          addedByName: str(doc, 'addedByName'),
          // plans created from the Bookings tab (activities / restaurants)
          source: str(doc, 'source'),
          bookingKind: str(doc, 'bookingKind'),
          address: str(doc, 'address'),
          confirmation: str(doc, 'confirmation'),
          partySize: str(doc, 'partySize'),
        }))
      );

      const prRes = await firestoreFetch(`${FIRESTORE_BASE}/profiles?pageSize=300`, authToken);
      const prData = await prRes.json();
      const map = {};
      (prData.documents || []).forEach(doc => {
        map[str(doc, 'name')] = str(doc, 'character') || 'fox';
      });
      setCharacters(map);
    } catch (error) {
      console.error('Error loading itinerary:', error);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [authToken, loadAll]);

  const patchPlan = async (plan, fields, masks) => {
    try {
      const mask = masks.map(m => `updateMask.fieldPaths=${m}`).join('&');
      await firestoreFetch(`https://firestore.googleapis.com/v1/${plan.id}?${mask}`, authToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      await loadAll();
    } catch (error) {
      console.error('Error updating plan:', error);
      alert('Could not update.');
    }
  };

  const toggleJoin = plan => {
    const next = plan.joining.includes(profile.name)
      ? plan.joining.filter(n => n !== profile.name)
      : [...plan.joining, profile.name];
    patchPlan(
      plan,
      { joining: { arrayValue: { values: next.map(n => ({ stringValue: n })) } } },
      ['joining']
    );
  };

  const removePlan = async plan => {
    try {
      await firestoreFetch(`https://firestore.googleapis.com/v1/${plan.id}`, authToken, {
        method: 'DELETE',
      });
      await loadAll();
    } catch (error) {
      console.error('Error removing plan:', error);
      alert('Could not remove.');
    }
  };

  const day = DAYS[Math.min(selected, DAYS.length - 1)];
  const today = todayIso();

  const departing = transport.filter(t => t.departDate === day.iso);
  const arriving = transport.filter(t => t.arriveDate === day.iso && t.departDate !== day.iso);
  const stayingTonight = stays.filter(s => s.checkIn <= day.iso && day.iso < s.checkOut);
  const checkingOut = stays.filter(s => s.checkOut === day.iso);

  // all of today's transport in time order
  const travel = [
    ...arriving.map(t => ({ t, dir: 'arrive', time: t.arriveTime || '' })),
    ...departing.map(t => ({ t, dir: 'depart', time: t.departTime || '' })),
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  const dayPlans = plans.filter(p => p.date === day.iso);

  // Everything with a time goes in time order. Plans without a time come after,
  // in the order you set with Reorder.
  const stops = [...dayPlans].sort((a, b) => {
    const at = a.time || '99:99';
    const bt = b.time || '99:99';
    if (at !== bt) return at.localeCompare(bt);
    const ao = a.order ?? 1000;
    const bo = b.order ?? 1000;
    if (ao !== bo) return ao - bo;
    return a.spotName.localeCompare(b.spotName);
  });
  const untimedPlans = stops.filter(p => !p.time && p.source !== 'booking');

  const saveOrder = async list => {
    try {
      await Promise.all(
        list.map((p, index) =>
          firestoreFetch(
            `https://firestore.googleapis.com/v1/${p.id}?updateMask.fieldPaths=order`,
            authToken,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: { order: { integerValue: String(index) } },
              }),
            }
          )
        )
      );
      await loadAll();
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Could not save the new order.');
    }
  };

  // Saves an edit from the Edit popup. Returns true when it worked.
  //  - A spot's item also updates its Spot (and the same spot on other days).
  //  - A booked activity / restaurant IS the booking, so Bookings updates by itself.
  //  - "Who's joining" belongs to this item only, so it is never copied to the spot or other days.
  const savePlanEdit = async (plan, v) => {
    const locked = plan.source === 'booking';
    try {
      const fields = {
        date: sv(v.date),
        time: sv(v.time),
        spotName: sv(v.name),
        address: sv(v.address),
        note: sv(v.note),
        joining: { arrayValue: { values: (v.joining || []).map(n => ({ stringValue: n })) } },
      };
      if (locked) {
        fields.confirmation = sv(v.confirmation);
        if (plan.bookingKind === 'restaurant') fields.partySize = sv(v.partySize);
      } else {
        fields.category = sv(v.category);
      }

      let mask = Object.keys(fields)
        .map(key => `updateMask.fieldPaths=${key}`)
        .join('&');
      // Moving to another day clears the manual order, so it sorts by time there
      if (v.date !== plan.date) mask += '&updateMask.fieldPaths=order';

      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${plan.id}?${mask}`,
        authToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        }
      );
    } catch (error) {
      console.error('Error editing plan:', error);
      alert('Could not save the changes.');
      return false;
    }

    if (!locked) {
      try {
        await syncPlanToSpot(
          plan,
          { name: v.name, address: v.address, note: v.note, category: v.category },
          plans,
          authToken
        );
      } catch (error) {
        console.error('Error updating the spot:', error);
        alert('Saved here, but the matching spot in Spots could not be updated.');
      }
    }

    await loadAll();
    return true;
  };

  // ---------- small render helpers ----------
  const empty = text => (
    <View style={ui.notice}>
      <Text style={ui.noticeText}>{text}</Text>
    </View>
  );

  const pillBtn = (label, onPress, extra) => (
    <TouchableOpacity
      style={[ui.pill, ui.pillSmall, extra && extra.pill]}
      onPress={onPress}
    >
      <Text style={[ui.pillText, ui.pillTextSmall, extra && extra.text]}>{label}</Text>
    </TouchableOpacity>
  );

  // who is on this flight / stay (set from the Bookings tab)
  const renderJoiners = names =>
    names && names.length ? (
      <View style={{ alignItems: 'flex-end', marginLeft: 6 }}>
        <View style={{ flexDirection: 'row' }}>
          {names.slice(0, 4).map(n => (
            <View key={n} style={{ marginLeft: 2 }}>
              <Avatar characterId={characters[n] || 'fox'} size={20} />
            </View>
          ))}
        </View>
        {names.length > 4 ? (
          <Text style={{ color: P.muted, fontSize: 11 }}>+{names.length - 4}</Text>
        ) : null}
      </View>
    ) : null;

  // a transport strip: one row per detail, tight padding. Colours come from STRIP at the top.
  const renderTravel = ({ t, dir }) => {
    const c = STRIP[dir === 'arrive' ? 'arrive' : 'depart'];
    return (
      <View
        key={t.id + dir}
        style={[styles.strip, { backgroundColor: c.bg, borderColor: c.border }]}
      >
        <View style={styles.stripIcon}>
          <Text style={{ fontSize: 13 }}>{TRANSPORT_EMOJI[t.type] || '✈️'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stripLabel, { color: c.label }]}>
            {dir === 'arrive' ? `ARRIVES ${t.arriveTime || ''}` : `DEPARTS ${t.departTime || 'TIME TBC'}`}
          </Text>
          <Text style={ui.strong}>
            {t.from} → {t.to}
          </Text>
          <Text style={[ui.sub, { fontSize: 12, marginTop: 0 }]}>
            {[t.provider, t.reference].filter(Boolean).join(' ')}
            {t.confirmation ? ` · Conf: ${t.confirmation}` : ''}
          </Text>
          {dir === 'depart' && t.arriveTime ? (
            <Text style={[ui.sub, { fontSize: 12, marginTop: 0 }]}>
              Arrives {t.arriveDate !== day.iso ? `${t.arriveDate} ` : ''}
              {t.arriveTime}
            </Text>
          ) : null}
        </View>
        {renderJoiners(t.joining)}
      </View>
    );
  };

  // a stay strip: one row per detail, tight padding. kind = 'staying' or 'checkout'.
  const renderStay = (s, kind, label, title, sub) => {
    const c = STRIP[kind];
    return (
      <View
        key={s.id + kind}
        style={[styles.strip, { backgroundColor: c.bg, borderColor: c.border }]}
      >
        <View style={styles.stripIcon}>
          <Text style={{ fontSize: 13 }}>{kind === 'checkout' ? '🧳' : '🏨'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stripLabel, { color: c.label }]}>{label}</Text>
          <Text style={ui.strong}>{title}</Text>
          {sub.map((line, i) => (
            <Text key={i} style={[ui.sub, { fontSize: 12, marginTop: 0 }]}>
              {line}
            </Text>
          ))}
          <View style={[ui.row, { marginTop: 3 }]}>
            {pillBtn('Google Maps', () => openPlace({ name: s.name, address: s.address }))}
          </View>
        </View>
        {renderJoiners(s.joining)}
      </View>
    );
  };

  // a card in the plan timeline. The time sits in the card's top row, so the timeline
  // only needs a thin number rail on the left and the card gets the rest of the width.
  const renderStopCard = (p, index) => {
    const locked = p.source === 'booking';
    const iAmIn = p.joining.includes(profile.name);
    const emoji = locked
      ? p.bookingKind === 'restaurant'
        ? '🍽️'
        : '🎟️'
      : getCategory(p.category).emoji;

    return (
      <View style={[ui.listCard, { marginTop: 0 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[ui.tag, locked && { backgroundColor: P.mint }]}>
            <Text style={ui.tagText}>
              {locked
                ? '🔒 Booked · from Bookings'
                : `${getCategory(p.category).emoji} ${getCategory(p.category).label}`}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {p.time ? <Text style={styles.cardTime}>🕒 {p.time}</Text> : null}
        </View>

        <Text style={[ui.h3, { marginTop: 3 }]}>
          {locked ? `${emoji} ` : ''}
          {p.spotName}
        </Text>

        {locked && p.partySize ? <Text style={ui.sub}>Party of {p.partySize}</Text> : null}
        {p.address ? <Text style={ui.sub}>📍 {p.address}</Text> : null}
        {locked && p.confirmation ? <Text style={ui.sub}>Confirmation: {p.confirmation}</Text> : null}
        {p.note ? <LinkText style={ui.sub}>{p.note}</LinkText> : null}

        <View style={[ui.row, { marginTop: 6 }]}>
          <Text style={[ui.sub, { marginTop: 0 }]}>Joining: </Text>
          {p.joining.length === 0 && <Text style={[ui.sub, { marginTop: 0 }]}>nobody yet</Text>}
          {p.joining.map(name => (
            <View key={name} style={{ marginRight: 4 }}>
              <Avatar characterId={characters[name] || 'fox'} size={22} />
            </View>
          ))}
        </View>

        <View style={[ui.row, { marginTop: 6 }]}>
          {pillBtn(iAmIn ? 'Leave' : "I'm in", () => toggleJoin(p))}
          {pillBtn('Google Maps', () => openPlace({ name: p.spotName, address: p.address }))}
          {pillBtn('Edit', () => setEditingPlan(p))}
          {locked ? (
            onOpenBookings ? pillBtn('Bookings', onOpenBookings) : null
          ) : (
            pillBtn('Delete', () => removePlan(p), {
              pill: ui.pillDanger,
              text: ui.pillDangerText,
            })
          )}
        </View>
      </View>
    );
  };

  const hasLogistics = travel.length || checkingOut.length || stayingTonight.length;

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={screenContent} keyboardShouldPersistTaps="handled">
        {/* Header + day picker */}
        <View style={ui.card}>
          <View style={{ paddingRight: 44 }}>
            <Text style={ui.kicker}>DAY BY DAY</Text>
            <Text style={ui.h2}>Itinerary</Text>
            <Text style={ui.sub}>A little plan for every part of the adventure.</Text>
          </View>

          <TripDates />

          {/* The word TODAY sits above today's pill, so the pill text stays short.
              alignItems: 'flex-end' keeps every pill on the same line. */}
          <HScroll style={{ marginTop: 4 }} contentContainerStyle={{ alignItems: 'flex-end' }}>
            {DAYS.map((d, index) => {
              const isToday = d.iso === today;
              return (
                <View key={d.iso} style={{ alignItems: 'center' }}>
                  {isToday ? <Text style={styles.todayTag}>TODAY</Text> : null}
                  <TouchableOpacity
                    style={[
                      ui.pill,
                      ui.pillSmall,
                      isToday && { borderColor: TODAY_COLOUR },
                      index === selected && ui.pillActive,
                    ]}
                    onPress={() => {
                      pickedRef.current = true;
                      setSelected(index);
                    }}
                  >
                    <Text style={[ui.pillText, ui.pillTextSmall]}>
                      {`Day ${d.dayNumber}\u2009-\u2009${monthDay(d.iso)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </HScroll>

          <Text style={[ui.h3, { marginTop: 2 }]}>
            {`Day ${day.dayNumber}\u2009-\u2009${monthDay(day.iso)} (${day.weekday})${
              day.iso === today ? ' · Today' : ''
            }`}
          </Text>
        </View>

        {/* Stay & travel: logistics, kept apart from the activities */}
        <View style={ui.card}>
          <Text style={ui.h3}>Stay & travel</Text>

          {!hasLogistics && empty('No transport or stay for this day. Add details in Bookings.')}

          {travel.map(renderTravel)}
          {checkingOut.map(s =>
            renderStay(
              s,
              'checkout',
              'CHECK-OUT',
              `Check out of ${s.name}`,
              s.checkOutTime ? [`by ${s.checkOutTime}`] : []
            )
          )}
          {stayingTonight.map(s =>
            renderStay(
              s,
              'staying',
              'STAYING TONIGHT',
              s.name,
              [
                s.address,
                s.checkIn === day.iso
                  ? `Check-in today${s.checkInTime ? ` from ${s.checkInTime}` : ''}`
                  : '',
                s.confirmation ? `Confirmation: ${s.confirmation}` : '',
              ].filter(Boolean)
            )
          )}
        </View>

        {/* The day's plan as a timeline */}
        <View style={ui.card}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={ui.h3}>{day.iso === today ? "Today's plan" : "Day's plan"}</Text>
              <Text style={ui.sub}>Things to do, in time order</Text>
            </View>
            {untimedPlans.length > 1 ? pillBtn('↕ Reorder', () => setReordering(true)) : null}
          </View>

          {stops.length === 0 &&
            empty('No plans for this day. Add spots from the Spots tab, or book an activity in Bookings.')}

          <View style={{ marginTop: 8 }}>
            {stops.map((p, index) => (
              <View key={p.id} style={styles.tlRow}>
                <View style={styles.tlRail}>
                  <View
                    style={[
                      styles.tlDot,
                      { backgroundColor: p.source === 'booking' ? P.mint : P.gold },
                    ]}
                  >
                    <Text style={styles.tlDotText}>{index + 1}</Text>
                  </View>
                  {index < stops.length - 1 ? <View style={styles.tlLine} /> : null}
                </View>
                <View style={styles.tlBody}>{renderStopCard(p, index)}</View>
              </View>
            ))}
          </View>
        </View>

        {/* Day route in Google Maps */}
        {stops.length > 0 ? (
          <View style={ui.card}>
            <Text style={ui.h3}>Day route</Text>
            <Text style={ui.sub}>Open this day's stops, in order, in Google Maps.</Text>
            <View style={[ui.row, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[ui.pill, ui.pillPrimary]}
                onPress={() =>
                  openRoute(stops.map(p => ({ name: p.spotName, address: p.address })))
                }
              >
                <Text style={ui.pillText}>🗺️ Open route in Google Maps</Text>
              </TouchableOpacity>
            </View>
            <Text style={ui.hint}>
              Stops without an address are searched by name, so adding addresses gives the best result.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <ReorderModal
        visible={reordering}
        plans={untimedPlans}
        onSave={saveOrder}
        onClose={() => setReordering(false)}
      />
      <EditPlanModal
        plan={editingPlan}
        characters={characters}
        onSave={savePlanEdit}
        onClose={() => setEditingPlan(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // stay / travel strips: tight bubble. Their colours are in STRIP at the top of this file.
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 7,
    marginTop: 4,
  },
  stripIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: P.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  stripLabel: { color: P.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  // timeline: just a thin rail with the stop number; the time is inside each card
  tlRow: { flexDirection: 'row' },
  tlRail: { width: 20, alignItems: 'center' },
  tlDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: P.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotText: { color: P.ink, fontSize: 10, fontWeight: '800' },
  tlLine: { flex: 1, width: 3, backgroundColor: P.line, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 8, paddingLeft: 4 },
  cardTime: { color: P.ink, fontSize: 12, fontWeight: '800', fontFamily: MONO },

  // the small TODAY word above today's day pill (its colour follows TODAY_COLOUR at the top)
  todayTag: { color: TODAY_COLOUR, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 0 },
});