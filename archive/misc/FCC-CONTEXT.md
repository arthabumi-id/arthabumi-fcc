# FCC Arthabumi — Context & Status (v22)

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

## ⭐ Perubahan v18 (Reserve = rekening NYATA / holding account) — Juni 2026
PRD: `PRD-v18-reserve-rekening-nyata.md`. **Wajib redeploy Code.gs.** sw.js cache **fcc-arthabumi-v8**.

### Perubahan model (PENTING — membalik sebagian v17)
Dulu reserve = **pot virtual** (uang hilang dari bank sumber, tidak parkir di mana pun; Net Cash v17 = total bank). Sekarang reserve = **uang NYATA yang diparkir di rekening penyimpan** (holding, mis. Seabank Ronah).
- **Buat reserve** (manual/cicilan/konversi): **transfer nyata** bank sumber → rekening penyimpan (source Pengeluaran 'Reserve CC' + holding Pemasukan 'Reserve Masuk', TIPE_LOG Reserve) + earmark RESERVE_LOG (holding dicatat di NOTES `[HOLD:...]`). Bila sumber==penyimpan → tanpa TXN, cukup earmark.
- **Bayar CC / angsuran dari reserve**: uang KELUAR dari rekening penyimpan terpilih (holding Pengeluaran) + tagihan/earmark turun. (Beda dari v17 yg tidak menyentuh bank.)
- **Net Cash = `Total Saldo Bank − Total Reserve`** (kas bebas) — karena uang reserve sekarang MASIH di bank (di penyimpan). Ini **membalik fix v17** (`= total bank`), dan benar utk model ini.
- Rekening penyimpan **dipilih per transaksi** (default `fcc_reserve_bank` localStorage, default SEABANK-RONAH). Saat bayar bisa pilih dari rekening penyimpan mana.

### Code.gs (wajib redeploy)
- `addReserve(data{DARI_REKENING,HOLDING,UNTUK_CC,NOMINAL})`: transfer sumber→holding + earmark.
- `payCCReserve(data{CC,HOLDING,NOMINAL})`: holding Pengeluaran 'Bayar CC' + CC Pemasukan + earmark−.
- `payCicilan(data{ID,HOLDING})`: holding Pengeluaran 'Bayar Cicilan' + earmark− + TENOR_TERBAYAR++.
- `addCicilan`/`convertTxnToCicilan`: bagian reserve jadi transfer sumber→holding (terima `HOLDING`).
- `migrateReserveToHolding(data{HOLDING})`: kredit saldo penyimpan = total reserve berjalan (sekali pakai, bila ada sisa reserve model lama supaya Net Cash tidak dobel).

### Client (index.html)
- Net Cash → `totBank − totRes`. Helper `defaultHoldingBank()`, `cicilanHolding(c)` (cari rekening penyimpan dari TXN 'Reserve Masuk').
- Form reserve (Transfer), Beli Cicilan, Ubah jadi Cicilan: dropdown **"Simpan di rekening"**. `doReserve`/`saveCicilan`/`saveConvertCicilan` kirim `HOLDING`.
- Drawer Bayar CC: src=reserve → dropdown **"Ambil dari rekening reserve"** (`pc_holding`). `doPayCicilan` jadi drawer pilih rekening + `doPayCicilanExec`.
- Settings: **"Rekening Penyimpan Reserve"** (`setReserveBank`) + **"Sinkronkan Reserve Lama"** (`syncReserveHolding`→migrateReserveToHolding).
- `buildForecast`: reserve ada di bank → tagihan/angsuran TETAP keluar dari bank (tidak dikurangi reserve); cicilan diproyeksikan per bulan dalam horizon.

### Verifikasi numerik v18 (PASS 8/8, `outputs/sim18.js`)
Beli cicilan 12jt/12x: total bank tetap (transfer), reserve 12jt, Net Cash turun TEPAT 12jt (bukan dobel). Lunas: uang benar-benar keluar dari penyimpan, total bank −12jt, reserve 0. Syntax fungsi v18 OK (`node --check` terisolasi; mount bash macet di file lama).

