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
};

const HEADERS = {
  [S.TXN]:      ['ID','TANGGAL','JENIS','PROJECT','REKENING','KATEGORI','NOMINAL','NOTES','TIPE_LOG','CREATED_BY','CREATED_AT'],
  [S.BANK]:     ['ID','NAMA','TIPE','BANK','SALDO_AWAL','CREATED_AT'],
  [S.CC]:       ['ID','NAMA','BANK','LIMIT','JATUH_TEMPO','CREATED_AT'],
  [S.PROJ]:     ['ID','NAMA','KLIEN','TGL_MULAI','STATUS','NILAI_CONTRACT','CREATED_AT'],
  [S.KAT]:      ['ID','KELOMPOK','NAMA','TIPE','CREATED_AT'],
  [S.TRANSFER]: ['ID','TANGGAL','DARI','KE','NOMINAL','NOTES','REF_ID','CREATED_BY','CREATED_AT'],
  [S.RESERVE]:  ['ID','TANGGAL','DARI_REKENING','UNTUK_CC','NOMINAL','NOTES','CREATED_BY','CREATED_AT'],
  [S.KASBON]:   ['ID','TANGGAL','KARYAWAN','JENIS','NOMINAL','METODE','REKENING','NOTES','REF_ID','CREATED_BY','CREATED_AT'],
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
      case 'addKat':      res = addRow(ss, S.KAT, data); break;
      case 'addTransfer': res = addTransfer(ss, data); break;
      case 'deleteTransfer': res = deleteTransfer(ss, data); break;
      case 'addReserve':  res = addReserve(ss, data); break;
      case 'payCCReserve': res = payCCReserve(ss, data); break;
      case 'addKasbon':   res = addKasbon(ss, data); break;
      case 'deleteKasbon':res = deleteKasbon(ss, data); break;
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
  return {
    banks:     getSheet(ss, S.BANK),
    ccs:       getSheet(ss, S.CC),
    projects:  getSheet(ss, S.PROJ),
    kategori:  getSheet(ss, S.KAT),
    transfers: getSheet(ss, S.TRANSFER),
    reserves:  getSheet(ss, S.RESERVE),
    kasbon:    getSheet(ss, S.KASBON),
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
      if (!masuk && r[iTipe] === 'Pengeluaran' && kat) out.katExp[kat] = (out.katExp[kat] || 0) + nom;
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
    kasbon: getSheet(ss, S.KASBON),
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

// Bayar tagihan CC memakai dana RESERVE yang sudah disisihkan.
// Uang sudah keluar dari bank saat reserve dibuat → di sini bank TIDAK disentuh.
// Efek: tagihan CC turun (Pemasukan ke CC) + pot reserve turun (RESERVE_LOG negatif).
function payCCReserve(ss, data) {
  const now = new Date().toISOString();
  const ref = 'PAYR' + Date.now();
  const amt = Math.abs(Number(data.NOMINAL) || 0);
  ss.getSheetByName(S.TXN).appendRow(['ID'+Date.now(), data.TANGGAL, 'Pemasukan', '', data.CC, 'Bayar CC (Reserve)', amt, '[BAYAR CC dari Reserve '+ref+'] '+(data.NOTES||''), 'Reserve', data.USER, now]);
  ss.getSheetByName(S.RESERVE).appendRow(['ID'+Date.now(), data.TANGGAL, '(release)', data.CC, -amt, 'Pakai reserve bayar CC '+(data.NOTES||''), data.USER, now]);
  return { ok: true, ref: ref };
}

function addReserve(ss, data) {
  const now = new Date().toISOString();
  ss.getSheetByName(S.TXN).appendRow(['ID'+Date.now(), data.TANGGAL, 'Pengeluaran', '', data.DARI_REKENING, 'Reserve CC', data.NOMINAL, '[RESERVE ke '+data.UNTUK_CC+'] '+data.NOTES, 'Reserve', data.USER, now]);
  ss.getSheetByName(S.RESERVE).appendRow(['ID'+Date.now(), data.TANGGAL, data.DARI_REKENING, data.UNTUK_CC, data.NOMINAL, data.NOTES, data.USER, now]);
  return { ok: true };
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
  const { sheet: sheetName, id } = data;
  const sheet = ss.getSheetByName(sheetName);
  const all = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const idCol = all[0].indexOf('ID');
  for (let i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(id)) { sheet.deleteRow(i + 1); return { ok: true }; }
  }
  return { error: 'Row not found' };
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

