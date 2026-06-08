# LOG.md — Riwayat Session FCC Arthabumi
> Catat setiap session: tanggal, apa yang dikerjakan, hasil, dan catatan penting.

---

## SESSION — 2026-06-08 (v20 Centang reserve manual + Bank reserve per kartu)
**Topik:** PRD-v20 (signed off). Dua fitur, **WAJIB REDEPLOY Code.gs**.
- **A. Centang manual:** sheet `RESERVE_MARK` + action `markTxn`/`unmarkTxn` + `marks` di bundle. Client: `state.marks`, `isMarked`/`markTotalCC`/`markCountCC`/`toggleMark` (optimistic). Tombol ☐/✅ di Detail Akun CC + banner ringkasan (berdampingan reserve asli) + indikator di strip v19.3. Lepas dari pot reserve (pengingat pribadi — Eddy reserve secara akumulasi).
- **B. Bank reserve per kartu:** kolom `RESERVE_BANK` di MASTER_CC (auto via `ensureCol` di getBundle). Dropdown di form Kartu Kredit. Helper `ccHoldingBank` dipakai sbg default penyimpan di reserveNow/tab Reserve/cicilan/convert/paycc.
**Hasil:** node --check fungsi backend+client OK & run terisolasi benar (ccHoldingBank, toggleMark). sw.js v14. Backup `backup-pre-v20-20260608-1512`. Mount bash macet di file penuh → audit manual.
**Pending:** push index.html+sw.js+**redeploy Code.gs**. Cek console browser. (Masih terbuka dari sesi lalu: koreksi BCA 552 +20.303.853, saldo-awal April KRIS 44.087.606.)

---

## SESSION — 2026-06-05 (v19 Status pendanaan reserve per kartu — client-only)
**Topik:** Eddy bingung mana belanja CC yg sudah ia danai (transfer reserve dari BCA ke bank penyimpan) vs belum, sebelum jatuh tempo. PRD: `PRD-v19-status-reserve-belanja-cc.md` (signed off "Proceed").
**Keputusan:** Model **B** (per kartu 1 angka agregat, BUKAN centang per item — ditolak krn bikin sumber kebenaran kedua). Basis "perlu didanai" = **tagihan berjalan** `getCCOut` (opsi A, 0 redeploy). Tampil di **tab Kartu Kredit + ringkasan Dashboard**. Client-only.
**Dikerjakan (index.html):** helper `unreservedCC` / `ccReserveStrip` / `reserveNow` / `gotoCCReserve`; strip status reserve di kartu CC (merah "Belum di-reserve Rp X" + tombol "Reserve sekarang" prefill selisih ke form Reserve; hijau "Reserve lengkap"); kartu Dashboard "Belum di-reserve (semua kartu)". sw.js → fcc-arthabumi-v10.
**Revisi (sesi sama):** Eddy minta **cicilan IKUT dihitung** (ia sisihkan dana cicilan dari awal juga). `unreservedCC` jadi: perlu = getCCOut − cicilanDueAmt + cicilanRemaining; sudah = reserveFunds penuh. Verifikasi 5 skenario PASS (cicilan auto-reserve→belum 0, belum reserve→belum=sisa cicilan, campuran benar).
**Kontrak perilaku (diingatkan ke Eddy):** angka akurat hanya bila tiap transfer reserve dicatat lewat form Reserve FCC.
**Hasil:** node --check fungsi+template baru OK (mount bash macet di file lama → audit manual). Backup: `backup-pre-v19-20260605-1420`.
**v19.2 + rekonsiliasi reserve KRIS (sesi sama):** Telusuri DB (Google Drive connector, sheet "FCC Arthabumi - Database v2"). Temuan CC-BCA-KRIS: RESERVE_LOG earmark = 22.503.003 (= 5 cicilan, pas). Saldo BCA 552: app 31.415.821 vs fisik 51.719.674 → selisih **20.303.853 = 4 cicilan pra-v18** (konversi lama membukukan Pengeluaran reserve dari 552 tanpa leg Pemasukan → understated). Strip v19 "2,42jt" di KRIS = "perlu didanai" yg understated (tagihan Mei sudah dibayar 44,25jt + belanja dikonversi cicilan). Belanja KRIS Jun 1-5 = 4.754.271. Tagihan 17 Jun 26.393.439 = bank menagih cicilan saja (bukan penuh). **Kelebihan dana di 552 ≈ 23,88jt** (fisik 51,7jt − kewajiban KRIS 27,84jt) bisa ditarik balik ke BCA 082.
- **Dibangun (client-only):** helper `reserveHeldIn(bank)` + keterangan "🛡️ reserve CC X · bebas Y" di Saldo Rekening Dashboard. sw.js v12. node --check OK (reserveHeldIn 552 = 22.503.003, bebas pasca-koreksi = 29.216.671).
- **KOREKSI DATA (Eddy eksekusi manual di Sheets):** tambah 1 baris TRANSAKSI Pemasukan REKENING=BCA 552 NOMINAL=20303853 KATEGORI='Reserve Masuk' TIPE_LOG='Reserve' → saldo 552 jadi 51.719.674. Lalu Settings → Hitung Ulang Total.
**v19.1 (sesi sama):** Bottom-nav diubah jadi **5 utama + "Lainnya"** (Kasbon/Forecast/Piutang masuk popup) utk fix gesture iPhone (geser nav → ganti app). Nav `flex:1` tanpa overflow-x (membalik v18.9), ikon/label diperbesar. `goPage` highlight via `data-nav` + `navKey` map ke 'lainnya'. Badge piutang pindah ke tombol Lainnya. sw.js → **v11**. node --check fungsi nav OK.
**Pending:** push index.html + sw.js via GitHub Desktop (TANPA redeploy Code.gs). Cek console browser.

