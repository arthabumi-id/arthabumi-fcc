# LOG.md — Riwayat Session FCC Arthabumi
> Catat setiap session: tanggal, apa yang dikerjakan, hasil, dan catatan penting.

---

## SESSION — 2026-07-05 (v30.6 Mode Bisnis di Dashboard) — CLIENT-ONLY, sw.js v55
- **Konteks:** dashboard mencampur pribadi & bisnis (data riil: pengeluaran PRIBADI Mei 39,5jt / Jun 86,2jt — Juni ketiban pos besar: sekolah 20,8jt + Mami 22,7jt). PRD sign-off Eddy: TRAVELING ikut pribadi, default mode 'Semua', pemasukan pribadi ikut di-exclude (simetris).
- **Implementasi (CLIENT-ONLY, tanpa redeploy):** `state.dashMode` (persist `fcc_dashmode`, default 'semua'); helper `isPribTxn(t)` (kategori KELOMPOK PRIBADI/TRAVELING) + `setDashMode(m)` (dekat daysAgoISO); toggle chip **Semua/Bisnis** di atas dashboard (`dmChip` di renderDashboard). Mode Bisnis: strip "Bulan ini" exclude txn pribadi (masuk & keluar) + kartu baru "Pribadi bulan ini" (keluar/masuk pribadi, warna ungu, label "di luar metrik"); donut Komposisi Pengeluaran drop PRIBADI+TRAVELING (`delete kelompokMap.*` di renderCharts) + label "· tanpa pribadi". Net Cash/saldo/forecast SENGAJA tak disentuh (uang riil masih campur — memisah angkanya = bohong; nanti v2 tandai rekening Bisnis/Pribadi di MASTER_BANK, ⚠️ butuh redeploy).
- **Verifikasi:** vm.Script per blok (state-init, helpers, renderDashboard, renderCharts) semua OK; Grep-verify sisi Windows 12 marker + sw.js v55. ⚠️ Mount bash kini juga TERPOTONG utk index.html (~467k chars, putus di goPage) — node-check full file via bash tak bisa; cek per blok / Read tool.
- APP_VERSION→v30.6, CHANGELOG +1, sw.js → **v55**. **Deploy: commit+push index.html + sw.js via GitHub Desktop (client-only).**
- **v30.8 (sesi sama) — Lock tagihan CC bisa TAMBAHKAN, sw.js v57:** Eddy tanya: lock tagihan, lalu ada txn kelupaan → centang & lock lagi, apakah dijumlah ke tempo yang sama? FAKTA kode lama: TIDAK — `lockCCBill` backend & client SELALU hapus bill lama per kartu → lock kedua MENIMPA (nominal lama hilang dari pengingat; baris lama sudah ter-paidMark jadi tak muncul lagi di Rincian). Workaround lama: isi kolom "Total statement" dgn angka gabungan. **Fix v30.8 (client-only):** di `lockCCBillUI`, bila `ccBillFor(name)` ada → confirm "OK=TAMBAHKAN (total gabung, tempo & periode-awal lama dipertahankan) / Batal=GANTI"; `finalAmt/finalDue/finalFrom` dipakai di state.ccbills.push + apiPost lockCCBill (backend replace-row jadi aman krn nominal sudah gabungan — Code.gs TIDAK diubah). Simulasi tambah/ganti/baru PASS; vm.Script lockCCBillUI OK. ⚠️ Catatan: kalau user pakai workaround "total statement gabungan" + pilih TAMBAHKAN → dobel; dialog menampilkan totalnya jelas.
- **v32.3 (8 Jul) — TTD invoice AKAR SEBENARNYA + info termin, CLIENT-ONLY, sw.js v62:** Eddy lapor ttd MASIH kepotong meski fix @page v32.2. Diagnosa: **base64 INVOICE_TTD KORUP sejak v30.4** (PIL: "unrecognized data stream contents" — header 125×120 terbaca tapi stream rusak; browser cuma decode beberapa baris atas → tampak "kepotong". Bukan CSS!). Fix: proses ulang dari `Ttd Ko Eddy2.png` asli (342×332): latar >205→transparan, trim bbox, pad 6px, resize 121×116 (2× tampilan 58px), PNG 13KB, verifikasi decode utuh sebelum & sesudah embed (python str.replace via bash + Grep-verify). **+ Fitur (permintaan Eddy): form Tambah/Edit Termin (openPiutang) tampilkan ringkasan** `piutangProjInfoHTML(nm,exceptId)` → kartu biru: nilai kontrak efektif / sudah dibayar (lunas) / terjadwal belum dibayar / SISA belum terjadwal (merah + warning bila termin > kontrak; saat edit, termin sendiri di-exclude). Update live saat ganti project (onPiutangProj → #pi_info). vm.Script OK. APP_VERSION→v32.3, sw.js → v62.
- **v32.2 (8 Jul) — Fix ttd invoice kepotong di PDF, CLIENT-ONLY, sw.js v61:** window.print() tanpa `@page` → browser menambah margin default di atas .page yang sudah 210×297mm penuh → blok ttd di bawah terdorong lewat batas halaman. Fix di invHTML style: `@page{size:A4;margin:0}`; @media print .page jadi `width:auto;min-height:auto` (padding .page berfungsi sbg margin); `.foot` +`break-inside:avoid;page-break-inside:avoid` (blok ttd & pembayaran tak boleh terbelah antar halaman). APP_VERSION→v32.2, CHANGELOG +1, sw.js → v61. Ikut push yang sama dgn v32/v32.1 (belum di-push).
- **✅ EKSEKUSI VIA BROWSER (8 Jul malam, Claude in Chrome + Eddy login sendiri):** (1) Verifikasi project GAS asli via Deployment ID = fcc_api_url (banyak duplikat "FCC Arthabumi" dari salinan backup harian — yang asli dibuka via list /u/4, dicek ID AKfycbyxgx44...); TEMUAN: Eddy sudah paste Code.gs v31 (identik repo, byte-per-byte) tapi LUPA redeploy (masih Version 36/2 Jul). (2) Inject `rapikanJul8` via monaco.editor setValue (repo raw + skrip; clipboard OS tidak dipakai) → Save → Run: backup "FCC Backup 2026-07-08 1918" OK, **5 pembayaran tercatat** (log per baris), 0 mark dilepas (sisa mark kartu2 itu milik statement berikutnya — Eddy sudah uncheck manual yang lama). (3) **REDEPLOY sukses → Version 37 (8 Jul 19:20)**, Deployment ID tetap → unmarkUpTo AKTIF. (4) `forceRefresh()` di app → verifikasi: Outstanding CC 108,1jt→**84.318.016** (−23.790.490 persis), Ronah −18,8jt, CIMB −4,99jt. ⚠️ **SALDO CIMB JADI −224.632** → ada setoran/top-up CIMB riil yang belum tercatat — Eddy cek m-banking CIMB & catat pemasukannya. Sisa PR: push v32.1 (GitHub Desktop), cek statement BMW (marks 70jt vs bill 13jt), setoran CIMB.
- **CEK FULL VIA BROWSER+DRIVE (8 Jul):** deployed = v31 ✓ (v32.1 belum push). DB: `rapikanJul5` TIDAK pernah dijalankan (0 koreksi) → DIBATALKAN, digantikan **`rapikan-v2-8jul2026.gs`** (fungsi `rapikanJul8`, idempotent-guard TAG). Temuan kritis: 5 tagihan 7–9 Jul hilang dari CC_TAGIHAN TANPA transaksi pembayaran (Eddy klik "Lunas" setelah form Bayar gagal krn error reserve-lama) padahal RIIL SUDAH DIBAYAR — CIMB-JCB & ACCOR dari CIMB, BMW/INFINITE/BNI dari SEABANK-RONAH → skrip v2 mencatat 5 transfer (23.790.490) + lepas centangan statement terbayar (cutoff: INF 23/6, BNI 19/6, CIMB-JCB & ACCOR 27/6; BMW & KRIS dilewati). **Koreksi saldo 552 DIBATALKAN atas keputusan Eddy** (selisih ±25,2jt dibiarkan; empat baris konversi cicilan v18 tanpa uang riil — diingat saat banding m-banking). Counter cicilan 1/x = Eddy majukan manual (+1) ✓. Marks bergerak: KRIS 79→73 (uncheck manual sesuai CSV), BMW 41→49 (70,75jt — anomali vs tagihan 13,27jt MASIH menunggu statement Maybank).
- **v32.1 (sesi sama, temuan Eddy saat tes bayar) — CLIENT-ONLY, sw.js v60:** form paycc masih prefill `nonCic` (tagihan minus cicilan — warisan model bayar-angsuran-terpisah) → tiap bayar penuh malah kena confirm "bayar sebagian". Fix: prefill = **nominal tagihan terkunci** (`ccBillFor`, sudah termasuk angsuran; fallback = total tagihan berjalan `getCCOut`), label "Nominal pembayaran" + keterangan sumber prefill; onPayCCChange ikut. `nonCic` di buildForecast SENGAJA dibiarkan (di sana cc & cicilan memang dua event terpisah). vm.Script saveDrawer+onPayCCChange OK.
- **v32 RESERVE POLICY + CLEANUP (sesi sama) — CLIENT-ONLY, sw.js v59:** PRD sign-off Eddy ("Proceed", pilih desain jangka panjang).
  - **(a) Kebijakan reserve cicilan N bulan:** `state.cicReserveN` (`fcc_cic_reserve_n`, default **2**; 0=penuh); `cicilanReserveNeed(cc)` = angsuran ber-due ≤ today+N bln yang belum terbayar (overdue IKUT — tunggakan tetap wajib siap; angsuran terakhir = total−per×(tenor−1)); `reserveNeedCC` kini pakai ini (bukan cicilanRemaining penuh). Setelan kartu "Cakupan Reserve Cicilan" (1/2/3/Penuh) di renderDisplayBox (#masterDisplay). ⚠️ Angka baru turun setelah TENOR_TERBAYAR jalan (via v31 / tombol ±1) — saat counter 0 semua, overdue bikin need=penuh (by design).
  - **(b) Cleanup jalur lama:** opsi bayar "Dana Reserve kartu ini" DIHAPUS dari form paycc (pc_src jadi hidden value='bank'; branch reserve di saveDrawer jadi dead code, dibiarkan); pc_bank auto-prefill bank penyimpan (+ onPayCCChange set pb.value); kartu "Reserve tersedia" (pot lama reserveFunds) diganti "Dana di penyimpan" (getSaldo holding); tombol "Bayar angsuran" dihapus dari cicilanRowHTML (doPayCicilan masih ada, tak terpakai); paycCicilanHTML jadi info-only (tanpa tombol Bayar per angsuran); billStrip dashboard CC +status "dana di <bank> siap ✓ / kurang X" (reserveGapBank).
  - **Verifikasi:** vm.Script 7 blok OK; simulasi cicilanReserveNeed data asli: N=1 → 34,3jt, N=2 → 38jt, penuh 41,7jt (KRIS stuck di penuh krn counter 0 + overdue — benar). Sisa string "Dana Reserve kartu ini" = 0.
  - APP_VERSION→v32, CHANGELOG +1, sw.js → **v59**. Deploy: push saja (v32 client-only), tapi **redeploy v31 tetap prasyarat** (unmarkUpTo).
- **v31 SIKLUS RESERVE TERTUTUP (sesi sama) — ⚠️ WAJIB REDEPLOY Code.gs, sw.js v58:** PRD sign-off Eddy (auto + katup manual; bayar sebagian → tanya dulu).
  - **Code.gs:** action baru `unmarkUpTo(ss,{CC,CUTOFF})` + route — hapus RESERVE_MARK per CC yg tanggal txn-nya ≤ cutoff (join tanggal dari TRANSAKSI di server, krn client mungkin tak memuat txn lama).
  - **index.html:** (a) `advanceCicilanPaid(cc,cutoff)` — majukan TENOR_TERBAYAR utk angsuran ber-due ≤ cutoff (due ke-(k+1)=TGL_MULAI+k bln, konsisten cicilanInstallmentsInPeriod; set STATUS Lunas bila penuh; via updateRow CICILAN, TANPA gerak uang — beda dgn doPayCicilan yg gerak uang); (b) blok release di saveDrawer paycc SEBELUM auto-clear bill: cutoff=PERIODE_SAMPAI bill (fallback tgl bayar), confirm bila nominal<bill (bayar sebagian) atau tanpa bill; optimistic filter state.marks + `apiPost unmarkUpTo` + toast ringkasan; (c) tombol **+1 terbayar / −1** (`cicAdj`) di cicilanRowHTML — koreksi penanda manual dua arah.
  - **Verifikasi:** vm.Script helpers/cicilanRowHTML/saveDrawer/unmarkUpTo OK; simulasi advanceCicilanPaid 5 kasus PASS (2 angsuran utk mulai 18 Mei cutoff 19 Jun; 0 utk mulai 24 Jun; 5 utk Feb–Jun; idempotent; cap tenor).
  - APP_VERSION→v31, CHANGELOG +1, sw.js → **v58**. **Deploy: push index.html+sw.js + REDEPLOY Code.gs (New Version).** Urutan pakai: jalankan `rapikanJul5` dulu (baseline bersih) → baru siklus otomatis jalan.
- **REKONSILIASI RESERVE (sesi sama, 5 Jul):** Eddy tanya kenapa "perlu transfer sekarang" KRIS 111jt. Bedah data: (a) saldo BCA 552 app −932.284 vs riil 24.289.511 → kurang 25.221.795 (akar: 4 konversi cicilan v18 Mei membukukan Pengeluaran 552 tanpa leg masuk = 20.303.853 — koreksi 5 Jun dulu keliru dieksekusi sbg TRANSFER RIIL 082→552 sehingga defisit tak tertutup + residual 4,9jt tak teridentifikasi); (b) centangan RESERVE_MARK tak pernah dilepas saat bayar & TENOR_TERBAYAR cicilan semua 0 → "terkunci" menggelembung. Forex 50jt (10 Jun, 552→USD BCA) SUDAH tercatat benar. Simulasi 4 skenario (file analisis): setelah koreksi+bersih-bersih, gap 552 ±42jt = kewajiban SAH (tagihan KRIS 17 Jul 29,9jt + cicilan). **Deliverable: `rapikan-reserve-5jul2026.gs`** (paste & Run sekali di editor GAS: backupNow → koreksi saldo 552 ke target riil → hapus 23 mark usang 4.416.136 by ID) + `uncheck-reserve-mark-2026-07-05.csv` (daftar UNCHECK/BIARKAN). ⚠️ ANOMALI BMW: marks aktif 61,3jt vs tagihan terkunci 13,27jt — menunggu Eddy cocokkan statement, 40 baris TIDAK disentuh. **PENDING: fix sistemik v31** (bayar CC → auto-lepas centangan + majukan TENOR_TERBAYAR) — PRD belum dibuat. Siklus statement per kartu (dipakai utk cutoff): KRIS cetak~19/tempo 17; BMW ~21-23/7; INFINITE ~2/7; ACCOR ~27/9; CIMB-JCB ~2/8; BNI ~19/8.
- **v30.7 (sesi sama, feedback Eddy setelah tes):** toggle Semua/Bisnis dipindah dari atas dashMetrics → atas #dashCharts (sebelum kartu "Arus Kas 6 Bulan"); `dmChip` diangkat jadi const top-level (sesudah setDashMode) krn dipakai renderCharts; label mode ikut pindah (mode Semua kini juga berlabel "Metrik: semua transaksi"). Kartu ungu "Pribadi bulan ini" TETAP di bawah strip Bulan ini (hanya muncul saat mode Bisnis — sempat membingungkan Eddy krn ia masih di mode Semua). vm.Script 3 blok OK. APP_VERSION→v30.7, sw.js → **v56**. Push ulang index.html+sw.js.
- **Catatan konsultasi (di luar kode):** rekomendasi pemisahan keuangan pribadi/bisnis per 1 Agu: gaji tetap transfer "GAJI EDDY" (baseline rutin ±38-40jt/bln + provisi tahunan → ±45-50jt), 1 rekening khusus pribadi, dedikasikan 1-2 CC pribadi, prive dicatat. Data hygiene: kategori Allianz vs Asuransi kemungkinan dobel (5,98jt bergantian Mei/Jun); Claude.ai 3,8jt di PRIBADI padahal alat kerja → pindah OPERASIONAL; 1 kategori kelompok TRAVELING (tak ada di dropdown form) → ikut pribadi.

---

## SESSION — 2026-07-02 (v30.5 Versi di halaman login + ⚠️ INSIDEN DEPLOY GITHUB PAGES)
### v30.5 (sw.js v54, CLIENT-ONLY): nomor versi di halaman login
- Eddy minta versi kelihatan di halaman PIN (sebelum login) utk cek deploy tanpa masuk.
- Tambah `<span id="loginVer">` di `#loginScreen` (bawah teks "Masukkan PIN"); setter top-level `try{ ...getElementById('loginVer').textContent=APP_VERSION }catch{}` tepat setelah `const APP_VERSION` (login HTML ada sebelum `<script>` jadi elemen sudah ada saat script jalan). APP_VERSION→v30.5.

### ⚠️⚠️ INSIDEN DEPLOY — GitHub Pages nyangkut seharian (PENTING, baca kalau versi app nggak update)
**Gejala:** app tetap tampil versi lama (v30.1) walau kode di GitHub sudah v30.4+ dan sudah ke-push (dikonfirmasi via `git fetch` FETCH_HEAD & raw.githubusercontent). Bukan cache PWA — server memang belum menyajikan versi baru.
**Diagnosis (via GitHub Actions API `/actions/runs`):** workflow **"pages build and deployment" GAGAL** berturut-turut. DUA masalah terpisah:
1. **BUILD gagal** = **Jekyll** tersedak isi repo. **FIX permanen: file kosong `.nojekyll` di root repo** → Pages skip Jekyll → build hijau. (Ini fix yang harus TETAP ada; jangan dihapus.)
2. **DEPLOY gagal** = **"Timeout reached, aborting!"** di job `deploy` (~10 mnt) — environment `github-pages` MACET di sisi GitHub (bukan ukuran repo (cuma 5MB) & bukan file kita — sudah discan bersih: no symlink/CNAME/temp/nama aneh; githubstatus semua operational).
   **FIX yang berhasil:** **Settings → Pages → unpublish (Branch=None, Save) → TUNGGU 2–3 menit → set balik main / (root), Save.** Jeda 2–3 menit itu kuncinya (toggle cepat tanpa jeda TIDAK berhasil). Setelah reset, deploy hijau.
**Pelajaran utk next time app nggak update:** (a) pastikan `.nojekyll` ada; (b) cek tab **Actions** → run "pages build and deployment" hijau/merah; (c) kalau deploy timeout → reset unpublish/republish Pages dgn jeda. Alternatif kalau GitHub rewel terus: pindah host ke Cloudflare Pages (URL ganti → install ulang PWA).
**Catatan tooling:** `git fetch` dari sandbox meninggalkan `.git/*.lock` yg memblok GitHub Desktop ("lock file exists") & tak bisa dihapus dari sandbox (permission) → user hapus manual (`del ...\.git\index.lock` + `.git\objects\maintenance.lock`). **JANGAN jalankan git yg menulis di repo E:\Mirror dari sandbox.**

---

## SESSION — 2026-07-01 (v30.3 Invoice polish) — CLIENT-ONLY, sw.js v52
- Eddy minta 3 hal di invoice: (1) nama customer bisa diedit + alamat customer opsional saat bikin invoice, (2) nominal pakai "Rp.", (3) tanda tangan.
- **Done:** builder tambah field `#inv_cust` (prefill KLIEN) + `#inv_alamat` (prefill ALAMAT_KLIEN); genInvoice baca keduanya (override per-invoice, tak ubah project). invHTML: HARGA/TOTAL HARGA/TOTAL prefix "Rp.". Slot ttd `${o.ttd?<img>:''}` di area sign; const `INVOICE_TTD=''`.
- **v30.4 (sw.js v53):** tanda tangan Eddy (`Ttd Ko Eddy2.png`, sudah transparan) diproses (bersih latar >205 + trim + resize 120px PNG ~19KB b64) → embed ke `INVOICE_TTD`; tampil di area sign atas "EDDY SANTOSO". node --check invoice OK.

## SESSION — 2026-07-01 (v30.2 Auto-termin DIBATALKAN) — CLIENT-ONLY, sw.js v51
- Eddy: fitur auto-termin kurang praktis → cancel. Hook di save project (`setTimeout offerTerminModal`) DIHAPUS. Blok modal (DEFAULT_TERMIN/offerTerminModal/tm*/saveTerminBatch) dibungkus `/* DISABLED v30.2 ... */` (kode mati dipertahankan, bisa diaktifkan lagi). Termin tetap bisa via Piutang "Tambah Termin" manual. Invoice TIDAK terpengaruh (baca dari state.piutang). node --check: komentar seimbang + invoice parse OK. APP_VERSION→v30.2, hapus entri changelog v30, sw.js→v51.

## SESSION — 2026-07-01 (v30 Auto-jadwal termin dari kontrak) — CLIENT-ONLY, sw.js v48 [DIBATALKAN di v30.2]
- **Konteks:** dari sesi "upgrade" → pilih Auto-termin + Invoice PDF (kwitansi di-skip). Feature 1 dibangun dulu.
- **Auto-termin (client-only, pakai addPiutang yg ada):** saat SIMPAN PROJECT BARU dgn NILAI_CONTRACT>0 → `offerTerminModal(projId)` (setTimeout 140ms sesudah save). Modal template default `DEFAULT_TERMIN` = DP40/Progress1 35/Progress2 20/Pelunasan5 (=100%), tiap baris editable (nama/%/tanggal manual), tambah/hapus baris, nominal auto=%×kontrak, baris terakhir=sisa biar total pas. `saveTerminBatch` → buat N baris Piutang (STATUS Belum, PROJECT=nama) via bgPost addPiutang + push state.piutang → Forecast/badge refresh. Helper: tmSync/tmAddRow/tmDelRow/tmNominals/tmRender/tmRecalc. Hanya project baru (bukan retro).
- **Sign-off Eddy:** template DP40/35/20/5 (koreksi dari 105% yg ke-typo), tanggal manual, project baru saja.
- **Verifikasi:** blok termin dibaca balik seimbang (bash mount index.html sering stale → node-check via bash tak andal). APP_VERSION→v30, CHANGELOG +1, sw.js → v48. Client-only (push index.html+sw.js).
### v30.1 Invoice generator — ⚠️ REDEPLOY (kolom baru) + sw.js v49
- **Backend:** HEADERS[S.PROJ] +ALAMAT_KLIEN/TELP_KLIEN/KODE; getBundle ensureCol 3 kolom itu (migrasi idempotent). WAJIB redeploy Code.gs.
- **Client form project:** +field Alamat Klien, Telp Klien, Kode Invoice (fp_alamat/fp_telp/fp_kode) + masuk save obj (KODE di-uppercase).
- **Generator:** tombol "Buat Invoice" di drawer detail project → `openInvoiceBuilder` (pilih termin, tanggal, no urut auto, nama barang auto "PEMBAYARAN <TERMIN> (<pct>%) <PROJECT>", catatan) → `genInvoice` → `invHTML` popup A4 siap cetak (window.print → Save PDF). Helper: `terbilang` (angka→huruf ID), `tglIndo`, `_invRp`, `_invNo` (DDMMYYYY/KODE/urut), `_esc`. "Telah terima" auto = termin project STATUS Lunas selain yang ditagih. Issuer/bank Arthabumi hardcode (Eddy Santoso, 0813-9086-1887, Casa Jardin; BCA 549-082-6868).
- **Logo:** SELESAI — Eddy pilih logo-opsi-2 (img-002 408×408, "arthabumi DESIGN & BUILD" cokelat). Diresize 140px + JPEG q82 → base64 (~4KB) di-embed ke `INVOICE_LOGO`. sw.js → **v50**.
- APP_VERSION→v30.1, sw.js→v50.

### (arsip) PENDING Feature 2 (Invoice PDF) — SELESAI di v30.1 di atas. Catatan format asli:** contoh invoice Eddy sudah dianalisis (format tersimpan di log). Butuh: +3 kolom MASTER_PROJECT (ALAMAT_KLIEN/TELP_KLIEN/KODE) + redeploy; generator HTML print-to-PDF; no invoice auto DDMMYYYY/KODE/urut; terbilang; "Telah terima" dari termin lunas; logo diekstrak ke outputs/invoice-assets/. Format invoice: judul INVOICE + logo; CUSTOMER (Nama/Alamat/Telp) vs issuer Eddy Santoso/0813-9086-1887/Casa Jardin Daan Mogot; tabel No|NAMA BARANG|JMLH|SATUAN|HARGA|TOTAL; TERBILANG; NOTE; transfer BCA 549-082-6868 a/n Eddy Santoso; ttd EDDY SANTOSO.

---

## SESSION — 2026-06-25 (v29.4 Input Kasbon instan / optimistic) — ⚠️ REDEPLOY, sw.js v47
- **Eddy:** input Kasbon loadingnya lama.
- **Akar:** `saveKasbon` pakai pola blocking: `await apiPost(addKasbon)` LALU `await syncAll()` (tarik ulang seluruh bundle) → 2 round-trip beruntun. Transaksi cepat krn `bgPost` optimistic + ID dibuat client (addRow pakai data.ID).
- **Kendala:** `addKasbon` backend generate ID sendiri (kasbon row, REF_ID, linked TXN) → kalau optimistic, ID lokal ≠ server → dobel saat sync.
- **Fix — ⚠️ REDEPLOY Code.gs:** `addKasbon` kini pakai `data.ID || gen`, `data.REF_ID || gen`, `data.TXN_ID || gen` (fallback). Client `saveKasbon` jadi non-async optimistic: generate id/ref/txnId, unshift state.kasbon + (bila rek) linked TXN ke state.txns + `applySummaryDelta(+1)` (saldo instan), `bgPost addKasbon` (kirim latar), `closeDrawer/renderKasbon/renderDashboard/filterTxn` langsung. TANPA syncAll. ID sama dgn server → tak dobel.
- **Catatan:** `deleteKasbon` masih pakai syncAll (belum disentuh) — bisa dioptimalkan nanti bila perlu.
- **Verifikasi:** addKasbon node --check (via Grep balance) OK; saveKasbon dibaca balik seimbang. APP_VERSION→v29.4, CHANGELOG +1, sw.js → v47.
- **Deploy:** redeploy Code.gs (New Version) + push index.html/sw.js v47.

---

## SESSION — 2026-06-25 (v29.3 Baris transaksi dirapikan) — CLIENT-ONLY, sw.js v46
- **Eddy:** baris transaksi susah dibaca (kategori dobel, 2 angka bertumpuk di kanan, tanggal ISO). Pilih layout "Bersih".
- **renderTxn:** subline kini `REKENING [· KATEGORI bila ada PROJECT] · shortDate` (buang kategori dobel saat judul = kategori). Tanggal `shortDate(iso)` → "29 Jun". Kanan: nominal besar; baris kedua flex kanan = `saldo <fmtS>` (disingkat jt/M, redup) + tombol **ikon pensil** (ti-pencil) ganti teks "edit"; transfer/reserve tetap "auto". Helper `shortDate` ditaruh dekat MONTH_NAMES.
- Client-only. APP_VERSION→v29.3, CHANGELOG +1, sw.js → v46.

---

## SESSION — 2026-06-25 (v29.2 Ukuran Tampilan / font scale) — CLIENT-ONLY, sw.js v45
- **Eddy:** font kekecilan, susah baca. Minta setelan font besar/kecil.
- **Pendekatan:** font px hardcode di seluruh app → tak bisa andalkan root font-size. Pakai **zoom dokumen** (`document.documentElement.style.zoom`) → skala seluruh UI proporsional (seperti Ctrl-+), andal di PWA Chromium, fixed topbar/nav tetap benar.
- **Implementasi:** `state.fontScale` (persist `fcc_fontscale`); `FONT_SIZES` [0.9 Kecil / 1 Normal / 1.15 Besar / 1.3 Sangat Besar]; `applyFontScale` (dipanggil di renderAll → ikut saat boot), `setFontScale`, `cycleFontScale`. Kartu **"Ukuran Tampilan"** di Master (`renderDisplayBox`, `#masterDisplay`, 4 tombol A) + tombol cepat `ti-text-size` (`#fontBtn`) di topbar (cycle).
- **Verifikasi:** seluruh inline JS index.html node --check OK. APP_VERSION→v29.2, CHANGELOG +1, sw.js → v45. Client-only (push index.html + sw.js).

---

## SESSION — 2026-06-25 (v29.1 Fix bug rename CC orphan data)
**Bug (Eddy):** edit nama di Master Kartu Kredit → data CC (outstanding/riwayat) hilang setelah nama diganti.
**Akar:** semua data CC dicocokkan by NAMA, bukan ID (`getCCOut` → `t.REKENING===nama`; `acctAgg`→`summary.acct[nama]`). Ganti nama hanya di baris MASTER_CC → transaksi/cicilan/tagihan/mark/reserve masih menunjuk nama lama → kartu tampak kosong. **Data tidak hilang** (workaround: rename balik ke nama lama persis). Smell sama dgn rename project (lihat reassignProject).
**Fix (mirror reassignProject) — ⚠️ WAJIB REDEPLOY Code.gs:**
- **Code.gs `renameCC(ss,{from,to})`** + route `case 'renameCC'`: relabel from→to di `TRANSAKSI.REKENING`, `CICILAN.CC`, `CC_TAGIHAN.CC`, `RESERVE_MARK.CC`, `RESERVE_LOG.UNTUK_CC`, dan `MASTER_CC.NAMA`. Reversible (rename balik).
- **index.html:** save CC deteksi `ccRenamed` (nama berubah) → `bgPost renameCC` + `relabelCCLocal(from,to)` (relabel state.txns/cicilan/ccbills/marks/reserves + reserveFunds + summary.acct key) supaya UI langsung benar tanpa reload. Warning emas di form edit CC ("mengubah nama memindahkan semua riwayat"). updateRow MASTER_CC tetap jalan (set field lain).
- **Verifikasi:** node --check renameCC OK; seluruh inline JS index.html node --check OK. APP_VERSION→v29.1, CHANGELOG +1, sw.js → **v44**.
- **Deploy:** redeploy Code.gs (New Version) + push index.html/sw.js v44.

---

## SESSION — 2026-06-25 (v29 Backup/Restore + Forecast disempurnakan)
**Konteks:** Eddy minta input upgrade. Flag: "Cash runway 30/60/90" SUDAH ADA (halaman Forecast/buildForecast). Sepakat → (1) Backup/Restore baru, (2) UPGRADE Forecast (bukan bangun ulang) + panel cara baca. PRD sign-off "Proceed keduanya".

### v29a Backup & Restore — ⚠️ WAJIB REDEPLOY + izin Drive baru + Run installBackupTrigger
- **Problem:** DB = 1 Google Sheet tanpa snapshot; 1 edit salah bisa korup permanen (pernah hampir: forex kolom geser).
- **Code.gs (baru):** `backupNow()` = `DriveApp.getFileById(SHEET_ID).makeCopy('FCC Backup yyyy-MM-dd HHmm', folder 'FCC Backups')`; `_pruneBackups` sisakan BACKUP_KEEP=14 (sisanya setTrashed); `listBackups()` (terbaru dulu + url folder); `installBackupTrigger()` = trigger harian 02:00 WIB (JALANKAN SEKALI di editor). Routing: GET `listBackups`, POST `backupNow`.
- **Restore = MANUAL terpandu** (buka salinan, salin balik). TIDAK ada auto-overwrite sheet hidup (irreversible).
- **index.html:** kartu "Backup & Restore" di Master (`renderBackupBox`/`loadBackups`/`doBackupNow`, `#masterBackup`), tombol "Backup sekarang" + daftar salinan (link buka) + link folder Drive.
- **⚠️ Izin baru `DriveApp`** → saat pertama Run akan minta otorisasi (mirip isu UrlFetchApp kurs). Bila nyangkut: cabut akses di myaccount/permissions lalu Run ulang.

### v29b Forecast upgrade (CLIENT-ONLY) — what-if + pita optimis/pesimis + cara baca
- **buildForecast(horizon, opt)** kini terima opt `{extraMonthly, burnMult, includeOverdue}` (default {} = perilaku lama, backward-compat). extraMonthly→event keluar bulanan (simulasi); burnMult→pengali daily burn; includeOverdue→piutang lewat tempo diproyeksi masuk hari ini.
- **renderForecast:** hitung 3 skenario (base/optimis includeOverdue/pesimis burn×1.15). Kotak **Simulasi "berani nambah beban tetap?"** (input Rp/bln, persist `fcc_fc_extra`, `setFcExtra`/`clearFcExtra`) → verdict kas terendah & aman/tembus. Verdict utama "Aman sampai <tgl>" (`_breachDate`) + ringkas optimis/pesimis. Grafik 3 garis (Normal solid + Optimis/Pesimis dashed + ambang). Panel **`forecastHelpHTML`** (details, auto-open sekali) penjelasan awam.
- **Fix:** regex pemisah ribuan di input simulasi pakai `\\B`/`\\d` (single-backslash termakan template literal → diverifikasi via node).
- **Verifikasi:** node --check blok buildForecast+renderForecast+backup client OK; emit HTML attribute backslash preserved OK.
- **Deploy:** Backup = redeploy Code.gs + Run installBackupTrigger; Forecast = client-only. APP_VERSION→v29, CHANGELOG +1, sw.js → **v43**.

---

## SESSION — 2026-06-24 (Trigger kurs 10-menit + v26 Pocket Forex)
### Kurs trigger → tiap 10 menit, jam 09:00–15:00 WIB (⚠️ re-Run installKursTrigger)
- `kursAutoFetch()` baru: handler trigger, cek jam Jakarta (Utilities.formatDate) → fetch hanya bila 540≤menit≤900 (09:00–15:00), di luar itu skip. `installKursTrigger` diubah: hapus trigger lama (fetchKursBCA & kursAutoFetch) → pasang `everyMinutes(10)` ke kursAutoFetch. Manual `fetchKurs` tetap tanpa batas jam. **Eddy: update Code.gs + Save + Run installKursTrigger sekali** (tak perlu redeploy utk trigger).

### v26 Pocket Forex (kantong valas USD) — ⚠️ WAJIB REDEPLOY
- **PRD sign-off Eddy:** convert kurangi saldo bank NYATA; valuasi pakai **e-Rate Beli**; **dipisah** dari metrik bisnis (seperti Investasi); **USD saja** v1.
- **Akunting:** metode rata-rata biaya. Convert Beli (Rp→USD) = TXN Pengeluaran dari rek `TIPE_LOG:'Forex'`; Jual (USD→Rp) = TXN Pemasukan. Karena 'Forex' bukan 'Pengeluaran', otomatis EXCLUDED dari laba/komposisi/forecast (titik yg sama dgn 'Investasi'), tapi saldo bank (out.acct) tetap akurat. holding=ΣBeli−ΣJual; avgCost=ΣBeliRp/ΣBeliUSD; nilai live=holding×eRateBeli; U/R unreal=live−costHolding; realized=ΣJualRp−ΣJualUSD×avgCost.
- **Code.gs:** S.FOREX sheet `FOREX_LOG [ID,TANGGAL,JENIS,MATA_UANG,REKENING,JUMLAH_VALAS,KURS,NOMINAL_RP,NOTES,REF_ID,CREATED_BY,CREATED_AT]`; action `addForexConvert`/`deleteForex`; route `getForex`; `forex` di getBundle.
- **index.html:** state.forex (init+saveLocal+load+offline); page `page-forex` + entry "Pocket Forex" di Lainnya; `forexCalc/renderForex` (kartu holding/modal/nilai live/UR unreal+realized + daftar lot); form `openForexConvert/saveForexConvert` (kurs prefill dari live e-Rate: Beli→pakai Jual, Jual→pakai Beli; editable; auto-calc Rp); `delForex`; wire goPage/renderAll. Helper fxUsdNum (titik=desimal) vs fxKursNum (titik=ribuan).
- **Verifikasi:** simulasi avg-cost (beli 1000@15k + 500@16k, jual 600@16.5k, live beli 16.2k) → holding 900, avg 15.333, cost 13,8jt, nilai live 14,58jt, unreal +780rb, realized +700rb = PASS 6/6. Blok Code.gs & index.html node --check OK terisolasi. sw.js → **v22**. Backup: `Code-pre-forex-*`, `index-pre-forex-*`.
- **Pending deploy:** push index.html+sw.js v22 (GitHub Desktop) + **redeploy Code.gs** (new version). Convert butuh online (sentuh saldo bank, blocking+syncAll).

### v26.1 Forex per-akun valas + kartu Dashboard (⚠️ REDEPLOY, sw.js v23)
- Eddy: punya 2 tabungan valas (BCA & BNI), minta tampil di Dashboard.
- **Model:** tambah kolom `AKUN_VALAS` (tempat USD disimpan: BCA/BNI) ke FOREX_LOG (sesudah MATA_UANG). `REKENING`='(luar)' → mode **saldo awal**, TIDAK tulis TXN (uang sudah jadi USD sejak dulu); rek bank nyata → saldo bergerak. addForexConvert kini header-mapped append + validasi wajib AKUN_VALAS (bukan REKENING). ⚠️ Bila sheet FOREX_LOG sudah pernah dibuat (test v26 lama) → HAPUS tab itu biar recreate dgn header baru.
- **index.html:** forexCalc → group per AKUN_VALAS + total (avg-cost per akun). renderForex tampil rincian per akun. Form: input "Akun valas" (datalist BCA/BNI, bisa tambah) + opsi rekening "(saldo awal/luar)". Kartu Dashboard `#dashForex` + `renderForexDash()` (total USD + nilai live + U/R + rincian per akun, klik→halaman Forex; sembunyi bila belum ada data). sw.js → **v23**.
- **Verifikasi:** simulasi 2 akun (BCA beli 1500/jual600, BNI beli2000, live 16.2k) → BCA holding900 unreal+780k realized+700k; BNI holding2000 unreal+1.4jt; TOTAL holding2900 live46,98jt unreal+2,18jt realized+700k = PASS. node --check backend+UI OK. Backup `*-pre-forexakun-*`.

### v26.2 Fix dashboard forex 0 + gabung tab Forex & Kurs (CLIENT-ONLY, sw.js v24)
- **Bug:** kartu Tabungan Forex di Dashboard tampil 0 padahal halaman Forex benar. **Akar:** `goPage('dashboard')` tidak memanggil renderDashboard → kartu stale dari render lama. **Fix:** goPage kini `if(page==='dashboard')renderDashboard()` → kartu selalu fresh saat buka Dashboard.
- **Gabung tab (req Eddy):** halaman `page-kurs` DIHAPUS; isinya (Kurs BCA + tombol Perbarui + #kursList) dipindah ke bawah `page-forex` (dipisah garis). Menu Lainnya: entry "Kurs BCA" dihapus, "Pocket Forex" → "Forex & Kurs". goPage('forex') & renderAll kini render `renderForex()`+`renderKurs()`. navKey map + forex→'lainnya'. #kursList tetap unik.
- **Deploy:** CLIENT-ONLY — cukup push index.html + sw.js **v24** (GitHub Desktop), TANPA redeploy Code.gs.

### v26.3 Fix data forex geser kolom + tombol hapus gagal
- **Gejala:** holding 0 (halaman & dashboard), entri tampil "Beli — USD @ 2.785,82 ... 50000000 ... -Rp 17.948" (kolom bergeser), tombol hapus tak jalan.
- **Akar:** tab FOREX_LOG di Sheet masih header LAMA (12 kolom, tanpa AKUN_VALAS). addForexConvert v26.1 menulis 13 nilai (urutan kode, AKUN_VALAS di tengah) ke sheet 12-kolom → getSheet baca pakai header lama → semua nilai geser 1 (JUMLAH_VALAS←REKENING='(luar)'→NaN→holding 0; REF_ID geser → server deleteForex tak ketemu → hapus gagal). Eddy "hapus FOREX_LOG" kemarin = hapus baris, bukan tab.
- **Fix Eddy (no redeploy):** hapus TAB FOREX_LOG (klik kanan → Delete) → input ulang. ensureSheet bikin ulang dgn 13 kolom benar.
- **Hardening code (opsional redeploy):** addForexConvert kini `ensureCol(AKUN_VALAS)` + append pakai header AKTUAL sheet (bukan urutan HEADERS kode) → self-healing, baris baru selalu benar walau sheet beda urutan. node --check OK.

### v26.4 Penanda versi + What's new in-app (CLIENT-ONLY, sw.js v25)
- Eddy minta tahu versi yang lagi jalan + ringkasan update terakhir di app.
- `APP_VERSION='v26.4'` + array `CHANGELOG` (5 entri terbaru). Badge versi kecil di header (klik → ke Master), `setAppVer()` dipanggil di renderAll. Section "Versi & Update" di halaman Master (`#masterVersi` + `renderVersiBox()`, dipanggil di renderMaster) — tampil 5 update terakhir (versi/tanggal/ringkasan).
- **Maintenance:** tiap rilis baru → bump APP_VERSION + tambah 1 entri di CHANGELOG (paling atas) + bump sw.js. Riwayat lengkap tetap di log.md ini.
- **Deploy:** CLIENT-ONLY — push index.html + sw.js v25.

### v26.5 Tampilan premium BaZi-tuned — tahap 1 (Dashboard) — CLIENT-ONLY, sw.js v26
- **Konteks BaZi Eddy** (dari family-blueprint-santoso.md): DM 壬 Air; Five Elements Tanah51/Air23/Kayu20/Logam6/**Api0**. Warna anjuran: hijau/teal (rezeki/branding), merah-coral (Api=wealth 0%), putih/emas (Logam). Hindari kuning/cokelat (Tanah dominan) & biru dominan (itu warna Novia/Audrey). → palet **A+ = hijau base + emas highlight + coral spark**.
- **Design tokens (:root):** bg deepen ke hijau-hitam (#0A0E0C/#111A15/#16211B), border hijau-gelap, text hijau-tint; --green→#2EE6A6; +`--gold:#E7C778` +`--coral:#FF6B5C`; radius 11/16. body `font-feature-settings tnum` + `.num` tabular. **Global** (semua halaman dapat palet baru).
- **Dashboard (bespoke premium):** brand chip coral di topbar (ti-building-skyscraper); 2 kartu hero (Net Cash, Laba) gradient hijau premium + garis emas + angka `.num` lebih besar; kartu belum-reserve tone merah baru; nilai live Forex (dash & halaman) biru→**emas** (wealth=Logam). Semantik tetap: hijau=masuk, merah=keluar.
- **Belum disentuh (rollout berikutnya):** gradient lama #0a2a1e di renderReserveDetail (1676), transfer (3482), drawer detail CC (3164); login logo emoji. Tetap kebaca di bg baru.
- **Verifikasi:** renderDashboard node --check OK; backtick/brace balanced. Backup `index-pre-design-*`.

### v26.6 Tema premium diratakan ke semua halaman — CLIENT-ONLY, sw.js v27
- Sapu warna hardcode lama → palet baru (replace_all): `#2dd4a0`→`#2EE6A6` (16x), hero grad `#0a2a1e,#0d1f2d`→`#0E2A1F,#0A1712` (6x), inset `#12121a`→`#0E1611` (8x), border `#2e2e3e`→`#1F2B25` (10x), `#2bd47d30`→`#2EE6A640`.
- Dibiarkan (sudah serasi/aksen sektoral): chip hijau-gelap `#0a2a1e` (tombol Bayar/badge), gradient biru (forecast) & amber (piutang/kasbon) sebagai aksen per-section, login logo emoji.
- Pure color swaps → tak ubah struktur JS.

### v26.7 Penataan susunan Dashboard + menu Lainnya — CLIENT-ONLY, sw.js v28
- **Strip "Bulan ini"** di atas Dashboard: masuk/keluar/net bulan berjalan (hitung dari txns TIPE_LOG Pemasukan/Pengeluaran, exclude transfer/reserve/forex/dll).
- **Hero tunggal:** hanya Net Cash yang jadi kartu hero besar (gradient+emas). Laba turun jadi metric biasa di grup Bisnis.
- **Grup metrik:** Aset (Total Saldo Bank + Tabungan Forex bila holding>0, klik→halaman Forex) · Kewajiban (Outstanding CC, Dana Disisihkan, Belum-reserve & Cicilan bila >0) · Bisnis (Project Aktif, Laba). Kartu nilai 0 disembunyikan. Total Saldo Bank `wide` bila Forex absen (hindari kartu setengah sendirian). Semua angka `.num` tabular.
- **Menu Lainnya dikelompokkan:** sub-judul Keuangan (Kasbon, Piutang, Forecast) + Aset (Forex&Kurs, Investasi; ikon emas). 
- **Verifikasi:** renderDashboard node --check OK (172 baris). Pakai forexCalc()/usdFmt() (hoisted/top-level const, aman saat runtime).

### v26.8 Poles halaman dalam (CSS global) — CLIENT-ONLY, sw.js v29
- **Latar:** body radial-gradient glow hijau halus di atas (#13231C→bg). Scrollbar tipis.
- **Komponen global (kena semua halaman):** `.card` transition + active scale; `.metric` dapat border + active scale + cursor; `.form-input:focus` ring hijau (box-shadow 3px); `.btn-primary` shadow hijau lembut + active scale + teks #06140D; `.nav-item.active::before` indikator bar hijau di atas + transition; `.topbar` shadow bawah utk depth; `.card-title` letter-spacing.
- **Re-tone gradient sektoral:** forecast biru `#0C2233,#0A1620`; piutang/kasbon amber `#2A1F0A,#180F06` (buang ekor biru #0d1f2d).
- **Verifikasi:** style block brace 118/118 balanced; 4 marker poles ada. Backup `index-pre-polish-*`.

### v26.9 Mode mata (privasi) + tema terang/gelap — CLIENT-ONLY, sw.js v30
- **Mode mata:** `state.hideAmounts` (persist `localStorage fcc_hide`). fmt/fmtS/usdFmt → '••••' saat aktif (fmtSigned ikut via fmt). Kurs (kursFmt) TIDAK disembunyikan (rate publik). Tombol mata di topbar (ti-eye/eye-off), `toggleHide()` + renderAll. setEyeIcon di renderAll & boot.
- **Tema:** `state.theme` (persist `localStorage fcc_theme`). Tombol bulan/matahari di topbar. `applyTheme()` toggle `body.light` + ikon; dipanggil di renderAll & boot (login ikut bertema). Palet `body.light` override semua CSS var (bg putih, text gelap, green/gold/coral disesuaikan kontras). Var baru `--inset` & `--glow` (light: putih → glow hilang). `background:#0E1611`→`var(--inset)` (8x). Override `.light .badge-*`, `.light .btn-danger/.btn-primary`.
- **Catatan:** kartu hero gradient & chip aksi kecil (#0a2a1e) tetap gelap di light mode (by design, aksen). Mungkin perlu setel halus bila ada elemen kurang kontras — tunggu feedback Eddy.
- **Verifikasi:** style brace 126/126; formatter+toggle node --check OK; 18 marker. Backup `index-pre-polish-*` (sesi sama).

### v27.0 Light mode dirombak premium (warna adaptif dua tema) — CLIENT-ONLY, sw.js v31
- **Akar masalah light mode:** banyak warna gelap di-hardcode inline (chip ikon txn, kartu hero, tombol aksi) → tak ikut berubah. Solusi: jadikan token semantik.
- **Token baru** (:root dark + body.light): `--hero-bg/-bd` (+ red/blue/amber varian), `--ic-green/red/blue/purple/amber` (chip ikon), `--shadow-card`. Light = tint lembut + bayangan halus; dark = gradient/chip gelap seperti semula.
- **Konversi (replace_all):** hero gradient `linear-gradient(...0E2A1F...)`→`var(--hero-bg)` (5 kartu: dashboard NetCash, belum-reserve, forecast, kasbon, reserve-detail, transfer-strip); chip ikon `#0a2a1a/#0a2a1e/#0a1f14→var(--ic-green)`, `#2a0a0a→ic-red`, `#0a1a3a/#0a2040→ic-blue`, `#1a0a3a→ic-purple`, `#2a1a0a/#241a05→ic-amber`. ⚠️ hex ini juga ada di :root def → setelah replace_all, baris :root dipulihkan manual ke hex asli.
- **CSS light polish:** `.card`/`.metric` box-shadow var; `.light` override topbar/nav/toast/sync putih + topbar shadow lembut.
- Kartu hero pakai metric-label/value/sub (var-driven) → teks adaptif, bukan putih hardcode.
- **Verifikasi:** style brace 132/132; 0 stray hero gradient di usage; 24 var(--ic-*); renderDashboard node --check OK. Backup `index-pre-light2-*`.

### v27.1 Garis chart adaptif + blok gelap tab CC — CLIENT-ONLY, sw.js v32
- **Chart:** helper `gridCol()` (light #E6EAE6 / dark #1F2B25); `color:'#1F2B25'`→`color:gridCol()` (5 chart). `applyTheme` set `Chart.defaults.color` (tick/legend) per tema. `toggleTheme` panggil `renderAll()` → chart redraw saat ganti tema.
- **Tab Kartu Kredit:** `#1a1030`→`var(--ic-purple)` (Beli Cicilan), `#1a1206`→`var(--ic-amber)` (Rincian ×4), `#b9a3ff`→`var(--purple)` (×14 teks cicilan), bar progress `#222`→`var(--inset)` + `#7c5cff`→`var(--purple)`.
- **Verifikasi:** 0 sisa `color:'#1F2B25'`; 0 sisa blok gelap CC; renderCharts & applyTheme node --check OK; style 132/132.

### v27.2 Fix PWA install (buka sbg app, bukan browser) — sw.js v33
- **Akar:** ada `<script>` yg inject manifest BLOB (canvas icon 180px, branding biru #1F4E79 lama) → menimpa manifest.json statik. Android Chrome butuh ikon 192 & 512 utk WebAPK; krn cuma ada 180px data-URL → cuma bikin shortcut (buka di Chrome). File icon-192/512.png yg dirujuk manifest asli juga TIDAK ADA.
- **Fix:** (1) generate ikon asli `icon-192.png`,`icon-512.png`,`apple-touch-icon.png` (coral + gedung, on-brand) via PIL; (2) HAPUS script blob manifest + canvas; ganti `<link rel=apple-touch-icon/icon>` statik; (3) theme-color → #0A0E0C (buang #1F4E79); (4) manifest.json: bg/theme #0A0E0C, +scope, +purpose any & maskable; (5) sw ASSETS + ikon, cache v33.
- **Eddy harus:** hapus shortcut lama → buka situs di Chrome → menu ⋮ → **Install app / Tambahkan ke layar utama** (sekarang muncul opsi install WebAPK) → buka standalone tanpa address bar.
- File baru di repo: icon-192.png, icon-512.png, apple-touch-icon.png (perlu di-push).

### v27.3 Saldo berjalan per transaksi (buku tabungan) — CLIENT-ONLY, sw.js v34
- Di halaman Transaksi, tiap baris (rekening bank) tampil saldo SETELAH transaksi itu (ikon businessplan + Rp).
- **Metode:** anchor ke `getSaldo(bank).saldo` (akurat dari agregat server, tak terpengaruh txnsSince), lalu MUNDUR dari txn terbaru: `runBal[t]=bal; bal -= (Pemasukan?+nom:-nom)`. Map dihitung dari SEMUA state.txns (bukan hanya filtered) → benar walau list difilter. Hanya untuk REKENING bank (CC tak punya konsep saldo → dilewati). Ikut mode mata (fmt mask).
- **Verifikasi:** simulasi backward (saldoawal10, +100/−30/+50 → 110/80/130) PASS; renderTxn node --check OK.

### v27.4 Pull-to-refresh — CLIENT-ONLY, sw.js v35
- Tarik ke bawah di puncak halaman mana pun → `syncAll()` → re-render via renderAll TAPI tetap di tab/halaman aktif (goPage tak dipanggil).
- `#ptrInd` indikator (panah putar → spinner saat load) sbg anak pertama #content. Handler touchstart/move/end (threshold 70px efektif, redam 0.5x, guard busy). Native pull-to-refresh dimatikan via `overscroll-behavior-y:contain` di .content.
- **Verifikasi:** PTR IIFE node --check OK; style brace 136/136.

### v27.5 Forex: average rate + rincian transaksi per bank — CLIENT-ONLY, sw.js v36
- **Average rate modal:** kartu ringkasan tampil `avg rate @ X` keseluruhan (= costHolding/holding); breakdown per-akun + halaman tampil `avg @ avgCost` per bank (sudah dihitung di forexCalc byAkun: beliRp/beliUSD).
- **Rincian transaksi dikelompokkan per bank:** daftar lot kini dikelompokkan per AKUN_VALAS, tiap grup header bank (nama + holding USD + avg @ rate), lalu transaksi-transaksinya (Beli/Jual, USD @ kurs, dari rekening, tanggal, rupiah, hapus). lotRow jadi helper.
- **Verifikasi:** renderForex node --check OK.

### v27.6 Forex: edit transaksi — CLIENT-ONLY, sw.js v37
- Tombol "edit" di tiap baris transaksi forex → `openForexConvert(refRef)` prefill semua field (jenis/akun/rekening/USD/kurs/tanggal/notes) + judul "Edit", tombol "Simpan Perubahan". Var modul `fxEditRef`.
- `saveForexConvert`: bila editing → `deleteForex(oldRef)` lalu `addForexConvert(new)` (reverse TXN lama + tulis baru → saldo bank tetap benar). fxEditRef di-reset; buka Convert baru reset null (aman dari cancel).
- **Verifikasi:** openForexConvert+saveForexConvert+renderForex node --check OK.

### v27.7 Dashboard: kartu Investasi — CLIENT-ONLY, sw.js v38
- Grup Aset Dashboard kini: Total Saldo Bank + Tabungan Forex (bila ada) + **Investasi** (bila ada akun). Kartu invest: nilai portofolio `fmt(investTotals().nilai)` (ungu) + U/R `inv.rp`. Klik → goPage('invest'). `asetWide` bank full-width hanya bila tak ada forex & invest.
- **Verifikasi:** renderDashboard node --check OK.

### v28.1 Tab Forex & Kurs: Kurs di atas berframe — CLIENT-ONLY, sw.js v42
- page-forex disusun ulang: blok KURS dipindah ke ATAS, dibungkus frame (border 1.5px var(--gold) + bg var(--ic-amber) + radius), header emas + tombol Perbarui emas. Pocket Forex (+Convert) di BAWAH. #kursList & #forexBody tetap (render functions tak berubah).

### v28.0 Detail akun: klik slice chart → filter kategori — CLIENT-ONLY, sw.js v41
- Donut kategori di drawer Detail Akun (openAccountDetail) kini di-pass `acctSliceClick` → klik bagian = set `window._acctKat` (toggle), `acctFilter()` re-render. Daftar transaksi `rowsF` difilter by KATEGORI; donut tetap tampil semua (dari `data`). Chip aktif "Kategori: X · N txn · total Rp · hapus". Reset `_acctKat=''` tiap buka akun. Hint "Ketuk bagian chart untuk filter".
- **Verifikasi:** openAccountDetail node --check OK.

### v27.9 Komposisi Pengeluaran Dashboard clickable — CLIENT-ONLY, sw.js v40
- Dashboard "Komposisi Pengeluaran" pakai `state.summary.katExp` = agregat SEMUA waktu, per Kelompok (bukan bulanan). Label diperjelas "· semua waktu".
- Kartu kini clickable → `goPage('master');switchMasterTab('kat')` = rincian interaktif (expCompCardHTML + buildKatDonut): filter periode (bulan/semua/custom) + drill-down slice Kelompok→Kategori→transaksi. Hint "Ketuk untuk rincian".

### v27.8 Forex: U/R live per transaksi & per bank — CLIENT-ONLY, sw.js v39
- Header grup bank: tambah U/R (a.unreal) ikut kurs live. Per transaksi Beli: `ur = JUMLAH_VALAS × (liveBeli − KURS)` → baris "untung/rugi ±Rp X @ live <rate>" (hijau/merah). Jual dilewati (sudah realized). Hanya bila hasKurs.
- **Verifikasi:** renderForex node --check OK.

---

## SESSION — 2026-06-23 (Bug filter rekening + v25 Kurs BCA)
### Bug #1 — Filter rekening ke-reset setelah input (client-only, NO redeploy)
- **Akar masalah:** handler simpan/transfer/reserve/hapus memanggil `renderTxn()` tanpa argumen → render seluruh `state.txns`, abaikan filter aktif. Dropdown masih nunjuk rekening pilihan tapi daftar tampil semua → Eddy harus ganti pilihan utk re-trigger.
- **Fix:** 4 panggilan `renderTxn()` → `filterTxn()` (baris 3466/3506/3536/3759). `filterTxn` pertahankan semua filter (rek, tipe, bulan, rentang, search). sw.js → **v21**.
- Verifikasi: 0 sisa `renderTxn()` no-arg; blok node --check OK.

### v25 — Kurs Valas BCA (e-Rate) — ⚠️ WAJIB REDEPLOY + AUTH BARU
- **PRD sign-off Eddy:** mata uang USD/SGD/AUD/EUR (TWD TIDAK ADA di BCA → dicoret); jenis = e-Rate saja; update = **otomatis harian**; tampil di menu Lainnya → "Kurs BCA".
- **Code.gs:** sheet `KURS` `[MATA_UANG,ERATE_BELI,ERATE_JUAL,UPDATE_BCA,FETCHED_AT]`; `fetchKursBCA()` = UrlFetchApp scrape `bca.co.id/id/informasi/kurs`, parser tahan-banting (strip semua tag → teks rata → regex KODE + 2 angka format ID = e-Rate beli/jual; abaikan dropdown krn butuh angka langsung setelah kode); `installKursTrigger()` (Run SEKALI: pasang trigger harian ~09:00 + fetch awal); action `fetchKurs` (manual) + route `getKurs` + `kurs` di getBundle. Helper `idNum_`.
- **index.html:** `state.kurs` (init+saveLocal+load bundle+offline cache); page `page-kurs` + tombol "Perbarui"; `renderKurs()` (tabel beli/jual + timestamp BCA); `refreshKurs()` (apiPost fetchKurs → apiGet getKurs); entry "Kurs BCA" di menu Lainnya; wire goPage/renderAll.
- **Verifikasi:** parser disimulasikan di Node thd struktur tabel+kartu BCA → 4 mata uang PASS, e-Rate benar (bukan TT/BankNotes), dropdown kalkulator diabaikan. Blok Code.gs & blok UI node --check OK terisolasi. ⚠️ Mount bash potong index.html & Code.gs (ukuran/whole-file check stale) — Grep/Read/Edit tool = sumber kebenaran. Backup: `index-pre-filterfix-20260623-1631.html`, `Code-pre-kurs-*.gs`.
- **⚠️ Risiko:** scraping rapuh (BCA ubah layout → parser rusak, perlu diperbaiki). UrlFetchApp+ScriptApp = scope OAuth BARU → redeploy Code.gs lalu **Run `installKursTrigger` sekali & approve izin**.
- **Pending deploy:** (1) push index.html + sw.js v21 (GitHub Desktop); (2) **redeploy Code.gs** (Apps Script, new version); (3) Run `installKursTrigger()` sekali di editor + approve; (4) buka app → Lainnya → Kurs BCA → cek/Perbarui.

### RESOLVED — Auth UrlFetchApp & hasil fetch (2026-06-24)
- **Gejala:** Run `fetchKursBCA` → error "You do not have permission to call UrlFetchApp.fetch (script.external_request)". Setelah tambah oauthScopes ke manifest pun Run TIDAK memunculkan popup izin → langsung error → "completed" (exception ketangkap try/catch). HTTP 0.
- **Akar:** **stale authorization** — Google mengira script sudah authorized penuh (tak re-prompt) padahal token belum punya scope external_request. Manifest sudah benar (oauthScopes: spreadsheets + script.external_request + script.scriptapp), bukan itu masalahnya.
- **Fix yang berhasil:** **CABUT akses script di https://myaccount.google.com/permissions** → Run lagi → popup izin baru muncul → lewati layar "Google hasn't verified this app" (Advanced → Go to … unsafe) → Allow. Kunci: revoke memaksa consent fresh; tanpa itu Google tak pernah nanya ulang.
- **Hardening fetchKursBCA:** selalu `ensureSheet(KURS)` dulu + Logger.log HTTP code/body length + tulis baris "(GAGAL FETCH) HTTP xxx" saat gagal → diagnosa kelihatan di tab KURS & Executions. UA diganti Chrome-like + Accept headers.
- **HASIL 2026-06-24 00:18 WIB:** HTTP 200, body 365.638 char, parser PASS 4/4 → USD 17.835/17.925, SGD 13.683,52/13.885,08, AUD 12.272,62/12.463,75, EUR 20.197/20.496,79 (update BCA "24 Juni 2026 00.18 WIB"). BCA TIDAK blokir IP Google. Tab KURS terisi, muncul di app.
- **Pelajaran:** scraping BCA via Apps Script OK. Bila scope baru "nyangkut": revoke di myaccount/permissions = solusi paling andal (bukan sekadar redeploy/edit manifest).

---

## SESSION — 2026-06-21 (v24: Kerja Tambah / Kurang per Project — Addendum)
**PERLU REDEPLOY Code.gs** (ada action baru `addAddendum`).
- **Tujuan:** catat pekerjaan tambah/kurang (variation order) per project yang sudah dibuat, dengan histori.
- **Keputusan PRD (sign-off Eddy):** (1) bentuk = histori addendum (bukan ubah angka cepat); (2) TIDAK auto-buat Piutang (manual); (3) UI di drawer detail project; (4) export Excel & HTML report ikut tampilkan kontrak efektif.
- **Data model:** sheet baru `ADDENDUM` `['ID','PROJECT_ID','PROJECT_NAMA','TANGGAL','JENIS(Tambah/Kurang)','DESKRIPSI','NOMINAL','CREATED_BY','CREATED_AT']`. NOMINAL selalu positif; arah dari JENIS.
- **Logika:** `Nilai kontrak efektif = NILAI_CONTRACT + Σ(Tambah) − Σ(Kurang)`. Laba/margin TIDAK berubah (tetap basis kas).
- **Code.gs:** `S.ADD`, HEADERS[S.ADD], `getBundle.addendums`, case `addAddendum` → fungsi `addAddendum` (pakai `ensureSheet`, tak nulis TXN/Piutang). Hapus pakai `deleteRow` generik (sheet='ADDENDUM').
- **index.html (v24):** `state.addendums` (load bundle + offline cache + clearCache apply); helper `projAddendums/addendumDelta/effectiveContract`; `projCard` % terbayar & "Nilai efektif" pakai kontrak efektif; drawer `addendumSectionHTML` (ringkasan awal/+tambah/−kurang/efektif + daftar item + tombol). Form via modal overlay `openAddendumForm/saveAddendum/closeAddendumForm` (overlay terpisah supaya tahan re-render drawer) + `delAddendum`. `currentProjDetailId` utk refresh drawer.
- **Export:** sheet "Project" kolom "Nilai Kontrak"→"Kontrak Efektif" (nilai efektif); "Detail Project" baris Kontrak tampilkan awal+addendum; sheet baru "Addendum" (bila ada). HTML report `valKon`→efektif.
- **Verifikasi:** vm.Script inline JS = 0 error; addAddendum block parse OK; 4 sisipan Code.gs terkonfirmasi (grep). Backup: `archive/backups/index-pre-addendum-20260621.html`, `Code-pre-addendum-20260621.gs`.

### Lanjutan sesi sama — Hapus Project AMAN (peringatan + pindahkan transaksi)
**PERLU REDEPLOY Code.gs** (action baru `reassignProject`).
- **Bug report Eddy:** hapus project tidak menghapus transaksi DP-nya. **Klarifikasi:** itu BUKAN data hilang — `deleteItem` hanya hapus baris MASTER_PROJECT; transaksi (PROJECT by nama) jadi orphan tapi **uang & saldo tetap benar** (DP tetap dihitung). Cascade-delete naif berbahaya (hapus DP = saldo understated).
- **PRD sign-off:** peringatkan sebelum hapus + fitur pindahkan transaksi ke project lain / tanpa project. DP orphan sekarang = dibiarkan.
- **Code.gs `reassignProject({from,to})`:** ganti kolom PROJECT `from`→`to` ('' = tanpa project) di TRANSAKSI/PIUTANG/CICILAN/JADWAL (label saja, nominal/saldo tak disentuh). **ADDENDUM milik project itu DIHAPUS** (spesifik project & bebas-uang; dipindah malah merusak kontrak project tujuan) — keputusan saya, di luar daftar awal PRD, sudah diflag ke Eddy.
- **index.html:** tombol "Hapus Project" → `deleteProjectFlow(id)`. Helper `projLinkedCounts`. Bila tak ada record terkait → confirm biasa. Bila ada → modal `openProjDeleteModal` (ringkasan terkait + dropdown tujuan urut Jalan→Hold→Selesai→Abaikan). `confirmProjDelete`→`doDeleteProject`: relabel state lokal (txns/piutang/cicilan/jadwal), cascade-hapus addendum lokal, perbaiki `summary.proj` (pindah/gabung total), 2 bgPost (reassignProject + deleteRow MASTER_PROJECT).
- **⚠️ Insiden tooling:** satu Edit index.html (blok deleteProjectFlow) sempat **ter-revert diam-diam** (E:\Mirror folder ada sync; muncul EPERM rename sekali). Diterapkan ulang & diverifikasi via Grep tool. **wc -c via bash kasih ukuran stale (342749), tapi grep/baca konten bash AKURAT.** Read/Edit/Grep tool = sumber kebenaran utk file di E:\.
- **Verifikasi:** vm.Script inline = 0 error; reassignProject parse OK; semua fungsi (addendum + projdel) terkonfirmasi via Grep di kedua file. Backup: `archive/backups/index-pre-projdel-20260621-0559.html`, `Code-pre-projdel-*.gs`.

---

## SESSION — 2026-06-19 (Cek data reserve via Google Drive + Reserve Fase C bersih-bersih)
Client-only, tanpa redeploy.
- **Cek data Sheet** (Google Drive connector, baca spreadsheet 1BYXyk...): reserve manual lama (non-cicilan) HANYA di 2 kartu — CC-CIMB-ACCOR 1,725,100 & CC-MAYBANK-BMW 6,308,449. **Keduanya sudah ditutup centang** (CIMB pas 1,7jt; MAYBANK malah 31,4jt). BCA-KRIS & BNI-JCB reserve-nya 100% cicilan (auto). → **Migrasi Fase B TIDAK PERLU.**
- Keputusan: **batalkan hapus baris RESERVE_LOG** (terhubung TXN Reserve CC/Masuk → riskan saldo). Cukup berhenti menampilkan (aman/reversible).
- **Fase C (client-only):** (1) buang label "reserve app lama" di Detail Akun CC; (2) sembunyikan tab manual "Reserve Fund CC" (`switchTTab('reserve')` button display:none) — setor reserve manual dipensiunkan; (3) `ccReserveStrip` diganti ke model CENTANG (Reserve CC = dicentang + sisa cicilan, di rekening reserve; tanpa tombol "Reserve" manual). `unreservedCC`/`reserveNow` masih ada tapi tak terpakai (harmless).
- Verifikasi: vm.Script 3 blok = 0 error; "reserve app lama" 0 ref.
- **Tambahan UX (sesi sama):** baris "Ditandai kartu ini" di Detail Akun CC tampilkan total ditandai; `toggleMark` munculkan toast tiap tandai.
- **Cara A — "perlu transfer sekarang" (non-akumulasi):** helper `reserveGapBank(bank)=max(0, lockedInBank − getSaldo.saldo)` + `cardsOnReserveBank`. Detail CC & toast tampilkan GAP (kekurangan utk menutup rekening reserve), bukan total kumulatif — krn saldo sudah memuat transfer sebelumnya. Bila 1 rekening dipakai >1 kartu, gap = gabungan (ditandai di UI). vm.Script 0 error.
- **Rincian Tagihan (ccbill): bar total sticky di ATAS** — `#ccb_topbar` (sticky top) "Dicentang sekarang · N baris · Rp X", di-update live oleh `ccbTick` (set `ccb_topSum`/`ccb_topCnt`). Total bawah + selisih statement tetap. vm.Script 0 error.
- **Detail Akun CC: kotak "Ditandai kartu ini" dibuat STICKY** (position:sticky;top:0) → total tetap kelihatan saat scroll/tandai. Toast `toggleMark` kembali tampilkan total ditandai + (gap bila kurang). vm.Script 0 error.
- **"Ditandai sekarang" (sesi ini saja):** `openAccountDetail` snapshot `window._markBaseline` (set TXN_ID marked saat buka). `renderDetail` hitung `_sesMarks` = marks kartu ini yg TIDAK ada di baseline → `sesSum`/`sesCnt`. Tampil baris ungu "Ditandai sekarang · N baris · Rp Z" di kotak sticky (hanya bila >0), terpisah dari total kumulatif. Reset saat layar ditutup-buka. vm.Script 0 error.
**Pending push:** index.html (gabung dgn Fase A + v23 + v23.1). Reserve Fase A/C client-only; v23 perlu redeploy (sheet PAID_MARK). Catatan: ⚠️ bash mount cap Code.gs 55028 byte — pakai Read tool.

---

## SESSION — 2026-06-19 (v23 Centang "Lunas" + Sembunyikan tagihan lunas di rincian CC) — ⚠️ REDEPLOY
PRD: `PRD-v23-hide-tagihan-lunas-cc.md` (Q1 default OFF, Q2 Detail Akun CC saja, Q3 tombol massal per-baris). **WAJIB REDEPLOY Code.gs.**
- **Konsep:** tagihan = saldo berjalan, tak ada status lunas per-txn → ditambah penanda manual `PAID_MARK`. Centang lunas = MURNI filter tampilan, lepas dari tagihan/saldo/reserve, independen dari centang reserve.
- **Code.gs:** `S.PAIDMARK='PAID_MARK'` + HEADERS `[ID,TXN_ID,CREATED_BY,CREATED_AT]`; action `markPaid`/`unmarkPaid`/`markPaidBatch` + `getPaidMarks`; `paidMarks` di getBundle & getAllData; helper `_ensurePaidSheet` (auto-create pola markTxn).
- **index.html:** `state.paidMarks` (init + saveLocal + sync-load + Object.assign offline). Helper `isPaid`/`togglePaid`/`markPaidUntil`. Drawer Detail Akun CC: pil "☐ lunas/✅ lunas" + tombol "s/d sini" (massal `markPaidBatch`) per baris belanja; toggle "Sembunyikan yang lunas" (default OFF, reset tiap buka via `window._acctHidePaid`); baris pembayaran/reserve tetap tampil; totals tetap dari `data` penuh (tagihan akurat).
- **Verifikasi:** Code.gs node --check OK (potongan s/d sebelum addInvestFlow, semua editan tercakup — ⚠️ bash mount cap baca Code.gs di 55028 byte, pakai Read tool sbg sumber kebenaran). index.html vm.Script 3 blok = 0 error; 19 ref v23.
**Pending:** push index.html + **REDEPLOY Apps Script** (sheet PAID_MARK + action baru), bump sw.js. Catatan: bisa digabung 1 push dgn Fase A reserve bila belum di-push.

### v23.1 (sesi sama) — Rekonsiliasi tagihan: baris dikunci tak muncul lagi (Cara 1)
Eddy: "yg pernah dicentang jgn muncul lagi di tagihan berikutnya." Keputusan **Cara 1** = sambung ke centang lunas (PAID_MARK), tidak nambah konsep. **Client-only** (pakai `markPaidBatch` yg sudah ada di v23).
- `lockCCBillUI`: kumpulkan TXN_ID dari baris `.ccb-chk:checked` (data-id) → tandai LUNAS (state.paidMarks + bgPost markPaidBatch). Cicilan tak punya TXN_ID → dilewati.
- `renderCCBill`: charges & pays di-filter `!isPaid(t.ID)` → baris yg sudah masuk tagihan terkunci tidak muncul lagi. `row()` + checkbox dapat `data-id`.
- Catatan: "Total tagihan berjalan (kumulatif)" di atas tetap dari `getCCOut` (tak terpengaruh paid mark) — by design.
- Verifikasi: vm.Script 3 blok = 0 error.

---

## SESSION — 2026-06-19 (Fix kategori Cicilan + PRD v22 Reserve = Centang, Fase A)
Client-only, tanpa redeploy Code.gs.
- **FIX bug "Beli Cicilan CC" — kategori biaya:** dulu 1 input + datalist yg menampilkan KELOMPOK (rancu). Diganti cascade **Kelompok → Kategori** + opsi "➕ Tambah kategori baru…" (kategori baru tersimpan ke kelompok terpilih via `addKat`). Pola sama dgn form Transaksi. Fungsi baru: `ciKelompoks`/`ciFillKatGroup`/`ciFillKatList`/`ciOnKatSelChange`; `saveCicilan` baca kelompok+kategori, handle `__NEW__`.
- **PRD v22 (`PRD-v22-reserve-centang-sumber-tunggal.md`)** signed-off (Q1 seluruh sisa cicilan, Q2-Q4 rekomendasi). ⚠️ Membalik keputusan PRD v20 (centang dari "penanda pasif" → jadi sumber tunggal reserve).
- **Fase A (display only, reversible, TANPA migrasi/hapus):** fungsi baru `reserveNeedCC` (=centang+sisa cicilan), `isReserveBank`, `lockedInBank`, `unmarkedRegularCC`, `bankReserveSubline`, `bankReserveCardHTML`. Dashboard Saldo Rekening & drawer Detail Akun rekening reserve kini tampil dua kantong **Reserve CC (terkunci) vs Bisa dipakai** + peringatan under-funded. Detail Akun CC: label "Reserve CC (dicentang)" + nudge "Belum dicentang Rp X". `addReserve`/tab Reserve LAMA masih ada (untuk banding) — dibersihkan di Fase C.
- Verifikasi: node vm.Script 3 blok script = 0 error. 6 fungsi baru terdefinisi @1x.
**Pending:** push index.html (GitHub Desktop), bump sw.js. Fase B (migrasi konversi reserve lama→centang, preview dulu) & Fase C (sembunyikan tab Reserve + strip ganda) menunggu verifikasi Fase A oleh Eddy.

---

## SESSION — 2026-06-09 (v22 Klik bank & CC Dashboard + tab cepat tanggal)
Client-only, tanpa redeploy. sw.js → **v19**.
- Baris bank di **Saldo Rekening Dashboard** kini bisa diklik → `openAccountDetail('bank',NAMA)` (reuse drawer detail akun yang sudah ada).
- **Kartu CC di Dashboard juga bisa diklik** → `openAccountDetail('cc',NAMA)`. sw.js → v19.
- **FIX v20 (CC tak bisa diklik):** penyebab = billStrip (strip tagihan kuning) `stopPropagation` di seluruh strip + guard `!closest('button')` → tap area tagihan terblok. Diperbaiki: onclick langsung di kartu CC (tanpa guard); billStrip tak lagi stopPropagation; `event.stopPropagation()` dipindah hanya ke tombol Bayar/Lunas. Verifikasi node --check OK. sw.js → **v20**.
- `openAccountDetail` dapat **tab cepat rentang**: Hari ini · Kemarin · 1 Minggu · Bulan ini (`.range-chip`/`acctRange`, tanggal UTC-safe `_ad_ago`). Default Bulan ini; ubah tanggal manual mematikan highlight. Berlaku juga di Master.
- Verifikasi: node --check openAccountDetail OK; uji `_ad_ago` (kemarin 06-08, 1mgg 06-03) cocok.
**Pending:** push index.html+sw.js (GitHub Desktop). Tidak perlu redeploy Code.gs (client-only).

---

## SESSION — 2026-06-09 (v21 Akun Investasi — pribadi, dipisah total)
**Topik:** Eddy minta data akun investasi saham (Stockbit, Pluang, Indo Premier, dll). PRD: `PRD-v21-investasi-saham.md` (signed off "Proceed"). **WAJIB REDEPLOY Code.gs.**
**Keputusan (AskUserQuestion):** Cakupan = **Kas + Nilai Portofolio**; Posisi = **DIPISAH TOTAL** dari Laba/Net Cash/Forecast. Q1 sumber setor dukung **keduanya** (bank FCC + `(luar)`); Q2 nilai **manual snapshot**; Q3 **tanpa kartu Dashboard** (murni halaman Investasi); Q4 pengingat **Sabtu** + **grafik garis**.
**Model:** 2 angka per akun — Modal tertanam (ledger setor−tarik) & Nilai kini (snapshot manual terbaru); U/R = selisih. Setor dari bank FCC → saldo bank turun nyata (TXN TIPE_LOG 'Investasi', dikecualikan laba/komposisi/forecast); `(luar)` → hanya log. Nilai portofolio TIDAK pernah dihitung sbg kas.
**Dikerjakan — Code.gs:** sheet `MASTER_INVEST`/`INVEST_LOG`/`INVEST_VALUE` + HEADERS; action `addInvestAkun`/`addInvestFlow`/`addInvestValue`/`deleteInvestFlow`; `getInvest`; masuk getBundle/getAllData; helper `ensureSheet`. **index.html:** state+helper (investModal/ModalAsOf/ValueNow/PL/Totals), halaman `page-invest` (renderInvest+investCard), drawer detail (chart Nilai vs Modal) + akun/flow/value, masuk popup Lainnya (ti-trending-up). sw.js → **v16**.
**Hasil:** node --check fungsi backend + helper client + blok UI penuh = OK; uji logika 100% cocok (modal/nilai/UR/modalAsOf/totals/staleness). Mount bash flicker di file penuh → audit manual. Backup `backup-pre-v21-20260609-0952`.
**Revisi (sesi sama, v17):** Eddy minta grafik tampil **langsung di halaman Investasi** & **digabung semua akun**. Ditambah `investTotalSeries`/`investAcctValueAsOf`/`buildInvestTotalChart` (carry-forward gabungan) + kartu grafik di `renderInvest`. Grafik per-akun di drawer detail tetap. sw.js → **v17**. node --check + uji nilai gabungan cocok ([19, 19.3]jt vs modal [18,18]jt). Blok UI penuh (22,5KB) syntax OK.
**Pending:** push index.html+sw.js (GitHub Desktop) + **redeploy Code.gs** (Apps Script). Cek console browser. Scheduled task pengingat Sabtu sudah dipasang. (Masih terbuka dari sesi lalu: koreksi BCA 552, saldo-awal KRIS.)

---

## SESSION — 2026-06-08 (v20.1 Urutan transaksi: tanggal lalu input)
Client-only. `renderTxn` sort: `TANGGAL desc || CREATED_AT desc` (tanggal primer, input terakhir di atas utk tanggal sama). Keputusan Eddy: tanggal dulu, baru input (backdate tetap di posisi tanggalnya, bukan puncak). sw.js v15. Verifikasi node OK.

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
