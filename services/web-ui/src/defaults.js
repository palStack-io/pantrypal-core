const DEFAULT_LOCATIONS = ['Basement Pantry', 'Kitchen', 'Fridge', 'Freezer', 'Garage', 'Pantry'];
const DEFAULT_CATEGORIES = ['Beverages', 'Snacks', 'Dairy', 'Canned Goods', 'Frozen', 'Fresh Produce', 'Condiments', 'Breakfast', 'Bakery', 'Meat & Seafood', 'Uncategorized'];

export const getDefaultLocations = () => {
  const saved = localStorage.getItem('DEFAULT_LOCATIONS');
  return saved ? JSON.parse(saved) : DEFAULT_LOCATIONS;
};

export const getDefaultCategories = () => {
  const saved = localStorage.getItem('DEFAULT_CATEGORIES');
  return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
};

export const saveDefaultLocations = (locations) => {
  localStorage.setItem('DEFAULT_LOCATIONS', JSON.stringify(locations));
};

export const saveDefaultCategories = (categories) => {
  localStorage.setItem('DEFAULT_CATEGORIES', JSON.stringify(categories));
};

export { DEFAULT_LOCATIONS, DEFAULT_CATEGORIES };