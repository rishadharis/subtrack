# Subtrack

**Pelacak langganan digital pribadi — ringan, cepat, sepenuhnya lokal.**

Data Anda disimpan di satu file portabel `.subtrack` milik Anda.  
**Tidak ada cloud. Tidak ada akun. Tidak ada server.**

**Prinsip utama:** secepat mungkin, seringan mungkin, dan Anda yang sepenuhnya mengendalikan data.

---

## Apa itu Subtrack?

Subtrack adalah Progressive Web App (PWA) untuk melacak langganan digital pribadi Anda. Dibangun 100% di sisi klien dengan arsitektur **file-first**.

Dua nilai inti aplikasi:

- **Pengingat jatuh tempo yang kuat** — Lihat semua langganan yang jatuh tempo dalam 30 hari ke depan (termasuk yang sudah terlewat) di layar Reminders. Warna urgensi jelas. Ekspor sebagai file `.ics` sungguhan yang bisa diimpor ke Google Calendar, Apple Calendar, Outlook, atau aplikasi kalender apa pun. Event berulang (RRULE) otomatis sesuai siklus pembayaran + alarm 1 hari sebelumnya.
- **Analisis pengeluaran bulanan lengkap** — Dashboard + Analytics view memberikan ringkasan bulanan, grafik tren pengeluaran (SVG murni), breakdown kategori (donut chart), daftar langganan termahal, proyeksi 6 bulan ke depan, dan ekspor CSV siap laporan.

## Fitur Utama

- **Dashboard** — Metrik ringkas (total aktif, estimasi bulanan, upcoming), daftar jatuh tempo mendesak, mini tren 6 bulan, dan breakdown kategori.
- **Subscriptions** — CRUD lengkap + pencarian instan, filter status & kategori, pengurutan otomatis berdasarkan due date. Status Active / Paused / Cancelled. Kategori bisa ditambah/dihapus sendiri. Mendukung tags, catatan, dan URL.
- **Reminders** — Hanya langganan aktif yang jatuh tempo ≤30 hari. Checkbox seleksi granular, tombol besar "Export ke Kalender (.ics)".
- **Analytics** — Kartu ringkasan bulanan + delta, grafik tren SVG (6/12 bulan), donut kategori, top subscriptions, forecast 6 bulan, 3 jenis ekspor CSV (summary, full list, projections).
- **Settings** — Manajemen file yang sangat transparan (Simpan Cadangan, Pulihkan dari File, Buka sebagai File Utama, Lupa File, Mulai Data Baru), pengelolaan kategori custom, preferensi mata uang default, dan tema (system / light / dark) yang langsung diterapkan.
- **PWA** — Bisa di-install ke homescreen atau desktop. Berfungsi offline setelah di-cache. Prompt install yang sopan dan tidak agresif.
- **Kualitas MVP** — Global toast untuk error penyimpanan yang ramah, penanganan tema live, keyboard shortcuts (1-5 untuk pindah view), modal yang bisa ditutup dengan Escape, fokus & a11y dasar, dark mode native, mobile-first dengan bottom nav + desktop sidebar.

Semua perhitungan (next due date, monthly equivalent cost, forecast) berjalan sepenuhnya di perangkat Anda.

## Cara Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka browser di alamat yang muncul (biasanya `http://localhost:5173`).

### Perintah Berguna

| Perintah            | Keterangan                              |
|---------------------|-----------------------------------------|
| `npm run dev`       | Server development dengan hot reload    |
| `npm run build`     | Build produksi (hasil di folder `dist/`) |
| `npm run preview`   | Preview hasil build produksi            |
| `npm run check`     | Type check (Svelte + TypeScript)        |

## Cara Kerja Penyimpanan Berbasis File (.subtrack)

Ini adalah jantung dari Subtrack dan alasan mengapa aplikasi ini berbeda:

- **Satu file portabel** — Seluruh data (langganan + settings) disimpan dalam satu file JSON bernama `*.subtrack`.
- **Anda adalah pemilik data** — Subtrack **hanya** membaca dan menulis file yang Anda pilih sendiri melalui dialog sistem. Tidak ada penyimpanan otomatis data utama di localStorage atau IndexedDB (hanya handle file di browser yang mendukung).
- **Teknologi modern + fallback**:
  - Browser modern (Chrome, Edge, Opera, dll.): menggunakan File System Access API → file handle bisa diingat lintas sesi.
  - Browser lain (Firefox, Safari, dll.): fallback ke pola download/upload klasik (masih 100% berfungsi).
- **Alur kerja sehari-hari**:
  1. Pertama kali buka → data kosong di memori.
  2. Tambah langganan → perubahan ada di memori.
  3. Buka **Settings → Manajemen File** untuk menyimpan (otomatis jadi file `.subtrack`).
  4. Selanjutnya perubahan biasanya otomatis tersimpan ke file tersebut.
- **Backup & multi-perangkat**:
  - **Simpan Cadangan** → membuat salinan bertanggal terpisah kapan saja.
  - **Multi-perangkat**: cukup salin file `.subtrack` (USB, folder terenkripsi, atau sinkronkan secara manual lewat Dropbox / Google Drive / iCloud Drive / Syncthing, dll.). Di perangkat lain: buka file tersebut lewat "Buka sebagai File Utama".
  - **Pulihkan dari File** → memuat isi file lain ke memori saat ini (data lama Anda aman). Berguna untuk merge manual atau recovery.
  - Tanda "dirty" (●) muncul di header ketika ada perubahan belum tertulis ke disk.
- File JSON pretty-printed (mudah dibaca manusia dan di-diff).

**Pesan jujur dari Settings screen (yang juga menjadi filosofi kami):**

