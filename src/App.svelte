<script lang="ts">
  /**
   * Root App — Task 11 complete: SettingsView (file management, backup/restore, categories, preferences).
   *
   * All features delivered (Task 11):
   * - Prominent File Management: Download Backup, Restore/Import, Load as main, Forget file, Save, Start fresh
   * - Clear "your data lives only in your .subtrack file" messaging (no cloud)
   * - Category management (add/remove custom categories with usage counts + safe confirmations)
   * - Basic preferences: default currency (live update) + theme (system/light/dark, persisted)
   * - Full wiring to storage layer (exportBackup, importBackup, loadFromFile, forgetCurrentFile, updateAppSettings, add/removeCategory, etc.)
   * - Reactive updates + transient feedback
   *
   * Previous (Task 10):
   * - AnalyticsView with full monthly analysis, trends, forecasts, CSV exports
   */

  import AppShell, { type View } from '$lib/components/AppShell.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
  import SubscriptionForm from '$lib/components/subscriptions/SubscriptionForm.svelte';
  import SubscriptionsList from '$lib/components/subscriptions/SubscriptionsList.svelte';
  import RemindersView from '$lib/components/reminders/RemindersView.svelte';
  import AnalyticsView from '$lib/components/analytics/AnalyticsView.svelte';
  import SettingsView from '$lib/components/settings/SettingsView.svelte';
  import type { Subscription } from '$lib/types';

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

  function handleDashboardAdd() {
    // Task 7: Open the real fast input form (modal) instead of plain navigation
    openSubscriptionForm('add');
    // Keep or move view — after save we force 'subscriptions'
  }

  function openAddFromSubscriptions() {
    openSubscriptionForm('add');
  }
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
    role="presentation"
  >
    <div
      class="w-full max-w-[520px] rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
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
