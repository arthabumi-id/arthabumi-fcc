# PRD v23 — Centang "Lunas" per Transaksi CC + Sembunyikan yang Lunas

Status: **IMPLEMENTED (2026-06-19).** v23 ✅ (centang lunas + sembunyikan) & v23.1 ✅
(rekonsiliasi tagihan: baris dikunci → auto-lunas, tak muncul lagi — Cara 1).
Pending: push index.html + Code.gs + **REDEPLOY Apps Script** (sheet PAID_MARK + markPaid/unmarkPaid/markPaidBatch) + bump sw.js.
Tanggal: 2026-06-19
⚠️ **WAJIB REDEPLOY Code.gs** (sheet + action baru).

---

## 1. Problem
Rincian CC menampilkan semua transaksi sejak awal. Belanja yang tagihannya sudah Eddy bayar tetap
menumpuk di daftar → makin lama makin panjang & susah fokus ke sisa tagihan yang masih berjalan.

Catatan konsep: app menghitung tagihan sbg **saldo berjalan** (`total belanja − total bayar`), TIDAK
ada status "lunas" per transaksi. Jadi butuh penanda baru.

## 2. Keputusan terkunci (Eddy, 2026-06-19)
- Aturan hide = **centang "lunas" manual per transaksi** (bukan FIFO/cutoff). Alasan: kontrol penuh.
- **Tombol massal** "tandai lunas sampai transaksi ini" untuk kurangi beban centang satu-satu.
- Saat hide aktif: **baris pembayaran (Pemasukan ke CC) & reserve TETAP tampil** — hanya belanja
  yang ditandai lunas yang disembunyikan.
- Eddy terima ongkos: redeploy Code.gs + ritual centang rutin + UI baris CC lebih padat.

## 3. Prinsip desain
- Centang "lunas" = **murni penanda tampilan (display filter)**. TIDAK mengubah tagihan, saldo, laba,
  reserve, atau angka apa pun. Sama filosofinya dgn RESERVE_MARK (v20) — lapisan terpisah.
- Independen dari centang "reserve": satu transaksi bisa reserved, lunas, keduanya, atau tidak sama
  sekali. (Reserved = dana disiapkan; Lunas = tagihan sudah dibayar.)

## 4. Scope teknis

### Sheet baru `PAID_MARK` (pola persis RESERVE_MARK)
Kolom: `ID, TXN_ID, CREATED_BY, CREATED_AT`. 1 baris = 1 transaksi ditandai lunas. Lepas = hapus baris.

### Code.gs (WAJIB REDEPLOY)
- `S.PAIDMARK = 'PAID_MARK'`; `HEADERS[S.PAIDMARK]`.
- Action: `markPaid(data{TXN_ID})` (idempotent), `unmarkPaid(data{TXN_ID})`,
  `markPaidBatch(data{TXN_IDS:[]})` (untuk tombol massal — 1 request).
- `getPaidMarks`; sertakan `paidMarks` di `getBundle` & `getAllData`. Auto-create sheet (pola markTxn).

### Client (index.html)
- `state.paidMarks` = array/Set TXN_ID (di syncAll/forceRefresh/saveLocal/loadOffline, pola `marks`).
- Helper: `isPaid(id)`, `togglePaid(id)`, `markPaidUntil(txnId, ccNama)` (kumpulkan semua TXN_ID
  belanja CC dgn tanggal ≤ txn target yang belum lunas → `markPaidBatch`).
- **Drawer Detail Akun CC** (`openAccountDetail('cc')` / `renderDetail`):
  - Toggle atas: **"Sembunyikan yang lunas"** (default OFF). State disimpan sementara (window var).
  - Tiap baris belanja CC (Pengeluaran, non-transfer/reserve): pil kecil **"☐ lunas / ✅ lunas"** di
    samping pil reserve yang sudah ada. + ikon kecil "tandai s/d sini".
  - Saat toggle ON: sembunyikan baris yang `isPaid(id)`. Baris Pemasukan/Transfer/Reserve tetap tampil.
  - Ringkasan: "X belanja lunas disembunyikan" saat toggle ON.

## 5. Success Criteria
- Centang lunas tersimpan & sinkron antar perangkat (muncul sama di HP lain setelah Sync).
- Toggle "Sembunyikan yang lunas" benar-benar menyembunyikan hanya belanja yang ditandai lunas;
  pembayaran & reserve tetap tampil.
- Tombol "tandai lunas s/d sini" menandai semua belanja ≤ tanggal itu dalam 1 aksi.
- Tagihan, saldo, reserve, laba TIDAK berubah sama sekali oleh centang lunas.
- Centang lunas independen dari centang reserve (tidak saling memengaruhi).

## 6. Execution Plan
1. Code.gs: tambah sheet/HEADERS/action/getBundle. Verifikasi `node --check Code.gs` (atau review).
2. index.html: state + helper + UI toggle/pil/tombol massal. Verifikasi `node` vm.Script.
3. Backup pre-v23. Push (GitHub Desktop) **+ REDEPLOY Apps Script**. Bump `sw.js`.
4. Uji: centang → sync HP lain; toggle hide; tombol massal; pastikan tagihan tak berubah.

## 7. Open Questions
- **Q1.** Toggle "Sembunyikan yang lunas" default **OFF** saat buka rincian? (Rekomendasi: OFF —
  supaya tidak kaget transaksi "hilang"; Eddy nyalakan sendiri saat mau rapi.)
- **Q2.** Centang lunas hanya di **Detail Akun CC**, atau juga halaman Transaksi? (Rekomendasi:
  Detail Akun CC dulu — fokus, konsisten dgn centang reserve v20.)
- **Q3.** Tombol massal = **"tandai lunas s/d transaksi ini"** per baris (Rekomendasi), atau cukup
  satu tombol global "tandai semua lunas"? (Per-baris lebih fleksibel untuk pembayaran sebagian.)

## 8. Risiko / catatan
- Dua langkah deploy (push + redeploy Apps Script).
- UI baris CC kini punya 2 pil (reserve + lunas) → di HP sempit; akan dibuat ringkas (pil kecil).
- Centang yatim bila transaksi dihapus → diabaikan saat render (sama spt marks).
- Filter hanya di tampilan; export Excel/laporan tetap memuat semua (tidak terpengaruh) — kecuali
  diminta lain.

---
SIGN-OFF: jawab Q1–Q3 (atau "pakai rekomendasi") lalu ketik **"Proceed"**.
