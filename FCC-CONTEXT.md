# FCC Arthabumi — Context & Status (v17)

## Apa itu FCC?
Financial Control Center — web app pribadi Eddy untuk tracking keuangan bisnis Arthabumi (kontraktor/interior). Single-user, dihosting di GitHub Pages.

**URL:** https://arthabumi-id.github.io/arthabumi-fcc/
**GitHub repo:** https://github.com/arthabumi-id/arthabumi-fcc
**Folder lokal:** `E:\Mirror\Claude Cowork\Analisis Arthabumi Fcc v.2\arthabumi-fcc\`
**Google Sheets DB:** https://docs.google.com/spreadsheets/d/1BYXyk0XlyeuelrIa6KKch8A79z7yvOG3_RjSxft7JTo/edit

## Arsitektur (PENTING)
```
Web App (HP/browser)  ⇄  Apps Script (Code.gs, Web App URL)  ⇄  Google Sheets (database)
        ↑ localStorage = cache lokal (salinan utk tampil cepat/offline), BUKAN sumber kebenaran
```
- **Google Sheets = database utama.** Web tidak punya DB sendiri.
- Baca: tekan Sync → app panggil `getBundle` → Apps Script baca Sheets.
- Tulis: input di app → Apps Script `appendRow`/`updateRow` ke Sheets.

## Stack
- Frontend: 1 file `index.html` — vanilla JS, Chart.js, Tabler Icons
- Backend: Google Apps Script `Code.gs` (deployed sebagai Web App)
- Database: Google Sheets (TRANSAKSI, MASTER_BANK, MASTER_CC, MASTER_PROJECT, MASTER_KATEGORI, TRANSFER_LOG, RESERVE_LOG)
- Auth: PIN 4 digit (`VALID_PINS = ['1234','5678','9999']`) — disimpan di localStorage
- PWA: manifest.json + sw.js (cache version: **fcc-arthabumi-v4**, network-first untuk app shell)

## Skema kolom Sheets (jangan diubah nama/urutan headernya)
- TRANSAKSI: `ID, TANGGAL, JENIS, PROJECT, REKENING, KATEGORI, NOMINAL, NOTES, TIPE_LOG, CREATED_BY, CREATED_AT`
- MASTER_BANK: `ID, NAMA, TIPE, BANK, SALDO_AWAL, CREATED_AT`
- MASTER_CC: `ID, NAMA, BANK, LIMIT, JATUH_TEMPO, CREATED_AT`
- MASTER_PROJECT: `ID, NAMA, KLIEN, TGL_MULAI, STATUS, NILAI_CONTRACT, CREATED_AT`
- MASTER_KATEGORI: `ID, KELOMPOK, NAMA, TIPE, CREATED_AT`
- TRANSFER_LOG: `ID, TANGGAL, DARI, KE, NOMINAL, NOTES, REF_ID, CREATED_BY, CREATED_AT`
- RESERVE_LOG: `ID, TANGGAL, DARI_REKENING, UNTUK_CC, NOMINAL, NOTES, CREATED_BY, CREATED_AT`

## ⭐ Perubahan v3 (scalability + cleanup) — Juni 2026
Tujuan: app tahan dipakai bertahun-tahun walau transaksi makin banyak.

### Server (Code.gs)
- **`getSummary`** — hitung agregat SEKALI-JALAN atas seluruh TRANSAKSI: `acct` (masuk/keluar/count per rekening), `proj` (per project), `month` (per bulan), `katExp` (per kategori pengeluaran), `count`. Di-cache 6 jam via `CacheService` (key `fcc_summary_v3`), otomatis dibuang tiap ada write.
- **`getBundle`** — 1 round-trip: master + transfers + reserves + summary + **txn 120 hari terakhir saja** (`RECENT_DAYS=120`).
- **`getTxns`** — terima param `since` / `until` / `rekening` / `limit`.
- **`clearCache`** — buang cache summary lalu balikin bundle segar (dipakai tombol "Hitung Ulang Total").
- Cleanup: `forceSeedMaster` jadi alias `seedMasterData` (hapus duplikasi), seed pakai batch `setValues`, `updateRow` tulis 1 baris sekaligus.
- Legacy `getAll` masih ada (kompat / fallback).

### Client (index.html)
- `state.summary` + `state.txnsSince` baru. Dashboard/chart/saldo render dari **summary**, bukan dari semua txn.
- Accessor `getSaldo/getCCOut/getProjCF/monthAgg/acctCount` **prefer summary, fallback hitung dari txns** (offline / API lama).
- `applySummaryDelta(t, sign)` — patch summary lokal saat add/edit/hapus (mirror logika getSummary), supaya dashboard akurat seketika termasuk offline.
- `syncAll` pakai `getBundle` (fallback `getAll`). localStorage cuma simpan summary + txn recent → lolos limit ~5MB.
- Halaman Transaksi: tombol **"Muat transaksi lebih lama"** (`loadMoreTxns`, mundur 12 bln per klik).
- Account Detail: fetch riwayat penuh akun **on-demand** saat drawer dibuka.
- Settings: tombol **"Hitung Ulang Total"** (`forceRefresh`) → panggil `clearCache`.

## ⭐ Perubahan v4 (UX, bugfix, fitur) — Juni 2026
### Bugfix
- **Tanggal mundur 1 hari (FIXED):** kolom tanggal di Sheets dibaca Apps Script sbg objek `Date` (tengah malam zona Sheets) → `JSON.stringify` jadi ISO UTC → app `slice(0,10)` mundur 1 hari. Fix di `Code.gs`: `normalizeCell(v,tz)` ubah `Date` → `yyyy-MM-dd` pakai `ss.getSpreadsheetTimeZone()`, dipakai di `getSheet` & `getSummary` (agregat bulan ikut diperbaiki).
- **Total Saldo Bank warna (FIXED):** dulu hardcode class `pos` (selalu hijau). Sekarang warna dinamis ikut tanda (merah bila negatif).

### Tambah Transaksi
- **Kategori auto-tambah:** dropdown kategori punya opsi "➕ Tambah kategori baru…" → muncul input nama + pilih KELOMPOK (TIPE ikut Jenis transaksi). Saat simpan, kategori baru ditulis ke MASTER_KATEGORI via `addKat` lalu dipakai. Cek duplikat (case-insensitive).
- **Format ribuan otomatis:** semua input nominal (txn, transfer, reserve, nilai kontrak, limit CC) kini `type=text inputmode=numeric` + `fmtMoneyInput()` (titik ribuan saat ketik). Saat simpan dibersihkan via `unfmtNum()`. Prefill pakai `fmtInput()`. (Jatuh Tempo tetap angka biasa.)
- **Peringatan project:** kalau kategori berkelompok PROJECT tapi Project belum dipilih → konfirmasi "Simpan tanpa project?".
- `saveDrawer` txn kini juga panggil `renderProject()` supaya tab Project update seketika.

### Project
- Kartu project: tambah kolom **Keluar** (grid jadi 2×2: Nilai, Masuk, Keluar, Sisa CF).
- Kartu project **bisa di-tap** → drawer **Detail Project** (`openProjectDetail(id)`): ringkasan Masuk/Keluar/Sisa + donut komposisi pengeluaran per kategori + daftar transaksi. Data txn diambil penuh via `getTxns?project=` (ada client-side filter sbg guard utk backend lama). Tombol Edit pakai `event.stopPropagation()`.

### Transfer
- Riwayat Transfer: tombol **edit** & **hapus** per baris. Hapus = buang 3 baris terkait (2 TXN + 1 TRANSFER_LOG) via REF_ID. Edit = prefill form, hapus lama + buat baru saat Update. Server action baru: **`deleteTransfer`** (cocokkan REF_ID di TRANSFER_LOG, dan substring refId di NOTES TXN).

### Komposisi pengeluaran (donut per kategori)
- Helper: `katComposition(txns)`, `donutCardHTML(canvasId,entries)`, `buildKatDonut()`, `detailTxnCard(t)`, palet `KAT_PALETTE`.
- Disisipkan di **Detail Akun** (ikut filter) & **Detail Project**. Tidak ada tab baru — semua lewat drawer.

### Server action baru di Code.gs v4
- `deleteTransfer` (POST), filter `project` di `getTxns`. **Wajib redeploy** Apps Script setelah update Code.gs.

### Belum dikerjakan (ditawarkan, user tunda)
- **Optimistic save:** input terasa lambat karena `await apiPost` blokir UI nunggu Apps Script (1–3 dtk). Solusi: render lokal dulu, kirim server di background. Belum diterapkan.

## ⭐ Perubahan v5 (Import Excel) — Juni 2026
Tujuan: pindahkan catatan manual ke FCC secara massal lewat file Excel.

### Template
- `Template-Import-Transaksi-FCC.xlsx` (di root folder project). 3 tab: **Transaksi** (input: TANGGAL, JENIS, PROJECT, REKENING, KATEGORI, NOMINAL, NOTES + dropdown JENIS + 4 baris contoh abu-abu), **Petunjuk**, **Referensi** (daftar rekening/project/kategori valid + skema MASTER_BANK & MASTER_CC).

### Client (index.html)
- CDN baru: **SheetJS** (`xlsx@0.18.5`).
- Settings: tombol **Import Excel** → file input tersembunyi (`#importFile`) → `handleImportFile()`.
- Alur: `handleImportFile` (FileReader→XLSX.read, cellDates:true, ambil sheet /transaksi/i) → `parseImport` (match header case-insensitive, validasi per baris, normalisasi tanggal via `impDateISO` utk serial/Date/string dd-mm-yyyy & yyyy-mm-dd, `unfmtNum` nominal) → `showImportPreview` (drawer custom, `drawerMode='import'`: hitung valid/error/total + daftar project & kategori baru) → `confirmImport` (POST `addTxnBatch` lalu `syncAll`).
- **Validasi REKENING ketat:** harus persis ada di MASTER_BANK/MASTER_CC, kalau tidak baris **ditolak & dilaporkan** (tidak auto-buat rekening). PROJECT & KATEGORI baru **auto-dibuat** (kategori: kelompok ditebak dari JENIS — Pemasukan→PEMASUKAN, Pengeluaran→OPERASIONAL).

