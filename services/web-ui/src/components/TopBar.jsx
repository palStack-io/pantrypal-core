// TopBar
import { useState, useRef, useEffect } from 'react';
import { Bell, Settings, User, Moon, Sun, LogOut, AlertTriangle, Calendar } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { useItems } from '../hooks/useItems';
import { getExpiryStatus, getExpiryBadgeText } from '../utils/dateUtils';

export function TopBar({ onMenuClick, currentUser, onLogout, onSettingsClick, isDark, onToggleDark }) {
  const colors = getColors(isDark);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const { items } = useItems();

  // Get expiring and expired items for notifications
  const expiringItems = items.filter(item => {
    const status = getExpiryStatus(item.expiry_date);
    return status === 'critical' || status === 'warning' || status === 'expired';
  }).slice(0, 10); // Limit to 10 notifications

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ background: colors.card, borderBottom: `1px solid ${colors.border}`, padding: `${spacing.lg} ${spacing.xxl}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', transition: 'all 0.3s ease' }}>
      {/* Right Actions */}
      <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
        <button onClick={onToggleDark} style={{ background: 'transparent', border: 'none', padding: '10px', cursor: 'pointer', borderRadius: borderRadius.md, color: colors.primary }} title={isDark ? 'Light mode' : 'Dark mode'}>
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div ref={notificationRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '10px',
              cursor: 'pointer',
              borderRadius: borderRadius.md,
              color: expiringItems.length > 0 ? colors.warning : colors.textSecondary,
              position: 'relative',
            }}
          >
            <Bell size={20} />
            {expiringItems.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: colors.danger,
              }} />
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: spacing.sm,
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.lg,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '350px',
              maxWidth: '400px',
              maxHeight: '500px',
              overflowY: 'auto',
              zIndex: 1000,
            }}>
              <div style={{
                padding: `${spacing.md} ${spacing.lg}`,
                borderBottom: `1px solid ${colors.border}`,
                fontWeight: '600',
                color: colors.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
              }}>
                <AlertTriangle size={18} />
                <span>Notifications ({expiringItems.length})</span>
              </div>

              {expiringItems.length === 0 ? (
                <div style={{
                  padding: `${spacing.xl} ${spacing.lg}`,
                  textAlign: 'center',
                  color: colors.textSecondary,
                }}>
                  No expiring items
                </div>
              ) : (
                <div>
                  {expiringItems.map(item => {
                    const status = getExpiryStatus(item.expiry_date);
                    const badge = getExpiryBadgeText(item.expiry_date);
                    const statusColor = status === 'expired' ? colors.danger :
                                       status === 'critical' ? colors.warning : colors.info;

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: `${spacing.md} ${spacing.lg}`,
                          borderBottom: `1px solid ${colors.border}`,
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = colors.background}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'start',
                          gap: spacing.sm,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: '500',
                              color: colors.textPrimary,
                              marginBottom: spacing.xs,
                            }}>
                              {item.name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: colors.textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing.xs,
                            }}>
                              <Calendar size={12} />
                              {badge}
                            </div>
                          </div>
                          <span style={{
                            padding: `${spacing.xs} ${spacing.sm}`,
                            backgroundColor: statusColor + '20',
                            color: statusColor,
                            borderRadius: borderRadius.sm,
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                          }}>
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {currentUser && (
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ background: 'transparent', border: 'none', padding: '10px', cursor: 'pointer', borderRadius: borderRadius.md, color: colors.textSecondary }}
            >
              <User size={20} />
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: spacing.sm,
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: borderRadius.lg,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '200px',
                zIndex: 1000,
              }}>
                <div style={{
                  padding: `${spacing.md} ${spacing.lg}`,
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  <div style={{ fontWeight: '600', color: colors.textPrimary }}>
                    {currentUser.username}
                  </div>
                  {currentUser.email && (
                    <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                      {currentUser.email}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onSettingsClick();
                  }}
                  style={{
                    width: '100%',
                    padding: `${spacing.md} ${spacing.lg}`,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    color: colors.textPrimary,
                    fontSize: '14px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.background}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    padding: `${spacing.md} ${spacing.lg}`,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    color: colors.textPrimary,
                    fontSize: '14px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.background}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TopBar;