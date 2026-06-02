# FCC Arthabumi — Context & Status (v3)

## Apa itu FCC?
Financial Control Center — web app pribadi Eddy untuk tracking keuangan bisnis Arthabumi (kontraktor/interior). Single-user, dihosting di GitHub Pages.

**URL:** https://arthabumi-id.github.io/arthabumi-fcc/
**GitHub repo:** https://github.com/arthabumi-id/arthabumi-fcc
**Folder lokal:** `E:\Mirror\Claude Cowork\Analisis Arthabumi Fcc v.2\arthabumi-fcc\`
**Google Sheets DB:** https://docs.google.com/spreadsheets/d/1BYXyk0XlyeuelrIa6KKch8A79z7yvOG3_RjSxft7JTo/edit

## Arsitektur (PENTING)
```
Web App (HP/browser)  ⇄  Apps Script (Code.gs, Web App URL)  ⇄  Google Sheets (database)
        ↑ localStorage = cache lokal (salinan utk tampil cepat/offline), BUKAN sumber kebenaran
```
- **Google Sheets = database utama.** Web tidak punya DB sendiri.
- Baca: tekan Sync → app panggil `getBundle` → Apps Script baca Sheets.
- Tulis: input di app → Apps Script `appendRow`/`updateRow` ke Sheets.

## Stack
- Frontend: 1 file `index.html` — vanilla JS, Chart.js, Tabler Icons
- Backend: Google Apps Script `Code.gs` (deployed sebagai Web App)
- Database: Google Sheets (TRANSAKSI, MASTER_BANK, MASTER_CC, MASTER_PROJECT, MASTER_KATEGORI, TRANSFER_LOG, RESERVE_LOG)
- Auth: PIN 4 digit (`VALID_PINS = ['1234','5678','9999']`) — disimpan di localStorage
- PWA: manifest.json + sw.js (cache version: **fcc-arthabumi-v4**, network-first untuk app shell)

## Skema kolom Sheets (jangan diubah nama/urutan headernya)
- TRANSAKSI: `ID, TANGGAL, JENIS, PROJECT, REKENING, KATEGORI, NOMINAL, NOTES, TIPE_LOG, CREATED_BY, CREATED_AT`
- MASTER_BANK: `ID, NAMA, TIPE, BANK, SALDO_AWAL, CREATED_AT`
- MASTER_CC: `ID, NAMA, BANK, LIMIT, JATUH_TEMPO, CREATED_AT`
- MASTER_PROJECT: `ID, NAMA, KLIEN, TGL_MULAI, STATUS, NILAI_CONTRACT, CREATED_AT`
- MASTER_KATEGORI: `ID, KELOMPOK, NAMA, TIPE, CREATED_AT`
- TRANSFER_LOG: `ID, TANGGAL, DARI, KE, NOMINAL, NOTES, REF_ID, CREATED_BY, CREATED_AT`
- RESERVE_LOG: `ID, TANGGAL, DARI_REKENING, UNTUK_CC, NOMINAL, NOTES, CREATED_BY, CREATED_AT`

## ⭐ Perubahan v3 (scalability + cleanup) — Juni 2026
Tujuan: app tahan dipakai bertahun-tahun walau transaksi makin banyak.

### Server (Code.gs)
- **`getSummary`** — hitung agregat SEKALI-JALAN atas seluruh TRANSAKSI: `acct` (masuk/keluar/count per rekening), `proj` (per project), `month` (per bulan), `katExp` (per kategori pengeluaran), `count`. Di-cache 6 jam via `CacheService` (key `fcc_summary_v3`), otomatis dibuang tiap ada write.
- **`getBundle`** — 1 round-trip: master + transfers + reserves + summary + **txn 120 hari terakhir saja** (`RECENT_DAYS=120`).
- **`getTxns`** — terima param `since` / `until` / `rekening` / `limit`.
- **`clearCache`** — buang cache summary lalu balikin bundle segar (dipakai tombol "Hitung Ulang Total").
- Cleanup: `forceSeedMaster` jadi alias `seedMasterData` (hapus duplikasi), seed pakai batch `setValues`, `updateRow` tulis 1 baris sekaligus.
- Legacy `getAll` masih ada (kompat / fallback).

### Client (index.html)
- `state.summary` + `state.txnsSince` baru. Dashboard/chart/saldo render dari **summary**, bukan dari semua txn.
- Accessor `getSaldo/getCCOut/getProjCF/monthAgg/acctCount` **prefer summary, fallback hitung dari txns** (offline / API lama).
- `applySummaryDelta(t, sign)` — patch summary lokal saat add/edit/hapus (mirror logika getSummary), supaya dashboard akurat seketika termasuk offline.
- `syncAll` pakai `getBundle` (fallback `getAll`). localStorage cuma simpan summary + txn recent → lolos limit ~5MB.
- Halaman Transaksi: tombol **"Muat transaksi lebih lama"** (`loadMoreTxns`, mundur 12 bln per klik).
- Account Detail: fetch riwayat penuh akun **on-demand** saat drawer dibuka.
- Settings: tombol **"Hitung Ulang Total"** (`forceRefresh`) → panggil `clearCache`.

## ⭐ Perubahan v4 (UX, bugfix, fitur) — Juni 2026
### Bugfix
- **Tanggal mundur 1 hari (FIXED):** kolom tanggal di Sheets dibaca Apps Script sbg objek `Date` (tengah malam zona Sheets) → `JSON.stringify` jadi ISO UTC → app `slice(0,10)` mundur 1 hari. Fix di `Code.gs`: `normalizeCell(v,tz)` ubah `Date` → `yyyy-MM-dd` pakai `ss.getSpreadsheetTimeZone()`, dipakai di `getSheet` & `getSummary` (agregat bulan ikut diperbaiki).
- **Total Saldo Bank warna (FIXED):** dulu hardcode class `pos` (selalu hijau). Sekarang warna dinamis ikut tanda (merah bila negatif).

### Tambah Transaksi
- **Kategori auto-tambah:** dropdown kategori punya opsi "➕ Tambah kategori baru…" → muncul input nama + pilih KELOMPOK (TIPE ikut Jenis transaksi). Saat simpan, kategori baru ditulis ke MASTER_KATEGORI via `addKat` lalu dipakai. Cek duplikat (case-insensitive).
- **Format ribuan otomatis:** semua input nominal (txn, transfer, reserve, nilai kontrak, limit CC) kini `type=text inputmode=numeric` + `fmtMoneyInput()` (titik ribuan saat ketik). Saat simpan dibersihkan via `unfmtNum()`. Prefill pakai `fmtInput()`. (Jatuh Tempo tetap angka biasa.)
- **Peringatan project:** kalau kategori berkelompok PROJECT tapi Project belum dipilih → konfirmasi "Simpan tanpa project?".
- `saveDrawer` txn kini juga panggil `renderProject()` supaya tab Project update seketika.

### Project
- Kartu project: tambah kolom **Keluar** (grid jadi 2×2: Nilai, Masuk, Keluar, Sisa CF).
- Kartu project **bisa di-tap** → drawer **Detail Project** (`openProjectDetail(id)`): ringkasan Masuk/Keluar/Sisa + donut komposisi pengeluaran per kategori + daftar transaksi. Data txn diambil penuh via `getTxns?project=` (ada client-side filter sbg guard utk backend lama). Tombol Edit pakai `event.stopPropagation()`.

### Transfer
- Riwayat Transfer: tombol **edit** & **hapus** per baris. Hapus = buang 3 baris terkait (2 TXN + 1 TRANSFER_LOG) via REF_ID. Edit = prefill form, hapus lama + buat baru saat Update. Server action baru: **`deleteTransfer`** (cocokkan REF_ID di TRANSFER_LOG, dan substring refId di NOTES TXN).

### Komposisi pengeluaran (donut per kategori)
- Helper: `katComposition(txns)`, `donutCardHTML(canvasId,entries)`, `buildKatDonut()`, `detailTxnCard(t)`, palet `KAT_PALETTE`.
- Disisipkan di **Detail Akun** (ikut filter) & **Detail Project**. Tidak ada tab baru — semua lewat drawer.

### Server action baru di Code.gs v4
- `deleteTransfer` (POST), filter `project` di `getTxns`. **Wajib redeploy** Apps Script setelah update Code.gs.

### Belum dikerjakan (ditawarkan, user tunda)
- **Optimistic save:** input terasa lambat karena `await apiPost` blokir UI nunggu Apps Script (1–3 dtk). Solusi: render lokal dulu, kirim server di background. Belum diterapkan.

## ⭐ Perubahan v5 (Import Excel) — Juni 2026
Tujuan: pindahkan catatan manual ke FCC secara massal lewat file Excel.

### Template
- `Template-Import-Transaksi-FCC.xlsx` (di root folder project). 3 tab: **Transaksi** (input: TANGGAL, JENIS, PROJECT, REKENING, KATEGORI, NOMINAL, NOTES + dropdown JENIS + 4 baris contoh abu-abu), **Petunjuk**, **Referensi** (daftar rekening/project/kategori valid + skema MASTER_BANK & MASTER_CC).

### Client (index.html)
- CDN baru: **SheetJS** (`xlsx@0.18.5`).
- Settings: tombol **Import Excel** → file input tersembunyi (`#importFile`) → `handleImportFile()`.
- Alur: `handleImportFile` (FileReader→XLSX.read, cellDates:true, ambil sheet /transaksi/i) → `parseImport` (match header case-insensitive, validasi per baris, normalisasi tanggal via `impDateISO` utk serial/Date/string dd-mm-yyyy & yyyy-mm-dd, `unfmtNum` nominal) → `showImportPreview` (drawer custom, `drawerMode='import'`: hitung valid/error/total + daftar project & kategori baru) → `confirmImport` (POST `addTxnBatch` lalu `syncAll`).
- **Validasi REKENING ketat:** harus persis ada di MASTER_BANK/MASTER_CC, kalau tidak baris **ditolak & dilaporkan** (tidak auto-buat rekening). PROJECT & KATEGORI baru **auto-dibuat** (kategori: kelompok ditebak dari JENIS — Pemasukan→PEMASUKAN, Pengeluaran→OPERASIONAL).

