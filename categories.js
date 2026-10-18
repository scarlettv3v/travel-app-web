export const CATEGORIES = [
  { id: 'spot', emoji: '📍', label: 'Spot' },
  { id: 'activity', emoji: '🎯', label: 'Activity' },
  { id: 'restaurant', emoji: '🍽️', label: 'Food' },
];

export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
}