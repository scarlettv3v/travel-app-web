export const CATEGORIES = [
  { id: 'spot', emoji: '📍', label: 'Spot' },
  { id: 'activity', emoji: '🎯', label: 'Activity' },
  { id: 'restaurant', emoji: '🍽️', label: 'Food' },
  { id: 'hotel', emoji: '🏨', label: 'Hotel' },
];

export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
}