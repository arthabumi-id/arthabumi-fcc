# PRD v20 — Centang Reserve Manual per Transaksi CC + Bank Reserve per Kartu

Status: **FINAL — keputusan terkunci, menunggu "Proceed".** Belum ada kode.

## KEPUTUSAN TERKUNCI (Eddy)
- Q1 → Centang tampil di **Detail Akun CC saja** (belum di halaman Transaksi).
- Q2 → **Perlu** ringkasan "ditandai manual Rp X" juga di **kartu Master CC** (bukan cuma drawer).
- Q3 → **Kasih indikator** "manual ✓" di strip v19.3.
- Simpan: **Google Sheets** (sinkron). → Code.gs + redeploy.
- **TAMBAHAN (Fitur B): Rekening penyimpan reserve bisa diatur PER KARTU CC** (default per kartu),
  supaya tidak berantakan. Tetap bisa di-override per transaksi (melengkapi v18, bukan membatalkan).

## 1. Problem (kata Eddy)
"Saya transfer dana reserve secara **akumulasi** (sekali transfer untuk beberapa belanja CC sekaligus).
Saya mau bisa **mencentang transaksi CC mana saja yang sudah saya buatkan reserve**, biar SAYA
sendiri ingat mana yang sudah, mana yang belum."

Sifat: **penanda pribadi / aide-mémoire.** SENGAJA lepas dari pot reserve app (keputusan Eddy:
"penanda manual saja"). Tersimpan di Google Sheets supaya sinkron antar perangkat & permanen.

## 2. Keputusan terkunci (Eddy)
- Model: **penanda manual** (bukan auto-buat reserve). Centang ≠ menggerakkan uang/earmark.
- Simpan: **Google Sheets** (sinkron, permanen). → perlu Code.gs + redeploy.
- Mitigasi "centang bohong": ringkasan "ditandai manual Rp X" ditampilkan **berdampingan**
  dengan reserve asli (reserveFunds) supaya selisih kelihatan.

## 3. Scope teknis
### Sheet baru `RESERVE_MARK` (wajib redeploy Code.gs)
Kolom: `TXN_ID, CC, NOMINAL, CHECKED_AT, CREATED_BY`. 1 baris = 1 transaksi yang dicentang.
Lepas centang = hapus barisnya. (Sheet terpisah → TIDAK menyentuh skema TRANSAKSI.)

### Code.gs — action baru (wajib redeploy)
- `markTxn(data{TXN_ID, CC, NOMINAL})` → tulis 1 baris RESERVE_MARK (idempotent: skip bila sudah ada).
- `unmarkTxn(data{TXN_ID})` → hapus baris RESERVE_MARK by TXN_ID.
- Masuk `getBundle`/`getAllData` sbg `marks` (daftar TXN_ID tercentang). Auto-create sheet pola KASBON.

### Client (index.html)
- `state.marks` = Set TXN_ID (di syncAll/forceRefresh/saveLocal/loadOffline). Helper `isMarked(id)`.
- **Toggle per baris transaksi CC** (di Detail Akun CC + halaman Transaksi, hanya REKENING=CC):
  kotak ☐/✅. Tap → optimistic: update state + bgPost `markTxn`/`unmarkTxn`. Baris tercentang
  dapat chip hijau "✅ reserve".
- **Ringkasan per kartu** (Detail Akun CC + opsional kartu Master CC): "Ditandai manual: Rp X
  (N transaksi)" diletakkan **dekat** angka reserve asli (`res:`), supaya mudah dibanding.
- Tidak mengubah `unreservedCC`/strip v19.3 (penanda manual = lapisan terpisah, informatif).

### Fitur B — Bank reserve per kartu (wajib redeploy Code.gs)
- **Skema:** tambah kolom **`RESERVE_BANK`** di AKHIR sheet `MASTER_CC` (tidak mengubah urutan
  kolom lama → patuh aturan). Code.gs HEADERS[MASTER_CC] + read/write `updateRow`/`addRow` disesuaikan.
  Baris CC lama yang kosong RESERVE_BANK → otomatis pakai default global (`defaultHoldingBank`).
- **Client:** form Tambah/Edit Kartu Kredit (`openDrawer('cc')`/`editCC`/`saveDrawer` cc) tambah
  dropdown **"Rekening penyimpan reserve"** (isi: daftar bank, default = `defaultHoldingBank`).
- Helper baru `ccHoldingBank(ccNama)` = `cc.RESERVE_BANK || defaultHoldingBank()`. Dipakai sebagai
  **default** dropdown "Simpan di rekening" di: form Reserve (`reserveNow`/tab Reserve), Beli Cicilan,
  Ubah jadi Cicilan, Bayar (ambil dari reserve). Tetap bisa diganti manual per transaksi.

## 4. Success Criteria
- Buka Detail Akun CC → tiap belanja bisa dicentang; status tersimpan & sinkron (muncul sama di
  HP lain setelah Sync).
- Ringkasan "ditandai Rp X" akurat = jumlah nominal transaksi tercentang kartu itu.
- Centang/lepas terasa instan (optimistic), tidak blokir UI.
- Penanda TIDAK mengubah saldo, laba, reserveFunds, atau strip — murni penanda.

## 5. Open Questions
- Q1: Centang ditampilkan di **Detail Akun CC saja**, atau **juga di halaman Transaksi** (semua
  CC campur)? (Rekомендasi: Detail Akun CC dulu — paling fokus; Transaksi nanti bila perlu.)
- Q2: Perlu kah baris ringkasan ditambah di **kartu Master CC** (bukan cuma di drawer detail)? 
- Q3: Mau ada indikator di strip v19.3 ("manual ✓") atau biarkan terpisah penuh?

## 6. Risiko / catatan
- Penanda manual bisa beda dari reserve asli (memang by design) → mitigasi: tampilkan berdampingan.
- Wajib 2 langkah deploy (push file + redeploy Apps Script).
- Sheet RESERVE_MARK pakai TXN_ID sebagai kunci; bila transaksi dihapus, baris mark-nya bisa yatim
  (tidak fatal — diabaikan saat render karena txn-nya tak ada).

---
SIGN-OFF: jawab Q1–Q3 (atau "pakai rekomendasi") lalu ketik **"Proceed"**.
