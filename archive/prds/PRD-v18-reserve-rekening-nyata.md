# PRD v18 — Reserve di Rekening Nyata (Holding Account)

Status: **DRAFT — menunggu jawaban Open Questions + "Proceed".** Belum ada kode.

## 1. Problem
Reserve sekarang **virtual**: saat dibuat, saldo bank sumber turun lalu dicatat
sebagai "pot" per kartu — uangnya tidak parkir di rekening nyata mana pun. Eddy
mau reserve CC benar-benar **disimpan di satu rekening nyata** (mis. Seabank Ronah)
supaya saldo di app = uang fisik yang dia sisihkan, dan dananya aman/terpisah.

## 2. Model baru (REVISI sesuai jawaban Eddy)
- **Rekening penyimpan reserve dipilih per transaksi** (bukan 1 setting global). Default
  bisa SEABANK-RONAH, tapi tiap reserve/cicilan kamu pilih "Simpan di rekening mana".
- **Buat reserve (manual & cicilan):** **transfer NYATA**: bank sumber ↓, **rekening penyimpan ↑**
  (uang benar-benar pindah ke situ) + earmark per CC (RESERVE_LOG) = penanda "sekian dari saldo
  untuk CC X". Bila sumber = penyimpan → tidak transfer, cukup earmark.
- **Bayar CC dari reserve / angsuran cicilan:** kamu **pilih dari rekening penyimpan mana**
  uang ditarik → rekening itu ↓ + tagihan CC ↓ + earmark ↓.
- **Net Cash:** jadi **`Total Saldo Bank − Total Reserve`** — karena uang reserve sekarang
  MASIH ada di bank (di rekening penyimpan), jadi dikurangi biar dapat "kas bebas".
  (Membalik fix v17 `= Total Bank`; benar untuk model ini.)
- Saldo rekening penyimpan (mis. Seabank Ronah) akan tampak besar (menampung reserve) — wajar.
- **Migrasi: TIDAK ada** (Eddy mulai bersih). Pengaman: tombol Settings **"Sinkronkan reserve lama"**
  (sekali-pakai) yang kreditkan rekening penyimpan sebesar total reserve berjalan, kalau ternyata
  masih ada sisa reserve model lama supaya Net Cash tidak dobel.

## 3. Konsekuensi penting (yang harus Eddy sadari)
- **Arti Net Cash berubah** lagi (jadi bank − reserve). Angkanya sama dgn niat awal:
  kas bebas = total bank dikurangi yg sudah disisihkan.
- **Reserve yang SUDAH ADA** (model virtual lama) tidak otomatis konsisten: dulu uangnya
  "hilang" dari bank sumber, belum pernah masuk ke Rekening Reserve. Perlu keputusan migrasi
  (lihat Open Questions Q1).
- Semua TXN reserve tetap TIPE_LOG `Reserve` → tidak masuk laba/komposisi. Cicilan tetap
  sama (biaya penuh di muka); yang berubah hanya KE MANA uang reserve mengalir.

## 4. Scope teknis
### Code.gs (wajib redeploy) — tambah kolom `HOLDING` di RESERVE_LOG & `HOLDING` di CICILAN
- `addReserve(data{DARI_REKENING(source), HOLDING, UNTUK_CC, NOMINAL})`: bila source≠holding →
  2 TXN (source Pengeluaran 'Reserve CC' + holding Pemasukan 'Reserve Masuk', TIPE_LOG Reserve);
  bila sama → tanpa TXN. Selalu tulis RESERVE_LOG earmark (+ kolom HOLDING).
- `addCicilan`/`convertTxnToCicilan`: idem (source→holding), simpan HOLDING di baris CICILAN.
- `payCCReserve(data{CC, HOLDING, NOMINAL})`: holding Pengeluaran 'Bayar CC (Reserve)'
  (uang keluar dari holding terpilih) + tagihan CC ↓ + RESERVE_LOG − (catat HOLDING).
- `payCicilan(data{ID, HOLDING})`: holding Pengeluaran amt + RESERVE_LOG − + TENOR_TERBAYAR++.
- `migrateReserveToHolding(data{HOLDING})` (opsional, sekali): kredit holding = total reserve berjalan.
### Client (index.html)
- Form reserve manual (Transfer), Beli Cicilan, Ubah jadi Cicilan: tambah dropdown
  **"Simpan di rekening"** (default Seabank Ronah).
- Drawer Bayar CC & Bayar angsuran: tambah dropdown **"Ambil dari rekening reserve"** (default =
  HOLDING tersimpan utk cicilan itu).
- Net Cash dashboard → `totBank − totRes` + label disesuaikan; kartu "Dana Disisihkan" tetap.
- `reserveFunds` tetap per CC (earmark). Rincian reserve per kartu (v17.2) tetap jalan.

## 5. Open Questions — SUDAH DIJAWAB
- Q1 migrasi → **Mulai bersih, tanpa migrasi** (ada tombol sinkron pengaman bila perlu).
- Q2 → **Rekening penyimpan bisa beda-beda, dipilih per transaksi.**
- Q3 → **Saat bayar, pilih dari rekening penyimpan mana** (Seabank Ronah atau lainnya).

## 6. Risiko
- Net Cash berubah arti (jadi bank − reserve) → angka beda dari v17. Itu memang model baru.
- Konsistensi earmark vs lokasi fisik: earmark per CC, uang per rekening — kalau bayar dari
  rekening yg tidak menyimpan dana CC itu, saldo bisa janggal. Validasi ringan + default cerdas.
- Wajib 2 langkah deploy (push + redeploy Apps Script).

---
SIGN-OFF: ketik **"Proceed"** untuk saya bangun, atau koreksi modelnya.
