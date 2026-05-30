/**
 * File Storage Layer — The Heart of "Fully Local"
 *
 * Single source of truth for the portable `.subtrack` file.
 * - Uses File System Access API (showOpenFilePicker / showSaveFilePicker + persistent FileSystemFileHandle) when available
 * - Graceful fallback to classic Blob download + dynamic <input type="file"> for other browsers
 * - Persists the file handle (not the data) in IndexedDB so the app can re-open the user's chosen file across sessions
 * - In-memory AppData is the working copy; all persistence goes through this module
 *
 * No cloud. No automatic saves to browser storage. User fully owns their .subtrack file.
 *
 * This module is intentionally UI-free. Consumers (stores, components in later tasks) call these functions
 * and react to changes via getAppData() + subscribeToStorageChanges().
 */

import type { AppData, AppSettings } from '../types';
import {
  DATA_VERSION,
  DEFAULT_CATEGORIES,
} from '../types/subscription';

/* -------------------------------------------------------------------------------------------------
 * Type Augmentations for File System Access API
 * (The API surface is not included in every TS DOM lib configuration)
 * ----------------------------------------------------------------------------------------------- */

declare global {
  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemFileHandle {
    queryPermission(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<PermissionState>;
    requestPermission(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<PermissionState>;
  }

  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

/* -------------------------------------------------------------------------------------------------
 * Constants & Types
 * ----------------------------------------------------------------------------------------------- */

export const SUBTRACK_FILE_EXTENSION = '.subtrack';
export const SUBTRACK_MIME_TYPE = 'application/json';

export const STORAGE_ERROR_CODES = {
  USER_CANCELLED: 'USER_CANCELLED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_DATA: 'INVALID_DATA',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  NO_FILE_HANDLE: 'NO_FILE_HANDLE',
  BROWSER_UNSUPPORTED: 'BROWSER_UNSUPPORTED',
} as const;

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[keyof typeof STORAGE_ERROR_CODES];

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/* -------------------------------------------------------------------------------------------------
 * Internal State (module singleton)
 * ----------------------------------------------------------------------------------------------- */

let currentData: AppData = createDefaultAppData();
let currentFileHandle: FileSystemFileHandle | null = null;
let isDirtyState = false;

const changeListeners = new Set<() => void>();

function notifyChange(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch (err) {
      // Never let a listener break the storage layer
      console.error('[fileStorage] listener error:', err);
    }
  }
}

/* -------------------------------------------------------------------------------------------------
 * Feature Detection
 * ----------------------------------------------------------------------------------------------- */

const supportsFileSystemAccess =
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as unknown as Window).showOpenFilePicker === 'function' &&
  typeof (globalThis as unknown as Window).showSaveFilePicker === 'function';

/* -------------------------------------------------------------------------------------------------
 * Default Data Generator
 * ----------------------------------------------------------------------------------------------- */

/**
 * Generate a fresh, empty, valid AppData structure.
 * Used on first run and for "New file" flows (later).
 */
export function createDefaultAppData(): AppData {
  const now = new Date().toISOString();

  return {
    version: DATA_VERSION,
    meta: {
      createdAt: now,
      lastModified: now,
      appVersion: '0.0.0',
    },
    subscriptions: [],
    settings: {
      defaultCurrency: 'IDR',
      categories: [...DEFAULT_CATEGORIES],
      theme: 'system',
    },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Validation
 * ----------------------------------------------------------------------------------------------- */

/**
 * Strict structural validation for imported .subtrack files.
 * Throws StorageError with code INVALID_DATA on any problem.
 */
export function validateAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') {
    throw new StorageError('Data is not an object', STORAGE_ERROR_CODES.INVALID_DATA);
  }

  const data = raw as Record<string, unknown>;

  if (data.version !== DATA_VERSION) {
    throw new StorageError(
      `Unsupported data version: ${data.version}. Expected ${DATA_VERSION}.`,
      STORAGE_ERROR_CODES.INVALID_DATA
    );
  }

  // Meta
  const meta = data.meta as Record<string, unknown> | undefined;
  if (
    !meta ||
    typeof meta.createdAt !== 'string' ||
    typeof meta.lastModified !== 'string' ||
    typeof meta.appVersion !== 'string'
  ) {
    throw new StorageError('Invalid or missing meta section', STORAGE_ERROR_CODES.INVALID_DATA);
  }

  // Subscriptions (array, basic shape check)
  if (!Array.isArray(data.subscriptions)) {
    throw new StorageError('subscriptions must be an array', STORAGE_ERROR_CODES.INVALID_DATA);
  }

  for (const [index, sub] of (data.subscriptions as unknown[]).entries()) {
    if (!sub || typeof sub !== 'object') {
      throw new StorageError(`Invalid subscription at index ${index}`, STORAGE_ERROR_CODES.INVALID_DATA);
    }
    const s = sub as Record<string, unknown>;
    if (
      typeof s.id !== 'string' ||
      typeof s.name !== 'string' ||
      typeof s.price !== 'number' ||
      typeof s.currency !== 'string' ||
      typeof s.startDate !== 'string' ||
      typeof s.nextDueDate !== 'string' ||
      typeof s.status !== 'string' ||
      typeof s.autoRenew !== 'boolean'
    ) {
      throw new StorageError(
        `Subscription at index ${index} is missing required fields`,
        STORAGE_ERROR_CODES.INVALID_DATA
      );
    }
  }

  // Settings
  const settings = data.settings as Record<string, unknown> | undefined;
  if (
    !settings ||
    typeof settings.defaultCurrency !== 'string' ||
    !Array.isArray(settings.categories) ||
    typeof settings.theme !== 'string'
  ) {
    throw new StorageError('Invalid or missing settings section', STORAGE_ERROR_CODES.INVALID_DATA);
  }

  // All good — trust the shape (full runtime schema validation can be added later if needed)
  return data as unknown as AppData;
}

/* -------------------------------------------------------------------------------------------------
 * File Reading Helper
 * ----------------------------------------------------------------------------------------------- */

async function readAppDataFromFile(file: File): Promise<AppData> {
  try {
    const text = await file.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      throw new StorageError(
        'File is not valid JSON',
        STORAGE_ERROR_CODES.INVALID_DATA,
        parseErr
      );
    }

    return validateAppData(parsed);
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(
      'Failed to read .subtrack file',
      STORAGE_ERROR_CODES.FILE_READ_ERROR,
      err
    );
  }
}

