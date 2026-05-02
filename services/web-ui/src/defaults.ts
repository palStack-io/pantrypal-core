import type { LocationOption, CategoryOption } from './types';

const DEFAULT_LOCATIONS: LocationOption[] = [
  { name: 'Basement Pantry', emoji: '🏚️' },
  { name: 'Kitchen', emoji: '🍳' },
  { name: 'Fridge', emoji: '❄️' },
  { name: 'Freezer', emoji: '🧊' },
  { name: 'Garage', emoji: '🚗' },
  { name: 'Pantry', emoji: '🏠' },
];

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { name: 'Produce',        emoji: '🥦' },
  { name: 'Dairy',          emoji: '🥛' },
  { name: 'Meat & Seafood', emoji: '🥩' },
  { name: 'Frozen',         emoji: '🧊' },
  { name: 'Bakery',         emoji: '🍞' },
  { name: 'Breakfast',      emoji: '🥣' },
  { name: 'Snacks',         emoji: '🍿' },
  { name: 'Beverages',      emoji: '🥤' },
  { name: 'Coffee & Tea',   emoji: '☕' },
  { name: 'Wine & Spirits', emoji: '🍷' },
  { name: 'Condiments',     emoji: '🧂' },
  { name: 'Baking',         emoji: '🧁' },
  { name: 'Pasta & Grains', emoji: '🍝' },
  { name: 'Canned Goods',   emoji: '🥫' },
  { name: 'Oils & Vinegars',emoji: '🫙' },
  { name: 'Spices',         emoji: '🌶️' },
  { name: 'Deli',           emoji: '🥪' },
  { name: 'International',  emoji: '🌍' },
  { name: 'Household',      emoji: '🏠' },
  { name: 'Cleaning',       emoji: '🧼' },
  { name: 'Personal Care',  emoji: '🧴' },
  { name: 'Health',         emoji: '💊' },
  { name: 'Baby',           emoji: '🍼' },
  { name: 'Pet Food',       emoji: '🐾' },
  { name: 'Uncategorized',  emoji: '📦' },
];

function migrateToObjects(
  arr: (LocationOption | CategoryOption | string)[],
  defaults: LocationOption[] | CategoryOption[]
): LocationOption[] | CategoryOption[] {
  if (!arr || arr.length === 0) return arr as LocationOption[];
  if (typeof arr[0] === 'string') {
    const defaultMap = Object.fromEntries(defaults.map(d => [d.name, d.emoji]));
    return (arr as string[]).map(name => ({ name, emoji: defaultMap[name] || '📦' }));
  }
  return arr as LocationOption[];
}

export const getDefaultLocations = (): LocationOption[] => {
  const saved = localStorage.getItem('DEFAULT_LOCATIONS');
  if (saved) {
    const parsed = JSON.parse(saved);
    const migrated = migrateToObjects(parsed, DEFAULT_LOCATIONS) as LocationOption[];
    if (migrated !== parsed) {
      localStorage.setItem('DEFAULT_LOCATIONS', JSON.stringify(migrated));
    }
    return migrated;
  }
  return DEFAULT_LOCATIONS;
};

export const getDefaultCategories = (): CategoryOption[] => {
  const saved = localStorage.getItem('DEFAULT_CATEGORIES');
  if (saved) {
    const parsed = JSON.parse(saved);
    const migrated = migrateToObjects(parsed, DEFAULT_CATEGORIES) as CategoryOption[];
    // Merge in any canonical categories missing from the saved list
    const savedNames = new Set(migrated.map(c => c.name));
    const missing = DEFAULT_CATEGORIES.filter(c => !savedNames.has(c.name));
    if (missing.length > 0) {
      const merged = [...migrated, ...missing];
      localStorage.setItem('DEFAULT_CATEGORIES', JSON.stringify(merged));
      return merged;
    }
    if (migrated !== parsed) {
      localStorage.setItem('DEFAULT_CATEGORIES', JSON.stringify(migrated));
    }
    return migrated;
  }
  return DEFAULT_CATEGORIES;
};

export const getDefaultLocationNames = (): string[] => getDefaultLocations().map(l => l.name);
export const getDefaultCategoryNames = (): string[] => getDefaultCategories().map(c => c.name);

export const getEmojiForLocation = (name: string): string => {
  const found = getDefaultLocations().find(l => l.name === name);
  return found ? found.emoji : '📍';
};

export const getEmojiForCategory = (name: string): string => {
  const found = getDefaultCategories().find(c => c.name === name);
  return found ? found.emoji : '📦';
};

export const saveDefaultLocations = (locations: LocationOption[]): void => {
  localStorage.setItem('DEFAULT_LOCATIONS', JSON.stringify(locations));
};

export const saveDefaultCategories = (categories: CategoryOption[]): void => {
  localStorage.setItem('DEFAULT_CATEGORIES', JSON.stringify(categories));
};

export { DEFAULT_LOCATIONS, DEFAULT_CATEGORIES };
