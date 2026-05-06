import { useState, useEffect, useCallback } from 'react';
import { getColors, borderRadius, spacing } from '../colors';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEY = 'pantrypal_last_seen_release';

interface ReleaseItem {
  emoji?: string;
  text: string;
}

interface Release {
  id: number;
  version: string;
  title?: string;
  items: ReleaseItem[];
  published_at: string;
}

interface Props {
  onClose: () => void;
  release: Release;
}

function WhatsNewModal({ release, onClose }: Props) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, release.version);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={handleDismiss}
    >
      <div
        style={{ backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.xl, maxWidth: 440, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: '40px', marginBottom: spacing.sm }}>🚀</div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: colors.textPrimary }}>
            What's New in v{release.version}
          </h2>
          {release.title && (
            <p style={{ margin: `${spacing.xs} 0 0`, fontSize: '14px', color: colors.textSecondary }}>{release.title}</p>
          )}
        </div>

        <ul style={{ margin: `0 0 ${spacing.xl}`, padding: 0, listStyle: 'none' }}>
          {release.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, padding: `${spacing.sm} 0`, borderBottom: i < release.items.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
              {item.emoji && <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.emoji}</span>}
              <span style={{ fontSize: '14px', color: colors.textSecondary, lineHeight: 1.5 }}>{item.text}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={handleDismiss}
          style={{ width: '100%', padding: spacing.md, backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

export function useWhatsNew() {
  const [pendingRelease, setPendingRelease] = useState<Release | null>(null);

  useEffect(() => {
    fetch('/api/releases', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const latest: Release | undefined = data.releases?.[0];
        if (!latest) return;
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (lastSeen !== latest.version) {
          setPendingRelease(latest);
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  const dismiss = useCallback(() => {
    if (pendingRelease) localStorage.setItem(STORAGE_KEY, pendingRelease.version);
    setPendingRelease(null);
  }, [pendingRelease]);

  return { pendingRelease, dismiss };
}

export default WhatsNewModal;