---

## SESSION — 2026-06-04 (v18.7–18.9 UX tweaks, client-only)
Semua client-only (index.html), TIDAK perlu redeploy Code.gs:
- v18.7 Halaman Transaksi: filter **rentang tanggal** (`txnFrom/txnTo`, `onTxnRange/clearTxnRange`) + **ringkasan** (#txnSummary: jumlah, masuk, keluar, net) utk cek/rekonsiliasi. Tombol **+** jadi menu cepat **Pengeluaran/Pemasukan** (`#fabMenu`, `addTxnType`, `openDrawer(...,preset)`).
- v18.8 Status project **"Abaikan"** → dikecualikan dari Laba Bersih (cuma hitung Selesai). Tab "Abaikan" di halaman Project + opsi di drawer.
- v18.9 Bottom-nav bisa **di-slide** (overflow-x), tab tidak mengecil di iPhone; tab aktif auto ke tengah.
Catatan: status project Selesai BISA diubah lagi (Edit project). Rekonsiliasi BCA 082 dibatalkan user.

---

## SESSION — 2026-06-04 (v18.1–18.6 lanjutan + rekonsiliasi BCA)
**Dikerjakan (client-only kecuali disebut):**
- v18.1 Rincian Tagihan CC (`openCCBill`) + v18.2 checkbox rekonsiliasi (`ccbTick`) + fix refund (Pemasukan) jadi NEGATIF saat dicentang.
- v18.3 Kunci tagihan ke Dashboard — **sheet `CC_TAGIHAN` + action `lockCCBill` (WAJIB REDEPLOY)**, `renderCCBillReminder`. v18.4 banner hanya urgent (≤7hr/overdue) + info jatuh tempo inline di section KARTU KREDIT (`#dashCC`, `ccBillFor`).
- v18.5 Kategori cascade Kelompok→Kategori di Tambah Transaksi.
- v18.6 keterangan "reserve di [bank]" di baris cicilan (`cicilanHolding` + fallback).
**Temuan penting:** user pakai index.html baru TAPI **Code.gs v18 belum tentu di-redeploy** → tanda: cicilan baru tampil "reserve di Seabank Ronah" (default) krn tak ada TXN 'Reserve Masuk'. ACTION user: redeploy Code.gs.
**Rekonsiliasi BCA 082 Mei (dibatalkan):** dibaca via Google Drive connector (sheet "FCC Arthabumi - Database v2"). Total versi app: masuk Rp 186.637.647, keluar Rp 78.962.552. Selisih 554.800 vs statement BELUM ketemu (tak ada item tunggal/pasangan = 554.800). Untuk lanjut: minta total masuk/keluar statement BCA.
**Pending besar:** Code.gs v18 (+CC_TAGIHAN, lockCCBill, semua action reserve/cicilan/convert) WAJIB di-redeploy; push index.html/sw.js(v9). sw.js cache fcc-arthabumi-v9.

---

## SESSION — 2026-06-04 (v18 Reserve = rekening nyata)
**Topik:** Ubah reserve dari pot virtual → uang nyata diparkir di rekening penyimpan (mis. Seabank Ronah). PRD: `PRD-v18-reserve-rekening-nyata.md` (signed off).
**Dikerjakan:** addReserve/payCCReserve/payCicilan/addCicilan/convertTxnToCicilan jadi transfer sumber→holding + earmark; action `migrateReserveToHolding`; Net Cash → bank−reserve; dropdown "Simpan di rekening" + "Ambil dari rekening reserve"; Settings default penyimpan + tombol sinkron; forecast disesuaikan (reserve di bank, angsuran cicilan diproyeksi bulanan). sw.js v8.
**Keputusan:** rekening penyimpan dipilih per transaksi (bisa beda), bayar bisa pilih sumber penyimpan, mulai bersih tanpa migrasi (ada tombol sinkron pengaman). Net Cash sekarang = kas bebas (bank − reserve), membalik v17.
**Hasil:** Simulasi v18 8/8 PASS (`outputs/sim18.js`); node --check fungsi v18 OK. Mount bash macet → audit manual.
**Pending:** deploy 2 langkah. Cek console browser.

---

## SESSION — 2026-06-04 (v17 Cicilan Kartu Kredit)
**Topik:** Fitur belanja CC dicicil + fix Net Cash. PRD: `PRD-v17-cicilan-cc.md` (signed off "Proceed").
**Dikerjakan:**
- Code.gs: sheet `CICILAN` + action `addCicilan`/`payCicilan`/`deleteCicilan`/`getCicilan`, masuk bundle, `getSummary` katExp hitung `Cicilan-Beli`.
- index.html: `state.cicilan`, `getCCOut` + porsi cicilan virtual (`cicilanDueAmt`), helper `monthsElapsed`/`cicilanRemaining`; **fix Net Cash = Total Saldo Bank** (sebelumnya dobel kurang reserve); kartu "Dana Disisihkan" + "Sisa Cicilan CC"; drawer Beli Cicilan + list + integrasi Bayar CC; forecast pisah cicilan vs non-cicilan.
- sw.js → fcc-arthabumi-v7.

**Keputusan penting:**
- Biaya diakui PENUH di muka (masuk biaya project); yang dicicil hanya kas (lewat reserve). Tagihan cicilan virtual dari TENOR_TERBAYAR. Angsuran dibayar dari reserve via tombol Bayar CC / Bayar angsuran. Bunga = input total Rp. Bayar CC < porsi cicilan ditolak (cicilan dibayar terpisah dari reserve).
- Net cash double-count diperbaiki untuk SEMUA reserve (bukan cuma cicilan).

**Hasil:** Simulasi numerik 13/13 PASS (`outputs/sim.js`). Syntax fungsi baru OK (node --check terisolasi; mount bash macet di file lama, audit manual).

**Pending:** Eddy deploy 2 langkah (push GitHub Desktop + redeploy Apps Script Code.gs). Cek console browser bila ada error JS.

---

## SESSION 001 — 2026-05-31
**Topik:** Analisis keuangan + Build dashboard
**Dikerjakan:**
- Baca dan analisis file BANK.xlsx (11 sheet: Seabank, BCA, UOB, Cash, Absen Tukang, CC, dll.)
- Build dashboard widget v1: ringkasan, transaksi, proyek
- Build widget v2: tambah fitur transfer antar bank & reserve fund CC
- Build widget v3: full FCC dengan 6 modul fully editable (bank, CC, project, kategori, transaksi, transfer)
- Analisis file FCC_ARTHABUMI_MIGRATED.xlsx (struktur lebih mature, 16 sheet)

**Keputusan penting:**
- Pakai Google Sheets sebagai database permanen
- Build PWA supaya bisa install di HP seperti apps
- Akses multi-user via PIN system
- Google Apps Script sebagai backend API

**Hasil:**
- Dashboard widget berjalan di Claude chat
- File PWA lengkap (index.html, manifest.json, sw.js, Code.gs)
- Google Sheets baru dibuat: ID `1BYXyk0XlyeuelrIa6KKch8A79z7yvOG3_RjSxft7JTo`
- App live di: https://arthabumi-id.github.io/arthabumi-fcc/

**Pending / belum selesai:**
- Apps Script belum di-deploy (butuh aksi manual dari Eddy)
- Data historis dari Excel belum diimport ke app

---

## SESSION 002 — [isi tanggal]
**Topik:**
**Dikerjakan:**
**Keputusan penting:**
**Hasil:**
**Pending:**

---

## SESSION 003 — [isi tanggal]
**Topik:**
**Dikerjakan:**
**Keputusan penting:**
**Hasil:**
**Pending:**

---

## TEMPLATE SESSION BARU
```
## SESSION 00X — [TANGGAL]
**Topik:**
**Dikerjakan:**
**Keputusan penting:**
**Hasil:**
**Pending:**
```
