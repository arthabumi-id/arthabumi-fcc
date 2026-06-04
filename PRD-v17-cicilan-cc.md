# PRD v17 — Cicilan Kartu Kredit (Installment) — FINAL

Status: **DRAFT FINAL — menunggu "Proceed" Eddy.** Belum ada kode ditulis.

## 1. Problem
Beli barang pakai CC dengan cicilan (mis. 12jt, 12x). Sekarang FCC menganggap
tagihan CC naik 12jt sekaligus, padahal CC menagih ±1jt/bulan. Akibat: tagihan CC,
Net Cash, dan Forecast overstated. Belum ada cara mengalokasikan kas untuk cicilan.

## 2. Model final (semua keputusan Eddy, sudah konsisten)
**Prinsip:** Biaya diakui PENUH di muka (masuk biaya project). Yang dicicil hanya
ALIRAN KAS pembayaran ke CC — dikelola lewat mekanisme RESERVE yang sudah ada.

Contoh: beli 12jt pokok, bunga 600rb, 12x, Project "Rumah Pak Andi", CC-BCA-KRIS.

```
SAAT BELI (sekali):
 1. Beban penuh -> 2 TXN Pengeluaran TIPE_LOG 'Cicilan-Beli', REKENING=CC, PROJECT diisi:
      - Pokok 12.000.000 (kategori barang, mis. 'Material'/'Alat')
      - Bunga    600.000 (kategori 'Bunga Cicilan')   [bila bunga>0]
    -> MASUK laba, komposisi pengeluaran, dan cashflow project (keluar project +12,6jt).
    -> TIDAK menambah tagihan CC (getCCOut meng-exclude 'Cicilan-Beli').
 2. Reserve 12.600.000 dari bank pilihan -> pot reserve CC-BCA +12,6jt.
    -> Net Cash turun 12,6jt SEKALI (lihat #3 perbaikan).
 3. Catat baris CICILAN: tenor 12, per_bulan 1.050.000, terbayar 0, STATUS Jalan.

TIAP BULAN (lewat tombol Bayar CC):
 - Tagihan CC kartu itu menampilkan porsi cicilan bulan berjalan yg belum dibayar
   (1.050.000) + tagihan non-cicilan biasa.
 - Bayar -> payCicilan: pot reserve -1.050.000, terbayar++, porsi bulan itu lunas.
   -> TIDAK menyentuh laba (sudah diakui di muka) & TIDAK menyentuh bank
      (uang sudah disisihkan saat reserve). Murni geser pot -> CC.
 - Saat terbayar == tenor -> STATUS Lunas, pot habis.
```

**Hasil akhir (cek konsistensi):** Project cost +12,6jt (sekali). Laba turun 12,6jt
(sekali). Bank turun 12,6jt (sekali, saat reserve). Net Cash turun 12,6jt (sekali).
Tagihan CC naik-turun 1,05jt/bln (net ~0 bila tepat waktu). Tidak ada dobel hitung.

## 3. Perbaikan Net Cash (keputusan Eddy: perbaiki utk SEMUA reserve)
**Bug sekarang:** reserve menulis Pengeluaran di bank (bank turun) DAN dashboard
hitung `Net Cash = Bank - Reserve` -> reserve 12jt menurunkan Net Cash ~24jt (dobel).

**Fix (minimal, tanpa migrasi data):** ubah formula jadi **`Net Cash = Total Saldo
Bank`** saja (bank sudah otomatis berkurang oleh TXN reserve, jadi tak perlu dikurangi
lagi). Pot reserve ditampilkan TERPISAH sebagai "Dana Disisihkan (untuk CC)" —
informatif, bukan pengurang kedua. Tidak perlu sentuh data/TXN reserve lama.
- Alternatif (TIDAK dipilih, butuh migrasi): reserve tidak mengurangi bank,
  `Net Cash = Bank - Reserve`, pembayaran CC baru mengurangi bank. Lebih "akrual"
  tapi mengubah arti Saldo Bank & perlu netralisir reserve lama. Dilewati.

## 4. Success Criteria
- 1 form "Beli Cicilan": isi CC, deskripsi, pokok, bunga total, tenor, project,
  kategori, tgl -> sistem hitung per_bulan = round((pokok+bunga)/tenor).
