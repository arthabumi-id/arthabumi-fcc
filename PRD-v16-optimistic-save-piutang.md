# PRD v16 — Optimistic Save (#3) + Piutang Termin & Reminder (#1)

Status: **DRAFT — menunggu sign-off "Proceed"**
Tanggal: 2026-06-03
Author: Claude (untuk Eddy)

---

## Bagian A — #3 Optimistic Save (UX, utang teknis sejak v4)

### Problem
Setiap simpan transaksi/transfer/reserve/kasbon, UI nunggu balasan Apps Script 1–3 detik (blokir). Input terasa lambat dan ragu apakah tersimpan.

### Success criteria
- Setelah tekan Simpan: drawer langsung tutup, dashboard/list langsung ter-update (< 200ms terasa).
- Kirim ke server jalan di **background**. Kalau gagal → muncul toast error + transaksi ditandai "gagal sync / coba lagi", state lokal di-rollback atau di-antri.
- Tidak ada double-write & angka tetap akurat (summary delta sudah ada via `applySummaryDelta`).

### Scope
- Target: `saveDrawer` (txn, transfer, reserve, paycc), `saveKasbon`, `confirmImport` boleh dikecualikan (batch besar tetap blocking + progress).
- Mekanisme: render lokal dulu (sudah ada `applySummaryDelta` + push ke `state.txns`), lalu `apiPost` di background. Tambah antrian retry sederhana di localStorage (`fcc_pending_ops`) — kirim ulang saat sync berikutnya / app dibuka.
- Indikator: badge kecil "menyimpan…" → hilang saat sukses; "gagal, tap untuk ulang" saat error.

### Constraints
- Murni client-side (`index.html`). TIDAK sentuh `Code.gs`. Tidak perlu redeploy.
- ID transaksi sementara dibuat client (`TMP-...`) lalu diganti ID server saat balasan datang — ATAU tetap pakai pola ID server existing dan terima bahwa edit/hapus baris yang masih "pending" di-disable sampai sync sukses (lebih sederhana, dipilih).
- Offline: kalau benar-benar offline, op masuk antrian, tidak hilang.

### Open questions
- A1. Saat op gagal sync permanen (mis. API URL salah), mau auto-rollback dari state atau biarkan tampil dengan tanda merah sampai user perbaiki? (rekomендasi: tampil dengan tanda + tombol "kirim ulang").

---

## Bagian B — #1 Piutang Termin Klien + Reminder

### Problem
Pemasukan kontraktor lumpy & datang dari **termin yang belum dibayar**. FCC hanya catat uang yang sudah masuk. Tidak ada visibilitas "siapa belum bayar, berapa, jatuh tempo kapan". Forecast pemasukan bergantung input manual JADWAL (dobel kerja, mudah lupa).

### Success criteria
- Bisa buat daftar **termin per project** (mis. DP 30%, Progress 40%, Pelunasan 30%) dengan nominal + tanggal jatuh tempo + status.
- Lihat sekilas: total piutang beredar, jatuh tempo minggu ini, yang sudah lewat tempo (overdue).
- Saat termin **ditandai Lunas** → otomatis jadi transaksi Pemasukan ke rekening terpilih (tidak input dobel).
- Termin **belum lunas** dengan jatuh tempo ≤ 90 hari **otomatis masuk Forecast** sebagai proyeksi pemasukan.
- **Reminder banner in-app**: saat buka FCC, tampil daftar termin jatuh tempo minggu ini / overdue + **badge angka di nav Piutang**.

### Scope
**Sheet baru `PIUTANG`** (pola sama seperti KASBON/JADWAL):
`ID, PROJECT, KLIEN, TERMIN, NOMINAL, JATUH_TEMPO, STATUS, TGL_BAYAR, REKENING, REF_ID, NOTES, CREATED_BY, CREATED_AT`
- STATUS = `Belum` / `Lunas` (opsional `Batal`).
- TERMIN = label bebas (mis. "DP", "Progress 1", "Pelunasan").

