export const CHARACTERS = [
  { id: 'fox', emoji: '🦊', color: '#e67e22' },
  { id: 'frog', emoji: '🐸', color: '#2ecc71' },
  { id: 'panda', emoji: '🐼', color: '#95a5a6' },
  { id: 'cat', emoji: '🐱', color: '#f1c40f' },
  { id: 'bear', emoji: '🐻', color: '#a0522d' },
  { id: 'octopus', emoji: '🐙', color: '#e84393' },
  { id: 'penguin', emoji: '🐧', color: '#4A90E2' },
  { id: 'woman', emoji: '🧍🏻‍♀️', color: '#9b59b6' },
];

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}