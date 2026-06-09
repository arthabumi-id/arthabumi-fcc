# PRD v21 — Akun Investasi (Saham) + Pelacakan Kas & Nilai Portofolio

Status: **FINAL — keputusan terkunci, menunggu "Proceed".** Belum ada kode.

## KEPUTUSAN TERKUNCI (Eddy, dari sesi ini)
- **Cakupan = Kas + Nilai Portofolio.** Catat setoran/tarikan (modal) + snapshot nilai berkala → app hitung untung/rugi (belum terealisasi).
- **Pemisahan = DIPISAH TOTAL.** Investasi punya seksi sendiri. TIDAK masuk Laba Bersih, Net Cash, atau Forecast bisnis. Ini uang pribadi, bukan performa Arthabumi.
- Akun nyata: **Stockbit, Pluang, Indo Premier** (bisa tambah lagi: Bibit, Ajaib, dll).
- **Q1 → Dukung KEDUANYA** (sumber setor = bank FCC *atau* `(luar)`), default bank FCC.
- **Q2 → Nilai MANUAL** (snapshot input sendiri; tanpa auto-fetch harga).
- **Q3 → MURNI di halaman Investasi.** TIDAK ada kartu di Dashboard (terpisah penuh).
- **Q4 → Pengingat scheduled task tiap SABTU** + **grafik garis Nilai vs Modal** (Chart.js).

## 1. Problem (kata Eddy)
"Saya investasi saham lewat beberapa akun (Stockbit, Pluang, Indo Premier, dll). Saya ingin mendata akun-akun ini: berapa modal yang sudah saya tanam, dan berapa nilainya sekarang — biar tahu untung/rugi. Tapi jangan sampai bercampur dengan keuangan bisnis kontraktor."

## 2. Prinsip desain (alasan kenapa modelnya begini)
1. **Saldo investasi ≠ ledger bank.** Bank: `saldo = awal + masuk − keluar`. Saham berfluktuasi tanpa transaksi → nilai kini TIDAK bisa dihitung dari arus kas. Karena itu ada **2 angka terpisah**:
   - **Modal tertanam** (ledger: setor − tarik) — pasti, dihitung app.
   - **Nilai sekarang** (snapshot manual yang kamu input berkala) — fluktuatif.
   - **Untung/Rugi (belum terealisasi)** = Nilai sekarang − Modal tertanam.
2. **Tembok ke bisnis.** Akun investasi BUKAN MASTER_BANK → otomatis tak tersentuh Total Saldo Bank, Net Cash, Forecast, Laba. Sheet & state sendiri.
3. **Arus kas tetap jujur.** Saat kamu setor dari bank yang dilacak FCC (mis. BCA → Stockbit), uang itu MEMANG keluar dari bank → saldo bank turun (TXN TIPE_LOG `Investasi`, dikecualikan dari laba/komposisi, pola sama seperti Transfer/Reserve/Kasbon). Yang TIDAK dilakukan: menambahkan balik nilai portofolio (mis. 15jt) ke Net Cash. Jadi: kas keluar tercatat ✓, nilai saham tidak dianggap kas siap-pakai ✓.

## 3. Scope teknis

### Sheet baru (3, wajib redeploy Code.gs — auto-create pola KASBON)
- **`MASTER_INVEST`**: `ID, NAMA, PLATFORM, JENIS, MODAL_AWAL, CREATED_AT`
  - PLATFORM = Stockbit / Pluang / Indo Premier / dll. JENIS = Saham IDX / Saham US / Reksadana / Emas / Kripto.
  - MODAL_AWAL = modal yang SUDAH tertanam sebelum mulai catat di FCC (biar tidak perlu input ulang riwayat lama).
- **`INVEST_LOG`** (arus kas modal): `ID, TANGGAL, AKUN, JENIS, REKENING, NOMINAL, NOTES, REF_ID, CREATED_BY, CREATED_AT`
  - JENIS = `Setor` / `Tarik`. REKENING = bank sumber/tujuan **bila** dari bank yang dilacak FCC (→ tulis TXN), atau `(luar)` bila dari kas pribadi di luar FCC (→ hanya log, tak sentuh bank).
- **`INVEST_VALUE`** (snapshot nilai): `ID, TANGGAL, AKUN, NILAI, NOTES, CREATED_BY, CREATED_AT`
  - 1 baris = 1 kali kamu input "nilai portofolio akun X per tanggal Y". Snapshot termuda per akun = nilai kini.

### Code.gs — action baru (wajib redeploy)
- `addInvestAkun(data)` → tulis MASTER_INVEST.
- `addInvestFlow(data{AKUN,JENIS,REKENING,NOMINAL,TANGGAL,NOTES})` → tulis INVEST_LOG; bila REKENING = bank FCC, tulis 1 TXN (Setor→Pengeluaran 'Setor Investasi', Tarik→Pemasukan 'Tarik Investasi', TIPE_LOG `Investasi`) via REF_ID.
- `addInvestValue(data{AKUN,NILAI,TANGGAL,NOTES})` → tulis INVEST_VALUE.
- `deleteInvestFlow`/`deleteInvestValue`/`deleteInvestAkun` (hapus baris + TXN terkait via REF_ID).
- Masuk `getBundle`/`getAllData` (`investAkun`, `investLog`, `investValue`); doGet `getInvest`.
- `getSummary`: pastikan TIPE_LOG `Investasi` **dikecualikan** dari katExp (komposisi) — pola sama seperti Transfer/Reserve.