/* -------------------------------------------------------------------------------------------------
 * Minimal IndexedDB Handle Persistence (only the handle, never the data)
 * ----------------------------------------------------------------------------------------------- */

const IDB_DB_NAME = 'subtrack-file-handles';
const IDB_STORE_NAME = 'handles';
const IDB_HANDLE_KEY = 'current-subtrack-file';

async function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

async function getStoredHandle(): Promise<FileSystemFileHandle | null> {
  if (!supportsFileSystemAccess) return null;

  try {
    const db = await openHandleDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(IDB_HANDLE_KEY);

      req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Treat any IDB failure as "no stored handle"
    return null;
  }
}

async function storeHandle(handle: FileSystemFileHandle): Promise<void> {
  if (!supportsFileSystemAccess) return;

  try {
    const db = await openHandleDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(handle, IDB_HANDLE_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Non-fatal: user will just have to pick the file again next time
    console.warn('[fileStorage] Failed to persist file handle (non-fatal):', err);
  }
}

async function clearStoredHandle(): Promise<void> {
  if (!supportsFileSystemAccess) return;

  try {
    const db = await openHandleDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.delete(IDB_HANDLE_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

/* -------------------------------------------------------------------------------------------------
 * Permission Helper (File System Access API)
 * ----------------------------------------------------------------------------------------------- */

async function verifyAndRequestPermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const opts = { mode } as const;

  try {
    const current = await handle.queryPermission(opts);
    if (current === 'granted') return true;

    const requested = await handle.requestPermission(opts);
    return requested === 'granted';
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------------------------------
 * Classic Fallback File Picker (no File System Access API)
 * ----------------------------------------------------------------------------------------------- */

async function pickFileWithInput(accept = '.subtrack,application/json'): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.position = 'fixed';
    input.style.top = '-1000px';
    input.style.left = '-1000px';

    const cleanup = () => {
      input.onchange = null;
      input.remove();
    };

    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (file) {
        resolve(file);
      } else {
        reject(new StorageError('No file was selected', STORAGE_ERROR_CODES.USER_CANCELLED));
      }
    };

    // Some browsers fire cancel via remove or blur; we rely on user gesture + timeout safety
    const timeout = setTimeout(() => {
      cleanup();
      reject(new StorageError('File picker timed out', STORAGE_ERROR_CODES.USER_CANCELLED));
    }, 120_000);

    input.oncancel = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new StorageError('File selection was cancelled', STORAGE_ERROR_CODES.USER_CANCELLED));
    };

    document.body.appendChild(input);
    // Must be called in a user activation context (button click etc.)
    input.click();
  });
}

