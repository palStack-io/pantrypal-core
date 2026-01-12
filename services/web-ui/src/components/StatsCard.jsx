// Statistics card component
import { colors, borderRadius, spacing, shadows, gradients } from '../colors';

export function StatsCard({ icon: Icon, label, value, color = colors.primary, trend }) {
  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.medium,
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = shadows.large;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadows.medium;
      }}
    >
      {/* Header with icon */}
      <div
        style={{
          background: gradients.primary,
          padding: spacing.md,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          color: 'white',
        }}
      >
        {Icon && <Icon size={24} />}
        <span style={{ fontWeight: '600', fontSize: '14px' }}>{label}</span>
      </div>

      {/* Value */}
      <div
        style={{
          padding: spacing.xl,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: color,
            marginBottom: trend ? spacing.sm : 0,
          }}
        >
          {value}
        </div>
        
        {trend && (
          <div
            style={{
              fontSize: '12px',
              color: trend.type === 'up' ? colors.success : colors.danger,
              fontWeight: '500',
            }}
          >
            {trend.type === 'up' ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
