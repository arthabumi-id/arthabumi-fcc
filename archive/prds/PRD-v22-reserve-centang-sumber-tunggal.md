# PRD v22 — Reserve CC = Centang (Sumber Tunggal) + Rekening Reserve Nyata

Status: **IMPLEMENTED (2026-06-19).** Fase A ✅ & Fase C ✅ dikerjakan (client-only).
Fase B ❌ DILEWATI — cek data Sheet membuktikan tak ada reserve manual yg perlu dikonversi
(CIMB-ACCOR 1,7jt & MAYBANK-BMW 6,3jt sudah ditutup centang; BCA-KRIS/BNI-JCB = cicilan auto).
Pending: push index.html + bump sw.js. (Tidak perlu redeploy Code.gs untuk PRD ini.)
Tanggal: 2026-06-19

---

## 0. ⚠️ Kontradiksi dengan keputusan lama (wajib disadari sebelum setuju)

PRD ini **membalik** keputusan PRD v20:

- **v20 memutuskan:** centang manual = "penanda pribadi, SENGAJA lepas dari pot reserve. Centang ≠ menggerakkan uang." Ditampilkan berdampingan dengan reserve asli supaya selisih kelihatan.
- **v22 memutuskan:** centang JADI sumber kebenaran reserve. Tidak ada lagi dua angka berdampingan.

Alasan perubahan (kata Eddy, sesi 2026-06-19): *"kalau saya centang manual, sistem kan baca secara akumulasi, jadi saya aslinya tinggal transfer total akumulasi dari yang saya centang ke rekening reserve CC."* — Workflow asli Eddy memang menjadikan total centang sebagai jumlah yang ditransfer. Jadi dua angka itu sebetulnya satu niat. Menyatukannya = menghapus sumber kebingungan utama ("konsepnya abstrak").

Konsekuensi turunan: mekanisme reserve lump-sum lewat "tab Reserve → pilih kartu → ketik nominal" (PRD v18) **tidak lagi jadi cara manual menyisihkan**. Pendanaan reserve dilakukan lewat **Transfer rekening biasa** (fitur yang sudah ada).

---

## 1. Problem

1. **Konsep reserve terasa abstrak.** Angka `reserveFunds` nempel di "kartu", uang fisik tidak benar-benar terlihat pindah → susah dibayangkan.
2. **Dua sistem paralel bikin rancu.** `reserveFunds` (dari RESERVE_LOG) vs centang manual (`marks`) — dua angka untuk maksud yang sama, ditampilkan berdampingan.
3. **Eddy sering lupa** mana belanja CC yang sudah disisihkan dananya, dan lupa apakah saldo reserve sudah cukup.

## 2. Tujuan & Success Criteria

- Reserve = **total transaksi CC yang dicentang** + kewajiban cicilan. Satu angka, tidak ada angka reserve kedua.
- Rekening yang ditandai sebagai **rekening reserve** menampilkan dua kantong: **Reserve CC** (terkunci) vs **Bisa dipakai** (saldo − terkunci).
- App memperingatkan dua kondisi "lupa": (a) ada belanja CC belum dicentang, (b) saldo rekening reserve < total yang dicentang ("kurang Rp X, transfer lagi").
- Dua-kantong **hanya** muncul di rekening reserve, bukan semua rekening. (Sejalan tujuan jangka panjang Eddy: pisahkan rekening CC / usaha / pribadi.)
- Pendanaan reserve = Transfer biasa ke rekening reserve (tanpa aksi "reserve ke kartu" terpisah).
- Cicilan tetap **auto-reserve** seperti sekarang (komitmen pasti, bukan per-centang).

## 3. Scope

### Termasuk
- Reserve obligation per kartu = `markTotalCC(cc)` (belanja CC dicentang) + kewajiban cicilan kartu itu.
- Definisi "rekening reserve" = bank yang dipakai sebagai `RESERVE_BANK` salah satu kartu (+ default global). Sudah ada infranya (kolom `RESERVE_BANK` per kartu, v20).
- Tampilan dua-kantong di rekening reserve (Detail Akun + kartu di Master).
- Peringatan under-funded & belum-dicentang.
- Migrasi data lama (lihat §5).

### TIDAK termasuk (sengaja ditunda)
- Auto-reserve saat catat belanja CC (tetap manual via centang — by design).
- Pre-funding reserve sebelum belanja (tidak didukung; alur CC = belanja dulu).
- Perombakan total mekanik uang cicilan (cicilan tetap pakai jalur RESERVE_LOG internalnya).

## 4. Model teknis (target)

**Sumber reserve obligation (pengganti `reserveFunds` versi lama untuk belanja non-cicilan):**
- `reserveNeedCC(cc)` = `markTotalCC(cc)` + `cicilanRemaining(cc)` (atau `cicilanDueAmt`, dikonfirmasi di Open Q).
- `marks` (RESERVE_MARK) tetap jadi penyimpanan centang — tidak ganti skema, hanya ganti **peran** (jadi sumber kebenaran, bukan penanda pasif).

