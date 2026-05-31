# FIXBUG.md — Bug Tracker FCC Arthabumi
> Catat semua bug yang ditemukan, statusnya, dan cara fixnya.
> Format status: `OPEN` · `IN PROGRESS` · `FIXED` · `WONTFIX`

---

## CARA REPORT BUG
Isi template ini setiap ada bug:
```
### BUG-00X
**Status:** OPEN
**Ditemukan:** [tanggal]
**Ditemukan oleh:** [nama]
**Halaman/Fitur:** [Dashboard / Transaksi / Transfer / dll.]
**Deskripsi:** [apa yang terjadi]
**Langkah reproduce:** [cara ulang bug]
**Expected:** [harusnya seperti apa]
**Actual:** [yang terjadi]
**Fix:** [solusi / PR / commit]
```

---

## KNOWN ISSUES — Perlu dimonitor

### BUG-001
**Status:** OPEN
**Ditemukan:** 2026-05-31
**Fitur:** Google Sheets Sync
**Deskripsi:** Sync gagal jika Apps Script URL belum di-set atau expired
**Langkah reproduce:** Buka app tanpa set URL → klik Sync
**Expected:** Pesan error yang jelas
**Actual:** Toast "Gagal sync. Mode offline." — cukup jelas tapi tidak ada link ke Settings
**Fix:** Tambahkan tombol "→ Buka Settings" di toast error sync

---

### BUG-002
**Status:** OPEN
**Ditemukan:** 2026-05-31
**Fitur:** Apps Script CORS
**Deskripsi:** Beberapa browser block request ke script.google.com (CORS)
**Langkah reproduce:** Buka app di browser tertentu → klik Sync
**Expected:** Data tersync
**Actual:** CORS error di console
**Fix:** Apps Script sudah return JSON dengan proper headers. Jika masih error, coba buka di Chrome.

---

### BUG-003
**Status:** OPEN
**Ditemukan:** 2026-05-31
**Fitur:** PWA Install — iPhone
**Deskripsi:** Di iPhone, harus buka di Safari (bukan Chrome) untuk bisa "Add to Home Screen"
**Fix:** Tambahkan banner instruksi di app jika dibuka di iOS Chrome

---

### BUG-004
**Status:** OPEN
**Ditemukan:** 2026-05-31
**Fitur:** Data offline reset
**Deskripsi:** Data di localStorage hilang jika user clear browser data / ganti HP
**Fix:** Wajib sync ke Google Sheets setelah setiap sesi input penting

---

## FIXED

*(belum ada)*

---

## CATATAN DEBUGGING

### Cara cek error Apps Script:
1. Buka Google Apps Script
2. Klik **Executions** di sidebar kiri
3. Lihat log error merah

### Cara cek error di browser:
1. Buka app di Chrome desktop
2. F12 → Console
3. Lihat pesan merah

### Cara force refresh PWA (cache lama):
1. Chrome → Settings → Site Settings → arthabumi-id.github.io → Clear data
2. Atau: Ctrl+Shift+R (hard refresh)

### URL penting:
- App: https://arthabumi-id.github.io/arthabumi-fcc/
- GitHub repo: https://github.com/arthabumi-id/arthabumi-fcc
- Google Sheets: https://docs.google.com/spreadsheets/d/1BYXyk0XlyeuelrIa6KKch8A79z7yvOG3_RjSxft7JTo/edit
- Apps Script: (buka dari Sheets → Extensions → Apps Script)
