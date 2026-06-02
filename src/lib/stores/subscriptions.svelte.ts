/**
 * Global Subscription Store — Task 4: The reactive brain of Subtrack MVP.
 *
 * Uses Svelte 5 runes ($state + $derived) for minimal-overhead reactivity.
 * Single source of truth for subscription data + derived computations.
 *
 * Responsibilities:
 * - Full CRUD with automatic nextDueDate calculation (centralized)
 * - Search + filter (basic, efficient linear scan suitable for small N)
 * - Load initial state from storage layer
 * - Persist to storage layer on every change (via saveToFile)
 * - React to external storage changes (load/import/reset from other flows)
 *
 * Integration:
 * - Owns a reactive copy of subscriptions for Svelte runes
 * - Keeps storage layer's in-memory AppData in sync for persistence
 * - Relies on fileStorage's subscribeToStorageChanges + saveToFile
 *
 * No external state libs. Pure Svelte 5 runes + storage layer.
 */

import type {
  Subscription,
  BillingCycle,
  SubscriptionStatus,
  Category,
} from '../types';
import {
  getAppData,
  subscribeToStorageChanges,
  saveToFile,
} from '../storage';

/* -------------------------------------------------------------------------------------------------
 * Date Calculation — Centralized, Pure, Authoritative Logic
 * ----------------------------------------------------------------------------------------------- */

/**
 * Advance a YYYY-MM-DD date by one billing cycle.
 * Handles month length clamping (e.g. Jan 31 + 1 month → Feb 28/29).
 *
 * This is the single source of truth for nextDueDate.
 * Called automatically on add + on any update that touches billingCycle or startDate.
 *
 * For 'custom' billingCycle (MVP placeholder): falls back to +1 month.
 */
export function calculateNextDueDate(
  startDate: string,
  billingCycle: BillingCycle
): string {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error(`Invalid startDate format (expected YYYY-MM-DD): ${startDate}`);
  }

  const [yearStr, monthStr, dayStr] = startDate.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr);
  let day = Number(dayStr);

  switch (billingCycle) {
    case 'monthly':
      month += 1;
      break;
    case 'quarterly':
      month += 3;
      break;
    case 'yearly':
      year += 1;
      break;
    case 'custom':
      // MVP: no custom interval field yet in the model.
      // Treat as monthly so the field is usable; will be refined in future tasks.
      month += 1;
      break;
    default:
      // Defensive: treat unknown as monthly
      month += 1;
  }

  // Wrap month/year
  if (month > 12) {
    year += Math.floor((month - 1) / 12);
    month = ((month - 1) % 12) + 1;
  }

  // Clamp day to valid last day of the target month (local Date)
  const lastDayOfTargetMonth = new Date(year, month, 0).getDate();
  if (day > lastDayOfTargetMonth) {
    day = lastDayOfTargetMonth;
  }

  return (
    year.toString().padStart(4, '0') +
    '-' +
    month.toString().padStart(2, '0') +
    '-' +
    day.toString().padStart(2, '0')
  );
}

/* -------------------------------------------------------------------------------------------------
 * Type for Add Input (excludes system-managed fields)
 * ----------------------------------------------------------------------------------------------- */

export type NewSubscriptionInput = Omit<
  Subscription,
  'id' | 'nextDueDate' | 'createdAt' | 'updatedAt'
>;

/* -------------------------------------------------------------------------------------------------
 * Internal Reactive State (Svelte 5 runes)
 * ----------------------------------------------------------------------------------------------- */

let _subscriptions = $state<Subscription[]>([]);

/**
 * Sync our reactive state from the storage layer's current AppData.
 * Used on module init and whenever storage notifies of external replacement
 * (loadFromFile, importBackup, resetToNewEmptyData, restore, etc.).
 */
function syncFromStorage(): void {
  const live = getAppData().subscriptions;
  // Create fresh objects so our $state tree owns clean reactive data
  _subscriptions = live.map((sub) => ({
    ...sub,
    tags: sub.tags ? [...sub.tags] : undefined,
  }));
}

// Initial load (at module evaluation time — usually the default empty data)
syncFromStorage();

/**
 * Keep reactive state in sync when storage layer loads a different file
 * or otherwise replaces currentData externally.
 */
const unsubscribe = subscribeToStorageChanges(syncFromStorage);

/* -------------------------------------------------------------------------------------------------
 * Internal: Keep Storage Layer in Sync (so saveToFile sees our changes)
 * ----------------------------------------------------------------------------------------------- */

function syncToStorage(): void {
  const appData = getAppData();
  appData.subscriptions = _subscriptions.map((sub) => ({
    ...sub,
    tags: sub.tags ? [...sub.tags] : undefined,
  }));
}

/* -------------------------------------------------------------------------------------------------
 * CRUD Operations (with auto nextDueDate + auto-persist)
 * ----------------------------------------------------------------------------------------------- */