### Server (Code.gs) — action baru `addTxnBatch` (POST). **Wajib redeploy.**
- Payload `{ txns:[...], newProjs:[...], newKats:[...], USER }`. Tulis master baru + transaksi pakai `setValues` (1 tulis, cepat utk banyak baris). ID prefix `IMP/PRI/KI`. `invalidateSummary` jalan otomatis di doPost → summary fresh saat sync berikutnya.

## ⭐ Perubahan v6 (Laba bersih + rekap project selesai) — Juni 2026
Murni client-side (index.html), TIDAK menyentuh Code.gs.
- Helper baru: `projProfit(nama)` (laba=masuk-keluar, margin=laba/masuk*100, pakai `getProjCF` yg sumbernya `summary.proj` → akurat lintas waktu), `doneProjectsProfit()` (agregat semua project STATUS='Selesai'), `projLastDate(nama)` (tanggal txn terakhir project dari txns termuat, fallback TGL_MULAI — dipakai utk urutan rekap).
- **Dashboard:** kartu metrik baru "Laba Bersih · Project Selesai" (nominal + margin% + jumlah project). Definisi laba bersih = hasil project yg sudah selesai saja (keputusan user).
- **Kartu project:** tiap kartu kini ada baris "Laba Bersih" + margin%. Detail project (drawer) juga ada banner laba+margin.
- **Render Project dipecah:** `projCard(p)` (1 kartu) + `renderProject()` baru. Project STATUS≠Selesai → kartu penuh (section "Project Berjalan"). Project STATUS='Selesai' → **rekap list ringkas** (section "Project Selesai · Rekap") diurut `projLastDate` desc, tiap baris klik → `openProjectDetail` (drawer lama). "Selesai" = STATUS Selesai (tidak ada field tanggal selesai; user konfirmasi cukup status).