**Code.gs (wajib redeploy):**
- `S.PIUTANG` + HEADERS + masuk `getBundle`/`getAllData` (`piutang`).
- Action `addPiutang` (POST, auto-create sheet pola KASBON).
- Action `payPiutang` (POST): set STATUS=Lunas, TGL_BAYAR, REKENING → **tulis 1 TXN Pemasukan** (KATEGORI mis. "Pelunasan Termin", TIPE_LOG `Pemasukan` biasa supaya masuk laba project — perlu konfirmasi, lihat B-Q2), simpan REF_ID untuk link.
- Edit/hapus pakai `updateRow`/`deleteRow` generik (sheet:'PIUTANG') seperti JADWAL. Hapus termin yang sudah Lunas juga hapus TXN terkait (cari REF_ID di NOTES) — atau larang hapus yang sudah lunas (lebih aman, dipilih).

**Client (index.html):**
- `state.piutang` (di syncAll/forceRefresh/saveLocal/loadOfflineData).
- Nav baru **Piutang** (ikon `ti-receipt` / `ti-clock-dollar`), badge angka = jumlah termin overdue.
- Halaman `page-piutang` (`renderPiutang`): kartu Total Piutang Beredar + Jatuh Tempo Minggu Ini + Overdue; daftar termin dikelompok per project, diurut jatuh tempo; tiap baris status warna (Belum=amber, Overdue=merah, Lunas=hijau) + tombol **Tandai Lunas** + edit/hapus.
- Drawer `piutang` (`openPiutang`/`savePiutang`): pilih project (datalist dari MASTER_PROJECT, auto-isi klien), label termin, nominal, jatuh tempo, notes. Saat dari Detail Project bisa "pecah nilai kontrak jadi termin" (helper opsional fase 2).
- Drawer/aksi **Tandai Lunas** (`payPiutangUI`): pilih rekening tujuan + tanggal bayar → POST `payPiutang` → syncAll.
- **Reminder banner**: komponen di dashboard atas (`renderPiutangReminder`) — tampil hanya bila ada overdue / due ≤ 7 hari. Badge nav dari `piutangOverdueCount()`.
- **Forecast integration**: `buildForecast` tambah sumber pemasukan dari `state.piutang` (STATUS=Belum, JATUH_TEMPO dalam window) — selain JADWAL. Hindari dobel: pemasukan forecast = JADWAL income + PIUTANG belum lunas.

### Constraints
- TIPE_LOG TXN hasil payPiutang harus masuk laba/komposisi project (beda dari transfer/reserve/kasbon yang dikecualikan). → pakai TIPE_LOG `Pemasukan`.
- Tidak ubah skema sheet existing. Hanya tambah sheet PIUTANG.
- Saldo & laba tetap akurat: piutang Belum TIDAK menyentuh saldo/laba (cuma proyeksi); baru pengaruh saat Lunas (jadi TXN nyata).

### Open questions (butuh jawaban sebelum/di tengah build)
- **B-Q1.** Saat Tandai Lunas, nominal yang masuk = persis nominal termin, atau boleh edit (klien bayar sebagian)? Rekomендasi: default = nominal termin, **boleh diubah**; kalau bayar sebagian → sisa jadi termin baru otomatis? (fase 2, awal cukup nominal penuh).
- **B-Q2.** TXN Pemasukan hasil pelunasan masuk KATEGORI apa? Rekomендasi: kategori "Pelunasan Termin" (kelompok PEMASUKAN) — auto-buat kalau belum ada. Setuju?
- **B-Q3.** Apakah perlu link 1 project ke nilai kontrak (auto-saran pecah termin), atau cukup input termin manual dulu? Rekomендasi: manual dulu (fase 1), auto-pecah fase 2.

---

## Rencana eksekusi (urutan)
1. **#3 Optimistic save** dulu (client-only, cepat, langsung kerasa, tidak perlu redeploy). Test `node --check`.
2. **#1 Piutang**: (a) Code.gs — sheet + addPiutang + payPiutang. (b) Client — state, nav, halaman, drawer, reminder, forecast. (c) Test syntax. (d) Instruksi redeploy + langkah verifikasi.
3. Update FCC-CONTEXT.md jadi v16. Bump sw.js cache (`fcc-arthabumi-v6`).

## Yang TIDAK dikerjakan di v16
- Utang supplier/tukang (AP) — ditunda.
- RAB vs realisasi (#2) — PRD terpisah nanti.
- Push notification PWA — reminder cukup in-app banner/badge.
- Bayar termin sebagian / auto-pecah dari nilai kontrak — fase 2.

---

## Sign-off
Balas **"Proceed"** untuk mulai. Kalau ada Open Question (A1, B-Q1/2/3) yang mau kamu putuskan beda dari rekomендasi, sebut sekalian.
