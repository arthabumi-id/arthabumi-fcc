// ============================================================
// FCC ARTHABUMI - Google Apps Script Backend (v3 - scalable)
// Paste file ini ke: Google Sheets → Extensions → Apps Script
// Deploy → Manage Deployments → Edit → New Version
// Execute as: Me | Who has access: Anyone
// ============================================================

const SHEET_ID   = SpreadsheetApp.getActiveSpreadsheet().getId();
const VALID_PINS = ['1234', '5678', '9999'];

const RECENT_DAYS = 120;        // txn terakhir yg dikirim saat sync
const SUMMARY_TTL = 21600;      // cache summary 6 jam (detik)
const SUMMARY_KEY = 'fcc_summary_v3';

const S = {
  TXN: 'TRANSAKSI', BANK: 'MASTER_BANK', CC: 'MASTER_CC', PROJ: 'MASTER_PROJECT',
  KAT: 'MASTER_KATEGORI', TRANSFER: 'TRANSFER_LOG', RESERVE: 'RESERVE_LOG', KASBON: 'KASBON',
  JADWAL: 'JADWAL', PIUTANG: 'PIUTANG', CICILAN: 'CICILAN', CCBILL: 'CC_TAGIHAN',
  MARK: 'RESERVE_MARK',
  PAIDMARK: 'PAID_MARK',   // v23: penanda manual "tagihan sudah dibayar/lunas" per transaksi CC
  INVEST: 'MASTER_INVEST', INVESTLOG: 'INVEST_LOG', INVESTVAL: 'INVEST_VALUE',  // v21 investasi (terpisah dari bisnis)
  ADD: 'ADDENDUM',  // v24: kerja tambah/kurang (addendum) per project — ubah nilai kontrak efektif
  KURS: 'KURS',     // v25: kurs valas BCA (e-Rate) — di-fetch otomatis harian via trigger
  FOREX: 'FOREX_LOG', // v26: pocket forex — konversi Rp↔valas, nilai live ikut kurs BCA
};

const HEADERS = {
  [S.TXN]:      ['ID','TANGGAL','JENIS','PROJECT','REKENING','KATEGORI','NOMINAL','NOTES','TIPE_LOG','CREATED_BY','CREATED_AT'],
  [S.BANK]:     ['ID','NAMA','TIPE','BANK','SALDO_AWAL','CREATED_AT'],
  // RESERVE_BANK (v20) = rekening penyimpan reserve default kartu ini (boleh kosong → pakai default global).
  [S.CC]:       ['ID','NAMA','BANK','LIMIT','JATUH_TEMPO','CREATED_AT','RESERVE_BANK'],
  [S.PROJ]:     ['ID','NAMA','KLIEN','TGL_MULAI','STATUS','NILAI_CONTRACT','CREATED_AT'],
  [S.KAT]:      ['ID','KELOMPOK','NAMA','TIPE','CREATED_AT'],
  [S.TRANSFER]: ['ID','TANGGAL','DARI','KE','NOMINAL','NOTES','REF_ID','CREATED_BY','CREATED_AT'],
  [S.RESERVE]:  ['ID','TANGGAL','DARI_REKENING','UNTUK_CC','NOMINAL','NOTES','CREATED_BY','CREATED_AT'],
  [S.KASBON]:   ['ID','TANGGAL','KARYAWAN','JENIS','NOMINAL','METODE','REKENING','NOTES','REF_ID','CREATED_BY','CREATED_AT'],
  // JADWAL = pemasukan/pengeluaran terjadwal untuk Cashflow Forecast.
  // JENIS: Pemasukan/Pengeluaran. FREKUENSI: 'sekali' (TGL=yyyy-MM-dd) | 'bulanan' (TGL=tanggal 1-31).
  // AKTIF: 1/0. PROJECT opsional (label saja). Tidak masuk TRANSAKSI/summary — murni proyeksi.
  [S.JADWAL]:   ['ID','JENIS','NAMA','NOMINAL','FREKUENSI','TGL','AKTIF','PROJECT','NOTES','CREATED_BY','CREATED_AT'],
  // PIUTANG = termin kontrak klien yg belum/sudah dibayar.
  // STATUS: 'Belum' / 'Lunas'. Saat Lunas → tulis 1 TXN Pemasukan (lihat payPiutang).
  // Termin STATUS='Belum' dengan JATUH_TEMPO ≤ horizon dipakai client utk proyeksi Forecast.
  [S.PIUTANG]:  ['ID','PROJECT','KLIEN','TERMIN','NOMINAL','JATUH_TEMPO','STATUS','TGL_BAYAR','REKENING','REF_ID','NOTES','CREATED_BY','CREATED_AT'],
  // CICILAN = pembelian kartu kredit yg dicicil. Beban diakui PENUH di muka (2 TXN
  // 'Cicilan-Beli' pokok+bunga, REKENING kosong → masuk laba/proj/komposisi, TIDAK
  // menambah tagihan CC). Kas dialokasikan via RESERVE penuh (pokok+bunga) ke CC.
  // Tagihan cicilan bersifat virtual (dihitung client dari TENOR_TERBAYAR). payCicilan
  // tiap bulan = release reserve + TENOR_TERBAYAR++. STATUS: 'Jalan'/'Lunas'.
  [S.CICILAN]:  ['ID','TANGGAL_BELI','CC','DESKRIPSI','NOMINAL_POKOK','BUNGA_TOTAL','TENOR','NOMINAL_PER_BULAN','TGL_MULAI','TENOR_TERBAYAR','STATUS','PROJECT','KATEGORI','REF_ID','NOTES','CREATED_BY','CREATED_AT'],
  // CC_TAGIHAN = tagihan CC terkunci dari rekonsiliasi statement (pengingat jatuh tempo di dashboard).
  // 1 baris aktif per kartu (lock baru menggantikan yg lama). STATUS='Aktif'/'Lunas'.
  [S.CCBILL]:   ['ID','CC','NOMINAL','JATUH_TEMPO','PERIODE_DARI','PERIODE_SAMPAI','STATUS','CREATED_BY','CREATED_AT'],
  // RESERVE_MARK (v20) = penanda manual Eddy: transaksi CC mana yg sudah dia buatkan reserve
  // (dia transfer reserve secara akumulasi). Lepas dari pot reserve (RESERVE_LOG) — murni penanda
  // ingat-ingatan. 1 baris = 1 TXN dicentang. Lepas centang = hapus baris (by TXN_ID).
  [S.MARK]:     ['ID','TXN_ID','CC','NOMINAL','CREATED_BY','CREATED_AT'],
  // PAID_MARK (v23) = penanda manual "lunas" per transaksi CC. Murni filter tampilan rincian CC,
  // LEPAS dari perhitungan tagihan/saldo/reserve. 1 baris = 1 TXN ditandai lunas. Lepas = hapus baris.
  [S.PAIDMARK]: ['ID','TXN_ID','CREATED_BY','CREATED_AT'],
  // ── v21 INVESTASI (pribadi, DIPISAH TOTAL dari metrik bisnis) ──
  // MASTER_INVEST = daftar akun investasi (Stockbit/Pluang/Indo Premier/dll).
  //   MODAL_AWAL = modal yg sudah tertanam sebelum mulai catat di FCC.
  [S.INVEST]:   ['ID','NAMA','PLATFORM','JENIS','MODAL_AWAL','CREATED_AT'],
  // INVEST_LOG = arus kas modal. JENIS: 'Setor'/'Tarik'. REKENING = bank FCC (→ tulis 1 TXN
  //   TIPE_LOG 'Investasi', dikecualikan dari laba/komposisi) atau '(luar)' (kas pribadi, tak sentuh bank).
  [S.INVESTLOG]:['ID','TANGGAL','AKUN','JENIS','REKENING','NOMINAL','NOTES','REF_ID','CREATED_BY','CREATED_AT'],
  // INVEST_VALUE = snapshot nilai portofolio (input manual berkala). Termuda per akun = nilai kini.
  [S.INVESTVAL]:['ID','TANGGAL','AKUN','NILAI','NOTES','CREATED_BY','CREATED_AT'],
  // ── v24 ADDENDUM (kerja tambah/kurang per project) ──
  // JENIS: 'Tambah' / 'Kurang'. NOMINAL selalu positif; arah dari JENIS. Nilai kontrak efektif
  // = NILAI_CONTRACT + Σ(Tambah) − Σ(Kurang). TIDAK menyentuh laba/kas (laba tetap basis transaksi).
  [S.ADD]:      ['ID','PROJECT_ID','PROJECT_NAMA','TANGGAL','JENIS','DESKRIPSI','NOMINAL','CREATED_BY','CREATED_AT'],
  // ── v25 KURS (valas BCA e-Rate) ──
  // Di-fetch otomatis harian (fetchKursBCA via trigger). ERATE_BELI/JUAL = angka (Rp per 1 unit valas).
  // UPDATE_BCA = string timestamp dari halaman BCA. FETCHED_AT = ISO waktu fetch app.
  // 1 baris = 1 mata uang. Isi ulang penuh tiap fetch (clear + rewrite). Referensi saja, bukan kas.
  [S.KURS]:     ['MATA_UANG','ERATE_BELI','ERATE_JUAL','UPDATE_BCA','FETCHED_AT'],
  // ── v26 FOREX (pocket forex / kantong valas) ──
  // JENIS: 'Beli' (Rp→valas, beli valas) / 'Jual' (valas→Rp, jual valas). JUMLAH_VALAS & KURS
  // & NOMINAL_RP selalu positif (NOMINAL_RP = JUMLAH_VALAS × KURS, kurs diisi user saat convert).
  // Tiap baris tulis 1 TXN TIPE_LOG 'Forex' (saldo bank turun/naik NYATA, tapi dikecualikan dari
  // laba/komposisi/forecast krn bukan 'Pengeluaran'). Nilai live = holding × e-Rate Beli (client).
  [S.FOREX]:    ['ID','TANGGAL','JENIS','MATA_UANG','REKENING','JUMLAH_VALAS','KURS','NOMINAL_RP','NOTES','REF_ID','CREATED_BY','CREATED_AT'],
};

// ── INIT ─────────────────────────────────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(HEADERS).forEach(([name, cols]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(cols);
      sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });
  seedMasterData(ss);
  return { status: 'ok', message: 'Sheets initialized' };
}

