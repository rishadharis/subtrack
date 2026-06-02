/**
 * Subtrack Core Data Model & Types
 *
 * This defines the exact structure for the portable .subtrack JSON file.
 * Matches the specification in the Design Document (Section 6).
 *
 * Design principles:
 * - Strict, minimal TypeScript types (no runtime cost)
 * - All dates stored as ISO strings (client handles formatting/calculations)
 * - Categories are extensible via settings, but we provide a default union for safety + autocomplete
 */

export const DATA_VERSION = 1 as const;

/** Supported recurring billing intervals. */
export const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly', 'custom'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** Lifecycle status of a subscription. */
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Default category values.
 * The authoritative list at runtime lives in AppData.settings.categories
 * (users can add/remove custom categories).
 */
export const DEFAULT_CATEGORIES = [
  'Streaming',
  'Productivity',
  'Cloud',
  'AI',
  'Gaming',
  'Lainnya',
] as const;

export type Category = (typeof DEFAULT_CATEGORIES)[number];

/**
 * Individual subscription record.
 */
export interface Subscription {
  /** Unique identifier (UUID v4 recommended) */
  id: string;

  /** Display name of the service (e.g. "Netflix") */
  name: string;

  /** Category for grouping and analytics */
  category: Category;

  /** Numeric price (no currency symbol) */
  price: number;

  /** ISO currency code (e.g. "IDR", "USD", "EUR") */
  currency: string;

  billingCycle: BillingCycle;

  /** Subscription start date in YYYY-MM-DD format */
  startDate: string;

  /** Next payment/renewal due date in YYYY-MM-DD format (computed) */
  nextDueDate: string;

  status: SubscriptionStatus;

  /** Whether the subscription automatically renews */
  autoRenew: boolean;

  /** Optional free-text notes */
  notes?: string;

  /** Optional website or management URL */
  url?: string;

  /** Optional free-form tags for filtering/search */
  tags?: string[];

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/** File-level metadata. */
export interface AppMeta {
  createdAt: string; // ISO 8601 datetime
  lastModified: string; // ISO 8601 datetime
  appVersion: string; // e.g. "0.1.0" or the build version
}

/** Persistent application settings stored inside the data file. */
export interface AppSettings {
  defaultCurrency: string; // e.g. "IDR"
  /** Master list of categories (can be customized by user — supports custom strings beyond DEFAULT_CATEGORIES) */
  categories: string[];
  theme: 'system' | 'light' | 'dark';
}

/**
 * Root object persisted to the .subtrack file.
 * This is the single portable data artifact for the entire application.
 */
export interface AppData {
  version: typeof DATA_VERSION;
  meta: AppMeta;
  subscriptions: Subscription[];
  settings: AppSettings;
}
