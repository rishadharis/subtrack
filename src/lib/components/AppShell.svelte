<script lang="ts">
  /**
   * AppShell.svelte
   * The responsive layout shell for Subtrack MVP (Task 5).
   *
   * - Mobile-first: BottomNav (fixed) + compact header.
   * - Desktop: Collapsible Sidebar on left + header + content.
   * - Owns desktop collapse state. Receives currentView via bindable prop.
   * - Provides children snippet slot for view content (parent switches content based on currentView).
   * - Purely presentational + navigation. Zero business logic.
   * - Tailwind only. Fast client-side updates via Svelte 5 runes.
   */

  import BottomNav from './BottomNav.svelte';
  import Sidebar from './Sidebar.svelte';
  import type { Snippet } from 'svelte';

  export type View =
    | 'dashboard'
    | 'subscriptions'
    | 'reminders'
    | 'analytics'
    | 'settings';

  interface Props {
    /** Two-way bound from parent so nav changes update parent view switcher */
    currentView?: View;
    /** Svelte 5 snippet for the main view content (replaces deprecated <slot/>) */
    children?: Snippet;
  }

  let { currentView = $bindable('dashboard'), children }: Props = $props();

  // Desktop-only collapse state (persists only for current session)
  let sidebarCollapsed = $state(false);

  const viewLabels: Record<View, string> = {
    dashboard: 'Dashboard',
    subscriptions: 'Subscriptions',
    reminders: 'Reminders',
    analytics: 'Analytics',
    settings: 'Settings',
  };

  function navigateTo(view: View) {
    if (currentView !== view) {
      currentView = view;
    }
  }

  // Keyboard support: allow 1-5 digit keys to switch views (dev/QA nicety, hidden from UI)
  function handleKeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const map: Record<string, View> = {
      '1': 'dashboard',
      '2': 'subscriptions',
      '3': 'reminders',
      '4': 'analytics',
      '5': 'settings',
    };
    const target = map[e.key];
    if (target) {
      e.preventDefault();
      navigateTo(target);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:flex-row">
  <!-- Desktop Sidebar (hidden on mobile, width driven by collapse state) -->
  <div
    class="hidden flex-shrink-0 border-r border-slate-200 bg-white transition-[width] duration-150 dark:border-slate-800 dark:bg-slate-900 md:block {sidebarCollapsed
      ? 'w-14'
      : 'w-56'}"
  >
    <Sidebar
      {currentView}
      onNavigate={navigateTo}
      collapsed={sidebarCollapsed}
      onToggle={() => (sidebarCollapsed = !sidebarCollapsed)}
    />
  </div>

  <!-- Main column: header + scrollable content slot -->
  <div class="flex min-w-0 flex-1 flex-col">
    <!-- Compact header (always present, adapts per breakpoint) -->
    <header
      class="flex h-12 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95 md:h-14 md:px-6"
    >
      <div class="flex min-w-0 items-center gap-3">
        <!-- Mobile brand (tiny) -->
        <span class="text-base font-semibold tracking-tighter text-slate-900 dark:text-white md:hidden"
          >Subtrack</span
        >

        <!-- Desktop brand + divider -->
        <span class="hidden items-center gap-2 text-sm font-medium text-slate-400 md:flex">
          Subtrack
          <span class="text-slate-300 dark:text-slate-700">/</span>
        </span>

        <!-- Current view title -->
        <h1 class="truncate text-lg font-semibold tracking-tight md:text-xl">
          {viewLabels[currentView]}
        </h1>
      </div>

      <!-- Right side reserved for future (file status, theme, etc). Empty in scaffolding. -->
      <div class="hidden text-xs text-slate-400 md:block">MVP</div>
    </header>

    <!-- Content area (receives injected view via Svelte 5 children snippet) -->
    <main class="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-20 md:px-6 md:py-6 md:pb-6">
      <div class="mx-auto w-full max-w-5xl">
        {@render children?.()}
      </div>
    </main>
  </div>

  <!-- Mobile bottom navigation (hidden on md+) -->
  <BottomNav {currentView} onNavigate={navigateTo} />
</div>