### Catatan: changeReserveBank (v17.2) masih ada — mengubah bank SUMBER setoran reserve (TXN 'Reserve CC'). Di model v18 makna "ganti bank" bisa diperluas ke penyimpan bila perlu (belum).

### Rincian Tagihan CC (v18.1, client-only) — rekonsiliasi vs statement
Tombol **"Rincian"** di kartu CC → drawer `openCCBill`/`renderCCBill`/`ccbApply`. Atur rentang tanggal (default 31 hari) sesuai periode statement cetak; menampilkan: belanja CC periode itu + **angsuran cicilan** yg jatuh tempo (`cicilanInstallmentsInPeriod`, due = TGL_MULAI + k bulan, pakai helper baru `_addMonthsISO`) + pembayaran, dengan subtotal. Menjawab masalah cicilan tidak muncul di daftar transaksi CC (krn REKENING dikosongkan). Catatan: "tagihan berjalan" (getCCOut) kumulatif lintas waktu; rincian periode utk cocokkan 1 siklus.
- **Centang rekonsiliasi (v18.2):** tiap baris Rincian ada checkbox (`ccbTick`); isi "Total tagihan di statement" → app hitung selisih (cocok/kurang/lebih). Bersifat sementara (ganti rentang me-reset).
- **Kunci tagihan ke Dashboard (v18.3, SERVER):** sheet baru **`CC_TAGIHAN`** (`ID,CC,NOMINAL,JATUH_TEMPO,PERIODE_DARI,PERIODE_SAMPAI,STATUS,CREATED_BY,CREATED_AT`, 1 baris aktif/kartu). Action **`lockCCBill`** (POST, wajib redeploy; replace baris lama kartu sama) + `getCCBills` + masuk getBundle/getAllData (`ccbills`). Tombol **"Kunci ke Dashboard"** di Rincian (`lockCCBillUI`, pakai total statement bila diisi/ else jumlah dicentang, + tanggal jatuh tempo default `dueDateThisMonth`). Tombol **Bayar** (`payCCFromReminder`→paycc) & **Lunas** (`clearCCBill`→deleteRow CC_TAGIHAN). `state.ccbills` di sync/save/offline. Helper `ccBillFor(cc)`.
- **Tata letak (v18.4):** info tagihan terkunci (nominal + hitung mundur + Bayar/Lunas) ditampilkan **inline di section KARTU KREDIT** (`#dashCC`, billStrip per kartu; kartu dgn locked bill tetap muncul walau out=0/res=0). Banner atas `#dashCCReminder` kini **hanya tampil utk yg mendesak** (lewat tempo / ≤7 hari) sbg alarm, judul "Tagihan CC mendesak".

## ⭐ Perubahan v18.9 (Bottom-nav bisa di-slide) — Juni 2026
Client-only (CSS+JS). `.bottom-nav` jadi `overflow-x:auto` (scrollbar disembunyikan), `.nav-item` `flex:0 0 auto;min-width:62px` (tidak lagi `flex:1` yg bikin tab/ikon mengecil di layar sempit/iPhone saat tab banyak). `goPage` auto-scroll tab aktif ke tengah (`scrollTo`).

## ⭐ Perubahan v18.8 (Status project "Abaikan") — Juni 2026
Client-only (index.html), tanpa redeploy (STATUS free-text). Status project baru **"Abaikan"** untuk project yang datanya belum lengkap → **dikeluarkan dari Laba Bersih** (`doneProjectsProfit` cuma hitung STATUS='Selesai', jadi otomatis terkecuali) & dari hitungan project aktif. Opsi ditambah di drawer Project (`fp_status`) + hint. Halaman Project: tab pill **"Abaikan"** (`pTab-abaikan`, `renderProject` cabang `abaikan`), badge abu-abu di `projCard`, dan di tab "Semua" muncul baris "⊘ N project diabaikan" yg bisa diklik. Cara pakai: Edit project → Status → Abaikan.

