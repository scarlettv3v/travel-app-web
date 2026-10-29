import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import {
  BASE_CURRENCY as LEGACY_BASE, // expenses saved before the trip currency existed were in this
  CURRENCIES,
} from './expenseOptions';
import Popup from './Popup';
import { P, ui, screenContent } from './ui';
import { useTrip } from './trip';
import { store, useOnline, isOnlineNow, isNetworkError, getRate } from './offline';

const money = n => Number(n).toFixed(2);
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const PENDING_KEY = 'pending-expenses'; // expenses saved on this phone, waiting to be sent
const PENDING_PREFIX = 'pending:';

// An id the app makes up itself, so a retry can never create the same expense twice
const newDocId = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Turns a waiting expense into the format the database expects
const toFields = item => ({
  what: { stringValue: item.what },
  amount: { doubleValue: item.amount },
  currency: { stringValue: item.currency },
  rate: { doubleValue: item.rate },
  amountBase: { doubleValue: item.amountBase },
  baseCurrency: { stringValue: item.baseCurrency || LEGACY_BASE },
  payer: { stringValue: item.payer },
  split: { arrayValue: { values: item.split.map(name => ({ stringValue: name })) } },
  category: { stringValue: 'other' },
  addedByName: { stringValue: item.addedByName || '' },
  addedByCharacter: { stringValue: item.addedByCharacter || '' },
});

