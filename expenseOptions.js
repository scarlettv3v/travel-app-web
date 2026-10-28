export const BASE_CURRENCY = 'NZD'; // everything is converted to this for totals

export const CURRENCIES = ['NZD', 'HKD', 'TWD', 'USD', 'AUD', 'EUR', 'GBP', 'JPY'];

export const EXPENSE_CATEGORIES = [
  { id: 'food', emoji: '🍽️', label: 'Food' },
  { id: 'transport', emoji: '🚗', label: 'Transport' },
  { id: 'stay', emoji: '🏨', label: 'Stay' },
  { id: 'activity', emoji: '🎯', label: 'Activity' },
  { id: 'shopping', emoji: '🛍️', label: 'Shopping' },
  { id: 'other', emoji: '📦', label: 'Other' },
];

export function getExpenseCategory(id) {
  return EXPENSE_CATEGORIES.find(c => c.id === id) || EXPENSE_CATEGORIES[5];
}