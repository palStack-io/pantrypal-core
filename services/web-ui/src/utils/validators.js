// Validation utility functions

/**
 * Validate item name
 */
export function validateItemName(name) {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Item name is required' };
  }
  
  if (name.length < 2) {
    return { isValid: false, error: 'Item name must be at least 2 characters' };
  }
  
  if (name.length > 100) {
    return { isValid: false, error: 'Item name must be less than 100 characters' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate barcode
 */
export function validateBarcode(barcode) {
  if (!barcode) {
    return { isValid: true, error: null }; // Barcode is optional
  }
  
  // Remove any spaces or dashes
  const cleaned = barcode.replace(/[\s-]/g, '');
  
  // Check if it's numeric
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: 'Barcode must contain only numbers' };
  }
  
  // Check length (common barcode lengths: 8, 12, 13, 14)
  if (![8, 12, 13, 14].includes(cleaned.length)) {
    return { isValid: false, error: 'Barcode must be 8, 12, 13, or 14 digits' };
  }
  
  return { isValid: true, error: null, cleaned };
}

/**
 * Validate quantity
 */
export function validateQuantity(quantity) {
  if (quantity === null || quantity === undefined || quantity === '') {
    return { isValid: false, error: 'Quantity is required' };
  }
  
  const num = Number(quantity);
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Quantity must be a number' };
  }
  
  if (num < 0) {
    return { isValid: false, error: 'Quantity cannot be negative' };
  }
  
  if (num > 9999) {
    return { isValid: false, error: 'Quantity must be less than 10,000' };
  }
  
  if (!Number.isInteger(num)) {
    return { isValid: false, error: 'Quantity must be a whole number' };
  }
  
  return { isValid: true, error: null, value: num };
}

/**
 * Validate expiry date
 */
export function validateExpiryDate(date) {
  if (!date) {
    return { isValid: true, error: null }; // Expiry date is optional
  }
  
  const expiryDate = new Date(date);
  
  if (isNaN(expiryDate.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  
  // Check if date is in the past (more than 1 day ago)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  if (expiryDate < yesterday) {
    return { 
      isValid: true, 
      error: null, 
      warning: 'This item has already expired' 
    };
  }
  
  // Check if date is too far in the future (5 years)
  const fiveYearsFromNow = new Date();
  fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
  
  if (expiryDate > fiveYearsFromNow) {
    return { 
      isValid: true, 
      error: null, 
      warning: 'Expiry date is more than 5 years in the future' 
    };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate location
 */
export function validateLocation(location) {
  if (!location || !location.trim()) {
    return { isValid: false, error: 'Location is required' };
  }
  
  if (location.length > 50) {
    return { isValid: false, error: 'Location must be less than 50 characters' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate category
 */
export function validateCategory(category) {
  if (!category || !category.trim()) {
    return { isValid: false, error: 'Category is required' };
  }
  
  if (category.length > 50) {
    return { isValid: false, error: 'Category must be less than 50 characters' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate notes
 */
export function validateNotes(notes) {
  if (!notes) {
    return { isValid: true, error: null }; // Notes are optional
  }
  
  if (notes.length > 500) {
    return { isValid: false, error: 'Notes must be less than 500 characters' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate email
 */
export function validateEmail(email) {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate password
 */
export function validatePassword(password) {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: 'Password must be less than 128 characters' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate username
 */
export function validateUsername(username) {
  if (!username || !username.trim()) {
    return { isValid: false, error: 'Username is required' };
  }
  
  if (username.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 50) {
    return { isValid: false, error: 'Username must be less than 50 characters' };
  }
  
  // Allow letters, numbers, underscores, hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validate entire item object
 */
export function validateItem(item) {
  const errors = {};
  const warnings = {};
  
  // Validate name
  const nameValidation = validateItemName(item.name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error;
  }
  
  // Validate barcode
  if (item.barcode) {
    const barcodeValidation = validateBarcode(item.barcode);
    if (!barcodeValidation.isValid) {
      errors.barcode = barcodeValidation.error;
    }
  }
  
  // Validate quantity
  const quantityValidation = validateQuantity(item.quantity);
  if (!quantityValidation.isValid) {
    errors.quantity = quantityValidation.error;
  }
  
  // Validate expiry date
  if (item.expiry_date) {
    const expiryValidation = validateExpiryDate(item.expiry_date);
    if (!expiryValidation.isValid) {
      errors.expiry_date = expiryValidation.error;
    } else if (expiryValidation.warning) {
      warnings.expiry_date = expiryValidation.warning;
    }
  }
  
  // Validate location
  const locationValidation = validateLocation(item.location);
  if (!locationValidation.isValid) {
    errors.location = locationValidation.error;
  }
  
  // Validate category
  const categoryValidation = validateCategory(item.category);
  if (!categoryValidation.isValid) {
    errors.category = categoryValidation.error;
  }
  
  // Validate notes
  if (item.notes) {
    const notesValidation = validateNotes(item.notes);
    if (!notesValidation.isValid) {
      errors.notes = notesValidation.error;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

export default {
  validateItemName,
  validateBarcode,
  validateQuantity,
  validateExpiryDate,
  validateLocation,
  validateCategory,
  validateNotes,
  validateEmail,
  validatePassword,
  validateUsername,
  validateItem,
};
