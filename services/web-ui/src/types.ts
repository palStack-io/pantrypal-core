// Shared domain types for PantryPal web UI

export interface Item {
  id: string | number;
  name: string;
  barcode?: string | null;
  quantity: number;
  location?: string | null;
  category?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  created_at?: string;
  image_url?: string | null;
}

export interface ShoppingItem {
  id: string | number;
  name: string;
  quantity?: number;
  checked: boolean;
  notes?: string | null;
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  display_name?: string;
  username?: string;
  is_admin?: boolean;
  email_verified?: boolean;
  created_at?: string;
}

export interface AuthStatus {
  auth_mode: string;
  requires_api_key: boolean;
  authenticated?: boolean;
  user?: User;
}

export interface Location {
  id?: string | number;
  name: string;
  emoji?: string;
}

export interface Category {
  id?: string | number;
  name: string;
  emoji?: string;
}

export interface LocationOption {
  name: string;
  emoji: string;
}

export interface CategoryOption {
  name: string;
  emoji: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key?: string;
  is_read_only: boolean;
  created_at?: string;
  last_used?: string | null;
}

export interface RecipeIntegration {
  id: string | number;
  provider: 'mealie' | 'tandoor';
  base_url: string;
  is_active: boolean;
  created_at?: string;
}

export interface Recipe {
  id: string | number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  match_percentage?: number;
  is_favorite?: boolean;
  source_url?: string | null;
  provider?: string;
}

export type ExpiryStatus = 'none' | 'good' | 'warning' | 'critical' | 'expired';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastMessage {
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  warning?: string;
  cleaned?: string;
  value?: number;
}

export interface ItemValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export interface Stats {
  totalItems: number;
  expiringSoon: number;
  expired: number;
  locations: number;
  categories: number;
}