## ⭐ Perubahan v7 (Tab status project + komposisi pengeluaran per kelompok) — Juni 2026
Murni client-side (index.html).
- **Tab status di halaman Project:** pill `Semua / Berjalan / Hold / Selesai` (`switchProjTab`, `state.currentProjTab`, id `pTab-*`). Berjalan=STATUS Jalan, Hold=STATUS Hold, Selesai=STATUS Selesai. Tab Selesai tampil **list baris** (`projDoneGrid`, sebelumnya sempat grid) + ringkasan laba (`doneSummaryLine`). Tab Semua = kartu Jalan+Hold lalu rekap list Selesai. Badge/res-bar: Jalan kuning(amber), Hold kuning gelap, Selesai hijau.
- **Komposisi pengeluaran drill-down** di Master > tab **Kategori** (paling atas): dropdown pilih KELOMPOK (`state.expGroup`; 'ALL'=ringkasan per kelompok, pilih satu kelompok=rincian kategori di dalamnya) + filter periode `Bulan ini / 3 bulan / Semua / Custom` (`state.expPeriod`,`expFrom`,`expTo`). Fungsi: `expRawCats(period)` (total per kategori; 'all'→`summary.katExp`, 'custom'→`_expCustomCache` hasil `getTxns since/until`, else txn termuat; semua exclude transfer/reserve via TIPE_LOG), `expComposition(period,group)`, `expCompCardHTML`, `setExpGroup`,`setExpPeriod`,`applyExpCustom`. Canvas `expCompDonut` via `buildKatDonut` di akhir cabang kat `renderMaster`. CATATAN: periode 'custom' fetch dari server (akurat lintas tahun); 'month'/'3m' terbatas txn termuat (~120 hari).

## ⭐ Perubahan v8 (drill-down donut + tab bulan transaksi) — Juni 2026
Client-side (index.html).
- **Donut komposisi bisa diklik:** `buildKatDonut(canvasId,entries,onClickName)` kini terima callback opsional (slice & hover pointer). Di kartu komposisi (tab Kategori): klik slice/legend saat group=ALL → drill ke kelompok itu (`setExpGroup`); saat sudah di satu kelompok → `openExpTxnDetail(kategori)` buka drawer daftar transaksi. Sumber txn: `expPeriodTxns()` (month/3m dari txn termuat, custom dari `_expCustomCache`, all dari `_expAllCache` hasil `getTxns` full). Legend tiap baris ada chevron.
- **Tab bulan di halaman Transaksi:** `#txnMonthTabs` (scroll horizontal). `renderTxnMonthTabs()` bikin pill 'Semua' + tiap bulan (YYYY-MM, label `monthLabel` mis. "Jun '26") + pill "lebih lama" (panggil `loadMoreTxns`). `state.txnMonth` (null=auto bulan terbaru, ''=Semua). `setTxnMonth` → `filterTxn` (filter `slice(0,7)===txnMonth`). Dipanggil di `renderAll` & `loadMoreTxns`. Tombol "muat lebih lama" lama di bawah list tak lagi muncul (digantikan pill).

