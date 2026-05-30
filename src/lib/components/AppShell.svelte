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
  import { onMount } from 'svelte';
  import { getCurrentFileName, getIsDirty, subscribeToStorageChanges } from '$lib/storage';

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

  /* -------------------------------------------------------------------------------------------------
   * Task 12: Subtle PWA install prompt (non-aggressive, tasteful, respects user)
   * Fires the native install flow only on user gesture after the banner appears.
   * Uses beforeinstallprompt (Chromium/Android/Windows). Hidden in standalone/PWA mode.
   * Dismissal remembered for the browser session via sessionStorage.
   * ----------------------------------------------------------------------------------------------- */
  let deferredPrompt: Event | null = $state(null);
  let showInstallBanner = $state(false);
  let isStandalone = $state(false);

  /* Task 13: Live file status in header (dirty indicator + truncated filename) */
  let fileVersion = $state(0);
  const currentFile = $derived.by(() => {
    fileVersion;
    return getCurrentFileName();
  });
  const isDirty = $derived.by(() => {
    fileVersion;
    return getIsDirty();
  });

  $effect(() => {
    const unsub = subscribeToStorageChanges(() => {
      fileVersion += 1;
    });
    return unsub;
  });

  function checkStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }

  function handleBeforeInstallPrompt(e: Event) {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;
    // Only show if not already standalone and not recently dismissed this session
    if (!checkStandalone() && !sessionStorage.getItem('installPromptDismissed')) {
      // Delay for tasteful/non-intrusive experience (user has time to explore first)
      setTimeout(() => {
        if (deferredPrompt && !showInstallBanner) {
          showInstallBanner = true;
        }
      }, 42000);
    }
  }

  function handleAppInstalled() {
    showInstallBanner = false;
    deferredPrompt = null;
  }

  async function installPWA() {
    if (!deferredPrompt) return;
    // @ts-ignore - BeforeInstallPromptEvent has prompt()
    const promptEvent = deferredPrompt as any;
    promptEvent.prompt?.();
    try {
      const { outcome } = await promptEvent.userChoice;
      // outcome: 'accepted' | 'dismissed'
    } catch (_) {
      // ignore
    }
    deferredPrompt = null;
    showInstallBanner = false;
  }

  function dismissInstall() {
    showInstallBanner = false;
    sessionStorage.setItem('installPromptDismissed', 'true');
  }

  onMount(() => {
    isStandalone = checkStandalone();
    if (isStandalone) {
      showInstallBanner = false;
    }

    // Attach PWA install events (cannot use svelte:window for non-bubbling custom events reliably here)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  });

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

      <!-- Task 13: File status indicator (live dirty + filename) -->
      <div class="hidden items-center gap-2 text-xs md:flex">
        {#if currentFile}
          <span
            class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-tight
              {isDirty
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}"
            title={currentFile}
          >
            {isDirty ? '● ' : ''}{currentFile.length > 18 ? currentFile.slice(0, 15) + '…' : currentFile}
          </span>
        {:else}
          <span class="text-slate-400">MVP • file lokal</span>
        {/if}
      </div>
    </header>

    <!-- Task 12: Subtle, non-aggressive PWA install banner (appears delayed, only when eligible) -->
    {#if showInstallBanner && !isStandalone}
      <div class="flex-shrink-0 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/70 dark:text-sky-200">
        <div class="mx-auto flex max-w-5xl items-center gap-3">
          <span class="flex-1">Pasang Subtrack di perangkat untuk akses cepat &amp; pengalaman seperti aplikasi native.</span>
          <button
            type="button"
            onclick={installPWA}
            class="rounded-lg bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition active:scale-[0.985] hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Pasang
          </button>
          <button
            type="button"
            onclick={dismissInstall}
            class="rounded px-1.5 text-sky-500 hover:text-sky-700 active:scale-95 dark:text-sky-400"
            aria-label="Nanti saja"
          >
            ✕
          </button>
        </div>
      </div>
    {/if}

    <!-- Content area (receives injected view via Svelte 5 children snippet) -->
    <main class="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:py-6 md:pb-6">
      <div class="mx-auto w-full max-w-5xl">
        {@render children?.()}
      </div>
    </main>
  </div>

  <!-- Mobile bottom navigation (hidden on md+) -->
  <BottomNav {currentView} onNavigate={navigateTo} />
</div>
