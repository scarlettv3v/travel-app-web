import React from 'react';
import { Text, Linking, Platform } from 'react-native';

// Shows text, and turns any web link inside it into a tappable link.
const URL_RE = /((?:https?:\/\/|www\.)[^\s]+)/gi;

const openUrl = url => {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => {});
  }
};

export default function LinkText({ children, style, numberOfLines }) {
  const text = String(children ?? '');
  const parts = text.split(URL_RE);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        // keep trailing punctuation like "." or ")" out of the link
        const m = part.match(/^(.*?)([).,;:!?'"\]]*)$/);
        const link = m[1];
        const tail = m[2];
        const url = /^www\./i.test(link) ? 'https://' + link : link;
        return (
          <Text key={i}>
            <Text
              style={{ color: '#2f6fb0', textDecorationLine: 'underline', fontWeight: '700' }}
              onPress={() => openUrl(url)}
            >
              {link}
            </Text>
            {tail}
          </Text>
        );
      })}
    </Text>
  );
}