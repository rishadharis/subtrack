<script lang="ts">
  /**
   * MetricCard.svelte
   * Reusable card for top-level dashboard KPIs.
   * Lightweight, Tailwind only. Supports warning variant for time-sensitive metrics.
   */

  interface Props {
    label: string;
    value: string;
    subValue?: string;
    /** Optional inline SVG path (24x24 viewBox recommended) or emoji/text */
    icon?: string;
    variant?: 'default' | 'warning';
  }

  let {
    label,
    value,
    subValue,
    icon,
    variant = 'default',
  }: Props = $props();

  const isWarning = $derived(variant === 'warning');
</script>

<div
  class="rounded-2xl border p-4 transition-colors {isWarning
    ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30'
    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}"
>
  <div class="flex items-start justify-between gap-2">
    <div class="text-[10px] font-medium uppercase tracking-[1px] text-slate-500 dark:text-slate-400">
      {label}
    </div>
    {#if icon}
      <div class="text-slate-400 dark:text-slate-500">
        {#if icon.startsWith('<')}
          <!-- raw svg markup support (rare) -->
          {@html icon}
        {:else if icon.length > 2}
          <!-- treat as path data for 16x16 icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
          >
            <path d={icon} />
          </svg>
        {:else}
          <span class="text-base leading-none">{icon}</span>
        {/if}
      </div>
    {/if}
  </div>

  <div
    class="mt-2 font-semibold tabular-nums tracking-tighter {isWarning
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-slate-900 dark:text-white'} text-3xl"
  >
    {value}
  </div>

  {#if subValue}
    <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
      {subValue}
    </div>
  {/if}
</div>
