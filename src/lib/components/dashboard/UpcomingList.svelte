<script lang="ts">
  /**
   * UpcomingList.svelte
   * Prominent list of subscriptions due within ~30 days.
   * Color coded:
   *   - red for <7 days (or overdue)
   *   - orange for <14 days
   *   - neutral otherwise
   * Max 5 items. Receives pre-filtered + sorted list from parent.
   */

  import type { Subscription } from '$lib/types';

  interface Props {
    items: Subscription[];
    currency: string;
  }

  let { items, currency }: Props = $props();

  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

  function formatDue(dateStr: string): string {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${MONTHS_ID[m - 1]}`;
  }

  function getDaysUntil(dueStr: string): number {
    if (!dueStr) return Infinity;
    const due = new Date(dueStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function getUrgency(days: number): 'overdue' | 'urgent' | 'soon' | 'normal' {
    if (days < 0) return 'overdue';
    if (days < 7) return 'urgent';
    if (days < 14) return 'soon';
    return 'normal';
  }

  function urgencyClasses(urgency: string) {
    switch (urgency) {
      case 'overdue':
      case 'urgent':
        return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-900';
      case 'soon':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 border-orange-200 dark:border-orange-900';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  }

  function formatRelative(days: number): string {
    if (days < 0) return `Terlewat ${Math.abs(days)} hari`;
    if (days === 0) return 'Hari ini';
    return `Dalam ${days} hari`;
  }

  function formatAmount(price: number, curr: string): string {
    if (curr === 'IDR') {
      return 'Rp ' + Math.round(price).toLocaleString('id-ID');
    }
    return price.toFixed(0) + ' ' + curr;
  }
</script>

{#if items.length === 0}
  <div
    class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
  >
    Tidak ada subscription yang jatuh tempo dalam 30 hari.
  </div>
{:else}
  <div class="space-y-2">
    {#each items as sub (sub.id)}
      {@const days = getDaysUntil(sub.nextDueDate)}
      {@const urgency = getUrgency(days)}
      <div
        class="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm {urgencyClasses(urgency)}"
      >
        <div class="min-w-0 flex-1">
          <div class="font-medium text-slate-900 dark:text-white truncate">{sub.name}</div>
          <div class="text-xs text-current/70 mt-0.5 flex items-center gap-1.5">
            <span>{formatDue(sub.nextDueDate)}</span>
            <span class="opacity-60">•</span>
            <span class="font-medium">{formatRelative(days)}</span>
          </div>
        </div>

        <div class="text-right tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
          {formatAmount(sub.price, currency)}
          <div class="text-[10px] font-normal text-current/60 tracking-wide -mt-0.5">
            {sub.billingCycle}
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
