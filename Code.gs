// ============================================================
// FCC ARTHABUMI - Google Apps Script Backend
// Paste file ini ke: Google Sheets → Extensions → Apps Script
// Setelah paste, klik Deploy → New Deployment → Web App
// Execute as: Me | Who has access: Anyone
// ============================================================

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const VALID_PINS = ['1234', '5678', '9999']; // Ganti PIN sesuai kebutuhan

// ── SHEET NAMES ──────────────────────────────────────────────
const S = {
  TXN:      'TRANSAKSI',
  BANK:     'MASTER_BANK',
  CC:       'MASTER_CC',
  PROJ:     'MASTER_PROJECT',
  KAT:      'MASTER_KATEGORI',
  TRANSFER: 'TRANSFER_LOG',
  RESERVE:  'RESERVE_LOG',
};

// ── INIT SHEETS (jalankan sekali) ────────────────────────────
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const headers = {
    [S.TXN]:      ['ID','TANGGAL','JENIS','PROJECT','REKENING','KATEGORI','NOMINAL','NOTES','TIPE_LOG','CREATED_BY','CREATED_AT'],
    [S.BANK]:     ['ID','NAMA','TIPE','BANK','SALDO_AWAL','CREATED_AT'],
    [S.CC]:       ['ID','NAMA','BANK','LIMIT','JATUH_TEMPO','CREATED_AT'],
    [S.PROJ]:     ['ID','NAMA','KLIEN','TGL_MULAI','STATUS','NILAI_CONTRACT','CREATED_AT'],
    [S.KAT]:      ['ID','KELOMPOK','NAMA','TIPE','CREATED_AT'],
    [S.TRANSFER]: ['ID','TANGGAL','DARI','KE','NOMINAL','NOTES','REF_ID','CREATED_BY','CREATED_AT'],
    [S.RESERVE]:  ['ID','TANGGAL','DARI_REKENING','UNTUK_CC','NOMINAL','NOTES','CREATED_BY','CREATED_AT'],
  };

  Object.entries(headers).forEach(([name, cols]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(cols);
      sheet.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });

  // Seed master data jika kosong
  seedMasterData(ss);
  
  return { status: 'ok', message: 'Sheets initialized' };
}

function seedMasterData(ss) {
  const bankSheet = ss.getSheetByName(S.BANK);
  if (bankSheet.getLastRow() <= 1) {
    const banks = [
      ['RK01','BCA 082','Bank','BCA',0,new Date().toISOString()],
      ['RK02','BCA 552','Bank','BCA',0,new Date().toISOString()],
      ['RK03','SEABANK-EDDY','Bank','SeaBank',0,new Date().toISOString()],
      ['RK04','SEABANK-RONAH','Bank','SeaBank',0,new Date().toISOString()],
      ['RK05','CASH','Kas','Cash',0,new Date().toISOString()],
    ];
    banks.forEach(r => bankSheet.appendRow(r));
  }

  const ccSheet = ss.getSheetByName(S.CC);
  if (ccSheet.getLastRow() <= 1) {
    const ccs = [
      ['RK06','CC-BCA-KRIS','BCA',20000000,25,new Date().toISOString()],
      ['RK07','CC-BCA-JCB','BCA',30000000,25,new Date().toISOString()],
      ['RK08','CC-CIMB-JCB','CIMB',15000000,25,new Date().toISOString()],
      ['RK09','CC-CIMB-ACCOR','CIMB',10000000,25,new Date().toISOString()],
      ['RK10','CC-CIMB-WORLD','CIMB',0,25,new Date().toISOString()],
      ['RK11','CC-HSBC-7118','HSBC',0,25,new Date().toISOString()],
      ['RK12','CC-HSBC-VISA','HSBC',0,25,new Date().toISOString()],
      ['RK13','CC-MAYBANK-BMW','MAYBANK',0,25,new Date().toISOString()],
      ['RK14','CC-MAYBANK-INFINITE','MAYBANK',0,25,new Date().toISOString()],
      ['RK15','CC-BNI-JCB','BNI',0,25,new Date().toISOString()],
      ['RK16','CC-DANAMON-JCB','DANAMON',0,25,new Date().toISOString()],
    ];
    ccs.forEach(r => ccSheet.appendRow(r));
  }

  const katSheet = ss.getSheetByName(S.KAT);
  if (katSheet.getLastRow() <= 1) {
    const kats = [
      ['K01','PEMASUKAN','DP Project','Pemasukan'],
      ['K02','PEMASUKAN','Pelunasan','Pemasukan'],
      ['K03','PEMASUKAN','Fee Konsultasi','Pemasukan'],
      ['K04','PEMASUKAN','Bunga','Pemasukan'],
      ['K05','PEMASUKAN','Kas dari Novi','Pemasukan'],
      ['K06','PROJECT','Material','Pengeluaran'],
      ['K07','PROJECT','Gaji Tim','Pengeluaran'],
      ['K08','PROJECT','Gaji Herman','Pengeluaran'],
      ['K09','PROJECT','Transport','Pengeluaran'],
      ['K10','PROJECT','Subkontraktor','Pengeluaran'],
      ['K11','OPERASIONAL','Bensin Fino','Pengeluaran'],
      ['K12','OPERASIONAL','Internet','Pengeluaran'],
      ['K13','PRIBADI','Makan','Pengeluaran'],
      ['K14','PRIBADI','Asuransi','Pengeluaran'],
      ['K15','FINANCIAL','Pajak','Pengeluaran'],
      ['K16','FINANCIAL','Admin Bank','Pengeluaran'],
    ];
    kats.forEach(r => katSheet.appendRow([...r, new Date().toISOString()]));
  }
}