/* -------------------------------------------------------------------------------------------------
 * Download / Export Helper (works in every browser)
 * ----------------------------------------------------------------------------------------------- */

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------------------------------
 * Core Write Helper (for FileSystemFileHandle)
 * ----------------------------------------------------------------------------------------------- */

async function writeAppDataToHandle(handle: FileSystemFileHandle, data: AppData): Promise<void> {
  // Always bump lastModified on write
  const dataToWrite: AppData = {
    ...data,
    meta: {
      ...data.meta,
      lastModified: new Date().toISOString(),
    },
  };

  const json = JSON.stringify(dataToWrite, null, 2); // pretty-print for human readability / easy git diff
  const writable = await handle.createWritable();

  try {
    await writable.write(json);
    await writable.close();
  } catch (err) {
    try {
      await writable.close();
    } catch {
      /* ignore close error */
    }
    throw new StorageError(
      'Failed to write to .subtrack file',
      STORAGE_ERROR_CODES.FILE_WRITE_ERROR,
      err
    );
  }
}

/* -------------------------------------------------------------------------------------------------
 * Public API — Reactive State Accessors
 * ----------------------------------------------------------------------------------------------- */

/** Current in-memory working copy of the data (single source of truth). */
export function getAppData(): AppData {
  return currentData;
}

/** Whether there are unsaved changes relative to the file on disk. */
export function getIsDirty(): boolean {
  return isDirtyState;
}

/**
 * Subscribe to any change in current data or dirty flag.
 * Returns an unsubscribe function.
 *
 * Use this (or wrap it) to drive Svelte $state / runes / stores in later tasks.
 */
