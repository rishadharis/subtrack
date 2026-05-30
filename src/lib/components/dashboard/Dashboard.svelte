<script lang="ts">
  /**
   * Dashboard.svelte — Task 6
   *
   * The primary daily-glance screen for Subtrack.
   * - 4 reactive metric cards (client-side calculations only)
   * - Prominent upcoming renewals list (max 5, urgency colored)
   * - Lightweight 6-month spend trend (pure SVG bars, no deps)
   * - Mini category breakdown (horizontal bars)
   * - "+ Tambah" primary action (dispatches 'add' for parent to navigate)
   *
   * Uses subscriptionStore for all data. Extremely lightweight.
   */

  import { subscriptionStore } from '$lib/stores/subscriptions.svelte';
  import { getAppData } from '$lib/storage';
  import type { BillingCycle, Category } from '$lib/types';
  import MetricCard from './MetricCard.svelte';
  import UpcomingList from './UpcomingList.svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ add: void }>();

  // Reactive source
  const allSubscriptions = $derived(subscriptionStore.subscriptions);

  // Active only (core of most metrics)
  const activeSubscriptions = $derived(
    allSubscriptions.filter((s) => s.status === 'active')
  );

  // Currency from storage (rarely changes; re-eval on sub changes is sufficient)
  const currency = $derived(getAppData().settings.defaultCurrency);

  /* -------------------------------------------------------------------------------------------------
   * Pure calculation helpers (all client-side, no side effects)
   * ----------------------------------------------------------------------------------------------- */

  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

  function getMonthlyEquivalent(price: number, billingCycle: BillingCycle): number {
    if (billingCycle === 'quarterly') return price / 3;
    if (billingCycle === 'yearly') return price / 12;
    // monthly + custom treated as monthly for MVP
    return price;
  }

  function getDaysUntil(dueStr: string): number {
    if (!dueStr || !/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) return Infinity;
    const due = new Date(dueStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function formatCurrency(amount: number, curr: string): string {
    const rounded = Math.round(amount);
    if (curr === 'IDR') {
      return 'Rp ' + rounded.toLocaleString('id-ID');
    }
    return rounded.toLocaleString() + ' ' + curr;
  }

  /* -------------------------------------------------------------------------------------------------
   * Metric 1: Total pengeluaran bulan ini (current monthly burn rate)
   * ----------------------------------------------------------------------------------------------- */
  const totalMonthlySpend = $derived(
    activeSubscriptions.reduce(
      (sum, s) => sum + getMonthlyEquivalent(s.price, s.billingCycle),
      0
    )
  );

  /* -------------------------------------------------------------------------------------------------
   * Metric 2: Jumlah subscription aktif
   * ----------------------------------------------------------------------------------------------- */
  const activeCount = $derived(activeSubscriptions.length);

  /* -------------------------------------------------------------------------------------------------
   * Metric 3: Akan jatuh tempo dalam 30 hari (count)
   * ----------------------------------------------------------------------------------------------- */
  const dueIn30DaysCount = $derived(
    activeSubscriptions.filter((s) => {
      const d = getDaysUntil(s.nextDueDate);
      return d <= 30; // includes today + overdue within window
    }).length
  );

  const hasUrgentDues = $derived(dueIn30DaysCount > 0);

  /* -------------------------------------------------------------------------------------------------
   * Metric 4: Rata-rata bulanan (6 bulan terakhir)
   * Uses historical "would have paid" based on startDate for each past month.
   * ----------------------------------------------------------------------------------------------- */
  const sixMonthTrend = $derived.by(() => {
    const now = new Date();
    const result: { label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0);
      const endStr = monthEnd.toISOString().slice(0, 10);

      const activeThen = activeSubscriptions.filter((s) => s.startDate <= endStr);
      const amount = activeThen.reduce(
        (sum, s) => sum + getMonthlyEquivalent(s.price, s.billingCycle),
        0
      );
      result.push({ label: MONTHS_ID[mDate.getMonth()], amount: Math.round(amount) });
    }
    return result;
  });

  const averageMonthly6m = $derived.by(() => {
    if (sixMonthTrend.length === 0) return 0;
    const total = sixMonthTrend.reduce((s, t) => s + t.amount, 0);
    return Math.round(total / sixMonthTrend.length);
  });

  /* -------------------------------------------------------------------------------------------------
   * Upcoming list (max 5, sorted soonest first)
   * ----------------------------------------------------------------------------------------------- */
  const upcomingItems = $derived.by(() => {
    const filtered = activeSubscriptions
      .filter((s) => {
        const d = getDaysUntil(s.nextDueDate);
        return d <= 30;
      })
      .sort((a, b) => {
        const da = getDaysUntil(a.nextDueDate);
        const db = getDaysUntil(b.nextDueDate);
        return da - db;
      });
    return filtered.slice(0, 5);
  });

  /* -------------------------------------------------------------------------------------------------
   * Mini category breakdown (by monthly spend contribution)
   * ----------------------------------------------------------------------------------------------- */
  const categoryBreakdown = $derived.by(() => {
    const map = new Map<Category, number>();
    for (const s of activeSubscriptions) {
      const equiv = getMonthlyEquivalent(s.price, s.billingCycle);
      map.set(s.category, (map.get(s.category) ?? 0) + equiv);
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount);
  });

  const totalForBreakdown = $derived(
    categoryBreakdown.reduce((s, c) => s + c.amount, 0)
  );

  function getCategoryPct(amount: number): number {
    if (totalForBreakdown === 0) return 0;
    return Math.round((amount / totalForBreakdown) * 100);
  }

  /* -------------------------------------------------------------------------------------------------
   * Handlers
   * ----------------------------------------------------------------------------------------------- */
  function handleAddClick() {
    dispatch('add');
  }

  // Simple formatter for trend max (avoid div0)
  const maxTrendAmount = $derived(
    Math.max(1, ...sixMonthTrend.map((t) => t.amount))
  );
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">Selamat datang kembali</h2>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Ringkasan langganan digital Anda hari ini.
      </p>
    </div>

    <!-- Prominent + Tambah (primary action for MVP) -->
    <button
      type="button"
      onclick={handleAddClick}
      class="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.985] hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-sky-500 dark:hover:bg-sky-600"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      + Tambah
    </button>
  </div>

  <!-- 4 Metric Cards -->
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <MetricCard
      label="Total pengeluaran bulan ini"
      value={formatCurrency(totalMonthlySpend, currency)}
      icon="M12 6v12m-8-6h16"
      subValue={activeCount > 0 ? `${activeCount} aktif` : 'Belum ada langganan'}
    />

    <MetricCard
      label="Jumlah subscription aktif"
      value={activeCount.toString()}
      icon="M17 20h5v-2a3 3 0 01-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2 2 2 0 012 2z"
      subValue={activeCount === 0 ? 'Mulai tambahkan langganan' : 'Status aktif'}
    />

    <MetricCard
      label="Akan jatuh tempo (30 hari)"
      value={dueIn30DaysCount.toString()}
      variant={hasUrgentDues ? 'warning' : 'default'}
      icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      subValue={hasUrgentDues ? 'Perlu perhatian' : 'Aman'}
    />

    <MetricCard
      label="Rata-rata bulanan (6 bulan)"
      value={formatCurrency(averageMonthly6m, currency)}
      icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25m-9-3.75h16.5"
      subValue="Berdasarkan tanggal mulai"
    />
  </div>

  <!-- Yang Akan Jatuh Tempo (prominent section) -->
  <div>
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
        Yang Akan Jatuh Tempo dalam 30 Hari
      </h3>
      {#if upcomingItems.length > 0}
        <span
          class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/60 dark:text-amber-400"
        >
          {upcomingItems.length} item
        </span>
      {/if}
    </div>

    <UpcomingList items={upcomingItems} {currency} />
  </div>

  <!-- Lightweight 6-month trend + Category breakdown (side-by-side on wide) -->
  <div class="grid gap-4 lg:grid-cols-2">
    <!-- 6-month trend (pure SVG, tiny footprint) -->
    <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-2 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Tren 6 Bulan Terakhir
      </div>

      <div class="mt-3">
        <svg
          width="100%"
          height="68"
          viewBox="0 0 240 68"
          class="overflow-visible"
          aria-label="Monthly recurring spend trend"
        >
          <!-- bars -->
          {#each sixMonthTrend as point, i (i)}
            {@const barHeight = Math.max(3, Math.round((point.amount / maxTrendAmount) * 48))}
            {@const x = 18 + i * 36}
            <rect
              x={x}
              y={62 - barHeight}
              width="22"
              height={barHeight}
              rx="3"
              class="fill-sky-500/80 dark:fill-sky-400"
            />
            <!-- value on top if significant -->
            {#if point.amount > 0}
              <text
                x={x + 11}
                y={58 - barHeight}
                text-anchor="middle"
                class="fill-slate-500 text-[9px] dark:fill-slate-400"
                font-size="9"
              >
                {point.amount >= 1000 ? Math.round(point.amount / 1000) + 'k' : point.amount}
              </text>
            {/if}
            <!-- month label -->
            <text
              x={x + 11}
              y="66"
              text-anchor="middle"
              class="fill-slate-400 dark:fill-slate-500"
              font-size="9"
            >
              {point.label}
            </text>
          {/each}
        </svg>
      </div>
      <div class="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
        Estimasi pengeluaran bulanan berdasarkan tanggal mulai langganan
      </div>
    </div>

    <!-- Mini category breakdown -->
    <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-2 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Breakdown per Kategori
      </div>

      {#if categoryBreakdown.length === 0}
        <div class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          Belum ada data kategori.
        </div>
      {:else}
        <div class="space-y-2.5 pt-1">
          {#each categoryBreakdown as cat (cat.category)}
            {@const pct = getCategoryPct(cat.amount)}
            <div>
              <div class="flex items-baseline justify-between text-xs">
                <span class="font-medium text-slate-700 dark:text-slate-200">{cat.category}</span>
                <span class="tabular-nums text-slate-500 dark:text-slate-400">
                  {formatCurrency(cat.amount, currency)}
                  <span class="text-[10px] opacity-60">({pct}%)</span>
                </span>
              </div>
              <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  class="h-1.5 rounded-full bg-sky-500 transition-all dark:bg-sky-400"
                  style="width: {pct}%"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Footer hint / empty state guidance -->
  {#if activeCount === 0}
    <div class="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      Mulai dengan menekan tombol <span class="font-medium">+ Tambah</span> untuk melacak langganan pertama Anda.
      <br />Semua data disimpan secara lokal di file .subtrack milik Anda.
    </div>
  {/if}
</div>
