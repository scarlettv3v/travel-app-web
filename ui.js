import { StyleSheet } from 'react-native';

// Shared "light" look from the Canva design, used by Home and every tab.
export const P = {
  ink: '#263a48',
  paper: '#fffdf6',
  bg: '#f3f8ed',
  line: '#b4d9c7',
  muted: '#526873',
  kicker: '#52756b',
  soft: '#e7f5e9',
  mint: '#d9f5e7',
  gold: '#ffd388',
  coral: '#ec7869',
  panel: '#f1f8ed',
  panelBorder: '#b7cebe',
  fieldBorder: '#b6cfc3',
  warnBg: '#fff0d4',
  warnBorder: '#bd8952',
  dangerBg: '#fff0ec',
  dangerText: '#973c39',
  errorBorder: '#b64d48',
  errorText: '#832c2b',
};

// Padding for every tab's ScrollView (matches Home).
// The top stays at 44 so the avatar button in the corner has room.
export const screenContent = { padding: 12, paddingTop: 44, paddingBottom: 24 };

const border = { borderWidth: 2, borderColor: P.ink };

// COMPACT LOOK (tighter than before): to make it roomier or tighter, change the numbers below
// (padding / margin / fontSize).
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },

  // cards + text
  card: { backgroundColor: P.paper, ...border, borderRadius: 18, padding: 11, marginBottom: 9 },
  kicker: { color: P.kicker, fontSize: 10.5, letterSpacing: 1, marginBottom: 1 },
  h2: { color: P.ink, fontSize: 20, fontWeight: '800', marginBottom: 0 },
  h3: { color: P.ink, fontSize: 15.5, fontWeight: '800', marginBottom: 0 },
  sub: { color: P.muted, fontSize: 12.5, marginTop: 1 },
  hint: { color: P.kicker, fontSize: 11, marginTop: 3 },
  strong: { color: P.ink, fontWeight: '800', fontSize: 13.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },

  // form panel + fields
  panel: { backgroundColor: P.panel, borderWidth: 2, borderColor: P.panelBorder, borderRadius: 14, padding: 10, marginTop: 8 },
  label: { color: P.ink, fontSize: 11.5, fontWeight: '800', marginTop: 7, marginBottom: 3 },
  field: { backgroundColor: '#fff', borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, color: P.ink, fontSize: 15 },
  fieldText: { color: P.ink, fontSize: 15 },
  fieldPlaceholder: { color: '#8a9ca6', fontSize: 15 },

  // pills (buttons)
  pill: { backgroundColor: '#fff', ...border, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, marginRight: 4, marginBottom: 4 },
  pillText: { color: P.ink, fontWeight: '800', fontSize: 12.5 },
  pillSmall: { paddingVertical: 1.5, paddingHorizontal: 7 },
  pillTextSmall: { fontSize: 11.5 },
  pillPrimary: { backgroundColor: P.gold },
  pillActive: { backgroundColor: P.gold },
  pillDanger: { backgroundColor: P.dangerBg },
  pillDangerText: { color: P.dangerText },

  // notices
  notice: { backgroundColor: P.soft, borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 10, padding: 7, marginTop: 7 },
  noticeText: { color: P.ink, fontSize: 12, fontWeight: '700' },
  noticeWarn: { backgroundColor: P.warnBg, borderColor: P.warnBorder },
  noticeError: { backgroundColor: P.dangerBg, borderColor: P.errorBorder },
  noticeErrorText: { color: P.errorText },

  // list cards
  listCard: { backgroundColor: '#fff', borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 14, padding: 9, marginTop: 7 },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#9dbcae', borderRadius: 999, paddingVertical: 1, paddingHorizontal: 7, backgroundColor: P.soft },
  tagText: { color: P.ink, fontSize: 10.5, fontWeight: '800' },
  byRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});