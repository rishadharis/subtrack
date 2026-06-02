# Subtrack MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast, lightweight, fully local Progressive Web App (PWA) for personal digital subscription tracking with excellent in-app reminders and complete monthly expense analysis, using a single portable `.subtrack` file for data.

**Architecture:** Svelte 5 SPA (Vite) with minimal dependencies. All data lives in a user-managed single JSON file. Heavy use of native browser APIs (File System Access API + fallback). Client-side only. Strong emphasis on tiny bundle size and instant UI updates.

**Tech Stack:**
- Svelte 5 (runes) + Vite
- Tailwind CSS
- vite-plugin-pwa
- Minimal libraries: date-fns (or native where possible), Chart.js (light usage) or custom SVG charts, file-saver / native download

---

## Task 1: Project Scaffolding & Tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `svelte.config.js` (if needed), `tsconfig.json`
- Create: `index.html`, `src/main.ts`, `src/App.svelte`
- Create: `src/app.css`

- [ ] **Step 1.1: Initialize Vite + Svelte 5 project**
```bash
npm create vite@latest . -- --template svelte-ts
```
Expected: Project structure created with Svelte 5 + TypeScript.

- [ ] **Step 1.2: Install core dependencies (keep minimal)**
```bash
npm install tailwindcss @tailwindcss/vite date-fns
npm install -D @types/node
```
(Do NOT install heavy UI libraries)

- [ ] **Step 1.3: Install PWA plugin**
```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 1.4: Configure Tailwind + Vite**
Update `vite.config.ts` to include Tailwind and PWA plugin with sensible defaults for offline + installable PWA.

- [ ] **Step 1.5: Set up basic Tailwind + global styles**
Create `src/app.css` with Tailwind directives + minimal design tokens (focus on clean, fast UI).

- [ ] **Step 1.6: Create initial folder structure**
```
src/
  lib/
    components/
    stores/
    utils/
  routes/          # or use simple state-based navigation first
  App.svelte
