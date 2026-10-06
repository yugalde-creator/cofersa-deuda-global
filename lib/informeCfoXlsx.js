/**
 * Informe mensual de deuda para el CFO (Excel): Resumen ejecutivo · Detalle · Vencimientos 12m · Intereses · Conciliación.
 * Datos: planes de pago del Sheet + pagos reales conciliados (lib/intereses.js). El saldo al cierre cuenta cada cuota
 * en la fecha en que el banco la aplicó (pagos adelantados del último día del mes incluidos).
 */
const ExcelJS = require('exceljs');
const I = require('./intereses');
const { leerHistorial, guardarSnapshot, per: periodoDe } = require('./historicoTasa');
const { CONDICION, GARANTIA } = require('./condiciones');

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ABR = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

/** Devuelve { buffer, filename, resumen } del mes indicado (por defecto el mes anterior). */
async function generarInformeCfoXlsx(anio, mes, opts = {}) {
  if (!anio || !mes) {
    const h = new Date();
    if (h.getMonth() === 0) { anio = h.getFullYear() - 1; mes = 12; } else { anio = h.getFullYear(); mes = h.getMonth(); }
  }
  const ANIO = anio, MES = mes;
  const { readRows, SHEETS, fmtDate } = require('./sheets');
  const { readPP, parseMonto } = require('./backend');
  const [activas, pagosProg, leasing, leasingPagos, historicos, canceladas, bancosRows, cfgRows] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readPP(), readRows(SHEETS.LEASING), readRows(SHEETS.LEASING_PAGOS),
    readRows(SHEETS.PAGOS_HIST), readRows(SHEETS.CANCELADAS), readRows(SHEETS.BANCOS), readRows(SHEETS.CONFIG),
  ]);
  const bancosLim = Object.fromEntries(bancosRows.map(b => [b.Banco, parseMonto(b.LimiteUSD)]));
  // BCT y BCT-BBI son la misma línea de crédito de BCT (en el Sheet van separadas): se suman en BCT.
  Object.keys(bancosLim).forEach(k => { if (/^BCT[-\s]/i.test(k)) { bancosLim.BCT = (bancosLim.BCT || 0) + bancosLim[k]; delete bancosLim[k]; } });
  const cfg = Object.fromEntries(cfgRows.map(c => [c.Clave, c.Valor]));
  const TC = parseMonto(cfg.TipoCambioUSD) || 455;
  const inst = I.armarInstrumentos({ activas, pagosProg, leasing, leasingPagos, historicos, canceladas }, parseMonto, fmtDate);
  const activasPorOp = Object.fromEntries(activas.map(a => [(a.NumOp || '').toString().replace(/^'/, ''), a]));

// ---------- cálculo por operación ----------
const D1 = new Date(ANIO, MES - 1, 1), FIN = new Date(ANIO, MES, 0), PREV = new Date(ANIO, MES - 1, 0), FINX = new Date(ANIO, MES, 1);
const efec = x => ((x.estado === 'Pagado' || x.estado === 'Conciliado') && x.fechaReal) ? new Date(x.fechaReal + 'T00:00:00') : x.fecha; // fecha en que el banco aplicó el pago
const sumCap = (c, hasta, desde) => c.cuotas.filter(x => x.fecha && efec(x) <= hasta && (!desde || efec(x) >= desde)).reduce((s, x) => s + x.capital, 0);
const r2 = n => Math.round(n * 100) / 100;
const rows = [];
inst.filter(i => i.tipo !== 'Cancelada').forEach(i => {
  if (i.inicio && i.inicio > FIN) return;
  const saldoFin = Math.max(r2(i.aprobado - sumCap(i, FIN)), 0);
  const desemb = (i.inicio && i.inicio >= D1 && i.inicio <= FIN) ? i.aprobado : 0;
  const saldoIni = (i.inicio && i.inicio > PREV) ? 0 : Math.max(r2(i.aprobado - sumCap(i, PREV)), 0);
  const amort = r2(sumCap(i, FIN, D1));
  if (saldoFin < 0.5 && saldoIni < 0.5 && !desemb) return;
  const cu = i.cuotas.filter(x => x.fecha).sort((a, b) => a.fecha - b.fecha);
  const prox = cu.find(x => efec(x) > FIN && x.capital + x.interes > 0);
  const last = cu[cu.length - 1];
  rows.push({ banco: i.banco, tipo: i.tipo === 'Leasing' ? 'Leasing' : 'Pagaré', op: i.op, mon: i.moneda, aprobado: i.aprobado, inicio: i.inicio, vcto: last ? last.fecha : null, tasa: i.tasa, cond: i.tipo === 'Leasing' ? 'Leasing' : (CONDICION[i.op] || ''), garantia: (activasPorOp[i.op] || {}).Garantia, saldoIni, desemb, amort, saldoFin, prox, inst: i, banksaldo: undefined });
});
const ordenBanco = { BCT: 1, Davivienda: 2, BAC: 3, BCR: 4 };
rows.sort((a, b) => (ordenBanco[a.banco] || 9) - (ordenBanco[b.banco] || 9) || (a.mon === b.mon ? 0 : a.mon === 'USD' ? -1 : 1) || a.vcto - b.vcto);
const cancelAmort = { CRC: 0, USD: 0 }; inst.filter(i => i.tipo === 'Cancelada').forEach(i => i.cuotas.forEach(c => { if (c.fecha >= D1 && c.fecha < FINX) cancelAmort[i.moneda] += c.capital; }));
const tot = (f, mon) => rows.filter(r => r.mon === mon).reduce((s, r) => s + f(r), 0);
const T = { CRC: { fin: tot(r => r.saldoFin, 'CRC'), ini: tot(r => r.saldoIni, 'CRC'), des: tot(r => r.desemb, 'CRC'), am: tot(r => r.amort, 'CRC') }, USD: { fin: tot(r => r.saldoFin, 'USD'), ini: tot(r => r.saldoIni, 'USD'), des: tot(r => r.desemb, 'USD'), am: tot(r => r.amort, 'USD') } };
const eqUSD = (crc, usd) => usd + crc / TC;
const finUSDeq = eqUSD(T.CRC.fin, T.USD.fin);
if (opts.soloDatos) return { rows, TC, bancosLim, FIN, ANIO, MES, cfg, parseMonto }; // para la matriz de deuda (lib/matrizDeudaXlsx.js)
const iniCancel = { CRC: T.CRC.fin - T.CRC.des + T.CRC.am + cancelAmort.CRC, USD: T.USD.fin - T.USD.des + T.USD.am + cancelAmort.USD };


// intereses (misma lógica del Apartado)
const calc = I.calcularDesdeInstrumentos(inst, ANIO, MES);
const intBanco = (arr) => { const o = {}; arr.forEach(f => { const b = (f.banco || '').replace(/ \(.*\)/, ''); o[b] = o[b] || { CRC: 0, USD: 0 }; o[b][f.moneda] += f.interes; }); return o; };
// ---- Tasa efectiva real por acreedor, 12 meses ----
// Efectiva 12m = promedio de las tasas de cada cierre ponderado por el saldo de ese cierre (Σ saldo×tasa / Σ saldo, 12 cierres).
// El cierre del mes sale de la app; los 11 anteriores, del historial (Historico_Tasa + matrices de tesorería).
const BANCOS_T = ['BCT', 'Davivienda', 'BAC', 'BCR'];
const eqRow = x => (x.mon === 'USD' ? x.saldoFin : x.saldoFin / TC);
const snapActual = BANCOS_T.map(b => { const rr = rows.filter(x => x.banco === b); const e = rr.reduce((a, x) => a + eqRow(x), 0); return e > 0 ? { banco: b, saldo: e, tasa: rr.reduce((a, x) => a + eqRow(x) * x.tasa, 0) / e * 100 } : null; }).filter(Boolean);
const periodoActual = periodoDe(ANIO, MES);
const historial = await leerHistorial(parseMonto);
historial[periodoActual] = Object.fromEntries(snapActual.map(x => [x.banco, { saldo: x.saldo, tasa: x.tasa }]));
const periodos12 = []; for (let k = 11; k >= 0; k--) { const d = new Date(ANIO, MES - 1 - k, 1); periodos12.push({ p: periodoDe(d.getFullYear(), d.getMonth() + 1), anio: d.getFullYear(), mes: d.getMonth() + 1 }); }
const celda = (b, p) => { const h = historial[p] || {}; if (b !== 'TOTAL') return h[b] || null; const v = Object.values(h); const sal = v.reduce((a, x) => a + x.saldo, 0); return sal > 0 ? { saldo: sal, tasa: v.reduce((a, x) => a + x.saldo * x.tasa, 0) / sal } : null; };
const wavg = arr => { const sal = arr.reduce((a, x) => a + x.saldo, 0); return sal > 0 ? arr.reduce((a, x) => a + x.saldo * x.tasa, 0) / sal / 100 : null; };
const tasasT = ['TOTAL', ...BANCOS_T].map(b => {
  const cel = periodos12.map(m => celda(b, m.p)); const ok = cel.filter(Boolean);
  const serie = cel.map(x => (x ? x.tasa / 100 : null)); const v = serie.filter(x => x !== null);
  const rec = wavg(cel.slice(6).filter(Boolean)), ant = wavg(cel.slice(0, 6).filter(Boolean)); const dif = rec !== null && ant !== null ? rec - ant : 0;
  return { banco: b, serie, meses: ok.length, actual: serie[11], efectiva12: wavg(ok), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, dif,
    tend: dif > 0.0005 ? 'Subiendo' : dif < -0.0005 ? 'Bajando' : 'Estable' };
});
if (opts.persistir) { try { await guardarSnapshot(periodoActual, snapActual.map(x => ({ banco: x.banco, saldo: x.saldo, tasa: x.tasa }))); } catch (e) { console.error('historico-tasa:', e.message); } }
const ibC = intBanco(calc.causado), ibE = intBanco(calc.ejecutado), ibP = intBanco(calc.proyeccion);

// vencimientos próximos 12 meses (capital e interés de los planes, por moneda)
const venc = []; for (let k = 1; k <= 12; k++) { const d = new Date(ANIO, MES - 1 + k, 1); venc.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, capCRC: 0, intCRC: 0, capUSD: 0, intUSD: 0 }); }
const mesIdx = d => (d.getFullYear() - ANIO) * 12 + d.getMonth() - (MES - 1);
rows.forEach(r => r.inst.cuotas.forEach(c => { if (!c.fecha || efec(c) <= FIN) return; const k = mesIdx(c.fecha); if (k < 1 || k > 12) return; const v = venc[k - 1]; v['cap' + r.mon] += c.capital; v['int' + r.mon] += c.interes; }));
// ---------- estilos ----------
const C = { navy: 'FF1F3864', blue: 'FF2E75B6', pale: 'FFEBF3FC', band: 'FFF2F6FB', white: 'FFFFFFFF', line: 'FFB8CCE4', gold: 'FFFFE699', input: 'FF0000FF', green: 'FF548235', red: 'FFC00000', orange: 'FFED7D31', grey: 'FF7F7F7F' };
const solid = a => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: a }, bgColor: { argb: a } });
const thin = { style: 'thin', color: { argb: C.line } }; const box = { left: thin, right: thin, top: thin, bottom: thin };
const F = (o = {}) => ({ name: 'Calibri', size: 10, ...o });
const dt = d => d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null;
const wb = new ExcelJS.Workbook(); wb.calcProperties = { fullCalcOnLoad: true }; wb.creator = 'Deuda Global — Cofersa';
const page = (ws, land = true) => { ws.pageSetup = { orientation: land ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .2, footer: .2 } }; ws.headerFooter.oddFooter = '&L&8COFERSA — Informe de Deuda para el CFO&C&8&P / &N&R&8Generado por Deuda Global'; };
const banner = (ws, last, t1, t2) => { [[1, t1, F({ bold: true, size: 16, color: { argb: C.white } }), C.navy, 30], [2, t2, F({ size: 10, color: { argb: C.white } }), C.blue, 18]].forEach(([r, t, f, bg, h]) => { ws.mergeCells(`A${r}:${last}${r}`); const c = ws.getCell(`A${r}`); c.value = t; c.font = f; c.fill = solid(bg); c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; ws.getRow(r).height = h; }); };
const hdr = (ws, r, titles, c0 = 1) => { titles.forEach((t, i) => { const c = ws.getCell(r, c0 + i); c.value = t; c.font = F({ bold: true, color: { argb: C.white } }); c.fill = solid(C.navy); c.border = box; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; }); ws.getRow(r).height = 30; };
const cell = (ws, r, c, v, o = {}) => { const x = ws.getCell(r, c); x.value = v; x.font = F({ bold: !!o.bold, color: { argb: o.color || 'FF000000' }, italic: !!o.italic, size: o.size || 10 }); if (o.nf) x.numFmt = o.nf; x.alignment = { horizontal: o.al || 'left', vertical: 'middle', wrapText: !!o.wrap, indent: o.indent || 0 }; if (o.fill) x.fill = solid(o.fill); if (o.box !== false) x.border = box; return x; };
const section = (ws, r, c0, c1, text) => { ws.mergeCells(r, c0, r, c1); const x = ws.getCell(r, c0); x.value = text; x.font = F({ bold: true, size: 11, color: { argb: C.navy } }); x.border = { bottom: { style: 'medium', color: { argb: C.navy } } }; ws.getRow(r).height = 20; };
const NF = '#,##0', NF2 = '#,##0.00', PCT = '0.00%';
const L = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  // =========================== DETALLE ===========================
  const wd = wb.addWorksheet('Detalle Operaciones', { views: [{ state: 'frozen', ySplit: 5, xSplit: 3, showGridLines: false }] }); page(wd);
  banner(wd, 'T', `Detalle de operaciones al ${FIN.getDate()} de ${MESES[MES]} de ${ANIO}`, 'Saldo al cierre = monto original − amortizaciones según plan de pagos del banco y pagos reales conciliados. Montos en moneda original.');
  wd.getRow(3).height = 6;
  cell(wd, 4, 1, `Tipo de cambio ₡ por US$1:`, { bold: true, box: false }); wd.mergeCells('A4:C4'); cell(wd, 4, 4, TC, { nf: NF2, bold: true, color: C.input, al: 'right' });
  const DH = ['Banco', 'Tipo', 'N° Operación', 'Moneda', 'Monto original', 'Fecha desembolso', 'Vencimiento final', 'Tasa vigente', 'Condición (referencia + spread)', `Saldo\n${FIN.getDate() > 0 ? '31/08/2026' : ''}`, 'Desembolsos\ndel mes', 'Amortización\ndel mes', `Saldo\n30/09/2026`, 'Saldo equiv.\nUS$', '% del total', 'Días al\nvencimiento', 'Próxima cuota', 'Monto próxima\ncuota', 'Garantía', 'Estado'];
  hdr(wd, 5, DH);
  [10, 10, 19, 8, 17, 12, 12, 9, 26, 17, 15, 15, 17, 15, 9, 11, 12, 15, 15, 14].forEach((w, i) => { wd.getColumn(i + 1).width = w; });
  const d0 = 6, dN = d0 + rows.length - 1;
  rows.forEach((r, k) => {
    const rr = d0 + k, band = k % 2 ? C.band : null; const nf = NF2;
    cell(wd, rr, 1, r.banco, { fill: band }); cell(wd, rr, 2, r.tipo, { fill: band }); cell(wd, rr, 3, /^\d+$/.test(r.op) && r.op.length < 16 ? Number(r.op) : r.op, { fill: band, nf: '0', al: 'left' });
    cell(wd, rr, 4, r.mon, { fill: band, al: 'center' }); cell(wd, rr, 5, r.aprobado, { fill: band, nf, al: 'right' });
    cell(wd, rr, 6, dt(r.inicio), { fill: band, nf: 'dd/mm/yyyy', al: 'center' }); cell(wd, rr, 7, dt(r.vcto), { fill: band, nf: 'dd/mm/yyyy', al: 'center' });
    cell(wd, rr, 8, r.tasa, { fill: band, nf: PCT, al: 'right', bold: true }); cell(wd, rr, 9, r.cond, { fill: band });
    cell(wd, rr, 10, r.saldoIni, { fill: band, nf, al: 'right' }); cell(wd, rr, 11, r.desemb, { fill: band, nf, al: 'right', color: r.desemb ? C.green : undefined });
    cell(wd, rr, 12, r.amort, { fill: band, nf, al: 'right', color: r.amort ? C.red : undefined });
    cell(wd, rr, 13, { formula: `J${rr}+K${rr}-L${rr}`, result: r.saldoFin }, { fill: band, nf, al: 'right', bold: true });
    cell(wd, rr, 14, { formula: `IF(D${rr}="USD",M${rr},M${rr}/$D$4)`, result: r.mon === 'USD' ? r.saldoFin : r.saldoFin / TC }, { fill: band, nf: NF, al: 'right' });
    cell(wd, rr, 15, { formula: `N${rr}/$N$${dN + 1}`, result: (r.mon === 'USD' ? r.saldoFin : r.saldoFin / TC) / finUSDeq }, { fill: band, nf: '0.0%', al: 'right' });
    const dias = r.vcto ? Math.round((r.vcto - FIN) / 864e5) : null;
    cell(wd, rr, 16, dias, { fill: band, nf: '#,##0', al: 'right', color: dias !== null && dias <= 90 ? C.orange : undefined, bold: dias !== null && dias <= 90 });
    cell(wd, rr, 17, r.prox ? dt(r.prox.fecha) : null, { fill: band, nf: 'dd/mm/yyyy', al: 'center' }); cell(wd, rr, 18, r.prox ? r2(r.prox.capital + r.prox.interes) : null, { fill: band, nf, al: 'right' });
    cell(wd, rr, 19, (r.garantia && r.garantia !== '—' ? r.garantia : '') || GARANTIA[r.banco] || '', { fill: band }); cell(wd, rr, 20, r.desemb ? 'Nueva en el mes' : (dias !== null && dias <= 90 ? 'Vence en ≤ 90 días' : 'Vigente'), { fill: band, color: r.desemb ? C.green : (dias !== null && dias <= 90 ? C.orange : undefined), bold: !!r.desemb });
  });
  const tr = dN + 1;
  [['TOTAL US$ (saldo en dólares)', 'USD'], ['TOTAL ₡ (saldo en colones)', 'CRC']].forEach(([lab, mon], q) => {
    const rr = tr + q; for (let c = 1; c <= 20; c++) { const x = wd.getCell(rr, c); x.fill = solid(C.navy); x.font = F({ bold: true, color: { argb: C.gold } }); x.border = box; }
    wd.getCell(rr, 1).value = lab; wd.mergeCells(rr, 1, rr, 4);
    [[5, 'aprobado'], [10, 'saldoIni'], [11, 'desemb'], [12, 'amort'], [13, 'saldoFin']].forEach(([c, k]) => { const x = wd.getCell(rr, c); x.value = { formula: `SUMIF($D$${d0}:$D$${dN},"${mon}",${L(c)}$${d0}:${L(c)}$${dN})`, result: rows.filter(r => r.mon === mon).reduce((s, r) => s + r[k], 0) }; x.numFmt = NF2; x.alignment = { horizontal: 'right' }; });
  });
  // total equiv US$ (fila tr+2) — la celda N{tr+... } se usa como denominador de %
  // denominador: N{dN+1} -> ponemos total equivalente en esa fila (celda N)
  const x14 = wd.getCell(tr, 14); x14.value = { formula: `SUM(N${d0}:N${dN})`, result: finUSDeq }; x14.numFmt = NF; x14.alignment = { horizontal: 'right' };
  const x14b = wd.getCell(tr + 1, 14); x14b.value = ''; // sin duplicar
  wd.autoFilter = { from: { row: 5, column: 1 }, to: { row: dN, column: 20 } };

  // =========================== RESUMEN ===========================
  const ws = wb.addWorksheet('Resumen Ejecutivo', { views: [{ showGridLines: false }] }); wb.views = [{ activeTab: 0 }]; page(ws);
  [3, 16, 18, 18, 18, 14, 14, 14, 3].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.mergeCells('A1:I1'); const t = ws.getCell('A1'); t.value = 'COFERSA — INFORME DE DEUDA FINANCIERA'; t.font = F({ bold: true, size: 18, color: { argb: C.white } }); t.fill = solid(C.navy); t.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 34;
  ws.mergeCells('A2:I2'); const t2 = ws.getCell('A2'); t2.value = `Cierre al ${FIN.getDate()} de ${MESES[MES]} de ${ANIO}   |   Preparado para: Gerencia Financiera / CFO   |   TC ₡${TC.toFixed(2)} por US$1`; t2.font = F({ size: 10, color: { argb: C.white } }); t2.fill = solid(C.blue); t2.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(2).height = 20;
  ws.getRow(3).height = 8;
  // KPI tiles
  const eqCRC = finUSDeq * TC;
  const wAvg = mon => { const rr = rows.filter(r => r.mon === mon); const s = rr.reduce((a, r) => a + r.saldoFin, 0); return s ? rr.reduce((a, r) => a + r.saldoFin * r.tasa, 0) / s : 0; };
  const wAll = rows.reduce((a, r) => a + (r.mon === 'USD' ? r.saldoFin : r.saldoFin / TC) * r.tasa, 0) / finUSDeq;
  const prevBase = eqUSD(iniCancel.CRC, iniCancel.USD); const varUSD = finUSDeq - prevBase;
  const proxMes = venc[0]; const proxEq = proxMes.capUSD + proxMes.intUSD + (proxMes.capCRC + proxMes.intCRC) / TC;
  const tiles = [[2, 3, 'DEUDA TOTAL (US$ equivalente)', finUSDeq, '$#,##0'], [4, 5, 'DEUDA TOTAL (₡ equivalente)', eqCRC, '"₡"#,##0'], [6, 8, 'TASA PONDERADA (equiv. US$)', wAll, PCT]];
  tiles.forEach(([c0, c1, lab, val, nf]) => {
    ws.mergeCells(4, c0, 4, c1); ws.mergeCells(5, c0, 5, c1); ws.mergeCells(6, c0, 6, c1);
    const a = ws.getCell(4, c0); a.value = lab; a.font = F({ bold: true, size: 9, color: { argb: C.grey } }); a.alignment = { horizontal: 'center', vertical: 'middle' }; a.fill = solid(C.pale);
    const b = ws.getCell(5, c0); b.value = val; b.numFmt = nf; b.font = F({ bold: true, size: 22, color: { argb: C.navy } }); b.alignment = { horizontal: 'center', vertical: 'middle' }; b.fill = solid(C.pale);
    for (let c = c0; c <= c1; c++) { [4, 5, 6].forEach(r => { const x = ws.getCell(r, c); x.fill = solid(C.pale); x.border = { top: r === 4 ? { style: 'medium', color: { argb: C.blue } } : undefined, left: c === c0 ? thin : undefined, right: c === c1 ? thin : undefined, bottom: r === 6 ? thin : undefined }; }); }
    ws.getRow(5).height = 36;
  });
  ws.getCell(6, 2).value = `vs. cierre anterior: ${varUSD >= 0 ? '+' : '−'}$${Math.abs(varUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })} (${((varUSD / prevBase) * 100).toFixed(1)}%)`; ws.getCell(6, 2).font = F({ size: 9, bold: true, color: { argb: varUSD > 0 ? C.red : C.green } }); ws.getCell(6, 2).alignment = { horizontal: 'center' };
  ws.getCell(6, 4).value = `${rows.length} operaciones vigentes en 4 bancos`; ws.getCell(6, 4).font = F({ size: 9, color: { argb: C.grey } }); ws.getCell(6, 4).alignment = { horizontal: 'center' };
  ws.getCell(6, 6).value = `₡ ${(wAvg('CRC') * 100).toFixed(2)}%  |  US$ ${(wAvg('USD') * 100).toFixed(2)}%`; ws.getCell(6, 6).font = F({ size: 9, color: { argb: C.grey } }); ws.getCell(6, 6).alignment = { horizontal: 'center' };
  ws.getRow(7).height = 8;

  // 1. Por banco
  let r = 8; section(ws, r, 2, 8, '1. Deuda por acreedor'); r++;
  hdr(ws, r, ['Banco', 'Saldo en colones (₡)', 'Saldo en dólares (US$)', 'Equivalente US$', '% del total', 'Tasa pond.', 'Participación'], 2); r++;
  const bR0 = r; const bancos = ['BCT', 'Davivienda', 'BAC', 'BCR'];
  bancos.forEach((b, k) => {
    const band = k % 2 ? C.band : null; const rr = r;
    const sC = rows.filter(x => x.banco === b && x.mon === 'CRC').reduce((s, x) => s + x.saldoFin, 0), sU = rows.filter(x => x.banco === b && x.mon === 'USD').reduce((s, x) => s + x.saldoFin, 0);
    const eq = sU + sC / TC; const tp = rows.filter(x => x.banco === b).reduce((a, x) => a + (x.mon === 'USD' ? x.saldoFin : x.saldoFin / TC) * x.tasa, 0) / eq;
    cell(ws, rr, 2, b, { bold: true, fill: band });
    cell(ws, rr, 3, { formula: `SUMIFS('Detalle Operaciones'!$M$${d0}:$M$${dN},'Detalle Operaciones'!$A$${d0}:$A$${dN},B${rr},'Detalle Operaciones'!$D$${d0}:$D$${dN},"CRC")`, result: sC }, { nf: NF2, al: 'right', fill: band });
    cell(ws, rr, 4, { formula: `SUMIFS('Detalle Operaciones'!$M$${d0}:$M$${dN},'Detalle Operaciones'!$A$${d0}:$A$${dN},B${rr},'Detalle Operaciones'!$D$${d0}:$D$${dN},"USD")`, result: sU }, { nf: NF2, al: 'right', fill: band });
    cell(ws, rr, 5, { formula: `D${rr}+C${rr}/'Detalle Operaciones'!$D$4`, result: eq }, { nf: NF, al: 'right', fill: band, bold: true });
    cell(ws, rr, 6, { formula: `E${rr}/E${bR0 + 4}`, result: eq / finUSDeq }, { nf: '0.0%', al: 'right', fill: band });
    cell(ws, rr, 7, tp, { nf: PCT, al: 'right', fill: band });
    cell(ws, rr, 8, { formula: `REPT("█",ROUND(F${rr}*20,0))`, result: '█'.repeat(Math.round(eq / finUSDeq * 20)) }, { color: C.blue, fill: band, size: 9 });
    r++;
  });
  // fila total
  for (let c = 2; c <= 8; c++) { const x = ws.getCell(r, c); x.fill = solid(C.navy); x.font = F({ bold: true, color: { argb: C.gold } }); x.border = box; x.alignment = { horizontal: c === 2 ? 'left' : 'right' }; }
  ws.getCell(r, 2).value = 'TOTAL';
  [['C', T.CRC.fin, NF2], ['D', T.USD.fin, NF2], ['E', finUSDeq, NF]].forEach(([c, v, nf]) => { const x = ws.getCell(`${c}${r}`); x.value = { formula: `SUM(${c}${bR0}:${c}${r - 1})`, result: v }; x.numFmt = nf; });
  ws.getCell(r, 6).value = 1; ws.getCell(r, 6).numFmt = '0.0%'; ws.getCell(r, 7).value = wAll; ws.getCell(r, 7).numFmt = PCT; r += 2;

  // 2. Movimiento de la deuda
  section(ws, r, 2, 8, `2. Movimiento de la deuda en ${MESES[MES]}`); r++;
  hdr(ws, r, ['Concepto', 'Colones (₡)', 'Dólares (US$)', 'Equivalente US$'], 2); r++;
  const mv = [['Saldo al cierre anterior (31/08)', iniCancel.CRC, iniCancel.USD, true], ['(+) Desembolsos del mes', T.CRC.des, T.USD.des], ['(−) Amortizaciones del mes (planes)', -T.CRC.am, -T.USD.am], ['(−) Pagos finales de operaciones vencidas / canceladas', -cancelAmort.CRC, -cancelAmort.USD], ['Saldo al cierre (30/09)', T.CRC.fin, T.USD.fin, true]];
  const mv0 = r;
  mv.forEach(([lab, c, u, b], k) => { const last = k === mv.length - 1; const fill = b ? C.pale : null;
    cell(ws, r, 2, lab, { bold: !!b, fill }); ws.mergeCells(r, 2, r, 2);
    cell(ws, r, 3, last ? { formula: `SUM(C${mv0}:C${r - 1})`, result: c } : r2(c), { nf: NF2, al: 'right', bold: !!b, fill, color: !b && c < 0 ? C.red : (!b && c > 0 ? C.green : undefined) });
    cell(ws, r, 4, last ? { formula: `SUM(D${mv0}:D${r - 1})`, result: u } : r2(u), { nf: NF2, al: 'right', bold: !!b, fill, color: !b && u < 0 ? C.red : (!b && u > 0 ? C.green : undefined) });
    cell(ws, r, 5, { formula: `D${r}+C${r}/'Detalle Operaciones'!$D$4`, result: u + c / TC }, { nf: NF, al: 'right', bold: !!b, fill }); r++; });
  ws.getColumn(2).width = 40; r++;

  // 3. Tasa efectiva real por acreedor (12 meses)
  section(ws, r, 2, 8, '3. Tasa efectiva real por acreedor (12 meses)'); r++;
  hdr(ws, r, ['Acreedor', 'Tasa nominal hoy', 'Efectiva 12 meses', `Mes actual (${ABR[MES]})`, 'Mín. 12 meses', 'Máx. 12 meses', 'Tendencia'], 2); r++;
  const nominalDe = b => { const rr = b === 'TOTAL' ? rows : rows.filter(x => x.banco === b); const e = rr.reduce((a, x) => a + eqRow(x), 0); return e ? rr.reduce((a, x) => a + eqRow(x) * x.tasa, 0) / e : null; };
  const TEND = { Subiendo: ['↑ Subiendo', 'FFFCE4E4', C.red], Bajando: ['↓ Bajando', 'FFE2F0D9', C.green], Estable: ['→ Estable', 'FFEDEDED', C.grey] };
  tasasT.forEach((x, k) => {
    const tot = x.banco === 'TOTAL'; const fill = tot ? C.pale : (k % 2 ? C.band : null); const tt = TEND[x.tend];
    cell(ws, r, 2, tot ? 'COFERSA (total)' : x.banco, { bold: true, fill }); cell(ws, r, 3, nominalDe(x.banco), { nf: PCT, al: 'right', fill });
    cell(ws, r, 4, x.efectiva12, { nf: PCT, al: 'right', fill, bold: true }); cell(ws, r, 5, x.actual, { nf: PCT, al: 'right', fill });
    cell(ws, r, 6, x.min, { nf: PCT, al: 'right', fill }); cell(ws, r, 7, x.max, { nf: PCT, al: 'right', fill });
    cell(ws, r, 8, tt[0], { bold: true, al: 'center', fill: tt[1], color: tt[2] }); r++;
  });
  ws.mergeCells(r, 2, r, 8); cell(ws, r, 2, 'Efectiva 12 meses = tasa de cada cierre ponderada por el saldo de ese cierre (12 cierres). Tendencia: últimos 6 meses contra los 6 anteriores (±0.05 pp). Evolución mensual en la hoja "Tasas por Acreedor".', { size: 8, italic: true, color: C.grey, box: false, wrap: true }); ws.getRow(r).height = 24; r += 2;

  // 4. Intereses
  section(ws, r, 2, 8, `4. Costo financiero (intereses)`); r++;
  hdr(ws, r, ['Concepto', 'Colones (₡)', 'Dólares (US$)', 'Equivalente US$', 'Qué significa'], 2); ws.mergeCells(r, 6, r, 8); r++;
  const tc = calc.totales;
  [[`Causado en ${MESES[MES]}`, tc.causado, 'Gasto del mes (devengo diario)'], [`Pagado en ${MESES[MES]}`, tc.ejecutado, 'Salida de caja por intereses'], [`Proyectado ${MESES[MES % 12 + 1]}`, tc.proyeccion, 'Gasto estimado del mes siguiente']].forEach(([lab, v, q], k) => {
    const fill = k % 2 ? C.band : null; cell(ws, r, 2, lab, { bold: true, fill }); cell(ws, r, 3, v.crc, { nf: NF2, al: 'right', fill }); cell(ws, r, 4, v.usd, { nf: NF2, al: 'right', fill });
    cell(ws, r, 5, { formula: `D${r}+C${r}/'Detalle Operaciones'!$D$4`, result: v.usd + v.crc / TC }, { nf: NF, al: 'right', fill, bold: true }); ws.mergeCells(r, 6, r, 8); cell(ws, r, 6, q, { size: 9, color: C.grey, fill }); r++; });
  const costoAnual = (tc.causado.usd + tc.causado.crc / TC) * 12 / finUSDeq;
  r++;

  // 4. Perfil de vencimientos
  section(ws, r, 2, 8, '5. Perfil de vencimientos (capital a amortizar según planes)'); r++;
  hdr(ws, r, ['Horizonte', 'Capital ₡', 'Capital US$', 'Equivalente US$', '% de la deuda', '', 'Distribución'], 2); r++;
  const hz = [['0 – 3 meses', 1, 3], ['4 – 6 meses', 4, 6], ['7 – 12 meses', 7, 12]];
  let acc = { crc: 0, usd: 0 }; const hz0 = r;
  hz.forEach(([lab, a, b], k) => { let cC = 0, cU = 0; for (let m = a; m <= b; m++) { cC += venc[m - 1].capCRC; cU += venc[m - 1].capUSD; } acc.crc += cC; acc.usd += cU; const eq = cU + cC / TC; const fill = k % 2 ? C.band : null;
    cell(ws, r, 2, lab, { bold: true, fill }); cell(ws, r, 3, r2(cC), { nf: NF2, al: 'right', fill }); cell(ws, r, 4, r2(cU), { nf: NF2, al: 'right', fill }); cell(ws, r, 5, { formula: `D${r}+C${r}/'Detalle Operaciones'!$D$4`, result: eq }, { nf: NF, al: 'right', fill, bold: true });
    cell(ws, r, 6, { formula: `E${r}/E${bR0 + 4}`, result: eq / finUSDeq }, { nf: '0.0%', al: 'right', fill }); cell(ws, r, 7, '', { fill }); cell(ws, r, 8, { formula: `REPT("█",ROUND(F${r}*20,0))`, result: '█'.repeat(Math.round(eq / finUSDeq * 20)) }, { color: C.orange, fill, size: 9 }); r++; });
  const mas = { crc: T.CRC.fin - acc.crc, usd: T.USD.fin - acc.usd }; const eqMas = mas.usd + mas.crc / TC;
  cell(ws, r, 2, 'Más de 12 meses', { bold: true }); cell(ws, r, 3, r2(mas.crc), { nf: NF2, al: 'right' }); cell(ws, r, 4, r2(mas.usd), { nf: NF2, al: 'right' }); cell(ws, r, 5, { formula: `D${r}+C${r}/'Detalle Operaciones'!$D$4`, result: eqMas }, { nf: NF, al: 'right', bold: true });
  cell(ws, r, 6, { formula: `E${r}/E${bR0 + 4}`, result: eqMas / finUSDeq }, { nf: '0.0%', al: 'right' }); cell(ws, r, 7, ''); cell(ws, r, 8, { formula: `REPT("█",ROUND(F${r}*20,0))`, result: '█'.repeat(Math.round(eqMas / finUSDeq * 20)) }, { color: C.blue, size: 9 }); r += 2;

  // 5. Líneas
  section(ws, r, 2, 8, '6. Utilización de líneas de crédito (US$)'); r++;
  hdr(ws, r, ['Banco', 'Línea aprobada', 'Utilizado', 'Disponible', '% utilizado', '', 'Utilización'], 2); r++;
  bancos.forEach((b, k) => { const lim = bancosLim[b] || 0; const bi = bancos.indexOf(b); const usedRow = bR0 + bi; const used = rows.filter(x => x.banco === b).reduce((s, x) => s + (x.mon === 'USD' ? x.saldoFin : x.saldoFin / TC), 0); const fill = k % 2 ? C.band : null;
    cell(ws, r, 2, b, { bold: true, fill }); cell(ws, r, 3, lim, { nf: NF, al: 'right', fill, color: C.input }); cell(ws, r, 4, { formula: `E${usedRow}`, result: used }, { nf: NF, al: 'right', fill }); cell(ws, r, 5, { formula: `C${r}-D${r}`, result: lim - used }, { nf: NF, al: 'right', fill, bold: true });
    cell(ws, r, 6, { formula: `IF(C${r}=0,0,D${r}/C${r})`, result: lim ? used / lim : 0 }, { nf: '0.0%', al: 'right', fill, color: used / lim > .85 ? C.red : undefined, bold: used / lim > .85 }); cell(ws, r, 7, '', { fill });
    cell(ws, r, 8, { formula: `REPT("█",ROUND(MIN(F${r},1)*20,0))`, result: '█'.repeat(Math.round(Math.min(used / lim, 1) * 20)) }, { color: used / lim > .85 ? C.red : C.green, fill, size: 9 }); r++; });
  r++;

  // 6. Puntos de atención (automáticos)
  section(ws, r, 2, 8, '7. Puntos de atención para la gerencia'); r++;
  const prox90 = rows.filter(x => x.vcto && (x.vcto - FIN) / 864e5 <= 90 && x.tipo !== 'Leasing');
  const prox90Eq = prox90.reduce((s, x) => s + (x.mon === 'USD' ? x.saldoFin : x.saldoFin / TC), 0);
  const topBank = bancos.map(b => [b, rows.filter(x => x.banco === b).reduce((s, x) => s + (x.mon === 'USD' ? x.saldoFin : x.saldoFin / TC), 0)]).sort((a, b) => b[1] - a[1])[0];
  const nuevas = rows.filter(x => x.desemb);
  const pts = [
    `Vencen en los próximos 90 días ${prox90.length} operaciones por US$ ${Math.round(prox90Eq).toLocaleString('en-US')} equivalentes (${(prox90Eq / finUSDeq * 100).toFixed(1)}% de la deuda): requieren renovación o fondeo.`,
    `Concentración: ${topBank[0]} representa el ${(topBank[1] / finUSDeq * 100).toFixed(1)}% de la deuda.`,
    nuevas.length ? `Nuevos desembolsos del mes: ${nuevas.map(x => `${x.banco} ${x.op} (${x.mon === 'USD' ? '$' : '₡'}${x.aprobado.toLocaleString('en-US')})`).join('; ')}.` : 'Sin desembolsos nuevos en el mes.',
    `Servicio de la deuda de ${MESES[MES % 12 + 1]}: US$ ${Math.round(proxEq).toLocaleString('en-US')} equivalentes entre capital e intereses (cuotas según plan).`,
    `Costo financiero anualizado sobre el saldo: ${(costoAnual * 100).toFixed(2)}% (intereses causados del mes × 12 / deuda).`,
    `Leasing: ${rows.filter(x => x.tipo === 'Leasing').length} contratos por US$ ${Math.round(rows.filter(x => x.tipo === 'Leasing').reduce((a, x) => a + x.saldoFin, 0)).toLocaleString('en-US')} según plan; confirmar su saldo con el banco (suelen no venir en las capturas de préstamos).`,
  ];
  pts.forEach(p => { ws.mergeCells(r, 2, r, 8); const x = ws.getCell(r, 2); x.value = '•  ' + p; x.font = F({ size: 10 }); x.alignment = { wrapText: true, vertical: 'middle', indent: 1 }; ws.getRow(r).height = 30; r++; });
  r++; ws.mergeCells(r, 2, r, 8); const fn = ws.getCell(r, 2); fn.value = 'Fuente: planes de pago de los bancos y pagos conciliados (sistema Deuda Global), Complete la hoja Conciliación con los saldos de los estados de cuenta para validar cada operación. Detalle por operación, vencimientos e intereses en las hojas siguientes.'; fn.font = F({ size: 8, italic: true, color: { argb: C.grey } }); fn.alignment = { wrapText: true }; ws.getRow(r).height = 24;
  ws.pageSetup.fitToHeight = 0;

  // =========================== TASAS POR ACREEDOR ===========================
  const wt = wb.addWorksheet('Tasas por Acreedor', { views: [{ showGridLines: false }] }); page(wt);
  banner(wt, 'M', 'Tasa efectiva real por acreedor — últimos 12 meses', `Cierre ${MESES[MES]} ${ANIO}. Efectiva 12 meses = tasa de cada cierre ponderada por su saldo. Se alimenta sola: cada mes el informe guarda su cierre.`);
  wt.getRow(3).height = 6;
  hdr(wt, 4, ['Acreedor', 'Tasa nominal hoy', 'Efectiva 12 meses', 'Mes actual', 'Mín. 12 meses', 'Máx. 12 meses', 'Cambio 6m vs 6m ant. (pp)', 'Tendencia', 'Meses con dato'], 1);
  tasasT.forEach((x, k) => { const rr = 5 + k, tot = x.banco === 'TOTAL', fill = tot ? C.pale : (k % 2 ? C.band : null), tt = TEND[x.tend];
    cell(wt, rr, 1, tot ? 'COFERSA (total)' : x.banco, { bold: true, fill }); cell(wt, rr, 2, nominalDe(x.banco), { nf: PCT, al: 'right', fill }); cell(wt, rr, 3, x.efectiva12, { nf: PCT, al: 'right', fill, bold: true });
    cell(wt, rr, 4, x.actual, { nf: PCT, al: 'right', fill }); cell(wt, rr, 5, x.min, { nf: PCT, al: 'right', fill }); cell(wt, rr, 6, x.max, { nf: PCT, al: 'right', fill });
    cell(wt, rr, 7, x.dif * 100, { nf: '+0.00;-0.00;0.00', al: 'right', fill, color: x.dif > 0.0005 ? C.red : (x.dif < -0.0005 ? C.green : undefined) }); cell(wt, rr, 8, tt[0], { bold: true, al: 'center', fill: tt[1], color: tt[2] });
    cell(wt, rr, 9, x.meses + ' de 12', { al: 'center', fill, color: x.meses < 12 ? C.orange : C.grey, size: 9 }); });
  const g0 = 5 + tasasT.length + 2;
  section(wt, g0 - 1, 1, 13, 'Tasa ponderada por mes (verde = más barata, rojo = más cara)');
  hdr(wt, g0, ['Acreedor', ...periodos12.map(m => `${ABR[m.mes]} ${String(m.anio).slice(2)}`)], 1);
  tasasT.forEach((x, k) => { const rr = g0 + 1 + k, tot = x.banco === 'TOTAL';
    cell(wt, rr, 1, tot ? 'COFERSA (total)' : x.banco, { bold: true, fill: tot ? C.pale : undefined });
    x.serie.forEach((v, j) => cell(wt, rr, 2 + j, v, { nf: PCT, al: 'center', bold: tot })); });
  wt.addConditionalFormatting({ ref: `B${g0 + 1}:M${g0 + tasasT.length}`, rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: [{ argb: 'FF63BE7B' }, { argb: 'FFFFEB84' }, { argb: 'FFF8696B' }] }] });
  const b0 = g0 + tasasT.length + 3;
  section(wt, b0 - 1, 1, 13, 'Comparación visual: efectiva 12 meses contra nominal hoy');
  tasasT.forEach((x, k) => { const rr = b0 + k; const e = x.efectiva12 || 0, n = nominalDe(x.banco) || 0, mx = 0.10;
    cell(wt, rr, 1, x.banco === 'TOTAL' ? 'COFERSA (total)' : x.banco, { bold: true });
    cell(wt, rr, 2, 'Efectiva 12m', { size: 9, color: C.grey }); wt.mergeCells(rr, 3, rr, 7); cell(wt, rr, 3, '█'.repeat(Math.round(e / mx * 40)) + '  ' + (e * 100).toFixed(2) + '%', { color: C.blue, size: 9 });
    cell(wt, rr, 8, 'Nominal hoy', { size: 9, color: C.grey }); wt.mergeCells(rr, 9, rr, 13); cell(wt, rr, 9, '█'.repeat(Math.round(n / mx * 40)) + '  ' + (n * 100).toFixed(2) + '%', { color: C.grey, size: 9 }); });
  const n0 = b0 + tasasT.length + 1; wt.mergeCells(n0, 1, n0, 13);
  cell(wt, n0, 1, 'Notas: la tasa de cada mes es la de los contratos vigentes a ese cierre, ponderada por saldo. Oct-2025 a Ago-2026 vienen de las matrices de deuda de tesorería; desde Set-2026 las guarda este informe en la pestaña Historico_Tasa del Sheet (editable si hay que corregir un mes). No incluye comisiones ni operaciones canceladas antes de cada cierre.', { size: 9, italic: true, color: C.grey, box: false, wrap: true }); wt.getRow(n0).height = 42;
  [20, 12, 12, 12, 12, 12, 14, 14, 12, 12, 12, 12, 12].forEach((w, i) => { wt.getColumn(i + 1).width = w; });

  // =========================== VENCIMIENTOS ===========================
  const wv = wb.addWorksheet('Vencimientos 12m', { views: [{ showGridLines: false }] }); page(wv);
  banner(wv, 'I', 'Calendario de pagos — próximos 12 meses', `Capital e intereses según planes de pago (desde ${MESES[MES % 12 + 1]} ${MES === 12 ? ANIO + 1 : ANIO}). Montos en moneda original.`);
  wv.getRow(3).height = 6; hdr(wv, 4, ['Mes', 'Capital ₡', 'Interés ₡', 'Total ₡', 'Capital US$', 'Interés US$', 'Total US$', 'Total equiv. US$', 'Peso del mes'], 1);
  [14, 17, 16, 17, 15, 14, 15, 17, 24].forEach((w, i) => { wv.getColumn(i + 1).width = w; });
  const vEq = v => v.capUSD + v.intUSD + (v.capCRC + v.intCRC) / TC; const vMax = Math.max(...venc.map(vEq));
  venc.forEach((v, k) => { const rr = 5 + k, fill = k % 2 ? C.band : null;
    cell(wv, rr, 1, `${ABR[v.mes]} ${v.anio}`, { bold: true, fill }); cell(wv, rr, 2, r2(v.capCRC), { nf: NF2, al: 'right', fill }); cell(wv, rr, 3, r2(v.intCRC), { nf: NF2, al: 'right', fill });
    cell(wv, rr, 4, { formula: `B${rr}+C${rr}`, result: v.capCRC + v.intCRC }, { nf: NF2, al: 'right', fill, bold: true }); cell(wv, rr, 5, r2(v.capUSD), { nf: NF2, al: 'right', fill }); cell(wv, rr, 6, r2(v.intUSD), { nf: NF2, al: 'right', fill });
    cell(wv, rr, 7, { formula: `E${rr}+F${rr}`, result: v.capUSD + v.intUSD }, { nf: NF2, al: 'right', fill, bold: true });
    cell(wv, rr, 8, { formula: `G${rr}+D${rr}/'Detalle Operaciones'!$D$4`, result: vEq(v) }, { nf: NF, al: 'right', fill, bold: true });
    cell(wv, rr, 9, { formula: `REPT("█",ROUND(H${rr}/MAX($H$5:$H$16)*22,0))`, result: '█'.repeat(Math.round(vEq(v) / vMax * 22)) }, { color: C.orange, fill, size: 9 }); });
  const vt = 17; for (let c = 1; c <= 9; c++) { const x = wv.getCell(vt, c); x.fill = solid(C.navy); x.font = F({ bold: true, color: { argb: C.gold } }); x.border = box; x.alignment = { horizontal: c === 1 ? 'left' : 'right' }; }
  wv.getCell(vt, 1).value = 'TOTAL 12 MESES'; ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(c => { const x = wv.getCell(`${c}${vt}`); x.value = { formula: `SUM(${c}5:${c}16)`, result: 0 }; x.numFmt = c === 'H' ? NF : NF2; });

  // =========================== INTERESES ===========================
  const wi = wb.addWorksheet('Intereses', { views: [{ showGridLines: false }] }); page(wi);
  banner(wi, 'H', `Intereses por banco — ${MESES[MES]} ${ANIO}`, 'Causado = devengo diario base real/360 · Pagado = intereses efectivamente cancelados · Proyectado = mes siguiente');
  wi.getRow(3).height = 6; hdr(wi, 4, ['Banco', 'Causado ₡', 'Causado US$', 'Pagado ₡', 'Pagado US$', 'Proyectado ₡', 'Proyectado US$', 'Causado equiv. US$'], 1);
  [16, 17, 15, 17, 15, 17, 16, 18].forEach((w, i) => { wi.getColumn(i + 1).width = w; });
  const bl = [...bancos]; bl.forEach((b, k) => { const rr = 5 + k, fill = k % 2 ? C.band : null; const g = (o) => (o[b] || { CRC: 0, USD: 0 });
    cell(wi, rr, 1, b, { bold: true, fill }); cell(wi, rr, 2, r2(g(ibC).CRC), { nf: NF2, al: 'right', fill }); cell(wi, rr, 3, r2(g(ibC).USD), { nf: NF2, al: 'right', fill }); cell(wi, rr, 4, r2(g(ibE).CRC), { nf: NF2, al: 'right', fill }); cell(wi, rr, 5, r2(g(ibE).USD), { nf: NF2, al: 'right', fill }); cell(wi, rr, 6, r2(g(ibP).CRC), { nf: NF2, al: 'right', fill }); cell(wi, rr, 7, r2(g(ibP).USD), { nf: NF2, al: 'right', fill });
    cell(wi, rr, 8, { formula: `C${rr}+B${rr}/'Detalle Operaciones'!$D$4`, result: g(ibC).USD + g(ibC).CRC / TC }, { nf: NF, al: 'right', fill, bold: true }); });
  const it = 9; for (let c = 1; c <= 8; c++) { const x = wi.getCell(it, c); x.fill = solid(C.navy); x.font = F({ bold: true, color: { argb: C.gold } }); x.border = box; x.alignment = { horizontal: c === 1 ? 'left' : 'right' }; }
  wi.getCell(it, 1).value = 'TOTAL'; ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(c => { const x = wi.getCell(`${c}${it}`); x.value = { formula: `SUM(${c}5:${c}8)`, result: 0 }; x.numFmt = c === 'H' ? NF : NF2; });
  wi.mergeCells('A11:H11'); cell(wi, 11, 1, 'La diferencia entre causado y pagado se explica por el calendario de pagos (cuotas que vencen en otro mes). El archivo "Apartado de Intereses" mantiene el detalle operación por operación.', { size: 9, italic: true, color: C.grey, box: false, wrap: true }); wi.getRow(11).height = 28;

  // =========================== CONCILIACIÓN ===========================
  const wc = wb.addWorksheet('Conciliación', { views: [{ showGridLines: false }] }); page(wc);
  banner(wc, 'G', `Conciliación de saldos con los bancos — ${FIN.getDate()}/${String(MES).padStart(2, '0')}/${ANIO}`, 'Saldo según el sistema vs. saldo del estado de cuenta. Diferencia en cero = el sistema coincide con el banco.');
  wc.getRow(3).height = 6; hdr(wc, 4, ['Banco', 'N° Operación', 'Moneda', 'Saldo sistema', 'Saldo estado de cuenta', 'Diferencia', 'Resultado'], 1);
  [14, 21, 9, 19, 21, 15, 22].forEach((w, i) => { wc.getColumn(i + 1).width = w; });
  rows.forEach((x, k) => { const rr = 5 + k, fill = k % 2 ? C.band : null; const has = x.banksaldo !== undefined && x.tipo !== 'x'; const sinEC = false;
    cell(wc, rr, 1, x.banco, { fill }); cell(wc, rr, 2, /^\d+$/.test(x.op) && x.op.length < 16 ? Number(x.op) : x.op, { fill, nf: '0' }); cell(wc, rr, 3, x.mon, { fill, al: 'center' }); cell(wc, rr, 4, x.saldoFin, { nf: NF2, al: 'right', fill });
    cell(wc, rr, 5, sinEC ? null : (has ? x.banksaldo : null), { nf: NF2, al: 'right', fill, color: C.input });
    cell(wc, rr, 6, { formula: `IF(E${rr}="","",D${rr}-E${rr})`, result: sinEC || !has ? '' : r2(x.saldoFin - x.banksaldo) }, { nf: NF2, al: 'right', fill });
    const d = sinEC || !has ? null : Math.abs(x.saldoFin - x.banksaldo);
    cell(wc, rr, 7, { formula: `IF(E${rr}="","Pendiente de digitar",IF(ABS(F${rr})<=1,"Cuadra","REVISAR"))`, result: d === null ? 'Pendiente de digitar' : (d <= 1 ? 'Cuadra' : 'REVISAR') }, { fill, al: 'center', bold: true, color: d === null ? C.orange : (d <= 1 ? C.green : C.red) }); });
  wc.mergeCells(5 + rows.length + 1, 1, 5 + rows.length + 1, 7); cell(wc, 5 + rows.length + 1, 1, 'Instrucción mensual: digite en azul el saldo del estado de cuenta de cada operación; la columna Resultado indica si cuadra (tolerancia ±1).', { size: 9, italic: true, color: C.grey, box: false });
  [['Resumen Ejecutivo', 1], ['Tasas por Acreedor', 2], ['Detalle Operaciones', 3], ['Vencimientos 12m', 4], ['Intereses', 5], ['Conciliación', 6]].forEach(([n, o]) => { wb.getWorksheet(n).orderNo = o; });
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer, filename: `Informe_Deuda_CFO_${MESES[MES]}_${ANIO}.xlsx`,
    resumen: { mes: `${MESES[MES]} ${ANIO}`, fechaCierre: `${FIN.getDate()} de ${MESES[MES].toLowerCase()} de ${ANIO}`, variacionPct: prevBase ? varUSD / prevBase : 0,
      bancos: BANCOS_T.map(b => { const rr = rows.filter(x => x.banco === b); const eq = rr.reduce((a, x) => a + eqRow(x), 0); return { banco: b, crc: rr.filter(x => x.mon === 'CRC').reduce((a, x) => a + x.saldoFin, 0), usd: rr.filter(x => x.mon === 'USD').reduce((a, x) => a + x.saldoFin, 0), eqUSD: eq, pct: finUSDeq ? eq / finUSDeq : 0, nominal: nominalDe(b) }; }).filter(b => b.eqUSD > 0), tc: TC, crc: T.CRC.fin, usd: T.USD.fin, eqUSD: finUSDeq, variacionUSD: varUSD, ops: rows.length,
      causado: calc.totales.causado, ejecutado: calc.totales.ejecutado, proyeccion: calc.totales.proyeccion, tasaPond: wAll, puntos: pts, tasas: tasasT.map(x => ({ banco: x.banco, nominal: nominalDe(x.banco), efectiva12: x.efectiva12, actual: x.actual, min: x.min, max: x.max, tend: x.tend, meses: x.meses, serie: x.serie })) },
  };
}

module.exports = { generarInformeCfoXlsx };
