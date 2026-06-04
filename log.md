# LOG.md — Riwayat Session FCC Arthabumi
> Catat setiap session: tanggal, apa yang dikerjakan, hasil, dan catatan penting.

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
