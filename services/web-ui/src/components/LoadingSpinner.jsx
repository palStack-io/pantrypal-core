// Loading spinner component
import { colors } from '../colors';

export function LoadingSpinner({ size = 'md', color = colors.primary }) {
  const sizes = {
    sm: '20px',
    md: '40px',
    lg: '60px',
  };

  const spinnerSize = sizes[size] || sizes.md;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: spinnerSize,
        height: spinnerSize,
        border: `4px solid ${colors.border}`,
        borderTop: `4px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LoadingSpinner;
