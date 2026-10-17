import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from './firebase';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import SpotsScreen from './SpotsScreen';
import ExpensesScreen from './ExpensesScreen';
import ProfileScreen from './ProfileScreen';
import { getCharacter } from './characters';
import ProfileSetupScreen from './ProfileSetupScreen';

export default function App() {
  const [authToken, setAuthToken] = useState(null);
  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [tab, setTab] = useState('spots');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter your email and password.');
      return;
    }

    setLoginBusy(true);
    setLoginError('');

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setLoginPassword('');
    } catch (error) {
      console.error('Login failed:', error);
      setLoginError('Unable to log in. Please check your email and password.');
    } finally {
      setLoginBusy(false);
    }
  };

  // Keeps the login token and user id up to date
  useEffect(() => {
    let active = true;

    const unsubscribe = onIdTokenChanged(auth, async user => {
      try {
        if (user) {
          const token = await user.getIdToken();
          if (active) {
            setAuthToken(token);
            setUid(user.uid);
          }
        } else if (active) {
          setAuthToken(null);
          setUid(null);
        }
      } catch (error) {
        console.error('Error restoring login:', error);
        if (active) {
          setAuthToken(null);
          setUid(null);
        }
      } finally {
        if (active) setAuthReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Loads this person's name + character once they are logged in
  useEffect(() => {
    if (!authToken || !uid) {
      setProfile(null);
      setProfileReady(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        const response = await firestoreFetch(
          `${FIRESTORE_BASE}/profiles/${uid}`,
          authToken
        );
        const doc = await response.json();
        if (active) {
          setProfile({
            name: doc.fields?.name?.stringValue || '',
            character: doc.fields?.character?.stringValue || 'fox',
          });
        }
      } catch (error) {
        // 404 just means "no profile yet", which is normal the first time
        if (!String(error.message).includes('(404)')) {
          console.error('Error loading profile:', error);
        }
        if (active) setProfile(null);
      } finally {
        if (active) setProfileReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [authToken, uid]);

  if (!authReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 12 }}>
          Restoring your session...
        </Text>
      </View>
    );
  }

  if (!authToken) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={styles.loginTitle}>My Travel App</Text>
        <Text style={styles.loginSubtitle}>Sign in to access your trip</Text>

        <TextInput
          style={styles.loginInput}
          placeholder="Email address"
          placeholderTextColor={colors.textMuted}
          value={loginEmail}
          onChangeText={setLoginEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.loginInput}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={loginPassword}
          onChangeText={setLoginPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loginBusy}
          style={styles.loginButton}
        >
          <Text style={{ color: colors.text, fontWeight: 'bold' }}>
            {loginBusy ? 'Signing in...' : 'Log In'}
          </Text>
        </TouchableOpacity>

        {!!loginError && <Text style={styles.loginError}>{loginError}</Text>}
      </View>
    );
  }

  if (!profileReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <ProfileSetupScreen
        authToken={authToken}
        uid={uid}
        onSaved={setProfile}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
               {tab === 'spots' ? (
          <SpotsScreen authToken={authToken} profile={profile} />
        ) : tab === 'expenses' ? (
          <ExpensesScreen authToken={authToken} profile={profile} />
        ) : (
          <ProfileScreen profile={profile} />
        )}
      </View>

      <View style={tabs.bar}>
        <TouchableOpacity style={tabs.btn} onPress={() => setTab('spots')}>
          <Text style={[tabs.text, tab === 'spots' && tabs.active]}>
            🗺️ Spots
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={tabs.btn} onPress={() => setTab('expenses')}>
          <Text style={[tabs.text, tab === 'expenses' && tabs.active]}>
            💰 Expenses
          </Text>
        </TouchableOpacity>
                <TouchableOpacity style={tabs.btn} onPress={() => setTab('me')}>
          <Text style={[tabs.text, tab === 'me' && tabs.active]}>
            {getCharacter(profile.character).emoji} Me
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  loginSubtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  loginInput: {
    alignSelf: 'stretch',
    backgroundColor: colors.input,
    color: colors.text,
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  loginButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginError: {
    color: '#ff7777',
    marginTop: 14,
    textAlign: 'center',
  },
});

const tabs = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.tabBar,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btn: { flex: 1, padding: 14, alignItems: 'center' },
  text: { color: colors.textDim, fontSize: 15, fontWeight: 'bold' },
  active: { color: colors.primary },
});