> Data Anda hanya ada di file `.subtrack` Anda.  
> Tidak ada cloud. Tidak ada server. Tidak ada akun. Tidak ada sinkronisasi otomatis.  
> Simpan cadangan secara berkala ke lokasi aman.

## Cara Mengekspor Pengingat ke Kalender (.ics)

1. Pergi ke tab **Reminders**.
2. Centang langganan yang diinginkan (atau gunakan "Pilih Semua").
3. Klik tombol besar **Export ke Kalender (.ics)**.
4. Simpan file (contoh: `subtrack-pengingat-20260530.ics`).
5. Impor file tersebut ke Google Calendar / Apple Calendar / Outlook / aplikasi kalender lain.

Yang Anda dapatkan:
- Event seharian (all-day) pada tanggal `nextDueDate`
- Aturan pengulangan (RRULE) yang benar sesuai `billingCycle` (monthly / quarterly / yearly)
- Alarm (VALARM) 1 hari sebelumnya agar muncul di notifikasi kalender
- Deskripsi lengkap: nama, harga (format IDR cantik), siklus, catatan, URL
- Nama kalender: "Subtrack - Pengingat Jatuh Tempo"

File .ics ini telah divalidasi bisa diimpor bersih ke layanan populer.

## Privasi & Keamanan

- **100% lokal & offline-first**. Tidak ada request keluar kecuali saat Anda menjalankan development server.
- Tidak ada akun, tidak ada login, tidak ada telemetry, tidak ada analytics pihak ketiga.
- Data Anda **tidak pernah** meninggalkan perangkat kecuali ketika Anda secara sadar mengekspor (backup `.subtrack` atau `.ics`).
- File `.subtrack` adalah JSON biasa. Anda bebas mengenkripsinya sendiri dengan tools apa pun yang Anda percayai (VeraCrypt, Cryptomator, 7-Zip AES, dsb.).
- Semua kode sumber terbuka — silakan audit sendiri.

Kami membangun Subtrack dengan pendekatan "trustworthy by default", sama seperti tampilan Settings yang sangat jujur kepada pengguna.

## Arsitektur & Stack Teknis

- **UI Framework**: Svelte 5 (runes: `$state`, `$derived`, `$effect`) + TypeScript
- **Styling & Build**: Tailwind CSS v4 + Vite
- **PWA**: `vite-plugin-pwa` (Service Worker auto-update, manifest lengkap, Workbox precaching, prompt install yang sopan)
- **Penyimpanan**: File System Access API + IndexedDB (hanya menyimpan handle, bukan data) + fallback Blob
- **Tidak ada** state management eksternal (Zustand, Redux, dll.)
- **Tidak ada** runtime dependency untuk fitur inti (generator .ics, grafik SVG, kalkulasi tanggal & forecast semuanya pure TypeScript)
- Layout responsif: Bottom navigation (mobile) + collapsible sidebar (desktop)
- Error handling terpusat + friendly Indonesian messages

## Status Saat Ini

**MVP lengkap** (seluruh Tasks 1–13 dari Implementation Plan selesai dan terintegrasi).

- Semua view utama (Dashboard, Subscriptions, Reminders, Analytics, Settings) sudah berfungsi penuh.
- File storage layer sudah di-hardening dengan error codes, graceful fallback, dan global toast.
- Tema, PWA install prompt, modal a11y, dan custom category sudah selesai.
- Build produksi bersih dan siap digunakan.

Subtrack sudah bisa dipakai sehari-hari untuk melacak langganan pribadi dengan rasa tenang karena data benar-benar milik Anda.

## Keterbatasan (Jujur & Transparan)

- **Auto-restore file terakhir** pada startup belum dihubungkan (restoreLastUsedFile ada di storage layer tapi belum dipanggil otomatis di App bootstrap). Anda perlu membuka file secara manual via Settings setelah refresh di beberapa situasi.
- Dukungan persistensi file terbaik di Chromium-based browser. Di Firefox dan Safari Anda akan sering melihat dialog Save/Open (masih sangat andal, hanya kurang "seamless").
- Belum ada notifikasi push atau reminder otomatis di background. Andalkan tampilan in-app + ekspor ke kalender eksternal.
- Billing cycle "custom" saat ini diperlakukan sama seperti monthly (model data belum memiliki field interval khusus).
- Tidak ada fitur impor otomatis dari penyedia layanan (Anda input manual).
- Dirancang untuk penggunaan pribadi (ideal < 100 langganan). Bukan untuk tim atau perusahaan.
- **Anda bertanggung jawab penuh** atas backup dan keamanan file `.subtrack` Anda. Tidak ada "undo" cloud.

Semua keterbatasan di atas diketahui dan direncanakan untuk diperbaiki di iterasi selanjutnya.

## Kontribusi & Pengembangan

Kami menyambut eksplorasi dan masukan. Kode ditulis dengan banyak komentar internal yang menjelaskan konteks task.

Jalankan `npm run check` sebelum mengirim perubahan.

Struktur proyek sederhana dan mudah dipahami:

```
src/
├── App.svelte                 # Root + global toast + theme wiring
├── lib/
│   ├── components/            # Semua UI (Dashboard, Reminders, Analytics, Settings, dll)
│   ├── storage/               # Jantung file .subtrack (fileStorage.ts)
│   ├── stores/                # subscriptionStore (Svelte 5 runes)
│   ├── types/                 # Data model & konstanta
│   └── utils/                 # icsGenerator.ts (pure)
```

---

**Subtrack** — Langganan Anda. Data Anda. Sepenuhnya milik Anda.

Terima kasih telah mencoba. Semoga bermanfaat untuk mengendalikan pengeluaran langganan digital Anda.
