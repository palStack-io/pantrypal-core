import { useState, useEffect } from 'react';
import { Clock, Users, Settings, RefreshCw, Heart, Search, X, ArrowLeft } from 'lucide-react';
import { getColors, spacing, borderRadius } from '../colors';
import {
  getRecipes, getRecipeSuggestions, getExpiringRecipes, searchRecipes, getFavoriteRecipes,
  getRecipeIntegration, createRecipeIntegration, deleteRecipeIntegration, importRecipes,
  matchRecipes, toggleFavorite, getRecipe, markCooked, updateRecipeNotes
} from '../api';
import { RecipeSkeleton } from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';
import type { User } from '../types';

interface Recipe {
  id: string | number;
  name: string;
  match_percentage?: number;
  expiring_ingredient_count?: number;
  missing_ingredient_count?: number;
  available_ingredients?: (string | Record<string, unknown>)[];
  missing_ingredients?: (string | Record<string, unknown>)[];
  expiring_ingredients?: (string | Record<string, unknown>)[];
  ingredients?: (string | Record<string, unknown>)[];
  instructions?: (string | Record<string, unknown>)[];
  favorite?: boolean;
  total_time?: number;
  servings?: number;
  source?: string;
  times_cooked?: number;
  last_made?: string;
  notes?: string;
  image_url?: string;
}

interface Integration {
  configured: boolean;
  provider?: string;
  server_url?: string;
  recipe_count?: number;
}

interface ConnectionStatus {
  connected: boolean;
  recipeCount?: number;
  error?: string;
}

interface RecipesPageProps {
  currentUser?: User | null;
}

interface RecipeCardProps {
  recipe: Recipe;
  colors: ReturnType<typeof getColors>;
  onToggleFavorite: (id: string | number, e: React.MouseEvent) => void;
  onClick: () => void;
  onAddMissingToShoppingList: (recipe: Recipe, e: React.MouseEvent) => void;
}

interface RecipeDetailViewProps {
  recipe: Recipe;
  colors: ReturnType<typeof getColors>;
  onBack: () => void;
  onToggleFavorite: (id: string | number, e: React.MouseEvent) => void;
  onAddMissingToShoppingList: (recipe: Recipe, e: React.MouseEvent) => void;
  showSuccess: (msg: string) => void;
}

