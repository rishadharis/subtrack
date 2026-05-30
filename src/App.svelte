<script lang="ts">
  /**
   * Root App — Task 6 wired: Dashboard fully implemented (Task 5 shell + navigation preserved).
   *
   * Owns the single currentView reactive state.
   * Uses AppShell (which provides BottomNav + Sidebar + header + content slot).
   * Other views remain scaffolding until their tasks.
   */

  import AppShell, { type View } from '$lib/components/AppShell.svelte';
  import Dashboard from '$lib/components/dashboard/Dashboard.svelte';

  let currentView = $state<View>('dashboard');

  function handleDashboardAdd() {
    // Navigate to subscriptions view (real add form arrives in Task 7)
    currentView = 'subscriptions';
  }
</script>

<AppShell bind:currentView>
  {#if currentView === 'dashboard'}
    <Dashboard on:add={handleDashboardAdd} />
  {:else if currentView === 'subscriptions'}
    <div class="space-y-6">
      <div class="flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">Subscriptions</h2>
          <p class="text-slate-600 dark:text-slate-400">All your tracked services</p>
        </div>
      </div>

      <div class="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Full list, search, add/edit forms, and filters will live here (Task 7+).<br />
        Currently just layout scaffolding.
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