// A row of pill buttons; `selected(id)` says which are on
function Pills({ items, selected, onPress }) {
  return (
    <View style={ui.row}>
      {items.map(([id, label]) => (
        <TouchableOpacity
          key={id}
          onPress={() => onPress(id)}
          style={[ui.pill, ui.pillSmall, selected(id) && ui.pillActive]}
        >
          <Text style={[ui.pillText, ui.pillTextSmall]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ExpensesScreen({ authToken, profile, defaultCurrency }) {
  const scrollRef = useRef(null);
  const online = useOnline();
  const trip = useTrip();
  const base = trip.currency; // the trip's local currency; totals are worked out in this

  // Start from what was saved last time, so the screen is not empty when offline
  const [members, setMembers] = useState(() => store.get('cache-members', []));
  const [expenses, setExpenses] = useState(() => store.get('cache-expenses', []));
  const [pending, setPending] = useState(() => store.get(PENDING_KEY, []));
  const pendingRef = useRef(pending);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editOrig, setEditOrig] = useState(null); // { currency, rate } of the expense being edited

  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(base);
  const [rate, setRate] = useState('1');
  const [rateNote, setRateNote] = useState('');
  const [payer, setPayer] = useState('');
  const [split, setSplit] = useState([]);

  const [displayCurrency, setDisplayCurrency] = useState(defaultCurrency || base);
  const [displayRate, setDisplayRate] = useState(1);
  const [displayNote, setDisplayNote] = useState('');

  // The default currency is only for showing totals. It is added to the buttons if it is not
  // already in the list, so it can be picked for "Show totals in" and for expenses.
  const currencyList = [...new Set([base, ...CURRENCIES, ...(defaultCurrency ? [defaultCurrency] : [])])];

  // If the default currency arrives or changes after this screen opens, totals follow it
  useEffect(() => {
    setDisplayCurrency(defaultCurrency || base);
  }, [defaultCurrency, base]);

  // Keeps the waiting list in memory, on screen and on the phone
  const updatePending = fn => {
    const next = fn(pendingRef.current);
    pendingRef.current = next;
    store.set(PENDING_KEY, next);
    setPending(next);
  };

  const loadAll = useCallback(async () => {
    if (!isOnlineNow()) return; // no signal: keep showing what we have

    try {
      const membersResponse = await firestoreFetch(
        `${FIRESTORE_BASE}/profiles?pageSize=300`,
        authToken
      );
      const membersData = await membersResponse.json();

      const nextMembers = (membersData.documents || [])
        .map(doc => ({
          id: doc.name,
          name: doc.fields?.name?.stringValue || '',
          character: doc.fields?.character?.stringValue || 'fox',
        }))
        .filter(member => member.name);
      setMembers(nextMembers);
      store.set('cache-members', nextMembers);

      const expensesResponse = await firestoreFetch(
        `${FIRESTORE_BASE}/expenses?pageSize=300`,
        authToken
      );
      const expensesData = await expensesResponse.json();

      const nextExpenses = (expensesData.documents || []).map(doc => {
        const f = doc.fields || {};
        const amount = Number(f.amount?.doubleValue ?? f.amount?.integerValue ?? 0);
        const rate = Number(f.rate?.doubleValue ?? f.rate?.integerValue ?? 1);
        const amountBase =
          f.amountBase?.doubleValue !== undefined || f.amountBase?.integerValue !== undefined
            ? Number(f.amountBase.doubleValue ?? f.amountBase.integerValue)
            : amount * rate;

        return {
          id: doc.name,
          what: f.what?.stringValue || '',
          amount,
          currency: f.currency?.stringValue || LEGACY_BASE,
          rate,
          amountBase,
          baseCurrency: f.baseCurrency?.stringValue || LEGACY_BASE,
          category: f.category?.stringValue || 'other',
          payer: f.payer?.stringValue || '',
          split: (f.split?.arrayValue?.values || []).map(v => v.stringValue),
          addedByName: f.addedByName?.stringValue || '',
          addedByCharacter: f.addedByCharacter?.stringValue || '',
        };
      });
      setExpenses(nextExpenses);
      store.set('cache-expenses', nextExpenses);
    } catch (error) {
      if (!isNetworkError(error)) console.error('Error loading expenses:', error);
    }
  }, [authToken]);

  // Sends the expenses saved on this phone, one by one. Whatever fails stays in the list
  // and is tried again later.
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current || !authToken || !isOnlineNow()) return;
    flushing.current = true;
    let sent = 0;

    try {
      for (const item of [...pendingRef.current]) {
        try {
          await firestoreFetch(
            `${FIRESTORE_BASE}/expenses?documentId=${item.docId}`,
            authToken,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: toFields(item) }),
            }
          );
        } catch (error) {
          // 409 = this one was already saved (the reply got lost), so it counts as sent
          if (!String(error.message).includes('(409)')) throw error;
        }
        updatePending(list => list.filter(p => p.docId !== item.docId));
        sent += 1;
      }
    } catch (error) {
      if (!isNetworkError(error)) console.error('Error syncing expenses:', error);
    } finally {
      flushing.current = false;
    }

    if (sent) loadAll();
  }, [authToken, loadAll]);

  // On open, every 5 seconds, and straight away when the signal comes back
  useEffect(() => {
    if (!authToken) return undefined;
    const run = async () => {
      await flush();
      await loadAll();
    };
    run();
    const timer = setInterval(run, 5000);
    return () => clearInterval(timer);
  }, [authToken, flush, loadAll, online]);

  // Remember today's exchange rates so they can still be used offline
  useEffect(() => {
    if (online) getRate(base, 'USD');
  }, [online, base]);

  // Rate for the form: live rate, or the saved rate when editing with the same currency
  useEffect(() => {
    if (!showForm) return undefined;

    if (currency === base) {
      setRate('1');
      setRateNote('');
      return undefined;
    }

    if (editOrig && currency === editOrig.currency) {
      setRate(String(editOrig.rate));
      setRateNote('Saved rate for this expense. Edit it if needed.');
      return undefined;
    }

    let active = true;
    setRateNote('Fetching rate...');

    getRate(currency, base).then(({ rate: r, cached }) => {
      if (!active) return;
      if (r) {
        setRate(String(Number(r.toPrecision(5))));
        setRateNote(
          cached
            ? 'Offline: using the last saved rate. Edit it if your bank or card rate differs.'
            : 'Live rate. Edit it if your bank or card rate differs.'
        );
      } else {
        setRate('');
        setRateNote('Could not get the rate. Please type it in.');
      }
    });

    return () => {
      active = false;
    };
  }, [currency, showForm, editOrig, base]);

  // Rate for showing the totals in another currency
  useEffect(() => {
    if (displayCurrency === base) {
      setDisplayRate(1);
      setDisplayNote('');
      return undefined;
    }

    let active = true;
    setDisplayRate(null);
    setDisplayNote('Fetching rate...');

    getRate(base, displayCurrency).then(({ rate: r, cached }) => {
      if (!active) return;
      if (r) {
        setDisplayRate(r);
        setDisplayNote(
          `1 ${base} = ${Number(r.toPrecision(5))} ${displayCurrency} (${
            cached ? 'last saved rate' : 'live rate'
          })`
        );
      } else {
        setDisplayNote('Could not get the rate, showing ' + base + '.');
      }
    });

    return () => {
      active = false;
    };
  }, [displayCurrency, base]);

  // Expenses on screen = saved ones + the ones still waiting to be sent
  const savedIds = new Set(expenses.map(e => e.id.split('/').pop()));
  const waiting = pending
    .filter(p => !savedIds.has(p.docId))
    .map(p => ({
      id: PENDING_PREFIX + p.docId,
      pending: true,
      what: p.what,
      amount: p.amount,
      currency: p.currency,
      rate: p.rate,
      amountBase: p.amountBase,
      baseCurrency: p.baseCurrency || base,
      category: 'other',
      payer: p.payer,
      split: p.split,
      addedByName: p.addedByName,
      addedByCharacter: p.addedByCharacter,
    }))
    .reverse();
  const rawExpenses = [...waiting, ...expenses];

  // If the trip currency was changed after some expenses were saved, those expenses are
  // converted into the current trip currency (live rate, or the last saved one when offline)
  const [oldBaseRates, setOldBaseRates] = useState({});
  const otherBases = [...new Set(rawExpenses.map(e => e.baseCurrency).filter(c => c && c !== base))];
  const otherKey = otherBases.join(',');
  useEffect(() => {
    let active = true;
    otherBases.forEach(code => {
      getRate(code, base).then(({ rate: r }) => {
        if (active && r) {
          setOldBaseRates(prev => (prev[`${code}>${base}`] === r ? prev : { ...prev, [`${code}>${base}`]: r }));
        }
      });
    });
    return () => {
      active = false;
    };
  }, [otherKey, base]);

  const allExpenses = rawExpenses.map(e => {
    if (e.baseCurrency === base) return e;
    if (e.currency === base) return { ...e, amountBase: e.amount, baseCurrency: base, converted: true };
    const r = oldBaseRates[`${e.baseCurrency}>${base}`];
    return { ...e, amountBase: r ? e.amountBase * r : e.amountBase, baseCurrency: base, converted: true };
  });

  const scrollTop = () => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true });
  };

  const openForm = () => {
    setEditingId(null);
    setEditOrig(null);
    setWhat('');
    setAmount('');
    setCurrency(base); // new expenses start in the local (trip) currency
    setRate('1');
    setRateNote('');
    setPayer(profile.name);
    setSplit(members.map(member => member.name));
    setShowForm(true);
    scrollTop();
  };

  const startEdit = expense => {
    setEditingId(expense.id);
    // a saved rate is only reusable if it was against the current trip currency
    setEditOrig(expense.converted ? null : { currency: expense.currency, rate: expense.rate });
    setWhat(expense.what);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setRate(String(expense.rate));
    setRateNote('');
    setPayer(expense.payer);
    setSplit(expense.split);
    setShowForm(true);
    scrollTop();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditOrig(null);
  };

  const toggleSplit = name => {
    setSplit(previous =>
      previous.includes(name)
        ? previous.filter(person => person !== name)
        : [...previous, name]
    );
  };

  const numericAmount = Number(amount.replace(',', '.'));
  const numericRate = Number(rate.replace(',', '.'));
  const previewBase =
    Number.isFinite(numericAmount) && Number.isFinite(numericRate)
      ? numericAmount * numericRate
      : 0;

  const needsSignal = () =>
    alert(
      "You're offline. New expenses are saved on this phone and sent later, but changing or deleting an expense that is already saved needs a connection."
    );

  const saveExpense = async () => {
    if (
      !what.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !Number.isFinite(numericRate) ||
      numericRate <= 0 ||
      !payer ||
      split.length === 0
    ) {
      alert(
        'Enter a description, a valid amount and exchange rate, select who paid, and select who shares it.'
      );
      return;
    }

    const values = {
      what: what.trim(),
      amount: numericAmount,
      currency,
      rate: numericRate,
      amountBase: numericAmount * numericRate,
      baseCurrency: base,
      payer,
      split,
    };

    // Editing one that is still waiting on this phone: just update it there
    if (editingId && editingId.startsWith(PENDING_PREFIX)) {
      const docId = editingId.slice(PENDING_PREFIX.length);
      updatePending(list => list.map(p => (p.docId === docId ? { ...p, ...values } : p)));
      closeForm();
      flush();
      return;
    }

    // Editing one that is already saved: needs a connection
    if (editingId) {
      const fields = {
        what: { stringValue: values.what },
        amount: { doubleValue: values.amount },
        currency: { stringValue: values.currency },
        rate: { doubleValue: values.rate },
        amountBase: { doubleValue: values.amountBase },
        baseCurrency: { stringValue: base },
        payer: { stringValue: values.payer },
        split: { arrayValue: { values: values.split.map(name => ({ stringValue: name })) } },
      };

      try {
        // Editing: only change these fields, keep "Added by" as it was
        const mask = Object.keys(fields)
          .map(key => `updateMask.fieldPaths=${key}`)
          .join('&');

        await firestoreFetch(
          `https://firestore.googleapis.com/v1/${editingId}?${mask}`,
          authToken,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          }
        );
        closeForm();
        await loadAll();
      } catch (error) {
        if (isNetworkError(error) || !isOnlineNow()) {
          needsSignal();
        } else {
          console.error('Error saving expense:', error);
          alert('Could not save expense.');
        }
      }
      return;
    }

    // New expense: saved on this phone first, then sent. Works with no signal.
    updatePending(list => [
      ...list,
      {
        docId: newDocId(),
        ...values,
        addedByName: profile.name,
        addedByCharacter: profile.character,
      },
    ]);
    closeForm();
    flush();
  };

  const deleteExpense = async id => {
    // Still waiting on this phone: just remove it
    if (id.startsWith(PENDING_PREFIX)) {
      const docId = id.slice(PENDING_PREFIX.length);
      updatePending(list => list.filter(p => p.docId !== docId));
      if (id === editingId) closeForm();
      return;
    }

    try {
      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${id}`,
        authToken,
        { method: 'DELETE' }
      );
      if (id === editingId) closeForm();
      await loadAll();
    } catch (error) {
      if (isNetworkError(error) || !isOnlineNow()) {
        needsSignal();
      } else {
        console.error('Error deleting expense:', error);
        alert('Could not delete expense.');
      }
    }
  };

  // Simplest transfers to settle up, all in the base currency
  const calculateTransfers = () => {
    const balances = {};

    allExpenses.forEach(expense => {
      if (!expense.split.length) return;
      const share = expense.amountBase / expense.split.length;

      expense.split.forEach(name => {
        balances[name] = (balances[name] || 0) - share;
      });
      balances[expense.payer] = (balances[expense.payer] || 0) + expense.amountBase;
    });

    const debtors = Object.entries(balances)
      .filter(([, balance]) => balance < -0.005)
      .map(([name, balance]) => ({ name, amount: -balance }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Object.entries(balances)
      .filter(([, balance]) => balance > 0.005)
      .map(([name, balance]) => ({ name, amount: balance }))
      .sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const value = Math.min(debtors[d].amount, creditors[c].amount);
      transfers.push({ from: debtors[d].name, to: creditors[c].name, amount: value });
      debtors[d].amount -= value;
      creditors[c].amount -= value;
      if (debtors[d].amount < 0.005) d++;
      if (creditors[c].amount < 0.005) c++;
    }

    return transfers;
  };

  // Who paid what: what each person paid, their share of the costs, and the difference
  const buildPaid = () => {
    const paid = {};
    const share = {};
    allExpenses.forEach(expense => {
      paid[expense.payer] = (paid[expense.payer] || 0) + expense.amountBase;
      if (!expense.split.length) return;
      const each = expense.amountBase / expense.split.length;
      expense.split.forEach(n => {
        share[n] = (share[n] || 0) + each;
      });
    });
    const names = [
      ...new Set([...members.map(m => m.name), ...Object.keys(paid), ...Object.keys(share)]),
    ];
    return names.map(name => ({
      name,
      paid: paid[name] || 0,
      share: share[name] || 0,
      balance: (paid[name] || 0) - (share[name] || 0),
    }));
  };

  const factor = displayRate || 1;
  const shownCurrency = displayRate ? displayCurrency : base;
  const show = n => money(n * factor);

  const transfers = calculateTransfers();
  const paidRows = buildPaid();
  const totalSpent = allExpenses.reduce((sum, e) => sum + e.amountBase, 0);
  const characterOf = name => members.find(m => m.name === name)?.character;
  // the person who is furthest behind on paying their share
  const behind = paidRows.reduce((low, r) => (!low || r.balance < low.balance ? r : low), null);
  const nextPayer = allExpenses.length && behind && behind.balance < -0.005 ? behind : null;

  const memberItems = members.map(m => [m.name, m.name]);

  return (
    <View style={ui.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={screenContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header + add button + form */}
        <View style={ui.card}>
          <View style={{ paddingRight: 44 }}>
            <Text style={ui.kicker}>SPLIT THE LITTLE THINGS</Text>
            <Text style={ui.h2}>Expenses</Text>
            <Text style={ui.sub}>See what you spent and settle up together.</Text>
          </View>

          {!online || pending.length > 0 ? (
            <View style={[ui.notice, { marginTop: 12 }]}>
              <Text style={ui.noticeText}>
                {!online
                  ? "📴 You're offline. New expenses are saved on this phone and sent when you're back online."
                  : '🔄 Sending your saved expenses...'}
                {pending.length > 0
                  ? `\n⏳ ${pending.length} expense${pending.length === 1 ? '' : 's'} waiting to sync.`
                  : ''}
              </Text>
            </View>
          ) : null}

          <View style={[ui.row, { marginTop: 12 }]}>
            {members.map(member => (
              <View key={member.id} style={styles.person}>
                <Avatar characterId={member.character} size={22} />
                <Text style={[ui.pillText, ui.pillTextSmall, { marginLeft: 6 }]}>
                  {member.name}
                </Text>
              </View>
            ))}
          </View>

          {!showForm && (
            <View style={[ui.row, { marginTop: 8 }]}>
              <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={openForm}>
                <Text style={ui.pillText}>+ Add expense</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

        {/* Total spent + settle up */}
        <View style={ui.card}>
          <Text style={ui.h3}>Total spent</Text>

          <Text style={ui.label}>Show totals in</Text>
          <Pills
            items={currencyList.map(code => [code, code])}
            selected={id => displayCurrency === id}
            onPress={setDisplayCurrency}
          />
          {displayNote ? <Text style={ui.hint}>{displayNote}</Text> : null}

          <View style={styles.metric}>
            <Text style={styles.metricText}>
              {shownCurrency} {show(totalSpent)}
            </Text>
          </View>

          <View style={ui.panel}>
            <Text style={ui.h3}>Who owes who</Text>
            {transfers.length === 0 ? (
              <View style={ui.notice}>
                <Text style={ui.noticeText}>
                  {allExpenses.length === 0 ? 'No balances to settle yet.' : 'Everyone is settled up! 🎉'}
                </Text>
              </View>
            ) : (
              transfers.map((transfer, index) => (
                <Text key={index} style={[ui.sub, { color: P.ink, marginTop: 8 }]}>
                  {transfer.from} → {transfer.to}:{' '}
                  <Text style={{ fontWeight: '800' }}>
                    {shownCurrency} {show(transfer.amount)}
                  </Text>
                </Text>
              ))
            )}
          </View>

          <View style={ui.panel}>
            <Text style={ui.h3}>Who paid what</Text>
            {allExpenses.length === 0 ? (
              <View style={ui.notice}>
                <Text style={ui.noticeText}>Add an expense to see who has paid what.</Text>
              </View>
            ) : (
              <View>
                {paidRows.map(r => {
                  const even = Math.abs(r.balance) < 0.005;
                  return (
                    <View key={r.name} style={styles.paidRow}>
                      <Avatar characterId={characterOf(r.name) || 'fox'} size={26} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={ui.strong}>{r.name}</Text>
                        <Text style={[ui.sub, { fontSize: 12 }]}>
                          Paid {shownCurrency} {show(r.paid)} · Share {shownCurrency} {show(r.share)}
                        </Text>
                      </View>
                      <View
                        style={[
                          ui.tag,
                          { backgroundColor: even ? '#fff' : r.balance > 0 ? P.mint : P.warnBg },
                        ]}
                      >
                        <Text style={ui.tagText}>
                          {even
                            ? 'Even'
                            : r.balance > 0
                            ? `+${show(r.balance)}`
                            : `−${show(-r.balance)}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                <View style={ui.notice}>
                  <Text style={ui.noticeText}>
                    {nextPayer
                      ? `💳 Next to pay: ${nextPayer.name} (has paid the least compared with their share)`
                      : 'Everyone is even right now.'}
                  </Text>
                </View>
              </View>
            )}
            <Text style={ui.hint}>
              The number on the right is what they paid minus their share. Plus means others owe them,
              minus means they owe others.
            </Text>
          </View>
        </View>

        {/* All expenses */}
        <View style={ui.card}>
          <Text style={ui.h3}>All expenses ({allExpenses.length})</Text>

          {allExpenses.length === 0 && (
            <View style={ui.notice}>
              <Text style={ui.noticeText}>
                No expenses yet. Add one above to start splitting costs.
              </Text>
            </View>
          )}

          {allExpenses.map(expense => (
            <View key={expense.id} style={ui.listCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[ui.strong, { flex: 1, marginRight: 8 }]}>
                  {expense.what}
                </Text>
                <Text style={[ui.strong, { fontFamily: MONO }]}>
                  {expense.currency} {money(expense.amount)}
                </Text>
              </View>

              {expense.pending ? (
                <Text style={[ui.sub, { fontWeight: '800' }]}>⏳ Waiting to sync</Text>
              ) : null}

              {expense.currency !== base ? (
                <Text style={ui.sub}>
                  ≈ {base} {money(expense.amountBase)}{expense.converted ? '' : ` (rate ${expense.rate})`}
                </Text>
              ) : null}

              <Text style={ui.sub}>
                Paid by {expense.payer} · split {expense.split.length} ways
                {expense.split.length ? ` (${expense.split.join(', ')})` : ''}
              </Text>

              {expense.addedByCharacter ? (
                <View style={ui.byRow}>
                  <Avatar characterId={expense.addedByCharacter} size={22} />
                  <Text style={[ui.sub, { marginTop: 0, marginLeft: 8 }]}>
                    Added by {expense.addedByName}
                  </Text>
                </View>
              ) : null}

              <View style={[ui.row, { marginTop: 12 }]}>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall]}
                  onPress={() => startEdit(expense)}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[ui.pill, ui.pillSmall, ui.pillDanger]}
                  onPress={() => deleteExpense(expense.id)}
                >
                  <Text style={[ui.pillText, ui.pillTextSmall, ui.pillDangerText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add / edit popup */}
      <Popup visible={showForm} onClose={closeForm}>
        <View>
              <Text style={ui.kicker}>EXPENSE</Text>
              <Text style={ui.h2}>{editingId ? 'Edit expense' : 'Add expense'}</Text>

              <Text style={ui.label}>Description</Text>
              <TextInput
                style={ui.field}
                placeholder="What was it for? (e.g. Petrol)"
                placeholderTextColor="#8a9ca6"
                value={what}
                onChangeText={setWhat}
              />

              <Text style={ui.label}>Amount</Text>
              <TextInput
                style={ui.field}
                placeholder="0.00"
                placeholderTextColor="#8a9ca6"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />

              <Text style={ui.label}>Currency</Text>
              <Pills
                items={currencyList.map(code => [code, code])}
                selected={id => currency === id}
                onPress={setCurrency}
              />

              {currency !== base && (
                <View>
                  <View style={[ui.row, { marginTop: 4 }]}>
                    <Text style={[ui.sub, { marginTop: 0, marginRight: 8 }]}>1 {currency} =</Text>
                    <TextInput
                      style={[ui.field, { width: 110 }]}
                      value={rate}
                      onChangeText={setRate}
                      keyboardType="decimal-pad"
                      placeholder="rate"
                      placeholderTextColor="#8a9ca6"
                    />
                    <Text style={[ui.sub, { marginTop: 0, marginLeft: 8 }]}>{base}</Text>
                  </View>
                  {rateNote ? <Text style={ui.hint}>{rateNote}</Text> : null}
                  {previewBase > 0 ? (
                    <Text style={[ui.hint, { color: P.ink, fontWeight: '800' }]}>
                      ≈ {base} {money(previewBase)}
                    </Text>
                  ) : null}
                </View>
              )}

              <Text style={ui.label}>Paid by</Text>
              <Pills
                items={memberItems}
                selected={id => payer === id}
                onPress={setPayer}
              />

              <Text style={ui.label}>Split between</Text>
              <View style={ui.row}>
                {members.map(member => {
                  const on = split.includes(member.name);
                  return (
                    <TouchableOpacity
                      key={member.id}
                      onPress={() => toggleSplit(member.name)}
                      style={[ui.pill, ui.pillSmall, on && ui.pillActive]}
                    >
                      <Text style={[ui.pillText, ui.pillTextSmall]}>
                        {on ? '✓ ' : ''}{member.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[ui.row, { marginTop: 14 }]}>
                <TouchableOpacity style={[ui.pill, ui.pillPrimary]} onPress={saveExpense}>
                  <Text style={ui.pillText}>{editingId ? 'Save changes' : 'Save expense'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ui.pill} onPress={closeForm}>
                  <Text style={ui.pillText}>Cancel</Text>
                </TouchableOpacity>
              </View>
        </View>
      </Popup>
    </View>
  );
}

const styles = StyleSheet.create({
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#9dbcae',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  metric: {
    backgroundColor: P.panel,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 17,
    padding: 14,
    marginTop: 14,
  },
  metricText: { color: P.ink, fontSize: 30, fontWeight: '800', fontFamily: MONO },

  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: P.fieldBorder,
  },
});