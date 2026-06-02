<script lang="ts">
  /**
   * RemindersView.svelte — Task 9: Dedicated Reminders screen + .ics Export (Critical)
   *
   * - Shows ONLY active subscriptions due within the next 30 days (incl. today + overdue).
   * - Sorted by urgency (overdue first, then soonest due date).
   * - Strong visual urgency treatment using color-coded badges and borders:
   *     Terlewat / ≤3 hari → intense red
   *     4-7 hari           → orange
   *     8-14 hari          → amber
   *     15-30 hari         → calm blue/gray
   * - "Hari ini", "Dalam X hari", "Terlewat X hari" labels (Bahasa Indonesia).
   * - Per-item checkboxes for granular selection.
   * - "Pilih Semua" / "Bersihkan Pilihan" quick actions.
   * - LARGE, prominent primary "Export ke Kalender (.ics)" button.
   * - Uses pure client-side icsGenerator (no libs) → real downloadable .ics with RRULE recurrence.
   * - Supports "All upcoming" (via Select All) or any subset of selected items.
   * - Transient success feedback after successful export.
   * - Fully reactive via subscriptionStore + Svelte 5 runes.
   * - Self-contained date helpers (consistent with Dashboard/UpcomingList/SubscriptionsList).
   * - Excellent mobile + desktop experience. Dark mode native.
   *
   * This surface exists to give users a trustworthy "pengingat jatuh tempo" even before
   * push notifications (future task) are implemented.
   */

  import { subscriptionStore } from '$lib/stores/subscriptions.svelte';
  import { getAppData } from '$lib/storage';
  import type { Subscription, BillingCycle } from '$lib/types';
  import {
    generateIcs,
    downloadIcs,
    subscriptionsToIcsEvents,
    makeIcsFilename,
    type IcsSubscription,
  } from '$lib/utils/icsGenerator';

  /* -------------------------------------------------------------------------------------------------
   * Reactive data from store (only active subscriptions are "due reminders")
   * ----------------------------------------------------------------------------------------------- */
  const allSubscriptions = $derived(subscriptionStore.subscriptions);
  const currency = $derived(getAppData().settings.defaultCurrency);

  /* -------------------------------------------------------------------------------------------------
   * Date helpers (duplicated from established patterns for component self-containment)
   * These are the single source of truth for "within 30 days" + urgency used across the app.
   * ----------------------------------------------------------------------------------------------- */
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'] as const;

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

  function getUrgency(days: number): 'overdue' | 'urgent' | 'soon' | 'normal' {
    if (days < 0) return 'overdue';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'soon';
    if (days <= 30) return 'normal';
    return 'normal';
  }

  function formatRelative(days: number): string {
    if (!isFinite(days)) return '';
    if (days < 0) return `Terlewat ${Math.abs(days)} hari`;
    if (days === 0) return 'Hari ini';
    return `Dalam ${days} hari`;
  }

  function urgencyClasses(days: number): string {
    const u = getUrgency(days);
    if (u === 'overdue') {
      return 'bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800';
    }
    if (u === 'urgent') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-300 border-red-200 dark:border-red-800/60';
    }
    if (u === 'soon') {
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300 border-orange-200 dark:border-orange-800/50';
    }
    return 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 border-sky-200 dark:border-sky-800/40';
  }

  function urgencyDot(days: number): string {
    const u = getUrgency(days);
    if (u === 'overdue' || u === 'urgent') return 'bg-red-500';
    if (u === 'soon') return 'bg-orange-500';
    return 'bg-sky-500';
  }

  /* -------------------------------------------------------------------------------------------------
   * Core derived list: active subscriptions due within 30 days, sorted by urgency (soonest first)
   * ----------------------------------------------------------------------------------------------- */
  const upcomingReminders = $derived.by(() => {
    const filtered = allSubscriptions
      .filter((s) => {
        if (s.status !== 'active') return false;
        const d = getDaysUntil(s.nextDueDate);
        return isFinite(d) && d <= 30;
      })
      .sort((a, b) => {
        const da = getDaysUntil(a.nextDueDate);
        const db = getDaysUntil(b.nextDueDate);
        return da - db; // negative (overdue) first, then 0, 1, 2...
      });

    return filtered;
  });

  /* -------------------------------------------------------------------------------------------------
   * Selection state (checkboxes) — supports "All upcoming" via Pilih Semua or granular picks
   * ----------------------------------------------------------------------------------------------- */
  let selectedIds = $state<string[]>([]);

  // Keep selection valid when data changes (remove deleted/paused items, keep user choices)
  $effect(() => {
    const validIds = new Set(upcomingReminders.map((s) => s.id));
    const next = selectedIds.filter((id) => validIds.has(id));
    // If nothing selected yet but we have items, default to selecting all (great UX for export)
    if (next.length === 0 && upcomingReminders.length > 0 && selectedIds.length === 0) {
      selectedIds = upcomingReminders.map((s) => s.id);
    } else if (next.length !== selectedIds.length) {
      selectedIds = next;
    }
  });

  const selectedCount = $derived(selectedIds.length);
  const totalUpcoming = $derived(upcomingReminders.length);

  function toggleSelect(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((x) => x !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
  }

  function selectAll() {
    selectedIds = upcomingReminders.map((s) => s.id);
  }

  function clearSelection() {
    selectedIds = [];
  }

  function isSelected(id: string): boolean {
    return selectedIds.includes(id);
  }

  /* -------------------------------------------------------------------------------------------------
   * Export logic (uses the generator — pure client-side, real .ics download)
   * ----------------------------------------------------------------------------------------------- */
  let isExporting = $state(false);
  let exportSuccessMessage = $state<string | null>(null);
  let exportError = $state<string | null>(null);

  async function handleExport() {
    if (selectedCount === 0) {
      exportError = 'Pilih minimal 1 langganan untuk diexport.';
      setTimeout(() => (exportError = null), 2800);
      return;
    }

    const toExport = upcomingReminders.filter((s) => selectedIds.includes(s.id));
    if (toExport.length === 0) return;

    isExporting = true;
    exportError = null;

    try {
      const icsEvents = subscriptionsToIcsEvents(toExport);
      const icsContent = generateIcs(icsEvents, {
        calendarName: 'Subtrack - Jatuh Tempo Langganan',
      });

      const filename = makeIcsFilename('subtrack-pengingat');
      downloadIcs(icsContent, filename);

      const count = toExport.length;
      exportSuccessMessage = `${count} event berhasil diexport ke ${filename}. Buka file tersebut di Google Calendar, Outlook, atau Apple Calendar.`;

      // Auto-hide success after a few seconds
      setTimeout(() => {
        exportSuccessMessage = null;
      }, 5200);
    } catch (err) {
      console.error('[RemindersView] .ics export failed:', err);
      exportError = 'Gagal membuat file .ics. Silakan coba lagi.';
      setTimeout(() => (exportError = null), 3200);
    } finally {
      isExporting = false;
    }
  }

  /* -------------------------------------------------------------------------------------------------
   * Formatting helpers
   * ----------------------------------------------------------------------------------------------- */
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
    return price;
  }

  const billingLabel: Record<BillingCycle, string> = {
    monthly: 'Bulanan',
    quarterly: 'Kuartalan',
    yearly: 'Tahunan',
    custom: 'Kustom',
  };