## ⭐ Perubahan v9 (Bayar Kartu Kredit) — Juni 2026
- **Drawer `paycc`** (`openDrawer('paycc', ccId)`), dibuka via tombol **Bayar** di kartu CC (Master > Kartu Kredit). Form: pilih kartu (tampil Tagihan `getCCOut` & Reserve tersedia `reserveFunds`), sumber dana, nominal (default=tagihan), tanggal, notes. Helper `onPayCCChange`/`onPayCCSrc`.
- **Sumber = Bank:** `saveDrawer` panggil `addTransfer` (DARI=bank, KE=CC) → saldo bank ↓, tagihan CC ↓. Tanpa ubah backend.
- **Sumber = Reserve:** action baru Code.gs **`payCCReserve`** (POST, **wajib redeploy**): tulis 1 TXN Pemasukan ke CC (TIPE_LOG Reserve, KATEGORI 'Bayar CC (Reserve)') → tagihan ↓, dan 1 RESERVE_LOG **negatif** (DARI_REKENING '(release)') → pot reserve ↓. **Bank tidak disentuh** karena dana sudah keluar saat reserve dibuat (over siklus reserve→bayar, angka konsisten). Validasi nominal ≤ reserve tersedia + konfirmasi.
- Setelah simpan → `syncAll` (state authoritative). Keduanya TIPE_LOG Transfer/Reserve → tidak masuk laba/komposisi pengeluaran.
- CATATAN model: saat reserve dibuat, saldo bank langsung ↓ (TXN Pengeluaran Reserve) & Net Cash = Bank − Reserve (saat ada reserve, Net Cash sengaja konservatif/understated; lunas saat dibayar).

## ⭐ Perubahan v10 (Kasbon karyawan) — Juni 2026
- **Sheet baru `KASBON`:** `ID,TANGGAL,KARYAWAN,JENIS,NOMINAL,METODE,REKENING,NOTES,REF_ID,CREATED_BY,CREATED_AT`. JENIS=`Pinjam`/`Kembali`, METODE=`Tunai`/`Potong Gaji`. Auto-dibuat oleh `addKasbon` bila belum ada (juga via initSheets karena masuk HEADERS). Ditambahkan ke `getBundle` & `getAllData` (`kasbon`).
- **Code.gs actions baru (wajib redeploy):** `addKasbon` (tulis ledger KASBON + bila `REKENING` dipilih tulis 1 TXN: Pinjam→Pengeluaran 'Kasbon Keluar', Kembali→Pemasukan 'Kasbon Masuk', TIPE_LOG `Kasbon`), `deleteKasbon` (hapus baris KASBON by REF_ID + TXN yg NOTES memuat refId). Saldo rekening akurat; TIPE_LOG Kasbon → tidak masuk laba/komposisi.
- **PENTING (revisi):** Kembali BAIK Tunai MAUPUN Potong Gaji = uang MASUK ke rekening pilihan & sisa kasbon turun (rekening selalu wajib, bukan hanya Tunai). Untuk Potong Gaji, user catat gaji PENUH terpisah di Transaksi → selisih ter-offset oleh kasbon-masuk ini. Metode hanya label pembeda.
- **Client:** nav baru **Kasbon** (`ti-wallet`, idx 4, Master geser ke 5), `state.kasbon` (di syncAll/forceRefresh/saveLocal). Halaman `page-kasbon` (`renderKasbon`): kartu Total Kasbon Beredar + daftar karyawan diurut sisa, klik → `openKasbonDetail` (ringkasan pinjam/kembali/sisa + riwayat + tombol catat + hapus per baris). Input `openKasbon(prefName)` drawer (`drawerMode='kasbon'`): nama (datalist karyawan, custom boleh), Jenis, Metode (muncul saat Kembali; Pinjam selalu Tunai), Rekening (saat Tunai), nominal/tanggal/notes → `saveKasbon` POST addKasbon lalu syncAll. Helper `kasbonAgg`/`kasbonEmployees`/`onKasbonJenis`/`onKasbonMetode`/`delKasbon`. **Potong Gaji** = sisa kasbon turun tanpa gerak uang (gaji dicatat terpisah dgn nominal sudah dipotong).

## ⭐ Perubahan v11 (Komposisi Pemasukan) — Juni 2026
Client-only (index.html). Kartu komposisi di Master>Kategori kini ada **toggle Pengeluaran/Pemasukan** (`state.expJenis`, `setExpJenis`). `expRawCats(period,jenis)` & `expComposition(period,group,jenis)` & `openExpTxnDetail(cat,jenis)` digeneralisasi (filter `JENIS===jenis && TIPE_LOG===jenis`). Pemasukan → selalu per KATEGORI (dropdown kelompok disembunyikan), warna hijau. Pengeluaran → tetap drill kelompok→kategori. Income 'all' tidak ada di summary → `ensureExpAll()` fetch `getTxns` full sekali lalu re-render (`_expAllCache`, `_expAllLoading`). Klik slice income → detail txn pemasukan kategori itu.

