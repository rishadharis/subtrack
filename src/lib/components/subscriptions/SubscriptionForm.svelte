<script lang="ts">
  /**
   * SubscriptionForm.svelte — Task 7: Fast Subscription Add/Edit Form
   *
   * - Supports Add and Edit modes
   * - All fields from Subscription model
   * - Smart nextDueDate: auto-calcs from startDate + billingCycle (via store helper)
   *   but fully allows manual override with clear UX + recalculate button
   * - Category: select from DEFAULT + custom free-text support
   * - Tags: lightweight chip + text entry (Enter or comma to add, removable)
   * - Minimal validation (name + price required)
   * - Clean, fast, native-feeling inputs. Indonesian labels for consistency.
   * - Dispatches 'save' (with resulting Subscription) and 'cancel'
   * - Calls store directly for persistence (add/update with override handling)
   */

  import { createEventDispatcher } from 'svelte';
  import type {
    Subscription,
    BillingCycle,
    SubscriptionStatus,
    Category,
  } from '$lib/types';
  import {
    DEFAULT_CATEGORIES,
    BILLING_CYCLES,
    SUBSCRIPTION_STATUSES,
  } from '$lib/types';
  import { subscriptionStore } from '$lib/stores/subscriptions.svelte';
  import { getAppData, subscribeToStorageChanges } from '$lib/storage';

  interface Props {
    /** 'add' creates new via store.addSubscription; 'edit' pre-fills + uses update */
    mode?: 'add' | 'edit';
    /** Full subscription record required when mode === 'edit' */
    subscription?: Subscription;
  }

  const dispatch = createEventDispatcher<{
    save: Subscription;
    cancel: void;
  }>();

  let { mode = 'add', subscription }: Props = $props();

  /* -----------------------------------------------------------------------------------------------
   * Internal Form State (lightweight, fast)
   * --------------------------------------------------------------------------------------------- */

  let form = $state({
    name: '',
    price: 0,
    currency: 'IDR',
    billingCycle: 'monthly' as BillingCycle,
    startDate: '',
    nextDueDate: '',
    status: 'active' as SubscriptionStatus,
    autoRenew: true,
    notes: '',
    url: '',
  });

  // Category handling (supports custom beyond DEFAULT_CATEGORIES)
  let categoryValue = $state<string>('Streaming');
  let customCategory = $state<string>('');

  // Tags (array of strings) + lightweight input buffer for adding
  let tags = $state<string[]>([]);
  let tagInput = $state<string>('');

  // Smart nextDueDate override tracking
  let isNextDueOverridden = $state(false);

  // UI state
  let isSubmitting = $state(false);
  let errors = $state<Record<string, string>>({});

  /* -----------------------------------------------------------------------------------------------
   * Helpers: Date calculation (reuse authoritative store function)
   * --------------------------------------------------------------------------------------------- */

  function safeCalculateNextDue(start: string, cycle: BillingCycle): string {
    try {
      return subscriptionStore.calculateNextDueDate(start, cycle);
    } catch {
      // Fallback: 1 month later (same day clamped)
      const d = new Date(start + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 10);
    }
  }

  function updateNextDueIfNotOverridden() {
    if (isNextDueOverridden) return;
    if (!form.startDate || !form.billingCycle) return;
    form.nextDueDate = safeCalculateNextDue(form.startDate, form.billingCycle);
  }

  /** Force-recalculate (user action or initial) and clear override flag */
  function recalculateNextDue() {
    if (!form.startDate || !form.billingCycle) return;
    form.nextDueDate = safeCalculateNextDue(form.startDate, form.billingCycle);
    isNextDueOverridden = false;
  }

  /* -----------------------------------------------------------------------------------------------
   * Category helpers — Task 13: now live from settings (custom categories appear immediately)
   * --------------------------------------------------------------------------------------------- */

  let catVersion = $state(0);
  // Subscribe while form is mounted so custom categories added in Settings become selectable
  $effect(() => {
    const unsub = subscribeToStorageChanges(() => {
      catVersion = catVersion + 1;
    });
    return unsub;
  });

  const masterCategories = $derived.by(() => {
    catVersion; // trigger on external updates (import/reset etc)
    const fromSettings = getAppData().settings.categories;
    // Dedupe + preserve order (settings first, then any legacy from DEFAULT not present)
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of fromSettings) {
      if (!seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        list.push(c);
      }
    }
    for (const c of DEFAULT_CATEGORIES) {
      if (!seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        list.push(c);
      }
    }
    return list;
  });

  function handleCategoryChange() {
    if (categoryValue !== '__custom') {
      customCategory = '';
    }
  }

  function getFinalCategory(): string {
    if (categoryValue === '__custom') {
      return customCategory.trim();
    }
    return categoryValue;
  }

  /* -----------------------------------------------------------------------------------------------
   * Lightweight Tag Chip Input
   * --------------------------------------------------------------------------------------------- */

  function addTagFromInput() {
    const value = tagInput.trim();
    if (!value) return;
    // Support comma in the input buffer too (split)
    const candidates = value.includes(',') ? value.split(',') : [value];
    for (let c of candidates) {
      const t = c.trim();
      if (t && !tags.includes(t)) {
        tags = [...tags, t];
      }
    }
    tagInput = '';
  }

  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagFromInput();
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      // Convenience: backspace removes last chip when input empty
      tags = tags.slice(0, -1);
    }
  }

  function handleTagBlur() {
    addTagFromInput();
  }

  /* -----------------------------------------------------------------------------------------------
   * Initialization (runs on component creation for current props)
   * --------------------------------------------------------------------------------------------- */

  function initializeForm() {
    errors = {};
    isNextDueOverridden = false;

    if (mode === 'edit' && subscription) {
      // Prefill everything from existing record
      form = {
        name: subscription.name ?? '',
        price: subscription.price ?? 0,
        currency: subscription.currency ?? 'IDR',
        billingCycle: subscription.billingCycle ?? 'monthly',
        startDate: subscription.startDate ?? '',
        nextDueDate: subscription.nextDueDate ?? '',
        status: subscription.status ?? 'active',
        autoRenew: subscription.autoRenew ?? true,
        notes: subscription.notes ?? '',
        url: subscription.url ?? '',
      };

      tags = subscription.tags ? [...subscription.tags] : [];

      // Category (may be custom / not in DEFAULT) — Task 13 live support
      const currentCats = getAppData().settings.categories;
      const isKnown = currentCats.some((c) => c.toLowerCase() === (subscription.category || '').toLowerCase());
      if (isKnown) {
        categoryValue = subscription.category;
        customCategory = '';
      } else {
        categoryValue = '__custom';
        customCategory = subscription.category ?? '';
      }

      // Detect if current nextDueDate differs from what would be auto-calculated
      try {
        const wouldBe = safeCalculateNextDue(subscription.startDate, subscription.billingCycle);
        isNextDueOverridden = subscription.nextDueDate !== wouldBe;
      } catch {
        isNextDueOverridden = true;
      }
    } else {
      // Fresh Add defaults — fast input friendly
      const today = new Date().toISOString().slice(0, 10);
      form = {
        name: '',
        price: 0,
        currency: 'IDR',
        billingCycle: 'monthly',
        startDate: today,
        nextDueDate: '',
        status: 'active',
        autoRenew: true,
        notes: '',
        url: '',
      };

      tags = [];
      tagInput = '';
      categoryValue = 'Streaming';
      customCategory = '';
      isNextDueOverridden = false;

      // Seed smart nextDueDate immediately
      updateNextDueIfNotOverridden();
    }
  }

  // Run once on mount / when the form instance is created for this open
  initializeForm();

  /* -----------------------------------------------------------------------------------------------
   * Validation (lightweight, fast feedback)
   * --------------------------------------------------------------------------------------------- */

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    const name = form.name.trim();
    if (!name) {
      newErrors.name = 'Nama wajib diisi';
    }

    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      newErrors.price = 'Harga harus angka ≥ 0';
    }

    const finalCat = getFinalCategory();
    if (!finalCat) {
      newErrors.category = 'Kategori wajib diisi (pilih atau ketik custom)';
    }

    if (!form.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) {
      newErrors.startDate = 'Tanggal mulai tidak valid';
    }

    if (!form.nextDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.nextDueDate)) {
      newErrors.nextDueDate = 'Tanggal jatuh tempo tidak valid';
    }

    if (!form.currency.trim()) {
      newErrors.currency = 'Mata uang wajib';
    }

    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  /* -----------------------------------------------------------------------------------------------
   * Save / Cancel handlers (end-to-end with store)
   * --------------------------------------------------------------------------------------------- */

  async function handleSubmit(e?: SubmitEvent) {
    e?.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    const priceNum = Number(form.price);
    const finalCategory = getFinalCategory();
    const trimmedTags = tags.map((t) => t.trim()).filter(Boolean);

    // Clean optional fields (store accepts undefined)
    const notes = form.notes?.trim() || undefined;
    const url = form.url?.trim() || undefined;

    isSubmitting = true;
    errors = {};

    try {
      if (mode === 'add') {
        // Add path: store always computes nextDue from start+billing.
        // We add first, then patch override if user set a different nextDueDate.
        const addInput = {
          name: form.name.trim(),
          category: finalCategory as Category, // runtime allows custom strings
          price: priceNum,
          currency: form.currency.trim().toUpperCase(),
          billingCycle: form.billingCycle,
          startDate: form.startDate,
          status: form.status,
          autoRenew: !!form.autoRenew,
          notes,
          url,
          tags: trimmedTags.length > 0 ? trimmedTags : undefined,
        };

        const added = await subscriptionStore.addSubscription(addInput);

        // Respect manual nextDueDate override (if different from computed)
        const computed = safeCalculateNextDue(added.startDate, added.billingCycle);
        if (form.nextDueDate && form.nextDueDate !== computed) {
          await subscriptionStore.updateSubscription(added.id, {
            nextDueDate: form.nextDueDate,
          });
        }

        // Re-fetch the (possibly patched) record for the event
        const finalSub =
          subscriptionStore.subscriptions.find((s) => s.id === added.id) ?? added;

        dispatch('save', finalSub);
      } else {
        // Edit path
        if (!subscription) {
          dispatch('cancel');
          return;
        }

        const updates: Partial<Omit<Subscription, 'id' | 'createdAt'>> = {
          name: form.name.trim(),
          category: finalCategory as Category,
          price: priceNum,
          currency: form.currency.trim().toUpperCase(),
          billingCycle: form.billingCycle,
          startDate: form.startDate,
          nextDueDate: form.nextDueDate, // always pass — store respects explicit value
          status: form.status,
          autoRenew: !!form.autoRenew,
          notes,
          url,
          tags: trimmedTags.length > 0 ? trimmedTags : undefined,
        };

        await subscriptionStore.updateSubscription(subscription.id, updates);

        // Find the updated record
        const updated =
          subscriptionStore.subscriptions.find((s) => s.id === subscription.id) ??
          (subscription as Subscription);

        dispatch('save', updated);
      }
    } catch (err) {
      console.error('[SubscriptionForm] Save failed:', err);
      errors = { _form: 'Gagal menyimpan. Coba lagi.' };
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    dispatch('cancel');
  }

  /* -----------------------------------------------------------------------------------------------
   * Derived labels & UI text (Task 13: use $derived to avoid Svelte state capture warnings)
   * --------------------------------------------------------------------------------------------- */

  const title = $derived(mode === 'add' ? 'Tambah Langganan Baru' : 'Edit Langganan');
  const submitLabel = $derived(mode === 'add' ? 'Tambah Langganan' : 'Simpan Perubahan');
  const submitIcon = $derived(
    mode === 'add'
      ? 'M12 5v14M5 12h14'
      : 'M5 13l4 4L19 7'
  );

  // For selects we render friendly Indonesian labels
  const billingLabels: Record<BillingCycle, string> = {
    monthly: 'Bulanan',
    quarterly: 'Kuartalan (3 bulan)',
    yearly: 'Tahunan',
    custom: 'Kustom (perkiraan 1 bulan)',
  };

  const statusLabels: Record<SubscriptionStatus, string> = {
    active: 'Aktif',
    paused: 'Dijeda',
    cancelled: 'Dibatalkan',
  };
</script>

<!-- 
  The form renders as a self-contained panel.
  Parent (App.svelte modal) supplies the dialog chrome / backdrop.
-->
<div class="space-y-5">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h3 class="text-xl font-semibold tracking-tighter text-slate-900 dark:text-white">
        {title}
      </h3>
      <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {mode === 'add'
          ? 'Isi data langganan. Tanggal jatuh tempo dihitung otomatis.'
          : 'Perbarui detail langganan. Perubahan langsung tersimpan.'}
      </p>
    </div>
  </div>

  <form onsubmit={handleSubmit} class="space-y-5" autocomplete="off">
    <!-- Core: Name (most important, first) -->
    <div>
      <label for="sub-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        Nama Langganan <span class="text-red-500">*</span>
      </label>
      <input
        id="sub-name"
        type="text"
        bind:value={form.name}
        placeholder="Contoh: Netflix, ChatGPT Plus, Spotify"
        class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        required
        oninput={() => { if (errors.name) errors = { ...errors, name: '' }; }}
      />
      {#if errors.name}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
      {/if}
    </div>

    <!-- Category + Custom -->
    <div>
      <label for="sub-category" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Kategori</label>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,auto]">
        <select
          id="sub-category"
          bind:value={categoryValue}
          onchange={handleCategoryChange}
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          {#each masterCategories as cat (cat)}
            <option value={cat}>{cat}</option>
          {/each}
          <option value="__custom">Lainnya (ketik manual)</option>
        </select>

        {#if categoryValue === '__custom'}
          <input
            type="text"
            bind:value={customCategory}
            placeholder="Nama kategori custom"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:w-56"
            oninput={() => { if (errors.category) errors = { ...errors, category: '' }; }}
          />
        {/if}
      </div>
      {#if errors.category}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{errors.category}</p>
      {/if}
    </div>

    <!-- Price + Currency (row) -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <div class="sm:col-span-3">
        <label for="sub-price" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Harga <span class="text-red-500">*</span>
        </label>
        <div class="relative">
          <input
            id="sub-price"
            type="number"
            step="any"
            min="0"
            bind:value={form.price}
            placeholder="0"
            class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] tabular-nums focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            oninput={() => { if (errors.price) errors = { ...errors, price: '' }; }}
          />
        </div>
        {#if errors.price}
          <p class="mt-1 text-xs text-red-600 dark:text-red-400">{errors.price}</p>
        {/if}
      </div>

      <div class="sm:col-span-2">
        <label for="sub-currency" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Mata Uang
        </label>
        <input
          id="sub-currency"
          type="text"
          bind:value={form.currency}
          placeholder="IDR"
          class="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase tracking-widest focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          maxlength="4"
          oninput={() => { if (errors.currency) errors = { ...errors, currency: '' }; }}
        />
        <p class="mt-0.5 text-[10px] text-slate-400">Default IDR</p>
      </div>
    </div>

    <!-- Billing Cycle + Dates -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <!-- Billing -->
      <div>
        <label for="sub-billing" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Siklus Penagihan
        </label>
        <select
          id="sub-billing"
          bind:value={form.billingCycle}
          onchange={() => updateNextDueIfNotOverridden()}
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          {#each BILLING_CYCLES as cycle}
            <option value={cycle}>{billingLabels[cycle]}</option>
          {/each}
        </select>
      </div>

      <!-- Start Date -->
      <div>
        <label for="sub-start" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Tanggal Mulai
        </label>
        <input
          id="sub-start"
          type="date"
          bind:value={form.startDate}
          onchange={() => updateNextDueIfNotOverridden()}
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        {#if errors.startDate}
          <p class="mt-1 text-xs text-red-600 dark:text-red-400">{errors.startDate}</p>
        {/if}
      </div>
    </div>

    <!-- Next Due Date (smart + overrideable) -->
    <div>
      <div class="mb-1.5 flex items-center justify-between">
        <label for="sub-due" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tanggal Jatuh Tempo Berikutnya
        </label>
        <button
          type="button"
          onclick={recalculateNextDue}
          class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium text-sky-600 hover:bg-sky-50 active:bg-sky-100 dark:text-sky-400 dark:hover:bg-sky-950/60"
          title="Hitung ulang otomatis dari tanggal mulai + siklus"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.058 11H1M12 3v2m0 16v2m9-9H15m-6 0a8 8 0 01-.93-1.668" />
          </svg>
          <span>Otomatis</span>
        </button>
      </div>

      <input
        id="sub-due"
        type="date"
        bind:value={form.nextDueDate}
        oninput={() => { isNextDueOverridden = true; }}
        onchange={() => { isNextDueOverridden = true; }}
        class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white {isNextDueOverridden ? 'border-amber-300 dark:border-amber-800' : ''}"
      />

      <div class="mt-1 flex items-center gap-2 text-[11px]">
        {#if isNextDueOverridden}
          <span class="rounded-full bg-amber-100 px-1.5 py-px text-amber-700 dark:bg-amber-950/70 dark:text-amber-400">Disesuaikan manual</span>
        {:else}
          <span class="text-slate-400">Dihitung otomatis</span>
        {/if}
        <span class="text-slate-400">•</span>
        <span class="text-slate-400">Bisa diubah kapan saja</span>
      </div>

      {#if errors.nextDueDate}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nextDueDate}</p>
      {/if}
    </div>

    <!-- Status + Auto Renew -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label for="sub-status" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
        <select
          id="sub-status"
          bind:value={form.status}
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          {#each SUBSCRIPTION_STATUSES as st}
            <option value={st}>{statusLabels[st]}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-end">
        <label class="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            bind:checked={form.autoRenew}
            class="h-4 w-4 accent-sky-600 rounded border-slate-300 dark:border-slate-600"
          />
          <span class="font-medium text-slate-700 dark:text-slate-300">Perpanjang otomatis (auto-renew)</span>
        </label>
      </div>
    </div>

    <!-- Optional / Advanced fields (kept lightweight) -->
    <div class="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div>
        <label for="sub-notes" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Catatan <span class="font-normal text-slate-400">(opsional)</span>
        </label>
        <textarea
          id="sub-notes"
          bind:value={form.notes}
          rows="2"
          placeholder="Trial 30 hari, akun keluarga, dll."
          class="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        ></textarea>
      </div>

      <div>
        <label for="sub-url" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          URL / Website <span class="font-normal text-slate-400">(opsional)</span>
        </label>
        <input
          id="sub-url"
          type="url"
          bind:value={form.url}
          placeholder="https://example.com/billing"
          class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </div>

      <!-- Tags: chip style, very lightweight -->
      <div>
        <label for="sub-tags" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Tag <span class="font-normal text-slate-400">(opsional, untuk filter nanti)</span>
        </label>

        <div class="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          {#if tags.length > 0}
            <div class="mb-2 flex flex-wrap gap-1.5">
              {#each tags as tag, i (i)}
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-slate-100 pl-2.5 pr-1 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {tag}
                  <button
                    type="button"
                    onclick={() => removeTag(i)}
                    class="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
                    aria-label="Hapus tag {tag}"
                  >
                    ×
                  </button>
                </span>
              {/each}
            </div>
          {/if}

          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={tagInput}
              onkeydown={handleTagKeydown}
              onblur={handleTagBlur}
              placeholder="Ketik tag lalu Enter atau koma"
              class="min-w-[140px] flex-1 border-0 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
            <button
              type="button"
              onclick={addTagFromInput}
              class="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              + Tambah
            </button>
          </div>
        </div>
        <p class="mt-1 text-[10px] text-slate-400">Tag membantu pencarian di masa depan.</p>
      </div>
    </div>

    <!-- Form-level error -->
    {#if errors._form}
      <div class="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
        {errors._form}
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onclick={handleCancel}
        disabled={isSubmitting}
        class="rounded-xl border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 transition active:scale-[0.985] hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Batal
      </button>

      <button
        type="submit"
        disabled={isSubmitting}
        class="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.985] hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400 dark:bg-sky-500 dark:hover:bg-sky-600"
      >
        {#if isSubmitting}
          <span>Menyimpan...</span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d={submitIcon} />
          </svg>
          <span>{submitLabel}</span>
        {/if}
      </button>
    </div>

    <p class="text-center text-[10px] text-slate-400">
      Semua data disimpan secara lokal di file .subtrack Anda.
    </p>
  </form>
</div>
