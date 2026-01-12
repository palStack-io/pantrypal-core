// Custom hook for inventory statistics
import { useState, useEffect, useCallback } from 'react';
import { getDaysUntilExpiry, getExpiryStatus } from '../utils/dateUtils';

export function useStats(items = []) {
  const [stats, setStats] = useState({
    totalItems: 0,
    expiringSoon: 0,
    expired: 0,
    locations: 0,
    categories: 0,
  });

  // Calculate stats from items
  const calculateStats = useCallback((itemsList) => {
    if (!itemsList || itemsList.length === 0) {
      return {
        totalItems: 0,
        expiringSoon: 0,
        expired: 0,
        locations: 0,
        categories: 0,
      };
    }

    const uniqueLocations = new Set(itemsList.map(item => item.location).filter(Boolean));
    const uniqueCategories = new Set(itemsList.map(item => item.category).filter(Boolean));
    
    let expiringSoon = 0;
    let expired = 0;
    
    itemsList.forEach(item => {
      if (item.expiry_date) {
        const status = getExpiryStatus(item.expiry_date);
        if (status === 'expired') {
          expired += item.quantity || 1;
        } else if (status === 'critical' || status === 'warning') {
          expiringSoon += item.quantity || 1;
        }
      }
    });

    return {
      totalItems: itemsList.reduce((sum, item) => sum + (item.quantity || 1), 0),
      expiringSoon,
      expired,
      locations: uniqueLocations.size,
      categories: uniqueCategories.size,
    };
  }, []);

  // Update stats when items change
  useEffect(() => {
    setStats(calculateStats(items));
  }, [items, calculateStats]);

  return {
    stats,
    loading: false,
    error: null,
    refresh: () => setStats(calculateStats(items)),
  };
}

export default useStats;
