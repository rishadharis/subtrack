<script lang="ts">
  /**
   * Root App — Task 13 complete: Final Integration & Hardening
   *
   * - All views wired (dashboard / subscriptions / reminders / analytics / settings)
   * - Global error toast + storage error boundary via CustomEvent + friendly messages
   * - Theme preference (system/light/dark) now fully wired and applied live (DOM class + media listener)
   * - Minor a11y / modal polish (escape key, dialog focus)
   * - Custom category integration fixed in SubscriptionForm (now reads live from settings)
   *
   * Critical flows verified via code audit + typecheck + prod build.
   */

  import AppShell, { type View } from '$lib/components/AppShell.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
  import SubscriptionForm from '$lib/components/subscriptions/SubscriptionForm.svelte';
  import SubscriptionsList from '$lib/components/subscriptions/SubscriptionsList.svelte';
  import RemindersView from '$lib/components/reminders/RemindersView.svelte';
  import AnalyticsView from '$lib/components/analytics/AnalyticsView.svelte';
  import SettingsView from '$lib/components/settings/SettingsView.svelte';
  import type { Subscription } from '$lib/types';
  import { onMount } from 'svelte';
  import {
    getAppData,
    subscribeToStorageChanges,
    StorageError,
    STORAGE_ERROR_CODES,
  } from '$lib/storage';

  let currentView = $state<View>('dashboard');

  /* -------------------------------------------------------------------------------------------------
   * Task 7: Subscription Form (modal + wiring)
   * ----------------------------------------------------------------------------------------------- */
  let showSubscriptionForm = $state(false);
  let formMode = $state<'add' | 'edit'>('add');
  let editingSubscription = $state<Subscription | null>(null);

  function openSubscriptionForm(mode: 'add' | 'edit', sub: Subscription | null = null) {
    formMode = mode;
    editingSubscription = sub;
    showSubscriptionForm = true;
  }

  function closeSubscriptionForm() {
    showSubscriptionForm = false;
    // small delay not needed; keep editing ref until hidden for animation-free close
    editingSubscription = null;
  }

  function handleFormSave(event: CustomEvent<Subscription>) {
    // Form already persisted via store. Close + move user to subscriptions area.
    closeSubscriptionForm();
    currentView = 'subscriptions';
  }

  function handleFormCancel() {
    closeSubscriptionForm();
  }

  // Task 13 polish: close modal on Escape
  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showSubscriptionForm) {
      e.preventDefault();
      closeSubscriptionForm();
    }
  }

  function handleDashboardAdd() {
    // Task 7: Open the real fast input form (modal) instead of plain navigation
    openSubscriptionForm('add');
    // Keep or move view — after save we force 'subscriptions'
  }

  function openAddFromSubscriptions() {
    openSubscriptionForm('add');
  }

  /* -------------------------------------------------------------------------------------------------
   * Task 13: Global Toast System (for file/storage errors + general graceful feedback)
   * Listens to 'subtrack:storage-error' CustomEvents dispatched from storage + store layers.
   * Also supports generic 'subtrack:toast' for other uses.
   * ----------------------------------------------------------------------------------------------- */
  interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }
  let toasts = $state<ToastItem[]>([]);
  let toastCounter = 0;

  function addToast(message: string, type: ToastItem['type'] = 'info', timeoutMs = 5200) {
    const id = ++toastCounter;
    const t: ToastItem = { id, message, type };
    toasts = [...toasts, t];
    if (timeoutMs > 0) {
      setTimeout(() => {
        toasts = toasts.filter((x) => x.id !== id);
      }, timeoutMs);
    }
  }

  function dismissToast(id: number) {
    toasts = toasts.filter((x) => x.id !== id);
  }

  function getFriendlyStorageErrorMessage(err: unknown, context?: string): string {
    if (err instanceof StorageError) {
      switch (err.code) {
        case STORAGE_ERROR_CODES.PERMISSION_DENIED:
          return 'Izin akses file ditolak. Izinkan saat diminta oleh browser.';
        case STORAGE_ERROR_CODES.INVALID_DATA:
          return 'File .subtrack tidak valid atau versi tidak didukung.';
        case STORAGE_ERROR_CODES.FILE_READ_ERROR:
          return 'Gagal membaca file .subtrack. Pastikan file tidak rusak.';
        case STORAGE_ERROR_CODES.FILE_WRITE_ERROR:
          return 'Gagal menulis ke file .subtrack. Coba simpan cadangan manual.';
        case STORAGE_ERROR_CODES.NO_FILE_HANDLE:
          return 'Tidak ada file terbuka. Gunakan "Buka file" atau ekspor cadangan.';
        case STORAGE_ERROR_CODES.BROWSER_UNSUPPORTED:
          return 'Browser Anda tidak mendukung penyimpanan file modern.';
        default:
          return context ? `Gagal: ${context}` : 'Terjadi masalah pada penyimpanan file.';
      }
    }
    return context ? `Gagal ${context}.` : 'Terjadi kesalahan tak terduga pada penyimpanan.';
  }

  /* -------------------------------------------------------------------------------------------------
   * Task 13: Theme applicator (system/light/dark) — wires the persisted preference live
   * Subscribes to storage changes + listens to OS pref changes for "system".
   * ----------------------------------------------------------------------------------------------- */
  let themeUnsub: (() => void) | null = null;
  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  function applyTheme(theme: 'system' | 'light' | 'dark') {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    let shouldDark = false;
    if (theme === 'dark') {
      shouldDark = true;
    } else if (theme === 'light') {
      shouldDark = false;
    } else {
      // system
      shouldDark = !!(mediaQuery && mediaQuery.matches);
    }
    root.classList.toggle('dark', shouldDark);
  }

  function setupTheme() {
    // Initial apply from current data
    const initialTheme = getAppData().settings.theme as 'system' | 'light' | 'dark';
    applyTheme(initialTheme);

    // React to future storage changes (e.g. from SettingsView)
    themeUnsub = subscribeToStorageChanges(() => {
      const t = getAppData().settings.theme as 'system' | 'light' | 'dark';
      applyTheme(t);
    });

    // React to OS theme changes when preference is "system"
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaListener = () => {
        const t = getAppData().settings.theme as 'system' | 'light' | 'dark';
        if (t === 'system') applyTheme('system');
      };
      // Modern + legacy
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', mediaListener);
      } else if ((mediaQuery as any).addListener) {
        (mediaQuery as any).addListener(mediaListener);
      }
    }
  }

  function cleanupTheme() {
    if (themeUnsub) {
      themeUnsub();
      themeUnsub = null;
    }
    if (mediaQuery && mediaListener) {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', mediaListener);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(mediaListener);
      }
    }
    mediaQuery = null;
    mediaListener = null;
  }

  /* -------------------------------------------------------------------------------------------------
   * Global error listeners (storage + unhandled) for graceful handling
   * ----------------------------------------------------------------------------------------------- */
  function handleStorageErrorEvent(e: Event) {
    const detail = (e as CustomEvent).detail || {};
    const friendly = getFriendlyStorageErrorMessage(detail.error, detail.context);
    addToast(friendly, 'error', 6200);
  }

  function handleGenericToast(e: Event) {
    const d = (e as CustomEvent).detail || {};
    if (d.message) addToast(d.message, d.type || 'info', d.timeout || 4500);
  }

  function setupGlobalErrorListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('subtrack:storage-error', handleStorageErrorEvent as EventListener);
    window.addEventListener('subtrack:toast', handleGenericToast as EventListener);

    // Catch unhandled promise rejections that may contain StorageError (defensive)
    window.addEventListener('unhandledrejection', (ev) => {
      const r = ev.reason;
      if (r instanceof StorageError) {
        const friendly = getFriendlyStorageErrorMessage(r);
        addToast(friendly, 'error', 6200);
        // do not preventDefault — still log
      }
    });
  }

  onMount(() => {
    setupTheme();
    setupGlobalErrorListeners();

    return () => {
      cleanupTheme();
      if (typeof window !== 'undefined') {
        window.removeEventListener('subtrack:storage-error', handleStorageErrorEvent as EventListener);
        window.removeEventListener('subtrack:toast', handleGenericToast as EventListener);
      }
    };
  });