**Rekening reserve & dua kantong:**
- `lockedInBank(bank)` = Σ atas kartu yang `RESERVE_BANK == bank` dari `reserveNeedCC(cc)`.
- "Bisa dipakai" = `getSaldo(bank).saldo − lockedInBank(bank)`.
- Bila hasilnya negatif → tampilkan peringatan under-funded merah + tombol cepat ke Transfer.

**Yang dihapus / diubah dari UI:**
- Tab "Reserve" (input lump-sum manual `addReserve`/`reserveNow`/`previewReserve`): dinonaktifkan dari UI manual. Backend `addReserve` dibiarkan ada (dipakai internal cicilan), tidak dipanggil dari UI manual.
- `ccReserveStrip` v19.3: disederhanakan jadi satu sumber (centang + cicilan), tidak lagi menampilkan `reserveFunds` manual & marks sebagai dua baris terpisah.

## 5. Rencana migrasi data lama ("pertahankan & konversi" — pilihan Eddy)

Reserve lama (`RESERVE_LOG` non-cicilan) tidak menempel ke transaksi tertentu, jadi konversinya:
1. Untuk tiap kartu: hitung reserve manual lama = `reserveFunds[cc] − cicilanRemaining(cc)` (porsi non-cicilan).
2. Centang otomatis transaksi belanja CC kartu itu, **dari terbaru ke lama**, sampai akumulasi ≈ reserve manual lama. (Centang lama yang sudah ada dipertahankan, tidak dobel.)
3. Sisa yang tidak pas dengan transaksi mana pun → ditampilkan sebagai catatan ("residu Rp X tak terpetakan"), bukan dibuang diam-diam.
4. **Dijalankan sebagai PREVIEW dulu** (daftar: kartu, jumlah txn akan tercentang, total). Eddy review → baru eksekusi.

⚠️ **Bagian tidak otomatis reversible:** eksekusi auto-centang + (opsional) menonaktifkan RESERVE_LOG manual lama. Akan ada backup state + konfirmasi eksplisit "Proceed" terpisah sebelum jalan.

## 6. Execution Plan (bertahap, de-risk)

**Fase A — Display & logika baca (TANPA migrasi, TANPA hapus apa pun, reversible):**
- Tambah `reserveNeedCC`, `lockedInBank`. Tampilkan dua kantong di rekening reserve + peringatan under-funded & belum-dicentang.
- Centang masih seperti v20 (data sama), tapi sekarang dipakai sebagai angka reserve.
- `addReserve`/tab Reserve masih ada (belum disembunyikan) → bisa banding hasil lama vs baru.
- **Checkpoint:** Eddy verifikasi angka dua-kantong cocok dengan ekspektasi sebelum lanjut.

**Fase B — Migrasi (setelah Fase A diverifikasi):**
- Tool preview konversi (§5). Eksekusi setelah sign-off terpisah.

**Fase C — Bersih-bersih UI:**
- Sembunyikan tab Reserve manual & strip ganda. Sisakan satu model.

Tiap fase: edit targeted (Python `str.replace`), verifikasi syntax `node`, push manual GitHub Desktop. Code.gs **tidak** perlu redeploy untuk Fase A & C (semua di client). Fase B mungkin perlu action kecil bila auto-centang ditulis ke RESERVE_MARK via `markTxn` (action sudah ada → kemungkinan TIDAK perlu redeploy).

## 7. Open Questions

- **Q1.** "Terkunci" untuk cicilan dihitung dari **seluruh sisa cicilan** (`cicilanRemaining`) atau **hanya yang sudah jatuh tempo** (`cicilanDueAmt`)? (Rekomendasi: `cicilanRemaining` — supaya dana seluruh komitmen sudah disiapkan; konsisten dengan auto-reserve penuh saat beli cicilan.)
- **Q2.** Centang tetap di **Detail Akun CC saja**, atau sekalian dimunculkan di **halaman Transaksi**? (Rekomendasi: tetap Detail Akun CC dulu.)
- **Q3.** Saat saldo rekening reserve **lebih** dari total terkunci, "Bisa dipakai" boleh dipakai bebas — setuju? Atau mau ada konsep "reserve berlebih" terpisah? (Rekomendasi: anggap bebas, simpel.)
- **Q4.** Mulai dari **Fase A saja** dulu (display), tahan migrasi & bersih-bersih sampai Anda lihat hasilnya? (Rekomendasi: ya.)

## 8. Risiko / catatan

- Cicilan menulis RESERVE_LOG sendiri; selama kita hanya **menambah** perhitungan baca (Fase A), tidak ada uang yang berubah → aman.
- Bila kartu pakai `RESERVE_BANK` berbeda-beda, "terkunci" per rekening reserve mengikuti pengelompokan itu. Pastikan tiap kartu sudah di-set rekening reserve-nya.
- Centang yatim (transaksi dihapus) diabaikan saat render — sama seperti v20.
- Dua langkah deploy hanya bila Fase B perlu action server (kemungkinan tidak).

---
SIGN-OFF: jawab Q1–Q4 (atau "pakai rekomendasi") lalu ketik **"Proceed"**. Saya mulai dari Fase A.
