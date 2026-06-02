<script lang="ts">
  /**
   * SettingsView.svelte — Task 11: Settings & File Management
   *
   * Core of user trust in the "fully local + one portable .subtrack file" architecture.
   *
   * - Prominent, honest File Management section with clear explanations.
   * - Export (backup) + Import + Load-as-main + Forget + Reset flows wired to storage layer.
   * - Category management: add/remove custom (and default) categories, with usage counts and safe guards.
   * - Basic preferences: defaultCurrency (live) + theme (system/light/dark, fully wired + live DOM apply in Task 13).
   * - Uses storage primitives heavily + subscriptionStore for usage counts.
   * - Transient success/error feedback (pattern from RemindersView).
   * - Reactive to external storage changes (import, load, reset from elsewhere) via subscribeToStorageChanges + $effect.
   * - Bilingual (ID primary) labels matching app tone. Mobile-friendly, dark mode.
   *
   * No cloud. No hidden sync. User owns their file completely.
   */

  import { createEventDispatcher } from 'svelte'; // not used but kept for consistency pattern
  import {
    getAppData,
    getCurrentFileName,
    getIsDirty,
    exportBackup,
    importBackup,
    loadFromFile,
    forgetCurrentFile,
    resetToNewEmptyData,
    saveToFile,
    subscribeToStorageChanges,
    updateAppSettings,
    addCategory,
    removeCategory,
    StorageError,
    STORAGE_ERROR_CODES,
    type StorageErrorCode,
  } from '$lib/storage';
  import { subscriptionStore } from '$lib/stores/subscriptions.svelte';
  import type { AppSettings } from '$lib/types';
  import { DEFAULT_CATEGORIES } from '$lib/types';

  /* -------------------------------------------------------------------------------------------------
   * Local UI State (runes)
   * ----------------------------------------------------------------------------------------------- */
  let isProcessing = $state(false);
  let successMessage = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);

  // Reactivity bridge for this view (external storage events like import/load from other tabs/flows)
  let dataVersion = $state(0);

  $effect(() => {
    const unsub = subscribeToStorageChanges(() => {
      dataVersion = dataVersion + 1;
    });
    return unsub;
  });

  // Local buffer for "add category"
  let newCategoryInput = $state('');

  // Transient last-export time (in-memory, session only — the file itself carries authoritative lastModified)
  let lastExportTimestamp = $state<string | null>(null);

  /* -------------------------------------------------------------------------------------------------
   * Reactive derived data (fresh on dataVersion bumps + store changes)
   * ----------------------------------------------------------------------------------------------- */
  const appData = $derived.by(() => {
    dataVersion; // track external replacements
    return getAppData();
  });

  const settings = $derived(appData.settings);
  const meta = $derived(appData.meta);
  const currentFileName = $derived.by(() => {
    dataVersion;
    return getCurrentFileName();
  });
  const isDirty = $derived.by(() => {
    dataVersion;
    return getIsDirty();
  });

  // Live subscriptions for usage counts (store already reacts to storage notifications internally)
  const allSubscriptions = $derived(subscriptionStore.subscriptions);

  const categoryUsage = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const sub of allSubscriptions) {
      const cat = sub.category;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  });

  /* -------------------------------------------------------------------------------------------------
   * Helpers
   * ----------------------------------------------------------------------------------------------- */
  function formatDateTime(iso: string): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function getUsageCount(cat: string): number {
    return categoryUsage.get(cat) ?? 0;
  }

  function clearMessages() {
    successMessage = null;
    errorMessage = null;
  }

  function showSuccess(msg: string, autoClearMs = 4200) {
    clearMessages();
    successMessage = msg;
    if (autoClearMs > 0) {
      setTimeout(() => {
        if (successMessage === msg) successMessage = null;
      }, autoClearMs);
    }
  }

  function showError(msg: string, autoClearMs = 5200) {
    clearMessages();
    errorMessage = msg;
    if (autoClearMs > 0) {
      setTimeout(() => {
        if (errorMessage === msg) errorMessage = null;
      }, autoClearMs);
    }
  }

  function handleStorageError(err: unknown, context: string): void {
    if (err instanceof StorageError) {
      if (err.code === STORAGE_ERROR_CODES.USER_CANCELLED) {
        // Silent — user intentionally cancelled a picker
        return;
      }
      if (err.code === STORAGE_ERROR_CODES.PERMISSION_DENIED) {
        showError('Izin akses file ditolak oleh browser. Coba lagi dan izinkan saat diminta.');
        return;
      }
      if (err.code === STORAGE_ERROR_CODES.INVALID_DATA) {
        showError('File .subtrack tidak valid atau versi tidak didukung. Pilih file yang benar.');
        return;
      }
    }
    console.error(`[SettingsView] ${context} failed:`, err);
    showError(`Gagal ${context.toLowerCase()}. Periksa konsol untuk detail.`);
  }

  /* -------------------------------------------------------------------------------------------------
   * File Operations (heavy use of storage layer primitives)
   * ----------------------------------------------------------------------------------------------- */
  async function handleDownloadBackup() {
    if (isProcessing) return;
    isProcessing = true;
    clearMessages();

    try {
      await exportBackup();
      lastExportTimestamp = new Date().toISOString();
      showSuccess('Cadangan berhasil disimpan. File .subtrack baru dibuat di lokasi pilihan Anda.');
    } catch (err) {
      handleStorageError(err, 'Menyimpan cadangan');
    } finally {
      isProcessing = false;
    }
  }

  async function handleImportFromFile() {
    if (isProcessing) return;

    const confirmMsg =
      'Pulihkan data dari file .subtrack lain?\n\n' +
      'Ini akan MEMUAT ISI FILE TERSEBUT ke memori kerja saat ini (menggantikan data yang sedang aktif).\n' +
      'Data Anda yang lama tetap aman di file asli.\n\n' +
      'Setelah impor, Anda bisa "Simpan ke File Saat Ini" untuk menimpa file utama Anda, atau "Simpan Cadangan" terlebih dahulu.';
    if (!confirm(confirmMsg)) return;

    isProcessing = true;
    clearMessages();

    try {
      await importBackup();
      // subscribeToStorageChanges already bumped dataVersion → UI refreshed
      // subscriptionsStore also synced internally
      showSuccess(
        'Data berhasil diimpor dari file. Perubahan masih di memori (dirty). Gunakan "Simpan ke File Saat Ini" untuk menulis ke file utama Anda.'
      );
    } catch (err) {
      handleStorageError(err, 'Mengimpor file');
    } finally {
      isProcessing = false;
    }
  }

  async function handleLoadFileAsMain() {
    if (isProcessing) return;

    const confirmMsg =
      'Buka file .subtrack lain sebagai file utama Anda?\n\n' +
      'File handle akan diperbarui. Semua perubahan selanjutnya akan disimpan ke file yang Anda pilih sekarang.\n' +
      'Data lama Anda tetap aman di file sebelumnya.';
    if (!confirm(confirmMsg)) return;

    isProcessing = true;
    clearMessages();

    try {
      await loadFromFile();
      showSuccess('File baru berhasil dibuka dan diadopsi sebagai file utama. Semua perubahan sekarang akan tersimpan ke file ini.');
    } catch (err) {
      handleStorageError(err, 'Membuka file sebagai utama');
    } finally {
      isProcessing = false;
    }
  }

  async function handleSaveToCurrentFile() {
    if (isProcessing) return;
    isProcessing = true;
    clearMessages();

    try {
      await saveToFile();
      showSuccess('Perubahan berhasil disimpan ke file .subtrack Anda.');
    } catch (err) {
      handleStorageError(err, 'Menyimpan ke file');
    } finally {
      isProcessing = false;
    }
  }

  async function handleForgetCurrentFile() {
    if (isProcessing) return;

    const confirmMsg =
      'Lupa file saat ini?\n\n' +
      'Aplikasi tidak lagi mengingat file .subtrack mana yang Anda gunakan.\n' +
      'Data di memori tetap ada. Saat Anda menyimpan berikutnya, Anda akan diminta memilih lokasi (Save As).\n' +
      'File lama Anda di disk tetap utuh.';
    if (!confirm(confirmMsg)) return;

    isProcessing = true;
    clearMessages();

    try {
      await forgetCurrentFile();
      showSuccess('File saat ini dilupakan. Data di memori aman. Simpan cadangan atau buka file baru kapan saja.');
    } catch (err) {
      handleStorageError(err, 'Melupakan file');
    } finally {
      isProcessing = false;
    }
  }

  async function handleStartFresh() {
    if (isProcessing) return;

    const confirmMsg =
      'Mulai dengan data kosong baru?\n\n' +
      'SEMUA langganan dan perubahan saat ini di memori akan hilang (file di disk Anda tetap aman).\n' +
      'Anda akan mulai dari nol dengan kategori default.\n\nLanjutkan?';
    if (!confirm(confirmMsg)) return;

    isProcessing = true;
    clearMessages();

    try {
      resetToNewEmptyData();
      await forgetCurrentFile();
      lastExportTimestamp = null;
      showSuccess('Data direset ke kondisi kosong. Mulai tambahkan langganan baru atau impor file cadangan.');
    } catch (err) {
      handleStorageError(err, 'Mereset data');
    } finally {
      isProcessing = false;
    }
  }

  /* -------------------------------------------------------------------------------------------------
   * Category Management
   * ----------------------------------------------------------------------------------------------- */
  async function handleAddCategory() {
    const name = newCategoryInput.trim();
    if (!name) {
      showError('Nama kategori tidak boleh kosong.');
      return;
    }

    isProcessing = true;
    clearMessages();

    try {
      const added = await addCategory(name);
      if (added) {
        newCategoryInput = '';
        showSuccess(`Kategori "${name}" ditambahkan dan disimpan ke file Anda.`);
      } else {
        showError(`Kategori "${name}" sudah ada dalam daftar.`);
      }
    } catch (err) {
      handleStorageError(err, 'Menambah kategori');
    } finally {
      isProcessing = false;
    }
  }

  async function handleRemoveCategory(cat: string) {
    if (isProcessing) return;

    const usage = getUsageCount(cat);
    let confirmMsg = `Hapus kategori "${cat}" dari daftar master?`;

    if (usage > 0) {
      confirmMsg +=
        `\n\nKategori ini masih dipakai oleh ${usage} langganan.\n` +
        'Langganan tersebut akan tetap menyimpan nama kategori tersebut (data tidak hilang), ' +
        'hanya saja tidak akan muncul lagi di dropdown pemilihan kategori baru.';
    } else {
      confirmMsg += '\n\nKategori ini tidak sedang dipakai langganan mana pun.';
    }

    if (!confirm(confirmMsg)) return;

    isProcessing = true;
    clearMessages();

    try {
      const removed = await removeCategory(cat);
      if (removed) {
        showSuccess(`Kategori "${cat}" dihapus dari daftar master.`);
      }
    } catch (err) {
      handleStorageError(err, 'Menghapus kategori');
    } finally {
      isProcessing = false;
    }
  }

  async function handleResetCategoriesToDefault() {
    if (isProcessing) return;

    if (!confirm('Reset daftar kategori ke default aplikasi?\nKategori custom yang Anda buat akan hilang dari picker (langganan lama tetap utuh).')) {
      return;
    }

    isProcessing = true;
    clearMessages();

    try {
      await updateAppSettings({ categories: [...DEFAULT_CATEGORIES] });
      showSuccess('Daftar kategori direset ke default.');
    } catch (err) {
      handleStorageError(err, 'Mereset kategori');
    } finally {
      isProcessing = false;
    }
  }

  function handleCategoryInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  }

  /* -------------------------------------------------------------------------------------------------
   * Preferences (live update via storage helper)
   * ----------------------------------------------------------------------------------------------- */
  const popularCurrencies = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP', 'AUD', 'CAD', 'CNY'] as const;

  let customCurrencyBuffer = $state('');

  // Keep buffer in sync when external change happens
  $effect(() => {
    dataVersion;
    const curr = settings.defaultCurrency;
    if (!popularCurrencies.includes(curr as (typeof popularCurrencies)[number]) && curr !== customCurrencyBuffer) {
      customCurrencyBuffer = curr;
    }
  });

  async function handleCurrencyChange(value: string) {
    if (!value || value === settings.defaultCurrency) return;
    clearMessages();
    try {
      await updateAppSettings({ defaultCurrency: value });
      showSuccess(`Mata uang default diubah ke ${value}.`, 2200);
    } catch (err) {
      handleStorageError(err, 'Mengubah mata uang');
    }
  }

  function handlePopularCurrencySelect(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (val === '__custom') {
      // focus the custom input (user will type + blur)
      return;
    }
    handleCurrencyChange(val);
  }

  function handleCustomCurrencyBlur() {
    const val = customCurrencyBuffer.trim().toUpperCase();
    if (val && val !== settings.defaultCurrency) {
      handleCurrencyChange(val);
    }
  }

  async function handleThemeChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value as AppSettings['theme'];
    if (val === settings.theme) return;
    clearMessages();
    try {
      await updateAppSettings({ theme: val });
      showSuccess('Preferensi tema disimpan ke file Anda. (diterapkan langsung)', 2200);
    } catch (err) {
      handleStorageError(err, 'Mengubah tema');
    }
  }

  /* -------------------------------------------------------------------------------------------------
   * Initial sync of custom currency buffer
   * ----------------------------------------------------------------------------------------------- */
  // Runs once at creation
  $effect(() => {
    if (!customCurrencyBuffer && !popularCurrencies.includes(settings.defaultCurrency as any)) {
      customCurrencyBuffer = settings.defaultCurrency;
    }
  });