function seedMasterData(ss) {
  const now = new Date().toISOString();
  const seed = (name, rows) => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() <= 1 && rows.length) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      Logger.log(name + ': seeded ' + rows.length);
    } else {
      Logger.log(name + ': skip (' + (sheet ? sheet.getLastRow()-1 : 0) + ' rows)');
    }
  };
  seed(S.BANK, [
    ['RK01','BCA 082','Bank','BCA',0,now],
    ['RK02','BCA 552','Bank','BCA',0,now],
    ['RK03','SEABANK-EDDY','Bank','SeaBank',0,now],
    ['RK04','SEABANK-RONAH','Bank','SeaBank',0,now],
    ['RK05','CASH','Kas','Cash',0,now],
  ]);
  seed(S.CC, [
    ['RK06','CC-BCA-KRIS','BCA',20000000,25,now],
    ['RK07','CC-BCA-JCB','BCA',30000000,25,now],
    ['RK08','CC-CIMB-JCB','CIMB',15000000,25,now],
    ['RK09','CC-CIMB-ACCOR','CIMB',10000000,25,now],
    ['RK10','CC-CIMB-WORLD','CIMB',0,25,now],
    ['RK11','CC-HSBC-7118','HSBC',0,25,now],
    ['RK12','CC-HSBC-VISA','HSBC',0,25,now],
    ['RK13','CC-MAYBANK-BMW','MAYBANK',0,25,now],
    ['RK14','CC-MAYBANK-INFINITE','MAYBANK',0,25,now],
    ['RK15','CC-BNI-JCB','BNI',0,25,now],
    ['RK16','CC-DANAMON-JCB','DANAMON',0,25,now],
  ]);
  seed(S.KAT, [
    ['K01','PEMASUKAN','DP Project','Pemasukan',now],
    ['K02','PEMASUKAN','Pelunasan','Pemasukan',now],
    ['K03','PEMASUKAN','Fee Konsultasi','Pemasukan',now],
    ['K04','PEMASUKAN','Bunga','Pemasukan',now],
    ['K05','PEMASUKAN','Kas dari Novi','Pemasukan',now],
    ['K06','PROJECT','Material','Pengeluaran',now],
    ['K07','PROJECT','Gaji Tim','Pengeluaran',now],
    ['K08','PROJECT','Gaji Herman','Pengeluaran',now],
    ['K09','PROJECT','Transport','Pengeluaran',now],
    ['K10','PROJECT','Subkontraktor','Pengeluaran',now],
    ['K11','OPERASIONAL','Bensin Fino','Pengeluaran',now],
    ['K12','OPERASIONAL','Internet','Pengeluaran',now],
    ['K13','PRIBADI','Makan','Pengeluaran',now],
    ['K14','PRIBADI','Asuransi','Pengeluaran',now],
    ['K15','FINANCIAL','Pajak','Pengeluaran',now],
    ['K16','FINANCIAL','Admin Bank','Pengeluaran',now],
  ]);
}

function forceSeedMaster() {
  seedMasterData(SpreadsheetApp.getActiveSpreadsheet());
  Logger.log('Done.');
}

// ── HTTP ─────────────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || '';
  const pin    = e.parameter.pin || '';
  if (!VALID_PINS.includes(pin) && action !== 'ping') return json({ error: 'Unauthorized', code: 401 });
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    switch (action) {
      case 'ping':         return json({ ok: true, version: '3.0' });
      case 'getBundle':    return json(getBundle(ss, e.parameter));
      case 'getSummary':   return json({ summary: getSummary(ss) });
      case 'clearCache':   invalidateSummary(); return json(getBundle(ss, e.parameter)); // paksa hitung ulang stlh edit manual di Sheets
      case 'getAll':       return json(getAllData(ss));
      case 'getBanks':     return json(getSheet(ss, S.BANK));
      case 'getCCs':       return json(getSheet(ss, S.CC));
      case 'getProjs':     return json(getSheet(ss, S.PROJ));
      case 'getKats':      return json(getSheet(ss, S.KAT));
      case 'getTxns':      return json(getTxns(ss, e.parameter));
      case 'getTransfers': return json(getSheet(ss, S.TRANSFER));
      case 'getReserves':  return json(getSheet(ss, S.RESERVE));
      case 'getJadwal':    return json(getSheet(ss, S.JADWAL));
      case 'getPiutang':   return json(getSheet(ss, S.PIUTANG));
      case 'getCicilan':   return json(getSheet(ss, S.CICILAN));
      case 'getCCBills':   return json(getSheet(ss, S.CCBILL));
      case 'getMarks':     return json(getSheet(ss, S.MARK));
      case 'getPaidMarks': return json(getSheet(ss, S.PAIDMARK));
      case 'getInvest':    return json({ investAkun: getSheet(ss, S.INVEST), investLog: getSheet(ss, S.INVESTLOG), investValue: getSheet(ss, S.INVESTVAL) });
      case 'getKurs':      return json(getSheet(ss, S.KURS));
      case 'getForex':     return json(getSheet(ss, S.FOREX));
      default:             return json({ error: 'Unknown action' });
    }
  } catch (err) { return json({ error: err.message }); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, pin, data } = body;
    if (!VALID_PINS.includes(pin)) return json({ error: 'Unauthorized', code: 401 });
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let res;
    switch (action) {
      case 'addTxn':      res = addRow(ss, S.TXN, data); break;
      case 'addTxnBatch': res = addTxnBatch(ss, data); break;
      case 'addBank':     res = addRow(ss, S.BANK, data); break;
      case 'addCC':       res = addRow(ss, S.CC, data); break;
      case 'addProj':     res = addRow(ss, S.PROJ, data); break;
      case 'addAddendum': res = addAddendum(ss, data); break;
      case 'reassignProject': res = reassignProject(ss, data); break;
      case 'addKat':      res = addRow(ss, S.KAT, data); break;
      case 'addTransfer': res = addTransfer(ss, data); break;
      case 'deleteTransfer': res = deleteTransfer(ss, data); break;
      case 'addReserve':  res = addReserve(ss, data); break;
      case 'payCCReserve': res = payCCReserve(ss, data); break;
      case 'migrateReserveToHolding': res = migrateReserveToHolding(ss, data); break;
      case 'addKasbon':   res = addKasbon(ss, data); break;
      case 'deleteKasbon':res = deleteKasbon(ss, data); break;
      case 'addJadwal':   res = addJadwal(ss, data); break;
      case 'addPiutang':  res = addPiutang(ss, data); break;
      case 'payPiutang':  res = payPiutang(ss, data); break;
      case 'addCicilan':  res = addCicilan(ss, data); break;
      case 'payCicilan':  res = payCicilan(ss, data); break;
      case 'deleteCicilan': res = deleteCicilan(ss, data); break;
      case 'convertTxnToCicilan': res = convertTxnToCicilan(ss, data); break;
      case 'changeReserveBank': res = changeReserveBank(ss, data); break;
      case 'markTxn':     res = markTxn(ss, data); break;
      case 'unmarkTxn':   res = unmarkTxn(ss, data); break;
      case 'markPaid':      res = markPaid(ss, data); break;
      case 'unmarkPaid':    res = unmarkPaid(ss, data); break;
      case 'markPaidBatch': res = markPaidBatch(ss, data); break;
      case 'addInvestAkun':   res = addInvestAkun(ss, data); break;
      case 'addInvestFlow':   res = addInvestFlow(ss, data); break;
      case 'addInvestValue':  res = addInvestValue(ss, data); break;
      case 'deleteInvestFlow':res = deleteInvestFlow(ss, data); break;
      case 'lockCCBill':  res = lockCCBill(ss, data); break;
      case 'fetchKurs':   res = fetchKursBCA(); break;
      case 'addForexConvert': res = addForexConvert(ss, data); break;
      case 'deleteForex':     res = deleteForex(ss, data); break;
      case 'updateRow':   res = updateRow(ss, data); break;
      case 'deleteRow':   res = deleteRow(ss, data); break;
      case 'init':        res = initSheets(); break;
      default:            return json({ error: 'Unknown action' });
    }
    invalidateSummary();
    return json(res);
  } catch (err) { return json({ error: err.message }); }
}

// ── BUNDLE: 1 round-trip ─────────────────────────────────────
function getBundle(ss, params) {
  const since = params.since || daysAgoISO(RECENT_DAYS);
  ensureCol(ss, S.CC, 'RESERVE_BANK');   // v20: pastikan kolom bank reserve per kartu ada
  return {
    banks:     getSheet(ss, S.BANK),
    ccs:       getSheet(ss, S.CC),
    projects:  getSheet(ss, S.PROJ),
    kategori:  getSheet(ss, S.KAT),
    transfers: getSheet(ss, S.TRANSFER),
    reserves:  getSheet(ss, S.RESERVE),
    kasbon:    getSheet(ss, S.KASBON),
    jadwal:    getSheet(ss, S.JADWAL),
    piutang:   getSheet(ss, S.PIUTANG),
    cicilan:   getSheet(ss, S.CICILAN),
    ccbills:   getSheet(ss, S.CCBILL),
    marks:     getSheet(ss, S.MARK),
    paidMarks: getSheet(ss, S.PAIDMARK),
    investAkun:  getSheet(ss, S.INVEST),
    investLog:   getSheet(ss, S.INVESTLOG),
    investValue: getSheet(ss, S.INVESTVAL),
    addendums:   getSheet(ss, S.ADD),
    kurs:      getSheet(ss, S.KURS),
    forex:     getSheet(ss, S.FOREX),
    summary:   getSummary(ss),
    txns:      getTxns(ss, { since: since }),
    since:     since,
  };
}

