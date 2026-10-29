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

// COMPACT LOOK: every number below was reduced from the roomier version.
// To make it roomier or tighter later, change these numbers (padding / margin / fontSize).
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },

  // cards + text
  card: { backgroundColor: P.paper, ...border, borderRadius: 18, padding: 12, marginBottom: 10 },
  kicker: { color: P.kicker, fontSize: 11, letterSpacing: 1.2, marginBottom: 2 },
  h2: { color: P.ink, fontSize: 20, fontWeight: '800', marginBottom: 0 },
  h3: { color: P.ink, fontSize: 16, fontWeight: '800', marginBottom: 0 },
  sub: { color: P.muted, fontSize: 13, marginTop: 1 },
  hint: { color: P.kicker, fontSize: 11, marginTop: 4 },
  strong: { color: P.ink, fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },

  // form panel + fields
  panel: { backgroundColor: P.panel, borderWidth: 2, borderColor: P.panelBorder, borderRadius: 14, padding: 12, marginTop: 10 },
  label: { color: P.ink, fontSize: 12, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  field: { backgroundColor: '#fff', borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, color: P.ink, fontSize: 15 },
  fieldText: { color: P.ink, fontSize: 15 },
  fieldPlaceholder: { color: '#8a9ca6', fontSize: 15 },

  // pills (buttons)
  pill: { backgroundColor: '#fff', ...border, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginRight: 5, marginBottom: 5 },
  pillText: { color: P.ink, fontWeight: '800', fontSize: 13 },
  pillSmall: { paddingVertical: 2, paddingHorizontal: 8 },
  pillTextSmall: { fontSize: 12 },
  pillPrimary: { backgroundColor: P.gold },
  pillActive: { backgroundColor: P.gold },
  pillDanger: { backgroundColor: P.dangerBg },
  pillDangerText: { color: P.dangerText },

  // notices
  notice: { backgroundColor: P.soft, borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 10, padding: 8, marginTop: 8 },
  noticeText: { color: P.ink, fontSize: 12, fontWeight: '700' },
  noticeWarn: { backgroundColor: P.warnBg, borderColor: P.warnBorder },
  noticeError: { backgroundColor: P.dangerBg, borderColor: P.errorBorder },
  noticeErrorText: { color: P.errorText },

  // list cards
  listCard: { backgroundColor: '#fff', borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 14, padding: 10, marginTop: 8 },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#9dbcae', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: P.soft },
  tagText: { color: P.ink, fontSize: 11, fontWeight: '800' },
  byRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
});