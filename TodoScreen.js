import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import Avatar from './Avatar';
import DatePicker, { formatDate } from './DatePicker';
import HScroll from './HScroll';
import { isNetworkError } from './offline';

// A shared to-do list for the whole trip. Opened from the Home page (no bottom-bar tab).
// Needs a "todos" rule in your Firestore rules.
// Each task can have one or more people ("assignees"). No one selected = anyone.
//
// The look copies the Home page (same cream cards, dark outlines, white pills, mint and sun accents),
// and does not depend on ui.js.

// ---------------------------------------------------------------------------------------------
// COLOURS: change them here. Any hex colour works, e.g. '#ffe1aa'.
// ---------------------------------------------------------------------------------------------
const C = {
  ink: '#263a48', // text and outlines
  paper: '#fffdf6', // card background
  bg: '#f3f8ed', // page background
  line: '#b4d9c7', // thin dividers
  muted: '#526873', // grey text
  soft: '#e7f5e9', // soft green notice boxes
  mint: '#d9f5e7', // mint accent (used for the ticked checkbox)
  sun: '#ffe1aa', // selected pill (same as the selected day on Home)

  addButton: '#ffffff', // the "+ Add task" button: fill colour
  addButtonText: '#263a48', // the "+ Add task" button: text colour
  addButtonBorder: '#263a48', // the "+ Add task" button: outline colour

  deleteBg: '#fff0ec',
  deleteText: '#973c39',
  overdue: '#832c2b',
  error: '#fff0ec',
  errorBorder: '#b64d48',
};

const TODOS_URL = `${FIRESTORE_BASE}/todos?pageSize=300`;
const todayIso = () => new Date().toISOString().slice(0, 10);

const FILTERS = [
  ['open', 'To do'],
  ['done', 'Done'],
  ['all', 'All'],
];

// Reads the people on a task. Tasks saved before multi-person existed have a single "assignee"
// text, which is still understood.
const peopleOf = f => {
  const list = (f.assignees?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean);
  if (list.length) return list;
  const old = f.assignee?.stringValue || '';
  return old ? [old] : [];
};

