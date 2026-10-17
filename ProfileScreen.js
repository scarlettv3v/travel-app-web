import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { colors } from './theme';
import Avatar from './Avatar';

export default function ProfileScreen({ profile }) {
  return (
    <View style={styles.container}>
      <Avatar characterId={profile.character} size={110} />
      <Text style={styles.name}>{profile.name}</Text>

      <TouchableOpacity style={styles.logout} onPress={() => signOut(auth)}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 26, fontWeight: 'bold', marginTop: 16 },
  logout: {
    marginTop: 40,
    backgroundColor: colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  logoutText: { color: colors.text, fontWeight: 'bold' },
});