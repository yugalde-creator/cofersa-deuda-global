/**
 * Genera el archivo mensual "Apartado_Intereses_COFERSA_<Mes>Año_Proy<Mes>Año.xlsx"
 * con el mismo formato de siempre: Resumen · Causado · Ejecutado · Proyección.
 * Datos: lib/intereses.js (planes de pago del Sheet, devengo diario real/360).
 */
const ExcelJS = require('exceljs');
const { calcularIntereses } = require('./intereses');

const MES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ABR = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const up = s => s.toUpperCase();

const C = { navy: 'FF1F3864', blue: 'FF2E75B6', pale: 'FFEBF3FC', band: 'FFDCE6F1', white: 'FFFFFFFF', line: 'FFB8CCE4', blueTxt: 'FF0070C0', red: 'FFC00000', orange: 'FFFF6600', gold: 'FFFFE699', note: 'FFFFFDE7', noteTxt: 'FF7F6000' };
const solid = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } });
const thin = { style: 'thin', color: { argb: C.line } };
const box = { left: thin, right: thin, top: thin, bottom: thin };
const font = (o = {}) => ({ name: 'Arial', size: 10, color: { argb: 'FF000000' }, ...o });

function fmtDate(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }
function isoToDate(s) { return s ? new Date(s + 'T00:00:00Z') : null; }
function nowCR() {
  const p = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
}
function banner(ws, lastCol, text1, text2, text3) {
  const defs = [[1, text1, { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }, C.navy, 27], [2, text2, { size: 10, color: { argb: 'FFFFFFFF' } }, C.blue, 16.5], [3, text3, { italic: true, size: 9, color: { argb: C.navy } }, C.pale, 13.5]];
  defs.forEach(([r, t, f, bg, h]) => {
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    const c = ws.getCell(`A${r}`); c.value = t; c.font = font(f); c.fill = solid(bg);
    c.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(r).height = h;
  });
  ws.getRow(4).height = 3.75;
}
function header(ws, row, titles, wrap = true) {
  titles.forEach((t, i) => {
    const c = ws.getCell(row, i + 1); c.value = t; c.font = font({ bold: true, color: { argb: 'FFFFFFFF' } });
    c.fill = solid(C.navy); c.border = box; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: wrap };
  });
  ws.getRow(row).height = 27;
}
function dataCell(c, band, { nf, align = 'left', color, bold } = {}) {
  c.font = font({ color: { argb: color || 'FF000000' }, bold: !!bold }); c.fill = solid(band ? C.band : C.white); c.border = box;
  c.alignment = { horizontal: align, vertical: 'middle' }; if (nf) c.numFmt = nf;
}
function totalRows(ws, firstRow, lastRow, ncols, amountCol, curCol, sums) {
  const L = n => String.fromCharCode(64 + n);
  const rng = (col) => `${L(col)}${firstRow}:${L(col)}${lastRow}`;
  const out = {};
  [['CRC', 'TOTAL CRC'], ['USD', 'TOTAL USD']].forEach(([cur, label], k) => {
    const r = lastRow + 1 + k;
    for (let col = 1; col <= ncols; col++) { const c = ws.getCell(r, col); c.fill = solid(C.navy); c.border = box; c.font = font({ bold: true, color: { argb: C.gold } }); }
    const a = ws.getCell(r, 1); a.value = label; a.alignment = { horizontal: 'center', vertical: 'middle' };
    const t = ws.getCell(r, amountCol); t.numFmt = '#,##0.00'; t.alignment = { horizontal: 'right', vertical: 'middle' };
    const has = lastRow >= firstRow;
    t.value = has ? { formula: `SUMIF(${rng(curCol)},"${cur}",${rng(amountCol)})`, result: sums[cur.toLowerCase()] } : 0;
    ws.getRow(r).height = 15; out[cur] = r;
  });
  return out;
}
const sumCur = (rows, cur) => Math.round(rows.filter(r => r.moneda === cur).reduce((s, r) => s + r.interes, 0) * 100) / 100;
const bancoTxt = r => (r.tipo === 'Leasing' ? `${r.banco} (Leasing)` : r.banco);
const opCell = r => (/^\d+$/.test(r.op) && r.op.length < 16 ? Number(r.op) : r.op);

