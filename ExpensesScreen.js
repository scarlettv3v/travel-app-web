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
import Avatar from './Avatar';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';


export default function ExpensesScreen({ authToken, profile }) {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState('');
  const [split, setSplit] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const membersResponse = await firestoreFetch(
        `${FIRESTORE_BASE}/members?pageSize=300`,
        authToken
      );
      const membersData = await membersResponse.json();

      setMembers(
        (membersData.documents || []).map(doc => ({
          id: doc.name,
          name: doc.fields.name?.stringValue || '',
        }))
      );

      const expensesResponse = await firestoreFetch(
        `${FIRESTORE_BASE}/expenses?pageSize=300`,
        authToken
      );
      const expensesData = await expensesResponse.json();

      setExpenses(
        (expensesData.documents || []).map(doc => ({
          id: doc.name,
          what: doc.fields.what?.stringValue || '',
          amount: Number(
            doc.fields.amount?.doubleValue ??
            doc.fields.amount?.integerValue ??
            0
          ),
          payer: doc.fields.payer?.stringValue || '',
          split: (
            doc.fields.split?.arrayValue?.values || []
          ).map(value => value.stringValue),
                    addedByName: doc.fields.addedByName?.stringValue || '',
          addedByCharacter: doc.fields.addedByCharacter?.stringValue || '',
        }))
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

  const addMember = async () => {
    const name = newMember.trim();

    if (
      !name ||
      members.some(
        member => member.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return;
    }

    try {
      await firestoreFetch(`${FIRESTORE_BASE}/members`, authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            name: { stringValue: name },
          },
        }),
      });

      setNewMember('');
      await loadAll();
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Could not add member.');
    }
  };

  const deleteMember = async id => {
    try {
      await firestoreFetch(
        `https://firestore.googleapis.com/v1/${id}`,
        authToken,
        { method: 'DELETE' }
      );
      await loadAll();
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Could not delete member.');
    }
  };

  const openForm = () => {
    setWhat('');
    setAmount('');
    setPayer('');
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

  const saveExpense = async () => {
    const numericAmount = Number(amount.replace(',', '.'));

    if (
      !what.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !payer ||
      split.length === 0
    ) {
      alert(
        'Enter a description and valid amount, select who paid, and select who shares it.'
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

      setWhat('');
      setAmount('');
      setPayer('');
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

  // Calculate the simplest transfers to settle shared expenses.
  const calculateTransfers = () => {
    const balances = {};

    expenses.forEach(expense => {
      if (!expense.split.length) return;

      const share = expense.amount / expense.split.length;

      expense.split.forEach(name => {
        balances[name] = (balances[name] || 0) - share;
      });

      balances[expense.payer] =
        (balances[expense.payer] || 0) + expense.amount;
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
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (
      debtorIndex < debtors.length &&
      creditorIndex < creditors.length
    ) {
      const value = Math.min(
        debtors[debtorIndex].amount,
        creditors[creditorIndex].amount
      );

      transfers.push({
        from: debtors[debtorIndex].name,
        to: creditors[creditorIndex].name,
        amount: value,
      });

      debtors[debtorIndex].amount -= value;
      creditors[creditorIndex].amount -= value;

      if (debtors[debtorIndex].amount < 0.005) debtorIndex++;
      if (creditors[creditorIndex].amount < 0.005) creditorIndex++;
    }

    return transfers;
  };

  const transfers = calculateTransfers();
  const totalSpent = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  return (
    <ScrollView
      style={expenseStyles.container}
      contentContainerStyle={{ padding: 15, paddingTop: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={expenseStyles.title}>💰 Trip Expenses</Text>

      <Text style={expenseStyles.section}>Who's on the trip</Text>

      <View style={expenseStyles.chipRow}>
        {members.map(member => (
          <View key={member.id} style={expenseStyles.chip}>
            <Text style={expenseStyles.chipText}>{member.name}</Text>
            <TouchableOpacity onPress={() => deleteMember(member.id)}>
              <Text style={expenseStyles.deleteMark}>  ✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={expenseStyles.row}>
        <TextInput
          style={[expenseStyles.input, { flex: 1, marginRight: 8 }]}
          placeholder="Add a person's name"
          placeholderTextColor="#888"
          value={newMember}
          onChangeText={setNewMember}
          onSubmitEditing={addMember}
        />
        <TouchableOpacity
          style={expenseStyles.blueButton}
          onPress={addMember}
        >
          <Text style={expenseStyles.buttonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={expenseStyles.section}>Who owes who</Text>

      <View style={expenseStyles.card}>
        {transfers.length === 0 ? (
          <Text style={expenseStyles.hint}>
            {expenses.length === 0 ? 'No expenses yet.' : 'All settled up! 🎉'}
          </Text>
        ) : (
          transfers.map((transfer, index) => (
            <Text key={index} style={expenseStyles.transferText}>
              {transfer.from} owes {transfer.to}{' '}
              <Text style={expenseStyles.amount}>
                {transfer.amount.toFixed(2)}
              </Text>
            </Text>
          ))
        )}

        <Text style={expenseStyles.hint}>
          Total spent: {totalSpent.toFixed(2)}
        </Text>
      </View>

      {showForm ? (
        <View style={expenseStyles.card}>
          <Text style={expenseStyles.section}>New expense</Text>

          <TextInput
            style={expenseStyles.input}
            placeholder="What was it for? (e.g. Petrol)"
            placeholderTextColor="#888"
            value={what}
            onChangeText={setWhat}
          />

          <TextInput
            style={expenseStyles.input}
            placeholder="Amount"
            placeholderTextColor="#888"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <Text style={expenseStyles.label}>Paid by</Text>
          <View style={expenseStyles.chipRow}>
            {members.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[
                  expenseStyles.pick,
                  payer === member.name && expenseStyles.pickOn,
                ]}
                onPress={() => setPayer(member.name)}
              >
                <Text style={expenseStyles.chipText}>{member.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={expenseStyles.label}>Split between</Text>
          <View style={expenseStyles.chipRow}>
            {members.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[
                  expenseStyles.pick,
                  split.includes(member.name) && expenseStyles.pickOn,
                ]}
                onPress={() => toggleSplit(member.name)}
              >
                <Text style={expenseStyles.chipText}>{member.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={expenseStyles.row}>
            <TouchableOpacity
              style={[expenseStyles.greenButton, { flex: 1, marginRight: 8 }]}
              onPress={saveExpense}
            >
              <Text style={expenseStyles.buttonText}>Save Expense</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={expenseStyles.redButton}
              onPress={() => setShowForm(false)}
            >
              <Text style={expenseStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[expenseStyles.blueButton, { marginVertical: 10 }]}
          onPress={openForm}
        >
          <Text style={expenseStyles.buttonText}>+ Add Expense</Text>
        </TouchableOpacity>
      )}

      <Text style={expenseStyles.section}>
        All expenses ({expenses.length})
      </Text>

      {expenses.map(expense => (
        <View key={expense.id} style={expenseStyles.card}>
          <View style={expenseStyles.rowBetween}>
            <Text style={expenseStyles.expenseTitle}>{expense.what}</Text>
            <Text style={expenseStyles.amount}>
              {expense.amount.toFixed(2)}
            </Text>
          </View>

          <Text style={expenseStyles.hint}>
            Paid by {expense.payer} · split {expense.split.length} ways
            {expense.split.length ? ` (${expense.split.join(', ')})` : ''}
          </Text>
          {expense.addedByCharacter ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Avatar characterId={expense.addedByCharacter} size={22} />
              <Text style={[expenseStyles.hint, { marginTop: 0, marginLeft: 6 }]}>
                Added by {expense.addedByName}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[expenseStyles.redButton, { alignSelf: 'flex-start', marginTop: 8 }]}
            onPress={() => deleteExpense(expense.id)}
          >
            <Text style={expenseStyles.buttonText}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const expenseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  section: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 8,
  },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 6, marginBottom: 6 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  card: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    backgroundColor: colors.input,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  pick: {
    backgroundColor: colors.input,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.input,
  },
  pickOn: { backgroundColor: '#2d6a4f', borderColor: colors.success },
  chipText: { color: colors.text, fontSize: 14 },
  deleteMark: { color: colors.danger, fontWeight: 'bold' },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 8,
    minWidth: 0,
  },
  blueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  greenButton: {
    backgroundColor: colors.success,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  redButton: {
    backgroundColor: colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: colors.text, fontWeight: 'bold', fontSize: 14 },
  transferText: { color: colors.text, fontSize: 15, marginBottom: 6 },
  amount: { color: colors.success, fontWeight: 'bold', fontSize: 15 },
  expenseTitle: { color: colors.text, fontSize: 15, fontWeight: 'bold', flex: 1 },
});