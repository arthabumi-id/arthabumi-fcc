# UPDATE.md — Changelog FCC Arthabumi PWA
> Catat setiap perubahan fitur, improvement, atau perubahan design.

---

## v1.0.0 — 2026-05-31 — LAUNCH
**Type:** Initial Release
**Changes:**
- Dashboard: metric cards (saldo bank, outstanding CC, reserve, net cash, project aktif)
- Dashboard: saldo per rekening dengan masuk/keluar
- Dashboard: status kartu kredit (outstanding + reserve coverage)
- Dashboard: aktivitas terbaru 8 transaksi
- Transaksi: list dengan filter (search, tipe)
- Transfer: antar rekening dengan preview saldo sebelum/sesudah
- Transfer: reserve fund CC dengan coverage bar
- Project: kartu per project dengan cashflow (masuk/keluar/sisa)
- Master: kelola bank, kartu kredit, kategori (tambah/edit/hapus)
- PWA: installable di Android & iPhone
- Offline: data tersimpan di localStorage, sync ke Google Sheets
- Auth: PIN system (multi-user)
- Backend: Google Apps Script (7 sheet: TRANSAKSI, MASTER_BANK, MASTER_CC, MASTER_PROJECT, MASTER_KATEGORI, TRANSFER_LOG, RESERVE_LOG)

**Live URL:** https://arthabumi-id.github.io/arthabumi-fcc/
**Sheets ID:** 1BYXyk0XlyeuelrIa6KKch8A79z7yvOG3_RjSxft7JTo

---

## v1.1.0 — [TANGGAL] — [NAMA UPDATE]
**Type:** Feature / Fix / Improvement
**Changes:**
- 

---

## TIPE UPDATE
- `Feature` — fitur baru
- `Fix` — perbaikan bug
- `Improvement` — peningkatan fitur yang sudah ada
- `Design` — perubahan tampilan
- `Performance` — optimasi kecepatan
- `Security` — keamanan (PIN, akses)

## CARA UPDATE FILE KE GITHUB
1. Edit file (index.html / Code.gs / dll.)
2. Buka github.com/arthabumi-id/arthabumi-fcc
3. Klik file → Edit (ikon pensil)
4. Paste kode baru → Commit changes
5. GitHub Pages auto-deploy dalam ~1 menit