### Server (Code.gs) — action baru `addTxnBatch` (POST). **Wajib redeploy.**
- Payload `{ txns:[...], newProjs:[...], newKats:[...], USER }`. Tulis master baru + transaksi pakai `setValues` (1 tulis, cepat utk banyak baris). ID prefix `IMP/PRI/KI`. `invalidateSummary` jalan otomatis di doPost → summary fresh saat sync berikutnya.

## ⭐ Perubahan v6 (Laba bersih + rekap project selesai) — Juni 2026
Murni client-side (index.html), TIDAK menyentuh Code.gs.
- Helper baru: `projProfit(nama)` (laba=masuk-keluar, margin=laba/masuk*100, pakai `getProjCF` yg sumbernya `summary.proj` → akurat lintas waktu), `doneProjectsProfit()` (agregat semua project STATUS='Selesai'), `projLastDate(nama)` (tanggal txn terakhir project dari txns termuat, fallback TGL_MULAI — dipakai utk urutan rekap).
- **Dashboard:** kartu metrik baru "Laba Bersih · Project Selesai" (nominal + margin% + jumlah project). Definisi laba bersih = hasil project yg sudah selesai saja (keputusan user).
- **Kartu project:** tiap kartu kini ada baris "Laba Bersih" + margin%. Detail project (drawer) juga ada banner laba+margin.
- **Render Project dipecah:** `projCard(p)` (1 kartu) + `renderProject()` baru. Project STATUS≠Selesai → kartu penuh (section "Project Berjalan"). Project STATUS='Selesai' → **rekap list ringkas** (section "Project Selesai · Rekap") diurut `projLastDate` desc, tiap baris klik → `openProjectDetail` (drawer lama). "Selesai" = STATUS Selesai (tidak ada field tanggal selesai; user konfirmasi cukup status).

