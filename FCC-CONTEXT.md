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