// ── HTTP HANDLER ──────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || '';
  const pin = e.parameter.pin || '';
  
  if (!VALID_PINS.includes(pin) && action !== 'ping') {
    return json({ error: 'Unauthorized', code: 401 });
  }
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    switch(action) {
      case 'ping':       return json({ ok: true, version: '2.0' });
      case 'getAll':     return json(getAllData(ss));
      case 'getBanks':   return json(getSheet(ss, S.BANK));
      case 'getCCs':     return json(getSheet(ss, S.CC));
      case 'getProjs':   return json(getSheet(ss, S.PROJ));
      case 'getKats':    return json(getSheet(ss, S.KAT));
      case 'getTxns':    return json(getSheet(ss, S.TXN));
      case 'getTransfers': return json(getSheet(ss, S.TRANSFER));
      case 'getReserves':  return json(getSheet(ss, S.RESERVE));
      default:           return json({ error: 'Unknown action' });
    }
  } catch(err) {
    return json({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, pin, data } = body;
    
    if (!VALID_PINS.includes(pin)) {
      return json({ error: 'Unauthorized', code: 401 });
    }
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    switch(action) {
      case 'addTxn':      return json(addRow(ss, S.TXN, data));
      case 'addBank':     return json(addRow(ss, S.BANK, data));
      case 'addCC':       return json(addRow(ss, S.CC, data));
      case 'addProj':     return json(addRow(ss, S.PROJ, data));
      case 'addKat':      return json(addRow(ss, S.KAT, data));
      case 'addTransfer': return json(addTransfer(ss, data));
      case 'addReserve':  return json(addReserve(ss, data));
      case 'updateRow':   return json(updateRow(ss, data));
      case 'deleteRow':   return json(deleteRow(ss, data));
      case 'init':        return json(initSheets());
      default:            return json({ error: 'Unknown action' });
    }
  } catch(err) {
    return json({ error: err.message });
  }
}

// ── DATA HELPERS ──────────────────────────────────────────────
function getAllData(ss) {
  return {
    banks:     getSheet(ss, S.BANK),
    ccs:       getSheet(ss, S.CC),
    projects:  getSheet(ss, S.PROJ),
    kategori:  getSheet(ss, S.KAT),
    txns:      getSheet(ss, S.TXN),
    transfers: getSheet(ss, S.TRANSFER),
    reserves:  getSheet(ss, S.RESERVE),
  };
}

function getSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function addRow(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  if (!data['ID']) row[0] = 'ID' + Date.now();
  if (!data['CREATED_AT']) row[headers.indexOf('CREATED_AT')] = new Date().toISOString();
  sheet.appendRow(row);
  return { ok: true, id: row[0] };
}

function addTransfer(ss, data) {
  const refId = 'TR' + Date.now();
  const now = new Date().toISOString();
  const txnSheet = ss.getSheetByName(S.TXN);
  const tSheet = ss.getSheetByName(S.TRANSFER);
  
  // Catat 2 transaksi
  txnSheet.appendRow(['ID'+Date.now()+'A', data.TANGGAL, 'Pengeluaran', '', data.DARI, 'Transfer Keluar', data.NOMINAL, '[TRANSFER '+refId+'] → '+data.KE+' '+data.NOTES, 'Transfer', data.USER, now]);
  Utilities.sleep(10);
  txnSheet.appendRow(['ID'+Date.now()+'B', data.TANGGAL, 'Pemasukan', '', data.KE, 'Transfer Masuk', data.NOMINAL, '[TRANSFER '+refId+'] ← '+data.DARI+' '+data.NOTES, 'Transfer', data.USER, now]);
  
  // Log transfer
  tSheet.appendRow(['ID'+Date.now(), data.TANGGAL, data.DARI, data.KE, data.NOMINAL, data.NOTES, refId, data.USER, now]);
  
  return { ok: true, refId };
}

function addReserve(ss, data) {
  const now = new Date().toISOString();
  const txnSheet = ss.getSheetByName(S.TXN);
  const rSheet = ss.getSheetByName(S.RESERVE);
  
  // Catat sebagai pengeluaran dari bank
  txnSheet.appendRow(['ID'+Date.now(), data.TANGGAL, 'Pengeluaran', '', data.DARI_REKENING, 'Reserve CC', data.NOMINAL, '[RESERVE → '+data.UNTUK_CC+'] '+data.NOTES, 'Reserve', data.USER, now]);
  
  // Log reserve
  rSheet.appendRow(['ID'+Date.now(), data.TANGGAL, data.DARI_REKENING, data.UNTUK_CC, data.NOMINAL, data.NOTES, data.USER, now]);
  
  return { ok: true };
}

function updateRow(ss, data) {
  const { sheet: sheetName, id, updates } = data;
  const sheet = ss.getSheetByName(sheetName);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('ID');
  
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      Object.entries(updates).forEach(([key, val]) => {
        const col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(val);
      });
      return { ok: true };
    }
  }
  return { error: 'Row not found' };
}

function deleteRow(ss, data) {
  const { sheet: sheetName, id } = data;
  const sheet = ss.getSheetByName(sheetName);
  const allData = sheet.getDataRange().getValues();
  const idCol = allData[0].indexOf('ID');
  
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Row not found' };
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