## Boleh edit manual di Google Sheets? BOLEH, dengan aturan:
1. Jangan ubah baris HEADER / nama kolom / nama tab.
2. Tiap baris WAJIB punya `ID` unik (kalau nambah manual, isi sendiri mis. `MAN001`) — kalau kosong, edit/hapus dari app tak bisa nemu baris.
3. `REKENING` harus PERSIS sama dengan NAMA di MASTER_BANK/MASTER_CC (beda spasi = saldo tidak kehitung).
4. `TANGGAL` = `YYYY-MM-DD`, `NOMINAL` = angka polos (tanpa Rp/titik), `JENIS` = `Pemasukan`/`Pengeluaran`.
5. Setelah edit manual, dashboard bisa belum berubah s/d 6 jam (cache). Tekan **Settings → Hitung Ulang Total** untuk paksa update.

## Format angka
- `fmt(n)` → `Rp 36.195.753` (sudah include "Rp" — JANGAN tambah prefix "Rp" lagi, ini sumber bug "Rp Rp")
- `fmtS(n)` → ringkas: `1,5 M`, `36 jt`

## Cara deploy perubahan (2 langkah TERPISAH)
1. **File (index.html, sw.js, Code.gs, dll):** GitHub Desktop → Commit → Push origin. Tunggu 1-2 menit. (sw.js v4 auto-bersih cache lama, update ke-pull otomatis.)
2. **Backend Code.gs (TIDAK ikut GitHub):** Apps Script editor → paste isi Code.gs → **Deploy → Manage Deployments → Edit (pensil) → Version: New version → Deploy**. Pastikan EDIT deployment lama (bukan bikin baru) supaya Web App URL tetap sama.
   - Tidak perlu Run fungsi manual apa pun. `initSheets`/`forceSeedMaster` idempotent (skip kalau data sudah ada).
   - Sebelum Code.gs di-redeploy, app tetap jalan via fallback `getAll` (tapi belum dapat manfaat skala).