/** Devuelve { buffer, filename, resumen } para el mes anterior (o el indicado: anio/mes = mes causado). */
async function generarApartadoXlsx(anio, mes) {
  if (!anio || !mes) {
    const h = new Date();
    if (h.getMonth() === 0) { anio = h.getFullYear() - 1; mes = 12; } else { anio = h.getFullYear(); mes = h.getMonth(); }
  }
  const r = await calcularIntereses(anio, mes);
  const sig = r.siguiente;
  const nm = `${ABR[mes]}_${anio}`, ns = `${ABR[sig.mes]}_${sig.anio}`;
  const ini = new Date(anio, mes - 1, 1), fin = new Date(anio, mes, 0), iniS = new Date(sig.anio, sig.mes - 1, 1), finS = new Date(sig.anio, sig.mes, 0);
  const lblMes = `${MES[mes]} ${anio}`, lblSig = `${MES[sig.mes]} ${sig.anio}`;
  const nAct = new Set(r.causado.map(x => x.op)).size;
  const nAct2 = new Set(r.proyeccion.map(x => x.op)).size;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Deuda Global — Cofersa'; wb.created = new Date();

  // ───────────── Resumen ─────────────
  const rs = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: C.blue } }, views: [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6' }] });
  [37.63, 10.75, 20.13, 10.75, 20.13].forEach((w, i) => { rs.getColumn(i + 1).width = w; });
  // se completa luego con fórmulas (necesita filas de totales de las otras hojas)

  // ───────────── Causado ─────────────
  const cs = wb.addWorksheet(`Causado_${nm}`, { properties: { tabColor: { argb: C.navy } }, views: [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6' }] });
  [15.13, 16.38, 9.5, 20.75, 11.38, 13.88, 13.88, 13.88, 13.88, 19.5].forEach((w, i) => { cs.getColumn(i + 1).width = w; });
  banner(cs, 'J', `COFERSA — CONTROL DE APARTADO DE INTERESES — CAUSADO ${up(lblMes)}`,
    'Capital = Saldo al inicio del período  |  Desde/Hasta = días devengados en el mes  |  Interés = devengo diario según plan de pagos del banco',
    `Período: ${fmtDate(ini)} – ${fmtDate(fin)}  |  ${nAct} operaciones activas  |  Base 360 días reales (convención bancaria)`);
  header(cs, 5, ['Banco', 'N° Operación', 'Moneda', 'Capital Causado', 'Tasa (%)', 'Fecha Pago', 'Desde', 'Hasta', 'Días Causados', 'Interés Causado']);
  r.causado.forEach((x, i) => {
    const row = 6 + i, b = i % 2 === 1;
    const vals = [bancoTxt(x), opCell(x), x.moneda, x.capital, x.tasa, isoToDate(x.fechaPago) || '—', isoToDate(x.desde), isoToDate(x.hasta), x.dias, x.interes];
    vals.forEach((v, k) => { const c = cs.getCell(row, k + 1); c.value = v; });
    dataCell(cs.getCell(row, 1), b); dataCell(cs.getCell(row, 2), b); dataCell(cs.getCell(row, 3), b);
    dataCell(cs.getCell(row, 4), b, { nf: '#,##0.00', align: 'right', color: C.blueTxt });
    dataCell(cs.getCell(row, 5), b, { nf: '0.00%', align: 'right' });
    [6, 7, 8].forEach(k => dataCell(cs.getCell(row, k), b, { nf: 'dd/mm/yyyy', align: 'center' }));
    dataCell(cs.getCell(row, 9), b, { nf: '#,##0', align: 'right' });
    dataCell(cs.getCell(row, 10), b, { nf: '#,##0.00', align: 'right', color: C.blueTxt });
    cs.getRow(row).height = 13.5;
  });
  const cLast = 5 + r.causado.length;
  const cTot = totalRows(cs, 6, cLast, 10, 10, 3, r.totales.causado);

  // ───────────── Ejecutado ─────────────
  const es = wb.addWorksheet(`Ejecutado_${nm}`, { views: [{ state: 'normal' }] });
  [15.13, 17.63, 9.5, 15.13, 20.75].forEach((w, i) => { es.getColumn(i + 1).width = w; });
  banner(es, 'E', `COFERSA — EJECUTADO REAL DE INTERESES — ${up(lblMes)}`,
    'Cuotas con Estado = Pagado/Conciliado realizadas en el período  |  Interés según plan del banco',
    `Período: ${lblMes}  |  ${r.ejecutado.length} pagos registrados`);
  header(es, 5, ['Banco', 'N° Operación', 'Moneda', 'Fecha Pago', 'Interés Pagado']);
  let eLast = 5;
  if (!r.ejecutado.length) {
    es.mergeCells('A6:E6'); const c = es.getCell('A6'); c.value = 'Sin pagos de intereses en este período';
    c.font = font({ italic: true, color: { argb: 'FF888888' } }); c.alignment = { horizontal: 'center' };
  } else {
    r.ejecutado.forEach((x, i) => {
      const row = 6 + i, b = i % 2 === 1; eLast = row;
      [bancoTxt(x), opCell(x), x.moneda, isoToDate(x.fecha), x.interes].forEach((v, k) => { es.getCell(row, k + 1).value = v; });
      dataCell(es.getCell(row, 1), b); dataCell(es.getCell(row, 2), b); dataCell(es.getCell(row, 3), b);
      dataCell(es.getCell(row, 4), b, { nf: 'dd/mm/yyyy', align: 'center' });
      dataCell(es.getCell(row, 5), b, { nf: '#,##0.00', align: 'right', color: C.blueTxt });
      es.getRow(row).height = 13.5;
    });
  }
  const eTot = totalRows(es, 6, r.ejecutado.length ? eLast : 6, 5, 5, 3, r.totales.ejecutado);

  // ───────────── Proyección ─────────────
  const ps = wb.addWorksheet(`Proyeccion_${ns}`, { properties: { tabColor: { argb: C.orange } }, views: [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6' }] });
  [15.13, 16.38, 9.5, 22, 11.38, 13.88, 13.88, 15.75, 20.75].forEach((w, i) => { ps.getColumn(i + 1).width = w; });
  banner(ps, 'I', `COFERSA — PROYECCIÓN INTERESES PRÓXIMO PAGO — ${up(lblSig)}`,
    'Capital = Saldo vigente al iniciar el mes  |  Base 360 días reales  |  * Sujeto a variación por amortizaciones y tasas variables',
    `Período proyectado: ${fmtDate(iniS)} – ${fmtDate(finS)}  |  ${nAct2} operaciones activas`);
  header(ps, 5, ['Banco', 'N° Operación', 'Moneda', 'Capital Proyectado', 'Tasa (%)', 'Desde', 'Hasta', 'Días Proyectados', 'Interés Proyectado']);
  r.proyeccion.forEach((x, i) => {
    const row = 6 + i, b = i % 2 === 1;
    [bancoTxt(x), opCell(x), x.moneda, x.capital, x.tasa, isoToDate(x.desde), isoToDate(x.hasta), x.dias, x.interes].forEach((v, k) => { ps.getCell(row, k + 1).value = v; });
    dataCell(ps.getCell(row, 1), b); dataCell(ps.getCell(row, 2), b); dataCell(ps.getCell(row, 3), b);
    dataCell(ps.getCell(row, 4), b, { nf: '#,##0.00', align: 'right', color: C.blueTxt });
    dataCell(ps.getCell(row, 5), b, { nf: '0.00%', align: 'right' });
    [6, 7].forEach(k => dataCell(ps.getCell(row, k), b, { nf: 'dd/mm/yyyy', align: 'center' }));
    dataCell(ps.getCell(row, 8), b, { nf: '#,##0', align: 'right' });
    dataCell(ps.getCell(row, 9), b, { nf: '#,##0.00', align: 'right', color: C.blueTxt });
    ps.getRow(row).height = 13.5;
  });
  const pLast = 5 + r.proyeccion.length;
  const pTot = totalRows(ps, 6, pLast, 9, 9, 3, r.totales.proyeccion);

  // ───────────── Resumen (con fórmulas hacia las hojas) ─────────────
  banner(rs, 'E', 'COFERSA — RESUMEN EJECUTIVO — APARTADO DE INTERESES',
    `Mes anterior: ${lblMes}   |   Mes en curso: ${lblSig}`,
    `Generado automáticamente el ${nowCR()}  |  Valores en moneda original`);
  const section = (row, title) => {
    rs.mergeCells(`A${row}:E${row}`);
    for (let col = 1; col <= 5; col++) rs.getCell(row, col).border = { top: thin, bottom: thin, ...(col === 1 ? { left: thin } : {}), ...(col === 5 ? { right: thin } : {}) };
    const c = rs.getCell(`A${row}`); c.value = title; c.font = font({ bold: true, size: 11, color: { argb: 'FFFFFFFF' } }); c.fill = solid(C.blue);
    c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = { left: thin, top: thin, bottom: thin }; rs.getRow(row).height = 19.5;
  };
  const head = row => { header(rs, row, ['Concepto', 'Moneda', 'Importe CRC', 'Moneda', 'Importe USD'], false); rs.getRow(row).height = 18; };
  const line = (row, label, bandOn, crc, usd, color, bold) => {
    const vals = [label, 'CRC', crc, 'USD', usd];
    vals.forEach((v, k) => { rs.getCell(row, k + 1).value = v; });
    [1, 2, 3, 4, 5].forEach(k => {
      const isAmt = k === 3 || k === 5;
      dataCell(rs.getCell(row, k), bandOn, { nf: isAmt ? '#,##0.00' : undefined, align: k === 1 ? 'left' : (isAmt ? 'right' : 'center'), color: isAmt ? color : 'FF000000', bold: k !== 1 || bold });
    });
    rs.getRow(row).height = 15;
  };
  const cc = `Causado_${nm}`, ee = `Ejecutado_${nm}`, pp = `Proyeccion_${ns}`;
  const tC = r.totales.causado, tE = r.totales.ejecutado, tP = r.totales.proyeccion;
  section(5, `MES ANTERIOR — ${up(lblMes)}`); head(6);
  line(7, 'Interés Causado (devengado contablemente)', false, { formula: `${cc}!J${cTot.CRC}`, result: tC.crc }, { formula: `${cc}!J${cTot.USD}`, result: tC.usd }, C.blueTxt);
  line(8, 'Interés Ejecutado Real (pagado al banco)', true, { formula: `${ee}!E${eTot.CRC}`, result: tE.crc }, { formula: `${ee}!E${eTot.USD}`, result: tE.usd }, C.blueTxt);
  line(9, 'Diferencia Causado − Ejecutado', false, { formula: 'C7-C8', result: Math.round((tC.crc - tE.crc) * 100) / 100 }, { formula: 'E7-E8', result: Math.round((tC.usd - tE.usd) * 100) / 100 }, C.red, true);
  section(11, `MES EN CURSO — ${up(lblSig)}`); head(12);
  line(13, 'Interés Proyectado (apartado sugerido )', false, { formula: `${pp}!I${pTot.CRC}`, result: tP.crc }, { formula: `${pp}!I${pTot.USD}`, result: tP.usd }, C.orange);
  rs.mergeCells('A16:E16');
  for (let col = 1; col <= 5; col++) rs.getCell(16, col).border = { top: thin, bottom: thin, ...(col === 1 ? { left: thin } : {}), ...(col === 5 ? { right: thin } : {}) };
  const n = rs.getCell('A16');
  n.value = "NOTA: La diferencia causado/ejecutado puede originarse por: (1) amortizaciones de capital dentro del período, (2) desfase entre fecha de corte contable y bancario, (3) ajuste de días hábiles bancarios. Interés causado = devengo diario real/360 del plan de pagos del banco; interés ejecutado = interés de las cuotas pagadas (Pagado/Conciliado) con fecha en el período.";
  n.font = font({ italic: true, size: 9, color: { argb: C.noteTxt } }); n.fill = solid(C.note); n.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; n.border = { left: thin, top: thin, bottom: thin }; rs.getRow(16).height = 39;
  rs.getRow(10).height = 15;

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = `Apartado_Intereses_COFERSA_${ABR[mes]}${anio}_Proy${ABR[sig.mes]}${sig.anio}.xlsx`;
  return { buffer, filename, resumen: { mes: lblMes, sig: lblSig, causado: tC, ejecutado: tE, proyeccion: tP, operaciones: nAct } };
}

module.exports = { generarApartadoXlsx };