const extractIngredientName = (ingredient: string | Record<string, unknown>): string => {
  if (!ingredient) return '';
  const str = typeof ingredient === 'string' ? ingredient : ((ingredient.name || ingredient.note || '') as string);
  const unitPattern = /tablespoons?|teaspoons?|fluid\s+ounces?|ounces?|pounds?|grams?|kilograms?|milliliters?|millilitres?|liters?|litres?|tbsps?|tsps?|cups?|oz|lbs?|g|kg|ml|pinch(?:es)?|dash(?:es)?|cans?|packages?|pkg|bunch(?:es)?|heads?|cloves?|slices?|pieces?/i;
  let cleaned = str
    .replace(new RegExp(`^[\\d\\s/.,]+\\s*(?:${unitPattern.source})?\\.?\\s*`, 'i'), '')
    .replace(/^[\d\s/.,]+\s*/i, '')
    .replace(new RegExp(`^(?:${unitPattern.source})\\s+`, 'i'), '')
    .trim();
  cleaned = cleaned
    .replace(/\s*[(\,]\s*(chopped|diced|minced|sliced|grated|shredded|crushed|melted|softened|room temperature|to taste|optional|divided|packed|sifted|plus more|for serving|for garnish|or more|as needed|if desired|fresh|dried|frozen|canned|cooked|uncooked|raw|peeled|seeded|pitted|trimmed|cut into|about|approximately|mixed with.*|combined with.*).*$/i, '')
    .trim();
  if (cleaned.length > 0) cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned || str;
};

const addToShoppingList = async (items: { name: string; quantity: number; category: string }[]) => {
  const results = [];
  for (const item of items) {
    const cleanName = extractIngredientName(item.name);
    if (!cleanName) continue;
    try {
      const response = await fetch('/api/shopping-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: cleanName, quantity: 1, category: 'Recipe Ingredients' }) });
      if (response.ok) results.push(await response.json());
    } catch (err) {
      console.error('Failed to add item to shopping list:', err);
    }
  }
  return results;
};

export function RecipesPage({ currentUser }: RecipesPageProps) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const isAdmin = currentUser?.is_admin;

  const [view, setView] = useState<'list' | 'detail' | 'setup'>('list');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('expiring');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState('none');
  const [serverUrl, setServerUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [importImages, setImportImages] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [syncDeletions, setSyncDeletions] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [importing, setImporting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [filterCounts, setFilterCounts] = useState({ expiring: 0, canMake: 0, all: 0, favorites: 0 });

  useEffect(() => { loadIntegration(); }, []);

  useEffect(() => {
    if (integration?.configured) { loadRecipes(); loadFilterCounts(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, integration]);

  const loadIntegration = async () => {
    try {
      const data = await getRecipeIntegration();
      setIntegration(data);
      if (data.configured) { setProvider(data.provider || 'mealie'); setServerUrl(data.server_url || ''); setConnectionStatus({ connected: true, recipeCount: data.recipe_count || 0 }); }
      if (!data.configured) { setView('setup'); setLoading(false); }
    } catch { setView('setup'); setLoading(false); }
  };

  const loadFilterCounts = async () => {
    try {
      const [expiring, suggestions, all, favorites] = await Promise.all([getExpiringRecipes(50), getRecipeSuggestions(50, 50), getRecipes(500, 0), getFavoriteRecipes()]);
      setFilterCounts({ expiring: expiring.count || expiring.recipes?.length || 0, canMake: suggestions.count || suggestions.recipes?.length || 0, all: all.total || all.recipes?.length || 0, favorites: favorites.count || favorites.recipes?.length || 0 });
    } catch (err) { console.error('Failed to load filter counts:', err); }
  };

  const loadRecipes = async () => {
    setLoading(true); setError(null);
    try {
      let data;
      switch (filterMode) {
        case 'canMake': data = await getRecipeSuggestions(50, 50); setRecipes(data.recipes || []); break;
        case 'expiring': data = await getExpiringRecipes(50); setRecipes(data.recipes || []); break;
        case 'favorites': data = await getFavoriteRecipes(); setRecipes(data.recipes || []); break;
        case 'search':
          data = searchQuery ? await searchRecipes(searchQuery, 50) : await getRecipes(50, 0);
          setRecipes(data.recipes || []); break;
        default: data = await getRecipes(100, 0); setRecipes(data.recipes || []);
      }
    } catch (err) {
      setError((err as any)?.response?.data?.detail || (err as Error).message);
    } finally { setLoading(false); }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true); setConnectionStatus(null);
    try {
      await createRecipeIntegration({ provider, server_url: serverUrl, api_token: apiToken, import_images: importImages });
      const data = await getRecipeIntegration();
      setConnectionStatus({ connected: true, recipeCount: data.recipe_count || 0 });
      setIntegration(data);
    } catch (err) {
      setConnectionStatus({ connected: false, error: (err as any)?.response?.data?.detail || (err as Error).message });
    } finally { setTestingConnection(false); }
  };

  const handleSetupIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (provider === 'none') {
      try { await deleteRecipeIntegration(); setIntegration({ configured: false }); setConnectionStatus(null); return; }
      catch (err) { setSetupError((err as any)?.response?.data?.detail || (err as Error).message); return; }
    }
    setSetupLoading(true); setSetupError(null);
    try {
      await createRecipeIntegration({ provider, server_url: serverUrl, api_token: apiToken, import_images: importImages });
      await loadIntegration(); setView('list');
    } catch (err) { setSetupError((err as any)?.response?.data?.detail || (err as Error).message); }
    finally { setSetupLoading(false); }
  };

  const handleImport = async () => {
    setImporting(true); setError(null);
    try {
      const stats = await importRecipes(500);
      await loadRecipes(); await loadFilterCounts();
      showSuccess(`Imported ${stats.imported} recipes successfully!`);
    } catch (err) { setError((err as any)?.response?.data?.detail || (err as Error).message); }
    finally { setImporting(false); }
  };

  const handleMatch = async () => {
    setMatching(true); setError(null);
    try { await matchRecipes(7); await loadRecipes(); await loadFilterCounts(); showSuccess('Recipes matched with pantry items!'); }
    catch (err) { setError((err as any)?.response?.data?.detail || (err as Error).message); }
    finally { setMatching(false); }
  };

  const handleToggleFavorite = async (recipeId: string | number, e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try { await toggleFavorite(recipeId); await loadRecipes(); await loadFilterCounts(); }
    catch (err) { console.error('Failed to toggle favorite:', err); }
  };

  const handleSearch = () => { if (searchQuery.trim()) setFilterMode('search'); };

  const handleRecipeClick = async (recipe: Recipe) => {
    try { const fullRecipe = await getRecipe(recipe.id); setSelectedRecipe(fullRecipe); setView('detail'); }
    catch { setSelectedRecipe(recipe); setView('detail'); }
  };

  const handleAddMissingToShoppingList = async (recipe: Recipe, e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const missingIngredients = recipe.missing_ingredients || [];
    if (missingIngredients.length === 0) return;
    try {
      await addToShoppingList(missingIngredients.map(ing => ({ name: typeof ing === 'string' ? ing : ((ing.name as string) || ''), quantity: 1, category: 'Recipe Ingredients' })));
      showSuccess(`Added ${missingIngredients.length} items to shopping list!`);
    } catch (err) { console.error('Failed to add items to shopping list:', err); }
  };

  const showSuccess = (message: string) => { setSuccessMessage(message); setTimeout(() => setSuccessMessage(null), 3000); };

  if (view === 'setup') {
    if (!isAdmin) {
      return (
        <div style={{ padding: spacing.xl, maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: spacing.lg }}>🔌</div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Recipe Integration Not Configured</h1>
          <p style={{ fontSize: '16px', color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: '1.6' }}>An admin needs to configure the Mealie or Tandoor integration before you can import recipes.</p>
          <div style={{ background: colors.background, borderRadius: borderRadius.lg, padding: spacing.xl, textAlign: 'left' }}>
            <h3 style={{ margin: 0, marginBottom: spacing.md, color: colors.textPrimary }}>What you can do once configured:</h3>
            <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.textSecondary, lineHeight: '1.8' }}>
              <li>Import recipes from Mealie or Tandoor</li>
              <li>Search and browse the shared recipe library</li>
              <li>Mark recipes as favorites (your personal list)</li>
              <li>Add personal notes to recipes</li>
              <li>Track which recipes you've cooked</li>
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: spacing.xl, maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
            {integration?.configured && <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: spacing.xs, display: 'flex', alignItems: 'center' }}><ArrowLeft size={24} /></button>}
            <span style={{ fontSize: '36px' }}>🍳</span>
            <h1 style={{ fontSize: '36px', fontWeight: '900', color: colors.textPrimary, margin: 0, letterSpacing: '-1px' }}>Recipe Integration</h1>
          </div>
          <p style={{ fontSize: '16px', color: colors.textSecondary, fontWeight: '600', margin: 0 }}>Connect to Mealie or Tandoor to import your recipe collection (Admin only)</p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: colors.textPrimary, marginBottom: '16px' }}>Recipe Provider</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[{ id: 'none', label: 'None', icon: '❌' }, { id: 'mealie', label: 'Mealie', icon: '🥘' }, { id: 'tandoor', label: 'Tandoor', icon: '🍴' }].map((p) => (
              <button key={p.id} type="button" onClick={() => setProvider(p.id)} style={{ padding: '20px', border: provider === p.id ? '3px solid #f97316' : `2px solid ${colors.border}`, borderRadius: '14px', textAlign: 'center', cursor: 'pointer', background: provider === p.id ? 'rgba(249, 115, 22, 0.08)' : colors.card, fontWeight: '700', color: provider === p.id ? '#f97316' : colors.textSecondary, transition: 'all 0.2s' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{p.icon}</div>
                <div>{p.label}</div>
              </button>
            ))}
          </div>
        </div>

        {provider !== 'none' && (
          <>
            <div style={{ background: colors.background, borderRadius: '16px', padding: '32px', marginBottom: '32px' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, marginBottom: '24px' }}>Connection Settings</div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: colors.textPrimary, marginBottom: '10px' }}>Server URL</label>
                <input type="url" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder={`http://your-${provider}-server:9000`} style={{ width: '100%', padding: '14px 18px', border: `2px solid ${colors.border}`, borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', color: colors.textPrimary, background: colors.card, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '8px', fontWeight: '500' }}>Your {provider === 'mealie' ? 'Mealie' : 'Tandoor'} server address (e.g., http://192.168.1.100:9000)</div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: colors.textPrimary, marginBottom: '10px' }}>API Token</label>
                <input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="Enter your API token" style={{ width: '100%', padding: '14px 18px', border: `2px solid ${colors.border}`, borderRadius: '12px', fontSize: '15px', fontFamily: 'inherit', color: colors.textPrimary, background: colors.card, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '8px', fontWeight: '500' }}>Generate in {provider === 'mealie' ? 'Mealie: Profile → API Tokens' : 'Tandoor: Settings → API Keys'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
                <button type="button" onClick={handleTestConnection} disabled={testingConnection || !serverUrl || !apiToken} style={{ padding: '14px', borderRadius: '12px', background: 'transparent', border: '2px solid #f97316', color: '#f97316', fontWeight: '700', fontSize: '15px', cursor: testingConnection || !serverUrl || !apiToken ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: testingConnection || !serverUrl || !apiToken ? 0.45 : 1 }}>
                  {testingConnection ? '🔄 Testing...' : '🧪 Test Connection'}
                </button>
                <button onClick={handleSetupIntegration} disabled={setupLoading || !serverUrl || !apiToken} style={{ padding: '14px 32px', borderRadius: '12px', background: 'linear-gradient(135deg, #f97316, #fbbf24)', color: 'white', fontWeight: '700', fontSize: '15px', cursor: setupLoading || !serverUrl || !apiToken ? 'not-allowed' : 'pointer', border: 'none', boxShadow: setupLoading || !serverUrl || !apiToken ? 'none' : '0 4px 14px rgba(249, 115, 22, 0.35)', fontFamily: 'inherit', opacity: setupLoading || !serverUrl || !apiToken ? 0.45 : 1 }}>
                  {setupLoading ? 'Saving...' : '💾 Save Connection'}
                </button>
              </div>
            </div>

            {connectionStatus && (
              <div style={{ background: connectionStatus.connected ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)', border: `2px solid ${connectionStatus.connected ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`, borderRadius: '14px', padding: '20px', marginBottom: '32px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: connectionStatus.connected ? '#34c759' : '#ff3b30', marginBottom: '8px' }}>
                  {connectionStatus.connected ? `✓ Connected to ${provider === 'mealie' ? 'Mealie' : 'Tandoor'}` : '✗ Connection Failed'}
                </div>
                <div style={{ fontSize: '14px', color: connectionStatus.connected ? '#15803d' : '#dc2626', fontWeight: '600' }}>
                  {connectionStatus.connected ? `Last tested: Just now • ${connectionStatus.recipeCount} recipes available` : connectionStatus.error}
                </div>
              </div>
            )}

            <div style={{ background: colors.background, borderRadius: '16px', padding: '32px', marginBottom: '32px' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, marginBottom: '20px' }}>Import Options</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { checked: importImages, onChange: setImportImages, title: 'Download images to MinIO', desc: 'Enables offline access to recipe images (recommended)' },
                  { checked: autoSync, onChange: setAutoSync, title: 'Auto-sync recipes', desc: 'Automatically check for new recipes every 24 hours' },
                  { checked: syncDeletions, onChange: setSyncDeletions, title: 'Sync deletions', desc: `Remove recipes from pantryPal if deleted in ${provider === 'mealie' ? 'Mealie' : 'Tandoor'}` },
                ].map(({ checked, onChange, title, desc }) => (
                  <label key={title} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                    <div>
                      <div style={{ fontSize: '15px', color: colors.textPrimary, fontWeight: '700' }}>{title}</div>
                      <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {integration?.configured && (
              <div style={{ background: colors.background, borderRadius: '16px', padding: '32px', marginBottom: '32px' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, marginBottom: '20px' }}>Import Status</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center', marginBottom: '24px' }}>
                  <div><div style={{ fontSize: '40px', fontWeight: '900', color: colors.textPrimary, marginBottom: '6px' }}>{filterCounts.all}</div><div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recipes Stored</div></div>
                  <div><div style={{ fontSize: '40px', fontWeight: '900', color: colors.textPrimary, marginBottom: '6px' }}>{filterCounts.all}</div><div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Images Cached</div></div>
                  <div><div style={{ fontSize: '40px', fontWeight: '900', color: colors.textSecondary, marginBottom: '6px' }}>2h</div><div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Synced</div></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
                  <button onClick={handleMatch} disabled={matching} style={{ padding: '14px', borderRadius: '12px', background: 'transparent', border: '2px solid #f97316', color: '#f97316', fontWeight: '700', fontSize: '15px', cursor: matching ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: matching ? 0.45 : 1 }}>{matching ? '🔄 Syncing...' : '🔄 Sync Now'}</button>
                  <button onClick={handleImport} disabled={importing} style={{ padding: '14px 32px', borderRadius: '12px', background: 'linear-gradient(135deg, #f97316, #fbbf24)', color: 'white', fontWeight: '700', fontSize: '15px', cursor: importing ? 'not-allowed' : 'pointer', border: 'none', boxShadow: importing ? 'none' : '0 4px 14px rgba(249, 115, 22, 0.35)', fontFamily: 'inherit', opacity: importing ? 0.45 : 1 }}>{importing ? '📥 Importing...' : '📥 Re-Import All Recipes'}</button>
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '2px solid rgba(251, 191, 36, 0.3)', borderRadius: '14px', padding: '24px' }}>
              <div style={{ fontSize: '14px', color: '#92400e', lineHeight: '24px', fontWeight: '600' }}>
                <strong>💡 How it works:</strong><br /><br />
                pantryPal will import all recipes from your {provider === 'mealie' ? 'Mealie' : 'Tandoor'} instance and store them permanently in your database.
                <br /><br />
                <strong>Offline Support:</strong> Enable "Download images to MinIO" to store recipe images locally.
              </div>
            </div>
          </>
        )}

        {setupError && <div style={{ padding: spacing.md, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: borderRadius.md, color: '#ef4444', fontSize: '14px', marginTop: spacing.lg }}>{setupError}</div>}
      </div>
    );
  }

  if (view === 'detail' && selectedRecipe) {
    return <RecipeDetailView recipe={selectedRecipe} colors={colors} onBack={() => { setView('list'); setSelectedRecipe(null); }} onToggleFavorite={handleToggleFavorite} onAddMissingToShoppingList={handleAddMissingToShoppingList} showSuccess={showSuccess} />;
  }

  return (
    <div style={{ padding: spacing.xl }}>
      {successMessage && <div style={{ position: 'fixed', top: '20px', right: '20px', padding: '16px 24px', background: 'rgba(52, 199, 89, 0.95)', color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)', zIndex: 1000 }}>{successMessage}</div>}

      <div style={{ marginBottom: spacing.xl }}>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: colors.textPrimary }}>Recipes</h1>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.md, flexWrap: 'wrap' }}>
        <div style={{ flex: '1', maxWidth: '400px', minWidth: '200px', height: '40px', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.md, padding: '0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} color={colors.textSecondary} />
          <input placeholder="Search recipes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} style={{ flex: 1, border: 'none', background: 'none', fontSize: '14px', outline: 'none', fontFamily: 'inherit', color: colors.textPrimary }} />
        </div>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button onClick={handleMatch} disabled={matching} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, background: colors.card, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: spacing.xs, cursor: matching ? 'not-allowed' : 'pointer', color: colors.textPrimary, fontSize: '14px', fontWeight: '500' }} title="Refresh pantry matching">
            <RefreshCw size={16} style={matching ? { animation: 'spin 1s linear infinite' } : {}} />
            {matching ? 'Matching...' : 'Match Pantry'}
          </button>
          {isAdmin && <button onClick={() => setView('setup')} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, background: colors.card, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: spacing.xs, cursor: 'pointer', color: colors.textPrimary, fontSize: '14px', fontWeight: '500' }}><Settings size={16} />Settings</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
        {[{ id: 'expiring', label: 'Expiring Soon', count: filterCounts.expiring, icon: '⚠️' }, { id: 'canMake', label: 'Can Make Now', count: filterCounts.canMake, icon: '✓' }, { id: 'all', label: 'All Recipes', count: filterCounts.all, icon: '📚' }, { id: 'favorites', label: 'Favorites', count: filterCounts.favorites, icon: '⭐' }].map((tab) => (
          <button key={tab.id} onClick={() => setFilterMode(tab.id)} style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md, background: filterMode === tab.id ? colors.primary : colors.card, border: `1px solid ${filterMode === tab.id ? colors.primary : colors.border}`, fontSize: '14px', fontWeight: '500', color: filterMode === tab.id ? 'white' : colors.textSecondary, cursor: 'pointer', transition: 'all 0.2s' }}>
            {tab.icon} {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: spacing.md, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: borderRadius.md, color: '#ef4444', fontSize: '14px', marginBottom: spacing.lg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: spacing.xs }}><X size={16} /></button>
        </div>
      )}

      {loading && <RecipeSkeleton count={4} />}

      {!loading && recipes.length === 0 && (
        <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.xxl, textAlign: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>No recipes found</h3>
          <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: spacing.lg }}>
            {filterMode === 'expiring' ? 'No recipes using expiring ingredients.' : filterMode === 'canMake' ? 'No recipes you can make with current ingredients.' : filterMode === 'favorites' ? 'No favorite recipes yet.' : 'Import recipes from your recipe manager to get started.'}
          </p>
          {filterMode === 'all' && <button onClick={handleImport} disabled={importing} style={{ padding: `${spacing.sm} ${spacing.lg}`, borderRadius: borderRadius.md, background: importing ? colors.textSecondary : colors.primary, color: 'white', fontWeight: '500', fontSize: '14px', cursor: importing ? 'not-allowed' : 'pointer', border: 'none' }}>{importing ? 'Importing...' : 'Import Recipes'}</button>}
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing.lg }}>
          {recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} colors={colors} onToggleFavorite={handleToggleFavorite} onClick={() => handleRecipeClick(recipe)} onAddMissingToShoppingList={handleAddMissingToShoppingList} />)}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, colors, onToggleFavorite, onClick, onAddMissingToShoppingList }: RecipeCardProps) {
  const [imgError, setImgError] = useState(false);
  const matchPercentage = Math.round(recipe.match_percentage || 0);
  const hasExpiring = (recipe.expiring_ingredient_count || 0) > 0;
  const missingCount = recipe.missing_ingredient_count || 0;
  const expiringCount = recipe.expiring_ingredient_count || 0;
  const getMatchColor = (pct: number) => pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const availableIngredients = (recipe.available_ingredients || []).map(extractIngredientName);
  const missingIngredients = (recipe.missing_ingredients || []).map(extractIngredientName);
  const expiringIngredients = (recipe.expiring_ingredients || []).map(extractIngredientName);
  const imageViewUrl = recipe.image_url && !imgError ? `${recipe.image_url}/view` : null;

  return (
    <div onClick={onClick}
      style={{ background: colors.card, borderRadius: borderRadius.lg, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', border: `1px solid ${colors.border}` }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>

      {/* Hero image */}
      <div style={{ position: 'relative', height: '180px', overflow: 'hidden' }}>
        {imageViewUrl ? (
          <img src={imageViewUrl} onError={() => setImgError(true)} alt={recipe.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '72px' }}>🍳</span>
          </div>
        )}
        {/* Gradient overlay for text readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.72))' }} />

        {/* Match badge — top left */}
        {matchPercentage > 0 && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', borderRadius: '20px', padding: '4px 10px', color: getMatchColor(matchPercentage), fontSize: '12px', fontWeight: '700' }}>
            {matchPercentage}% match
          </div>
        )}

        {/* Favorite — top right */}
        <button onClick={(e) => onToggleFavorite(recipe.id, e)}
          style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: recipe.favorite ? '#ef4444' : 'white' }}>
          <Heart size={16} fill={recipe.favorite ? '#ef4444' : 'none'} />
        </button>

        {/* Title + meta — bottom of image */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px 12px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'white', lineHeight: '1.3', marginBottom: '4px' }}>{recipe.name}</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {(recipe.total_time || 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}><Clock size={12} /> {recipe.total_time} min</span>}
            {(recipe.servings || 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}><Users size={12} /> {recipe.servings} servings</span>}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ flex: 1, padding: '8px', textAlign: 'center', borderRight: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: expiringCount > 0 ? '#f59e0b' : colors.textSecondary }}>{expiringCount}</div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>Expiring</div>
        </div>
        <div style={{ flex: 1, padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: missingCount > 0 ? '#ef4444' : '#22c55e' }}>{missingCount}</div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>Missing</div>
        </div>
      </div>

      {/* Tags + action */}
      <div style={{ padding: '10px 14px' }}>
        {(hasExpiring || matchPercentage >= 75) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {hasExpiring && <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: borderRadius.sm, background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>⚠️ Uses Expiring</span>}
            {matchPercentage >= 75 && <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: borderRadius.sm, background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' }}>✓ Ready to Cook</span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: missingCount > 0 ? '10px' : '0' }}>
          {availableIngredients.slice(0, 3).map((ing, idx) => <span key={`avail-${idx}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: borderRadius.sm, background: colors.background, color: colors.textSecondary }}>{ing}</span>)}
          {expiringIngredients.slice(0, 2).map((ing, idx) => <span key={`exp-${idx}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: borderRadius.sm, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>{ing}</span>)}
          {missingIngredients.slice(0, 2).map((ing, idx) => <span key={`miss-${idx}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: borderRadius.sm, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>{ing}</span>)}
        </div>
        {missingCount > 0 && <button onClick={(e) => onAddMissingToShoppingList(recipe, e)} style={{ width: '100%', padding: '8px', borderRadius: borderRadius.md, background: colors.background, border: `1px solid ${colors.border}`, fontSize: '13px', fontWeight: '500', color: colors.textPrimary, textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>Add {missingCount} Missing to List</button>}
      </div>
    </div>
  );
}

function RecipeDetailView({ recipe, colors, onBack, onToggleFavorite, onAddMissingToShoppingList, showSuccess }: RecipeDetailViewProps) {
  const [notes, setNotes] = useState(recipe.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [imgError, setImgError] = useState(false);
  const matchPercentage = Math.round(recipe.match_percentage || 0);
  const missingCount = recipe.missing_ingredient_count || 0;
  const expiringCount = recipe.expiring_ingredient_count || 0;
  const getMatchColor = (pct: number) => pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const imageViewUrl = recipe.image_url && !imgError ? `${recipe.image_url}/view` : null;

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try { await updateRecipeNotes(recipe.id, notes); showSuccess('Notes saved!'); }
    catch (err) { console.error('Failed to save notes:', err); }
    finally { setSavingNotes(false); }
  };

  const handleStartCooking = async () => {
    try { await markCooked(recipe.id); showSuccess('Marked as cooked!'); }
    catch (err) { console.error('Failed to mark as cooked:', err); }
  };

  const ingredients = recipe.ingredients || [];
  const instructions = recipe.instructions || [];
  const availableIngredients = (recipe.available_ingredients || []).map(extractIngredientName);
  const missingIngredients = (recipe.missing_ingredients || []).map(extractIngredientName);
  const expiringIngredients = (recipe.expiring_ingredients || []).map(extractIngredientName);
  const availableSet = new Set(availableIngredients.map(i => i.toLowerCase()));
  const missingSet = new Set(missingIngredients.map(i => i.toLowerCase()));
  const expiringSet = new Set(expiringIngredients.map(i => i.toLowerCase()));

  const getIngredientStatus = (ingredient: string | Record<string, unknown>) => {
    const cleanName = extractIngredientName(ingredient).toLowerCase();
    if (expiringSet.has(cleanName)) return 'expiring';
    if (missingSet.has(cleanName)) return 'missing';
    if (availableSet.has(cleanName)) return 'available';
    for (const exp of expiringSet) { if (cleanName.includes(exp) || exp.includes(cleanName)) return 'expiring'; }
    for (const miss of missingSet) { if (cleanName.includes(miss) || miss.includes(cleanName)) return 'missing'; }
    return 'available';
  };

  return (
    <div>
      {/* Banner image */}
      <div style={{ position: 'relative', height: '280px', overflow: 'hidden' }}>
        {imageViewUrl ? (
          <img src={imageViewUrl} onError={() => setImgError(true)} alt={recipe.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '100px' }}>🍳</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 45%, rgba(0,0,0,0.75) 100%)' }} />

        {/* Back button */}
        <button onClick={onBack}
          style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: 'none', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', color: 'white', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Favorite button */}
        <button onClick={(e) => onToggleFavorite(recipe.id, e)}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: recipe.favorite ? '#ef4444' : 'white' }}>
          <Heart size={20} fill={recipe.favorite ? '#ef4444' : 'none'} />
        </button>

        {/* Title + meta overlaid at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'white', margin: 0, marginBottom: '6px', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{recipe.name}</h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>From {recipe.source || 'Recipe Collection'}</span>
            {(recipe.total_time || 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.9)', fontSize: '13px' }}><Clock size={13} /> {recipe.total_time} min</span>}
            {(recipe.servings || 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.9)', fontSize: '13px' }}><Users size={13} /> {recipe.servings} servings</span>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: `${spacing.md} ${spacing.xl}`, display: 'flex', gap: spacing.sm, borderBottom: `1px solid ${colors.border}` }}>
        <button onClick={handleStartCooking} style={{ padding: `${spacing.sm} ${spacing.lg}`, borderRadius: borderRadius.md, background: colors.primary, color: 'white', fontWeight: '600', fontSize: '14px', cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>🍳 Start Cooking</button>
        {missingCount > 0 && <button onClick={(e) => onAddMissingToShoppingList(recipe, e)} style={{ padding: `${spacing.sm} ${spacing.lg}`, borderRadius: borderRadius.md, background: colors.card, border: `1px solid ${colors.border}`, color: colors.textPrimary, fontWeight: '500', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>Add {missingCount} Missing to List</button>}
      </div>

      {/* Content grid */}
      <div style={{ padding: spacing.xl }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: spacing.xl }}>
          <div>
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Ingredients ({ingredients.length})</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {ingredients.map((ing, idx) => {
                  const status = getIngredientStatus(ing);
                  const ingName = typeof ing === 'string' ? ing : ((ing.note || ing.name || '') as string);
                  return (
                    <li key={idx} style={{ padding: `${spacing.sm} 0`, borderBottom: idx < ingredients.length - 1 ? `1px solid ${colors.border}` : 'none', display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: '14px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: status === 'missing' ? 'rgba(239, 68, 68, 0.1)' : status === 'expiring' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: status === 'missing' ? '#ef4444' : status === 'expiring' ? '#f59e0b' : '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                        {status === 'missing' ? '✗' : '✓'}
                      </span>
                      <span style={{ color: status === 'missing' ? '#ef4444' : status === 'expiring' ? '#d97706' : colors.textPrimary }}>{ingName}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {instructions.length > 0 && (
              <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, padding: spacing.lg }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Instructions</h2>
                {instructions.map((step, idx) => {
                  const stepText = typeof step === 'string' ? step : ((step.text || step.instruction || '') as string);
                  return (
                    <div key={idx} style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: colors.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '12px', flexShrink: 0 }}>{idx + 1}</div>
                      <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.6', color: colors.textPrimary }}>{stepText}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <div style={{ background: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, border: `1px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Recipe Match</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.sm, textAlign: 'center' }}>
                <div style={{ padding: spacing.sm, background: colors.background, borderRadius: borderRadius.md }}><div style={{ fontSize: '20px', fontWeight: '700', color: getMatchColor(matchPercentage) }}>{matchPercentage}%</div><div style={{ fontSize: '11px', color: colors.textSecondary }}>Match</div></div>
                <div style={{ padding: spacing.sm, background: colors.background, borderRadius: borderRadius.md }}><div style={{ fontSize: '20px', fontWeight: '700', color: expiringCount > 0 ? '#f59e0b' : colors.textPrimary }}>{expiringCount}</div><div style={{ fontSize: '11px', color: colors.textSecondary }}>Expiring</div></div>
                <div style={{ padding: spacing.sm, background: colors.background, borderRadius: borderRadius.md }}><div style={{ fontSize: '20px', fontWeight: '700', color: missingCount > 0 ? '#ef4444' : colors.textPrimary }}>{missingCount}</div><div style={{ fontSize: '11px', color: colors.textSecondary }}>Missing</div></div>
              </div>
            </div>

            {missingIngredients.length > 0 && (
              <div style={{ background: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Missing Ingredients</h3>
                <div style={{ marginBottom: spacing.md }}>
                  {missingIngredients.map((ing, idx) => <div key={idx} style={{ padding: `${spacing.xs} 0`, borderBottom: idx < missingIngredients.length - 1 ? `1px solid ${colors.border}` : 'none', fontSize: '13px', color: colors.textPrimary }}>{ing}</div>)}
                </div>
                <button onClick={(e) => onAddMissingToShoppingList(recipe, e)} style={{ width: '100%', padding: spacing.sm, borderRadius: borderRadius.md, background: colors.background, border: `1px solid ${colors.border}`, color: colors.textPrimary, fontWeight: '500', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>Add to Shopping List</button>
              </div>
            )}

            <div style={{ background: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, border: `1px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Recipe Info</h3>
              <div>
                {[{ label: 'Source', value: recipe.source || 'Unknown' }, { label: 'Times Cooked', value: recipe.times_cooked || 0 }, { label: 'Last Made', value: recipe.last_made ? new Date(recipe.last_made).toLocaleDateString() : 'Never' }].map((stat, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: `${spacing.xs} 0`, borderBottom: idx < 2 ? `1px solid ${colors.border}` : 'none', fontSize: '13px' }}>
                    <span style={{ color: colors.textSecondary }}>{stat.label}</span>
                    <span style={{ color: colors.textPrimary }}>{stat.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.xs} 0`, fontSize: '13px' }}>
                  <span style={{ color: colors.textSecondary }}>Favorite</span>
                  <button onClick={(e) => onToggleFavorite(recipe.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: recipe.favorite ? '#ef4444' : colors.textSecondary }}><Heart size={16} fill={recipe.favorite ? '#ef4444' : 'none'} /></button>
                </div>
              </div>
            </div>

            <div style={{ background: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, border: `1px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>Your Notes</h3>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your notes..." style={{ width: '100%', padding: spacing.sm, background: colors.background, borderRadius: borderRadius.md, fontSize: '13px', color: colors.textPrimary, lineHeight: '1.5', border: `1px solid ${colors.border}`, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <button onClick={handleSaveNotes} disabled={savingNotes} style={{ marginTop: spacing.sm, width: '100%', padding: spacing.sm, borderRadius: borderRadius.md, background: savingNotes ? colors.textSecondary : colors.primary, color: 'white', fontWeight: '500', fontSize: '13px', cursor: savingNotes ? 'not-allowed' : 'pointer', border: 'none', fontFamily: 'inherit' }}>
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecipesPage;
