<script lang="ts">
  /**
   * AnalyticsView.svelte — Task 10: Complete Analytics Page
   *
   * All requested features implemented client-side, reactive, accurate:
   * - Monthly summary cards (current total, vs previous month with delta/%, active count)
   * - Spending trend chart: 6 or 12 month bar chart (pure SVG, no deps, lightweight)
   * - Category breakdown: SVG donut + detailed list with amounts + %
   * - Top expensive subscriptions list (by normalized monthly cost)
   * - Spending forecast/projection: 6 months ahead using base + linear trend slope (credible, transparent assumptions)
   * - Exportable reports: multiple useful CSVs (monthly summary, full subs list, projections)
   * - Filters: lookback period (6/12 mo for trend), category filter (scopes breakdown + top list)
   *
   * All math uses the established getMonthlyEquivalent + startDate-based historical activity.
   * Fully reactive to subscriptionStore. Matches app tone (ID labels, dark mode, mobile-first).
   */

  import { subscriptionStore } from '$lib/stores/subscriptions.svelte';
  import { getAppData } from '$lib/storage';
  import type { BillingCycle, Category, Subscription } from '$lib/types';
  import MetricCard from '../dashboard/MetricCard.svelte';

  /* -------------------------------------------------------------------------------------------------
   * Reactive data sources
   * ----------------------------------------------------------------------------------------------- */
  const allSubscriptions = $derived(subscriptionStore.subscriptions);
  const activeSubscriptions = $derived(
    allSubscriptions.filter((s) => s.status === 'active')
  );
  const currency = $derived(getAppData().settings.defaultCurrency);

  /* -------------------------------------------------------------------------------------------------
   * Pure helpers (self-contained, consistent with Dashboard/Reminders/SubscriptionsList)
   * ----------------------------------------------------------------------------------------------- */
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'] as const;
  const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'] as const;

  function getMonthlyEquivalent(price: number, billingCycle: BillingCycle): number {
    if (billingCycle === 'quarterly') return price / 3;
    if (billingCycle === 'yearly') return price / 12;
    return price; // monthly + custom
  }

  function formatCurrency(amount: number, curr: string): string {
    const rounded = Math.round(amount);
    if (curr === 'IDR') {
      return 'Rp ' + rounded.toLocaleString('id-ID');
    }
    return rounded.toLocaleString() + ' ' + curr;
  }

  function getMonthEndDate(year: number, month0: number): string {
    // month0: 0=Jan ... 11=Dec
    const end = new Date(year, month0 + 1, 0);
    return end.toISOString().slice(0, 10);
  }

  function computeSpendForMonthEnd(year: number, month0: number): number {
    const endStr = getMonthEndDate(year, month0);
    return activeSubscriptions
      .filter((s) => s.startDate <= endStr)
      .reduce((sum, s) => sum + getMonthlyEquivalent(s.price, s.billingCycle), 0);
  }

  /** Build trend for N months ending with "current" (this month) */
  function buildTrendData(months: 6 | 12) {
    const now = new Date();
    const result: Array<{
      label: string;
      fullLabel: string;
      amount: number;
      year: number;
      month0: number;
      isCurrent: boolean;
    }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = mDate.getFullYear();
      const m0 = mDate.getMonth();
      const amount = Math.round(computeSpendForMonthEnd(y, m0));

      const short = MONTHS_ID[m0];
      const full = `${MONTHS_FULL[m0]} ${y}`;
      const label = i === 0 ? short : (months === 12 && i % 2 === 1 ? short : short);

      result.push({
        label,
        fullLabel: full,
        amount,
        year: y,
        month0: m0,
        isCurrent: i === 0,
      });
    }
    return result;
  }

  /* -------------------------------------------------------------------------------------------------
   * UI State (filters)
   * ----------------------------------------------------------------------------------------------- */
  let lookbackMonths = $state<6 | 12>(6);
  let categoryFilter = $state<'all' | Category>('all');

  /* -------------------------------------------------------------------------------------------------
   * Derived analytics (all reactive)
   * ----------------------------------------------------------------------------------------------- */
  const trendData = $derived(buildTrendData(lookbackMonths));

  const maxTrendAmount = $derived(
    Math.max(1, ...trendData.map((t) => t.amount))
  );

  // Current month summary (always "now")
  const currentMonthSpend = $derived(
    trendData.length > 0 ? trendData[trendData.length - 1].amount : 0
  );

  // Previous month from trend
  const prevMonthSpend = $derived(
    trendData.length > 1 ? trendData[trendData.length - 2].amount : currentMonthSpend
  );

  const monthOverMonthDelta = $derived(currentMonthSpend - prevMonthSpend);
  const monthOverMonthPct = $derived(
    prevMonthSpend > 0 ? Math.round((monthOverMonthDelta / prevMonthSpend) * 100) : 0
  );

  const activeCount = $derived(activeSubscriptions.length);

  // Average monthly per active sub (current)
  const avgPerSub = $derived(
    activeCount > 0 ? Math.round(currentMonthSpend / activeCount) : 0
  );

  // Category breakdown (global or filtered by categoryFilter)
  const categoryBreakdown = $derived.by(() => {
    const map = new Map<Category, number>();
    const source =
      categoryFilter === 'all'
        ? activeSubscriptions
        : activeSubscriptions.filter((s) => s.category === categoryFilter);

    for (const s of source) {
      const equiv = getMonthlyEquivalent(s.price, s.billingCycle);
      map.set(s.category, (map.get(s.category) ?? 0) + equiv);
    }

    const arr = Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount);

    const total = arr.reduce((s, c) => s + c.amount, 0);
    return { items: arr, total };
  });

  const categoryTotal = $derived(categoryBreakdown.total);

  function getCategoryPct(amount: number): number {
    if (categoryTotal === 0) return 0;
    return Math.round((amount / categoryTotal) * 100);
  }

  // Top expensive subscriptions (by monthly equivalent), optionally filtered
  const topSubscriptions = $derived.by(() => {
    const source =
      categoryFilter === 'all'
        ? activeSubscriptions
        : activeSubscriptions.filter((s) => s.category === categoryFilter);

    return [...source]
      .map((s) => ({
        sub: s,
        monthly: Math.round(getMonthlyEquivalent(s.price, s.billingCycle)),
      }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 8);
  });

  // Forecast / projection (6 months ahead)
  // Method: base = current monthly burn.
  // Slope = simple linear regression on the trend values (cents per month).
  // Projected monthly_i = base + slope * i (clamped >= 0)
  // Also shows cumulative.
  const forecast = $derived.by(() => {
    const base = currentMonthSpend;
    if (trendData.length < 2 || base === 0) {
      return {
        projections: [] as Array<{ month: string; monthly: number; cumulative: number }>,
        slope: 0,
        totalNext6: base * 6,
        method: 'Flat (data tidak cukup untuk tren)',
      };
    }

    // Linear regression slope on trend points (x = 0 oldest ... n-1 = current)
    const n = trendData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    trendData.forEach((point, idx) => {
      const x = idx;
      const y = point.amount;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const roundedSlope = Math.round(slope * 10) / 10; // keep readable

    const projections: Array<{ month: string; monthly: number; cumulative: number }> = [];
    let cumulative = 0;

    const now = new Date();
    for (let i = 1; i <= 6; i++) {
      const projDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = `${MONTHS_ID[projDate.getMonth()]} ${projDate.getFullYear()}`;
      let monthly = Math.round(base + roundedSlope * i);
      if (monthly < 0) monthly = 0;

      cumulative += monthly;
      projections.push({ month: label, monthly, cumulative });
    }

    return {
      projections,
      slope: roundedSlope,
      totalNext6: cumulative,
      method: roundedSlope >= 0
        ? `Tren naik +${roundedSlope}/bln`
        : `Tren turun ${roundedSlope}/bln`,
    };
  });

  /* -------------------------------------------------------------------------------------------------
   * Color palette for categories (consistent, good contrast in light/dark)
   * ----------------------------------------------------------------------------------------------- */
  const CATEGORY_PALETTE: Record<Category, string> = {
    Streaming: '#0ea5e9',      // sky-500
    Productivity: '#8b5cf6',   // violet-500
    Cloud: '#10b981',          // emerald-500
    AI: '#f43f5e',             // rose-500
    Gaming: '#f59e0b',         // amber-500
    Lainnya: '#64748b',        // slate-500
  };

  /* -------------------------------------------------------------------------------------------------
   * CSV Export helpers (pure client-side, no external libs)
   * ----------------------------------------------------------------------------------------------- */
  function downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function escapeCSV(value: unknown): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportMonthlySummaryCSV() {
    const rows: string[] = [];
    rows.push(['Bulan', 'Estimasi Pengeluaran (Bulanan)', 'Jumlah Langganan Aktif Saat Itu', 'Catatan'].map(escapeCSV).join(','));

    const now = new Date();
    trendData.forEach((t, idx) => {
      const activeCountAtTime = activeSubscriptions.filter((s) => s.startDate <= getMonthEndDate(t.year, t.month0)).length;
      const note = t.isCurrent ? 'Bulan ini' : (idx === trendData.length - 2 ? 'Bulan lalu' : '');
      rows.push([
        t.fullLabel,
        t.amount,
        activeCountAtTime,
        note,
      ].map(escapeCSV).join(','));
    });

    // Add summary footer
    rows.push('');
    rows.push(['Ringkasan Saat Ini', '', '', ''].map(escapeCSV).join(','));
    rows.push(['Total Bulan Ini', currentMonthSpend, '', ''].map(escapeCSV).join(','));
    rows.push(['Delta vs Bulan Lalu', monthOverMonthDelta, `(${monthOverMonthPct >= 0 ? '+' : ''}${monthOverMonthPct}%)`, ''].map(escapeCSV).join(','));
    rows.push(['Jumlah Aktif', activeCount, '', ''].map(escapeCSV).join(','));
    rows.push(['Rata-rata per Langganan', avgPerSub, '', ''].map(escapeCSV).join(','));

    const csv = rows.join('\n');
    const dateStr = now.toISOString().slice(0, 10);
    downloadCSV(csv, `subtrack-ringkasan-bulanan-${dateStr}.csv`);
  }

  function exportFullListCSV() {
    const rows: string[] = [];
    const headers = ['Nama', 'Kategori', 'Harga Asli', 'Mata Uang', 'Siklus', 'Estimasi Bulanan', 'Status', 'Mulai', 'Jatuh Tempo Berikutnya', 'Auto Renew', 'Catatan'];
    rows.push(headers.map(escapeCSV).join(','));

    const source = categoryFilter === 'all' ? allSubscriptions : allSubscriptions.filter(s => s.category === categoryFilter);

    source.forEach((s) => {
      const monthly = Math.round(getMonthlyEquivalent(s.price, s.billingCycle));
      rows.push([
        s.name,
        s.category,
        s.price,
        s.currency,
        s.billingCycle,
        monthly,
        s.status,
        s.startDate,
        s.nextDueDate,
        s.autoRenew ? 'Ya' : 'Tidak',
        (s.notes || '').replace(/\n/g, ' '),
      ].map(escapeCSV).join(','));
    });

    // Summary row
    rows.push('');
    rows.push(['TOTAL AKTIF (filtered)', '', '', '', '', categoryBreakdown.total, '', '', '', '', ''].map(escapeCSV).join(','));

    const csv = rows.join('\n');
    const suffix = categoryFilter === 'all' ? 'semua' : categoryFilter.toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `subtrack-daftar-langganan-${suffix}-${dateStr}.csv`);
  }

  function exportForecastCSV() {
    const rows: string[] = [];
    rows.push(['Bulan Proyeksi', 'Estimasi Bulanan', 'Kumulatif (dari sekarang)', 'Metode'].map(escapeCSV).join(','));

    const nowStr = new Date().toISOString().slice(0, 10);
    forecast.projections.forEach((p) => {
      rows.push([
        p.month,
        p.monthly,
        p.cumulative,
        forecast.method,
      ].map(escapeCSV).join(','));
    });

    rows.push('');
    rows.push(['Total 6 bulan ke depan', forecast.totalNext6, '', `Base: ${currentMonthSpend} | Slope: ${forecast.slope}`].map(escapeCSV).join(','));
    rows.push(['Catatan', 'Proyeksi ini bersifat estimasi. Perubahan langganan akan memengaruhi hasil.', '', ''].map(escapeCSV).join(','));

    const csv = rows.join('\n');
    downloadCSV(csv, `subtrack-proyeksi-6bulan-${nowStr}.csv`);
  }

  /* -------------------------------------------------------------------------------------------------
   * Small donut chart geometry (pure SVG, no libs)
   * Returns segments ready for rendering.
   * ----------------------------------------------------------------------------------------------- */
  function getDonutSegments(items: { category: Category; amount: number }[], total: number) {
    if (total === 0) return [] as Array<{ category: Category; pct: number; startAngle: number; endAngle: number; color: string }>;

    const segments: Array<{ category: Category; pct: number; startAngle: number; endAngle: number; color: string }> = [];
    let currentAngle = -90; // start at top

    for (const item of items) {
      const pct = total > 0 ? item.amount / total : 0;
      const sweep = pct * 360;
      const start = currentAngle;
      const end = currentAngle + sweep;

      segments.push({
        category: item.category,
        pct: Math.round(pct * 100),
        startAngle: start,
        endAngle: end,
        color: CATEGORY_PALETTE[item.category],
      });

      currentAngle = end;
    }
    return segments;
  }

  const donutSegments = $derived(
    getDonutSegments(categoryBreakdown.items, categoryTotal)
  );

  // Helper to create SVG arc path for donut segment
  function donutArcPath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number): string {
    const toRad = (a: number) => (a * Math.PI) / 180;

    const x1 = cx + rOuter * Math.cos(toRad(startAngle));
    const y1 = cy + rOuter * Math.sin(toRad(startAngle));
    const x2 = cx + rOuter * Math.cos(toRad(endAngle));
    const y2 = cy + rOuter * Math.sin(toRad(endAngle));

    const x3 = cx + rInner * Math.cos(toRad(endAngle));
    const y3 = cy + rInner * Math.sin(toRad(endAngle));
    const x4 = cx + rInner * Math.cos(toRad(startAngle));
    const y4 = cy + rInner * Math.sin(toRad(startAngle));

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return [
      `M ${x1} ${y1}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');
  }

  const billingLabel: Record<BillingCycle, string> = {
    monthly: 'Bulanan',
    quarterly: 'Kuartalan',
    yearly: 'Tahunan',
    custom: 'Kustom',
  };

  const statusLabel: Record<Subscription['status'], string> = {
    active: 'Aktif',
    paused: 'Dijeda',
    cancelled: 'Dibatalkan',
  };
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.25">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Analisis pengeluaran bulanan, tren, dan proyeksi — sepenuhnya dihitung di perangkat Anda.
        </p>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
    <div class="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">Periode Tren</div>

    <div class="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onclick={() => (lookbackMonths = 6)}
        class="rounded-md px-3 py-1 text-sm font-medium transition {lookbackMonths === 6
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}"
      >
        6 bulan
      </button>
      <button
        type="button"
        onclick={() => (lookbackMonths = 12)}
        class="rounded-md px-3 py-1 text-sm font-medium transition {lookbackMonths === 12
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}"
      >
        12 bulan
      </button>
    </div>

    <div class="ml-1 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">Filter Kategori</div>

    <select
      bind:value={categoryFilter}
      class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <option value="all">Semua Kategori</option>
      {#each ['Streaming', 'Productivity', 'Cloud', 'AI', 'Gaming', 'Lainnya'] as cat (cat)}
        <option value={cat}>{cat}</option>
      {/each}
    </select>

    {#if categoryFilter !== 'all'}
      <button
        type="button"
        onclick={() => (categoryFilter = 'all')}
        class="text-xs font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
      >
        Reset filter
      </button>
    {/if}

    <div class="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
      Data di-update otomatis • {activeSubscriptions.length} aktif
    </div>
  </div>

  <!-- Monthly Summary Cards -->
  <div>
    <div class="mb-2 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
      Ringkasan Bulanan Saat Ini
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <MetricCard
        label="Total pengeluaran bulan ini"
        value={formatCurrency(currentMonthSpend, currency)}
        icon="M12 6v12m-8-6h16"
        subValue={activeCount > 0 ? `${activeCount} langganan aktif` : 'Belum ada data'}
      />

      <div
        class="rounded-2xl border p-4 transition-colors {monthOverMonthDelta >= 0
          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'}"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="text-[10px] font-medium uppercase tracking-[1px] text-slate-500 dark:text-slate-400">
            vs Bulan Lalu
          </div>
          <div class={monthOverMonthDelta >= 0 ? 'text-emerald-500' : 'text-amber-500'}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              {#if monthOverMonthDelta >= 0}
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7" />
              {:else}
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7" />
              {/if}
            </svg>
          </div>
        </div>

        <div class="mt-2 font-semibold tabular-nums tracking-tighter text-3xl {monthOverMonthDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}">
          {monthOverMonthDelta >= 0 ? '+' : ''}{formatCurrency(monthOverMonthDelta, currency)}
        </div>

        <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {monthOverMonthPct >= 0 ? '+' : ''}{monthOverMonthPct}% &nbsp;•&nbsp;
          {formatCurrency(prevMonthSpend, currency)} bulan lalu
        </div>
      </div>

      <MetricCard
        label="Jumlah langganan aktif"
        value={activeCount.toString()}
        icon="M17 20h5v-2a3 3 0 01-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2 2 2 0 012 2z"
        subValue={activeCount === 0 ? 'Mulai tambah langganan' : 'Digunakan untuk semua metrik'}
      />

      <MetricCard
        label="Rata-rata per langganan"
        value={formatCurrency(avgPerSub, currency)}
        icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2v14a2 2 0 01-2 2"
        subValue="Berdasarkan estimasi bulanan"
      />
    </div>
  </div>

  <!-- Spending Trend Chart -->
  <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div class="mb-3 flex items-center justify-between">
      <div>
        <div class="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Tren Pengeluaran ({lookbackMonths} Bulan Terakhir)
        </div>
        <div class="text-[10px] text-slate-400 dark:text-slate-500">
          Estimasi burn rate di akhir setiap bulan (berdasarkan langganan yang sudah aktif)
        </div>
      </div>
      <div class="text-right text-[10px] text-slate-400 dark:text-slate-500">
        Max: {formatCurrency(maxTrendAmount, currency)}
      </div>
    </div>

    {#if trendData.every((t) => t.amount === 0)}
      <div class="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        Belum ada data tren. Tambahkan langganan aktif untuk mulai melihat grafik.
      </div>
    {:else}
      <div class="mt-2 overflow-x-auto">
        <svg
          width={lookbackMonths === 12 ? '100%' : '100%'}
          height="148"
          viewBox={lookbackMonths === 12 ? '0 0 520 148' : '0 0 320 148'}
          class="overflow-visible"
          aria-label="Spending trend bar chart"
        >
          <!-- grid lines -->
          {#each [0, 0.25, 0.5, 0.75, 1] as frac}
            {@const y = 110 - frac * 90}
            <line
              x1="8"
              y1={y}
              x2={lookbackMonths === 12 ? '512' : '312'}
              y2={y}
              stroke="currentColor"
              stroke-opacity="0.06"
              class="dark:stroke-white"
            />
          {/each}

          <!-- bars -->
          {#each trendData as point, i (i)}
            {@const barWidth = lookbackMonths === 12 ? 28 : 36}
            {@const gap = lookbackMonths === 12 ? 12 : 14}
            {@const startX = lookbackMonths === 12 ? 22 : 18}
            {@const barHeight = Math.max(4, Math.round((point.amount / maxTrendAmount) * 90))}
            {@const x = startX + i * (barWidth + gap)}
            {@const isCurrent = point.isCurrent}

            <rect
              x={x}
              y={112 - barHeight}
              width={barWidth}
              height={barHeight}
              rx="4"
              class={isCurrent ? 'fill-sky-500 dark:fill-sky-400' : 'fill-sky-500/70 dark:fill-sky-400/80'}
            />

            <!-- value label -->
            {#if point.amount > 0}
              <text
                x={x + barWidth / 2}
                y={108 - barHeight}
                text-anchor="middle"
                class="fill-slate-600 text-[9px] dark:fill-slate-300"
                font-size="9"
              >
                {point.amount >= 10000 ? Math.round(point.amount / 1000) + 'k' : point.amount}
              </text>
            {/if}

            <!-- month label -->
            <text
              x={x + barWidth / 2}
              y="130"
              text-anchor="middle"
              class="fill-slate-400 dark:fill-slate-500"
              font-size="8.5"
            >
              {point.label}
            </text>

            {#if lookbackMonths === 12 && (i === 0 || i === 11 || i % 3 === 0)}
              <text
                x={x + barWidth / 2}
                y="142"
                text-anchor="middle"
                class="fill-slate-300 dark:fill-slate-600"
                font-size="7"
              >
                {point.year.toString().slice(2)}
              </text>
            {/if}
          {/each}
        </svg>
      </div>
    {/if}

    <div class="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
      Bar berwarna lebih gelap = bulan berjalan. Semua nilai dalam {currency}.
    </div>
  </div>

  <!-- Category Breakdown + Donut -->
  <div class="grid gap-4 lg:grid-cols-5">
    <!-- Donut -->
    <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
      <div class="mb-2 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Breakdown per Kategori {categoryFilter !== 'all' ? `(${categoryFilter})` : ''}
      </div>

      {#if categoryBreakdown.items.length === 0}
        <div class="flex h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Tidak ada data untuk filter ini.
        </div>
      {:else}
        <div class="flex flex-col items-center pt-2">
          <svg width="168" height="168" viewBox="0 0 168 168" class="-mt-1">
            <!-- background track -->
            <circle
              cx="84"
              cy="84"
              r="62"
              fill="none"
              stroke="currentColor"
              stroke-width="26"
              class="text-slate-100 dark:text-slate-800"
            />

            <!-- segments -->
            {#each donutSegments as seg (seg.category)}
              <path
                d={donutArcPath(84, 84, 74, 50, seg.startAngle, seg.endAngle)}
                fill={seg.color}
                stroke="white"
                stroke-width="1"
                stroke-opacity="0.15"
                class="dark:stroke-slate-900"
              />
            {/each}

            <!-- center hole label -->
            <circle cx="84" cy="84" r="38" fill="currentColor" class="text-white dark:text-slate-900" />
            <text x="84" y="79" text-anchor="middle" class="fill-slate-500 text-[9px] dark:fill-slate-400" font-size="9">TOTAL</text>
            <text x="84" y="96" text-anchor="middle" class="fill-slate-900 font-semibold dark:fill-white" font-size="13">
              {formatCurrency(categoryTotal, currency).replace('Rp ', '')}
            </text>
          </svg>

          <!-- Legend -->
          <div class="mt-3 w-full space-y-1.5">
            {#each categoryBreakdown.items as item (item.category)}
              {@const pct = getCategoryPct(item.amount)}
              <div class="flex items-center gap-2 text-xs">
                <span class="h-2.5 w-2.5 flex-shrink-0 rounded" style="background:{CATEGORY_PALETTE[item.category]}"></span>
                <span class="flex-1 font-medium text-slate-700 dark:text-slate-200">{item.category}</span>
                <span class="tabular-nums text-slate-500 dark:text-slate-400">
                  {formatCurrency(item.amount, currency)} <span class="opacity-60">({pct}%)</span>
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Detailed category bars -->
    <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
      <div class="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Detail Kategori (Estimasi Bulanan)
      </div>

      {#if categoryBreakdown.items.length === 0}
        <div class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Tidak ada data.</div>
      {:else}
        <div class="space-y-3">
          {#each categoryBreakdown.items as cat (cat.category)}
            {@const pct = getCategoryPct(cat.amount)}
            <div>
              <div class="flex items-baseline justify-between text-sm">
                <span class="font-medium text-slate-800 dark:text-slate-100">{cat.category}</span>
                <span class="font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(cat.amount, currency)}
                  <span class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">({pct}%)</span>
                </span>
              </div>
              <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  class="h-2 rounded-full transition-all"
                  style="width: {pct}%; background-color: {CATEGORY_PALETTE[cat.category]}"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Top Expensive Subscriptions -->
  <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div class="mb-3 flex items-center justify-between">
      <div class="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Langganan Termahal (Estimasi Bulanan)
        {#if categoryFilter !== 'all'} — {categoryFilter}{/if}
      </div>
      <span class="text-[10px] text-slate-400 dark:text-slate-500">
        Menampilkan {topSubscriptions.length} teratas
      </span>
    </div>

    {#if topSubscriptions.length === 0}
      <div class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Tidak ada langganan aktif di filter ini.</div>
    {:else}
      <div class="divide-y divide-slate-100 dark:divide-slate-800">
        {#each topSubscriptions as { sub, monthly }, index (sub.id)}
          <div class="flex items-center gap-3 py-2.5 text-sm">
            <div class="w-6 flex-shrink-0 text-center font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">
              #{index + 1}
            </div>

            <div class="min-w-0 flex-1">
              <div class="font-medium text-slate-900 dark:text-white truncate">{sub.name}</div>
              <div class="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{sub.category}</span>
                <span class="opacity-40">•</span>
                <span>{billingLabel[sub.billingCycle]}</span>
                {#if sub.status !== 'active'}
                  <span class="rounded bg-slate-200 px-1.5 py-px text-[9px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">{statusLabel[sub.status]}</span>
                {/if}
              </div>
            </div>

            <div class="text-right">
              <div class="font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(monthly, currency)}
              </div>
              <div class="text-[10px] text-slate-400 dark:text-slate-500">
                {sub.price} {sub.currency} / {billingLabel[sub.billingCycle].toLowerCase()}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Spending Forecast -->
  <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div class="mb-2 flex items-center gap-2">
      <div class="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Proyeksi Pengeluaran (6 Bulan ke Depan)
      </div>
      <span class="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
        Estimasi
      </span>
    </div>

    <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
      Base: {formatCurrency(currentMonthSpend, currency)}/bulan.
      Tren dari data historis: <span class="font-medium">{forecast.method}</span>.
      Asumsi: tidak ada penambahan/pembatalan langganan baru.
    </p>

    {#if forecast.projections.length === 0}
      <div class="rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Tambahkan lebih banyak data historis atau langganan aktif untuk melihat proyeksi tren.
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {#each forecast.projections as proj, i (i)}
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div class="text-[10px] font-medium text-slate-500 dark:text-slate-400">{proj.month}</div>
            <div class="mt-1 font-semibold tabular-nums text-lg tracking-tight text-slate-900 dark:text-white">
              {formatCurrency(proj.monthly, currency)}
            </div>
            <div class="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              Kumulatif: {formatCurrency(proj.cumulative, currency)}
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/40">
        <div>
          <span class="text-slate-500 dark:text-slate-400">Total proyeksi 6 bulan:</span>
          <span class="ml-1 font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(forecast.totalNext6, currency)}
          </span>
        </div>
        <div class="text-[10px] text-slate-400 dark:text-slate-500">
          (Rata-rata {formatCurrency(Math.round(forecast.totalNext6 / 6), currency)}/bulan)
        </div>
      </div>
    {/if}
  </div>

  <!-- Export Reports -->
  <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div class="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
      Ekspor Laporan (CSV)
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <button
        type="button"
        onclick={exportMonthlySummaryCSV}
        class="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/60 active:scale-[0.985] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-800 dark:hover:bg-sky-950/30"
      >
        <div class="mt-0.5 text-sky-500 group-hover:text-sky-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <div class="font-medium text-slate-900 dark:text-white">Ringkasan Bulanan</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">Tren {lookbackMonths} bulan + delta saat ini</div>
        </div>
      </button>

      <button
        type="button"
        onclick={exportFullListCSV}
        class="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/60 active:scale-[0.985] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-800 dark:hover:bg-sky-950/30"
      >
        <div class="mt-0.5 text-sky-500 group-hover:text-sky-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <div class="font-medium text-slate-900 dark:text-white">Daftar Langganan Lengkap</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">
            Semua data + estimasi bulanan {categoryFilter !== 'all' ? '(filtered)' : ''}
          </div>
        </div>
      </button>

      <button
        type="button"
        onclick={exportForecastCSV}
        class="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/60 active:scale-[0.985] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-800 dark:hover:bg-sky-950/30"
      >
        <div class="mt-0.5 text-sky-500 group-hover:text-sky-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <div class="font-medium text-slate-900 dark:text-white">Proyeksi 6 Bulan</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">Bulan per bulan + kumulatif + slope</div>
        </div>
      </button>
    </div>

    <div class="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
      File CSV dapat dibuka di Excel, Google Sheets, atau Numbers. Semua perhitungan dilakukan di browser — data Anda tidak dikirim ke server.
    </div>
  </div>

  <!-- Empty state guidance -->
  {#if activeCount === 0}
    <div class="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      Belum ada langganan aktif. Tambahkan beberapa melalui Dashboard atau halaman Subscriptions untuk melihat analisis yang bermakna.
    </div>
  {/if}
</div>
