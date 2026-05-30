<script lang="ts">
  /**
   * Root App — Task 5: Navigation & Layout Shell scaffolding.
   *
   * Owns the single currentView reactive state.
   * Uses AppShell (which provides BottomNav + Sidebar + header + content slot).
   * View contents are pure placeholders only. Real implementation comes in later tasks.
   */

  import AppShell, { type View } from '$lib/components/AppShell.svelte';

  let currentView = $state<View>('dashboard');

  // Tiny helper for placeholder cards (no logic, zero dependencies)
  const placeholderCard = (title: string, hint: string) => `
    <div class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">📋</div>
      <p class="text-sm text-slate-500 dark:text-slate-400">${hint}</p>
    </div>
  `;
</script>

<AppShell bind:currentView>
  {#if currentView === 'dashboard'}
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p class="mt-1 text-slate-600 dark:text-slate-400">
          Quick overview of your digital subscriptions.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div class="text-xs uppercase tracking-widest text-slate-500">Active</div>
          <div class="mt-1 text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">—</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div class="text-xs uppercase tracking-widest text-slate-500">Monthly total</div>
          <div class="mt-1 text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">—</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div class="text-xs uppercase tracking-widest text-slate-500">Due soon</div>
          <div class="mt-1 text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">—</div>
        </div>
      </div>

      <div class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Dashboard content will be built in Task 6.<br />
        Navigation between views is live and instant.
      </div>
    </div>
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