</script>

<AppShell bind:currentView>
  {#if currentView === 'dashboard'}
    <Dashboard on:add={handleDashboardAdd} />
  {:else if currentView === 'subscriptions'}
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">Subscriptions</h2>
          <p class="text-slate-600 dark:text-slate-400">Semua langganan yang Anda lacak</p>
        </div>

        <!-- Prominent add action (Task 7) -->
        <button
          type="button"
          onclick={openAddFromSubscriptions}
          class="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.985] hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-sky-500 dark:hover:bg-sky-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          + Tambah Langganan
        </button>
      </div>

      <!-- Task 8: Full searchable + filterable list with actions -->
      <SubscriptionsList on:edit={(e) => openSubscriptionForm('edit', e.detail)} />
    </div>
  {:else if currentView === 'reminders'}
    <!-- Task 9: Full RemindersView with selection + .ics export (replaces placeholder) -->
    <RemindersView />
  {:else if currentView === 'analytics'}
    <!-- Task 10: Full AnalyticsView with monthly cards, trend (SVG), category donut, top subs, forecast, CSV exports -->
    <AnalyticsView />
  {:else if currentView === 'settings'}
    <!-- Task 11: Full SettingsView — file ownership, backup/restore, categories, preferences -->
    <SettingsView />
  {/if}
</AppShell>

<!-- Task 7: Global modal for fast SubscriptionForm (add + edit) -->
{#if showSubscriptionForm}
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12 backdrop-blur-sm md:items-center md:pt-4"
    onclick={closeSubscriptionForm}
    onkeydown={handleModalKeydown}
    role="presentation"
    tabindex="-1"
  >
    <div
      class="w-full max-w-[520px] rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <SubscriptionForm
        mode={formMode}
        subscription={editingSubscription ?? undefined}
        on:save={handleFormSave}
        on:cancel={handleFormCancel}
      />
    </div>
  </div>
{/if}

<!-- Task 13: Global toast container for storage/file errors + graceful feedback (fixed, non-intrusive) -->
{#if toasts.length > 0}
  <div class="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-[92vw] sm:max-w-sm" role="region" aria-live="polite">
    {#each toasts as toast (toast.id)}
      <div
        class="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur
          {toast.type === 'error'
            ? 'border-red-200 bg-red-50/95 text-red-800 dark:border-red-900/60 dark:bg-red-950/90 dark:text-red-200'
            : toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-200'
              : toast.type === 'warning'
                ? 'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/90 dark:text-amber-200'
                : 'border-slate-200 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200'}"
      >
        <div class="pt-0.5">
          {toast.type === 'error' ? '⚠' : toast.type === 'success' ? '✓' : 'ℹ'}
        </div>
        <div class="flex-1 leading-snug pr-1">{toast.message}</div>
        <button
          type="button"
          onclick={() => dismissToast(toast.id)}
          class="ml-1 mt-0.5 rounded p-1 text-xs opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Tutup notifikasi"
        >
          ✕
        </button>
      </div>
    {/each}
  </div>
{/if}