## ⭐ Perubahan v12 (Input Saldo Awal rekening) — Juni 2026
Client-only (index.html), tanpa redeploy. Form Rekening (mode 'bank') kini punya input **Saldo Awal** (`fb_saldo`, prefill `fmtInput(b.SALDO_AWAL)`); `saveDrawer` bank pakai `unfmtNum` (dulu hardcode 0). `getSaldo` kini `saldo = SALDO_AWAL + masuk − keluar` (ambil dari `state.banks`). Berdampak ke kartu Master Bank, Total Saldo Bank & Net Cash di dashboard. Detail akun TIDAK diubah (berbasis periode/filter tanggal, masih masuk−keluar). Tulis ke MASTER_BANK via addRow/updateRow yang sudah ada (kolom SALDO_AWAL).

## ⭐ Perubahan v13 (Urut kategori alfabet) — Juni 2026
Client-only. Di `renderMaster` tab 'kat': kelompok di-`sort(localeCompare)` & kategori dalam tiap kelompok di-`sort` by NAMA (localeCompare). Hanya tampilan, tidak mengubah data/urutan di Sheets.

## ⭐ Perubahan v14 (Cashflow Forecast 30/60/90) — Juni 2026
Tab baru **Forecast** (nav idx 5, Master geser ke idx 6). Proyeksi saldo kas 90 hari ke depan.

### Sheet baru `JADWAL` (wajib redeploy Code.gs)
- Kolom: `ID,JENIS,NAMA,NOMINAL,FREKUENSI,TGL,AKTIF,PROJECT,NOTES,CREATED_BY,CREATED_AT`. JENIS=Pemasukan/Pengeluaran. FREKUENSI=`sekali` (TGL=yyyy-MM-dd) | `bulanan` (TGL=tanggal 1-31). AKTIF=1/0. Murni proyeksi — TIDAK menulis ke TRANSAKSI, tidak mempengaruhi saldo/laba.
- Code.gs: `S.JADWAL` + HEADERS + masuk `getBundle`/`getAllData`; action **`addJadwal`** (POST, auto-create sheet pola KASBON) + `getJadwal` (GET). Edit/hapus pakai action generik `updateRow`/`deleteRow` (sheet:'JADWAL').

### Client (index.html) — murni client-side selain JADWAL di atas
- `state.jadwal` (di syncAll/forceRefresh/saveLocal/loadOfflineData), `state.safeThreshold` (localStorage `fcc_safe_threshold`, default 0).
- Helper: `buildForecast(days)` (gabung saldo bank awal − burn harian + jadwal + tagihan CC), `dailyBurn()` (rata-rata pengeluaran operasional 90 hr: HANYA TIPE_LOG 'Pengeluaran' → exclude transfer/reserve/kasbon; termasuk gaji mingguan), `_monthlyDates/_addDaysISO/_ymd/_daysBetween`, `fmtSigned`.
- **Model proyeksi (keputusan v14):** titik awal = total saldo bank (BUKAN net cash; reserve sudah keluar dari bank saat dibuat). Tagihan CC saat ini dibayar pada jatuh tempo terdekat, porsi dari bank = `out − reserve` (reserve dipakai dulu). Pemasukan HANYA dari jadwal termin manual (konservatif, kontraktor lumpy). Verifikasi numerik: skenario uji cocok 100% dengan hitung manual.
- UI `renderForecast()`: kartu Saldo Sekarang + proyeksi 30/60/90 (warna ikut ambang aman), banner peringatan/aman (titik kas terendah), grafik garis Chart.js (`fcChart`, ambil tiap 3 hr + garis ambang aman merah putus2), daftar kejadian 90 hr (jadwal bisa di-tap edit / hapus, tagihan CC otomatis), catatan asumsi.
- Drawer `jadwal` (`openJadwal`/`saveJadwal`/`delJadwal`/`onJadwalFrek`) — input form jadwal. Settings: row **Ambang Aman Kas** (`setSafeThreshold`, prompt).
- `goPage`/`renderAll` include 'forecast'. sw.js cache **fcc-arthabumi-v5**.

## ⭐ Perubahan v15 (Filter rekening di Transaksi) — Juni 2026
Client-only (index.html), tanpa redeploy. Tab Transaksi: tambah dropdown ketiga **"Semua rekening"** (`#txnRekFilter`) berisi semua bank + CC. Helper `fillRekFilter()` (isi opsi dari `state.banks`+`state.ccs`, pertahankan pilihan) dipanggil di `renderTxnMonthTabs`. `filterTxn` tambah `if(rek) data=data.filter(t=>t.REKENING===rek)`. Bisa dikombinasi dgn filter tipe + search + tab bulan. Bekerja pada txn termuat (±120 hari); riwayat penuh tetap via drawer Detail Akun. Header label diperjelas: "Semua tipe" / "Semua rekening". Container filter diberi `flex-wrap`.

## ⭐ Perubahan v16 (Optimistic Save + Piutang Termin & Reminder) — Juni 2026
Dua fitur. **Wajib redeploy Code.gs** (ada sheet & action baru). sw.js cache **fcc-arthabumi-v6**.

