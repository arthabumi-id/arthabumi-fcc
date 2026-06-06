// ===== Fungsi DISALIN dari index.html (apa adanya) =====
const TODAY='2026-06-06';
function today(){return TODAY;}
let state={summary:null, txns:[], cicilan:[], reserveFunds:{}, banks:[], ccs:[]};
const acctAgg = nama => (state.summary && state.summary.acct && state.summary.acct[nama]) || null;
function getSaldo(namaRek){
  const bank=state.banks.find(b=>b.NAMA===namaRek);
  const awal=bank?(Number(bank.SALDO_AWAL)||0):0;
  const a=acctAgg(namaRek);
  if(a) return {masuk:a.masuk||0,keluar:a.keluar||0,saldo:awal+(a.masuk||0)-(a.keluar||0)};
  const masuk=state.txns.filter(t=>t.REKENING===namaRek&&t.JENIS==='Pemasukan').reduce((s,t)=>s+Number(t.NOMINAL),0);
  const keluar=state.txns.filter(t=>t.REKENING===namaRek&&t.JENIS==='Pengeluaran').reduce((s,t)=>s+Number(t.NOMINAL),0);
  return {masuk,keluar,saldo:awal+masuk-keluar};
}
function getCCOut(namaCC){
  let base; const a=acctAgg(namaCC);
  if(a) base=(a.keluar||0)-(a.masuk||0);
  else{
    const tag=state.txns.filter(t=>t.REKENING===namaCC&&t.JENIS==='Pengeluaran').reduce((s,t)=>s+Number(t.NOMINAL),0);
    const bay=state.txns.filter(t=>t.REKENING===namaCC&&t.JENIS==='Pemasukan').reduce((s,t)=>s+Number(t.NOMINAL),0);
    base=tag-bay;
  }
  return base+cicilanDueAmt(namaCC);
}
function monthsElapsed(startISO){
  const s=String(startISO||'').slice(0,10); if(!s) return 0;
  const a=new Date(s+'T00:00:00'), b=new Date(today()+'T00:00:00');
  if(isNaN(a)) return 0;
  let m=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());
  if(b.getDate()<a.getDate()) m--;
  return Math.max(0,m);
}
function cicilanDueAmt(namaCC){
  return (state.cicilan||[]).filter(c=>c.CC===namaCC&&c.STATUS!=='Lunas').reduce((s,c)=>{
    const tenor=+c.TENOR||0,terbayar=+c.TENOR_TERBAYAR||0,per=+c.NOMINAL_PER_BULAN||0;
    const start=String(c.TGL_MULAI||c.TANGGAL_BELI||'').slice(0,10);
    const due=Math.min(tenor,monthsElapsed(start)+1);
    return s+per*Math.max(0,due-terbayar);
  },0);
}
function cicilanRemaining(namaCC){
  return (state.cicilan||[]).filter(c=>c.CC===namaCC&&c.STATUS!=='Lunas').reduce((s,c)=>{
    const tenor=+c.TENOR||0,terbayar=+c.TENOR_TERBAYAR||0,per=+c.NOMINAL_PER_BULAN||0;
    return s+per*Math.max(0,tenor-terbayar);
  },0);
}
function unreservedCC(namaCC){
  const cicNeed=Math.max(0,cicilanRemaining(namaCC));
  const regNeed=Math.max(0,getCCOut(namaCC)-cicilanDueAmt(namaCC));
  const res=state.reserveFunds[namaCC]||0;
  const cicRes=Math.min(res,cicNeed);
  const regRes=Math.max(0,res-cicNeed);
  const cicBelum=Math.max(0,cicNeed-cicRes);
  const regBelum=Math.max(0,regNeed-regRes);
  return {cicNeed,regNeed,cicBelum,regBelum,belum:cicBelum+regBelum};
}
const fmtS=n=>Math.round(n).toLocaleString('id');
function stripText(namaCC){
  const u=unreservedCC(namaCC); const out=[];
  if(u.cicNeed>0) out.push(`Cicilan ${fmtS(u.cicNeed)} — ${u.cicBelum<=0?'ter-reserve ✓':'belum '+fmtS(u.cicBelum)}`);
  if(u.regNeed>0) out.push(`Belanja lain ${fmtS(u.regNeed)} — ${u.regBelum<=0?'ter-reserve ✓':'belum '+fmtS(u.regBelum)}`);
  return out.length?out.join('  |  '):'(strip kosong)';
}

