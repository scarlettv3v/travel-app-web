import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import { useTrip } from './trip';
import TripDates from './TripDates';
import { getCategory } from './categories';
import ReorderModal from './ReorderModal';
import EditPlanModal from './EditPlanModal';
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
export default function ItineraryScreen({ authToken, profile, onOpenBookings }) {
  const { days: DAYS } = useTrip();
  const [selected, setSelected] = useState(0);
  const [transport, setTransport] = useState([]);
  const [stays, setStays] = useState([]);
  const [plans, setPlans] = useState([]);
  const [characters, setCharacters] = useState({});
  const [reordering, setReordering] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

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

  const savePlanEdit = async (plan, date, time) => {
    try {
      let mask = 'updateMask.fieldPaths=date&updateMask.fieldPaths=time';
      // Moving to another day clears the manual order, so it sorts by time there
      if (date !== plan.date) mask += '&updateMask.fieldPaths=order';

      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${plan.id}?${mask}`,
        authToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              date: { stringValue: date },
              time: { stringValue: time },
            },
          }),
        }
      );
      await loadAll();
    } catch (error) {
      console.error('Error editing plan:', error);
      alert('Could not save the changes.');
    }
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
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          {names.slice(0, 4).map(n => (
            <View key={n} style={{ marginLeft: 2 }}>
              <Avatar characterId={characters[n] || 'fox'} size={22} />
            </View>
          ))}
        </View>
        {names.length > 4 ? (
          <Text style={{ color: P.muted, fontSize: 11 }}>+{names.length - 4}</Text>
        ) : null}
      </View>
    ) : null;

  // a transport strip: blue, compact, clearly "getting there"
  const renderTravel = ({ t, dir }) => (
    <View key={t.id + dir} style={[styles.strip, styles.travelStrip]}>
      <View style={styles.stripIcon}>
        <Text style={{ fontSize: 18 }}>{TRANSPORT_EMOJI[t.type] || '✈️'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stripLabel}>
          {dir === 'arrive' ? `ARRIVES ${t.arriveTime || ''}` : `DEPARTS ${t.departTime || 'TIME TBC'}`}
        </Text>
        <Text style={ui.strong}>
          {t.from} → {t.to}
        </Text>
        <Text style={[ui.sub, { fontSize: 12 }]}>
          {[t.provider, t.reference].filter(Boolean).join(' ')}
          {t.confirmation ? ` · Conf: ${t.confirmation}` : ''}
        </Text>
        {dir === 'depart' && t.arriveTime ? (
          <Text style={[ui.sub, { fontSize: 12 }]}>
            Arrives {t.arriveDate !== day.iso ? `${t.arriveDate} ` : ''}
            {t.arriveTime}
          </Text>
        ) : null}
      </View>
      {renderJoiners(t.joining)}
    </View>
  );

  // a stay strip: lavender, "where you sleep"
  const renderStay = (s, label, title, sub) => (
    <View key={s.id + label} style={[styles.strip, styles.stayStrip]}>
      <View style={styles.stripIcon}>
        <Text style={{ fontSize: 18 }}>{label === 'CHECK-OUT' ? '🧳' : '🏨'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stripLabel}>{label}</Text>
        <Text style={ui.strong}>{title}</Text>
        {sub.map((line, i) => (
          <Text key={i} style={[ui.sub, { fontSize: 12 }]}>
            {line}
          </Text>
        ))}
        <View style={[ui.row, { marginTop: 8 }]}>
          {pillBtn('Google Maps', () => openPlace({ name: s.name, address: s.address }))}
        </View>
      </View>
      {renderJoiners(s.joining)}
    </View>
  );

  // a card in the plan timeline
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
        <View style={[ui.tag, locked && { backgroundColor: P.mint }]}>
          <Text style={ui.tagText}>
            {locked
              ? '🔒 Booked · from Bookings'
              : `${getCategory(p.category).emoji} ${getCategory(p.category).label}`}
          </Text>
        </View>

        <Text style={[ui.h3, { marginTop: 8 }]}>
          {locked ? `${emoji} ` : ''}
          {p.spotName}
        </Text>

        {locked && p.partySize ? <Text style={ui.sub}>Party of {p.partySize}</Text> : null}
        {p.address ? <Text style={ui.sub}>📍 {p.address}</Text> : null}
        {locked && p.confirmation ? <Text style={ui.sub}>Confirmation: {p.confirmation}</Text> : null}
        {p.note ? <LinkText style={ui.sub}>{p.note}</LinkText> : null}

        <View style={[ui.row, { marginTop: 10 }]}>
          <Text style={[ui.sub, { marginTop: 0 }]}>Joining: </Text>
          {p.joining.length === 0 && <Text style={[ui.sub, { marginTop: 0 }]}>nobody yet</Text>}
          {p.joining.map(name => (
            <View key={name} style={{ marginRight: 4 }}>
              <Avatar characterId={characters[name] || 'fox'} size={24} />
            </View>
          ))}
        </View>


        <View style={[ui.row, { marginTop: 12 }]}>
          {pillBtn(iAmIn ? 'Leave' : "I'm in", () => toggleJoin(p))}
          {locked ? (
            <>
              {pillBtn('Google Maps', () => openPlace({ name: p.spotName, address: p.address }))}
              {onOpenBookings ? pillBtn('Manage in Bookings', onOpenBookings) : null}
            </>
          ) : (
            <>
              {pillBtn('Google Maps', () =>
                openPlace({ name: p.spotName, address: p.address })
              )}
              {pillBtn('Edit', () => setEditingPlan(p))}
              {pillBtn('Delete', () => removePlan(p), {
                pill: ui.pillDanger,
                text: ui.pillDangerText,
              })}
            </>
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
            {DAYS.map((d, index) => (
              <TouchableOpacity
                key={d.iso}
                style={[ui.pill, ui.pillSmall, index === selected && ui.pillActive]}
                onPress={() => setSelected(index)}
              >
           <Text style={[ui.pillText, ui.pillTextSmall]}>
  {`Day ${d.dayNumber}\u2009-\u2009${monthDay(d.iso)}`}
</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

         <Text style={[ui.h3, { marginTop: 8 }]}>
  {`Day ${day.dayNumber}\u2009-\u2009${monthDay(day.iso)} (${day.weekday})`}
</Text>
        </View>

        {/* Stay & travel: logistics, kept apart from the activities */}
        <View style={ui.card}>
          <Text style={ui.h3}>Stay & travel</Text>
          <Text style={ui.sub}>Getting around and where you sleep</Text>

          {!hasLogistics && empty('No transport or stay for this day. Add details in Bookings.')}

          {travel.map(renderTravel)}
          {checkingOut.map(s =>
            renderStay(
              s,
              'CHECK-OUT',
              `Check out of ${s.name}`,
              s.checkOutTime ? [`by ${s.checkOutTime}`] : []
            )
          )}
          {stayingTonight.map(s =>
            renderStay(
              s,
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
              <Text style={ui.h3}>Today's plan</Text>
              <Text style={ui.sub}>Things to do, in time order</Text>
            </View>
            {untimedPlans.length > 1 ? pillBtn('↕ Reorder', () => setReordering(true)) : null}
          </View>

          {stops.length === 0 &&
            empty('No plans for this day. Add spots from the Spots tab, or book an activity in Bookings.')}

          <View style={{ marginTop: 14 }}>
            {stops.map((p, index) => (
              <View key={p.id} style={styles.tlRow}>
                <View style={styles.tlTime}>
                  <Text style={styles.tlTimeText}>{p.time || '—'}</Text>
                </View>
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
            <Text style={ui.sub}>Open today's stops, in order, in Google Maps.</Text>
            <View style={[ui.row, { marginTop: 12 }]}>
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
        onSave={savePlanEdit}
        onClose={() => setEditingPlan(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // stay / travel strips
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  travelStrip: { backgroundColor: '#dbeeff', borderColor: '#5ba3c7' },
  stayStrip: { backgroundColor: '#eadcf3', borderColor: '#9b7bc4' },
  stripIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: P.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stripLabel: { color: P.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // timeline
  tlRow: { flexDirection: 'row' },
  tlTime: { width: 46, paddingTop: 5, alignItems: 'flex-end', paddingRight: 6 },
  tlTimeText: { color: P.muted, fontSize: 12, fontWeight: '800', fontFamily: MONO },
  tlRail: { width: 30, alignItems: 'center' },
  tlDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: P.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlDotText: { color: P.ink, fontSize: 12, fontWeight: '800' },
  tlLine: { flex: 1, width: 3, backgroundColor: P.line, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 14, paddingLeft: 6 },
});