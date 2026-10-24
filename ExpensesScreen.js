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
  BASE_CURRENCY,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  getExpenseCategory,
} from './expenseOptions';
import Popup from './Popup';
import { P, ui, screenContent } from './ui';

const money = n => Number(n).toFixed(2);
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

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

export default function ExpensesScreen({ authToken, profile }) {
  const scrollRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editOrig, setEditOrig] = useState(null); // { currency, rate } of the expense being edited

  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(BASE_CURRENCY);
  const [rate, setRate] = useState('1');
  const [rateNote, setRateNote] = useState('');
  const [category, setCategory] = useState('food');
  const [payer, setPayer] = useState('');
  const [split, setSplit] = useState([]);

  const [displayCurrency, setDisplayCurrency] = useState(BASE_CURRENCY);
  const [displayRate, setDisplayRate] = useState(1);
  const [displayNote, setDisplayNote] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const membersResponse = await firestoreFetch(
        `${FIRESTORE_BASE}/profiles?pageSize=300`,
        authToken
      );
      const membersData = await membersResponse.json();

      setMembers(
        (membersData.documents || [])
          .map(doc => ({
            id: doc.name,
            name: doc.fields?.name?.stringValue || '',
            character: doc.fields?.character?.stringValue || 'fox',
          }))
          .filter(member => member.name)
      );

      const expensesResponse = await firestoreFetch(
        `${FIRESTORE_BASE}/expenses?pageSize=300`,
        authToken
      );
      const expensesData = await expensesResponse.json();

      setExpenses(
        (expensesData.documents || []).map(doc => {
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
            currency: f.currency?.stringValue || BASE_CURRENCY,
            rate,
            amountBase,
            category: f.category?.stringValue || 'other',
            payer: f.payer?.stringValue || '',
            split: (f.split?.arrayValue?.values || []).map(v => v.stringValue),
            addedByName: f.addedByName?.stringValue || '',
            addedByCharacter: f.addedByCharacter?.stringValue || '',
          };
        })
      );
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [authToken, loadAll]);

  // Rate for the form: live rate, or the saved rate when editing with the same currency
  useEffect(() => {
    if (!showForm) return;

    if (currency === BASE_CURRENCY) {
      setRate('1');
      setRateNote('');
      return;
    }

    if (editOrig && currency === editOrig.currency) {
      setRate(String(editOrig.rate));
      setRateNote('Saved rate for this expense. Edit it if needed.');
      return;
    }

    let active = true;
    setRateNote('Fetching rate...');

    fetch(`https://open.er-api.com/v6/latest/${currency}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        const r = data.rates && data.rates[BASE_CURRENCY];
        if (r) {
          setRate(String(Number(r.toPrecision(5))));
          setRateNote('Live rate. Edit it if your bank or card rate differs.');
        } else {
          setRate('');
          setRateNote('Could not get the rate. Please type it in.');
        }
      })
      .catch(() => {
        if (active) {
          setRate('');
          setRateNote('Could not get the rate. Please type it in.');
        }
      });

    return () => {
      active = false;
    };
  }, [currency, showForm, editOrig]);

  // Rate for showing the totals in another currency
  useEffect(() => {
    if (displayCurrency === BASE_CURRENCY) {
      setDisplayRate(1);
      setDisplayNote('');
      return;
    }

    let active = true;
    setDisplayRate(null);
    setDisplayNote('Fetching rate...');

    fetch(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`)
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        const r = data.rates && data.rates[displayCurrency];
        if (r) {
          setDisplayRate(r);
          setDisplayNote(
            `1 ${BASE_CURRENCY} = ${Number(r.toPrecision(5))} ${displayCurrency} (live rate)`
          );
        } else {
          setDisplayNote('Could not get the rate, showing ' + BASE_CURRENCY + '.');
        }
      })
      .catch(() => {
        if (active) setDisplayNote('Could not get the rate, showing ' + BASE_CURRENCY + '.');
      });

    return () => {
      active = false;
    };
  }, [displayCurrency]);

  const scrollTop = () => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true });
  };

  const openForm = () => {
    setEditingId(null);
    setEditOrig(null);
    setWhat('');
    setAmount('');
    setCurrency(BASE_CURRENCY);
    setRate('1');
    setRateNote('');
    setCategory('food');
    setPayer(profile.name);
    setSplit(members.map(member => member.name));
    setShowForm(true);
    scrollTop();
  };

  const startEdit = expense => {
    setEditingId(expense.id);
    setEditOrig({ currency: expense.currency, rate: expense.rate });
    setWhat(expense.what);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setRate(String(expense.rate));
    setRateNote('');
    setCategory(expense.category);
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

    const fields = {
      what: { stringValue: what.trim() },
      amount: { doubleValue: numericAmount },
      currency: { stringValue: currency },
      rate: { doubleValue: numericRate },
      amountBase: { doubleValue: numericAmount * numericRate },
      category: { stringValue: category },
      payer: { stringValue: payer },
      split: {
        arrayValue: {
          values: split.map(name => ({ stringValue: name })),
        },
      },
    };

    try {
      if (editingId) {
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
      } else {
        await firestoreFetch(`${FIRESTORE_BASE}/expenses`, authToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              ...fields,
              addedByName: { stringValue: profile.name },
              addedByCharacter: { stringValue: profile.character },
            },
          }),
        });
      }

      closeForm();
      await loadAll();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Could not save expense.');
    }
  };

  const deleteExpense = async id => {
    try {
      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${id}`,
        authToken,
        { method: 'DELETE' }
      );
      if (id === editingId) closeForm();
      await loadAll();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Could not delete expense.');
    }
  };

  // Simplest transfers to settle up, all in the base currency
  const calculateTransfers = () => {
    const balances = {};

    expenses.forEach(expense => {
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

  // Breakdown: each person's share of the cost, by category
  const buildBreakdown = () => {
    const byPerson = {};
    const catTotals = {};
    let grand = 0;

    expenses.forEach(expense => {
      if (!expense.split.length) return;
      const share = expense.amountBase / expense.split.length;

      expense.split.forEach(name => {
        byPerson[name] = byPerson[name] || {};
        byPerson[name][expense.category] = (byPerson[name][expense.category] || 0) + share;
        catTotals[expense.category] = (catTotals[expense.category] || 0) + share;
        grand += share;
      });
    });

    return { byPerson, catTotals, grand };
  };

  const factor = displayRate || 1;
  const shownCurrency = displayRate ? displayCurrency : BASE_CURRENCY;
  const show = n => money(n * factor);

  const transfers = calculateTransfers();
  const breakdown = buildBreakdown();
  const totalSpent = expenses.reduce((sum, e) => sum + e.amountBase, 0);
  const characterOf = name => members.find(m => m.name === name)?.character;
  const people = Object.keys(breakdown.byPerson);
  const catRows = EXPENSE_CATEGORIES.filter(c => breakdown.catTotals[c.id]);

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
            items={CURRENCIES.map(code => [code, code])}
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
                  {expenses.length === 0 ? 'No balances to settle yet.' : 'Everyone is settled up! 🎉'}
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
            <Text style={ui.h3}>By category</Text>
            {catRows.length === 0 ? (
              <View style={ui.notice}>
                <Text style={ui.noticeText}>No categories yet.</Text>
              </View>
            ) : (
              catRows.map(c => (
                <Text key={c.id} style={[ui.sub, { color: P.ink, marginTop: 8 }]}>
                  {c.emoji} {c.label} · {shownCurrency} {show(breakdown.catTotals[c.id])}
                </Text>
              ))
            )}
          </View>

          <View style={ui.panel}>
            <Text style={ui.h3}>By person</Text>
            {people.length === 0 ? (
              <View style={ui.notice}>
                <Text style={ui.noticeText}>Add an expense to see the breakdown.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View>
                  <View style={styles.tRow}>
                    <Text style={[styles.tCell, styles.tFirst, styles.tHead]}>Share</Text>
                    {EXPENSE_CATEGORIES.map(c => (
                      <Text key={c.id} style={[styles.tCell, styles.tHead]}>{c.emoji}</Text>
                    ))}
                    <Text style={[styles.tCell, styles.tHead]}>Total</Text>
                  </View>

                  {people.map(name => {
                    const row = breakdown.byPerson[name];
                    const total = Object.values(row).reduce((a, b) => a + b, 0);
                    return (
                      <View key={name} style={styles.tRow}>
                        <View style={[styles.tCell, styles.tFirst, { flexDirection: 'row', alignItems: 'center' }]}>
                          <Avatar characterId={characterOf(name) || 'fox'} size={18} />
                          <Text style={[styles.tText, { marginLeft: 4 }]} numberOfLines={1}>{name}</Text>
                        </View>
                        {EXPENSE_CATEGORIES.map(c => (
                          <Text key={c.id} style={[styles.tCell, styles.tText]}>
                            {row[c.id] ? show(row[c.id]) : '–'}
                          </Text>
                        ))}
                        <Text style={[styles.tCell, styles.tText, styles.tBold]}>{show(total)}</Text>
                      </View>
                    );
                  })}

                  <View style={[styles.tRow, styles.tTotalRow]}>
                    <Text style={[styles.tCell, styles.tFirst, styles.tText, styles.tBold]}>Everyone</Text>
                    {EXPENSE_CATEGORIES.map(c => (
                      <Text key={c.id} style={[styles.tCell, styles.tText, styles.tBold]}>
                        {breakdown.catTotals[c.id] ? show(breakdown.catTotals[c.id]) : '–'}
                      </Text>
                    ))}
                    <Text style={[styles.tCell, styles.tText, styles.tBold]}>{show(breakdown.grand)}</Text>
                  </View>
                </View>
              </ScrollView>
            )}
            <Text style={ui.hint}>
              Each person's share of the cost, not what they paid. 🍽️ food, 🚗 transport, 🏨 stay, 🎯 activity, 🛍️ shopping, 📦 other.
            </Text>
          </View>
        </View>

        {/* All expenses */}
        <View style={ui.card}>
          <Text style={ui.h3}>All expenses ({expenses.length})</Text>

          {expenses.length === 0 && (
            <View style={ui.notice}>
              <Text style={ui.noticeText}>
                No expenses yet. Add one above to start splitting costs.
              </Text>
            </View>
          )}

          {expenses.map(expense => (
            <View key={expense.id} style={ui.listCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[ui.strong, { flex: 1, marginRight: 8 }]}>
                  {getExpenseCategory(expense.category).emoji} {expense.what}
                </Text>
                <Text style={[ui.strong, { fontFamily: MONO }]}>
                  {expense.currency} {money(expense.amount)}
                </Text>
              </View>

              {expense.currency !== BASE_CURRENCY ? (
                <Text style={ui.sub}>
                  ≈ {BASE_CURRENCY} {money(expense.amountBase)} (rate {expense.rate})
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
                items={CURRENCIES.map(code => [code, code])}
                selected={id => currency === id}
                onPress={setCurrency}
              />

              {currency !== BASE_CURRENCY && (
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
                    <Text style={[ui.sub, { marginTop: 0, marginLeft: 8 }]}>{BASE_CURRENCY}</Text>
                  </View>
                  {rateNote ? <Text style={ui.hint}>{rateNote}</Text> : null}
                  {previewBase > 0 ? (
                    <Text style={[ui.hint, { color: P.ink, fontWeight: '800' }]}>
                      ≈ {BASE_CURRENCY} {money(previewBase)}
                    </Text>
                  ) : null}
                </View>
              )}

              <Text style={ui.label}>Category</Text>
              <Pills
                items={EXPENSE_CATEGORIES.map(c => [c.id, `${c.emoji} ${c.label}`])}
                selected={id => category === id}
                onPress={setCategory}
              />

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

  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: P.fieldBorder },
  tTotalRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: P.ink },
  tCell: { width: 62, textAlign: 'right', paddingHorizontal: 2 },
  tFirst: { width: 100, textAlign: 'left' },
  tHead: { color: P.muted, fontSize: 14, fontWeight: '800' },
  tText: { color: P.ink, fontSize: 13 },
  tBold: { fontWeight: '800' },
});