/**
 * Cálculo de intereses causados / ejecutados / proyectados (operaciones y leasing).
 *
 * Causado = devengo diario: el interés de cada cuota del plan de pagos se reparte
 * por día entre la cuota anterior (o el inicio de la operación) y su fecha, y se
 * suman los días que caen dentro del mes consultado. Así el causado refleja el
 * saldo real de cada día (no el saldo de hoy) y respeta la base de cada banco
 * (los planes ya traen el interés calculado por el banco).
 * Todos los montos se leen con parseMonto() (formato europeo del Sheet).
 */
const DAY = 86400000;

function dateOf(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? null : d;
}
function iso(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function overlapDays(a0, a1, b0, b1) {
  const s = Math.max(a0, b0), e = Math.min(a1, b1);
  return Math.max(0, Math.round((e - s) / DAY));
}
function r2(n) { return Math.round(n * 100) / 100; }
function normTasa(t) { return t > 1 ? t / 100 : t; }
const pagado = e => e === 'Pagado' || e === 'Conciliado';

/**
 * inst: { banco, op, moneda, tipo, aprobado, tasa, inicio (Date|null), cuotas:[{fecha:Date, capital, interes, estado}] }
 * Devuelve la fila de causado del mes (anio, mes) o null si no devenga nada.
 */
function causadoDeInstrumento(inst, anio, mes) {
  const ini = new Date(anio, mes - 1, 1);
  const finEx = new Date(anio, mes, 1);
  const cuotas = inst.cuotas.filter(c => c.fecha).sort((a, b) => a.fecha - b.fecha);
  if (!cuotas.length) return null;

  let prev = inst.inicio || null;
  let interes = 0, dias = 0, primero = null, ultimo = null;
  for (const c of cuotas) {
    if (prev && c.fecha > prev) {
      const periodDays = Math.round((c.fecha - prev) / DAY);
      const ov = overlapDays(prev, c.fecha, ini, finEx);
      if (ov > 0 && periodDays > 0) {
        interes += c.interes * ov / periodDays;
        dias += ov;
        const s = new Date(Math.max(prev, ini)), e = new Date(Math.min(c.fecha, finEx) - DAY);
        if (!primero || s < primero) primero = s;
        if (!ultimo || e > ultimo) ultimo = e;
      }
    }
    if (!prev || c.fecha > prev) prev = c.fecha;
  }
  if (!dias) return null;

  const corte = new Date(finEx - DAY);
  const pagadoHasta = cuotas.filter(c => c.fecha <= corte).reduce((s, c) => s + c.capital, 0);
  const capital = Math.max(r2((inst.aprobado || 0) - pagadoHasta), 0);
  return {
    banco: inst.banco, op: inst.op, moneda: inst.moneda, tipo: inst.tipo, capital, tasa: inst.tasa,
    desde: iso(primero), hasta: iso(ultimo), dias, interes: r2(interes),
  };
}

function ejecutadoDeInstrumento(inst, anio, mes) {
  const ini = new Date(anio, mes - 1, 1), finEx = new Date(anio, mes, 1);
  const filas = inst.cuotas.filter(c => c.fecha && pagado(c.estado) && c.fecha >= ini && c.fecha < finEx && c.interes > 0);
  return filas.map(c => ({ banco: inst.banco, op: inst.op, moneda: inst.moneda, tipo: inst.tipo, fecha: iso(c.fecha), interes: r2(c.interes) }));
}

function totales(filas) {
  return filas.reduce((t, f) => { if (f.moneda === 'USD') t.usd += f.interes; else t.crc += f.interes; return t; }, { crc: 0, usd: 0 });
}
function round2(t) { return { crc: r2(t.crc), usd: r2(t.usd) }; }
const orden = (a, b) => (a.moneda + a.banco + a.op).localeCompare(b.moneda + b.banco + b.op);

/** Arma los instrumentos (operaciones + leasing) a partir de las filas crudas del Sheet. */
function armarInstrumentos({ activas, pagosProg, leasing, leasingPagos }, parseMonto, fmtDate) {
  const planes = {};
  pagosProg.forEach(p => {
    const id = p.ID_Linea; if (!id) return;
    (planes[id] = planes[id] || []).push({ fecha: dateOf(fmtDate(p.Fecha)), capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), estado: (p.Estado || '').toString().trim() });
  });
  const planesL = {};
  leasingPagos.forEach(p => {
    const id = p.ID_Contrato; if (!id) return;
    (planesL[id] = planesL[id] || []).push({
      fecha: dateOf(fmtDate(p.Fecha)), capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), estado: (p.Estado || '').toString().trim(),
    });
  });
  const ops = activas.map(a => ({
    banco: a.Banco, op: (a.NumOp || '').toString().replace(/^'/, ''), moneda: (a.Moneda || 'CRC').toString().trim().toUpperCase(), tipo: 'Operación',
    aprobado: parseMonto(a.Aprobado), tasa: normTasa(parseMonto(a.Tasa)), inicio: dateOf(fmtDate(a.FechaInicio)), cuotas: planes[a.ID] || [],
  }));
  const leas = leasing.map(l => ({
    banco: l.Banco, op: (l.NumOp || '').toString().replace(/^'/, ''), moneda: (l.Moneda || 'USD').toString().trim().toUpperCase(), tipo: 'Leasing',
    aprobado: parseMonto(l.Monto), tasa: normTasa(parseMonto(l.Tasa)), inicio: dateOf(fmtDate(l.FechaInicio)), cuotas: planesL[l.ID] || [],
  }));
  return [...ops, ...leas];
}

/** Calcula causado del período (anio/mes), ejecutado del mismo período y proyección del mes siguiente. */
function calcularDesdeInstrumentos(instrumentos, anio, mes) {
  const sig = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
  const causado = instrumentos.map(i => causadoDeInstrumento(i, anio, mes)).filter(Boolean).sort(orden);
  const ejecutado = instrumentos.flatMap(i => ejecutadoDeInstrumento(i, anio, mes)).sort(orden);
  const proyeccion = instrumentos.map(i => causadoDeInstrumento(i, sig.anio, sig.mes)).filter(Boolean).sort(orden);
  const tC = round2(totales(causado)), tE = round2(totales(ejecutado)), tP = round2(totales(proyeccion));
  return {
    periodo: { anio, mes }, siguiente: sig, causado, ejecutado, proyeccion,
    totales: { causado: tC, ejecutado: tE, proyeccion: tP, diferencia: { crc: r2(tC.crc - tE.crc), usd: r2(tC.usd - tE.usd) } },
  };
}

async function calcularIntereses(anio, mes) {
  const { readRows, SHEETS, fmtDate } = require('./sheets');
  const { readPP, parseMonto } = require('./backend');
  const [activas, pagosProg, leasing, leasingPagos] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readPP(), readRows(SHEETS.LEASING), readRows(SHEETS.LEASING_PAGOS),
  ]);
  return calcularDesdeInstrumentos(armarInstrumentos({ activas, pagosProg, leasing, leasingPagos }, parseMonto, fmtDate), anio, mes);
}

module.exports = { calcularIntereses, calcularDesdeInstrumentos, armarInstrumentos, causadoDeInstrumento };
