import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import {
  BASE_CURRENCY,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  getExpenseCategory,
} from './expenseOptions';

const money = n => Number(n).toFixed(2);

export default function ExpensesScreen({ authToken, profile }) {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);

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

  // Fetch a live exchange rate whenever the currency changes
  useEffect(() => {
    if (!showForm) return;

    if (currency === BASE_CURRENCY) {
      setRate('1');
      setRateNote('');
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
  }, [currency, showForm]);
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
  const openForm = () => {
    setWhat('');
    setAmount('');
    setCurrency(BASE_CURRENCY);
    setRate('1');
    setRateNote('');
    setCategory('food');
    setPayer(profile.name);
    setSplit(members.map(member => member.name));
    setShowForm(true);
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

    try {
      await firestoreFetch(`${FIRESTORE_BASE}/expenses`, authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
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
            addedByName: { stringValue: profile.name },
            addedByCharacter: { stringValue: profile.character },
          },
        }),
      });

      setShowForm(false);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 15, paddingTop: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>💰 Trip Expenses</Text>
      <Text style={[styles.hint, { textAlign: 'center' }]}>
           Totals shown in {shownCurrency}
      </Text>

      <Text style={styles.section}>Who's on the trip</Text>
      <View style={styles.chipRow}>
        {members.map(member => (
          <View key={member.id} style={styles.chip}>
            <Avatar characterId={member.character} size={22} />
            <Text style={[styles.chipText, { marginLeft: 6 }]}>{member.name}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.section}>Show totals in</Text>
      <View style={styles.chipRow}>
        {CURRENCIES.map(code => (
          <TouchableOpacity
            key={code}
            style={[styles.pick, displayCurrency === code && styles.pickOn]}
            onPress={() => setDisplayCurrency(code)}
          >
            <Text style={styles.chipText}>{code}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {displayNote ? <Text style={styles.hint}>{displayNote}</Text> : null}
      <Text style={styles.section}>Who owes who</Text>
      <View style={styles.card}>
        {transfers.length === 0 ? (
          <Text style={styles.hint}>
            {expenses.length === 0 ? 'No expenses yet.' : 'All settled up! 🎉'}
          </Text>
        ) : (
          transfers.map((transfer, index) => (
            <Text key={index} style={styles.transferText}>
              {transfer.from} owes {transfer.to}{' '}
              <Text style={styles.amount}>
                   {shownCurrency} {show(transfer.amount)}
              </Text>
            </Text>
          ))
        )}
        <Text style={styles.hint}>
             Total spent: {shownCurrency} {show(totalSpent)}
        </Text>
      </View>

      <Text style={styles.section}>Breakdown by person</Text>
      <View style={styles.card}>
        {people.length === 0 ? (
          <Text style={styles.hint}>Add an expense to see the breakdown.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
        <Text style={styles.hint}>
          Each person's share of the cost, not what they paid. 🍽️ food, 🚗 transport, 🏨 stay, 🎯 activity, 🛍️ shopping, 📦 other.
        </Text>
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.section}>New expense</Text>

          <TextInput
            style={styles.input}
            placeholder="What was it for? (e.g. Petrol)"
            placeholderTextColor={colors.textDim}
            value={what}
            onChangeText={setWhat}
          />

          <TextInput
            style={styles.input}
            placeholder="Amount"
            placeholderTextColor={colors.textDim}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Currency</Text>
          <View style={styles.chipRow}>
            {CURRENCIES.map(code => (
              <TouchableOpacity
                key={code}
                style={[styles.pick, currency === code && styles.pickOn]}
                onPress={() => setCurrency(code)}
              >
                <Text style={styles.chipText}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {currency !== BASE_CURRENCY && (
            <View>
              <View style={styles.row}>
                <Text style={[styles.hint, { marginTop: 0, marginRight: 8 }]}>
                  1 {currency} =
                </Text>
                <TextInput
                  style={[styles.input, { width: 100, marginBottom: 0 }]}
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="decimal-pad"
                  placeholder="rate"
                  placeholderTextColor={colors.textDim}
                />
                <Text style={[styles.hint, { marginTop: 0, marginLeft: 8 }]}>{BASE_CURRENCY}</Text>
              </View>
              {rateNote ? <Text style={styles.hint}>{rateNote}</Text> : null}
              {previewBase > 0 ? (
                <Text style={[styles.hint, { color: colors.success }]}>
                  ≈ {BASE_CURRENCY} {money(previewBase)}
                </Text>
              ) : null}
            </View>
          )}

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {EXPENSE_CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pick, category === c.id && styles.pickOn]}
                onPress={() => setCategory(c.id)}
              >
                <Text style={styles.chipText}>{c.emoji} {c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Paid by</Text>
          <View style={styles.chipRow}>
            {members.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[styles.pick, payer === member.name && styles.pickOn]}
                onPress={() => setPayer(member.name)}
              >
                <Text style={styles.chipText}>{member.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Split between</Text>
          <View style={styles.chipRow}>
            {members.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[styles.pick, split.includes(member.name) && styles.pickOn]}
                onPress={() => toggleSplit(member.name)}
              >
                <Text style={styles.chipText}>{member.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.greenButton, { flex: 1, marginRight: 8 }]}
              onPress={saveExpense}
            >
              <Text style={styles.buttonText}>Save Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.redButton} onPress={() => setShowForm(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[styles.blueButton, { marginVertical: 10 }]} onPress={openForm}>
          <Text style={styles.buttonText}>+ Add Expense</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.section}>All expenses ({expenses.length})</Text>

      {expenses.map(expense => (
        <View key={expense.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.expenseTitle}>
              {getExpenseCategory(expense.category).emoji} {expense.what}
            </Text>
            <Text style={styles.amount}>
              {expense.currency} {money(expense.amount)}
            </Text>
          </View>

          {expense.currency !== BASE_CURRENCY ? (
            <Text style={styles.hint}>
              ≈ {BASE_CURRENCY} {money(expense.amountBase)} (rate {expense.rate})
            </Text>
          ) : null}

          <Text style={styles.hint}>
            Paid by {expense.payer} · split {expense.split.length} ways
            {expense.split.length ? ` (${expense.split.join(', ')})` : ''}
          </Text>

          {expense.addedByCharacter ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Avatar characterId={expense.addedByCharacter} size={22} />
              <Text style={[styles.hint, { marginTop: 0, marginLeft: 6 }]}>
                Added by {expense.addedByName}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.redButton, { alignSelf: 'flex-start', marginTop: 8 }]}
            onPress={() => deleteExpense(expense.id)}
          >
            <Text style={styles.buttonText}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 4 },
  section: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 14, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 6, marginBottom: 6 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { backgroundColor: colors.card, padding: 12, borderRadius: 8, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, marginBottom: 6 },
  pick: { backgroundColor: colors.input, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: colors.input },
  pickOn: { backgroundColor: '#2d6a4f', borderColor: colors.success },
  chipText: { color: colors.text, fontSize: 14 },
  input: { backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 8 },
  blueButton: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  greenButton: { backgroundColor: colors.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  redButton: { backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
  transferText: { color: colors.text, fontSize: 15, marginBottom: 6 },
  amount: { color: colors.success, fontWeight: 'bold', fontSize: 15 },
  expenseTitle: { color: colors.text, fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 8 },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  tTotalRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.textDim },
  tCell: { width: 62, textAlign: 'right', paddingHorizontal: 2 },
  tFirst: { width: 100, textAlign: 'left' },
  tHead: { color: colors.textMuted, fontSize: 14 },
  tText: { color: colors.text, fontSize: 13 },
  tBold: { fontWeight: 'bold' },
});