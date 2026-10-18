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
  sendPasswordResetEmail,
} from 'firebase/auth';

import { auth } from './firebase';
import { colors } from './theme';
import { firestoreFetch, FIRESTORE_BASE } from './firestore';
import SpotsScreen from './SpotsScreen';
import ExpensesScreen from './ExpensesScreen';
import BookingsScreen from './BookingsScreen';
import ItineraryScreen from './ItineraryScreen';
import Avatar from './Avatar';
import ProfileScreen from './ProfileScreen';
import ProfileSetupScreen from './ProfileSetupScreen';
import { TripProvider } from './trip';


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
    const [loginInfo, setLoginInfo] = useState('');

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

    const handleForgot = async () => {
    if (!loginEmail.trim()) {
      setLoginInfo('');
      setLoginError('Type your email above first, then tap "Forgot password?".');
      return;
    }

    setLoginError('');
    try {
      await sendPasswordResetEmail(auth, loginEmail.trim());
    } catch (error) {
      console.error('Password reset failed:', error);
    }
    // Same message either way, so strangers can't check which emails have accounts
    setLoginInfo('If that email has an account, a reset link is on its way. Check your spam folder too.');
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
        {!!loginInfo && <Text style={styles.loginInfo}>{loginInfo}</Text>}

        <TouchableOpacity onPress={handleForgot} style={{ marginTop: 18 }}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
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
           <TripProvider authToken={authToken}>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        {tab === 'spots' ? (
          <SpotsScreen authToken={authToken} profile={profile} />
        ) : tab === 'bookings' ? (
          <BookingsScreen authToken={authToken} profile={profile} />
        ) : tab === 'itinerary' ? (
          <ItineraryScreen authToken={authToken} profile={profile} />
        ) : tab === 'expenses' ? (
          <ExpensesScreen authToken={authToken} profile={profile} />
        ) : (
          <ProfileScreen profile={profile} />
        )}

        <TouchableOpacity style={styles.meBtn} onPress={() => setTab('me')}>
          <Avatar characterId={profile.character} size={36} />
        </TouchableOpacity>
      </View>

      <View style={tabs.bar}>
        <TouchableOpacity style={tabs.btn} onPress={() => setTab('spots')}>
          <Text style={[tabs.text, tab === 'spots' && tabs.active]}>🗺️ Spots</Text>
        </TouchableOpacity>

        <TouchableOpacity style={tabs.btn} onPress={() => setTab('bookings')}>
          <Text style={[tabs.text, tab === 'bookings' && tabs.active]}>🧳 Bookings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={tabs.btn} onPress={() => setTab('itinerary')}>
          <Text style={[tabs.text, tab === 'itinerary' && tabs.active]}>📅 Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={tabs.btn} onPress={() => setTab('expenses')}>
          <Text style={[tabs.text, tab === 'expenses' && tabs.active]}>💰 Expenses</Text>
        </TouchableOpacity>
      </View>
    </View>
           </TripProvider>
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
    meBtn: {
    position: 'absolute',
    top: 40,
    right: 12,
    zIndex: 20,
  },
  loginInfo: { color: colors.success, marginTop: 14, textAlign: 'center' },
  forgotText: { color: colors.primary, textAlign: 'center', fontSize: 14 },
});

const tabs = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.tabBar,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btn: { flex: 1, paddingVertical: 14, paddingHorizontal: 4, alignItems: 'center' },
  text: { color: colors.textDim, fontSize: 12, fontWeight: 'bold' },
  active: { color: colors.primary },
});