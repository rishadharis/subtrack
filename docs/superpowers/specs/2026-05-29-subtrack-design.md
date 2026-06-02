# Subtrack — Personal Digital Subscription Tracker
## Design Document

**Date:** 2026-05-29  
**Status:** Draft for User Review  
**Author:** Grok (based on collaborative brainstorming)  
**Project:** subtrack

---

## 1. Executive Summary

Subtrack is a lightweight, privacy-first Progressive Web App (PWA) for individuals and families to manage digital subscriptions. 

It focuses on three core needs:
- Easy input of subscription data
- Reliable due date awareness (strong in-app + calendar export)
- Clear monthly expense analysis

**Key Architectural Decisions:**
- Fully local storage using a single portable user-managed file (`.subtrack`)
- No login, no cloud backend, no accounts
- Progressive Web App (installable, offline-capable)
- Extreme focus on minimal bundle size and fast load time
- Tech stack: Svelte 5 + Vite + Tailwind with very minimal dependencies

The product prioritizes speed, simplicity, and user control over data.

---

## 2. Goals & Success Criteria

**Primary Goals:**
- Make it dead simple to track all digital subscriptions in one place.
- Never be surprised by a renewal.
- Understand exactly how much is being spent monthly and where the money goes.
- Work reliably without internet after initial load.
- Feel fast and lightweight even on modest devices.

**Success Criteria (MVP):**
- User can add/edit subscriptions in under 20 seconds.
- User can see upcoming renewals within 3 seconds of opening the app.
- All agreed analysis features are available and useful.
- Export to calendar (.ics) works reliably.
- Full data portability via single file (backup & multi-device transfer).
- First load + interactive under 2.5s on average mobile connection (target).

---

## 3. Constraints & Non-Functional Requirements

| Constraint                  | Requirement                                      |
|----------------------------|--------------------------------------------------|
| **Data Storage**           | Fully local, single portable file, no cloud      |
| **Authentication**         | None (no accounts, no login friction)            |
| **Performance**            | Minimal bundle size, fast load, lightweight      |
| **Platform**               | Progressive Web App (PWA)                        |
| **Offline**                | Core functionality must work offline             |
| **Multi-device**           | Via manual file transfer (user responsibility)   |
| **Reminders**              | In-app + .ics calendar export (no push notifications) |
| **Language**               | Bahasa Indonesia (primary)                       |
| **Target Devices**         | Modern browsers on desktop + mobile              |

**Explicit Non-Goals (for MVP):**
- Multi-user / team features
- Cloud sync or real-time collaboration
- Email or push notification reminders
- Bank/statement import
- Recurring payment detection from external sources

---

## 4. Core Features

### 4.1 Subscription Management
- Add, edit, delete subscriptions
- Core fields:
  - Nama layanan
  - Kategori (Streaming, Productivity, Cloud, AI, Gaming, Lainnya, etc.)
  - Harga + Mata Uang (IDR primary, support others)
  - Siklus pembayaran (Bulanan / 3 Bulan / Tahunan / Custom)
  - Tanggal mulai
  - Tanggal jatuh tempo berikutnya (auto-calculated)
  - Status (Active / Paused / Cancelled)
  - Auto-renew (boolean)
  - Catatan
  - URL / Link
  - Tags (free form)

### 4.2 Reminders & Calendar
- Dedicated "Reminders" view showing subscriptions due soon (7/14/30 days)
- Color-coded urgency
- One-click **Export to Calendar** (.ics file generation for Google Calendar, Outlook, Apple Calendar, etc.)
- Strong in-app visibility of upcoming payments on Dashboard and Reminders screen

### 4.3 Monthly Expense Analysis (Full Set)
- Ringkasan bulanan (total, active count, due soon, average)
- Tren pengeluaran (6–12 month bar/line chart)
- Breakdown per kategori (pie/donut or bars)
- Proyeksi pengeluaran (3–6 bulan ke depan)
- Top expensive subscriptions
- Exportable reports (CSV / Excel / PDF)

### 4.4 Data Portability & Backup
- Single file format (`.subtrack` — clean JSON with version)
- Export / Download current data
- Import / Restore from file
- Clear UI for file management in Settings

---

## 5. Information Architecture

**Main Sections (5):**

1. **Dashboard** (Home)
   - Quick financial overview
   - Upcoming renewals (prominent)
   - Light trend + category summary

2. **Subscriptions**
   - Full list with search + filters
   - Add / Edit form
   - Bulk actions (future)

