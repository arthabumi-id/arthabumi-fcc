# Koreksi Data — Saldo Awal CC & Reserve (rapihkan pra-pembukuan)

Dibuat 8 Juni 2026. Sumber: audit database FCC (snapshot awal sesi).
**Semua input MANUAL di Google Sheets oleh Eddy. Reversible (tinggal hapus barisnya).**
Setelah selesai: **Settings → Hitung Ulang Total.**

## Masalah
Kamu mulai pembukuan FCC ~akhir Mei. Tagihan CC bulan-bulan sebelumnya **sudah kamu bayar**
(uang nyata keluar dari bank), tapi **belanja aslinya tidak pernah dicatat**. Akibatnya tiap
kartu punya "pembayaran yatim" → app mengira kartu kelebihan bayar (getCCOut minus), dan strip
reserve jadi tidak akurat.

Total belanja historis yg dibayar tapi belum tercatat ≈ **Rp 101.953.365** (6 kartu).

## A. Entri SALDO AWAL CC (tab `TRANSAKSI`)
Untuk tiap baris: `TANGGAL=2026-04-30`, `JENIS=Pengeluaran`, `PROJECT=(kosong)`,
`KATEGORI=Saldo Awal`, `TIPE_LOG=Saldo Awal`, `CREATED_BY=Eddy`, `CREATED_AT=2026-04-30T00:00:00.000Z`.
(`TIPE_LOG=Saldo Awal` → TIDAK masuk laba/komposisi; hanya menyeimbangkan tagihan kartu.)

| ID | REKENING | NOMINAL | Catatan |
|----|----------|---------|---------|
| MAN-SA-BMW | CC-MAYBANK-BMW | 47824805 | = bayar 7 Mei (tak ada belanja tercatat) |
| MAN-SA-KRIS | CC-BCA-KRIS | 44087606 | = tagihan April 44.251.790 − Palyja 164.184* |
| MAN-SA-ACCOR | CC-CIMB-ACCOR | 4405130 | = bayar 12 Mei |
| MAN-SA-BNI | CC-BNI-JCB | 4044157 | = bayar 9 Mei |
| MAN-SA-INFINITE | CC-MAYBANK-INFINITE | 1478667 | = bayar 7 Mei |
| MAN-SA-DANAMON | CC-DANAMON-JCB | 113000 | = bayar 4 Mei |

\* **KRIS — perlu kamu pastikan:** angka 44.087.606 mengasumsikan Palyja (164.184, 1 April) **masuk
di tagihan April** yang kamu bayar. Kalau Palyja ditagih di siklus lain, pakai **44.251.790** (penuh).
Catatan: AXA (405.000) + Apple (15.000) + belanja Juni adalah tagihan berjalan, sengaja TIDAK
dimasukkan ke saldo awal (belum dibayar).

Setelah A: keenam kartu jadi **Lunas/net 0** (kecuali KRIS yang menyisakan tagihan berjalan
non-cicilan AXA+Apple+Juni + cicilan 22,5jt — itu memang masih harus dibayar).

## B. Koreksi saldo BCA 552 (tab `TRANSAKSI`)
Saldo BCA 552 di app understated 20.303.853 (4 cicilan KRIS dikonversi pra-redeploy v18 →
membukukan keluar reserve dari 552 tanpa pasangan masuk). Tambah 1 baris:

| Kolom | Isi |
|-------|-----|
| ID | MAN-KOREKSI-552 |
| TANGGAL | 2026-06-05 |
| JENIS | Pemasukan |
| REKENING | BCA 552 |
| KATEGORI | Reserve Masuk |
| NOMINAL | 20303853 |
| TIPE_LOG | Reserve |
| NOTES | [KOREKSI] reserve 4 cicilan lama, fisik tetap di 552 |

→ Saldo BCA 552 jadi **51.719.674** (sesuai bank asli).

## Catatan / batas
- Angka di atas dari **snapshot database awal sesi**. Sebelum input, sebaiknya buka tiap kartu di
  app (Detail Akun) & pastikan masih cocok (kalau ada perubahan setelah snapshot).
- Saldo bank di snapshot belum semuanya rekonsiliasi dengan tampilan app (mis. transfer ke 552
  belum semua ter-render saat snapshot diambil) → koreksi BANK selain BCA 552 belum disertakan.
  Kalau mau, kita rekonsiliasi saldo bank satu per satu pakai data live.
- Urutan eksekusi: input A + B → **Hitung Ulang Total** → cek kartu & dashboard.
