# PRD v19 — Status Pendanaan Reserve per Kartu CC ("sudah/belum di-reserve")

Status: **FINAL — keputusan terkunci, menunggu "Proceed".** Belum ada kode.

## KEPUTUSAN TERKUNCI (Eddy, 5 Jun 2026)
- **Model B** — per kartu SATU angka "belum di-reserve" (bukan centang per item).
- **Basis "perlu didanai" = tagihan berjalan** (`getCCOut`, semua belanja belum dibayar; opsi A di Q1).
- **Tampil di tab Kartu Kredit + ringkasan di Dashboard** ("Total belum di-reserve semua kartu").
- **Client-only, TANPA redeploy Code.gs.**
- **KONTRAK PERILAKU:** angka akurat HANYA jika tiap transfer reserve dicatat lewat tombol
  Reserve di FCC (tombol "Reserve sekarang" akan dibuat agar 1–2 ketuk). Transfer di dunia
  nyata yang tidak dicatat = angka tidak ikut turun. (← perlu kamu konfirmasi sekali lagi.)

## 1. Problem (kata Eddy)
"Saya transaksi pakai CC (mis. 2 Juni) = utang ke CC. Sebelum jatuh tempo, saya mau
transfer dulu uang dari BCA ke bank reserve CC itu. Sekarang saya bingung: **mana yang
sudah saya transfer (reserve), mana yang belum.**"

Inti: butuh **visibilitas dana reserve per kartu** — berapa belanja CC yang sudah ditutup
dengan transfer reserve, dan berapa yang **belum** (= yang masih harus kamu transfer
sebelum jatuh tempo).

## 2. Temuan penting (EFFICIENCY CHECK — baca ini dulu)
FCC **sudah menyimpan kedua angka** yang dibutuhkan. Per kartu sudah ada:
- `getCCOut(cc)` → tagihan berjalan = belanja − pembayaran (+ porsi cicilan jatuh tempo).
- `reserveFunds[cc]` → total dana yang sudah kamu sisihkan (earmark RESERVE_LOG).
- `cicilanRemaining(cc)` / `cicilanDueAmt(cc)` → bagian cicilan (yang **sudah auto-reserve
  penuh saat beli**, jadi tidak masuk hitungan "belum di-reserve").

Artinya **"belum di-reserve" bukan data baru — cuma selisih yang belum pernah ditampilkan.**
Konsekuensi: solusi bisa **client-only (index.html), TANPA redeploy Code.gs** — tidak perlu
sheet baru, kolom baru, atau sistem reserve kedua.

## 3. Model yang SAYA REKOMENDASIKAN — "coverage" agregat per kartu
Per kartu kredit, tampilkan 3 angka + status:
```
Perlu didanai (non-cicilan)  = getCCOut(cc) − cicilanDueAmt(cc)        // belanja reguler
Sudah di-reserve (bebas)     = reserveFunds[cc] − cicilanRemaining(cc)  // reserve manual, bukan jatah cicilan
Belum di-reserve             = max(0, Perlu didanai − Sudah di-reserve)
```
- Kalau **Belum di-reserve = 0** → badge hijau "Reserve lengkap ✓".
- Kalau **> 0** → badge kuning/merah "Belum di-reserve Rp X" + tombol **"Reserve sekarang"**
  yang membuka form reserve existing (`doReserve`) dengan **nominal sudah ke-prefill = selisih**
  dan CC sudah terpilih. Kamu tinggal pilih bank sumber (BCA) + bank penyimpan → simpan.
- Cicilan ditampilkan **terpisah** ("cicilan: sudah disisihkan saat beli") supaya tidak rancu.

**Kenapa agregat, bukan centang per item?** Karena saat transfer, kamu memindahkan *sejumlah
uang*, bukan "item ini". Yang kamu butuh untuk bertindak adalah **satu angka: berapa yang
harus ditransfer**. Begitu kamu reserve, `reserveFunds` naik → "belum di-reserve" otomatis
mengecil ke 0. Tidak ada penanda manual yang bisa basi.

