<script lang="ts">
  /**
   * BottomNav.svelte
   * Mobile-first bottom navigation bar (5 tabs).
   * Used exclusively inside AppShell for view switching.
   * Lightweight: Tailwind only, inline SVGs, no external deps.
   */

  export type View =
    | 'dashboard'
    | 'subscriptions'
    | 'reminders'
    | 'analytics'
    | 'settings';

  interface Props {
    currentView: View;
    onNavigate: (view: View) => void;
  }

  let { currentView, onNavigate }: Props = $props();

  // Nav items — labels per task spec. Icons are minimal inline SVGs (currentColor).
  const navItems: Array<{
    id: View;
    label: string;
    // path data for 24x24 outline icon (heroicon-style, trimmed for size)
    iconPath: string;
    iconViewBox?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      iconPath:
        'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1v-5m-6 0v5',
    },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      iconPath:
        'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
    },
    {
      id: 'reminders',
      label: 'Reminders',
      iconPath:
        'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      iconPath:
        'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25C3.504 21 3 20.496 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125V4.125z',
    },
    {
      id: 'settings',
      label: 'Settings',
      iconPath:
        'M12 6v.01M12 12v.01M12 18v.01M19.5 12a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z',
      iconViewBox: '0 0 24 24',
    },
  ];
</script>

<nav
  class="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-1 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
  aria-label="Primary navigation"
>
  {#each navItems as item (item.id)}
    {@const isActive = currentView === item.id}
    <button
      type="button"
      onclick={() => onNavigate(item.id)}
      class="group flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 {isActive
        ? 'text-sky-600 dark:text-sky-400'
        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
      aria-current={isActive ? 'page' : undefined}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={item.iconViewBox ?? '0 0 24 24'}
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5 transition-transform group-active:scale-95 {isActive
          ? ''
          : 'opacity-80'}"
        aria-hidden="true"
      >
        <path d={item.iconPath} />
      </svg>
      <span class="leading-none tracking-[-0.2px]">{item.label}</span>
    </button>
  {/each}
</nav>