## Kartu Kredit
CC-BCA-KRIS (BCA 431657XXXX0015), CC-BCA-JCB, CC-CIMB-JCB (X10), CC-CIMB-ACCOR (X88), CC-CIMB-WORLD, CC-HSBC-7118, CC-HSBC-VISA, CC-MAYBANK-BMW (3004), CC-MAYBANK-INFINITE, CC-BNI-JCB (0915), CC-DANAMON-JCB.

## Known issues / catatan
- API URL hilang jika "Clear site data" → set ulang via long-press title → Settings → Set API URL.
- Edit transaksi LAMA dari Account Detail: txn yg di luar window recent mungkin tidak ada di `state.txns` → fitur edit bisa meleset. (belum di-handle penuh; aman utk txn yg sedang tampil.)
- Tier 2 (belum dikerjakan, baru perlu saat sheet > ~5.000 baris): arsip per tahun (`TRANSAKSI_2026`, dst) supaya sheet aktif tetap kecil.

## Catatan kerja untuk chat baru
- Mount Linux (bash) sering LAG menampilkan file besar yg baru ditulis Write tool — verifikasi syntax via file asli (Read tool) atau copy ke folder outputs. File asli di `E:\...\arthabumi-fcc\` = yg di-track GitHub Desktop.
- Test syntax JS: `node --check` (extract blok `<script>` dari index.html).
- Jangan `git commit` via bash — user push manual via GitHub Desktop.
