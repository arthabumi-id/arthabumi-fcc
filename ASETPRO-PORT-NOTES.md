# ASETPRO PORT NOTES — FCC changes 2026-06-17 → 2026-06-19 (malam)

Sumber: FCC Arthabumi (`arthabumi-fcc/`). Baris = perkiraan, verifikasi saat porting.
AsetPro fork dari FCC v21 → semua di bawah ini BELUM ada di AsetPro.
Legend: 🐞 bug fix · ✨ fitur/UX · ⚠️ butuh REDEPLOY Code.gs (backend berubah).

---

## 1. 🐞 ⚠️ Hapus pengingat tagihan CC tahan state basi (17 Jun)
- **Fungsi:** `deleteRow()` (Code.gs) + `clearCCBill()` (index.html); auto-clear di `doPayCicilanExec()` & cabang `paycc` `saveDrawer()`
- **Lokasi:** index.html ~1568 (`clearCCBill`), ~2213, ~3677; Code.gs ~916–941 (`deleteRow`)
- **Bug:** "Lunas"/hapus pengingat tagihan CC gagal "Row not found" — `deleteRow` cari by ID, `state.ccbills` client basi → pengingat nyangkut. Pengingat juga tak auto-hilang saat tagihan/cicilan lunas.
- **Fix:** `deleteRow` idempotent + fallback hapus by nama `CC` utk sheet `CC_TAGIHAN`; `clearCCBill` kirim `cc`. Auto-hapus pengingat saat bayar CC penuh & cicilan lunas.
- **Area:** business logic + backend
- **Catatan:** `deleteRow` kini balikkan `{ok:true}` utk row tak ada (bukan error). Cek caller lain yg andalkan error "Row not found".

## 2. 🐞 Kategori biaya di form Beli Cicilan CC (19 Jun)
- **Fungsi:** `openCicilan()` + `saveCicilan()` + helper `ciFillKatGroup()`/`ciFillKatList()`/`ciOnKatSelChange()`
- **Lokasi:** index.html ~1991–2090
- **Bug:** field "Kategori biaya" cuma 1 input + datalist yg menampilkan KELOMPOK (bukan kategori) → bingung, tak bisa pilih kelompok dulu, tak bisa tambah kategori baru.
- **Fix:** ganti jadi cascade Kelompok→Kategori + opsi "➕ Tambah kategori baru…" (pola sama form Transaksi); `saveCicilan` handle `__NEW__` (cek duplikat, `addKat`).
- **Area:** UI (+ sedikit business logic)
- **Catatan:** tak ubah backend (`addKat` sudah ada). Sama persis `fillKatGroup`/`fillKatList` form txn — replikasi ke form cicilan (jenis dikunci Pengeluaran).

## 3. ✨ Reserve CC = Centang (sumber tunggal) + dua kantong (19 Jun, PRD v22 Fase A & C)
- **Fungsi:** baru `reserveNeedCC()`/`lockedInBank()`/`isReserveBank()`/`unmarkedRegularCC()`/`bankReserveSubline()`/`bankReserveCardHTML()`/`reserveGapBank()`/`cardsOnReserveBank()`; ubah `ccReserveStrip()`
- **Lokasi:** index.html ~671–720 (helper), ~630 (`ccReserveStrip`), dashboard saldo & `renderDetail`
- **Perubahan:** Reserve kartu = total transaksi dicentang (`markTotalCC`) + sisa cicilan. Rekening reserve tampil dua kantong "Reserve CC (terkunci)" vs "Bisa dipakai" + peringatan kurang. Pendanaan = transfer biasa (bukan aksi reserve manual). Tab "Reserve Fund CC" manual disembunyikan; label "reserve app lama" dibuang.
- **Area:** UI + business logic (read-model)
- **Catatan:** client-only, TIDAK hapus data RESERVE_LOG lama (cukup tak ditampilkan). `addReserve`/`reserveNow`/`unreservedCC` masih ada tapi tak terpakai. Bergantung `state.marks`, `ccHoldingBank` (kolom `RESERVE_BANK`), `state.reserveFunds`.

