import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  PanResponder,
} from 'react-native';
import { getCategory } from './categories';
import { P, ui } from './ui';

const ROW_H = 60;

function DragRow({ label, index, top, dragging, onStart, onMove, onEnd }) {
  const cb = useRef({});
  cb.current = { index, onStart, onMove, onEnd };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => cb.current.onStart(cb.current.index),
      onPanResponderMove: (_, g) => cb.current.onMove(g.dy),
      onPanResponderRelease: () => cb.current.onEnd(),
      onPanResponderTerminate: () => cb.current.onEnd(),
    })
  ).current;

  return (
    <View style={[styles.row, { top }, dragging && styles.rowDragging]}>
      <Text style={styles.rowText} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.handle} {...pan.panHandlers}>
        <Text style={styles.handleText}>☰</Text>
      </View>
    </View>
  );
}

export default function ReorderModal({ visible, plans, onSave, onClose }) {
  const [items, setItems] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragY, setDragY] = useState(0);
  const itemsRef = useRef([]);
  const startOrder = useRef([]);
  const startIndex = useRef(0);

  // Copy the day's plans each time the pop-up opens
  useEffect(() => {
    if (visible) {
      setItems(plans);
      itemsRef.current = plans;
    }
  }, [visible]);

  const handleStart = index => {
    startOrder.current = itemsRef.current;
    startIndex.current = index;
    setDragId(itemsRef.current[index].id);
    setDragY(0);
  };

  const handleMove = dy => {
    const n = startOrder.current.length;
    setDragY(dy);

    const target = Math.max(
      0,
      Math.min(n - 1, Math.round((startIndex.current * ROW_H + dy) / ROW_H))
    );
    const dragged = startOrder.current[startIndex.current];
    const rest = startOrder.current.filter(p => p.id !== dragged.id);
    rest.splice(target, 0, dragged);

    itemsRef.current = rest;
    setItems(rest);
  };

  const handleEnd = () => {
    setDragId(null);
    setDragY(0);
  };

  const n = items.length;
  const maxTop = Math.max(0, (n - 1) * ROW_H);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={ui.kicker}>REORDER</Text>
          <Text style={ui.h2}>Stops without a time</Text>
          <Text style={[ui.sub, { marginBottom: 12 }]}>
            Hold ☰ and drag a stop up or down. Stops with a time are placed by their time.
          </Text>

          <ScrollView scrollEnabled={!dragId} style={{ maxHeight: 420 }}>
            <View style={{ height: n * ROW_H }}>
              {items.map((p, index) => {
                const isDragging = p.id === dragId;
                const top = isDragging
                  ? Math.max(0, Math.min(maxTop, startIndex.current * ROW_H + dragY))
                  : index * ROW_H;
                const label = `${index + 1}. ${getCategory(p.category).emoji} ${
                  p.time ? p.time + ' · ' : ''
                }${p.spotName}`;

                return (
                  <DragRow
                    key={p.id}
                    label={label}
                    index={index}
                    top={top}
                    dragging={isDragging}
                    onStart={handleStart}
                    onMove={handleMove}
                    onEnd={handleEnd}
                  />
                );
              })}
            </View>
          </ScrollView>

          <View style={[ui.row, { marginTop: 14 }]}>
            <TouchableOpacity
              style={[ui.pill, ui.pillPrimary]}
              onPress={() => {
                onSave(itemsRef.current);
                onClose();
              }}
            >
              <Text style={ui.pillText}>Save order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.pill} onPress={onClose}>
              <Text style={ui.pillText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(38,58,72,0.6)',
    justifyContent: 'center',
    padding: 15,
  },
  card: {
    backgroundColor: P.paper,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 22,
    padding: 18,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H - 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: P.fieldBorder,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  rowDragging: { backgroundColor: P.mint, borderColor: P.ink, zIndex: 10 },
  rowText: { flex: 1, color: P.ink, fontSize: 14, fontWeight: '800' },
  handle: { width: 56, height: '100%', alignItems: 'center', justifyContent: 'center' },
  handleText: { color: P.muted, fontSize: 22 },
});