### Client (index.html)
- `state.investAkun / investLog / investValue` (di syncAll/forceRefresh/saveLocal/loadOffline).
- Helpers: `investModal(akun)` (MODAL_AWAL + Σsetor − Σtarik), `investValueNow(akun)` (snapshot terbaru, fallback = modal bila belum ada snapshot), `investPL(akun)` ({rp, pct}), `investLastSnapshot(akun)` (tanggal — untuk hint "perlu update").
- **Nav:** masuk popup **"Lainnya"** (bersama Kasbon/Forecast/Piutang) — ikon `ti-chart-candle` atau `ti-trending-up`.
- **Halaman `page-invest` (`renderInvest`):**
  - Kartu atas: Total Modal Tertanam · Total Nilai Sekarang · **Total Untung/Rugi (Rp + %)** (hijau/merah), label tegas "*Portofolio pribadi — di luar kas bisnis*".
  - Kartu per akun: platform, jenis, modal, nilai kini, U/R %, tanggal snapshot terakhir (+ hint kuning bila > N hari). Tap → drawer detail.
  - Drawer detail (`openInvestDetail`): ringkasan + riwayat setor/tarik + riwayat snapshot nilai + grafik garis **Nilai vs Modal** seiring waktu (Chart.js). Tombol hapus per baris.
- **Drawer input:** `openInvestAkun` (tambah akun), `openInvestFlow` (setor/tarik — pilih akun, jenis, rekening sumber/`(luar)`, nominal, tanggal), `openInvestValue` (update nilai — pilih akun, nilai, tanggal). Optimistic `bgPost` untuk yang tak butuh angka server; `addInvestFlow` dgn REKENING bank = blocking + syncAll (saldo bank authoritative).
- **Dashboard:** TIDAK ada kartu investasi (Q3 = terpisah penuh). Semua tampil hanya di halaman Investasi.
- **Pengingat (Q4):** scheduled task tiap **Sabtu** → notifikasi "update nilai portofolio" + buka halaman Investasi. (Dipasang via skill `schedule` setelah modul jadi.)
- sw.js cache bump (mis. **fcc-arthabumi-v16**).

## 4. Success Criteria
- Bisa tambah akun (Stockbit/Pluang/Indo Premier), catat setor/tarik, dan update nilai portofolio.
- Modal tertanam, nilai kini, dan U/R (Rp+%) akurat per akun & total.
- Setor dari bank FCC → saldo bank turun (kas jujur); nilai portofolio TIDAK pernah masuk Net Cash / Laba / Forecast.
- Setor dari kas luar (`(luar)`) → modal naik tanpa menyentuh bank FCC.
- Grafik Nilai vs Modal menunjukkan tren cuan/rugi.

## 5. Open Questions (jawab atau "pakai rekomendasi")
- **Q1 — Sumber setoran:** Saat setor, sumbernya **(a) pilih bank FCC** (kurangi saldo bank) **atau (b) `(luar)`** (kas pribadi, tak sentuh FCC) — dukung KEDUANYA per transaksi? *(Rekomendasi: ya, dukung dua-duanya; default pilih bank FCC karena mayoritas modalmu lewat bank yang dilacak.)*
- **Q2 — Nilai portofolio:** Input **manual snapshot** (kamu ketik nilai dari app Stockbit/Pluang sesekali). Auto-fetch harga TIDAK dilakukan (Pluang/Stockbit tak ada API publik; IDX butuh model per-emiten yang kamu tolak). *(Rekomendasi: manual snapshot — cukup, fleksibel untuk saham/emas/kripto/reksadana sekaligus.)*
- **Q3 — Kartu Dashboard:** Tampilkan ringkasan portofolio di Dashboard (kecil, jelas terpisah) atau **murni di halaman Investasi saja**? *(Rekomendasi: kartu kecil di Dashboard, berlabel "di luar kas bisnis" — biar sekali lihat tahu, tanpa mencemari Net Cash.)*
- **Q4 — Pengingat update nilai:** Mau saya pasang **scheduled task** "update nilai portofolio" (mis. tiap Sabtu) yang mengingatkan + buka halaman Investasi? *(Rekomendasi: ya, mingguan — snapshot rutin bikin grafik trennya berguna.)*

## 6. Risiko / catatan
- **Model snapshot, bukan akuntansi lot penuh.** U/R = nilai snapshot − modal net. Saat tarik untung, modal net turun & nilai snapshot juga (kamu jual) → U/R tetap konsisten. Tidak melacak realized vs unrealized terpisah (kamu pilih "kas + nilai", bukan "penuh per saham"). Cukup untuk tahu posisi.
- **Akurasi nilai = sebaik snapshot terakhir.** Kalau lama tidak update, U/R basi → ada hint "perlu update".
- Wajib 2 langkah deploy (push file + redeploy Apps Script Code.gs).
- TIPE_LOG `Investasi` harus dikecualikan konsisten dari laba & komposisi (audit seperti penambahan TIPE_LOG sebelumnya).

---
SIGN-OFF: jawab Q1–Q4 (atau "pakai rekomendasi") lalu ketik **"Proceed"**.
