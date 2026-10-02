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
    // Un pago con interés 0 (abono extraordinario a capital, o primera cuota sin interés)
    // no cierra el período: el interés de esos días se liquida en la siguiente cuota.
    if (!(c.interes > 0)) { if (c.frontera && (!prev || c.fecha > prev)) prev = c.fecha; continue; }
    // Operación cancelada sin fecha de inicio: se asume un período de un mes hacia atrás.
    if (!prev && inst.tipo === 'Cancelada') prev = new Date(c.fecha.getFullYear(), c.fecha.getMonth() - 1, c.fecha.getDate());
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
  if (!dias || (inst.tipo === 'Cancelada' && !(interes > 0))) return null;

  // Capital = saldo vigente al iniciar el período (antes de las amortizaciones del mes).
  const pagadoAntes = cuotas.filter(c => c.fecha < ini).reduce((s, c) => s + c.capital, 0);
  const capital = Math.max(r2((inst.aprobado || 0) - pagadoAntes), 0);
  const ult = cuotas.filter(c => c.interes > 0 && pagado(c.estado) && c.fecha < finEx).slice(-1)[0];
  const interesR = r2(interes);
  // Si la tasa del Sheet no es válida (p. ej. una fecha en la celda), se muestra la implícita en el plan.
  const tasa = (inst.tasa > 0 && inst.tasa < 0.5) ? inst.tasa : (capital > 0 ? r2(interesR * 360 / (capital * dias) * 10000) / 10000 : 0);
  return {
    banco: inst.banco, op: inst.op, moneda: inst.moneda, tipo: inst.tipo, capital, tasa,
    fechaPago: ult ? iso(ult.fecha) : null,
    desde: iso(primero), hasta: iso(ultimo), dias, interes: interesR,
  };
}