## 4. ✨ UX reserve: "perlu transfer sekarang", "ditandai sekarang", sticky total (19 Jun)
- **Fungsi:** `renderDetail()` (drawer Detail Akun CC), `openAccountDetail()`, `toggleMark()`
- **Lokasi:** index.html ~2849 (`openAccountDetail` snapshot `_markBaseline`), `renderDetail` (kotak sticky), `toggleMark` (toast)
- **Perubahan:** kotak ringkas sticky di atas: "Ditandai sekarang · N baris · Rp Z" (sesi ini saja, via baseline snapshot saat buka) + "Total ditandai kartu ini" + "Perlu transfer sekarang ke <bank>: Rp gap" (gap = `lockedInBank − saldo`, non-akumulasi). Toast saat tandai menampilkan total + gap.
- **Area:** UI
- **Catatan:** client-only. "Ditandai sekarang" reset saat drawer ditutup-buka (baseline = `window._markBaseline`).

## 5. ✨ ⚠️ Centang "Lunas" per transaksi CC + sembunyikan (19 Jun, PRD v23)
- **Fungsi:** Code.gs `markPaid()`/`unmarkPaid()`/`markPaidBatch()`/`_ensurePaidSheet()` + sheet `PAID_MARK`; index.html `isPaid()`/`togglePaid()`/`markPaidUntil()`, toggle hide di `renderDetail()`
- **Lokasi:** Code.gs (S/HEADERS/case/getBundle/getAllData + fungsi); index.html ~722 (helper), `renderDetail` (pil lunas + tombol "s/d sini" + toggle "Sembunyikan yang lunas")
- **Perubahan:** tandai belanja CC "lunas" (sheet `PAID_MARK`, sinkron); toggle sembunyikan yg lunas (default OFF); tombol massal "tandai lunas s/d sini" (`markPaidBatch`). Murni filter tampilan — tak ubah tagihan/saldo/reserve.
- **Area:** UI + backend
- **Catatan:** ⚠️ REDEPLOY (sheet + 3 action). `state.paidMarks` di init/saveLocal/sync/Object.assign. Pola sama `RESERVE_MARK` (v20).

## 6. ✨ Rekonsiliasi tagihan: baris dikunci → auto-lunas, tak muncul lagi (19 Jun, v23.1)
- **Fungsi:** `lockCCBillUI()`, `renderCCBill()`, `ccbTick()`
- **Lokasi:** index.html ~1573 (`lockCCBillUI`), ~2375 (`renderCCBill`), ~2355 (`ccbTick`)
- **Perubahan:** saat "Kunci ke Dashboard", baris CC yg dicentang (punya TXN_ID) otomatis ditandai lunas (`markPaidBatch`) → tak muncul lagi di rekonsiliasi berikutnya (`renderCCBill` filter `!isPaid`). Checkbox dapat `data-id`. Bar total "Dicentang sekarang" sticky di ATAS (`#ccb_topbar`, di-update `ccbTick`).
- **Area:** UI + business logic
- **Catatan:** bergantung PAID_MARK (#5). "Total tagihan berjalan" tetap dari `getCCOut` (tak terpengaruh paid).

## 7. ✨ PWA icon/manifest + laporan HTML mobile + analisis KPI (17 Jun)
- **Fungsi:** `<head>` script ikon dinamis (canvas) + manifest blob; `exportHTMLReport()`
- **Lokasi:** index.html ~167 (head PWA), ~4210+ (report CSS mobile), ~4402+ (blok analisis KPI)
- **Perubahan:** apple-touch-icon + manifest via canvas/blob; laporan HTML responsif ≤640px; tambah KPI (burn rate, runway, DSO, net margin, WCR, ROI per kelompok, piutang >60hr, dll).
- **Area:** UI + chart/report
- **Catatan:** client-only. Branding "FCC Arthabumi" di ikon → ganti utk AsetPro.

---
PRIORITAS PORT (saran): #2 & #1 (bug) dulu → #5/#6 (butuh redeploy, sekalian) → #3/#4 (reserve redesign) → #7 (kosmetik, hati2 branding).
