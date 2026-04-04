const DEFAULT_LOCATIONS = [
  { name: 'Basement Pantry', emoji: '🏚️' },
  { name: 'Kitchen', emoji: '🍳' },
  { name: 'Fridge', emoji: '❄️' },
  { name: 'Freezer', emoji: '🧊' },
  { name: 'Garage', emoji: '🚗' },
  { name: 'Pantry', emoji: '🏠' },
];

const DEFAULT_CATEGORIES = [
  { name: 'Beverages', emoji: '🥤' },
  { name: 'Snacks', emoji: '🍿' },
  { name: 'Dairy', emoji: '🥛' },
  { name: 'Canned Goods', emoji: '🥫' },
  { name: 'Frozen', emoji: '🧊' },
  { name: 'Fresh Produce', emoji: '🥦' },
  { name: 'Condiments', emoji: '🍯' },
  { name: 'Breakfast', emoji: '🥣' },
  { name: 'Bakery', emoji: '🍞' },
  { name: 'Meat & Seafood', emoji: '🥩' },
  { name: 'Uncategorized', emoji: '📦' },
];

// Migrate old string[] format to { name, emoji }[]
function migrateToObjects(arr, defaults) {
  if (!arr || arr.length === 0) return arr;
  if (typeof arr[0] === 'string') {
    const defaultMap = Object.fromEntries(defaults.map(d => [d.name, d.emoji]));
    return arr.map(name => ({ name, emoji: defaultMap[name] || '📦' }));
  }
  return arr;
}

export const getDefaultLocations = () => {
  const saved = localStorage.getItem('DEFAULT_LOCATIONS');
  if (saved) {
    const parsed = JSON.parse(saved);
    const migrated = migrateToObjects(parsed, DEFAULT_LOCATIONS);
    if (migrated !== parsed) {
      localStorage.setItem('DEFAULT_LOCATIONS', JSON.stringify(migrated));
    }
    return migrated;
  }
  return DEFAULT_LOCATIONS;
};

export const getDefaultCategories = () => {
  const saved = localStorage.getItem('DEFAULT_CATEGORIES');
  if (saved) {
    const parsed = JSON.parse(saved);
    const migrated = migrateToObjects(parsed, DEFAULT_CATEGORIES);
    if (migrated !== parsed) {
      localStorage.setItem('DEFAULT_CATEGORIES', JSON.stringify(migrated));
    }
    return migrated;
  }
  return DEFAULT_CATEGORIES;
};

// Return just name strings (for dropdowns, API fallback)
export const getDefaultLocationNames = () => getDefaultLocations().map(l => l.name);
export const getDefaultCategoryNames = () => getDefaultCategories().map(c => c.name);

// Emoji lookup by name (falls back to generic icons)
export const getEmojiForLocation = (name) => {
  const found = getDefaultLocations().find(l => l.name === name);
  return found ? found.emoji : '📍';
};

export const getEmojiForCategory = (name) => {
  const found = getDefaultCategories().find(c => c.name === name);
  return found ? found.emoji : '📦';
};

export const saveDefaultLocations = (locations) => {
  localStorage.setItem('DEFAULT_LOCATIONS', JSON.stringify(locations));
};

export const saveDefaultCategories = (categories) => {
  localStorage.setItem('DEFAULT_CATEGORIES', JSON.stringify(categories));
};

export { DEFAULT_LOCATIONS, DEFAULT_CATEGORIES };
