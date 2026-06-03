# PRD v14 — Cashflow Forecast 30/60/90 Hari

Status: **DRAFT — menunggu sign-off Eddy**
Tanggal: 2026-06-02

---

## 1. Problem
FCC sekarang hanya menjawab "apa yang sudah terjadi". Eddy tidak punya alat untuk melihat
**ke depan**: kapan kas akan tipis, apakah aman bayar tagihan CC + kasbon + operasional bulan
depan, dan apakah ada ruang kas untuk keputusan besar (mis. rekrut orang). Akibatnya keputusan
diambil dari "feeling", bukan data.

## 2. Success Criteria
1. Dalam ≤3 detik setelah buka, dashboard menampilkan proyeksi saldo kas pada hari ke-30, 60, 90.
2. Setiap titik proyeksi menampilkan: perkiraan saldo, komponen keluar terjadwal, perkiraan masuk.
3. Ada **peringatan otomatis** bila proyeksi saldo menyentuh / di bawah 0 (atau di bawah ambang aman yang diset Eddy) pada periode mana pun.
4. Eddy bisa menambah **pemasukan/pengeluaran terjadwal manual** (mis. termin proyek, gaji bulanan) yang ikut dihitung.
5. Akurasi: untuk komponen yang datanya pasti (jatuh tempo CC, kasbon, jadwal manual) proyeksi harus tepat; komponen estimasi (operasional rutin) ditandai sebagai perkiraan dengan rentang ±.

## 3. Scope

### Masuk scope
- Halaman / kartu **Forecast** (kemungkinan tab baru atau bagian dashboard).
- Logika proyeksi client-side dari data yang SUDAH ada di state (saldo bank, summary.month, MASTER_CC jatuh tempo + outstanding, reserve, kasbon).
- Input **jadwal manual** (recurring & one-time) — perlu sheet baru `JADWAL` + 1-2 action Code.gs.
- Grafik garis proyeksi 90 hari + penanda kejadian (tagihan CC, gaji, termin).
- Ambang aman kas (`safe threshold`) yang bisa diset Eddy di Settings.

### Di luar scope (sekarang)
- Prediksi pemasukan otomatis berbasis ML / musiman.
- Notifikasi push HP (cukup badge dalam app dulu).
- Integrasi ke fitur lain (profit per lini, dll — PRD terpisah).

## 4. Asumsi & Logika Proyeksi (DRAFT — minta koreksi)

**Titik awal (hari 0):** Total Net Cash = Σ saldo bank. (Reserve sudah keluar dari bank saat dibuat, jadi tidak dikurangi lagi — konsisten dgn model v9.)

**Keluar terjadwal (pasti):**
- Tagihan tiap CC (`getCCOut`) jatuh pada hari `JATUH_TEMPO` di window 90 hari. Keluar dari bank = tagihan − reserve tersedia utk CC itu.
- Jadwal manual berjenis Pengeluaran (mis. gaji tim tiap tgl 1).

**Keluar estimasi (perkiraan, ±):**
- Operasional rutin = rata-rata pengeluaran bulanan (exclude Transfer/Reserve/Kasbon) dari **3 bulan terakhir** (`summary.month`), disebar rata per hari.

**Masuk:**
- Jadwal manual berjenis Pemasukan (mis. termin proyek tgl tertentu) — **sumber utama**, karena pemasukan kontraktor lumpy/tidak rata.
- OPSIONAL: baseline masuk rata-rata bulanan (bisa dimatikan biar konservatif).

**Rentang ± (confidence band):** dari deviasi pengeluaran bulanan historis.

## 5. Open Questions — RESOLVED (2026-06-02)

1. **Pemasukan:** (a) murni dari jadwal manual termin. ✅ Tanpa baseline auto — konservatif.
2. **Ambang aman kas:** _MASIH PERLU ANGKA._ Default sementara Rp 0 (peringatan saat proyeksi ≤ 0). Eddy bisa set angka minimum nanti di Settings.
3. **Gaji tim:** TIDAK rutin (mingguan, variabel) → **tidak** jadi jadwal manual. Otomatis tertangkap di estimasi "operasional rutin" (rata-rata 3 bln). ✅
4. **Tempat tampil:** **Tab baru "Forecast"**. ✅
5. **Reserve:** reserve dipakai dulu, sisanya dari bank. ✅

### Keputusan scope kas pribadi vs usaha
Rekening Eddy saat ini **masih campur** pribadi & usaha; rencananya akan dipisah ke depan.
**Keputusan:** v14 forecast jalan di **level total kas dulu**. Pemisahan Pribadi/Usaha (penanda
per-rekening + toggle) ditunda ke **v15**, dikerjakan SETELAH Eddy memisahkan rekening secara fisik
— supaya datanya bersih (memisahkan uang yang sudah tercampur secara retroaktif = data salah).

## 6. Execution Plan (setelah sign-off)
1. Tambah sheet `JADWAL` (`ID,JENIS,NAMA,NOMINAL,TIPE,TGL,FREKUENSI,AKTIF,NOTES,...`) + action `addJadwal`/`deleteJadwal`/`updateJadwal` di Code.gs → **wajib redeploy**.
2. Client: `state.jadwal`, helper `buildForecast(days)` (gabung saldo awal + jadwal + estimasi rutin + tagihan CC per tanggal), `forecastSeries()` utk grafik.
3. UI: kartu forecast (3 angka 30/60/90 + warna risiko) + tab/drawer detail (grafik garis + daftar kejadian) + form input jadwal + setting ambang aman.
4. Verifikasi: hitung manual 1 skenario contoh, bandingkan dengan output app; `node --check` syntax.

## 7. Catatan teknis
- Sebagian besar client-side. Yang butuh redeploy Code.gs hanya sheet `JADWAL` + actionsnya.
- Tetap ikut aturan deploy 2-langkah (GitHub Desktop utk file, Apps Script editor utk Code.gs).
- Tidak mengubah skema sheet existing — hanya menambah sheet baru.