- Saat simpan: otomatis buat beban project penuh + reserve penuh + baris cicilan.
- Dashboard: Net Cash benar (turun 1x), kartu "Dana Disisihkan" + (opsional) "Cicilan Jalan".
- Tagihan CC tiap kartu = txn biasa + porsi cicilan bulan berjalan belum dibayar.
- Bayar CC otomatis menyelesaikan porsi cicilan bulan itu dari reserve (FIFO cicilan tertua).
- Bayar CC nominal < porsi cicilan wajib -> DITOLAK (Eddy: tagihan wajib lunas).
- Forecast: porsi cicilan tiap bulan -> outflow di tgl jatuh tempo CC sampai lunas.
- Verifikasi numerik 2 skenario (0% & berbunga) cocok 100% hitung manual.

## 5. Scope teknis
### Sheet baru `CICILAN` (wajib redeploy Code.gs)
`ID, TANGGAL_BELI, CC, DESKRIPSI, NOMINAL_POKOK, BUNGA_TOTAL, TENOR,
 NOMINAL_PER_BULAN, TGL_MULAI, TENOR_TERBAYAR, STATUS, PROJECT, KATEGORI,
 REF_ID, NOTES, CREATED_BY, CREATED_AT`

### Code.gs — action baru (wajib redeploy)
- `addCicilan`: tulis baris CICILAN + 2 TXN 'Cicilan-Beli' (pokok+bunga) + 1 RESERVE_LOG
  (reserve pokok+bunga) + 1 TXN bank 'Reserve CC' (TIPE_LOG Reserve) — pakai REF_ID
  pengikat. (Reuse logika addReserve.)
- `payCicilan`: dipanggil dari alur Bayar CC. terbayar++, tulis 1 TXN 'Bayar CC (Reserve)'
  (Pemasukan ke CC, TIPE_LOG Reserve) + 1 RESERVE_LOG negatif. Set STATUS Lunas bila penuh.
- `deleteCicilan`: hanya bila TENOR_TERBAYAR=0 -> hapus baris + semua TXN/RESERVE via REF_ID.
- Masuk getBundle/getAllData (`cicilan`), doGet `getCicilan`.

### index.html
- `state.cicilan` (syncAll/forceRefresh/saveLocal/loadOffline).
- `getCCOut`: exclude TIPE_LOG 'Cicilan-Beli'; tambah porsi cicilan bulan berjalan belum
  dibayar dari `state.cicilan` kartu itu.
- Dashboard Net Cash = totBank (hapus `- totRes`); kartu "Dana Disisihkan" tetap tampil
  totRes; tambah info cicilan jalan.
- Drawer `cicilan` (`openCicilan`/`saveCicilan`): form beli cicilan (preview per_bulan
  realtime). BLOCKING save (perlu syncAll utk angka authoritative, seperti paycc/reserve).
- Integrasi drawer `paycc`: jika kartu punya cicilan Jalan, tampilkan porsi wajib bulan ini,
  cegah bayar < porsi cicilan, panggil payCicilan FIFO.
- `buildForecast`: event outflow cicilan per bulan di jatuh tempo CC s/d lunas.
- Tampil di kartu CC (Master): badge "N cicilan jalan · sisa Rp X" + tombol "+ Cicilan".
- sw.js cache bump -> fcc-arthabumi-v7.

## 6. Constraints
- Single file index.html, vanilla JS, pola optimistic-save existing (cicilan = blocking).
- Tidak ubah nama/urutan header sheet existing.
- addCicilan & payCicilan idempotent-aman; verifikasi syntax via Read tool (mount sering lag).

## 7. Execution Plan
1. Code.gs: sheet CICILAN + addCicilan/payCicilan/deleteCicilan/getCicilan + bundle.
2. index.html: state, getCCOut patch, Net Cash fix, kartu, drawer cicilan, integrasi paycc, forecast.
3. Verifikasi numerik 2 skenario vs manual (tulis di log.md).
4. Update FCC-CONTEXT.md (v17) + catatan redeploy + cara pakai.

## 8. Risiko / catatan
- Net Cash berubah angkanya (jadi lebih tinggi/benar) -> Eddy akan lihat selisih vs
  sebelumnya. Itu memang koreksi bug, bukan kesalahan baru.
- Edit/hapus cicilan yang sudah jalan sebagian tidak diizinkan (ada TXN & reserve terikat).
- Wajib 2 langkah deploy: push file (GitHub Desktop) + redeploy Apps Script (Code.gs).

---
SIGN-OFF: ketik **"Proceed"** untuk mulai bangun. Atau koreksi bagian mana pun.
```