## ⭐ Perubahan v18.7 (Rentang tgl Transaksi + tombol + cepat) — Juni 2026
Client-only (index.html).
- **Filter rentang tanggal di halaman Transaksi:** input `txnFrom`/`txnTo` (`onTxnRange`/`clearTxnRange`); saat aktif menonaktifkan tab bulan (`state.txnMonth=''`). `filterTxn` tambah filter range + **ringkasan** `#txnSummary` (jumlah txn, total masuk, keluar, net) — berguna utk cek/rekonsiliasi; warning bila rentang melewati data termuat (`state.txnsSince`). `setTxnMonth` me-reset input rentang.
- **Tombol + cepat:** FAB di halaman Transaksi/Dashboard kini buka menu `#fabMenu` (`toggleFabMenu`) dengan 2 tombol **Pengeluaran**(merah)/**Pemasukan**(hijau) → `addTxnType(j)` → `openDrawer('txn',null,j)`. `openDrawer` terima param ke-3 `preset` utk set Jenis langsung (tak perlu pilih lagi di form). `closeFabMenu` dipanggil di openDrawer & goPage.

## ⭐ Perubahan v18.6 (Keterangan rekening reserve di baris cicilan) — Juni 2026
Client-only (index.html). Tiap baris **cicilan berjalan** (tab Kartu Kredit) menampilkan baris kecil biru "🏦 reserve di [bank]". Sumber: `cicilanHolding(c)` — prioritas TXN `Reserve Masuk` (model v18 transfer), fallback TXN `Reserve CC` (sumber/model lama); **return '' bila tak diketahui** → baris tidak ditampilkan (tidak lagi salah tulis default). `cicilanHoldingOrDefault(c)` (fallback ke default penyimpan) dipakai utk default dropdown di Bayar Angsuran. CATATAN: keterangan hanya akurat utk cicilan yg dibuat SETELAH Code.gs v18 di-redeploy (yg lama tak punya TXN Reserve Masuk).

## ⭐ Perubahan v18.5 (Kategori cascade di Tambah Transaksi) — Juni 2026
Client-only (index.html). Drawer Transaksi: field kategori dari input type-ahead jadi **2 dropdown bertingkat**: **Kelompok → Kategori**. Kelompok difilter sesuai Jenis (TIPE kategori); kategori difilter sesuai kelompok terpilih + opsi `__NEW__` "➕ Tambah kategori baru…" (nama diketik di `f_kat_new_name`, kelompok = yg terpilih). Helper baru: `jenisKelompoks(jenis)`, `fillKatGroup(presetGrp,presetKat)`, `fillKatList(presetKat)`, `onKatSelChange()` (ganti `onKatChange` lama). `f_jenis` onchange→`fillKatGroup()`; dipanggil sekali saat drawer txn dibuka (preset dari kategori saat edit). `saveDrawer` txn baca `f_kat_grp`+`f_kat_sel` (bukan `f_kat`). Elemen lama `f_kat`/`f_kat_list`/`f_kat_new_grp` dihapus.

## ⭐ Perubahan v19 (Status pendanaan reserve per kartu — "belum di-reserve") — Juni 2026
PRD: `PRD-v19-status-reserve-belanja-cc.md` (signed off "Proceed"). **Client-only (index.html), TANPA redeploy Code.gs.** sw.js cache **fcc-arthabumi-v10**.

### Problem
Eddy belanja pakai CC = utang. Sebelum jatuh tempo ia transfer dana BCA → bank penyimpan reserve untuk menutupnya. Ia bingung mana belanja yang sudah didanai (reserve) vs belum. Keputusan: **Model B** (per kartu SATU angka agregat, bukan centang per item).

### Model (agregat per kartu) — TERMASUK cicilan (revisi 5 Jun, keputusan Eddy)
- `unreservedCC(cc)` → `{perlu, sudah, belum}`:
  - `perlu` = `getCCOut(cc) − cicilanDueAmt(cc) + cicilanRemaining(cc)` (tagihan reguler non-cicilan + SELURUH sisa cicilan; basis = tagihan berjalan, opsi A).
  - `sudah` = `reserveFunds[cc]` (total reserve kartu, sudah termasuk earmark cicilan).
  - `belum` = `max(0, perlu − sudah)`.
- **Cicilan IKUT dihitung** (Eddy menyisihkan dana cicilan dari awal juga). Tanpa dobel: porsi cicilan jatuh tempo dikurangi dari `getCCOut` lalu seluruh sisa cicilan ditambahkan sekali. Cicilan yg sudah auto-reserve penuh saat beli → `belum`=0 utk porsi itu; yg belum ter-reserve muncul sbg `belum`.
- Konsisten dgn siklus: buat reserve → `sudah`↑ → `belum`↓; belanja CC / beli cicilan → `perlu`↑; bayar CC/angsuran dari reserve → `getCCOut`/`cicilanRemaining`↓ & `reserveFunds`↓ bersamaan.
- Verifikasi numerik 5 skenario (`outputs`/manual) cocok: cicilan auto-reserve→belum 0; cicilan belum reserve→belum=sisa cicilan; campuran reguler+cicilan benar.

### Client (index.html)
- Helper baru: `unreservedCC(cc)`, `ccReserveStrip(cc)` (strip status di kartu CC), `reserveNow(cc)` (buka tab Transfer→Reserve dgn `res_kartu` & `res_nominal`=selisih ke-prefill), `gotoCCReserve()` (ke Master tab CC).
- **Tab Master > Kartu Kredit:** tiap kartu ada strip: merah "Belum di-reserve Rp X" + tombol **"Reserve sekarang"**, atau hijau "Reserve lengkap" (via `ccReserveStrip`, disisipkan sebelum penutup kartu).
- **Dashboard:** kartu metrik baru **"Belum di-reserve (semua kartu)"** (merah, `totBelumRes`= jumlah `unreservedCC(c).belum`), klik → `gotoCCReserve()`. Hanya tampil bila >0.
- **KONTRAK PERILAKU (penting):** angka akurat HANYA bila tiap transfer reserve dicatat lewat form Reserve di FCC (tombol "Reserve sekarang" mempermudah). Transfer di m-banking yang tak dicatat tidak menurunkan angka.

### Catatan verifikasi v19
Fungsi baru + tambahan template di-`node --check` terisolasi = OK (mount bash macet di file lama, audit manual brace/template OK). Edit surgical (anchor unik). Cek console browser bila ada error JS.

### v19.1 — Bottom-nav 5 utama + "Lainnya" (fix swipe iPhone) — client-only
Masalah: bottom-nav v18.9 (1 baris bisa di-geser, overflow-x) bentrok dgn gesture iOS (geser tepi bawah → ganti app). Keputusan Eddy: **5 tab utama + tombol "Lainnya"**.
- **Nav (6 tombol, `flex:1 1 0`, TANPA overflow-x scroll):** Dashboard · Transaksi · Transfer · Project · Master · **Lainnya**. CSS `.nav-item` diperbesar (ikon 23px, label 11px/600, padding 10px). Membalik v18.9 (overflow-x dihapus).
- **Tombol "Lainnya"** (`toggleLainnyaMenu`/`closeLainnyaMenu`) → popup `#lainnyaMenu` + backdrop `#lainnyaBg` berisi **Kasbon · Forecast · Piutang**. Badge overdue Piutang (`#piutangBadge`) dipindah ke tombol Lainnya (id sama → `updatePiutangBadge` tetap jalan).
- **`goPage`**: highlight aktif kini via `data-nav` (bukan urutan posisi); `navKey` memetakan kasbon/forecast/piutang → 'lainnya' (tombol Lainnya menyala). Hapus auto-scroll nav (tak perlu lagi). `goPage` juga `closeLainnyaMenu()`.
- sw.js cache **fcc-arthabumi-v11**.

### v19.2 — Keterangan reserve di bawah saldo bank penyimpan — client-only
Masalah: saldo bank penyimpan (mis. BCA 552) membingungkan — sebagian saldo sebenarnya jatah reserve cicilan. Solusi (keputusan Eddy: buat konsisten + keterangan).
- Helper `_cicRowRemaining(c)` + **`reserveHeldIn(bank)`** = sisa cicilan yg holding-nya = bank (via `cicilanHoldingOrDefault`) + reserve bebas (diasumsikan di `defaultHoldingBank`).
- Dashboard "Saldo Rekening": tiap bank yg menyimpan reserve dapat sub-line biru **"🛡️ reserve CC Rp X · bebas Rp Y"** (Y = saldo − X). sw.js cache **fcc-arthabumi-v12**.
- **Terkait koreksi data 1×** (lihat log 2026-06-05): app BCA 552 dulu understated 20.303.853 karena 4 cicilan dikonversi pra-redeploy v18 (membukukan Pengeluaran reserve dari 552 tanpa leg Pemasukan). Fix manual = tambah 1 TXN Pemasukan ke BCA 552 NOMINAL 20.303.853 KATEGORI 'Reserve Masuk' TIPE_LOG 'Reserve' (excluded dari laba). Setelah itu saldo 552 = fisik 51.719.674; reserveHeldIn=22.503.003; bebas=29.216.671. reserveFunds (earmark) TIDAK berubah (dihitung dari RESERVE_LOG).

### v19.3 — Strip reserve DIPISAH (Cicilan vs Belanja lain) + tahan distorsi getCCOut — client-only
Masalah: strip v19 lama menampilkan SATU angka "perlu didanai" yg menyesatkan untuk kartu yg `getCCOut`-nya terdistorsi. Contoh nyata KRIS: pembayaran Mei 44,25jt tercatat tapi belanjanya sudah dikonversi cicilan (REKENING dikosongkan) → `getCCOut` jadi −30,4jt → strip lama hijau "Reserve lengkap — 2,42jt" (membingungkan di samping cicilan 22,5jt).
- **`unreservedCC(cc)`** kini kembalikan **bagian terpisah**: `cicNeed`=cicilanRemaining; `regNeed`=`max(0, getCCOut − cicilanDueAmt)` (DI-FLOOR ke 0 → distorsi minus tidak memunculkan angka palsu); reserve dialokasi cicilan dulu (`cicRes=min(res,cicNeed)`), sisanya ke belanja (`regRes`). `belum=cicBelum+regBelum` (dipakai Dashboard total & `reserveNow` prefill).
- **`ccReserveStrip`** kini sampai **2 baris**: "🗓 Cicilan {X} — ter-reserve ✓ / belum {Y}" dan "🛒 Belanja lain {X} — …". Baris hanya muncul bila Need>0; tombol "Reserve" hanya di baris yg merah.
- **Verifikasi (harness `harness-reserve-v19.js` di folder project, data KRIS asli + 8 skenario):** KRIS → "Cicilan 22.503.003 ter-reserve ✓" (regNeed floored 0, belanja Juni ter-mask oleh distorsi); funded/unfunded/partial/over/empty semua benar. Koreksi 552 +20.303.853 → 51.719.674. sw.js cache **fcc-arthabumi-v13**.
- **CATATAN data (bukan bug kode):** belanja KRIS Jun 1-5 (4.754.271) ter-mask karena pembayaran Mei 44,25jt jadi "kredit yatim" (belanjanya sudah pindah ke cicilan). Perlu dibereskan terpisah bila ingin akurat.

## ⭐ Perubahan v20 (Centang reserve manual + Bank reserve per kartu) — Juni 2026
PRD: `PRD-v20-centang-reserve-manual.md` (signed off "Proceed"). **WAJIB REDEPLOY Code.gs** (sheet & kolom baru). sw.js cache **fcc-arthabumi-v14**.

### Fitur A — Centang reserve manual per transaksi CC
Eddy transfer reserve secara AKUMULASI, mau menandai transaksi CC mana yg sudah dia danai — murni pengingat pribadi, LEPAS dari pot reserve (reserveFunds).
- **Sheet baru `RESERVE_MARK`** (`ID,TXN_ID,CC,NOMINAL,CREATED_BY,CREATED_AT`). 1 baris = 1 TXN dicentang. Lepas centang = hapus baris by TXN_ID.
- **Code.gs (redeploy):** action `markTxn` (idempotent: skip bila TXN_ID sudah ada), `unmarkTxn` (hapus by TXN_ID); masuk `getBundle`/`getAllData` (`marks`); doGet `getMarks`; helper `ensureCol`.
- **Client:** `state.marks` (sync/save/offline). Helper `isMarked(id)`, `markTotalCC(cc)`, `markCountCC(cc)`, `toggleMark(id,cc,nominal)` (optimistic `bgPost`). Di **Detail Akun CC**: tiap belanja (Pengeluaran, non-transfer/reserve) ada tombol **☐ tandai / ✅ reserved** + banner ringkasan "🏷️ Ditandai sudah di-reserve (manual): Rp X · N transaksi — reserve app: Rp Y" (sengaja berdampingan dgn reserve asli → mitigasi 'centang bohong'). Di **strip kartu CC (v19.3)**: baris "🏷️ Ditandai manual: Rp X · N transaksi" (indikator). Ringkasan juga otomatis muncul di kartu Master CC via strip.

### Fitur B — Rekening penyimpan reserve PER KARTU
- **Skema:** kolom **`RESERVE_BANK`** ditambah di akhir `MASTER_CC` (urutan lama tak diubah). `ensureCol(ss,S.CC,'RESERVE_BANK')` dipanggil di `getBundle` (migrasi otomatis, idempotent) → kolom muncul tanpa run manual. Baris lama kosong → pakai default global.
- **Client:** form Tambah/Edit Kartu Kredit dapat dropdown **"Rekening penyimpan reserve"** (`fc_reserve`); `saveDrawer` cc kirim `RESERVE_BANK`. Helper **`ccHoldingBank(ccNama)`** = `cc.RESERVE_BANK || defaultHoldingBank()`. Dipakai sbg DEFAULT dropdown penyimpan di: `reserveNow` (`res_holding`), tab Reserve (`res_kartu` onchange set `res_holding`), Beli Cicilan (`ci_cc` onchange → `ci_holding`), Ubah jadi Cicilan (`cv_holding`=ccHoldingBank txn.REKENING), Bayar CC (`pc_holding`). Tetap bisa diganti manual per transaksi.

### Verifikasi v20
Fungsi backend (markTxn/unmarkTxn/ensureCol) & client (ccHoldingBank/toggleMark/markTotalCC/isMarked) di-`node --check` + run terisolasi = OK (ccHoldingBank hormati RESERVE_BANK & fallback; toggle tandai/lepas akurat). Mount bash macet di file penuh (index.html ~230KB) → audit manual + cek console browser. Backup: `backup-pre-v20-*`.

## ⭐ Perubahan v20.1 (Urutan transaksi: tanggal lalu input) — Juni 2026
Client-only (index.html). sw.js cache **fcc-arthabumi-v15**.
- `renderTxn` sort jadi **`TANGGAL desc || CREATED_AT desc`** — tanggal tetap primer, lalu di antara transaksi bertanggal SAMA, yang paling baru di-input (CREATED_AT) naik ke atas. Keputusan Eddy: "tanggal dulu, kemudian input" (transaksi yang di-backdate tetap duduk di posisi tanggalnya, bukan loncat ke puncak). Verifikasi node OK.

## ⭐ Perubahan v21 (Akun Investasi — pribadi, DIPISAH TOTAL dari bisnis) — Juni 2026
PRD: `PRD-v21-investasi-saham.md` (signed off "Proceed"). **WAJIB REDEPLOY Code.gs** (3 sheet + action baru). sw.js cache **fcc-arthabumi-v17** (v16=modul awal; v17=grafik gabungan di halaman).

### Tujuan & model (keputusan Eddy)
Catat akun investasi saham (Stockbit, Pluang, Indo Premier, dll). Cakupan = **Kas + Nilai Portofolio**; posisi = **DIPISAH TOTAL** (tidak masuk Laba Bersih, Net Cash, Forecast). Dua angka terpisah per akun:
- **Modal tertanam** (ledger, dihitung app) = `MODAL_AWAL + Σsetor − Σtarik`.
- **Nilai kini** = snapshot manual terbaru (input berkala). Fallback = modal bila belum ada snapshot.
- **Untung/Rugi (belum terealisasi)** = nilai − modal (+ %).
- Setor dari **bank FCC** → saldo bank turun nyata (TXN `TIPE_LOG 'Investasi'`, dikecualikan laba/komposisi/forecast karena katExp hanya hitung Pengeluaran/Cicilan-Beli & dailyBurn hanya TIPE_LOG 'Pengeluaran'). Setor dari **`(luar)`** → hanya log INVEST_LOG, tak menyentuh bank. **Nilai portofolio TIDAK pernah dihitung sebagai kas.**

### Sheet baru (3, wajib redeploy — auto-create pola KASBON via `ensureSheet`)
- `MASTER_INVEST`: `ID,NAMA,PLATFORM,JENIS,MODAL_AWAL,CREATED_AT`
- `INVEST_LOG`: `ID,TANGGAL,AKUN,JENIS,REKENING,NOMINAL,NOTES,REF_ID,CREATED_BY,CREATED_AT` (JENIS=Setor/Tarik; REKENING=bank FCC atau `(luar)`)
- `INVEST_VALUE`: `ID,TANGGAL,AKUN,NILAI,NOTES,CREATED_BY,CREATED_AT` (snapshot nilai; termuda per akun = nilai kini)

### Code.gs (wajib redeploy)
- Action baru: `addInvestAkun`, `addInvestFlow` (REKENING bank → tulis TXN 'Setor/Tarik Investasi' TIPE_LOG 'Investasi'; honor `REF_ID` utk optimistic), `addInvestValue` (honor `ID`), `deleteInvestFlow` (hapus log+TXN via REF_ID). Edit/hapus akun & nilai pakai `updateRow`/`deleteRow` generik (sheet 'MASTER_INVEST'/'INVEST_VALUE').
- doGet `getInvest`; masuk `getBundle`/`getAllData` (`investAkun`,`investLog`,`investValue`). Helper `ensureSheet(ss,name)` baru.

### Client (index.html)
- `state.investAkun/investLog/investValue` (sync/forceRefresh/saveLocal/loadOffline).
- Helper: `investModal`, `investModalAsOf` (utk chart), `investLastSnapshot`, `investValueNow`, `investPL`, `investTotals`, `_invFlows`, `_invSnaps`.
- Nav: masuk popup **"Lainnya"** (ikon `ti-trending-up`, bersama Kasbon/Forecast/Piutang). goPage/navKey/renderAll include 'invest'.
- Halaman `page-invest` (`renderInvest`): kartu Total Nilai Portofolio (label "pribadi, di luar kas bisnis") + U/R, **grafik garis GABUNGAN semua akun langsung di halaman** (`buildInvestTotalChart`/`investTotalSeries`/`investAcctValueAsOf` — carry-forward: x=union tanggal snapshot, total Nilai vs total Modal as-of; akun tanpa snapshot dihitung sebesar modalnya), lalu kartu per akun (`investCard`, klik → `openInvestDetail`). **TIDAK ada kartu di Dashboard** (Q3 = terpisah penuh). Grafik per-akun tetap ada di drawer detail.
- `openInvestDetail`: ringkasan modal/nilai/UR + **grafik garis Nilai vs Modal** (`buildInvestChart`, Chart.js, modal dihitung as-of tiap tanggal snapshot) + riwayat snapshot & setor/tarik (hapus per baris) + Edit/Hapus akun (hapus hanya bila tanpa riwayat).
- Drawer: `openInvestAkun`/`saveInvestAkun`/`delInvestAkun`; `openInvestFlow`/`saveInvestFlow` (**blocking+syncAll bila sumber bank FCC** krn sentuh saldo; **optimistic bgPost bila `(luar)`**); `delInvestFlow`; `openInvestValue`/`saveInvestValue` (optimistic, ID client) / `delInvestValue`.
- Hint "⚠️ perlu update" bila snapshot nilai > 14 hari. Pengingat scheduled task tiap **Sabtu** (lihat log).

### Verifikasi v21
Fungsi backend (addInvestAkun/Flow/Value, deleteInvestFlow, ensureSheet) `node --check` OK + run terisolasi benar (setor bank tulis TXN, `(luar)` hanya log). Helper client (investModal/ModalAsOf/ValueNow/PL/Totals) `node --check` OK + uji nilai cocok 100% (modal ledger, nilai snapshot terbaru, U/R, modal as-of, totals, staleness). Blok UI penuh (20KB, template literal) `node --check` OK terisolasi. Mount bash flicker di file penuh (index.html ~237KB, Code.gs) → audit manual; **cek console browser saat buka**. Backup: `backup-pre-v21-*`.

## ⭐ Perubahan v22 (Klik bank & CC di Dashboard + tab cepat rentang tanggal) — Juni 2026
Client-only (index.html), **tanpa redeploy**. sw.js cache **fcc-arthabumi-v20**.
- **Saldo Rekening (Dashboard) bisa diklik:** tiap baris bank (`.list-item` di `dashSaldo`) kini `cursor:pointer` + `onclick="openAccountDetail('bank', NAMA)"` → buka drawer detail akun yang sudah ada (ringkasan masuk/keluar/saldo + donut komposisi + daftar transaksi + fetch riwayat penuh `getTxns?rekening`). Reuse penuh, tidak bikin drawer baru.
- **Kartu Kredit (Dashboard) bisa diklik (v19, diperbaiki v20):** tiap kartu CC (`.list-item` di `dashCC`) `cursor:pointer` + `onclick="openAccountDetail('cc', NAMA)"` (LANGSUNG, seperti bank) → detail CC (tagihan, banner reserve manual, donut, daftar transaksi + tombol tandai reserve). **Fix v20:** versi awal pakai guard `!closest('button')` + billStrip `stopPropagation` di seluruh strip → tap area tagihan kuning ikut terblok (kartu tak bisa diklik). Sekarang: onclick langsung di kartu; billStrip TIDAK lagi stopPropagation; `event.stopPropagation()` dipindah HANYA ke tombol Bayar/Lunas → tap di mana pun di kartu (termasuk strip tagihan) buka detail, tombol tetap jalan sendiri.
- **Tab cepat rentang tanggal di `openAccountDetail`:** baris chip **Hari ini · Kemarin · 1 Minggu · Bulan ini** (`.range-chip`, helper `acctRange(el,from,to)` set `ad_from`/`ad_to` lalu `acctFilter()`). Default aktif = Bulan ini (sama spt sebelumnya). Tanggal dihitung UTC-safe (`_ad_ago(n)` pakai `setUTCDate`, konsisten dgn `today()`): Hari ini=[today,today], Kemarin=[today-1,today-1], 1 Minggu=[today-6,today]. Ubah tanggal manual → highlight tab cepat mati. Berlaku juga saat drawer dibuka dari Master (kartu akun) — fitur sama untuk bank & CC.
- Verifikasi: `openAccountDetail` `node --check` OK (8,3KB, backtick seimbang); uji `_ad_ago`: kemarin & 1-minggu cocok. Mount bash flicker di file penuh → audit manual; cek console browser.

## ⭐ Catatan koreksi data pra-pembukuan (8 Jun 2026) — DIINPUT MANUAL OLEH EDDY
Audit DB menemukan **6 kartu CC** punya "pembayaran yatim" (tagihan pra-pembukuan dibayar, belanjanya tak tercatat) ≈ Rp 101,95jt + saldo BCA 552 understated 20.303.853. Entri koreksi (saldo-awal CC + reserve 552) di file **`KOREKSI-SALDO-AWAL-CC.md`** & **`KOREKSI-paste-ke-TRANSAKSI.xlsx`/`.csv`** (TIPE_LOG 'Saldo Awal'/'Reserve' → tidak masuk laba/komposisi). KRIS perlu konfirmasi Palyja (44.087.606 vs 44.251.790). Belum tentu sudah diinput — cek tab TRANSAKSI. Saldo bank selain 552 BELUM direkonsiliasi (snapshot belum sinkron penuh).

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