export default function TodoScreen({ authToken, profile, onBack }) {
  const [todos, setTodos] = useState([]);
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState('open');
  const [text, setText] = useState('');
  const [assignees, setAssignees] = useState([]); // [] = anyone
  const [due, setDue] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const res = await firestoreFetch(TODOS_URL, authToken);
      const data = await res.json();
      setTodos(
        (data.documents || []).map(doc => {
          const f = doc.fields || {};
          return {
            id: doc.name,
            text: f.text?.stringValue || '',
            done: f.done?.booleanValue === true,
            assignees: peopleOf(f),
            due: f.due?.stringValue || '',
            addedByName: f.addedByName?.stringValue || '',
            doneByName: f.doneByName?.stringValue || '',
            createdAt: f.createdAt?.stringValue || '',
          };
        })
      );
      setProblem('');

      const mRes = await firestoreFetch(`${FIRESTORE_BASE}/profiles?pageSize=300`, authToken);
      const mData = await mRes.json();
      setMembers(
        (mData.documents || [])
          .map(doc => ({
            name: doc.fields?.name?.stringValue || '',
            character: doc.fields?.character?.stringValue || 'fox',
          }))
          .filter(m => m.name)
      );
    } catch (error) {
      if (isNetworkError(error)) return;
      if (String(error.message).includes('(403)')) {
        setProblem(
          'The database is not allowing the to-do list yet. Add the "todos" rule to your Firestore rules and publish them.'
        );
      } else {
        console.error('Error loading to-dos:', error);
      }
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return undefined;
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
  }, [authToken, loadAll]);

  const characterOf = name => members.find(m => m.name === name)?.character || 'fox';

  // tap a person to add or remove them; "Anyone" clears the list
  const togglePerson = name =>
    setAssignees(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));

  const addTodo = async () => {
    if (!text.trim()) {
      alert('Type what needs doing first.');
      return;
    }
    setBusy(true);
    try {
      await firestoreFetch(`${FIRESTORE_BASE}/todos`, authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            text: { stringValue: text.trim() },
            done: { booleanValue: false },
            assignees: {
              arrayValue: { values: assignees.map(n => ({ stringValue: n })) },
            },
            due: { stringValue: due },
            addedByName: { stringValue: profile.name },
            createdAt: { stringValue: new Date().toISOString() },
          },
        }),
      });
      setText('');
      setDue('');
      setAssignees([]);
      await loadAll();
    } catch (error) {
      console.error('Error adding to-do:', error);
      alert('Could not add the task. Check your connection and the Firestore rules.');
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async todo => {
    const nextDone = !todo.done;
    // show the change straight away, put it back if saving fails
    setTodos(list =>
      list.map(t =>
        t.id === todo.id ? { ...t, done: nextDone, doneByName: nextDone ? profile.name : '' } : t
      )
    );
    try {
      const fields = {
        done: { booleanValue: nextDone },
        doneByName: { stringValue: nextDone ? profile.name : '' },
      };
      const mask = Object.keys(fields)
        .map(key => `updateMask.fieldPaths=${key}`)
        .join('&');
      await firestoreFetch(`https://firestore.googleapis.com/v1/${todo.id}?${mask}`, authToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
    } catch (error) {
      console.error('Error updating to-do:', error);
      alert('Could not update the task.');
      await loadAll();
    }
  };

  const removeTodo = async todo => {
    try {
      await firestoreFetch(`https://firestore.googleapis.com/v1/${todo.id}`, authToken, {
        method: 'DELETE',
      });
      await loadAll();
    } catch (error) {
      console.error('Error deleting to-do:', error);
      alert('Could not delete the task.');
    }
  };

  const today = todayIso();
  const openCount = todos.filter(t => !t.done).length;
  const doneCount = todos.length - openCount;

  // open items first (soonest due date first, no date last), done items after
  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.due || '9999-99-99';
    const bd = b.due || '9999-99-99';
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
  const visible = sorted.filter(
    t => filter === 'all' || (filter === 'open' ? !t.done : t.done)
  );

  const counts = { open: openCount, done: doneCount, all: todos.length };

  // a pill button, like the ones on Home
  const Pill = ({ label, on, onPress, children, style }) => (
    <TouchableOpacity style={[s.pill, on && s.pillOn, style]} onPress={onPress}>
      {children || <Text style={s.pillText}>{label}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: 12, paddingTop: 44, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header (same layout as the Home header) */}
        <View style={[s.card, { paddingRight: 56 }]}>
          <Text style={s.kicker}>THINGS TO SORT OUT</Text>
          <Text style={s.title}>To-do</Text>
          <Text style={s.sub}>
            {openCount === 0
              ? 'Nothing left to do.'
              : `${openCount} to do${doneCount ? ` · ${doneCount} done` : ''}`}
          </Text>
          <View style={s.headRow}>
            <TouchableOpacity style={s.badge} onPress={onBack}>
              <Text style={s.badgeText}>‹ BACK TO HOME</Text>
            </TouchableOpacity>
          </View>
          {problem ? (
            <View style={[s.notice, { backgroundColor: C.error, borderColor: C.errorBorder }]}>
              <Text style={[s.noticeText, { color: C.overdue }]}>{problem}</Text>
            </View>
          ) : null}
        </View>

        {/* Add a task */}
        <View style={s.card}>
          <Text style={s.h3}>Add a task</Text>
          <TextInput
            style={[s.input, { marginTop: 6 }]}
            placeholder="e.g. Book rental car"
            placeholderTextColor="#8a9ca6"
            value={text}
            onChangeText={setText}
            onSubmitEditing={addTodo}
            returnKeyType="done"
          />

          <Text style={s.label}>Who's doing it? (pick one or more)</Text>
          <HScroll style={{ flexGrow: 0 }}>
            <Pill
              on={assignees.length === 0}
              label={`${assignees.length === 0 ? '✓ ' : ''}Anyone`}
              onPress={() => setAssignees([])}
            />
            {members.map(m => {
              const on = assignees.includes(m.name);
              return (
                <Pill
                  key={m.name}
                  on={on}
                  onPress={() => togglePerson(m.name)}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Avatar characterId={m.character} size={18} />
                  <Text style={[s.pillText, { marginLeft: 5 }]}>
                    {on ? '✓ ' : ''}
                    {m.name}
                  </Text>
                </Pill>
              );
            })}
          </HScroll>

          <View style={[s.row, { marginTop: 8 }]}>
            <Pill
              label={`📅 ${due ? `Due ${formatDate(due, { year: false })}` : 'Due date (optional)'}`}
              onPress={() => setPickerOpen(true)}
            />
            {due ? <Pill label="Clear date" onPress={() => setDue('')} /> : null}
            <TouchableOpacity
              style={[s.addBtn, busy && { opacity: 0.5 }]}
              onPress={addTodo}
              disabled={busy}
            >
              <Text style={s.addBtnText}>{busy ? 'Adding...' : '+ Add task'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* The list */}
        <View style={s.card}>
          <HScroll style={{ flexGrow: 0 }}>
            {FILTERS.map(([id, label]) => (
              <Pill
                key={id}
                on={filter === id}
                label={`${label} (${counts[id]})`}
                onPress={() => setFilter(id)}
              />
            ))}
          </HScroll>

          {visible.length === 0 && (
            <View style={s.notice}>
              <Text style={s.noticeText}>
                {todos.length === 0
                  ? 'No tasks yet. Add the first one above.'
                  : filter === 'open'
                  ? 'Nothing left to do.'
                  : 'Nothing here.'}
              </Text>
            </View>
          )}

          {visible.map(todo => {
            const overdue = !todo.done && !!todo.due && todo.due < today;
            return (
              <View key={todo.id} style={s.taskRow}>
                <TouchableOpacity
                  onPress={() => toggleDone(todo)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: todo.done }}
                  style={[s.check, todo.done && s.checkOn]}
                >
                  <Text style={s.checkMark}>{todo.done ? '✓' : ''}</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={[s.taskText, todo.done && s.taskDone]}>{todo.text}</Text>

                  <View style={[s.row, { marginTop: 3 }]}>
                    {todo.assignees.map(name => (
                      <View
                        key={name}
                        style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}
                      >
                        <Avatar characterId={characterOf(name)} size={16} />
                        <Text style={[s.small, { marginLeft: 4 }]}>{name}</Text>
                      </View>
                    ))}
                    {todo.due ? (
                      <Text style={[s.small, overdue && { color: C.overdue, fontWeight: '800' }]}>
                        📅 {formatDate(todo.due, { year: false })}
                        {overdue ? ' · overdue' : ''}
                      </Text>
                    ) : null}
                  </View>

                  {todo.done && todo.doneByName ? (
                    <Text style={s.tiny}>Done by {todo.doneByName}</Text>
                  ) : todo.addedByName ? (
                    <Text style={s.tiny}>Added by {todo.addedByName}</Text>
                  ) : null}
                </View>

                <TouchableOpacity style={s.deleteBtn} onPress={() => removeTodo(todo)}>
                  <Text style={s.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <DatePicker
        visible={pickerOpen}
        title="Due date"
        value={due}
        minDate=""
        onPick={iso => {
          setDue(iso);
          setPickerOpen(false);
        }}
        onClear={() => {
          setDue('');
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const border = { borderWidth: 2, borderColor: C.ink };

// Same sizes as the Home page, so the two pages look like one app.
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: { backgroundColor: C.paper, ...border, borderRadius: 18, padding: 12, marginBottom: 10 },
  kicker: { color: '#52756b', fontSize: 11, letterSpacing: 1.2, marginBottom: 2 },
  title: { color: C.ink, fontSize: 22, fontWeight: '800', marginBottom: 2 },
  h3: { color: C.ink, fontSize: 16, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13, marginTop: 1 },
  small: { color: C.muted, fontSize: 12 },
  tiny: { color: C.muted, fontSize: 11, marginTop: 2 },
  label: { color: C.ink, fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },

  headRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  badge: { alignSelf: 'flex-start', ...border, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, marginTop: 8, backgroundColor: '#fff' },
  badgeText: { color: C.ink, fontWeight: '800', fontSize: 11 },

  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#b6cfc3', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, color: C.ink, fontSize: 15 },

  pill: { backgroundColor: '#fff', ...border, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginRight: 5, marginBottom: 5 },
  pillOn: { backgroundColor: C.sun },
  pillText: { color: C.ink, fontWeight: '800', fontSize: 12 },

  // the "+ Add task" button. Its colours are in C (addButton, addButtonText, addButtonBorder)
  addBtn: { backgroundColor: C.addButton, borderWidth: 2, borderColor: C.addButtonBorder, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginRight: 5, marginBottom: 5 },
  addBtnText: { color: C.addButtonText, fontWeight: '800', fontSize: 13 },

  notice: { backgroundColor: C.soft, borderWidth: 2, borderColor: C.line, borderRadius: 10, padding: 9, marginTop: 8 },
  noticeText: { color: C.ink, fontSize: 12, fontWeight: '700' },

  // tasks: rows with dashed dividers, like the travellers list on Home
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#afc9bb' },
  taskText: { color: C.ink, fontWeight: '800', fontSize: 14 },
  taskDone: { textDecorationLine: 'line-through', color: C.muted },
  check: { width: 24, height: 24, borderRadius: 7, ...border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  checkOn: { backgroundColor: '#8ecdc0' },
  checkMark: { color: C.ink, fontWeight: '800', fontSize: 14 },

  deleteBtn: { backgroundColor: C.deleteBg, ...border, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, marginLeft: 6 },
  deleteText: { color: C.deleteText, fontWeight: '800', fontSize: 12 },
});