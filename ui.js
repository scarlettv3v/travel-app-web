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

// Padding for every tab's ScrollView (matches Home)
export const screenContent = { padding: 15, paddingTop: 44, paddingBottom: 40 };

const border = { borderWidth: 2, borderColor: P.ink };

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },

  // cards + text
  card: { backgroundColor: P.paper, ...border, borderRadius: 22, padding: 16, marginBottom: 16 },
  kicker: { color: P.kicker, fontSize: 12, letterSpacing: 1.5, marginBottom: 4 },
  h2: { color: P.ink, fontSize: 22, fontWeight: '800', marginBottom: 2 },
  h3: { color: P.ink, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  sub: { color: P.muted, fontSize: 14, marginTop: 2 },
  hint: { color: P.kicker, fontSize: 12, marginTop: 6 },
  strong: { color: P.ink, fontWeight: '800', fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },

  // form panel + fields
  panel: { backgroundColor: P.panel, borderWidth: 2, borderColor: P.panelBorder, borderRadius: 17, padding: 16, marginTop: 14 },
  label: { color: P.ink, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  field: { backgroundColor: '#fff', borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, color: P.ink, fontSize: 15 },
  fieldText: { color: P.ink, fontSize: 15 },
  fieldPlaceholder: { color: '#8a9ca6', fontSize: 15 },

  // pills (buttons)
  pill: { backgroundColor: '#fff', ...border, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15, marginRight: 9, marginBottom: 9 },
  pillText: { color: P.ink, fontWeight: '800', fontSize: 14 },
  pillSmall: { paddingVertical: 6, paddingHorizontal: 12 },
  pillTextSmall: { fontSize: 13 },
  pillPrimary: { backgroundColor: P.gold },
  pillActive: { backgroundColor: P.gold },
  pillDanger: { backgroundColor: P.dangerBg },
  pillDangerText: { color: P.dangerText },

  // notices
  notice: { backgroundColor: P.soft, borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 12, padding: 11, marginTop: 10 },
  noticeText: { color: P.ink, fontSize: 13, fontWeight: '700' },
  noticeWarn: { backgroundColor: P.warnBg, borderColor: P.warnBorder },
  noticeError: { backgroundColor: P.dangerBg, borderColor: P.errorBorder },
  noticeErrorText: { color: P.errorText },

  // list cards
  listCard: { backgroundColor: '#fff', borderWidth: 2, borderColor: P.fieldBorder, borderRadius: 16, padding: 15, marginTop: 11 },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#9dbcae', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, backgroundColor: P.soft },
  tagText: { color: P.ink, fontSize: 12, fontWeight: '800' },
  byRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
});