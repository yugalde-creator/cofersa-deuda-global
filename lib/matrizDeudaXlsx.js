/**
 * Matriz de deuda mensual de COFERSA en el formato de tesorería (hoja "Sep 26" del archivo de tendencia):
 * encabezado TBP/SOFR/Prime/TC · Línea + pagarés por banco y moneda · Disponible · Tasa ponderada · Condición.
 * Saldos al cierre del mes (los mismos del informe del CFO). Montos en unidades; el formato los muestra "En Miles".
 */
const ExcelJS = require('exceljs');
const { generarInformeCfoXlsx } = require('./informeCfoXlsx');
const { GARANTIA } = require('./condiciones');

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ABR = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
const BANCOS = ['BCT', 'Davivienda', 'BAC', 'BCR'];
// Moneda de la línea y vencimiento de la línea, tal como figuran en la matriz de tesorería.
const LINEAS = { BCT: { mon: '$', venc: null }, Davivienda: { mon: '$', venc: '2025-12-30' }, BAC: { mon: '$', venc: '2026-10-31' }, BCR: { mon: 'Cln', venc: '2026-10-31' } };
// Líneas según la matriz de tesorería (US$ salvo BCR, que es en colones). opts.limites las puede sobrescribir.
const LIM_USD = { BCT: 10000000, Davivienda: 4000000, BAC: 2000000 };
const LIM_CRC = { BCR: 900000000 };

const F = (o = {}) => ({ name: 'Arial', size: 8, ...o });
const solid = a => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: a }, bgColor: { argb: a } });
const thin = { style: 'thin', color: { argb: 'FF000000' } };
const MILES = '#,##0,';
const RED = 'FFFF0000', BLUE = 'FF0000FF', YEL = 'FFFFFF00';
const dt = d => (d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null);
const isoDt = s => (s ? new Date(s + 'T00:00:00Z') : null);
const spreadDe = c => { const m = String(c || '').match(/([\d.]+)\s*%?\s*$/); return m ? parseFloat(m[1]) : null; };