### #3 Optimistic Save (client-only, index.html)
- Input tidak lagi nunggu Apps Script. Pola: state lokal di-update + drawer ditutup + UI dirender SEKETIKA, POST jalan di latar.
- Antrian: `state.pending` + localStorage `fcc_pending_ops`. Helper `loadPending/savePending/bgPost/sendOp/retryPending/renderPendingBar`. Bar mengambang `#pendingBar` (atas nav): "Menyimpan N…" (biru) atau "N gagal — Kirim ulang" (merah). Op gagal TIDAK hilang (keputusan user A1: tampil + tombol kirim ulang). `syncAll` panggil `retryPending()` di awal.
- Yang dikonversi `await apiPost`→`bgPost` (non-blocking): saveDrawer txn/proj/bank/cc/kat, addKat inline, deleteItem, saveJadwal/delJadwal, savePiutang/delPiutang. **paycc, transfer, reserve, kasbon, payPiutang, confirmImport TETAP blocking** (perlu syncAll utk angka authoritative server).

### #1 Piutang Termin Klien + Reminder
**Sheet baru `PIUTANG`** (wajib redeploy): `ID,PROJECT,KLIEN,TERMIN,NOMINAL,JATUH_TEMPO,STATUS,TGL_BAYAR,REKENING,REF_ID,NOTES,CREATED_BY,CREATED_AT`. STATUS=`Belum`/`Lunas`.
- **Code.gs actions baru:** `addPiutang` (catat termin, belum gerak uang), `payPiutang` (set Lunas + tulis 1 TXN Pemasukan KATEGORI 'Pelunasan' TIPE_LOG 'Pemasukan' → masuk laba/saldo project; NOMINAL boleh beda dari termin = bayar sebagian/lebih [B-Q1]; auto-buat kategori 'Pelunasan' via `ensureKat` [B-Q2]). Edit/hapus termin Belum pakai `updateRow`/`deleteRow` generik (sheet:'PIUTANG'). Masuk `getBundle`/`getAllData` (`piutang`), doGet `getPiutang`.
- **Client (index.html):** `state.piutang` (di syncAll/forceRefresh/saveLocal/loadOffline). Nav baru **Piutang** (`ti-cash`, idx 6, Master geser idx 7) + badge merah jumlah overdue (`#piutangBadge`, `updatePiutangBadge`). Halaman `page-piutang` (`renderPiutang`): kartu Total Piutang Beredar + Jatuh tempo ≤7hr + Lewat tempo; list termin per status (Belum/overdue diurut jatuh tempo + rekap Lunas). `piutangRow`, status via `piutangStatus`/`_piuDue`/`_daysBetween` (overdue=jatuh tempo<hari ini & belum lunas; warna amber/merah/hijau).
- Drawer: `openPiutang`/`savePiutang` (input termin manual [B-Q3]; pilih project auto-isi klien via `onPiutangProj`), `payPiutangUI`/`doPayPiutang` (pilih rekening tujuan + nominal default termin + tgl), `delPiutang` (termin Lunas TIDAK bisa dihapus — sudah ada TXN).
- **Reminder banner** `#dashPiutangReminder` di atas Dashboard (`renderPiutangReminder`): tampil bila ada overdue / due ≤7hr, list ringkas, klik → halaman Piutang. Dipanggil di `renderAll`.
- **Forecast integration:** `buildForecast` tambah event pemasukan dari `state.piutang` STATUS=Belum & jatuh tempo dalam horizon (overdue TIDAK diproyeksi — konservatif, hanya muncul di reminder). Event type 'piutang' di list forecast bisa di-tap → halaman Piutang.

### ⚠️ Catatan verifikasi v16
Saat dibuat, mount Linux (bash) freeze di ukuran file LAMA (index.html 140085 byte, Code.gs 23141 byte) → `node --check` tidak bisa jalan atas isi baru (truncated). Syntax diaudit MANUAL via Read tool (balance brace/template OK). **Saat buka di browser, kalau ada error JS, cek console.** File asli (Read/Edit tool) sudah lengkap & benar.

## ⭐ Perubahan v16.1 (Kategori type-ahead) — Juni 2026
Client-only (index.html), tanpa redeploy. Field Kategori di drawer Transaksi: dari `<select>` jadi `<input list=f_kat_list>` + `<datalist>` (autocomplete saat ketik). Opsi datalist diurut abjad (`localeCompare 'id'`). Ketik nama cocok master → dipakai (normalisasi casing); ketik nama baru → `f_kat_new_wrap` muncul minta KELOMPOK lalu auto-buat kategori (via bgPost addKat) saat simpan. Opsi `__NEW__` & input `f_kat_new` lama dihapus; `onKatChange` cek keberadaan di `state.kategori` (case-insensitive). saveDrawer txn disesuaikan (tidak lagi cek `__NEW__`).

## ⭐ Perubahan v17 (Cicilan Kartu Kredit + fix Net Cash) — Juni 2026
PRD lengkap: `PRD-v17-cicilan-cc.md`. **Wajib redeploy Code.gs** (sheet & action baru). sw.js cache **fcc-arthabumi-v7**.