</script>

<div class="space-y-6">
  <!-- Internal header for the Reminders surface -->
  <div>
    <div class="flex items-center gap-3">
      <div class="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.25">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">Pengingat Jatuh Tempo</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Langganan aktif yang jatuh tempo dalam 30 hari. Diurutkan dari paling mendesak.
        </p>
      </div>
    </div>
  </div>

  <!-- Status summary -->
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
    <div>
      <span class="font-semibold tabular-nums text-slate-900 dark:text-white">{totalUpcoming}</span>
      <span class="text-slate-600 dark:text-slate-400"> langganan mendesak</span>
    </div>
    {#if totalUpcoming > 0}
      <div class="h-3 w-px bg-slate-200 dark:bg-slate-700"></div>
      <div class="text-slate-500 dark:text-slate-400">
        {selectedCount} dipilih
      </div>
    {/if}
  </div>

  <!-- Selection toolbar -->
  {#if totalUpcoming > 0}
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onclick={selectAll}
        disabled={selectedCount === totalUpcoming}
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Pilih Semua
      </button>

      <button
        type="button"
        onclick={clearSelection}
        disabled={selectedCount === 0}
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Bersihkan Pilihan
      </button>

      <div class="ml-auto text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
        Pilih item untuk export selektif, atau gunakan "Pilih Semua" untuk semua yang akan datang
      </div>
    </div>
  {/if}

  <!-- The Reminders List -->
  {#if totalUpcoming === 0}
    <!-- Beautiful empty state -->
    <div class="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 01-9 9 9 9 0 01-9-9 9 9 0 019-9 9 9 0 019 9z" />
        </svg>
      </div>
      <p class="text-lg font-semibold text-slate-800 dark:text-slate-100">Semua aman!</p>
      <p class="mt-2 max-w-md mx-auto text-sm text-slate-600 dark:text-slate-400">
        Tidak ada langganan aktif yang jatuh tempo dalam 30 hari ke depan.<br />
        Pantau terus di halaman ini — data selalu up-to-date dari file .subtrack Anda.
      </p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each upcomingReminders as sub (sub.id)}
        {@const days = getDaysUntil(sub.nextDueDate)}
        {@const monthly = getMonthlyEquivalent(sub.price, sub.billingCycle)}
        {@const isChecked = isSelected(sub.id)}

        <label
          class="group flex cursor-pointer flex-col gap-3 rounded-2xl border bg-white p-4 transition active:scale-[0.995] sm:flex-row sm:items-center sm:gap-4 dark:bg-slate-900 {isChecked
            ? 'border-sky-300 ring-1 ring-sky-200 dark:border-sky-700 dark:ring-sky-900/40'
            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}"
        >
          <!-- Checkbox + visual urgency indicator -->
          <div class="flex items-start gap-3 sm:items-center">
            <input
              type="checkbox"
              checked={isChecked}
              onchange={() => toggleSelect(sub.id)}
              class="mt-0.5 h-5 w-5 cursor-pointer accent-sky-600 rounded border-slate-300 dark:border-slate-600"
              aria-label="Pilih {sub.name} untuk diexport"
            />
            <div class="mt-0.5 hidden h-2.5 w-2.5 flex-shrink-0 rounded-full sm:block {urgencyDot(days)}"></div>
          </div>

          <!-- Main content -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{sub.name}</span>
              <span class="shrink-0 rounded-full bg-slate-100 px-2 py-px text-[10px] font-semibold tracking-tight text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {sub.category}
              </span>
              {#if sub.status !== 'active'}
                <span class="shrink-0 rounded px-1.5 py-px text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">Dijeda</span>
              {/if}
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
              <span class="font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {formatDue(sub.nextDueDate)}
              </span>

              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide {urgencyClasses(days)}"
              >
                {formatRelative(days)}
              </span>

              <span class="text-xs text-slate-400 dark:text-slate-500">• {billingLabel[sub.billingCycle]}</span>
            </div>

            {#if sub.notes}
              <div class="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                {sub.notes}
              </div>
            {/if}
          </div>

          <!-- Price block -->
          <div class="shrink-0 text-left tabular-nums sm:w-36 sm:text-right">
            <div class="font-semibold text-slate-900 dark:text-white">
              {formatCurrency(monthly, currency)}
            </div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">
              per bulan
              {#if sub.billingCycle !== 'monthly'}
                <span class="opacity-70">• {formatCurrency(sub.price, currency)} / {billingLabel[sub.billingCycle]}</span>
              {/if}
            </div>
          </div>
        </label>
      {/each}
    </div>
  {/if}

  <!-- PROMINENT EXPORT SECTION (the star of Task 9) -->
  <div class="pt-2">
    <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="max-w-md">
          <div class="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">
            Export ke Kalender (.ics)
          </div>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Unduh file kalender standar dengan event berulang otomatis sesuai siklus tagihan.
            Kompatibel dengan Google Calendar, Outlook, Apple Calendar, dan lainnya.
          </p>
          {#if selectedCount > 0}
            <p class="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Akan mengekspor {selectedCount} dari {totalUpcoming} pengingat.
            </p>
          {/if}
        </div>

        <button
          type="button"
          onclick={handleExport}
          disabled={isExporting || selectedCount === 0}
          class="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-7 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-emerald-700 active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-emerald-400 dark:bg-emerald-500 dark:hover:bg-emerald-600 sm:w-auto"
        >
          {#if isExporting}
            <svg class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>Menyiapkan file...</span>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.25">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Export ke Kalender (.ics)</span>
          {/if}
        </button>
      </div>

      <!-- Feedback messages -->
      {#if exportSuccessMessage}
        <div class="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7" />
          </svg>
          <div>{exportSuccessMessage}</div>
        </div>
      {/if}

      {#if exportError}
        <div class="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {exportError}
        </div>
      {/if}

      <div class="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
        Event menggunakan tanggal jatuh tempo sebagai anchor + RRULE berulang. Alarm 1 hari sebelumnya disertakan.
      </div>
    </div>
  </div>

  <!-- Footer hint -->
  <p class="text-center text-[10px] text-slate-400 dark:text-slate-500">
    Data diambil secara real-time dari file .subtrack lokal Anda. Perubahan status di halaman Subscriptions langsung terlihat di sini.
  </p>
</div>
