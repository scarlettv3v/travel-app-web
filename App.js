import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
import HomeScreen from './HomeScreen';

// Bottom bar design (from Canva): id, pixel glyph, label, tile colour.
// If a glyph shows as an empty box on a device, swap it for an emoji,
// e.g. '🏠' '📅' '🗺️' '🧳' '💰'.
const TABS = [
  ['home', '⌂', 'Home', '#d9f5e7'],
  ['itinerary', '▣', 'Itinerary', '#dbeeff'],
  ['spots', '⌖', 'Spots', '#eadcf3'],
  ['bookings', '▤', 'Bookings', '#f3d3dc'],
  ['expenses', '＄', 'Expenses', '#ffe4ad'],
];

export default function App() {
  const [authToken, setAuthToken] = useState(null);
  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [tab, setTab] = useState('home');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginMode, setLoginMode] = useState('login'); // 'login' | 'signup'
  const [loginConfirm, setLoginConfirm] = useState('');
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

  // Friends create their own account: no setup needed on your side.
  // After this, the app asks them for a name and character (the profile setup screen).
  const handleSignUp = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Please enter your email and choose a password.');
      return;
    }
    if (loginPassword.length < 6) {
      setLoginError('Your password needs at least 6 characters.');
      return;
    }
    if (loginPassword !== loginConfirm) {
      setLoginError('The two passwords do not match.');
      return;
    }

    setLoginBusy(true);
    setLoginError('');
    setLoginInfo('');

    try {
      await createUserWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setLoginPassword('');
      setLoginConfirm('');
    } catch (error) {
      console.error('Sign up failed:', error);
      const code = error && error.code;
      if (code === 'auth/email-already-in-use') {
        setLoginError('That email already has an account. Try logging in instead.');
      } else if (code === 'auth/invalid-email') {
        setLoginError('That email address does not look right.');
      } else if (code === 'auth/weak-password') {
        setLoginError('Please choose a stronger password (at least 6 characters).');
      } else {
        setLoginError('Could not create your account. Please try again.');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const switchMode = mode => {
    setLoginMode(mode);
    setLoginError('');
    setLoginInfo('');
    setLoginPassword('');
    setLoginConfirm('');
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
        <Text style={styles.loginSubtitle}>
          {loginMode === 'login' ? 'Sign in to access your trip' : 'Create your account to join in'}
        </Text>

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
          autoComplete={loginMode === 'login' ? 'current-password' : 'new-password'}
        />

        {loginMode === 'signup' && (
          <TextInput
            style={styles.loginInput}
            placeholder="Confirm password"
            placeholderTextColor={colors.textMuted}
            value={loginConfirm}
            onChangeText={setLoginConfirm}
            secureTextEntry
            autoComplete="new-password"
          />
        )}

        <TouchableOpacity
          onPress={loginMode === 'login' ? handleLogin : handleSignUp}
          disabled={loginBusy}
          style={styles.loginButton}
        >
          <Text style={{ color: colors.text, fontWeight: 'bold' }}>
            {loginBusy
              ? loginMode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : loginMode === 'login'
              ? 'Log In'
              : 'Create account'}
          </Text>
        </TouchableOpacity>

        {!!loginError && <Text style={styles.loginError}>{loginError}</Text>}
        {!!loginInfo && <Text style={styles.loginInfo}>{loginInfo}</Text>}

        {loginMode === 'login' && (
          <TouchableOpacity onPress={handleForgot} style={{ marginTop: 18 }}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => switchMode(loginMode === 'login' ? 'signup' : 'login')}
          style={{ marginTop: 18 }}
        >
          <Text style={styles.forgotText}>
            {loginMode === 'login'
              ? 'New here? Create an account'
              : 'Already have an account? Log in'}
          </Text>
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
          {tab === 'home' ? (
            <HomeScreen
              authToken={authToken}
              profile={profile}
              uid={uid}
              onOpenPlan={() => setTab('itinerary')}
            />
          ) : tab === 'spots' ? (
            <SpotsScreen authToken={authToken} profile={profile} />
          ) : tab === 'bookings' ? (
            <BookingsScreen
              authToken={authToken}
              profile={profile}
              onOpenItinerary={() => setTab('itinerary')}
            />
          ) : tab === 'itinerary' ? (
            <ItineraryScreen
              authToken={authToken}
              profile={profile}
              onOpenBookings={() => setTab('bookings')}
            />
          ) : tab === 'expenses' ? (
            <ExpensesScreen authToken={authToken} profile={profile} />
          ) : (
            <ProfileScreen authToken={authToken} profile={profile} uid={uid} onSaved={setProfile} />
          )}

          <TouchableOpacity style={styles.meBtn} onPress={() => setTab('me')}>
            <Avatar characterId={profile.character} size={28} />
          </TouchableOpacity>
        </View>

        {/* Bottom bar */}
        <View>
          <View style={tabs.edge} />
          <View style={tabs.bar}>
            {TABS.map(([id, glyph, label, tint]) => {
              const on = tab === id;
              return (
                <TouchableOpacity
                  key={id}
                  activeOpacity={0.8}
                  style={[tabs.btn, on && tabs.btnOn]}
                  onPress={() => setTab(id)}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on }}
                >
                  <View style={tabs.tileWrap}>
                    <View style={[tabs.tileShadow, on && tabs.tileShadowOn]} />
                    <View
                      style={[
                        tabs.tile,
                        { backgroundColor: on ? '#ffd388' : tint },
                        on && { transform: [{ translateY: -2 }] },
                      ]}
                    >
                      <Text style={tabs.glyph}>{glyph}</Text>
                    </View>
                  </View>
                  <Text style={tabs.label} numberOfLines={1}>{label}</Text>
                  <View style={[tabs.underline, !on && { opacity: 0 }]} />
                </TouchableOpacity>
              );
            })}
          </View>
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

const INK = '#263a48';
const SHADOW = '#9cc9b5';

const tabs = StyleSheet.create({
  // the mint "shadow" band that sits above the bar
  edge: { height: 5, backgroundColor: SHADOW },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f7ead8',
    borderTopWidth: 3,
    borderTopColor: INK,
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  btn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    marginHorizontal: 2,
    paddingTop: 5,
    paddingBottom: 4,
    paddingHorizontal: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  btnOn: {
    backgroundColor: '#fff0d4',
    borderColor: INK,
    transform: [{ translateY: -3 }],
    shadowColor: SHADOW,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  // the tile has a hard offset "shadow" drawn as a second view behind it
  tileWrap: { width: 32, height: 28 },
  tileShadow: {
    position: 'absolute',
    left: 2,
    top: 2,
    width: 32,
    height: 28,
    borderRadius: 6,
    backgroundColor: SHADOW,
  },
  tileShadowOn: { left: 1.5, top: 1, backgroundColor: INK },
  tile: {
    width: 32,
    height: 28,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: INK,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  label: { color: INK, fontSize: 10, fontWeight: '800', marginTop: 4 },
  underline: { width: 18, height: 2, marginTop: 2, backgroundColor: '#e87565' },
});