export function subscribeToStorageChanges(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/* -------------------------------------------------------------------------------------------------
 * Public API — File Operations
 * ----------------------------------------------------------------------------------------------- */

/**
 * Attempt to restore the previously used .subtrack file using the persisted handle (IndexedDB).
 * Returns the loaded AppData on success, or null if no handle / permission denied / file gone.
 *
 * Call this early in app startup for seamless "it just opens my file" experience.
 */
export async function restoreLastUsedFile(): Promise<AppData | null> {
  if (!supportsFileSystemAccess) return null;

  const handle = await getStoredHandle();
  if (!handle) return null;

  const hasPermission = await verifyAndRequestPermission(handle, 'readwrite');
  if (!hasPermission) {
    // User declined — do not clear the handle (they may grant later), just fail this restore
    return null;
  }

  try {
    const file = await handle.getFile();
    const appData = await readAppDataFromFile(file);

    currentData = appData;
    currentFileHandle = handle;
    isDirtyState = false;
    notifyChange();

    return appData;
  } catch (err) {
    // File probably moved, deleted, or corrupted. Drop the stale handle.
    await clearStoredHandle();
    currentFileHandle = null;
    console.warn('[fileStorage] Stored handle is no longer valid, cleared it.');
    return null;
  }
}

/**
 * Open a .subtrack file and adopt it as the current working file.
 * - Modern browsers: uses showOpenFilePicker + persists the handle
 * - Fallback: dynamic file input
 *
 * On success: replaces currentData, clears dirty flag, returns the data.
 */
export async function loadFromFile(): Promise<AppData> {
  try {
    if (supportsFileSystemAccess) {
      const showOpen = (globalThis as unknown as Window).showOpenFilePicker;
      const handles: FileSystemFileHandle[] = await showOpen!({
        types: [
          {
            description: 'Subtrack data file',
            accept: { [SUBTRACK_MIME_TYPE]: [SUBTRACK_FILE_EXTENSION] },
          },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
      });

      const handle = handles[0];
      if (!handle) {
        throw new StorageError('No file selected', STORAGE_ERROR_CODES.USER_CANCELLED);
      }

      const hasPermission = await verifyAndRequestPermission(handle, 'readwrite');
      if (!hasPermission) {
        throw new StorageError(
          'Permission to read/write the file was denied',
          STORAGE_ERROR_CODES.PERMISSION_DENIED
        );
      }

      const file = await handle.getFile();
      const appData = await readAppDataFromFile(file);

      currentData = appData;
      currentFileHandle = handle;
      await storeHandle(handle);
      isDirtyState = false;
      notifyChange();

      return appData;
    } else {
      // Fallback path
      const file = await pickFileWithInput();
      const appData = await readAppDataFromFile(file);

      currentData = appData;
      currentFileHandle = null; // cannot persist in fallback browsers
      isDirtyState = false;
      notifyChange();

      return appData;
    }
  } catch (err: any) {
    if (err instanceof StorageError) throw err;

    if (err?.name === 'AbortError') {
      throw new StorageError('File selection cancelled', STORAGE_ERROR_CODES.USER_CANCELLED, err);
    }

    throw new StorageError(
      'Failed to open .subtrack file',
      STORAGE_ERROR_CODES.FILE_READ_ERROR,
      err
    );
  }
}

/**
 * Save the current in-memory data back to the open file handle.
 * - If a handle exists (modern path): uses createWritable for atomic-ish write
 * - If no handle (fallback or never opened a file): falls back to exportBackup behavior
 *
 * Updates lastModified and clears the dirty flag on success.
 */
export async function saveToFile(): Promise<void> {
  if (!currentFileHandle) {
    // No persistent handle — treat "save" as "export a copy" so user never loses work
    await exportBackup();
    isDirtyState = false;
    notifyChange();
    return;
  }

  try {
    if (supportsFileSystemAccess) {
      await writeAppDataToHandle(currentFileHandle, currentData);
    } else {
      // Should not normally reach here, but be defensive
      await exportBackup();
    }

    isDirtyState = false;
    notifyChange();
  } catch (err: any) {
    if (err instanceof StorageError) throw err;

    // Permission may have been revoked since last open
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      const regained = await verifyAndRequestPermission(currentFileHandle, 'readwrite');
      if (regained) {
        return saveToFile(); // one retry
      }
      throw new StorageError(
        'Write permission was lost',
        STORAGE_ERROR_CODES.PERMISSION_DENIED,
        err
      );
    }

    throw new StorageError('Failed to save .subtrack file', STORAGE_ERROR_CODES.FILE_WRITE_ERROR, err);
  }
}

/**
 * Export the current data as a .subtrack backup file.
 * Always prompts the user (Save As picker on modern browsers, download otherwise).
 *
 * This does NOT affect the current working file handle or the dirty flag.
 * Use this for dated backups or "Save As" copies.
 */
export async function exportBackup(): Promise<void> {
  // Always write fresh lastModified for the exported copy
  const exportData: AppData = {
    ...currentData,
    meta: {
      ...currentData.meta,
      lastModified: new Date().toISOString(),
    },
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: SUBTRACK_MIME_TYPE });
  const filename = `subtrack-${new Date().toISOString().slice(0, 10)}${SUBTRACK_FILE_EXTENSION}`;

  if (supportsFileSystemAccess) {
    try {
      const showSave = (globalThis as unknown as Window).showSaveFilePicker;
      const handle: FileSystemFileHandle = await showSave!({
        suggestedName: filename,
        types: [
          {
            description: 'Subtrack data file',
            accept: { [SUBTRACK_MIME_TYPE]: [SUBTRACK_FILE_EXTENSION] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      // Intentionally NOT adopting this handle — it's an export/backup, not "the" main file
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User cancelled the Save dialog — this is not an error for the caller
        return;
      }
      throw new StorageError('Failed to export backup', STORAGE_ERROR_CODES.FILE_WRITE_ERROR, err);
    }
  } else {
    triggerDownload(blob, filename);
  }
}

/**
 * Load data from a chosen .subtrack file *without* adopting it as the persistent working file.
 * Useful for importing data from a backup or another user's file.
 *
 * After import:
 * - currentData is replaced
 * - isDirty becomes true (imported content is not yet persisted to your main file)
 * - current file handle is left untouched (you can still saveToFile to overwrite your main file)
 */
export async function importBackup(): Promise<AppData> {
  try {
    if (supportsFileSystemAccess) {
      const showOpen = (globalThis as unknown as Window).showOpenFilePicker;
      const handles: FileSystemFileHandle[] = await showOpen!({
        types: [
          {
            description: 'Subtrack data file',
            accept: { [SUBTRACK_MIME_TYPE]: [SUBTRACK_FILE_EXTENSION] },
          },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
      });

      const handle = handles[0];
      if (!handle) {
        throw new StorageError('No file selected', STORAGE_ERROR_CODES.USER_CANCELLED);
      }

      // We only need read permission for import
      const hasPermission = await verifyAndRequestPermission(handle, 'read');
      if (!hasPermission) {
        throw new StorageError(
          'Permission to read the backup file was denied',
          STORAGE_ERROR_CODES.PERMISSION_DENIED
        );
      }

      const file = await handle.getFile();
      const appData = await readAppDataFromFile(file);

      currentData = appData;
      isDirtyState = true; // not saved to the user's main file yet
      notifyChange();

      return appData;
    } else {
      const file = await pickFileWithInput();
      const appData = await readAppDataFromFile(file);

      currentData = appData;
      isDirtyState = true;
      notifyChange();

      return appData;
    }
  } catch (err: any) {
    if (err instanceof StorageError) throw err;

    if (err?.name === 'AbortError') {
      throw new StorageError('Import cancelled', STORAGE_ERROR_CODES.USER_CANCELLED, err);
    }

    throw new StorageError('Failed to import backup', STORAGE_ERROR_CODES.FILE_READ_ERROR, err);
  }
}

/* -------------------------------------------------------------------------------------------------
 * Utility Accessors
 * ----------------------------------------------------------------------------------------------- */

/** Whether the current browser supports the modern File System Access API. */
export function getSupportsFileSystemAccess(): boolean {
  return supportsFileSystemAccess;
}

/** Filename of the currently open file (if any). */
export function getCurrentFileName(): string | null {
  return currentFileHandle?.name ?? null;
}

/** Clear the current working file handle (does not clear in-memory data). */
export async function forgetCurrentFile(): Promise<void> {
  currentFileHandle = null;
  await clearStoredHandle();
  notifyChange();
}

/** Reset everything to a brand new empty AppData (in-memory only). Useful for testing / reset flows. */
export function resetToNewEmptyData(): AppData {
  currentData = createDefaultAppData();
  currentFileHandle = null;
  isDirtyState = false;
  notifyChange();
  return currentData;
}

/* -------------------------------------------------------------------------------------------------
 * Settings Management Helpers (Task 11)
 * ----------------------------------------------------------------------------------------------- */

/**
 * Partially update app settings and persist the change to the current file (or export if no handle).
 * Always updates lastModified and marks dirty + notifies listeners.
 */
export async function updateAppSettings(updates: Partial<AppSettings>): Promise<void> {
  const data = getAppData();
  data.settings = {
    ...data.settings,
    ...updates,
  };
  data.meta.lastModified = new Date().toISOString();
  isDirtyState = true;
  notifyChange();

  try {
    await saveToFile();
  } catch (err) {
    // Non-fatal for UX: change is live in memory; user can export manually
    console.error('[fileStorage] updateAppSettings persist failed (change kept in memory):', err);
  }
}

/**
 * Add a new category name to the master list (case-insensitive duplicate check).
 * Returns true if added and persisted.
 */
export async function addCategory(category: string): Promise<boolean> {
  const trimmed = (category || '').trim();
  if (!trimmed) return false;

  const data = getAppData();
  const exists = data.settings.categories.some(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) return false;

  data.settings.categories = [...data.settings.categories, trimmed];
  data.meta.lastModified = new Date().toISOString();
  isDirtyState = true;
  notifyChange();

  try {
    await saveToFile();
  } catch (err) {
    console.error('[fileStorage] addCategory persist failed:', err);
  }
  return true;
}

/**
 * Remove a category from the master list by exact name match.
 * Does NOT prevent removal if category is still referenced by subscriptions
 * (the label stays on those records; it simply disappears from pickers).
 * Returns true if a removal happened.
 */
export async function removeCategory(category: string): Promise<boolean> {
  const data = getAppData();
  const beforeLen = data.settings.categories.length;

  data.settings.categories = data.settings.categories.filter((c) => c !== category);

  if (data.settings.categories.length === beforeLen) {
    return false;
  }

  // Guard against empty master list (keep defaults as safety net)
  if (data.settings.categories.length === 0) {
    data.settings.categories = [...DEFAULT_CATEGORIES];
  }

  data.meta.lastModified = new Date().toISOString();
  isDirtyState = true;
  notifyChange();

  try {
    await saveToFile();
  } catch (err) {
    console.error('[fileStorage] removeCategory persist failed:', err);
  }
  return true;
}