// ── SUMMARY: agregat 1x-jalan, cache 6 jam ───────────────────
function getSummary(ss) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(SUMMARY_KEY);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  const sheet = ss.getSheetByName(S.TXN);
  const tz = ss.getSpreadsheetTimeZone() || 'Asia/Jakarta';
  const out = { acct: {}, proj: {}, month: {}, katExp: {}, count: 0, generatedAt: new Date().toISOString() };
  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).getValues();
    const H = HEADERS[S.TXN];
    const iTgl = H.indexOf('TANGGAL'), iJns = H.indexOf('JENIS'), iProj = H.indexOf('PROJECT'),
          iRek = H.indexOf('REKENING'), iKat = H.indexOf('KATEGORI'), iNom = H.indexOf('NOMINAL'),
          iTipe = H.indexOf('TIPE_LOG');
    rows.forEach(r => {
      const nom = Number(r[iNom]) || 0;
      if (!nom) return;
      const masuk = r[iJns] === 'Pemasukan';
      const rek = r[iRek], proj = r[iProj], kat = r[iKat];
      const ym = String(normalizeCell(r[iTgl], tz)).slice(0, 7);
      if (rek) {
        const a = out.acct[rek] || (out.acct[rek] = { masuk: 0, keluar: 0, count: 0 });
        a[masuk ? 'masuk' : 'keluar'] += nom; a.count++;
      }
      if (proj) {
        const p = out.proj[proj] || (out.proj[proj] = { masuk: 0, keluar: 0 });
        p[masuk ? 'masuk' : 'keluar'] += nom;
      }
      if (ym) {
        const m = out.month[ym] || (out.month[ym] = { masuk: 0, keluar: 0 });
        m[masuk ? 'masuk' : 'keluar'] += nom;
      }
      if (!masuk && (r[iTipe] === 'Pengeluaran' || r[iTipe] === 'Cicilan-Beli') && kat) out.katExp[kat] = (out.katExp[kat] || 0) + nom;
      out.count++;
    });
  }
  try { cache.put(SUMMARY_KEY, JSON.stringify(out), SUMMARY_TTL); } catch (e) {}
  return out;
}

function invalidateSummary() { try { CacheService.getScriptCache().remove(SUMMARY_KEY); } catch (e) {} }

// ── TXNS (since/until/rekening/limit) ────────────────────────
function getTxns(ss, params) {
  params = params || {};
  let data = getSheet(ss, S.TXN);
  if (params.since)    data = data.filter(t => String(t.TANGGAL) >= params.since);
  if (params.until)    data = data.filter(t => String(t.TANGGAL) <= params.until);
  if (params.rekening) data = data.filter(t => t.REKENING === params.rekening);
  if (params.project)  data = data.filter(t => t.PROJECT === params.project);
  data.sort((a, b) => String(b.TANGGAL).localeCompare(String(a.TANGGAL)));
  if (params.limit)    data = data.slice(0, Number(params.limit));
  return data;
}

function getAllData(ss) {
  return {
    banks: getSheet(ss, S.BANK), ccs: getSheet(ss, S.CC), projects: getSheet(ss, S.PROJ),
    kategori: getSheet(ss, S.KAT), txns: getSheet(ss, S.TXN),
    transfers: getSheet(ss, S.TRANSFER), reserves: getSheet(ss, S.RESERVE),
    kasbon: getSheet(ss, S.KASBON), jadwal: getSheet(ss, S.JADWAL),
    piutang: getSheet(ss, S.PIUTANG), cicilan: getSheet(ss, S.CICILAN),
    ccbills: getSheet(ss, S.CCBILL), marks: getSheet(ss, S.MARK), paidMarks: getSheet(ss, S.PAIDMARK),
    investAkun: getSheet(ss, S.INVEST), investLog: getSheet(ss, S.INVESTLOG), investValue: getSheet(ss, S.INVESTVAL),
  };
}

// Kolom tanggal di Sheets dibaca sbg objek Date (tengah malam zona Sheets).
// JSON.stringify mengubahnya jadi ISO UTC → tampil mundur 1 hari di app.
// Normalisasi: Date → 'yyyy-MM-dd' pakai zona waktu spreadsheet.
function normalizeCell(v, tz) {
  return (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v;
}

function getSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const tz = ss.getSpreadsheetTimeZone() || 'Asia/Jakarta';
  const data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = normalizeCell(row[i], tz); });
    return obj;
  });
}

function addRow(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  if (!data['ID']) row[0] = 'ID' + Date.now();
  const iCreated = headers.indexOf('CREATED_AT');
  if (iCreated >= 0 && !data['CREATED_AT']) row[iCreated] = new Date().toISOString();
  sheet.appendRow(row);
  return { ok: true, id: row[0] };
}

// ── v24 ADDENDUM: kerja tambah/kurang per project ──
// Murni ubah nilai kontrak EFEKTIF (dihitung client). TIDAK menulis TXN, TIDAK buat Piutang,
// TIDAK menyentuh laba/kas. Hapus pakai deleteRow generik (sheet=S.ADD, id). Auto-create sheet.
function addAddendum(ss, data) {
  const sh = ensureSheet(ss, S.ADD);
  const now = new Date().toISOString();
  const id = data.ID || ('ADD' + Date.now());
  const jenis = (data.JENIS === 'Kurang') ? 'Kurang' : 'Tambah';
  const o = {
    ID: id,
    PROJECT_ID: data.PROJECT_ID || '',
    PROJECT_NAMA: data.PROJECT_NAMA || '',
    TANGGAL: data.TANGGAL || now.slice(0, 10),
    JENIS: jenis,
    DESKRIPSI: data.DESKRIPSI || '',
    NOMINAL: Math.abs(Number(data.NOMINAL) || 0),
    CREATED_BY: data.USER || data.CREATED_BY || '',
    CREATED_AT: now,
  };
  sh.appendRow(HEADERS[S.ADD].map(h => o[h] !== undefined ? o[h] : ''));
  return { ok: true, id: id };
}