## 4. Alternatif yang SAYA TOLAK (dan alasannya)
**Centang per transaksi** (tiap baris belanja CC ada checkbox sudah/belum reserve).
- Butuh sumber kebenaran KEDUA (status "reserved" per TXN) yang harus terus disinkronkan
  dengan pot reserve. Dua angka yang gampang **bertabrakan** (mis. kamu reserve Rp 5jt tapi
  belum tahu dialokasikan ke item yang mana).
- Butuh kolom baru di sheet TRANSAKSI + Code.gs + redeploy → berat, melawan constraint
  "efisien & cepat, tanpa biaya besar".
- Tidak menambah info yang membantu keputusan: keputusanmu tetap "transfer berapa", dan itu
  dijawab oleh angka agregat.
- **Verdict:** over-engineering untuk masalah ini. Bisa ditambahkan nanti kalau memang perlu
  audit per-item, tapi jangan jadi titik awal.

## 5. Success Criteria
- Buka Dashboard / tab Kartu Kredit → tiap kartu langsung terlihat: **Belum di-reserve Rp X**
  (atau "Reserve lengkap ✓").
- Tombol "Reserve sekarang" prefill nominal = selisih + CC terpilih → 1–2 ketuk selesai.
- Setelah reserve disimpan, angka "belum" turun ke 0 tanpa langkah manual lain.
- (Opsional) ringkasan total di Dashboard: "Total belum di-reserve semua kartu: Rp Y".
- Cicilan tidak dihitung ganda (sudah auto-reserve) → tidak muncul sebagai "belum".
- TANPA redeploy Code.gs (kalau Open Question Q2 = pakai tagihan berjalan).

## 6. Scope teknis (target: client-only)
### index.html
- Helper baru: `unreservedCC(cc)` → `{ perlu, sudah, belum }` pakai rumus di §3.
- Kartu CC (Master) & section `#dashCC`: tambah baris status reserve + badge + tombol
  "Reserve sekarang" (`openDrawer('reserve', ccId)` atau helper prefill).
- `openDrawer`/form reserve (`doReserve`): terima preset CC + preset nominal.
- (Opsional) kartu Dashboard "Total belum di-reserve" (mirip kartu "Dana Disisihkan").
- sw.js cache bump → fcc-arthabumi-v10. **Tidak ada perubahan Code.gs** (kecuali Q2 pilih opsi B).

## 7. Open Questions (BUTUH jawabanmu)
- **Q1 — Definisi "perlu didanai":** pakai (A) **tagihan berjalan** `getCCOut` (kumulatif:
  semua belanja yg belum dibayar, lintas waktu) atau (B) **tagihan siklus statement** yang
  kamu kunci via "Rincian → Kunci ke Dashboard" (`CC_TAGIHAN`, per periode jatuh tempo)?
  - A = paling simpel, 0 redeploy, tapi angkanya "semua yang belum dibayar" bukan persis 1 siklus.
  - B = persis sesuai siklus jatuh tempo (lebih cocok dgn "sebelum jatuh tempo tgl X"), tapi
    cuma akurat kalau kamu rajin "Kunci tagihan". Tetap client-only (CC_TAGIHAN sudah ada).
  - **Rekomendasi saya: A dulu** (langsung jalan), naikkan ke B kalau perlu presisi siklus.
- **Q2 — Reserve untuk belanja reguler:** apakah kamu memang mau pakai mekanisme reserve
  FCC (transfer BCA → bank penyimpan) untuk belanja reguler, bukan hanya cicilan? (Kalau ya,
  alur `doReserve` existing sudah cukup — tinggal disodorkan.)
- **Q3 — Tampil di mana:** cukup di tab Kartu Kredit, atau juga ringkasan di Dashboard atas?

## 8. Risiko / catatan
- Kalau kamu kadang bayar CC **langsung dari BCA** (bukan lewat reserve), "belum di-reserve"
  bisa tampak besar padahal niatnya memang tidak di-reserve. Perlu sepakat: belanja CC yang
  mana yang masuk skema reserve.
- Angka "belum" bergantung pada akurasi pencatatan belanja CC di FCC (atau hasil tracker KK
  yang diimport). Pastikan transaksi CC tercatat.
- Single file, vanilla JS, pola existing. Verifikasi syntax via Read tool (mount bash sering lag).

---
SIGN-OFF: jawab Q1–Q3 lalu ketik **"Proceed"** untuk saya bangun. Atau koreksi modelnya.