/** Interés pagado en el mes: interés REAL conciliado cuando existe; si no, el del plan (cuota marcada Pagado). */
function ejecutadoDelMes(instrumentos, anio, mes) {
  const ini = new Date(anio, mes - 1, 1), finEx = new Date(anio, mes, 1);
  const fila = (inst, fecha, interes, fuente) => ({ banco: inst.banco, op: inst.op, moneda: inst.moneda, tipo: inst.tipo, fecha: iso(fecha), interes: r2(interes), fuente });
  const out = [], cubiertas = new Set();
  (instrumentos.reales || []).forEach(h => {
    if (!(h.interes > 0)) return;
    const c = h.inst.cuotas.find(x => !cubiertas.has(x) && x.interes > 0 && pagado(x.estado) && Math.abs(x.fecha - h.fecha) <= 4 * DAY);
    if (c) cubiertas.add(c);
    if (h.fecha >= ini && h.fecha < finEx) out.push(fila(h.inst, h.fecha, h.interes, 'Real'));
  });
  instrumentos.forEach(i => { if (i.tipo === 'Cancelada') return; i.cuotas.forEach(c => {
    if (!cubiertas.has(c) && c.fecha && pagado(c.estado) && c.interes > 0 && c.fecha >= ini && c.fecha < finEx) out.push(fila(i, c.fecha, c.interes, 'Plan'));
  }); });
  return out;
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

/** Tasa implícita en el plan (mediana de interés×360/(saldo×días) de las cuotas con interés). */
function tasaImplicita(inst) {
  let prev = inst.inicio, saldo = inst.aprobado; const v = [];
  [...inst.cuotas].filter(c => c.fecha).sort((a, b) => a.fecha - b.fecha).forEach(c => {
    if (c.interes > 0 && saldo > 1 && prev && c.fecha > prev) v.push(c.interes * 360 / (saldo * Math.round((c.fecha - prev) / DAY)));
    if (c.interes > 0) prev = c.fecha;
    saldo -= c.capital;
  });
  v.sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
}

/** Arma los instrumentos (operaciones + leasing) a partir de las filas crudas del Sheet. */
/** Interés real confiable de un pago conciliado (la hoja a veces trae el interés o el total dañado). */
function sanear(monto, cap, int) {
  if (int === null) return null;
  const c = cap || 0, sum = c + int;
  const montoOk = monto > 0 && monto < 1e11 && monto >= c;
  if (montoOk) return Math.abs(monto - sum) <= 0.05 ? int : r2(monto - c);
  return int;
}
const NUM_BLANK = v => v === undefined || v === null || String(v).trim() === '';

/**
 * Sustituye capital/interés de las cuotas pagadas por los montos REALES conciliados (Pagos_Historicos)
 * cuando existen: el banco aplica el capital real, que puede diferir del plan por centavos o decenas de
 * dólares, y el saldo de la app debe seguir al banco. items: [{fecha:'YYYY-MM-DD'|Date, capital, interes, estado}]
 * historicos: filas de Pagos_Historicos de esa línea. Devuelve la lista de coincidencias [{item, real}].
 */
function aplicarRealesAPlan(items, historicos, parseMonto, fmtDate) {
  const usados = new Set(), out = [];
  const toD = f => (f instanceof Date ? f : dateOf(fmtDate(f)));
  historicos.forEach(h => {
    const hf = dateOf(fmtDate(h.Fecha)); if (!hf) return;
    const monto = parseMonto(h.Monto), cap = NUM_BLANK(h.CapitalReal) ? null : parseMonto(h.CapitalReal);
    const intRaw = NUM_BLANK(h.InteresReal) ? null : parseMonto(h.InteresReal);
    const interes = sanear(monto, cap, intRaw);
    if (cap === null && !(interes > 0)) return;
    const it = items.find(x => !usados.has(x) && pagado(x.estado) && toD(x.fecha) && Math.abs(toD(x.fecha) - hf) <= 4 * DAY);
    if (!it) return;
    usados.add(it);
    // Solo diferencias materiales (>= 1): el capital real anotado a mano a veces viene redondeado (centavos).
    if (cap !== null && cap >= 0 && cap < 1e11 && Math.abs(cap - it.capital) >= 1) it.capital = cap;
    if (interes > 0) it.interes = interes;
    it.fechaReal = iso(hf);
    out.push({ item: it, real: { fecha: hf, capital: cap, interes } });
  });
  return out;
}

function armarInstrumentos({ activas, pagosProg, leasing, leasingPagos, historicos = [], canceladas = [] }, parseMonto, fmtDate) {
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
    id: a.ID, banco: a.Banco, op: (a.NumOp || '').toString().replace(/^'/, ''), moneda: (a.Moneda || 'CRC').toString().trim().toUpperCase(), tipo: 'Operación',
    aprobado: parseMonto(a.Aprobado), tasa: normTasa(parseMonto(a.Tasa)), inicio: dateOf(fmtDate(a.FechaInicio)), cuotas: planes[a.ID] || [],
  }));
  const leas = leasing.map(l => ({
    banco: l.Banco, op: (l.NumOp || '').toString().replace(/^'/, ''), moneda: (l.Moneda || 'USD').toString().trim().toUpperCase(), tipo: 'Leasing',
    aprobado: parseMonto(l.Monto), tasa: normTasa(parseMonto(l.Tasa)), inicio: dateOf(fmtDate(l.FechaInicio)), cuotas: planesL[l.ID] || [],
  }));
  // Si la celda Tasa del Sheet no es válida (p. ej. quedó como fecha), se usa la implícita en el plan.
  [...ops, ...leas].forEach(i => { if (!(i.tasa > 0 && i.tasa < 0.5)) i.tasa = tasaImplicita(i); });

  // Pagos reales conciliados (Pagos_Historicos): interés real del banco, también de operaciones ya canceladas.
  const porId = Object.fromEntries(ops.map(o => [o.id, o]));
  const canIdx = {}; canceladas.forEach(c => { if (c.IDOriginal) canIdx[c.IDOriginal] = c; if (c.ID) canIdx[c.ID] = c; });
  const pseudo = {}, reales = [];
  historicos.forEach(h => {
    const fecha = dateOf(fmtDate(h.Fecha)); if (!fecha) return;
    const monto = parseMonto(h.Monto), cap = NUM_BLANK(h.CapitalReal) ? null : parseMonto(h.CapitalReal);
    const intRaw = NUM_BLANK(h.InteresReal) ? null : parseMonto(h.InteresReal);
    const interes = sanear(monto, cap, intRaw);
    let inst = porId[h.ID_Linea];
    if (inst && !inst._realesAplicados) {
      inst._realesAplicados = true;
      aplicarRealesAPlan(inst.cuotas, historicos.filter(x => x.ID_Linea === inst.id), parseMonto, fmtDate);
    }
    if (!inst) {
      inst = pseudo[h.ID_Linea];
      if (!inst) {
        const c = canIdx[h.ID_Linea];
        const moneda = c ? (c.Moneda || 'CRC').toString().trim().toUpperCase() : ((cap || monto) >= 5e6 ? 'CRC' : 'USD'); // sin IDOriginal: se infiere por magnitud
        inst = pseudo[h.ID_Linea] = { id: h.ID_Linea, banco: h.Banco || (c && c.Banco) || '', op: 'Cancelada', moneda, tipo: 'Cancelada',
          aprobado: c ? parseMonto(c.Monto) : 0, tasa: c ? normTasa(parseMonto(c.Tasa)) : 0, inicio: null /* el período lo marca el pago anterior; sin él se asume un mes */, cuotas: [] };
      }
      inst.cuotas.push({ fecha, capital: cap || 0, interes: interes > 0 ? interes : 0, estado: 'Pagado', frontera: interes === null });
    }
    reales.push({ inst, fecha, interes, capital: cap });
  });
  const out = [...ops, ...leas, ...Object.values(pseudo)];
  out.reales = reales;
  return out;
}

/** Calcula causado del período (anio/mes), ejecutado del mismo período y proyección del mes siguiente. */
function calcularDesdeInstrumentos(instrumentos, anio, mes) {
  const sig = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
  const causado = instrumentos.map(i => causadoDeInstrumento(i, anio, mes)).filter(Boolean).sort(orden);
  const ejecutado = (instrumentos.reales ? ejecutadoDelMes(instrumentos, anio, mes) : instrumentos.flatMap(i => ejecutadoDeInstrumento(i, anio, mes))).sort(orden);
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
  const [activas, pagosProg, leasing, leasingPagos, historicos, canceladas] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readPP(), readRows(SHEETS.LEASING), readRows(SHEETS.LEASING_PAGOS),
    readRows(SHEETS.PAGOS_HIST), readRows(SHEETS.CANCELADAS),
  ]);
  return calcularDesdeInstrumentos(armarInstrumentos({ activas, pagosProg, leasing, leasingPagos, historicos, canceladas }, parseMonto, fmtDate), anio, mes);
}

module.exports = { calcularIntereses, calcularDesdeInstrumentos, armarInstrumentos, causadoDeInstrumento, aplicarRealesAPlan };