### Model (keputusan Eddy)
Beli barang via CC yg dicicil. **Biaya diakui PENUH di muka** (masuk pengeluaran & cashflow project), yang dicicil hanya **aliran kas pembayaran** ke CC — dikelola lewat mekanisme RESERVE yg sudah ada.
- Saat beli (mis. pokok 12jt, bunga 0, 12x): (1) beban penuh → TXN `Cicilan-Beli` pokok (+bunga bila ada), **REKENING kosong** → masuk laba/proj/komposisi, TIDAK menambah tagihan CC; (2) **reserve penuh** (pokok+bunga) dari bank ke CC → bank turun, pot reserve naik; (3) baris CICILAN (tenor, per_bulan, terbayar 0).
- Tagihan cicilan = **virtual** (dihitung client `cicilanDueAmt` dari TENOR_TERBAYAR & bulan berjalan), bukan TXN nyata. Tiap bulan `payCicilan` melepas reserve sebesar 1 angsuran (terakhir = sisa supaya pot habis pas) + TENOR_TERBAYAR++. Bank & laba TIDAK disentuh lagi (sudah di muka). Angsuran terakhir = `total − per*(tenor−1)`.

### Sheet baru `CICILAN`
`ID,TANGGAL_BELI,CC,DESKRIPSI,NOMINAL_POKOK,BUNGA_TOTAL,TENOR,NOMINAL_PER_BULAN,TGL_MULAI,TENOR_TERBAYAR,STATUS,PROJECT,KATEGORI,REF_ID,NOTES,CREATED_BY,CREATED_AT`. STATUS=`Jalan`/`Lunas`.

### Code.gs (wajib redeploy)
- Action baru: `addCicilan` (POST, auto-create sheet), `payCicilan` (POST, rilis reserve + terbayar++), `deleteCicilan` (POST, hanya bila terbayar=0 → hapus baris + TXN/RESERVE via REF_ID), `getCicilan` (GET). Masuk `getBundle`/`getAllData` (`cicilan`).
- `getSummary` katExp kini juga menghitung TIPE_LOG `Cicilan-Beli` (supaya masuk komposisi pengeluaran). proj/month sudah otomatis menghitung (cukup punya PROJECT/tanggal).

### Client (index.html)
- `state.cicilan` (di syncAll/forceRefresh/saveLocal/loadOffline).
- `getCCOut` kini = base acct + `cicilanDueAmt(cc)` (porsi angsuran jatuh tempo belum dibayar). Helper baru: `monthsElapsed`, `cicilanDueAmt`, `cicilanRemaining`.
- **Fix Net Cash (untuk semua reserve):** dulu `Net Cash = Bank − Reserve` padahal reserve juga sudah mengurangi bank → dobel (reserve 12jt menurunkan Net Cash ~24jt). Sekarang **`Net Cash = Total Saldo Bank`** (bank sudah net of reserve), pot reserve ditampilkan terpisah sebagai kartu **"Dana Disisihkan (Reserve)"** + kartu **"Sisa Cicilan CC"** (muncul bila ada cicilan). Tidak perlu migrasi data.
- UI: tab Master > Kartu Kredit tombol **"Beli Cicilan"** (`openCicilan`/`ciPreview`/`saveCicilan`), badge "N cicilan jalan · sisa X" per kartu, list cicilan (`cicilanListHTML`/`cicilanRowHTML`) dengan tombol **Bayar angsuran** (`doPayCicilan`) & Hapus (`delCicilan`, hanya bila terbayar=0). Drawer **Bayar CC** dapat section angsuran (`paycCicilanHTML`) + nominal default = tagihan **non-cicilan** (angsuran dibayar terpisah dari reserve via tombol Bayar).
- `saveCicilan`/`doPayCicilan` **BLOCKING** (perlu syncAll utk angka authoritative, seperti paycc/reserve). Ada fallback offline utk doPayCicilan/delCicilan.
- `buildForecast`: tagihan CC dipisah cicilan vs non-cicilan; cicilan reserve-backed → 0 dampak bank; reserve sisa (setelah dialokasi cicilan) baru menutup tagihan non-cicilan.
- **Konversi txn→cicilan (v17.1):** drawer Edit transaksi CC (Pengeluaran biasa di kartu kredit) punya tombol **"Ubah jadi Cicilan"** (`openConvertCicilan`/`cvPreview`/`saveConvertCicilan`, `_cvPokok`). Server action **`convertTxnToCicilan`** (POST, wajib redeploy): TXN lama dipakai sbg beban pokok (REKENING dikosongkan + TIPE_LOG→`Cicilan-Beli`), lalu buat baris CICILAN + reserve penuh (+TXN bunga bila ada). Hasil identik addCicilan tanpa hapus/buat manual. Tombol hanya muncul bila REKENING=CC & TIPE_LOG=Pengeluaran.
- **Dashboard kartu "Sisa Cicilan CC" bisa diklik** (`gotoCicilan`) → loncat ke tab Kartu Kredit + scroll ke `#cicilanAnchor` (daftar semua cicilan).
- **Ganti bank sumber reserve (v17.2):** tiap baris cicilan punya tombol **"Ganti bank"** (`openChangeReserveBank`/`saveChangeReserveBank`). Server action **`changeReserveBank`** (POST, wajib redeploy): cari setoran reserve via REF_ID → ubah `REKENING` TXN 'Reserve CC' + `DARI_REKENING` RESERVE_LOG ke bank baru (saldo bank lama balik, bank baru terpotong). Tidak ubah jumlah/angsuran. Tersedia kapan saja (independen dari pembayaran).
- **Rincian reserve per kartu (v17.2):** kartu Dashboard **"Dana Disisihkan (Reserve)"** bisa diklik (`openReserveDetail`) → drawer daftar pot reserve per CC, dipisah **Cicilan** (= `cicilanRemaining`) vs **Bebas** (reserve manual).

