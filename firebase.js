import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyD7tARPeNt_DKPCPjz00HFjcjAD2rmlzmg',
  authDomain: 'travelapp-10305.firebaseapp.com',
  projectId: 'travelapp-10305',
  storageBucket: 'travelapp-10305.firebasestorage.app',
  messagingSenderId: '430885633668',
  appId: '1:430885633668:web:a765127096ecb4a1ce4cd1',
  measurementId: 'G-JY7P92QJ6G',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    auth = getAuth(app); // already initialised (happens on fast refresh)
  }
}

export { auth };