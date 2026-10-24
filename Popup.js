import React from 'react';
import { View, Modal, ScrollView, StyleSheet } from 'react-native';
import { P } from './ui';

// One shared popup: soft backdrop, cream card with an ink border.
export default function Popup({ visible, onClose, children, wide }) {
  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={[styles.card, wide && { maxWidth: 560 }]}>{children}</View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(38,58,72,0.6)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 15, paddingTop: 40, paddingBottom: 40 },
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
});