// ── IMPORT BATCH: banyak txn + master baru (proj/kat) sekali jalan ──
// data = { txns:[{TANGGAL,JENIS,PROJECT,REKENING,KATEGORI,NOMINAL,NOTES}],
//          newProjs:[{NAMA,KLIEN,STATUS}], newKats:[{NAMA,KELOMPOK,TIPE}], USER }
function addTxnBatch(ss, data) {
  const now = new Date().toISOString();
  const user = data.USER || 'Import';
  const out = { ok: true, txn: 0, proj: 0, kat: 0, projIds: {}, katIds: {} };

  // 1) Master PROJECT baru
  const newProjs = data.newProjs || [];
  if (newProjs.length) {
    const sh = ss.getSheetByName(S.PROJ);
    const H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const rows = newProjs.map((p, k) => {
      const id = 'PRI' + Date.now() + k;
      out.projIds[p.NAMA] = id;
      const o = { ID: id, NAMA: p.NAMA, KLIEN: p.KLIEN || '', TGL_MULAI: '',
                  STATUS: p.STATUS || 'Jalan', NILAI_CONTRACT: 0, CREATED_AT: now };
      return H.map(h => o[h] !== undefined ? o[h] : '');
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, H.length).setValues(rows);
    out.proj = rows.length;
  }

  // 2) Master KATEGORI baru
  const newKats = data.newKats || [];
  if (newKats.length) {
    const sh = ss.getSheetByName(S.KAT);
    const H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const rows = newKats.map((c, k) => {
      const id = 'KI' + Date.now() + k;
      out.katIds[c.NAMA] = id;
      const o = { ID: id, NAMA: c.NAMA, KELOMPOK: c.KELOMPOK || 'OPERASIONAL',
                  TIPE: c.TIPE || 'Pengeluaran', CREATED_AT: now };
      return H.map(h => o[h] !== undefined ? o[h] : '');
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, H.length).setValues(rows);
    out.kat = rows.length;
  }

  // 3) TRANSAKSI batch (setValues = 1 tulis)
  const txns = data.txns || [];
  if (txns.length) {
    const sh = ss.getSheetByName(S.TXN);
    const H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const rows = txns.map((t, k) => {
      const o = {
        ID: 'IMP' + Date.now() + k,
        TANGGAL: t.TANGGAL, JENIS: t.JENIS, PROJECT: t.PROJECT || '',
        REKENING: t.REKENING, KATEGORI: t.KATEGORI, NOMINAL: t.NOMINAL,
        NOTES: t.NOTES || '', TIPE_LOG: t.JENIS, CREATED_BY: user, CREATED_AT: now
      };
      return H.map(h => o[h] !== undefined ? o[h] : '');
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, H.length).setValues(rows);
    out.txn = rows.length;
  }
  return out;
}

function addTransfer(ss, data) {
  const refId = 'TR' + Date.now();
  const now = new Date().toISOString();
  const txnSheet = ss.getSheetByName(S.TXN);
  txnSheet.appendRow(['ID'+Date.now()+'A', data.TANGGAL, 'Pengeluaran', '', data.DARI, 'Transfer Keluar', data.NOMINAL, '[TRANSFER '+refId+'] ke '+data.KE+' '+data.NOTES, 'Transfer', data.USER, now]);
  Utilities.sleep(5);
  txnSheet.appendRow(['ID'+Date.now()+'B', data.TANGGAL, 'Pemasukan', '', data.KE, 'Transfer Masuk', data.NOMINAL, '[TRANSFER '+refId+'] dari '+data.DARI+' '+data.NOTES, 'Transfer', data.USER, now]);
  ss.getSheetByName(S.TRANSFER).appendRow(['ID'+Date.now(), data.TANGGAL, data.DARI, data.KE, data.NOMINAL, data.NOTES, refId, data.USER, now]);
  return { ok: true, refId };
}

// ⭐ v18: Reserve = uang NYATA yang diparkir di rekening penyimpan (holding), bukan pot virtual.
// Bayar tagihan CC pakai reserve → uang KELUAR dari rekening penyimpan terpilih (data.HOLDING):
// holding ↓ (Pengeluaran) + tagihan CC ↓ (Pemasukan ke CC) + earmark ↓ (RESERVE_LOG negatif).
function payCCReserve(ss, data) {
  const now = new Date().toISOString();
  const ref = 'PAYR' + Date.now();
  const amt = Math.abs(Number(data.NOMINAL) || 0);
  const hold = data.HOLDING || '';
  const tx = ss.getSheetByName(S.TXN);
  if (hold) tx.appendRow(['ID'+Date.now()+'H', data.TANGGAL, 'Pengeluaran', '', hold, 'Bayar CC', amt, '[BAYAR CC dari Reserve '+ref+'] '+data.CC+' (dari '+hold+') '+(data.NOTES||''), 'Reserve', data.USER, now]);
  Utilities.sleep(3);
  tx.appendRow(['ID'+Date.now(), data.TANGGAL, 'Pemasukan', '', data.CC, 'Bayar CC (Reserve)', amt, '[BAYAR CC dari Reserve '+ref+'] '+(data.NOTES||''), 'Reserve', data.USER, now]);
  ss.getSheetByName(S.RESERVE).appendRow(['ID'+Date.now()+'R', data.TANGGAL, '(release)', data.CC, -amt, 'Pakai reserve bayar CC (dari '+hold+') '+(data.NOTES||''), data.USER, now]);
  return { ok: true, ref: ref };
}

// ⭐ v18: Sisihkan reserve = TRANSFER NYATA dari bank sumber ke rekening penyimpan (HOLDING).
// source ↓ + holding ↑ (uang benar-benar pindah) + earmark per CC (RESERVE_LOG, holding di NOTES).
// Bila source == holding → tanpa TXN (uang sudah di situ), cukup earmark.
function addReserve(ss, data) {
  const now = new Date().toISOString();
  const ref = 'RSV' + Date.now();
  const src = data.DARI_REKENING || '';
  const hold = data.HOLDING || src;
  const cc = data.UNTUK_CC || '';
  const amt = Math.abs(Number(data.NOMINAL) || 0);
  const tx = ss.getSheetByName(S.TXN);
  if (src && hold && src !== hold) {
    tx.appendRow(['ID'+Date.now()+'S', data.TANGGAL, 'Pengeluaran', '', src, 'Reserve CC', amt, '[RESERVE '+ref+'] ke '+cc+' (simpan di '+hold+') '+(data.NOTES||''), 'Reserve', data.USER, now]);
    Utilities.sleep(3);
    tx.appendRow(['ID'+Date.now()+'H', data.TANGGAL, 'Pemasukan', '', hold, 'Reserve Masuk', amt, '[RESERVE '+ref+'] simpanan '+cc+' (dari '+src+') '+(data.NOTES||''), 'Reserve', data.USER, now]);
  }
  ss.getSheetByName(S.RESERVE).appendRow(['ID'+Date.now(), data.TANGGAL, src, cc, amt, '[HOLD:'+hold+'] '+(data.NOTES||''), data.USER, now]);
  return { ok: true, ref: ref };
}

// ⭐ v18 (opsional, sekali jalan): kreditkan saldo rekening penyimpan = total reserve berjalan.
// Dipakai bila ada sisa reserve model lama (virtual) supaya Net Cash (bank − reserve) tidak dobel.
function migrateReserveToHolding(ss, data) {
  const hold = String(data.HOLDING || '');
  if (!hold) return { error: 'HOLDING wajib' };
  const bankNames = getSheet(ss, S.BANK).map(b => b.NAMA);
  if (bankNames.indexOf(hold) < 0) return { error: 'Bank tidak dikenal: ' + hold };
  const total = getSheet(ss, S.RESERVE).reduce((s, r) => s + (Number(r.NOMINAL) || 0), 0);
  if (total <= 0) return { ok: true, credited: 0, note: 'Tidak ada reserve berjalan' };
  const now = new Date().toISOString();
  ss.getSheetByName(S.TXN).appendRow(['ID'+Date.now(), now.slice(0,10), 'Pemasukan', '', hold, 'Reserve Sync', total, '[SYNC RESERVE] kredit saldo penyimpan = total reserve berjalan', 'Reserve', data.USER||'', now]);
  return { ok: true, credited: total };
}

// KASBON karyawan. Ledger di sheet KASBON + (bila Tunai) gerak uang di TRANSAKSI.
// JENIS: 'Pinjam' (uang keluar) / 'Kembali' (uang masuk). METODE: 'Tunai' / 'Potong Gaji'.
// TIPE_LOG TXN = 'Kasbon' → tidak masuk laba/komposisi, tapi saldo rekening tetap akurat.
function addKasbon(ss, data) {
  const now = new Date().toISOString();
  const ref = 'KB' + Date.now();
  const amt = Math.abs(Number(data.NOMINAL) || 0);
  const metode = data.METODE || 'Tunai';
  let kb = ss.getSheetByName(S.KASBON);
  if (!kb) { kb = ss.insertSheet(S.KASBON); kb.appendRow(HEADERS[S.KASBON]); kb.getRange(1,1,1,HEADERS[S.KASBON].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff'); kb.setFrozenRows(1); }
  kb.appendRow(['ID'+Date.now(), data.TANGGAL, data.KARYAWAN, data.JENIS, amt, metode, data.REKENING||'', data.NOTES||'', ref, data.USER, now]);
  // Gerak uang selalu terjadi bila rekening dipilih.
  // Pinjam = uang keluar; Kembali (Tunai ATAU Potong Gaji) = uang masuk ke rekening.
  if (data.REKENING) {
    if (data.JENIS === 'Pinjam') {
      ss.getSheetByName(S.TXN).appendRow(['ID'+Date.now()+'K', data.TANGGAL, 'Pengeluaran', '', data.REKENING, 'Kasbon Keluar', amt, '[KASBON '+ref+'] pinjam '+data.KARYAWAN+' ('+metode+') '+(data.NOTES||''), 'Kasbon', data.USER, now]);
    } else {
      ss.getSheetByName(S.TXN).appendRow(['ID'+Date.now()+'K', data.TANGGAL, 'Pemasukan', '', data.REKENING, 'Kasbon Masuk', amt, '[KASBON '+ref+'] kembali '+data.KARYAWAN+' ('+metode+') '+(data.NOTES||''), 'Kasbon', data.USER, now]);
    }
  }
  return { ok: true, ref: ref };
}
// JADWAL: pemasukan/pengeluaran terjadwal untuk Cashflow Forecast.
// Murni proyeksi — TIDAK menulis ke TRANSAKSI & tidak mempengaruhi saldo/laba.
// Edit & hapus pakai action generik updateRow/deleteRow (sheet:'JADWAL').
function addJadwal(ss, data) {
  let sh = ss.getSheetByName(S.JADWAL);
  if (!sh) {
    sh = ss.insertSheet(S.JADWAL);
    sh.appendRow(HEADERS[S.JADWAL]);
    sh.getRange(1,1,1,HEADERS[S.JADWAL].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  const now = new Date().toISOString();
  const id = data.ID || ('JDW' + Date.now());
  const o = {
    ID: id, JENIS: data.JENIS, NAMA: data.NAMA || '', NOMINAL: Math.abs(Number(data.NOMINAL)||0),
    FREKUENSI: data.FREKUENSI || 'sekali', TGL: data.TGL || '',
    AKTIF: (data.AKTIF === undefined ? 1 : data.AKTIF), PROJECT: data.PROJECT || '',
    NOTES: data.NOTES || '', CREATED_BY: data.USER || data.CREATED_BY || '', CREATED_AT: now,
  };
  sh.appendRow(HEADERS[S.JADWAL].map(h => o[h] !== undefined ? o[h] : ''));
  return { ok: true, id: id };
}

// PIUTANG: termin kontrak klien. addPiutang hanya catat termin (belum gerak uang).
// Murni daftar tagihan + dipakai client utk Forecast. Saldo/laba belum terpengaruh.
function addPiutang(ss, data) {
  let sh = ss.getSheetByName(S.PIUTANG);
  if (!sh) {
    sh = ss.insertSheet(S.PIUTANG);
    sh.appendRow(HEADERS[S.PIUTANG]);
    sh.getRange(1,1,1,HEADERS[S.PIUTANG].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  const now = new Date().toISOString();
  const id = data.ID || ('PIU' + Date.now());
  const o = {
    ID: id, PROJECT: data.PROJECT || '', KLIEN: data.KLIEN || '', TERMIN: data.TERMIN || '',
    NOMINAL: Math.abs(Number(data.NOMINAL)||0), JATUH_TEMPO: data.JATUH_TEMPO || '',
    STATUS: data.STATUS || 'Belum', TGL_BAYAR: data.TGL_BAYAR || '', REKENING: data.REKENING || '',
    REF_ID: data.REF_ID || '', NOTES: data.NOTES || '',
    CREATED_BY: data.USER || data.CREATED_BY || '', CREATED_AT: now,
  };
  sh.appendRow(HEADERS[S.PIUTANG].map(h => o[h] !== undefined ? o[h] : ''));
  return { ok: true, id: id };
}

// Tandai termin Lunas: update baris PIUTANG (STATUS/TGL_BAYAR/REKENING/NOMINAL) +
// tulis 1 TXN Pemasukan nyata (KATEGORI 'Pelunasan', TIPE_LOG 'Pemasukan' → masuk
// laba & saldo project). NOMINAL boleh beda dari termin (klien bayar sebagian/lebih).
function payPiutang(ss, data) {
  const id = String(data.ID || '');
  if (!id) return { error: 'ID termin required' };
  const sh = ss.getSheetByName(S.PIUTANG);
  if (!sh || sh.getLastRow() <= 1) return { error: 'PIUTANG kosong' };
  const all = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const H = all[0];
  const iId = H.indexOf('ID');
  let rowIdx = -1;
  for (let i = 1; i < all.length; i++) if (String(all[i][iId]) === id) { rowIdx = i; break; }
  if (rowIdx < 0) return { error: 'Termin tidak ditemukan' };

  const now = new Date().toISOString();
  const ref = 'PAYP' + Date.now();
  const amt = Math.abs(Number(data.NOMINAL) || Number(all[rowIdx][H.indexOf('NOMINAL')]) || 0);
  const tgl = data.TGL_BAYAR || new Date().toISOString().slice(0,10);
  const rek = data.REKENING || '';
  const proj = all[rowIdx][H.indexOf('PROJECT')] || '';
  const termin = all[rowIdx][H.indexOf('TERMIN')] || '';
  if (!rek) return { error: 'Rekening tujuan wajib' };

  // 1) update baris PIUTANG
  const setCol = (key, val) => { const c = H.indexOf(key); if (c >= 0) all[rowIdx][c] = val; };
  setCol('STATUS', 'Lunas'); setCol('TGL_BAYAR', tgl); setCol('REKENING', rek);
  setCol('NOMINAL', amt); setCol('REF_ID', ref);
  sh.getRange(rowIdx + 1, 1, 1, H.length).setValues([all[rowIdx]]);

  // 2) pastikan kategori 'Pelunasan' ada di master (auto-buat bila belum)
  ensureKat(ss, 'Pelunasan', 'PEMASUKAN', 'Pemasukan');
  // 3) TXN Pemasukan nyata
  ss.getSheetByName(S.TXN).appendRow(['ID'+Date.now(), tgl, 'Pemasukan', proj, rek, 'Pelunasan', amt,
    '[PIUTANG '+ref+'] '+termin+' '+(data.NOTES||''), 'Pemasukan', data.USER||'', now]);
  return { ok: true, ref: ref };
}

// Pastikan 1 kategori ada di MASTER_KATEGORI; tambah bila belum (case-insensitive).
function ensureKat(ss, nama, kelompok, tipe) {
  const sh = ss.getSheetByName(S.KAT);
  if (!sh) return;
  const last = sh.getLastRow();
  if (last > 1) {
    const names = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    const iN = HEADERS[S.KAT].indexOf('NAMA');
    for (let i = 0; i < names.length; i++) {
      if (String(names[i][iN]).toLowerCase() === String(nama).toLowerCase()) return;
    }
  }
  sh.appendRow(['K'+Date.now(), kelompok, nama, tipe, new Date().toISOString()]);
}

// ── CICILAN KARTU KREDIT ─────────────────────────────────────
// Beli barang via CC yg dicicil. Model (PRD v17):
//  - Beban PENUH di muka: 2 TXN 'Cicilan-Beli' (pokok + bunga), REKENING KOSONG →
//    masuk laba/proj/komposisi, TIDAK menambah tagihan CC (acct di-skip krn rek kosong).
//  - Kas dialokasikan: RESERVE penuh (pokok+bunga) dari bank ke CC → bank turun, pot reserve naik.
//  - Tagihan cicilan = VIRTUAL (dihitung client dari TENOR_TERBAYAR). Tiap bulan payCicilan
//    melepas reserve (pot turun) + TENOR_TERBAYAR++. Bank & laba TIDAK disentuh lagi (sudah di muka).
function addCicilan(ss, data) {
  let sh = ss.getSheetByName(S.CICILAN);
  if (!sh) {
    sh = ss.insertSheet(S.CICILAN);
    sh.appendRow(HEADERS[S.CICILAN]);
    sh.getRange(1,1,1,HEADERS[S.CICILAN].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  const now = new Date().toISOString();
  const ref = 'CIC' + Date.now();
  const pokok = Math.abs(Number(data.NOMINAL_POKOK) || 0);
  const bunga = Math.abs(Number(data.BUNGA_TOTAL) || 0);
  const tenor = Math.max(1, Math.floor(Number(data.TENOR) || 1));
  const total = pokok + bunga;
  const perBulan = Math.round(total / tenor);
  const tglBeli = data.TGL_BELI || now.slice(0,10);
  const tglMulai = data.TGL_MULAI || tglBeli;
  const proj = data.PROJECT || '';
  const kat  = data.KATEGORI || 'Material';
  const cc   = data.CC || '';
  const bank = data.BANK || '';
  const desk = data.DESKRIPSI || '';
  const o = { ID:ref, TANGGAL_BELI:tglBeli, CC:cc, DESKRIPSI:desk, NOMINAL_POKOK:pokok,
              BUNGA_TOTAL:bunga, TENOR:tenor, NOMINAL_PER_BULAN:perBulan, TGL_MULAI:tglMulai,
              TENOR_TERBAYAR:0, STATUS:'Jalan', PROJECT:proj, KATEGORI:kat, REF_ID:ref,
              NOTES:data.NOTES||'', CREATED_BY:data.USER||'', CREATED_AT:now };
  sh.appendRow(HEADERS[S.CICILAN].map(h => o[h] !== undefined ? o[h] : ''));

  const tx = ss.getSheetByName(S.TXN);
  // beban pokok (REKENING kosong → tdk pengaruhi tagihan CC, tapi masuk proj/laba/komposisi)
  tx.appendRow(['ID'+Date.now()+'P', tglBeli, 'Pengeluaran', proj, '', kat, pokok,
    '[CICILAN '+ref+'] '+desk+' (pokok '+tenor+'x @ '+cc+')', 'Cicilan-Beli', data.USER||'', now]);
  if (bunga > 0) {
    ensureKat(ss, 'Bunga Cicilan', 'FINANCIAL', 'Pengeluaran');
    tx.appendRow(['ID'+Date.now()+'B', tglBeli, 'Pengeluaran', proj, '', 'Bunga Cicilan', bunga,
      '[CICILAN '+ref+'] bunga '+desk, 'Cicilan-Beli', data.USER||'', now]);
  }
  // reserve penuh dari bank sumber ke rekening penyimpan (HOLDING) — v18 transfer nyata
  const hold = data.HOLDING || bank;
  if (bank && cc) {
    if (bank !== hold) {
      tx.appendRow(['ID'+Date.now()+'R', tglBeli, 'Pengeluaran', '', bank, 'Reserve CC', total,
        '[RESERVE ke '+cc+'] [CICILAN '+ref+'] (simpan di '+hold+')', 'Reserve', data.USER||'', now]);
      Utilities.sleep(3);
      tx.appendRow(['ID'+Date.now()+'H', tglBeli, 'Pemasukan', '', hold, 'Reserve Masuk', total,
        '[RESERVE '+cc+'] [CICILAN '+ref+'] simpanan (dari '+bank+')', 'Reserve', data.USER||'', now]);
    }
    ss.getSheetByName(S.RESERVE).appendRow(['ID'+Date.now()+'RL', tglBeli, bank, cc, total,
      '[HOLD:'+hold+'] [CICILAN '+ref+'] '+desk, data.USER||'', now]);
  }
  return { ok:true, ref:ref, perBulan:perBulan };
}

// Bayar 1 angsuran (dipanggil dari alur Bayar CC). Melepas reserve sebesar angsuran
// (angsuran terakhir = sisa supaya pot habis pas) + TENOR_TERBAYAR++. Tanpa TXN/laba/bank.
function payCicilan(ss, data) {
  const id = String(data.ID || '');
  if (!id) return { error: 'ID cicilan required' };
  const sh = ss.getSheetByName(S.CICILAN);
  if (!sh || sh.getLastRow() <= 1) return { error: 'CICILAN kosong' };
  const all = sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
  const H = all[0]; const iId = H.indexOf('ID');
  let r = -1; for (let i=1;i<all.length;i++) if (String(all[i][iId])===id) { r=i; break; }
  if (r < 0) return { error: 'Cicilan tidak ditemukan' };
  const tenor = Number(all[r][H.indexOf('TENOR')]) || 1;
  let terbayar = Number(all[r][H.indexOf('TENOR_TERBAYAR')]) || 0;
  if (terbayar >= tenor) return { error: 'Cicilan sudah lunas' };
  const per   = Number(all[r][H.indexOf('NOMINAL_PER_BULAN')]) || 0;
  const total = (Number(all[r][H.indexOf('NOMINAL_POKOK')])||0) + (Number(all[r][H.indexOf('BUNGA_TOTAL')])||0);
  const cc = all[r][H.indexOf('CC')] || '';
  const amt = (terbayar === tenor - 1) ? (total - per*(tenor-1)) : per; // last = remainder
  const now = new Date().toISOString();
  const tgl = data.TANGGAL || now.slice(0,10);
  const hold = data.HOLDING || '';
  // v18: uang angsuran KELUAR dari rekening penyimpan terpilih
  if (hold) ss.getSheetByName(S.TXN).appendRow(['ID'+Date.now()+'H', tgl, 'Pengeluaran', '', hold, 'Bayar Cicilan', Math.abs(amt),
    '[CICILAN '+id+'] angsuran ke-'+(terbayar+1)+'/'+tenor+' (dari '+hold+')', 'Reserve', data.USER||'', now]);
  ss.getSheetByName(S.RESERVE).appendRow(['ID'+Date.now(), tgl, '(release)', cc, -Math.abs(amt),
    '[CICILAN '+id+'] bayar ke-'+(terbayar+1)+'/'+tenor+' (dari '+hold+')', data.USER||'', now]);
  terbayar++;
  all[r][H.indexOf('TENOR_TERBAYAR')] = terbayar;
  if (terbayar >= tenor) all[r][H.indexOf('STATUS')] = 'Lunas';
  sh.getRange(r+1, 1, 1, H.length).setValues([all[r]]);
  return { ok:true, terbayar:terbayar, tenor:tenor, amt:amt };
}

// Kunci tagihan CC hasil rekonsiliasi → pengingat jatuh tempo di dashboard.
// 1 baris AKTIF per kartu (lock baru menghapus yg lama utk kartu itu). Clear = deleteRow generik.
function lockCCBill(ss, data) {
  let sh = ss.getSheetByName(S.CCBILL);
  if (!sh) {
    sh = ss.insertSheet(S.CCBILL);
    sh.appendRow(HEADERS[S.CCBILL]);
    sh.getRange(1,1,1,HEADERS[S.CCBILL].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  const cc = String(data.CC || '');
  if (!cc) return { error: 'CC wajib' };
  // hapus baris lama utk kartu yg sama (dari bawah)
  if (sh.getLastRow() > 1) {
    const all = sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
    const iCC = all[0].indexOf('CC');
    for (let i = all.length - 1; i >= 1; i--) if (String(all[i][iCC]) === cc) sh.deleteRow(i + 1);
  }
  const now = new Date().toISOString();
  const id = 'CCB' + Date.now();
  const o = { ID:id, CC:cc, NOMINAL:Math.abs(Number(data.NOMINAL)||0), JATUH_TEMPO:data.JATUH_TEMPO||'',
              PERIODE_DARI:data.PERIODE_DARI||'', PERIODE_SAMPAI:data.PERIODE_SAMPAI||'',
              STATUS:'Aktif', CREATED_BY:data.USER||'', CREATED_AT:now };
  sh.appendRow(HEADERS[S.CCBILL].map(h => o[h] !== undefined ? o[h] : ''));
  return { ok:true, id:id };
}

// Pindahkan bank sumber reserve sebuah cicilan (atau reserve apa pun ber-REF) ke bank lain.
// Hanya mengubah baris setoran reserve: TXN 'Reserve CC' (REKENING) + RESERVE_LOG (DARI_REKENING).
// Efek: saldo bank lama balik (TXN-nya pindah ke bank baru), bank baru yg terpotong.
// Tidak menyentuh jumlah/cicilan/angsuran. ref = REF_ID cicilan (mis. 'CIC...').
function changeReserveBank(ss, data) {
  const ref = String(data.ref || '');
  const bankBaru = String(data.BANK || '');
  if (!ref || !bankBaru) return { error: 'ref & BANK wajib' };
  const bankNames = getSheet(ss, S.BANK).map(b => b.NAMA);
  if (bankNames.indexOf(bankBaru) < 0) return { error: 'Bank tidak dikenal: ' + bankBaru };
  let changed = false;
  // 1) TXN setoran reserve (KATEGORI 'Reserve CC', TIPE_LOG 'Reserve', NOTES memuat ref)
  const tx = ss.getSheetByName(S.TXN);
  if (tx && tx.getLastRow() > 1) {
    const all = tx.getRange(1,1,tx.getLastRow(),tx.getLastColumn()).getValues();
    const H = all[0];
    const iNotes=H.indexOf('NOTES'), iRek=H.indexOf('REKENING'), iKat=H.indexOf('KATEGORI'), iTipe=H.indexOf('TIPE_LOG');
    for (let i=1;i<all.length;i++) {
      if (String(all[i][iNotes]).indexOf(ref)>=0 && String(all[i][iKat])==='Reserve CC' && String(all[i][iTipe])==='Reserve') {
        all[i][iRek] = bankBaru;
        tx.getRange(i+1,1,1,H.length).setValues([all[i]]);
        changed = true;
      }
    }
  }
  // 2) RESERVE_LOG setoran (NOMINAL>0, NOTES memuat ref) → DARI_REKENING
  const rs = ss.getSheetByName(S.RESERVE);
  if (rs && rs.getLastRow() > 1) {
    const all = rs.getRange(1,1,rs.getLastRow(),rs.getLastColumn()).getValues();
    const H = all[0];
    const iNotes=H.indexOf('NOTES'), iDari=H.indexOf('DARI_REKENING'), iNom=H.indexOf('NOMINAL');
    for (let i=1;i<all.length;i++) {
      if (String(all[i][iNotes]).indexOf(ref)>=0 && Number(all[i][iNom])>0) {
        all[i][iDari] = bankBaru;
        rs.getRange(i+1,1,1,H.length).setValues([all[i]]);
      }
    }
  }
  if (!changed) return { error: 'Setoran reserve untuk cicilan ini tidak ditemukan' };
  return { ok:true };
}

// Konversi 1 transaksi CC (Pengeluaran biasa) menjadi cicilan — TANPA hapus/buat manual.
// TXN lama dipakai sbg beban pokok: REKENING dikosongkan + TIPE_LOG → 'Cicilan-Beli'
// (berhenti membebani tagihan CC, tetap jadi biaya project). Lalu buat reserve penuh +
// baris CICILAN (+ TXN bunga bila ada). Hasil = identik addCicilan, tapi reuse txn lama.
function convertTxnToCicilan(ss, data) {
  const id = String(data.txnId || data.ID || '');
  if (!id) return { error: 'txnId required' };
  const tx = ss.getSheetByName(S.TXN);
  if (!tx || tx.getLastRow() <= 1) return { error: 'TRANSAKSI kosong' };
  const all = tx.getRange(1,1,tx.getLastRow(),tx.getLastColumn()).getValues();
  const H = all[0];
  const iId=H.indexOf('ID'), iJns=H.indexOf('JENIS'), iProj=H.indexOf('PROJECT'),
        iRek=H.indexOf('REKENING'), iKat=H.indexOf('KATEGORI'), iNom=H.indexOf('NOMINAL'),
        iNotes=H.indexOf('NOTES'), iTipe=H.indexOf('TIPE_LOG'), iTgl=H.indexOf('TANGGAL');
  let r=-1; for (let i=1;i<all.length;i++) if (String(all[i][iId])===id) { r=i; break; }
  if (r<0) return { error: 'Transaksi tidak ditemukan' };
  const cc = String(all[r][iRek]||'');
  // validasi: harus Pengeluaran biasa di kartu kredit
  if (String(all[r][iJns])!=='Pengeluaran') return { error: 'Hanya transaksi Pengeluaran bisa dijadikan cicilan' };
  if (String(all[r][iTipe])!=='Pengeluaran') return { error: 'Transaksi ini bukan pengeluaran biasa (transfer/reserve/cicilan)' };
  const ccNames = getSheet(ss, S.CC).map(c => c.NAMA);
  if (ccNames.indexOf(cc) < 0) return { error: 'Rekening transaksi bukan kartu kredit' };

  const pokok = Math.abs(Number(all[r][iNom]) || 0);
  const bunga = Math.abs(Number(data.BUNGA_TOTAL) || 0);
  const tenor = Math.max(1, Math.floor(Number(data.TENOR) || 1));
  const total = pokok + bunga;
  const perBulan = Math.round(total / tenor);
  const proj = String(all[r][iProj]||'');
  const kat  = String(all[r][iKat]||'Material');
  const now = new Date().toISOString();
  const ref = 'CIC' + Date.now();
  const tglBeli = normalizeCell(all[r][iTgl], ss.getSpreadsheetTimeZone()||'Asia/Jakarta');
  const tglMulai = data.TGL_MULAI || tglBeli;
  const bank = data.BANK || '';
  const desk = String(all[r][iNotes]||'') || ('Konversi ' + kat);

  // 1) ubah TXN lama jadi beban Cicilan-Beli (REKENING kosong)
  all[r][iRek] = '';
  all[r][iTipe] = 'Cicilan-Beli';
  all[r][iNotes] = String(all[r][iNotes]||'') + ' [CICILAN '+ref+'] (konversi dari txn CC '+cc+')';
  tx.getRange(r+1, 1, 1, H.length).setValues([all[r]]);

  // 2) baris CICILAN
  let sh = ss.getSheetByName(S.CICILAN);
  if (!sh) {
    sh = ss.insertSheet(S.CICILAN);
    sh.appendRow(HEADERS[S.CICILAN]);
    sh.getRange(1,1,1,HEADERS[S.CICILAN].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  const o = { ID:ref, TANGGAL_BELI:tglBeli, CC:cc, DESKRIPSI:(data.DESKRIPSI||kat),
              NOMINAL_POKOK:pokok, BUNGA_TOTAL:bunga, TENOR:tenor, NOMINAL_PER_BULAN:perBulan,
              TGL_MULAI:tglMulai, TENOR_TERBAYAR:0, STATUS:'Jalan', PROJECT:proj, KATEGORI:kat,
              REF_ID:ref, NOTES:'(konversi) '+(data.NOTES||''), CREATED_BY:data.USER||'', CREATED_AT:now };
  sh.appendRow(HEADERS[S.CICILAN].map(h => o[h] !== undefined ? o[h] : ''));

  // 3) TXN bunga (bila ada)
  if (bunga > 0) {
    ensureKat(ss, 'Bunga Cicilan', 'FINANCIAL', 'Pengeluaran');
    tx.appendRow(['ID'+Date.now()+'B', tglBeli, 'Pengeluaran', proj, '', 'Bunga Cicilan', bunga,
      '[CICILAN '+ref+'] bunga (konversi)', 'Cicilan-Beli', data.USER||'', now]);
  }
  // 4) reserve penuh dari bank sumber ke rekening penyimpan (HOLDING) — v18
  const hold = data.HOLDING || bank;
  if (bank) {
    if (bank !== hold) {
      tx.appendRow(['ID'+Date.now()+'R', tglBeli, 'Pengeluaran', '', bank, 'Reserve CC', total,
        '[RESERVE ke '+cc+'] [CICILAN '+ref+'] (konversi, simpan di '+hold+')', 'Reserve', data.USER||'', now]);
      Utilities.sleep(3);
      tx.appendRow(['ID'+Date.now()+'H', tglBeli, 'Pemasukan', '', hold, 'Reserve Masuk', total,
        '[RESERVE '+cc+'] [CICILAN '+ref+'] simpanan konversi (dari '+bank+')', 'Reserve', data.USER||'', now]);
    }
    ss.getSheetByName(S.RESERVE).appendRow(['ID'+Date.now()+'RL', tglBeli, bank, cc, total,
      '[HOLD:'+hold+'] [CICILAN '+ref+'] (konversi)', data.USER||'', now]);
  }
  return { ok:true, ref:ref, perBulan:perBulan };
}

// Hapus cicilan (hanya bila belum ada angsuran terbayar) + TXN & RESERVE_LOG terkait (via REF_ID).
function deleteCicilan(ss, data) {
  const id = String(data.id || data.ID || '');
  const sh = ss.getSheetByName(S.CICILAN);
  if (!sh || sh.getLastRow() <= 1) return { error: 'CICILAN kosong' };
  const all = sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
  const H = all[0]; const iId = H.indexOf('ID');
  let r = -1; for (let i=1;i<all.length;i++) if (String(all[i][iId])===id) { r=i; break; }
  if (r < 0) return { error: 'Cicilan tidak ditemukan' };
  if ((Number(all[r][H.indexOf('TENOR_TERBAYAR')])||0) > 0) return { error: 'Cicilan sudah berjalan, tidak bisa dihapus' };
  const ref = String(all[r][H.indexOf('REF_ID')] || id);
  sh.deleteRow(r + 1);
  const tx = ss.getSheetByName(S.TXN);
  if (tx && tx.getLastRow() > 1) {
    const a = tx.getRange(1,1,tx.getLastRow(),tx.getLastColumn()).getValues();
    const c = a[0].indexOf('NOTES');
    for (let i=a.length-1;i>=1;i--) if (String(a[i][c]).indexOf(ref)>=0) tx.deleteRow(i+1);
  }
  const rs = ss.getSheetByName(S.RESERVE);
  if (rs && rs.getLastRow() > 1) {
    const a = rs.getRange(1,1,rs.getLastRow(),rs.getLastColumn()).getValues();
    const c = a[0].indexOf('NOTES');
    for (let i=a.length-1;i>=1;i--) if (String(a[i][c]).indexOf(ref)>=0) rs.deleteRow(i+1);
  }
  return { ok:true };
}

// Hapus 1 entri kasbon (by REF_ID) + baris TXN terkait (NOTES memuat refId).
function deleteKasbon(ss, data) {
  const ref = String(data.refId || '');
  if (!ref) return { error: 'refId required' };
  const kb = ss.getSheetByName(S.KASBON);
  if (kb && kb.getLastRow() > 1) {
    const all = kb.getRange(1, 1, kb.getLastRow(), kb.getLastColumn()).getValues();
    const c = all[0].indexOf('REF_ID');
    for (let i = all.length - 1; i >= 1; i--) if (String(all[i][c]) === ref) kb.deleteRow(i + 1);
  }
  const tx = ss.getSheetByName(S.TXN);
  if (tx && tx.getLastRow() > 1) {
    const all = tx.getRange(1, 1, tx.getLastRow(), tx.getLastColumn()).getValues();
    const c = all[0].indexOf('NOTES');
    for (let i = all.length - 1; i >= 1; i--) if (String(all[i][c]).indexOf(ref) >= 0) tx.deleteRow(i + 1);
  }
  return { ok: true };
}

// Hapus 1 transfer = baris TRANSFER_LOG (by REF_ID) + 2 baris TRANSAKSI
// yang NOTES-nya memuat refId. Hapus dari bawah agar index tidak bergeser.
function deleteTransfer(ss, data) {
  const refId = String(data.refId || '');
  if (!refId) return { error: 'refId required' };
  const tl = ss.getSheetByName(S.TRANSFER);
  if (tl && tl.getLastRow() > 1) {
    const all = tl.getRange(1, 1, tl.getLastRow(), tl.getLastColumn()).getValues();
    const c = all[0].indexOf('REF_ID');
    for (let i = all.length - 1; i >= 1; i--) if (String(all[i][c]) === refId) tl.deleteRow(i + 1);
  }
  const tx = ss.getSheetByName(S.TXN);
  if (tx && tx.getLastRow() > 1) {
    const all = tx.getRange(1, 1, tx.getLastRow(), tx.getLastColumn()).getValues();
    const c = all[0].indexOf('NOTES');
    for (let i = all.length - 1; i >= 1; i--) if (String(all[i][c]).indexOf(refId) >= 0) tx.deleteRow(i + 1);
  }
  return { ok: true };
}

function updateRow(ss, data) {
  const { sheet: sheetName, id, updates } = data;
  const sheet = ss.getSheetByName(sheetName);
  const all = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = all[0];
  const idCol = headers.indexOf('ID');
  for (let i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(id)) {
      Object.entries(updates).forEach(([key, val]) => {
        const col = headers.indexOf(key);
        if (col >= 0) all[i][col] = val;
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([all[i]]);
      return { ok: true };
    }
  }
  return { error: 'Row not found' };
}

function deleteRow(ss, data) {
  const { sheet: sheetName, id, cc } = data; // cc = fallback untuk CC_TAGIHAN
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: true }; // sheet tidak ada → anggap sudah terhapus
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: true }; // kosong / hanya header
  const all = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const idCol = all[0].indexOf('ID');
  if (idCol === -1) return { error: 'Kolom ID tidak ditemukan di sheet ' + sheetName };
  // Cari by ID dulu
  if (id) {
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][idCol]) === String(id)) { sheet.deleteRow(i + 1); return { ok: true }; }
    }
  }
  // Fallback: untuk CC_TAGIHAN, cari by CC name kalau ID tidak ketemu (state stale)
  if (cc && sheetName === S.CCBILL) {
    const ccCol = all[0].indexOf('CC');
    if (ccCol !== -1) {
      for (let i = all.length - 1; i >= 1; i--) {
        if (String(all[i][ccCol]) === String(cc)) { sheet.deleteRow(i + 1); return { ok: true }; }
      }
    }
  }
  return { ok: true }; // idempotent: row tidak ada = sudah terhapus
}

// ── v24: Pindahkan label PROJECT saat project dihapus (hapus project aman) ──
// Ganti kolom PROJECT dari `from` → `to` ('' = tanpa project) di TRANSAKSI/PIUTANG/CICILAN/JADWAL.
// HANYA mengubah label — TIDAK menyentuh nominal/saldo. ADDENDUM milik `from` DIHAPUS (spesifik
// project & bebas-uang; dipindah ke project lain malah merusak nilai kontrak project tujuan).
function reassignProject(ss, data) {
  const from = String(data.from || '');
  const to = String(data.to || '');
  if (!from) return { error: 'from kosong' };
  const out = { ok: true, from: from, to: to, txn: 0, piutang: 0, cicilan: 0, jadwal: 0, addendumDeleted: 0 };
  [['txn', S.TXN], ['piutang', S.PIUTANG], ['cicilan', S.CICILAN], ['jadwal', S.JADWAL]].forEach(function (pair) {
    const key = pair[0], name = pair[1];
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() <= 1) return;
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const pcol = headers.indexOf('PROJECT');
    if (pcol < 0) return;
    const rng = sh.getRange(2, pcol + 1, sh.getLastRow() - 1, 1);
    const vals = rng.getValues();
    let changed = 0;
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === from) { vals[i][0] = to; changed++; }
    }
    if (changed) { rng.setValues(vals); out[key] = changed; }
  });
  // ADDENDUM milik project ini → hapus (dari bawah)
  const sa = ss.getSheetByName(S.ADD);
  if (sa && sa.getLastRow() > 1) {
    const all = sa.getRange(1, 1, sa.getLastRow(), sa.getLastColumn()).getValues();
    const ncol = all[0].indexOf('PROJECT_NAMA');
    if (ncol >= 0) {
      for (let i = all.length - 1; i >= 1; i--) {
        if (String(all[i][ncol]) === from) { sa.deleteRow(i + 1); out.addendumDeleted++; }
      }
    }
  }
  return out;
}

// ── v20: penanda manual reserve per transaksi + util kolom ──────────────────
// Tambah header kolom `col` di akhir sheet bila belum ada (migrasi ringan, idempotent).
function ensureCol(ss, name, col) {
  const sh = ss.getSheetByName(name); if (!sh) return;
  const lastCol = sh.getLastColumn();
  const hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (hdr.indexOf(col) === -1) sh.getRange(1, lastCol + 1).setValue(col);
}
// Centang: catat TXN_ID sbg "sudah dibuatkan reserve" (idempotent). Lepas dari pot reserve.
function markTxn(ss, data) {
  let sh = ss.getSheetByName(S.MARK);
  if (!sh) { sh = ss.insertSheet(S.MARK); sh.appendRow(HEADERS[S.MARK]); sh.getRange(1,1,1,HEADERS[S.MARK].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff'); sh.setFrozenRows(1); }
  if (sh.getLastRow() > 1) {
    const ids = sh.getRange(2, 2, sh.getLastRow()-1, 1).getValues().map(r => String(r[0]));
    if (ids.indexOf(String(data.TXN_ID)) >= 0) return { ok: true, dup: true };
  }
  sh.appendRow(['ID'+Date.now(), data.TXN_ID, data.CC || '', Math.abs(Number(data.NOMINAL)||0), data.USER || '', new Date().toISOString()]);
  return { ok: true };
}
// Lepas centang: hapus baris RESERVE_MARK by TXN_ID.
function unmarkTxn(ss, data) {
  const sh = ss.getSheetByName(S.MARK);
  if (!sh || sh.getLastRow() <= 1) return { ok: true };
  const all = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const iTxn = all[0].indexOf('TXN_ID');
  for (let i = 1; i < all.length; i++) {
    if (String(all[i][iTxn]) === String(data.TXN_ID)) { sh.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: true };
}

// ── v23: penanda "lunas" per transaksi CC (murni filter tampilan, lepas dari tagihan) ──
function _ensurePaidSheet(ss) {
  let sh = ss.getSheetByName(S.PAIDMARK);
  if (!sh) {
    sh = ss.insertSheet(S.PAIDMARK);
    sh.appendRow(HEADERS[S.PAIDMARK]);
    sh.getRange(1,1,1,HEADERS[S.PAIDMARK].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}
// Tandai lunas (idempotent: skip bila sudah ada).
function markPaid(ss, data) {
  const sh = _ensurePaidSheet(ss);
  if (sh.getLastRow() > 1) {
    const ids = sh.getRange(2, 2, sh.getLastRow()-1, 1).getValues().map(r => String(r[0]));
    if (ids.indexOf(String(data.TXN_ID)) >= 0) return { ok: true, dup: true };
  }
  sh.appendRow(['ID'+Date.now(), data.TXN_ID, data.USER || '', new Date().toISOString()]);
  return { ok: true };
}
// Tandai lunas banyak sekaligus (tombol massal "s/d transaksi ini"). 1 request.
function markPaidBatch(ss, data) {
  const sh = _ensurePaidSheet(ss);
  let existing = [];
  if (sh.getLastRow() > 1) existing = sh.getRange(2, 2, sh.getLastRow()-1, 1).getValues().map(r => String(r[0]));
  const ids = (data.TXN_IDS || []).map(String).filter(id => existing.indexOf(id) < 0);
  if (!ids.length) return { ok: true, added: 0 };
  const now = new Date().toISOString(), user = data.USER || '';
  const rows = ids.map(id => ['ID'+Date.now()+'_'+id, id, user, now]);
  sh.getRange(sh.getLastRow()+1, 1, rows.length, HEADERS[S.PAIDMARK].length).setValues(rows);
  return { ok: true, added: rows.length };
}
// Lepas tanda lunas by TXN_ID.
function unmarkPaid(ss, data) {
  const sh = ss.getSheetByName(S.PAIDMARK);
  if (!sh || sh.getLastRow() <= 1) return { ok: true };
  const all = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const iTxn = all[0].indexOf('TXN_ID');
  for (let i = 1; i < all.length; i++) {
    if (String(all[i][iTxn]) === String(data.TXN_ID)) { sh.deleteRow(i + 1); return { ok: true }; }
  }
  return { ok: true };
}

// ── v21 INVESTASI (pribadi, terpisah total dari metrik bisnis) ───────────────
// Buat sheet bila belum ada (pola header bold + frozen, idempotent).
function ensureSheet(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.getRange(1,1,1,HEADERS[name].length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Tambah akun investasi (Stockbit/Pluang/Indo Premier/dll). MODAL_AWAL = modal yg sudah
// tertanam sebelum mulai catat di FCC (opsional). Edit/hapus pakai updateRow/deleteRow generik.
function addInvestAkun(ss, data) {
  const sh = ensureSheet(ss, S.INVEST);
  const now = new Date().toISOString();
  const id = data.ID || ('INV' + Date.now());
  const o = { ID:id, NAMA:data.NAMA||'', PLATFORM:data.PLATFORM||'', JENIS:data.JENIS||'',
              MODAL_AWAL:Math.abs(Number(data.MODAL_AWAL)||0), CREATED_AT:now };
  sh.appendRow(HEADERS[S.INVEST].map(h => o[h] !== undefined ? o[h] : ''));
  return { ok:true, id:id };
}

// Catat setor/tarik modal. Bila REKENING = bank FCC (bukan '(luar)') → tulis 1 TXN
// TIPE_LOG 'Investasi' (saldo bank turun/naik nyata, TAPI dikecualikan dari laba & komposisi
// karena katExp hanya menghitung 'Pengeluaran'/'Cicilan-Beli'). Bila '(luar)' → hanya log,
// tak menyentuh bank (modal dari kas pribadi di luar FCC). Nilai portofolio TIDAK pernah
// dihitung sbg kas — itu murni snapshot di INVEST_VALUE.
function addInvestFlow(ss, data) {
  const sh = ensureSheet(ss, S.INVESTLOG);
  const now = new Date().toISOString();
  const ref = data.REF_ID || ('IVF' + Date.now());
  const amt = Math.abs(Number(data.NOMINAL)||0);
  const jenis = (data.JENIS === 'Tarik') ? 'Tarik' : 'Setor';
  const akun = data.AKUN || '';
  const rek = data.REKENING || '';
  const tgl = data.TANGGAL || now.slice(0,10);
  const realBank = rek && rek !== '(luar)';
  sh.appendRow(['ID'+Date.now(), tgl, akun, jenis, rek, amt, data.NOTES||'', ref, data.USER||'', now]);
  if (realBank) {
    const tx = ss.getSheetByName(S.TXN);
    if (jenis === 'Setor') {
      tx.appendRow(['ID'+Date.now()+'I', tgl, 'Pengeluaran', '', rek, 'Setor Investasi', amt,
        '[INVEST '+ref+'] setor ke '+akun+' '+(data.NOTES||''), 'Investasi', data.USER||'', now]);
    } else {
      tx.appendRow(['ID'+Date.now()+'I', tgl, 'Pemasukan', '', rek, 'Tarik Investasi', amt,
        '[INVEST '+ref+'] tarik dari '+akun+' '+(data.NOTES||''), 'Investasi', data.USER||'', now]);
    }
  }
  return { ok:true, ref:ref };
}

// Simpan snapshot nilai portofolio sebuah akun pada tanggal tertentu (input manual).
// Snapshot termuda per akun = nilai kini (dihitung client). Hapus pakai deleteRow generik.
function addInvestValue(ss, data) {
  const sh = ensureSheet(ss, S.INVESTVAL);
  const now = new Date().toISOString();
  const id = data.ID || ('IVV' + Date.now());
  const o = { ID:id, TANGGAL:data.TANGGAL||now.slice(0,10), AKUN:data.AKUN||'',
              NILAI:Math.abs(Number(data.NILAI)||0), NOTES:data.NOTES||'',
              CREATED_BY:data.USER||'', CREATED_AT:now };
  sh.appendRow(HEADERS[S.INVESTVAL].map(h => o[h] !== undefined ? o[h] : ''));
  return { ok:true, id:id };
}

// Hapus 1 arus kas investasi (by REF_ID) + TXN terkait (NOTES memuat ref). Dari bawah.
function deleteInvestFlow(ss, data) {
  const ref = String(data.refId || data.REF_ID || '');
  if (!ref) return { error:'refId required' };
  const sh = ss.getSheetByName(S.INVESTLOG);
  if (sh && sh.getLastRow() > 1) {
    const all = sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
    const c = all[0].indexOf('REF_ID');
    for (let i=all.length-1;i>=1;i--) if (String(all[i][c])===ref) sh.deleteRow(i+1);
  }
  const tx = ss.getSheetByName(S.TXN);
  if (tx && tx.getLastRow() > 1) {
    const all = tx.getRange(1,1,tx.getLastRow(),tx.getLastColumn()).getValues();
    const c = all[0].indexOf('NOTES');
    for (let i=all.length-1;i>=1;i--) if (String(all[i][c]).indexOf(ref)>=0) tx.deleteRow(i+1);
  }
  return { ok:true };
}

// ── v26 POCKET FOREX ─────────────────────────────────────────
// Konversi Rp↔valas. Beli = Rp→valas (bank TURUN nyata); Jual = valas→Rp (bank NAIK nyata).
// Tulis 1 baris FOREX_LOG + 1 TXN TIPE_LOG 'Forex' → dikecualikan dari laba/komposisi/forecast
// (katExp & metrik hanya hitung TIPE_LOG 'Pengeluaran'/'Cicilan-Beli'), tapi saldo bank tetap akurat.
function addForexConvert(ss, data) {
  const sh = ensureSheet(ss, S.FOREX);
  const now = new Date().toISOString();
  const ref = data.REF_ID || ('FX' + Date.now());
  const jenis = (data.JENIS === 'Jual') ? 'Jual' : 'Beli';
  const mu = data.MATA_UANG || 'USD';
  const rek = data.REKENING || '';
  const valas = Math.abs(Number(data.JUMLAH_VALAS) || 0);
  const kurs = Math.abs(Number(data.KURS) || 0);
  const rp = Math.round(Math.abs(Number(data.NOMINAL_RP) || (valas * kurs)));
  const tgl = data.TANGGAL || now.slice(0, 10);
  if (!valas || !kurs || !rek) return { error: 'JUMLAH_VALAS, KURS, REKENING wajib' };

  sh.appendRow(['ID' + Date.now(), tgl, jenis, mu, rek, valas, kurs, rp, data.NOTES || '', ref, data.USER || '', now]);

  const tx = ss.getSheetByName(S.TXN);
  if (jenis === 'Beli') {
    tx.appendRow(['ID' + Date.now() + 'F', tgl, 'Pengeluaran', '', rek, 'Beli Valas', rp,
      '[FOREX ' + ref + '] beli ' + valas + ' ' + mu + ' @ ' + kurs + ' ' + (data.NOTES || ''), 'Forex', data.USER || '', now]);
  } else {
    tx.appendRow(['ID' + Date.now() + 'F', tgl, 'Pemasukan', '', rek, 'Jual Valas', rp,
      '[FOREX ' + ref + '] jual ' + valas + ' ' + mu + ' @ ' + kurs + ' ' + (data.NOTES || ''), 'Forex', data.USER || '', now]);
  }
  return { ok: true, ref: ref };
}

// Hapus 1 konversi forex (by REF_ID) + TXN terkait (NOTES memuat ref). Dari bawah ke atas.
function deleteForex(ss, data) {
  const ref = String(data.refId || data.REF_ID || '');
  if (!ref) return { error: 'refId required' };
  const sh = ss.getSheetByName(S.FOREX);
  if (sh && sh.getLastRow() > 1) {
    const all = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    const c = all[0].indexOf('REF_ID');
    for (let i = all.length - 1; i >= 1; i--) if (String(all[i][c]) === ref) sh.deleteRow(i + 1);
  }
  const tx = ss.getSheetByName(S.TXN);
  if (tx && tx.getLastRow() > 1) {
    const all = tx.getRange(1, 1, tx.getLastRow(), tx.getLastColumn()).getValues();
    const c = all[0].indexOf('NOTES');
    for (let i = all.length - 1; i >= 1; i--) if (String(all[i][c]).indexOf(ref) >= 0) tx.deleteRow(i + 1);
  }
  return { ok: true };
}

// ── v25 KURS BCA (e-Rate) ────────────────────────────────────
// Ambil kurs valas e-Rate dari halaman publik BCA, parse, tulis ke sheet KURS.
// Dipanggil otomatis harian (installKursTrigger) + bisa manual (action 'fetchKurs').
// PARSER tahan-banting: buang semua tag HTML → teks rata → cari KODE diikuti 2 angka
// format Indonesia (= e-Rate Beli & Jual, kolom pertama tabel). Selama urutan kolom
// e-Rate tetap yang pertama, parser tetap jalan walau markup berubah.
var KURS_MATA_UANG = ['USD','SGD','AUD','EUR'];   // BCA tak punya TWD. Ubah daftar ini bila perlu.
var KURS_URL = 'https://www.bca.co.id/id/informasi/kurs';

function fetchKursBCA() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ensureSheet(ss, S.KURS);   // SELALU buat tab KURS dulu — biar kelihatan + bisa didiagnosa
  var now = new Date().toISOString();
  var code = 0, exErr = '', body = '';

  try {
    var resp = UrlFetchApp.fetch(KURS_URL, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'id-ID,id;q=0.9'
      }
    });
    code = resp.getResponseCode();
    body = resp.getContentText();
  } catch (e) { exErr = e.message; }
  Logger.log('Kurs fetch → HTTP ' + code + (exErr ? ' | exception: ' + exErr : '') + ' | body length: ' + body.length);

  if (exErr || code !== 200) {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    sh.getRange(2, 1, 1, 5).setValues([['(GAGAL FETCH)', '', '', 'HTTP ' + code + (exErr ? ' ' + exErr : ''), now]]);
    return { error: 'BCA HTTP ' + code + (exErr ? ' | ' + exErr : '') };
  }

  // Normalisasi: tag → spasi, entity → spasi, rapatkan whitespace.
  var text = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ');
  var upd = '';
  var mU = text.match(/Terakhir diperbarui pada\s+(.+?WIB)/i);
  if (mU) upd = mU[1].trim();

  var numRe = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';
  var rows = KURS_MATA_UANG.map(function(c) {
    var m = text.match(new RegExp('\\b' + c + '\\b[^0-9]{0,80}' + numRe + '\\s+' + numRe));
    return m ? [c, idNum_(m[1]), idNum_(m[2]), upd, now] : [c, '', '', (upd ? upd + ' ' : '') + '(parse gagal)', now];
  });
  Logger.log('Kurs parsed: ' + JSON.stringify(rows));

  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  return { ok: true, updated: upd, count: rows.length, rows: rows };
}

// "17.830,00" → 17830 (Number). String kosong → ''.
function idNum_(s) {
  if (!s) return '';
  return Number(String(s).replace(/\./g, '').replace(',', '.'));
}

// Handler trigger: jalan tiap 10 menit, TAPI hanya fetch dalam jam 09:00–15:00 WIB.
// Di luar jam itu langsung lewati (hemat kuota & tak spam BCA). Manual refresh (action
// fetchKurs) tetap panggil fetchKursBCA langsung tanpa batas jam.
function kursAutoFetch() {
  var hm = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'HH:mm');
  var p = hm.split(':');
  var mins = parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  if (mins < 540 || mins > 900) return;   // 540=09:00, 900=15:00
  fetchKursBCA();
}

// Pasang trigger tiap 10 menit (efektif 09:00–15:00 WIB) + isi data awal.
// JALANKAN SEKALI dari editor Apps Script (akan hapus trigger kurs lama lalu pasang baru).
function installKursTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var f = t.getHandlerFunction();
    if (f === 'fetchKursBCA' || f === 'kursAutoFetch') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('kursAutoFetch').timeBased().everyMinutes(10).create();
  var r = fetchKursBCA();
  return 'Trigger kurs tiap 10 menit (aktif 09:00–15:00 WIB) terpasang. Fetch awal: ' + JSON.stringify(r);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
// v3 scalable backend

