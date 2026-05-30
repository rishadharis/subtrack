<script lang="ts">
  /**
   * SubscriptionsList.svelte — Task 8: Subscriptions List View
   *
   * Full-featured, searchable, filterable, and actionable list of subscriptions.
   * - Instant search (name / notes / tags via store helper)
   * - Status filter (All/Active/Paused/Cancelled) as segmented buttons
   * - Category filter (All + all used categories including customs)
   * - Sorted by nextDueDate (soonest first) — always
   * - Mobile-first card rows with clear columns inside (Name+Category+Due, Price normalized, Status+Actions)
   * - Row actions: Edit (dispatches to parent modal in edit mode), Quick status toggle (Pause <-> Resume/Activate), Delete (with lightweight confirm)
   * - Urgency badges on due dates (overdue/urgent/soon/normal)
   * - Normalized monthly price display with original billing note when non-monthly
   * - Empty states for no data vs no filter matches
   * - Reactive via subscriptionStore runes; zero external state
   * - Fast, lightweight, fully local
   */

  import { createEventDispatcher } from 'svelte';
  import { subscriptionStore } from '$lib/stores/subscriptions.svelte';
  import { getAppData } from '$lib/storage';
  import type { Subscription, SubscriptionStatus, BillingCycle } from '$lib/types';
  import { DEFAULT_CATEGORIES, SUBSCRIPTION_STATUSES } from '$lib/types';

  const dispatch = createEventDispatcher<{ edit: Subscription }>();

  /* -------------------------------------------------------------------------------------------------
   * Local UI Filter State (runes — lightweight & instant)
   * ----------------------------------------------------------------------------------------------- */
  let searchTerm = $state('');
  let statusFilter = $state<'all' | SubscriptionStatus>('all');
  let categoryFilter = $state<'all' | string>('all');

  /* -------------------------------------------------------------------------------------------------
   * Reactive Data + Filtering + Sorting
   * ----------------------------------------------------------------------------------------------- */
  const allSubscriptions = $derived(subscriptionStore.subscriptions);
  const currency = $derived(getAppData().settings.defaultCurrency);

  const filteredAndSorted = $derived.by(() => {
    // Use any for opts to support runtime custom categories (store Category type is limited to defaults)
    const opts: any = {};

    if (statusFilter !== 'all') {
      opts.status = statusFilter;
    }
    if (categoryFilter !== 'all') {
      opts.category = categoryFilter;
    }
    const trimmed = searchTerm.trim();
    if (trimmed) {
      opts.searchTerm = trimmed;
    }

    const result = subscriptionStore.getFilteredSubscriptions(opts);

    // Always sort by next due date (soonest first). Overdue / past dates rise to top.
    return [...result].sort((a, b) => {
      const ta = a.nextDueDate ? Date.parse(a.nextDueDate + 'T00:00:00') : Infinity;
      const tb = b.nextDueDate ? Date.parse(b.nextDueDate + 'T00:00:00') : Infinity;
      return ta - tb;
    });
  });

  const totalCount = $derived(allSubscriptions.length);
  const filteredCount = $derived(filteredAndSorted.length);

  /* Unique categories for filter dropdown (defaults + any customs present in data) */
  const categoryOptions = $derived.by(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES as readonly string[]);
    for (const s of allSubscriptions) {
      if (s.category) set.add(s.category);
    }
    return ['all', ...Array.from(set).sort()];
  });

  /* Status filter options for segmented control */
  const statusOptions: Array<{ value: 'all' | SubscriptionStatus; label: string }> = [
    { value: 'all', label: 'Semua' },
    { value: 'active', label: 'Aktif' },
    { value: 'paused', label: 'Dijeda' },
    { value: 'cancelled', label: 'Dibatalkan' },
  ];

  /* -------------------------------------------------------------------------------------------------
   * Formatting & Calculation Helpers (duplicated from dashboard patterns for self-contained component)
   * ----------------------------------------------------------------------------------------------- */
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

  function formatDue(dateStr: string): string {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '—';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${MONTHS_ID[m - 1]}`;
  }

  function getDaysUntil(dueStr: string): number {
    if (!dueStr || !/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) return Infinity;
    const due = new Date(dueStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function formatRelative(days: number): string {
    if (!isFinite(days)) return '';
    if (days < 0) return `Terlewat ${Math.abs(days)} hari`;
    if (days === 0) return 'Hari ini';
    return `${days} hari lagi`;
  }

  function getUrgencyClasses(days: number): string {
    if (days < 0) {
      return 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400 border border-red-200 dark:border-red-900/60';
    }
    if (days <= 3) {
      return 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400 border border-red-200 dark:border-red-900/60';
    }
    if (days <= 7) {
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50';
    }
    if (days <= 14) {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50';
    }
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
  }

  function formatCurrency(amount: number, curr: string): string {
    const rounded = Math.round(amount);
    if (curr === 'IDR') {
      return 'Rp ' + rounded.toLocaleString('id-ID');
    }
    return rounded.toLocaleString() + ' ' + curr;
  }

  function getMonthlyEquivalent(price: number, billingCycle: BillingCycle): number {
    if (billingCycle === 'quarterly') return price / 3;
    if (billingCycle === 'yearly') return price / 12;
    // monthly + custom treated as monthly for MVP
    return price;
  }

  const billingShort: Record<BillingCycle, string> = {
    monthly: 'bln',
    quarterly: '3bln',
    yearly: 'thn',
    custom: 'kustom',
  };

  const statusLabels: Record<SubscriptionStatus, string> = {
    active: 'Aktif',
    paused: 'Dijeda',
    cancelled: 'Dibatalkan',
  };

  const statusBadgeClasses: Record<SubscriptionStatus, string> = {
    active:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50',
    paused:
      'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50',
    cancelled:
      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600',
  };

  /* -------------------------------------------------------------------------------------------------
   * Action Handlers (direct store calls — parent only handles edit modal)
   * ----------------------------------------------------------------------------------------------- */

  function handleEdit(sub: Subscription) {
    dispatch('edit', sub);
  }

  async function handleQuickToggle(sub: Subscription) {
    let nextStatus: SubscriptionStatus;
    if (sub.status === 'active') {
      nextStatus = 'paused';
    } else if (sub.status === 'paused') {
      nextStatus = 'active';
    } else {
      nextStatus = 'active';
    }

    try {
      await subscriptionStore.updateSubscription(sub.id, { status: nextStatus });
    } catch (err) {
      console.error('[SubscriptionsList] Quick toggle failed:', err);
      // Silent fail is acceptable for MVP (data layer already resilient)
    }
  }

  async function handleDelete(sub: Subscription) {
    const message = `Hapus langganan "${sub.name}"?\n\nTindakan ini permanen dan akan menghapus data dari file .subtrack Anda.`;
    if (!confirm(message)) return;

    try {
      const success = await subscriptionStore.deleteSubscription(sub.id);
      if (!success) {
        alert('Langganan tidak ditemukan atau sudah dihapus.');
      }
    } catch (err) {
      console.error('[SubscriptionsList] Delete failed:', err);
      alert('Gagal menghapus langganan. Silakan coba lagi.');
    }
  }

  function clearAllFilters() {
    searchTerm = '';
    statusFilter = 'all';
    categoryFilter = 'all';
  }

  /* -------------------------------------------------------------------------------------------------
   * Derived toggle button title + icon hint
   * ----------------------------------------------------------------------------------------------- */
  function getToggleTitle(status: SubscriptionStatus): string {
    if (status === 'active') return 'Jeda (pause) langganan ini';
    if (status === 'paused') return 'Lanjutkan (resume) langganan ini';
    return 'Aktifkan kembali langganan ini';
  }
</script>

<div class="space-y-4">
  <!-- Search + Filters -->
  <div class="space-y-3">
    <!-- Search input (lightweight instant filter) -->
    <div class="relative">
      <div class="pointer-events-none absolute left-4 top-3.5 text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Cari nama, catatan, atau tag..."
        class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-9 text-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
        aria-label="Cari langganan"
      />
      {#if searchTerm}
        <button
          type="button"
          onclick={() => (searchTerm = '')}
          class="absolute right-3 top-2.5 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200 dark:hover:bg-slate-800"
          aria-label="Hapus pencarian"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6h12v12" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
      <!-- Status segmented control (mobile friendly) -->
      <div
        class="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white p-0.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        role="group"
        aria-label="Filter status"
      >
        {#each statusOptions as opt (opt.value)}
          <button
            type="button"
            onclick={() => (statusFilter = opt.value)}
            class="px-3.5 py-1 text-xs font-semibold transition active:scale-[0.985] {statusFilter === opt.value
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'} rounded-[9px]"
          >
            {opt.label}
          </button>
        {/each}
      </div>

      <!-- Category -->
      <select
        bind:value={categoryFilter}
        class="min-w-[148px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        aria-label="Filter kategori"
      >
        {#each categoryOptions as cat (cat)}
          <option value={cat}>
            {cat === 'all' ? 'Semua Kategori' : cat}
          </option>
        {/each}
      </select>

      {#if searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'}
        <button
          type="button"
          onclick={clearAllFilters}
          class="ml-1 text-xs font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
        >
          Reset semua filter
        </button>
      {/if}
    </div>
  </div>

  <!-- Results summary -->
  <div class="flex items-baseline justify-between text-sm">
    <div class="font-medium text-slate-700 dark:text-slate-200">
      {filteredCount}
      <span class="font-normal text-slate-500 dark:text-slate-400">
        {filteredCount === 1 ? 'langganan' : 'langganan'}
        {#if filteredCount !== totalCount}
          <span class="text-slate-400">dari {totalCount}</span>
        {/if}
      </span>
    </div>
    <div class="hidden text-[11px] text-slate-400 sm:block">Diurutkan berdasarkan jatuh tempo terdekat</div>
  </div>

  <!-- The List (cards — excellent on mobile + desktop) -->
  {#if filteredAndSorted.length === 0}
    <!-- Empty state -->
    <div
      class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900"
    >
      {#if totalCount === 0}
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2" />
          </svg>
        </div>
        <p class="font-medium text-slate-700 dark:text-slate-200">Belum ada langganan</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tekan tombol <span class="font-semibold">+ Tambah Langganan</span> di atas untuk memulai.
        </p>
      {:else}
        <p class="font-medium text-slate-700 dark:text-slate-200">Tidak ada hasil yang cocok</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Coba ubah kata kunci atau filter Anda.</p>
        <button
          type="button"
          onclick={clearAllFilters}
          class="mt-4 inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Hapus semua filter
        </button>
      {/if}
    </div>
  {:else}
    <div class="space-y-2.5">
      {#each filteredAndSorted as sub (sub.id)}
        {@const daysUntil = getDaysUntil(sub.nextDueDate)}
        {@const monthlyPrice = getMonthlyEquivalent(sub.price, sub.billingCycle)}
        <div
          class="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:gap-4"
        >
          <!-- Core identity + due -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{sub.name}</span>
              <span
                class="shrink-0 rounded-full bg-slate-100 px-2 py-px text-[10px] font-semibold tracking-tight text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {sub.category}
              </span>
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span class="font-medium tabular-nums text-slate-600 dark:text-slate-300">
                {formatDue(sub.nextDueDate)}
              </span>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold {getUrgencyClasses(daysUntil)}"
              >
                {formatRelative(daysUntil)}
              </span>
            </div>

            {#if sub.notes}
              <div class="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                {sub.notes}
              </div>
            {/if}
          </div>

          <!-- Price (normalized monthly) -->
          <div class="shrink-0 text-left sm:w-32 sm:text-right">
            <div class="font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(monthlyPrice, currency)}
            </div>
            <div class="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              per bulan
              {#if sub.billingCycle !== 'monthly'}
                <span class="opacity-70"> • {formatCurrency(sub.price, currency)} / {billingShort[sub.billingCycle]}</span>
              {/if}
            </div>
          </div>

          <!-- Status + Billing cycle + Actions -->
          <div class="flex shrink-0 items-center justify-between gap-3 sm:ml-auto sm:gap-4">
            <div class="flex items-center gap-x-2">
              <!-- Status badge -->
              <span
                class="rounded-full px-2.5 py-px text-[10px] font-bold tracking-wide {statusBadgeClasses[sub.status]}"
              >
                {statusLabels[sub.status]}
              </span>

              <!-- Billing cycle (subtle) -->
              <span
                class="hidden rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.5px] text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline"
              >
                {billingShort[sub.billingCycle]}
              </span>
            </div>

            <!-- Row actions -->
            <div
              class="flex items-center gap-px border-l border-slate-200 pl-2 dark:border-slate-700 sm:border-l-0 sm:pl-1"
            >
              <!-- Edit -->
              <button
                type="button"
                onclick={() => handleEdit(sub)}
                class="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600 active:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-sky-400"
                title="Edit langganan"
                aria-label="Edit {sub.name}"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.25">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>

              <!-- Quick status toggle (Pause / Resume) -->
              <button
                type="button"
                onclick={() => handleQuickToggle(sub)}
                class="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600 active:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-sky-400"
                title={getToggleTitle(sub.status)}
                aria-label={getToggleTitle(sub.status)}
              >
                {#if sub.status === 'active'}
                  <!-- Pause icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 9v2m4-2v2m-8 8h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 9v2m4-2v2" />
                  </svg>
                {:else}
                  <!-- Resume / play icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                {/if}
              </button>

              <!-- Delete -->
              <button
                type="button"
                onclick={() => handleDelete(sub)}
                class="rounded-lg p-2 text-red-500/80 transition hover:bg-red-50 hover:text-red-600 active:bg-red-100 dark:hover:bg-red-950/40 dark:text-red-400/80 dark:hover:text-red-400"
                title="Hapus langganan"
                aria-label="Hapus {sub.name}"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.25">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19 7l-.595 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.595-1.858L5 7m5 4v6m4-6v6m1-10V9a1 1 0 00-1-1h-4a1 1 0 00-1 1v1M9 7h6"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Subtle footer -->
  <p class="pt-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
    Perubahan otomatis tersimpan ke file .subtrack Anda
  </p>
</div>
