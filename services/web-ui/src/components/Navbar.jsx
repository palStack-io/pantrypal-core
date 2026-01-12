// Navigation bar component
import { Menu, Settings, LogOut, User } from 'lucide-react';
import { colors, spacing, shadows } from '../colors';

export function Navbar({ onMenuClick, currentUser, onLogout, onSettingsClick }) {
  return (
    <nav
      style={{
        backgroundColor: colors.card,
        boxShadow: shadows.medium,
        padding: `${spacing.lg} ${spacing.xl}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
        <button
          onClick={onMenuClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: spacing.sm,
            display: 'flex',
            alignItems: 'center',
            color: colors.textPrimary,
          }}
        >
          <Menu size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <span style={{ fontSize: '32px' }}>🥫</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: colors.textPrimary }}>
              PantryPal
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: colors.textSecondary }}>
              Self-hosted pantry management
            </p>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        {currentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.md}`,
              backgroundColor: colors.backgroundGray,
              borderRadius: '20px',
            }}
          >
            <User size={18} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{currentUser.username}</span>
          </div>
        )}
        
        <button
          onClick={onSettingsClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: spacing.sm,
            display: 'flex',
            alignItems: 'center',
            color: colors.textSecondary,
          }}
        >
          <Settings size={20} />
        </button>

        {currentUser && onLogout && (
          <button
            onClick={onLogout}
            style={{
              background: colors.danger,
              border: 'none',
              cursor: 'pointer',
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