// ===== DATA ASLI KRIS dari Google Sheets DB =====
state.cicilan=[
 {CC:'CC-BCA-KRIS',STATUS:'Jalan',TENOR:3,TENOR_TERBAYAR:0,NOMINAL_PER_BULAN:1029584,TGL_MULAI:'2026-05-03'},
 {CC:'CC-BCA-KRIS',STATUS:'Jalan',TENOR:3,TENOR_TERBAYAR:0,NOMINAL_PER_BULAN:2802120,TGL_MULAI:'2026-05-18'},
 {CC:'CC-BCA-KRIS',STATUS:'Jalan',TENOR:3,TENOR_TERBAYAR:0,NOMINAL_PER_BULAN:2219147,TGL_MULAI:'2026-05-22'},
 {CC:'CC-BCA-KRIS',STATUS:'Jalan',TENOR:3,TENOR_TERBAYAR:0,NOMINAL_PER_BULAN:717100,TGL_MULAI:'2026-05-20'},
 {CC:'CC-BCA-KRIS',STATUS:'Jalan',TENOR:3,TENOR_TERBAYAR:0,NOMINAL_PER_BULAN:733050,TGL_MULAI:'2026-05-27'},
];
state.reserveFunds={'CC-BCA-KRIS':22503003};
state.txns=[
 {REKENING:'CC-BCA-KRIS',JENIS:'Pengeluaran',NOMINAL:164184},   // Palyja Apr
 {REKENING:'CC-BCA-KRIS',JENIS:'Pengeluaran',NOMINAL:405000},   // AXA May
 {REKENING:'CC-BCA-KRIS',JENIS:'Pengeluaran',NOMINAL:15000},    // Apple May
 {REKENING:'CC-BCA-KRIS',JENIS:'Pemasukan',  NOMINAL:44251790}, // Bayar CC May17 (Transfer)
 {REKENING:'CC-BCA-KRIS',JENIS:'Pengeluaran',NOMINAL:4754271},  // belanja Juni 1-5
];

console.log('=== KRIS (data asli) — today',TODAY,'===');
console.log('cicilanRemaining :', fmtS(cicilanRemaining('CC-BCA-KRIS')));
console.log('cicilanDueAmt    :', fmtS(cicilanDueAmt('CC-BCA-KRIS')));
console.log('getCCOut         :', fmtS(getCCOut('CC-BCA-KRIS')), '  (negatif = efek bayar Mei 44jt utk belanja yg sudah jadi cicilan)');
const u=unreservedCC('CC-BCA-KRIS');
console.log('unreservedCC     :', JSON.stringify(u,(k,v)=>typeof v==='number'?fmtS(v):v));
console.log('STRIP BARU       :', stripText('CC-BCA-KRIS'));
console.log('Dashboard belum  :', fmtS(u.belum));

console.log('\n=== UJI SKENARIO (cari bug) ===');
function scen(name, cic, res, txns){
  state.cicilan=cic; state.reserveFunds=res; state.txns=txns;
  return name.padEnd(42)+' → '+stripText(Object.keys(res)[0]||'CC-T');
}
function C(per,start){return {CC:'CC-T',STATUS:'Jalan',TENOR:3,TENOR_TERBAYAR:0,NOMINAL_PER_BULAN:per,TGL_MULAI:start};}
function P(n){return {REKENING:'CC-T',JENIS:'Pengeluaran',NOMINAL:n};}
function I(n){return {REKENING:'CC-T',JENIS:'Pemasukan',NOMINAL:n};}
console.log(scen('B. Cicilan12jt FUNDED + belanja3jt UNRESERVED',[C(4000000,'2026-06-01')],{'CC-T':12000000},[P(3000000)]));
console.log(scen('C. Cicilan15jt BELUM di-reserve (res 0)',[C(5000000,'2026-06-01')],{'CC-T':0},[]));
console.log(scen('D. Hanya belanja 2jt, reserve 0',[],{'CC-T':0},[P(2000000)]));
console.log(scen('E. Belanja 2jt, reserve 2jt (pas)',[],{'CC-T':2000000},[P(2000000)]));
console.log(scen('F. Kartu kosong (tdk ada apa2)',[],{'CC-T':0},[]));
console.log(scen('G. Over-reserve: belanja1jt, reserve5jt',[],{'CC-T':5000000},[P(1000000)]));
console.log(scen('H. Cicilan12jt res8jt (KURANG) + belanja2jt',[C(4000000,'2026-06-01')],{'CC-T':10000000},[P(2000000)]));

console.log('\n=== UJI SALDO BCA 552 (koreksi data) ===');
state.cicilan=[]; state.reserveFunds={}; state.summary=null;
state.banks=[{NAMA:'BCA 552',SALDO_AWAL:4937842}];
// transfers masuk (Pemasukan) + 4 cicilan booked Pengeluaran reserve dari 552 (model lama, phantom)
state.txns=[
 {REKENING:'BCA 552',JENIS:'Pemasukan',NOMINAL:20303853},
 {REKENING:'BCA 552',JENIS:'Pemasukan',NOMINAL:21743708},
 {REKENING:'BCA 552',JENIS:'Pemasukan',NOMINAL:421361},
 {REKENING:'BCA 552',JENIS:'Pemasukan',NOMINAL:4332910},
 {REKENING:'BCA 552',JENIS:'Pengeluaran',NOMINAL:20303853}, // phantom reserve-out (4 cicilan lama)
];
console.log('SEBELUM koreksi: saldo 552 =', fmtS(getSaldo('BCA 552').saldo), '(app)');
state.txns.push({REKENING:'BCA 552',JENIS:'Pemasukan',NOMINAL:20303853}); // KOREKSI
console.log('SESUDAH koreksi: saldo 552 =', fmtS(getSaldo('BCA 552').saldo), '(harus = fisik 51.719.674)');