### Verifikasi numerik (PASS 13/13)
2 skenario disimulasikan (`outputs/sim.js`): A=12jt/12x/0%, B=pokok 10jt+bunga 600rb/12x. Terbukti: per_bulan benar, reserve habis tepat 0 (angsuran terakhir = sisa), biaya project = pokok+bunga, Net Cash turun TEPAT 1× nominal (bukan 2×), tagihan saat beli = 1 angsuran, tagihan CC = 0 setelah lunas.

### Catatan verifikasi syntax v17
Mount Linux (bash) **macet** di ukuran file LAMA (Code.gs lihat 545 baris, index.html 2622) → `node --check` atas file penuh tidak bisa. Syntax fungsi-fungsi BARU diverifikasi terisolasi via `node --check` (Code.gs functions + blok UI cicilan = OK) + audit manual brace/template via Read tool. **Saat buka di browser, kalau ada error JS cek console.** File asli (Read/Edit) lengkap & benar.

## Boleh edit manual di Google Sheets? BOLEH, dengan aturan:
1. Jangan ubah baris HEADER / nama kolom / nama tab.
2. Tiap baris WAJIB punya `ID` unik (kalau nambah manual, isi sendiri mis. `MAN001`) — kalau kosong, edit/hapus dari app tak bisa nemu baris.
3. `REKENING` harus PERSIS sama dengan NAMA di MASTER_BANK/MASTER_CC (beda spasi = saldo tidak kehitung).
4. `TANGGAL` = `YYYY-MM-DD`, `NOMINAL` = angka polos (tanpa Rp/titik), `JENIS` = `Pemasukan`/`Pengeluaran`.
5. Setelah edit manual, dashboard bisa belum berubah s/d 6 jam (cache). Tekan **Settings → Hitung Ulang Total** untuk paksa update.

## Format angka
- `fmt(n)` → `Rp 36.195.753` (sudah include "Rp" — JANGAN tambah prefix "Rp" lagi, ini sumber bug "Rp Rp")
- `fmtS(n)` → ringkas: `1,5 M`, `36 jt`

## Cara deploy perubahan (2 langkah TERPISAH)
1. **File (index.html, sw.js, Code.gs, dll):** GitHub Desktop → Commit → Push origin. Tunggu 1-2 menit. (sw.js v4 auto-bersih cache lama, update ke-pull otomatis.)
2. **Backend Code.gs (TIDAK ikut GitHub):** Apps Script editor → paste isi Code.gs → **Deploy → Manage Deployments → Edit (pensil) → Version: New version → Deploy**. Pastikan EDIT deployment lama (bukan bikin baru) supaya Web App URL tetap sama.
   - Tidak perlu Run fungsi manual apa pun. `initSheets`/`forceSeedMaster` idempotent (skip kalau data sudah ada).
   - Sebelum Code.gs di-redeploy, app tetap jalan via fallback `getAll` (tapi belum dapat manfaat skala).

## Kartu Kredit
CC-BCA-KRIS (BCA 431657XXXX0015), CC-BCA-JCB, CC-CIMB-JCB (X10), CC-CIMB-ACCOR (X88), CC-CIMB-WORLD, CC-HSBC-7118, CC-HSBC-VISA, CC-MAYBANK-BMW (3004), CC-MAYBANK-INFINITE, CC-BNI-JCB (0915), CC-DANAMON-JCB.

## Known issues / catatan
- API URL hilang jika "Clear site data" → set ulang via long-press title → Settings → Set API URL.
- Edit transaksi LAMA dari Account Detail: txn yg di luar window recent mungkin tidak ada di `state.txns` → fitur edit bisa meleset. (belum di-handle penuh; aman utk txn yg sedang tampil.)
- Tier 2 (belum dikerjakan, baru perlu saat sheet > ~5.000 baris): arsip per tahun (`TRANSAKSI_2026`, dst) supaya sheet aktif tetap kecil.

## Catatan kerja untuk chat baru
- Mount Linux (bash) sering LAG menampilkan file besar yg baru ditulis Write tool — verifikasi syntax via file asli (Read tool) atau copy ke folder outputs. File asli di `E:\...\arthabumi-fcc\` = yg di-track GitHub Desktop.
- Test syntax JS: `node --check` (extract blok `<script>` dari index.html).
- Jangan `git commit` via bash — user push manual via GitHub Desktop.