</script>

<div class="space-y-8">
  <!-- Trust & Honesty Banner (critical for fully-local architecture) -->
  <div
    class="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sm leading-relaxed dark:border-sky-900/60 dark:bg-sky-950/40"
  >
    <div class="flex items-start gap-3">
      <div class="mt-0.5 text-xl leading-none">🔐</div>
      <div class="flex-1">
        <p class="font-semibold tracking-tight text-sky-900 dark:text-sky-200">
          Data Anda hanya ada di file .subtrack Anda.
        </p>
        <p class="mt-1 text-sky-800 dark:text-sky-300">
          Tidak ada cloud. Tidak ada server. Tidak ada akun. Tidak ada sinkronisasi otomatis.
          <strong>Subtrack hanya membaca dan menulis file yang Anda pilih sendiri</strong>. Simpan cadangan secara berkala ke lokasi aman (USB, cloud storage pribadi, atau folder terenkripsi).
        </p>
        <p class="mt-1 text-[12px] text-sky-700 dark:text-sky-400">
          File .subtrack adalah milik Anda sepenuhnya — Anda bisa membukanya di perangkat lain, membaginya, atau memindahkannya kapan saja.
        </p>
      </div>
    </div>
  </div>

  <!-- Feedback Banners -->
  {#if successMessage}
    <div
      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      role="status"
    >
      ✓ {successMessage}
    </div>
  {/if}
  {#if errorMessage}
    <div
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
      role="alert"
    >
      ⚠ {errorMessage}
    </div>
  {/if}

  <!-- FILE MANAGEMENT (Prominent as required) -->
  <section class="space-y-3">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Manajemen File</h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Operasi langsung pada file .subtrack portabel Anda.
      </p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <!-- Current file status -->
      <div class="mb-4 space-y-1 text-sm">
        <div>
          <span class="inline-block w-28 text-slate-500 dark:text-slate-400">File saat ini</span>
          <span class="font-mono break-all text-slate-900 dark:text-slate-100">
            {currentFileName ?? '— (belum diikat ke file permanen)'}
          </span>
        </div>
        <div>
          <span class="inline-block w-28 text-slate-500 dark:text-slate-400">Terakhir diubah</span>
          <span class="text-slate-700 dark:text-slate-300">{formatDateTime(meta.lastModified)}</span>
        </div>
        {#if lastExportTimestamp}
          <div>
            <span class="inline-block w-28 text-slate-500 dark:text-slate-400">Cadangan terakhir</span>
            <span class="text-emerald-600 dark:text-emerald-400">{formatDateTime(lastExportTimestamp)}</span>
          </div>
        {/if}
        {#if isDirty}
          <div class="mt-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
            ⚠ Ada perubahan belum tersimpan ke disk.
          </div>
        {/if}
      </div>

      <!-- Primary actions -->
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onclick={handleDownloadBackup}
          disabled={isProcessing}
          class="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-600"
        >
          📥 Simpan Cadangan
          <span class="hidden text-xs opacity-75 sm:inline">(.subtrack)</span>
        </button>

        <button
          type="button"
          onclick={handleImportFromFile}
          disabled={isProcessing}
          class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          📂 Pulihkan dari File
        </button>

        <button
          type="button"
          onclick={handleLoadFileAsMain}
          disabled={isProcessing}
          class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          📁 Buka sebagai File Utama
        </button>

        {#if isDirty}
          <button
            type="button"
            onclick={handleSaveToCurrentFile}
            disabled={isProcessing}
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            💾 Simpan ke File Saat Ini
          </button>
        {/if}

        <button
          type="button"
          onclick={handleForgetCurrentFile}
          disabled={isProcessing}
          class="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-300 dark:bg-red-950/30 dark:text-red-300"
        >
          Lupa File Saat Ini
        </button>

        <button
          type="button"
          onclick={handleStartFresh}
          disabled={isProcessing}
          class="ml-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Mulai Data Baru
        </button>
      </div>

      <p class="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        "Simpan Cadangan" membuat salinan bertanggal terpisah. "Pulihkan dari File" memuat data ke memori (dirty) tanpa mengubah file utama Anda. "Buka sebagai File Utama" mengadopsi file tersebut untuk penulisan selanjutnya.
      </p>
    </div>
  </section>

  <!-- PREFERENCES -->
  <section class="space-y-3">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Preferensi</h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">Disimpan langsung di dalam file .subtrack Anda.</p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-6">
      <!-- Default Currency -->
      <div>
        <label for="default-currency" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Mata Uang Default
        </label>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <select
            id="default-currency"
            class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={popularCurrencies.includes(settings.defaultCurrency as any) ? settings.defaultCurrency : '__custom'}
            onchange={handlePopularCurrencySelect}
            disabled={isProcessing}
          >
            {#each popularCurrencies as curr}
              <option value={curr}>{curr}</option>
            {/each}
            <option value="__custom">Lainnya…</option>
          </select>

          <input
            type="text"
            class="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono uppercase placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
            placeholder="Kode"
            bind:value={customCurrencyBuffer}
            onblur={handleCustomCurrencyBlur}
            onkeydown={(e) => e.key === 'Enter' && handleCustomCurrencyBlur()}
            disabled={isProcessing}
            maxlength="8"
          />
          <span class="text-xs text-slate-500 dark:text-slate-400">Contoh: IDR, USD, EUR</span>
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Digunakan otomatis saat menambah langganan baru. Bisa diubah per langganan.
        </p>
      </div>

      <!-- Theme -->
      <div>
        <label for="theme-select" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tema Antarmuka
        </label>
        <select
          id="theme-select"
          class="mt-1.5 w-full max-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          value={settings.theme}
          onchange={handleThemeChange}
          disabled={isProcessing}
        >
          <option value="system">Ikuti Sistem (rekomendasi)</option>
          <option value="light">Terang</option>
          <option value="dark">Gelap</option>
        </select>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Preferensi tema disimpan di file .subtrack. Penerapan penuh (termasuk toggle langsung) akan hadir di rilis berikutnya.
        </p>
      </div>
    </div>
  </section>

  <!-- CATEGORY MANAGEMENT -->
  <section class="space-y-3">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Kategori</h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Daftar master yang tersedia di form tambah langganan dan filter. Kategori custom Anda ikut disimpan di file .subtrack.
      </p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <!-- Add new -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          class="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
          placeholder="Nama kategori baru (mis. Asuransi, Pendidikan)"
          bind:value={newCategoryInput}
          onkeydown={handleCategoryInputKeydown}
          disabled={isProcessing}
          maxlength="40"
        />
        <button
          type="button"
          onclick={handleAddCategory}
          disabled={isProcessing || !newCategoryInput.trim()}
          class="inline-flex items-center gap-1.5 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-500"
        >
          + Tambah Kategori
        </button>
      </div>

      <!-- Current categories as chips -->
      <div class="mb-3">
        <div class="mb-1.5 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Kategori Saat Ini ({settings.categories.length})
        </div>
        <div class="flex flex-wrap gap-2">
          {#each settings.categories as cat (cat)}
            <div
              class="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-3 pr-1 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <span class="font-medium text-slate-800 dark:text-slate-200">{cat}</span>
              <span class="rounded-full bg-slate-200 px-1.5 text-[10px] tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {getUsageCount(cat)}
              </span>
              <button
                type="button"
                onclick={() => handleRemoveCategory(cat)}
                disabled={isProcessing}
                aria-label="Hapus kategori {cat}"
                class="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-600 active:scale-95 dark:hover:bg-red-950/60 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                title="Hapus dari daftar"
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <button
          type="button"
          onclick={handleResetCategoriesToDefault}
          disabled={isProcessing}
          class="text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
        >
          Reset ke kategori default
        </button>
        <span class="text-slate-400 dark:text-slate-500">Angka = jumlah langganan yang memakai kategori tersebut</span>
      </div>
    </div>
  </section>

  <!-- Footer note -->
  <div class="pt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
    Semua perubahan langsung ditulis ke file .subtrack Anda (kecuali saat impor tanpa "Save").
    Gunakan "Simpan Cadangan" secara berkala untuk keamanan ekstra.
  </div>
</div>
