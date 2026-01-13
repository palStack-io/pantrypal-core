import { ChefHat, Clock, Users, Sparkles } from 'lucide-react';
import { getColors, spacing, borderRadius, getShadows, getGradient } from '../colors';

export function RecipesPage({ isDark }) {
  const colors = getColors(isDark);
  const gradient = getGradient(isDark);
  const shadows = getShadows(isDark);

  return (
    <div style={{ padding: spacing.xl, maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
          <ChefHat size={32} style={{ color: colors.primary }} />
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: colors.textPrimary, margin: 0 }}>
            Recipes
          </h1>
        </div>
        <p style={{ fontSize: '16px', color: colors.textSecondary, margin: 0 }}>
          Discover recipes based on your pantry items
        </p>
      </div>

      {/* Coming Soon Card */}
      <div style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.xl,
        padding: spacing.xxl,
        boxShadow: shadows.large,
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '60px',
          background: gradient.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '60px',
          margin: '0 auto',
          marginBottom: spacing.xl,
          boxShadow: shadows.large,
        }}>
          👨‍🍳
        </div>

        <h2 style={{ fontSize: '28px', fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md }}>
          Recipe Feature Coming Soon!
        </h2>

        <p style={{ fontSize: '16px', color: colors.textSecondary, lineHeight: '1.6', marginBottom: spacing.xl, maxWidth: '600px', margin: '0 auto' }}>
          We're cooking up something special! Soon you'll be able to discover amazing recipes based on the ingredients in your pantry.
        </p>

        {/* Feature Preview Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.lg, marginTop: spacing.xl }}>
          <FeatureCard
            icon={<Sparkles size={24} />}
            title="Smart Suggestions"
            description="Get recipes based on what you have"
            colors={colors}
            isDark={isDark}
          />
          <FeatureCard
            icon={<Clock size={24} />}
            title="Quick Filters"
            description="Filter by prep time and difficulty"
            colors={colors}
            isDark={isDark}
          />
          <FeatureCard
            icon={<Users size={24} />}
            title="Serving Sizes"
            description="Adjust recipes for any group size"
            colors={colors}
            isDark={isDark}
          />
        </div>

        {/* Placeholder Recipe Cards */}
        <div style={{ marginTop: spacing.xxl }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg, textAlign: 'left' }}>
            Preview: What's Coming
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing.lg }}>
            <RecipePreviewCard
              title="Pasta Primavera"
              time="25 min"
              difficulty="Easy"
              ingredients={5}
              colors={colors}
              isDark={isDark}
            />
            <RecipePreviewCard
              title="Chicken Stir Fry"
              time="20 min"
              difficulty="Easy"
              ingredients={7}
              colors={colors}
              isDark={isDark}
            />
            <RecipePreviewCard
              title="Veggie Soup"
              time="35 min"
              difficulty="Medium"
              ingredients={8}
              colors={colors}
              isDark={isDark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, colors, isDark }) {
  const shadows = getShadows(isDark);
  return (
    <div style={{
      background: colors.accentBg,
      border: `1px solid ${colors.border}`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      textAlign: 'center',
    }}>
      <div style={{
        color: colors.primary,
        marginBottom: spacing.md,
        display: 'flex',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '14px', fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs }}>
        {title}
      </div>
      <div style={{ fontSize: '12px', color: colors.textSecondary }}>
        {description}
      </div>
    </div>
  );
}

function RecipePreviewCard({ title, time, difficulty, ingredients, colors, isDark }) {
  const shadows = getShadows(isDark);
  return (
    <div style={{
      background: colors.background,
      border: `1px solid ${colors.border}`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      boxShadow: shadows.small,
      opacity: 0.6,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Coming Soon Overlay */}
      <div style={{
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        background: colors.primary,
        color: 'white',
        padding: '4px 8px',
        borderRadius: borderRadius.sm,
        fontSize: '10px',
        fontWeight: '700',
        textTransform: 'uppercase',
      }}>
        Soon
      </div>

      <div style={{
        width: '100%',
        height: '120px',
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(251, 191, 36, 0.2))',
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '48px',
      }}>
        🍝
      </div>

      <h4 style={{ fontSize: '16px', fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm }}>
        {title}
      </h4>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, fontSize: '12px', color: colors.textSecondary }}>
        <span>⏱️ {time}</span>
        <span>•</span>
        <span>📊 {difficulty}</span>
        <span>•</span>
        <span>🥘 {ingredients} items</span>
      </div>
    </div>
  );
}

export default RecipesPage;