3. **Reminders**
   - Focused list of due subscriptions
   - Large "Export ke Kalender" action

4. **Analytics**
   - All analysis features with filters (month/year)

5. **Settings**
   - File backup/restore
   - Manage categories & tags
   - App preferences (currency default, theme, etc.)
   - About & data info

**Navigation:**
- Mobile: Bottom tab bar (5 items)
- Desktop: Left sidebar (collapsible) or top nav
- Fast client-side transitions (SPA)

---

## 6. Data Model

Single root object stored in the `.subtrack` file:

```json
{
  "version": 1,
  "meta": {
    "createdAt": "...",
    "lastModified": "...",
    "appVersion": "..."
  },
  "subscriptions": [
    {
      "id": "uuid",
      "name": "Netflix",
      "category": "Streaming",
      "price": 169000,
      "currency": "IDR",
      "billingCycle": "monthly",
      "startDate": "2024-01-15",
      "nextDueDate": "2026-06-15",
      "status": "active",
      "autoRenew": true,
      "notes": "",
      "url": "https://...",
      "tags": ["family"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "settings": {
    "defaultCurrency": "IDR",
    "categories": ["Streaming", "Productivity", ...],
    "theme": "system"
  }
}
```

All date calculations (next due date) happen client-side.

---

## 7. Key User Flows

### File Handling (Critical)
- On first open: Create new empty data file or import existing
- User can explicitly "Download Backup" at any time
- "Restore from File" replaces current data (with confirmation)
- App can suggest periodic backup

### Adding a Subscription
- Fast form (minimal fields first, advanced collapsed)
- Auto-calculate next due date based on billing cycle + start date
- Immediate reflection on Dashboard and Reminders

### Export to Calendar
- User goes to Reminders → clicks "Export ke Kalender"
- Generates `.ics` file containing all upcoming (or selected) renewals as recurring events
- User downloads and imports into their calendar app once (or re-exports periodically)

---

## 8. Major Screens (High-Level)

### Dashboard
- 4 summary metric cards
- "Akan Jatuh Tempo dalam 30 Hari" list (max 5, urgent first)
- Mini 6-month trend
- Light category breakdown
- Prominent + Add button

### Subscriptions List + Form
- Clean table/list view
- Powerful search + category/status filters
- Modal or dedicated view for Add/Edit form (fast)

### Reminders
- Sorted list by urgency
- Clear visual indicators
- Primary action = Export .ics

### Analytics
- Tabs or sections for each analysis type
- Date range filters (month/year)
- All charts (lightweight implementation)
- Export buttons for reports

### Settings
- File management section (most important)
- Category management
- Simple preferences

---

## 9. Technical Architecture

**Chosen Stack (Performance-First):**
- **Svelte 5** (runes) + **Vite**
- **Tailwind CSS**
- **Minimal dependencies only** (date-fns or native, Chart.js or lighter alternative for charts, file handling via native APIs)
- PWA via `vite-plugin-pwa`
- Client-side only (no backend)

**Data Storage Strategy:**
- Primary: File System Access API (where supported) for native file feel
- Fallback: Traditional download/upload of `.subtrack` JSON file
- All data lives in memory after load → extremely fast UI

**Performance Tactics:**
- Aggressive code splitting and tree-shaking
- Avoid heavy UI/component libraries
- Small chart library or custom SVG where possible
- Preload critical paths only
- Target initial bundle < 150KB gzipped

---

## 10. Performance & Lightweight Strategy

- First Contentful Paint target: < 1.2s
- Time to Interactive target: < 2s on 4G
- Very strict dependency audit on every addition
- Prefer native browser APIs over libraries
- Charts will be implemented with minimal footprint

---

## 11. Risks & Trade-offs

| Risk                              | Mitigation                                      |
|-----------------------------------|-------------------------------------------------|
| User forgets to backup file       | Clear UI nudges + last backup date display      |
| .ics export becomes outdated      | Clear instructions + easy re-export             |
| Browser storage limitations       | File-based approach (not localStorage only)     |
| Feature creep                     | Strict MVP scope + "later" list                 |
| Performance regression            | Regular bundle analysis in development          |

---

## 12. Next Steps (After Approval)

1. User reviews and approves this design document (with any changes).
2. Create detailed implementation plan using `writing-plans` skill.
3. Begin development in small, verifiable increments.

---

**Document End**

This design reflects all decisions made during the collaborative brainstorming phase, with bias toward speed, minimal bundle size, simplicity, and full feature completeness within the agreed constraints.