```

- [ ] **Step 1.7: Run dev server and verify**
```bash
npm run dev
```
Expected: Clean running app at localhost.

- [ ] **Step 1.8: Commit**
```bash
git init
git add .
git commit -m "chore: initial Svelte 5 + Vite + Tailwind + PWA scaffolding"
```

---

## Task 2: Core Data Model & Types

**Files:**
- Create: `src/lib/types/subscription.ts`
- Create: `src/lib/types/index.ts`

- [ ] **Step 2.1: Define Subscription interface and supporting types**
Write the exact TypeScript interfaces matching the design doc (id, name, category, price, currency, billingCycle, dates, status, autoRenew, notes, url, tags, etc.).

- [ ] **Step 2.2: Define AppData interface** (root structure with version + meta + subscriptions + settings)

- [ ] **Step 2.3: Create constants** (categories list, billing cycles, status options)

- [ ] **Step 2.4: Commit**
```bash
git commit -m "feat: define core data model and types"
```

---

## Task 3: File Storage Layer (The Heart of "Fully Local")

**Files:**
- Create: `src/lib/storage/fileStorage.ts`
- Create: `src/lib/storage/index.ts`

- [ ] **Step 3.1: Implement file handling utilities**
  - Function to generate default empty AppData
  - Function to validate imported data
  - Helper to download data as `.subtrack` file

- [ ] **Step 3.2: Implement File System Access API support** (modern browsers)
  - `openFile()` using `window.showOpenFilePicker`
  - `saveFile()` using `FileSystemFileHandle`
  - Store handle in IndexedDB or memory for persistence within session

- [ ] **Step 3.3: Implement fallback (download/upload)**
  - For browsers without File System Access API or when user prefers simple mode

- [ ] **Step 3.4: Create composable/useFileStorage** (or Svelte 5 rune-based module)
  - Expose: `data`, `loadFromFile`, `saveToFile`, `exportBackup`, `importBackup`, `isDirty`

- [ ] **Step 3.5: Write basic tests** (if using Vitest)
- [ ] **Step 3.6: Commit**

---

## Task 4: Global State & Reactivity

**Files:**
- Create: `src/lib/stores/subscriptions.svelte.ts` (using Svelte 5 runes for minimal overhead)

- [ ] **Step 4.1: Create reactive subscription store** using `$state` and `$derived`
- [ ] **Step 4.2: Implement CRUD operations** (add, update, delete, search, filter)
- [ ] **Step 4.3: Auto-calculate nextDueDate** when billingCycle or startDate changes
- [ ] **Step 4.4: Commit**

---

## Task 5: Navigation & Layout Shell (Lightweight)

**Files:**
- Create: `src/lib/components/AppShell.svelte`
- Create: `src/lib/components/BottomNav.svelte` (mobile)
- Create: `src/lib/components/Sidebar.svelte` (desktop)

- [ ] **Step 5.1: Build responsive shell** with 5 main views controlled by simple currentView state
- [ ] **Step 5.2: Implement bottom navigation** (mobile-first)
- [ ] **Step 5.3: Add basic responsive sidebar** for desktop
- [ ] **Step 5.4: Commit**

---

## Task 6: Dashboard Screen

**Files:**
- Create: `src/lib/components/dashboard/Dashboard.svelte`
- Create: `src/lib/components/dashboard/MetricCard.svelte`
- Create: `src/lib/components/dashboard/UpcomingList.svelte`

- [ ] **Step 6.1: Build 4 metric cards** (Total bulan ini, Aktif, Akan jatuh tempo, Rata-rata)
- [ ] **Step 6.2: Build "Yang Akan Jatuh Tempo" list** (max 5, color coded, urgent first)
- [ ] **Step 6.3: Add very lightweight 6-month trend** (use small Chart.js instance or SVG)
- [ ] **Step 6.4: Add mini category breakdown**
- [ ] **Step 6.5: Wire up " + Tambah" button** to open form
- [ ] **Step 6.6: Commit**

---

## Task 7: Subscription Form (Fast Input)

**Files:**
- Create: `src/lib/components/subscriptions/SubscriptionForm.svelte`

- [ ] **Step 7.1: Build clean, fast form** with all required fields from design
- [ ] **Step 7.2: Implement smart nextDueDate calculation** in the form
- [ ] **Step 7.3: Add simple validation** (name + price required)
- [ ] **Step 7.4: Support both Add and Edit modes**
- [ ] **Step 7.5: Commit**

---

## Task 8: Subscriptions List View

**Files:**
- Create: `src/lib/components/subscriptions/SubscriptionsList.svelte`

- [ ] **Step 8.1: Build searchable + filterable list**
- [ ] **Step 8.2: Add status/category filters**
- [ ] **Step 8.3: Row actions** (Edit, Delete, Pause)
- [ ] **Step 8.4: Commit**

---

## Task 9: Reminders View + .ics Export (Critical Feature)

**Files:**
- Create: `src/lib/components/reminders/RemindersView.svelte`
- Create: `src/lib/utils/icsGenerator.ts`

- [ ] **Step 9.1: Build Reminders view** (sorted by urgency, clear visual treatment)
- [ ] **Step 9.2: Implement .ics generator** (pure client-side, supports recurring events)
- [ ] **Step 9.3: Add prominent "Export ke Kalender (.ics)" button** with good UX/copy
- [ ] **Step 9.4: Allow selecting which subscriptions to export**
- [ ] **Step 9.5: Commit**

---

## Task 10: Analytics Page (All Requested Features)

**Files:**
- Create: `src/lib/components/analytics/AnalyticsView.svelte`
- Create: `src/lib/components/analytics/*.chart.svelte` (keep very small)

- [ ] **Step 10.1: Monthly summary cards**
- [ ] **Step 10.2: Spending trend chart** (6-12 months)
- [ ] **Step 10.3: Category breakdown chart**
- [ ] **Step 10.4: Top expensive subscriptions list**
- [ ] **Step 10.5: Spending forecast** (simple projection)
- [ ] **Step 10.6: Export to CSV** (most important report export first)
- [ ] **Step 10.7: Commit**

---

## Task 11: Settings & File Management

**Files:**
- Create: `src/lib/components/settings/SettingsView.svelte`

- [ ] **Step 11.1: File management section** (Download Backup, Restore from File, last backup info)
- [ ] **Step 11.2: Category management** (add/remove custom categories)
- [ ] **Step 11.3: Basic preferences** (default currency, theme)
- [ ] **Step 11.4: Commit**

---

## Task 12: PWA & Polish

**Files:**
- Modify: `vite.config.ts` (PWA manifest, icons, offline strategy)
- Create: `public/manifest.webmanifest` (or let plugin handle)
- Create: icons (or use simple placeholder first)

- [ ] **Step 12.1: Configure good PWA manifest** (name, icons, start_url, display: standalone)
- [ ] **Step 12.2: Add install prompt UI** (subtle)
- [ ] **Step 12.3: Ensure full offline functionality** for core screens
- [ ] **Step 12.4: Basic mobile polish** (safe areas, touch targets)
- [ ] **Step 12.5: Commit**

---

## Task 13: Final Integration & Hardening

- [ ] **Step 13.1: Wire all views together** in App.svelte using currentView state
- [ ] **Step 13.2: Add global error boundary / toast for file errors**
- [ ] **Step 13.3: Performance audit** (run `npm run build` + analyze bundle size)
- [ ] **Step 13.4: Test critical flows**:
  - Create subscription → appears on Dashboard & Reminders
  - Export .ics and verify it opens in calendar apps
  - Full backup → delete data → restore
  - Works offline after first load
- [ ] **Step 13.5: Final commit** with message "feat: complete Subtrack MVP"

---

## Task 14: Documentation & README

- [ ] **Step 14.1: Write excellent README.md** explaining:
  - What the app is
  - How to run locally
  - How file-based storage works
  - How to export to calendar
  - Privacy note (fully local)
- [ ] **Step 14.2: Commit**

---

## Post-Implementation Notes

After MVP is working:
- Consider adding simple theming (dark mode)
- Add keyboard shortcuts for power users
- Evaluate replacing Chart.js with even lighter solution if bundle is still too big
- Add "last opened" date + gentle backup reminder in Settings

**Plan complete.** All tasks are designed to be small, testable, and commit frequently while strictly respecting the "secepat mungkin, seringan mungkin" requirement from the user.

---

**Next:** After saving this plan, ask the user which execution mode they prefer:
1. Subagent-Driven Development (recommended for quality + speed)
2. Inline execution in this session

Then proceed accordingly.