/** opts: { tc, tbp, sofr, prime } (fracciones para tbp/sofr/prime). Devuelve { buffer, filename, resumen }. */
async function generarMatrizDeudaXlsx(anio, mes, opts = {}) {
  const d = await generarInformeCfoXlsx(anio, mes, { soloDatos: true });
  const { rows, ANIO, MES, FIN } = d, bancosLim = d.bancosLim;
  const TC = opts.tc || d.TC;
  // TBP / SOFR / Prime: opcionales en la hoja Config (claves TBP, SOFR, TasaPrime; en % o fracción).
  const tasaCfg = k => { const n = d.parseMonto(d.cfg[k]); return n ? (n > 1 ? n / 100 : n) : undefined; };
  if (opts.tbp === undefined) opts.tbp = tasaCfg('TBP');
  if (opts.sofr === undefined) opts.sofr = tasaCfg('SOFR');
  if (opts.prime === undefined) opts.prime = tasaCfg('TasaPrime');

  const wb = new ExcelJS.Workbook(); wb.creator = 'Deuda Global — Cofersa'; wb.calcProperties = { fullCalcOnLoad: true };
  const ws = wb.addWorksheet(`${ABR[MES]} ${String(ANIO).slice(2)}`, { views: [{ state: 'frozen', ySplit: 8, showGridLines: false }] });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const widths = { A: 2, B: 5, C: 7, D: 11, E: 7, F: 12, G: 14, H: 14, I: 15, J: 15, K: 16, L: 12, M: 15, N: 7, O: 9, P: 11, Q: 12, R: 20, S: 8, T: 14, U: 16, V: 14 };
  Object.entries(widths).forEach(([k, w]) => { ws.getColumn(k).width = w; });

  // ---- encabezado de indicadores ----
  [['TBP actual', opts.tbp, '0.00%'], ['SOFR', opts.sofr, '0.00%'], ['Tasa Prime', opts.prime, '0.00%'], ['Tipo de Cambio', TC, '#,##0.00']].forEach(([k, v, nf], i) => {
    const r = 2 + i; const a = ws.getCell(r, 2); a.value = k; a.font = F({ bold: true });
    ws.mergeCells(r, 2, r, 2); const b = ws.getCell(r, 3); b.value = v === undefined ? null : v; b.numFmt = nf; b.font = F({ bold: true, color: { argb: BLUE } }); b.alignment = { horizontal: 'right' };
    a.border = { left: thin, top: i === 0 ? thin : undefined, bottom: i === 3 ? thin : undefined }; b.border = { right: thin, top: i === 0 ? thin : undefined, bottom: i === 3 ? thin : undefined };
  });
  ws.getCell('B7').value = 'En Miles'; ws.getCell('B7').font = F({ underline: true });
  ['H', 'J', 'K', 'L', 'O'].forEach(c => { const x = ws.getCell(`${c}7`); x.value = 'No tocar'; x.fill = solid(YEL); x.font = F({ bold: true }); x.alignment = { horizontal: 'center' }; });
  const heads = ['País', 'Empresa', 'Banco', 'Moneda', 'Tipo de Operación', 'Capital\n(Monto Línea-Préstamo)', 'Capital $\n(Monto Línea-Préstamo)', 'Monto del\nPagaré', 'Monto del Pagaré\n$', 'Monto del\nPagaré ₡', 'Disponible\n$', 'Disponible ₡', 'Tasa', 'Tasa\nPonderada', 'Vencimiento', 'Condición', 'Condición Original', 'Spread', 'Garantía', 'Condición\nAmortización'];
  heads.forEach((h, i) => { const c = ws.getCell(8, 2 + i); c.value = h; c.font = F({ bold: true, size: 9 }); c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = { top: thin, bottom: thin, left: i === 0 ? thin : undefined, right: i === heads.length - 1 ? thin : undefined }; if (i === 13) c.fill = solid(YEL); });
  ws.getRow(8).height = 34;

  // ---- datos por banco ----
  // La matriz de tesorería solo lleva pagarés: el leasing no entra en este reporte.
  const pag = rows.filter(r => r.tipo === 'Pagaré');
  const monCode = m => (m === 'USD' ? '$' : 'Cln');
  const orden = (a, b) => (a.mon === b.mon ? 0 : a.mon === 'USD' ? -1 : 1) || a.aprobado - b.aprobado || (a.vcto - b.vcto);
  const ROW0 = 9; let r = ROW0; const todas = []; const lineRows = [];
  const detalle = (x, rr) => {
    const nat = x.mon === 'USD' ? '$' : 'Cln', isLeas = x.tipo === 'Leasing', sp = isLeas ? null : spreadDe(x.cond);
    const c = (col, v, o = {}) => { const k = ws.getCell(rr, col); k.value = v; k.font = F({ color: o.color ? { argb: o.color } : undefined, bold: o.bold }); if (o.nf) k.numFmt = o.nf; k.alignment = { horizontal: o.al || 'right', vertical: 'middle' }; return k; };
    ['B', 'C', 'D', 'E', 'F'].forEach((col, i) => c(i + 2, ['CR', 'COF', x.banco, nat, isLeas ? 'Leasing' : 'Pagaré'][i], { al: 'center' }));
    c(7, x.aprobado, { nf: MILES });
    c(8, { formula: `IF(E${rr}="Cln",G${rr}/$C$5,G${rr})`, result: x.mon === 'USD' ? x.aprobado : x.aprobado / TC }, { nf: MILES });
    c(9, x.saldoFin, { nf: MILES });
    c(10, { formula: `IF(F${rr}="Linea","",IF(E${rr}="Cln",I${rr}/$C$5,I${rr}))`, result: x.mon === 'USD' ? x.saldoFin : x.saldoFin / TC }, { nf: MILES });
    c(11, { formula: `IF(F${rr}="Linea","",IF(E${rr}="$",I${rr}*$C$5,I${rr}))`, result: x.mon === 'USD' ? x.saldoFin * TC : x.saldoFin }, { nf: MILES });
    c(14, x.tasa * 100, { nf: '0.00', bold: true });
    c(16, dt(x.vcto), { nf: 'dd-mm-yy', al: 'center' });
    c(17, 'Var con Spread', { al: 'center' }); c(18, isLeas ? 'Leasing' : x.cond, { al: 'center' }); c(19, sp, { nf: '0.00', al: 'center' });
    c(20, x.garantia && x.garantia !== '—' ? x.garantia : (GARANTIA[x.banco] || ''), { al: 'center' }); c(21, 'Cuotas Niveladas', { al: 'center' });
  };
  const hasta = {}; // última fila de pagarés por banco (para Disponible)
  BANCOS.forEach(b => {
    const ops = pag.filter(x => x.banco === b).sort(orden); if (!ops.length) return;
    const ln = LINEAS[b], lr = r++; lineRows.push({ b, lr });
    const first = r;
    ops.forEach(x => { detalle(x, r); todas.push({ x, rr: r }); r++; });
    const last = r - 1; hasta[b] = [first, last];
    // fila de línea (roja)
    const lim = (opts.limites && opts.limites[b]) || (ln.mon === 'Cln' ? LIM_CRC[b] : LIM_USD[b]) || bancosLim[b] || 0;
    const cl = (col, v, o = {}) => { const k = ws.getCell(lr, col); k.value = v; k.font = F({ color: { argb: RED }, bold: o.bold }); if (o.nf) k.numFmt = o.nf; k.alignment = { horizontal: o.al || 'right', vertical: 'middle' }; return k; };
    ['CR', 'COF', b, ln.mon, 'Linea'].forEach((v, i) => cl(i + 2, v, { al: 'center' }));
    cl(7, lim, { nf: MILES }); ws.getCell(lr, 7).font = F({ color: { argb: BLUE } });
    const limUsd = ln.mon === 'Cln' ? lim / TC : lim;
    cl(8, { formula: `IF(E${lr}="Cln",G${lr}/$C$5,G${lr})`, result: limUsd }, { nf: MILES });
    const usado = ops.reduce((s, x) => s + (x.mon === 'USD' ? x.saldoFin : x.saldoFin / TC), 0);
    cl(12, { formula: `+H${lr}-SUM(J${first}:J${last})`, result: limUsd - usado }, { nf: MILES, bold: true });
    cl(13, { formula: `IF(L${lr}="","",L${lr}*$C$5)`, result: (limUsd - usado) * TC }, { nf: MILES, bold: true });
    cl(16, isoDt(ln.venc), { nf: 'dd/mm/yyyy', al: 'center' }); cl(17, 'Var con Spread', { al: 'center' });
    cl(22, { formula: `H${lr}-L${lr}`, result: usado }, { nf: MILES });
  });
  const lastPag = r - 1;
  // Tasa ponderada por banco y moneda (fórmula viva sobre el saldo en $)
  todas.forEach(({ x, rr }) => {
    const grp = todas.filter(t => t.x.banco === x.banco && t.x.mon === x.mon);
    const den = grp.reduce((s, t) => s + (t.x.mon === 'USD' ? t.x.saldoFin : t.x.saldoFin / TC), 0);
    const num = grp.reduce((s, t) => s + (t.x.mon === 'USD' ? t.x.saldoFin : t.x.saldoFin / TC) * t.x.tasa * 100, 0);
    const k = ws.getCell(rr, 15);
    k.value = { formula: `IF($F${rr}="Linea","",IFERROR(SUMPRODUCT(($D$${ROW0}:$D$${lastPag}=$D${rr})*($E$${ROW0}:$E$${lastPag}=$E${rr})*($F$${ROW0}:$F$${lastPag}<>"Linea")*$J$${ROW0}:$J$${lastPag}*$N$${ROW0}:$N$${lastPag})/SUMPRODUCT(($D$${ROW0}:$D$${lastPag}=$D${rr})*($E$${ROW0}:$E$${lastPag}=$E${rr})*($F$${ROW0}:$F$${lastPag}<>"Linea")*$J$${ROW0}:$J$${lastPag}),""))`, result: den ? num / den : 0 };
    k.numFmt = '0.00'; k.font = F(); k.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // ---- total ----
  r++;
  const totUSD = pag.filter(x => x.mon === 'USD').reduce((a, x) => a + x.saldoFin, 0), totCRC = pag.filter(x => x.mon === 'CRC').reduce((a, x) => a + x.saldoFin, 0);
  const rt = r;
  for (let c = 2; c <= 21; c++) { const k = ws.getCell(rt, c); k.font = F({ bold: true, size: 9 }); k.border = { top: thin, bottom: thin }; k.fill = solid('FFDDEBF7'); }
  ws.getCell(rt, 2).value = 'TOTAL DEUDA';
  const kJ = ws.getCell(rt, 10); kJ.value = { formula: `SUMIF($F$${ROW0}:$F$${lastPag},"Pagaré",J$${ROW0}:J$${lastPag})`, result: totUSD + totCRC / TC }; kJ.numFmt = MILES; kJ.alignment = { horizontal: 'right' };
  const kK = ws.getCell(rt, 11); kK.value = { formula: `SUMIF($F$${ROW0}:$F$${lastPag},"Pagaré",K$${ROW0}:K$${lastPag})`, result: totUSD * TC + totCRC }; kK.numFmt = MILES; kK.alignment = { horizontal: 'right' };
  ws.mergeCells(rt + 2, 2, rt + 2, 21);
  const nt = ws.getCell(rt + 2, 2);
  nt.value = `Cierre al ${FIN.getDate()} de ${MESES[MES].toLowerCase()} de ${ANIO}. Saldos del sistema Deuda Global conciliados con los estados de cuenta. Celdas en azul = datos de entrada; amarillo "No tocar" = fórmulas. Capital en moneda original, mostrado en miles. No incluye leasing.`;
  nt.font = F({ italic: true, color: { argb: 'FF7F6000' } }); nt.alignment = { wrapText: true };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer, filename: `Matriz_Deuda_COFERSA_${ABR[MES]}${ANIO}.xlsx`,
    resumen: { tc: TC, pagareUSD: totUSD, pagareCRC: totCRC, ops: pag.length, totalUSDeq: totUSD + totCRC / TC, totalCRCeq: totUSD * TC + totCRC },
  };
}

module.exports = { generarMatrizDeudaXlsx };
