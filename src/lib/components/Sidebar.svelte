<script lang="ts">
  /**
   * Sidebar.svelte
   * Desktop sidebar navigation (collapsible, compact).
   * Receives collapsed state + toggle callback from parent shell.
   * Mobile: never rendered (controlled by parent via hidden classes).
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
    collapsed?: boolean;
    onToggle?: () => void;
  }

  let {
    currentView,
    onNavigate,
    collapsed = false,
    onToggle,
  }: Props = $props();

  const navItems: Array<{
    id: View;
    label: string;
    iconPath: string;
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
        'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.826a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
    },
  ];
</script>

<!-- Sidebar container is provided by parent; we render inner content -->
<div class="flex h-full flex-col bg-white dark:bg-slate-900">
  <!-- Brand + collapse toggle -->
  <div
    class="flex h-14 flex-shrink-0 items-center border-b border-slate-200 px-3 dark:border-slate-800 {collapsed
      ? 'justify-center'
      : 'justify-between'}"
  >
    {#if !collapsed}
      <div class="flex items-center gap-2 px-1">
        <span class="text-lg font-semibold tracking-tighter text-slate-900 dark:text-white"
          >Subtrack</span
        >
      </div>
    {/if}

    {#if onToggle}
      <button
        type="button"
        onclick={onToggle}
        class="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-4 w-4 transition-transform {collapsed ? 'rotate-180' : ''}"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Navigation items -->
  <nav class="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Desktop navigation">
    {#each navItems as item (item.id)}
      {@const isActive = currentView === item.id}
      <button
        type="button"
        onclick={() => onNavigate(item.id)}
        class="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 {collapsed
          ? 'justify-center px-2'
          : ''} {isActive
          ? 'bg-slate-100 text-sky-700 dark:bg-slate-800 dark:text-sky-400'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'}"
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-5 w-5 flex-shrink-0 {isActive ? 'text-sky-600 dark:text-sky-400' : ''}"
          aria-hidden="true"
        >
          <path d={item.iconPath} />
        </svg>

        {#if !collapsed}
          <span class="truncate">{item.label}</span>
        {/if}
      </button>
    {/each}
  </nav>

  <!-- Footer hint (very minimal) -->
  <div class="flex-shrink-0 border-t border-slate-200 p-3 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500 {collapsed ? 'text-center' : ''}">
    {#if !collapsed}
      <div>Local • Private</div>
    {:else}
      <div title="Local • Private">🔒</div>
    {/if}
  </div>
</div>
