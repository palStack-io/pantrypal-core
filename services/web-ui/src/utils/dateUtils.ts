import type { ExpiryStatus } from '../types';

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'No expiry';
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

export function getDaysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(expiryDate: string | null | undefined): ExpiryStatus {
  if (!expiryDate) return 'none';
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'good';
}

export function getExpiryBadgeText(expiryDate: string | null | undefined): string {
  if (!expiryDate) return 'No expiry';
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'No expiry';
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return 'Expires today!';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 30) return `${days} days left`;
  return `${Math.floor(days / 30)} months+`;
}

export function getExpiryColor(expiryDate: string | null | undefined): string {
  const status = getExpiryStatus(expiryDate);
  const colorMap: Record<ExpiryStatus, string> = {
    none: '#6b7280',
    good: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    expired: '#7f1d1d',
  };
  return colorMap[status];
}

export function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export function getRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

interface WithExpiryDate {
  expiry_date?: string | null;
}

export function sortByExpiry<T extends WithExpiryDate>(items: T[], ascending = true): T[] {
  return [...items].sort((a, b) => {
    if (!a.expiry_date && !b.expiry_date) return 0;
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    const dateA = new Date(a.expiry_date).getTime();
    const dateB = new Date(b.expiry_date).getTime();
    return ascending ? dateA - dateB : dateB - dateA;
  });
}

export function filterByExpiryStatus<T extends WithExpiryDate>(items: T[], status: ExpiryStatus | 'all'): T[] {
  if (status === 'all') return items;
  return items.filter(item => getExpiryStatus(item.expiry_date) === status);
}

export function getExpiringWithinDays<T extends WithExpiryDate>(items: T[], days: number): T[] {
  return items.filter(item => {
    if (!item.expiry_date) return false;
    const daysUntil = getDaysUntilExpiry(item.expiry_date);
    return daysUntil !== null && daysUntil >= 0 && daysUntil <= days;
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