export async function addSubscription(
  input: NewSubscriptionInput
): Promise<Subscription> {
  const nextDueDate = calculateNextDueDate(input.startDate, input.billingCycle);
  const now = new Date().toISOString();

  const newSub: Subscription = {
    ...input,
    id: crypto.randomUUID(),
    nextDueDate,
    createdAt: now,
    updatedAt: now,
    tags: input.tags ? [...input.tags] : undefined,
  };

  // Update reactive state (new array → triggers subscribers / derived)
  _subscriptions = [..._subscriptions, newSub];

  // Mirror into storage layer for persistence + external getAppData() consumers
  syncToStorage();

  // Persist (auto-save). Swallow errors for resilience in MVP (data lives in memory).
  try {
    await saveToFile();
  } catch (err) {
    console.error('[subscriptions] Persist failed after addSubscription:', err);
    // Task 13: surface via global toast (non-fatal, data still in memory)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('subtrack:storage-error', { detail: { error: err, context: 'add subscription persist' } }));
    }
  }

  return newSub;
}

export async function updateSubscription(
  id: string,
  updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>
): Promise<void> {
  const index = _subscriptions.findIndex((s) => s.id === id);
  if (index === -1) {
    console.warn(`[subscriptions] updateSubscription: no subscription with id ${id}`);
    return;
  }

  const current = _subscriptions[index];

  // Determine the billing/start values that will be used after update
  const updatedBillingCycle = updates.billingCycle ?? current.billingCycle;
  const updatedStartDate = updates.startDate ?? current.startDate;

  // Auto-recalculate nextDueDate when billingCycle or startDate change
  let nextDueDate = current.nextDueDate;

  if (updates.billingCycle !== undefined || updates.startDate !== undefined) {
    nextDueDate = calculateNextDueDate(updatedStartDate, updatedBillingCycle);
  }

  // Explicit nextDueDate in the patch wins (used by future "advance on payment" flows)
  if (updates.nextDueDate !== undefined) {
    nextDueDate = updates.nextDueDate;
  }

  const updatedSub: Subscription = {
    ...current,
    ...updates,
    nextDueDate,
    updatedAt: new Date().toISOString(),
    // Ensure tags is always a fresh array or undefined
    tags:
      updates.tags !== undefined
        ? updates.tags
          ? [...updates.tags]
          : undefined
        : current.tags
          ? [...current.tags]
          : undefined,
  };

  // Replace with new array for reliable reactivity
  _subscriptions = [
    ..._subscriptions.slice(0, index),
    updatedSub,
    ..._subscriptions.slice(index + 1),
  ];

  syncToStorage();

  try {
    await saveToFile();
  } catch (err) {
    console.error('[subscriptions] Persist failed after updateSubscription:', err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('subtrack:storage-error', { detail: { error: err, context: 'update subscription persist' } }));
    }
  }
}

export async function deleteSubscription(id: string): Promise<boolean> {
  const beforeLength = _subscriptions.length;
  _subscriptions = _subscriptions.filter((s) => s.id !== id);

  if (_subscriptions.length === beforeLength) {
    return false;
  }

  syncToStorage();

  try {
    await saveToFile();
  } catch (err) {
    console.error('[subscriptions] Persist failed after deleteSubscription:', err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('subtrack:storage-error', { detail: { error: err, context: 'delete subscription persist' } }));
    }
  }

  return true;
}

/* -------------------------------------------------------------------------------------------------
 * Search + Filter (basic, efficient, intended for use inside $derived)
 * ----------------------------------------------------------------------------------------------- */

export interface SubscriptionFilterOptions {
  /** Case-insensitive substring match against name, notes, or any tag */
  searchTerm?: string;
  status?: SubscriptionStatus;
  category?: Category;
}

/**
 * Returns a filtered snapshot of subscriptions.
 * Pure computation — call inside Svelte $derived for automatic reactivity:
 *
 *   const filtered = $derived(
 *     subscriptionStore.getFilteredSubscriptions({ searchTerm: $stateSearch })
 *   );
 *
 * Linear scan is efficient for the expected small number of subscriptions (<200).
 */
export function getFilteredSubscriptions(
  options: SubscriptionFilterOptions = {}
): Subscription[] {
  let result = _subscriptions;

  if (options.status) {
    result = result.filter((s) => s.status === options.status);
  }

  if (options.category) {
    result = result.filter((s) => s.category === options.category);
  }

  const term = options.searchTerm?.trim();
  if (term) {
    const lower = term.toLowerCase();
    result = result.filter((s) => {
      if (s.name.toLowerCase().includes(lower)) return true;
      if (s.notes && s.notes.toLowerCase().includes(lower)) return true;
      if (s.tags && s.tags.some((tag) => tag.toLowerCase().includes(lower))) return true;
      return false;
    });
  }

  return result;
}

/* -------------------------------------------------------------------------------------------------
 * Public API — Clean, Minimal Surface for UI
 * ----------------------------------------------------------------------------------------------- */

export const subscriptionStore = {
  /**
   * Reactive list of all subscriptions.
   * Use directly in templates or $derived.
   * Treat as read-only — always go through add/update/delete.
   */
  get subscriptions(): Subscription[] {
    return _subscriptions;
  },

  addSubscription,
  updateSubscription,
  deleteSubscription,

  /**
   * Efficient filtered view. Use inside $derived for live search/filter UI.
   */
  getFilteredSubscriptions,

  /**
   * Pure helper to preview what nextDueDate would be.
   * Call from form logic before calling add/update.
   */
  calculateNextDueDate,
} as const;

// Note: module never unsubscribes — subscriptions live for the lifetime of the app.
