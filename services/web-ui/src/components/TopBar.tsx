import { useState, useRef, useEffect } from 'react';
import { Bell, Settings, User, Moon, Sun, LogOut, AlertTriangle, Calendar } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import { useItems } from '../hooks/useItems';
import { getExpiryStatus, getExpiryBadgeText } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import type { User as UserType } from '../types';

interface TopBarProps {
  currentUser?: UserType | null;
  onLogout: () => void;
  onSettingsClick: () => void;
  onToggleDark: () => void;
}

export function TopBar({ currentUser, onLogout, onSettingsClick, onToggleDark }: TopBarProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { items } = useItems();

  const expiringItems = items.filter(item => {
    const status = getExpiryStatus(item.expiry_date);
    return status === 'critical' || status === 'warning' || status === 'expired';
  }).slice(0, 10);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setShowUserMenu(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const btnStyle = { width: '38px', height: '38px', borderRadius: '50%', border: `1px solid ${colors.border}`, background: colors.card, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, transition: 'box-shadow 0.15s, transform 0.15s', flexShrink: 0 };
  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; };
  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'none'; };

  return (
    <div style={{ position: 'fixed', top: spacing.lg, right: spacing.lg, display: 'flex', gap: spacing.sm, alignItems: 'center', zIndex: 200 }}>
      <button onClick={onToggleDark} style={btnStyle} title={isDark ? 'Light mode' : 'Dark mode'} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div ref={notificationRef} style={{ position: 'relative' }}>
        <button onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }} style={{ ...btnStyle, color: expiringItems.length > 0 ? colors.warning : colors.textSecondary }} title="Notifications" onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
          <Bell size={16} />
          {expiringItems.length > 0 && <span style={{ position: 'absolute', top: '5px', right: '5px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: colors.danger, border: `1.5px solid ${colors.card}` }} />}
        </button>
        {showNotifications && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: '320px', maxWidth: '380px', maxHeight: '480px', overflowY: 'auto', zIndex: 300 }}>
            <div style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}`, fontWeight: '600', color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: '14px' }}>
              <AlertTriangle size={16} /><span>Notifications ({expiringItems.length})</span>
            </div>
            {expiringItems.length === 0 ? (
              <div style={{ padding: `${spacing.xl} ${spacing.lg}`, textAlign: 'center', color: colors.textSecondary, fontSize: '14px' }}>No expiring items</div>
            ) : (
              expiringItems.map(item => {
                const status = getExpiryStatus(item.expiry_date);
                const badge = getExpiryBadgeText(item.expiry_date);
                const statusColor = status === 'expired' ? colors.danger : status === 'critical' ? colors.warning : colors.info;
                return (
                  <div key={item.id} style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}`, transition: 'background 0.15s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = colors.background} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: spacing.sm }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.xs, fontSize: '14px' }}>{item.name}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                          <Calendar size={11} />{badge}
                        </div>
                      </div>
                      <span style={{ padding: `${spacing.xs} ${spacing.sm}`, backgroundColor: statusColor + '20', color: statusColor, borderRadius: borderRadius.sm, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {currentUser && (
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }} style={btnStyle} title={currentUser.username} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
            <User size={16} />
          </button>
          {showUserMenu && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: '200px', zIndex: 300 }}>
              <div style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '14px' }}>{currentUser.username}</div>
                {currentUser.email && <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>{currentUser.email}</div>}
              </div>
              {[
                { icon: <Settings size={15} />, label: 'Settings', action: () => { setShowUserMenu(false); onSettingsClick(); } },
                { icon: <LogOut size={15} />, label: 'Logout', action: () => { setShowUserMenu(false); onLogout(); } },
              ].map(({ icon, label, action }) => (
                <button key={label} onClick={action} style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textPrimary, fontSize: '14px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = colors.background} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TopBar;
