import type { ValidationResult, ItemValidationResult } from '../types';

export interface ItemInput {
  name?: string;
  barcode?: string | null;
  quantity?: number | string | null;
  expiry_date?: string | null;
  location?: string | null;
  category?: string | null;
  notes?: string | null;
}

export function validateItemName(name: string | null | undefined): ValidationResult {
  if (!name || !name.trim()) return { isValid: false, error: 'Item name is required' };
  if (name.length < 2) return { isValid: false, error: 'Item name must be at least 2 characters' };
  if (name.length > 100) return { isValid: false, error: 'Item name must be less than 100 characters' };
  return { isValid: true, error: null };
}

export function validateBarcode(barcode: string | null | undefined): ValidationResult {
  if (!barcode) return { isValid: true, error: null };
  const cleaned = barcode.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(cleaned)) return { isValid: false, error: 'Barcode must contain only numbers' };
  if (![8, 12, 13, 14].includes(cleaned.length)) {
    return { isValid: false, error: 'Barcode must be 8, 12, 13, or 14 digits' };
  }
  return { isValid: true, error: null, cleaned };
}

export function validateQuantity(quantity: number | string | null | undefined): ValidationResult {
  if (quantity === null || quantity === undefined || quantity === '') {
    return { isValid: false, error: 'Quantity is required' };
  }
  const num = Number(quantity);
  if (isNaN(num)) return { isValid: false, error: 'Quantity must be a number' };
  if (num < 0) return { isValid: false, error: 'Quantity cannot be negative' };
  if (num > 9999) return { isValid: false, error: 'Quantity must be less than 10,000' };
  if (!Number.isInteger(num)) return { isValid: false, error: 'Quantity must be a whole number' };
  return { isValid: true, error: null, value: num };
}

export function validateExpiryDate(date: string | null | undefined): ValidationResult {
  if (!date) return { isValid: true, error: null };
  const expiryDate = new Date(date);
  if (isNaN(expiryDate.getTime())) return { isValid: false, error: 'Invalid date format' };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  if (expiryDate < yesterday) {
    return { isValid: true, error: null, warning: 'This item has already expired' };
  }
  const fiveYearsFromNow = new Date();
  fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
  if (expiryDate > fiveYearsFromNow) {
    return { isValid: true, error: null, warning: 'Expiry date is more than 5 years in the future' };
  }
  return { isValid: true, error: null };
}

export function validateLocation(location: string | null | undefined): ValidationResult {
  if (!location || !location.trim()) return { isValid: false, error: 'Location is required' };
  if (location.length > 50) return { isValid: false, error: 'Location must be less than 50 characters' };
  return { isValid: true, error: null };
}

export function validateCategory(category: string | null | undefined): ValidationResult {
  if (!category || !category.trim()) return { isValid: false, error: 'Category is required' };
  if (category.length > 50) return { isValid: false, error: 'Category must be less than 50 characters' };
  return { isValid: true, error: null };
}

export function validateNotes(notes: string | null | undefined): ValidationResult {
  if (!notes) return { isValid: true, error: null };
  if (notes.length > 500) return { isValid: false, error: 'Notes must be less than 500 characters' };
  return { isValid: true, error: null };
}

export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email || !email.trim()) return { isValid: false, error: 'Email is required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { isValid: false, error: 'Invalid email format' };
  return { isValid: true, error: null };
}

export function validatePassword(password: string | null | undefined): ValidationResult {
  if (!password) return { isValid: false, error: 'Password is required' };
  if (password.length < 6) return { isValid: false, error: 'Password must be at least 6 characters' };
  if (password.length > 128) return { isValid: false, error: 'Password must be less than 128 characters' };
  return { isValid: true, error: null };
}

export function validateUsername(username: string | null | undefined): ValidationResult {
  if (!username || !username.trim()) return { isValid: false, error: 'Username is required' };
  if (username.length < 3) return { isValid: false, error: 'Username must be at least 3 characters' };
  if (username.length > 50) return { isValid: false, error: 'Username must be less than 50 characters' };
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }
  return { isValid: true, error: null };
}

export function validateItem(item: ItemInput): ItemValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  const nameResult = validateItemName(item.name);
  if (!nameResult.isValid && nameResult.error) errors.name = nameResult.error;

  if (item.barcode) {
    const barcodeResult = validateBarcode(item.barcode);
    if (!barcodeResult.isValid && barcodeResult.error) errors.barcode = barcodeResult.error;
  }

  const quantityResult = validateQuantity(item.quantity);
  if (!quantityResult.isValid && quantityResult.error) errors.quantity = quantityResult.error;

  if (item.expiry_date) {
    const expiryResult = validateExpiryDate(item.expiry_date);
    if (!expiryResult.isValid && expiryResult.error) errors.expiry_date = expiryResult.error;
    else if (expiryResult.warning) warnings.expiry_date = expiryResult.warning;
  }

  const locationResult = validateLocation(item.location);
  if (!locationResult.isValid && locationResult.error) errors.location = locationResult.error;

  const categoryResult = validateCategory(item.category);
  if (!categoryResult.isValid && categoryResult.error) errors.category = categoryResult.error;

  if (item.notes) {
    const notesResult = validateNotes(item.notes);
    if (!notesResult.isValid && notesResult.error) errors.notes = notesResult.error;
  }

  return { isValid: Object.keys(errors).length === 0, errors, warnings };
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
