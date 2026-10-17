import { Linking, Platform } from 'react-native';

// Opens Google Maps on the named place (place card), near the saved coordinates
export async function openInGoogleMaps(lat, lng, name) {
  if (!lat || !lng) return;

  const label = encodeURIComponent(name || `${lat},${lng}`);
  const appUrl = `comgooglemaps://?q=${label}&center=${lat},${lng}&zoom=14`;
  const webUrl = name
    ? `https://www.google.com/maps/search/${label}/@${lat},${lng},14z`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  try {
    if (Platform.OS === 'ios' && (await Linking.canOpenURL(appUrl))) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    Linking.openURL(webUrl);
  }
}