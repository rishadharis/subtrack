<script lang="ts">
  /**
   * Root App — Task 7 complete: SubscriptionForm (fast add/edit) wired end-to-end.
   *
   * - Dashboard "+ Tambah" now opens the real modal form (Task 7)
   * - Subscriptions view also has working "+ Tambah Langganan" button
   * - Full support for add + edit modes (edit ready for Task 8 list)
   * - Smart nextDueDate calc + override + all model fields + validation + tags chips
   * - Persists via subscriptionStore (addSubscription / updateSubscription)
   */

  import AppShell, { type View } from '$lib/components/AppShell.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';
  import SubscriptionForm from '$lib/components/subscriptions/SubscriptionForm.svelte';
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

      <div class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Form tambah/edit cepat sudah aktif (Task 7).<br />
        Daftar lengkap, pencarian, filter, dan manajemen massal akan hadir di Task 8.
      </div>
    </div>
  {:else if currentView === 'reminders'}
    <div class="space-y-6">
      <h2 class="text-2xl font-semibold tracking-tight">Reminders</h2>
      <p class="text-slate-600 dark:text-slate-400">Upcoming renewals and alerts</p>

      <div class="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Reminder list + notification controls will be implemented in later tasks.
      </div>
    </div>
  {:else if currentView === 'analytics'}
    <div class="space-y-6">
      <h2 class="text-2xl font-semibold tracking-tight">Analytics</h2>
      <p class="text-slate-600 dark:text-slate-400">Spending insights and trends</p>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="aspect-video rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Spending by category chart placeholder
        </div>
        <div class="aspect-video rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Monthly trend chart placeholder
        </div>
      </div>

      <div class="text-center text-xs text-slate-500 dark:text-slate-400">Analytics views arrive after core CRUD (Task 8+).</div>
    </div>
  {:else if currentView === 'settings'}
    <div class="space-y-6">
      <h2 class="text-2xl font-semibold tracking-tight">Settings</h2>
      <p class="text-slate-600 dark:text-slate-400">Preferences, categories, data management</p>

      <div class="space-y-3">
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div class="font-medium">Default Currency</div>
          <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">IDR (placeholder)</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div class="font-medium">Theme</div>
          <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">System (placeholder)</div>
        </div>
        <div class="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          File import/export, reset, custom categories, and full settings UI in Task 10+.
        </div>
      </div>
    </div>
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
