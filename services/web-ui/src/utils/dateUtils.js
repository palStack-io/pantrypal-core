// Date utility functions for pantryPal

/**
 * Format date to readable string
 */
export function formatDate(dateString) {
  if (!dateString) return 'No expiry';
  
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Get days until expiry
 */
export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Get expiry status (good, warning, critical, expired)
 */
export function getExpiryStatus(expiryDate) {
  if (!expiryDate) return 'none';
  
  const days = getDaysUntilExpiry(expiryDate);
  
  if (days < 0) return 'expired';
  if (days === 0) return 'critical';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'good';
}

/**
 * Get expiry badge text
 */
export function getExpiryBadgeText(expiryDate) {
  if (!expiryDate) return 'No expiry';
  
  const days = getDaysUntilExpiry(expiryDate);
  
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return 'Expires today!';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 7) return `${days} days left`;
  if (days <= 30) return `${days} days left`;
  return `${Math.floor(days / 30)} months+`;
}

/**
 * Get expiry color based on status
 */
export function getExpiryColor(expiryDate) {
  const status = getExpiryStatus(expiryDate);
  
  const colors = {
    none: '#6b7280',      // Gray
    good: '#10b981',      // Green
    warning: '#f59e0b',   // Amber
    critical: '#ef4444',  // Red
    expired: '#7f1d1d',   // Dark red
  };
  
  return colors[status] || colors.none;
}

/**
 * Format date for input field (YYYY-MM-DD)
 */
export function formatDateForInput(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Check if date is valid
 */
export function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  
  return formatDate(dateString);
}

/**
 * Sort items by expiry date
 */
export function sortByExpiry(items, ascending = true) {
  return [...items].sort((a, b) => {
    // Items without expiry go to the end
    if (!a.expiry_date && !b.expiry_date) return 0;
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    
    const dateA = new Date(a.expiry_date);
    const dateB = new Date(b.expiry_date);
    
    return ascending ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Filter items by expiry status
 */
export function filterByExpiryStatus(items, status) {
  if (status === 'all') return items;
  
  return items.filter(item => getExpiryStatus(item.expiry_date) === status);
}

/**
 * Get items expiring within days
 */
export function getExpiringWithinDays(items, days) {
  return items.filter(item => {
    if (!item.expiry_date) return false;
    const daysUntil = getDaysUntilExpiry(item.expiry_date);
    return daysUntil >= 0 && daysUntil <= days;
  });
}

export default {
  formatDate,
  getDaysUntilExpiry,
  getExpiryStatus,
  getExpiryBadgeText,
  getExpiryColor,
  formatDateForInput,
  isValidDate,
  getRelativeTime,
  sortByExpiry,
  filterByExpiryStatus,
  getExpiringWithinDays,
};
