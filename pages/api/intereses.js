/**
 * GET /api/intereses
 * Calcula causado, ejecutado y proyección de intereses
 * adaptado al schema de Cofersa Deuda Global.
 */
import { readRows, SHEETS } from '../../lib/sheets';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];

function ultimoDia(anio, mes) { return new Date(anio, mes, 0); }
function diasEntre(d1, d2)    { return Math.round((d2 - d1) / 86400000); }
function calcInt(cap, tasa, dias) {
  if (!cap || !tasa || dias <= 0) return 0;
  return Math.round(cap * (tasa / 365) * dias * 100) / 100;
}
function mesMenos1(f) {
  const m = f.getMonth() + 1, a = f.getFullYear();
  return m === 1 ? { anio: a-1, mes: 12 } : { anio: a, mes: m-1 };
}
function totales(filas) {
  return filas.reduce((t,f) => {
    if (f.moneda === 'USD') t.usd += f.interes;
    else t.crc += f.interes;
    return t;
  }, { crc: 0, usd: 0 });
}

export default async function handler(req, res) {
  try {
    const hoy  = new Date();
    // Permite pasar ?anio=2026&mes=7 para consultar un período específico
    const qAnio = parseInt(req.query.anio);
    const qMes  = parseInt(req.query.mes);
    const pAnt = (qAnio && qMes) ? { anio: qAnio, mes: qMes } : mesMenos1(hoy);
    // La proyección es siempre el mes siguiente al causado
    const pSig = pAnt.mes === 12
      ? { anio: pAnt.anio + 1, mes: 1 }
      : { anio: pAnt.anio, mes: pAnt.mes + 1 };

    const [activas, pagosProg] = await Promise.all([
      readRows(SHEETS.ACTIVAS),
      readRows(SHEETS.PAGOS_PROG),
    ]);

    // Saldo de cada línea = Aprobado - capital pagado
    function saldoLinea(id) {
      const pagado = pagosProg
        .filter(p => p.ID_Linea === id && (p.Estado === 'Pagado' || p.Estado === 'Conciliado'))
        .reduce((s,p) => s + (parseFloat(p.Capital) || 0), 0);
      const linea = activas.find(l => l.ID === id);
      if (!linea) return 0;
      return Math.max((parseFloat(linea.Aprobado) || 0) - pagado, 0);
    }

    // Último pago pagado por línea
    const ultPago = {};
    pagosProg.forEach(p => {
      if (p.Estado !== 'Pagado' && p.Estado !== 'Conciliado') return;
      const f = new Date(p.Fecha + 'T00:00:00');
      if (isNaN(f)) return;
      if (!ultPago[p.ID_Linea] || f > ultPago[p.ID_Linea]) ultPago[p.ID_Linea] = f;
    });

    // Líneas activas con saldo ≥ 100
    const lineas = activas.map(l => {
      let tasa = parseFloat(l.Tasa) || 0;
      if (tasa > 1) tasa = tasa / 100;
      const saldo = saldoLinea(l.ID);
      const inicio = l.FechaInicio ? new Date(l.FechaInicio + 'T00:00:00') : null;
      return { id: l.ID, banco: l.Banco, op: l.NumOp, moneda: (l.Moneda||'CRC').toUpperCase(),
               saldo, tasa, inicio };
    }).filter(l => l.saldo >= 100);

    // ── CAUSADO (mes anterior) ──────────────────────────────────────────
    const hasta_ant = ultimoDia(pAnt.anio, pAnt.mes);
    const causado = [];
    lineas.forEach(l => {
      const fp = ultPago[l.id];
      let desde;
      if (fp) {
        desde = new Date(fp); desde.setDate(desde.getDate() + 1);
      } else if (l.inicio) {
        desde = new Date(l.inicio);
      } else return;
      if (desde > hasta_ant) return;
      const dias = diasEntre(desde, hasta_ant);
      causado.push({ banco:l.banco, op:l.op, moneda:l.moneda, capital:l.saldo, tasa:l.tasa,
        fechaPago: fp ? fp.toISOString().slice(0,10) : null,
        desde: desde.toISOString().slice(0,10),
        hasta: hasta_ant.toISOString().slice(0,10),
        dias, interes: calcInt(l.saldo, l.tasa, dias) });
    });
    causado.sort((a,b) => (a.moneda+a.banco+a.op).localeCompare(b.moneda+b.banco+b.op));

    // ── EJECUTADO (pagos Pagado en el mes anterior) ────────────────────
    const ini_ant = new Date(pAnt.anio, pAnt.mes - 1, 1);
    const idsActivas = new Set(activas.map(l => l.ID));
    const ejecutado = pagosProg
      .filter(p => {
        if (p.Estado !== 'Pagado' && p.Estado !== 'Conciliado') return false;
        if (!idsActivas.has(p.ID_Linea)) return false;
        const f = new Date(p.Fecha + 'T00:00:00');
        return !isNaN(f) && f >= ini_ant && f <= hasta_ant;
      })
      .map(p => {
        const linea = activas.find(l => l.ID === p.ID_Linea) || {};
        return { banco: linea.Banco||'', op: p.ID_Linea,
                 moneda: (linea.Moneda||'CRC').toUpperCase(),
                 fecha: p.Fecha, interes: parseFloat(p.Interes) || 0 };
      });
    ejecutado.sort((a,b) => (a.moneda+a.banco+a.op).localeCompare(b.moneda+b.banco+b.op));

    // ── PROYECCIÓN (mes actual) ─────────────────────────────────────────
    const hasta_sig = ultimoDia(pSig.anio, pSig.mes);
    const ini_sig   = new Date(pSig.anio, pSig.mes - 1, 1);
    const proyeccion = [];
    lineas.forEach(l => {
      const fp = ultPago[l.id];
      let desde = fp ? new Date(fp) : new Date(ini_sig);
      if (fp) { desde.setDate(desde.getDate()+1); if (desde < ini_sig) desde = new Date(ini_sig); }
      if (desde > hasta_sig) return;
      const dias = diasEntre(desde, hasta_sig);
      proyeccion.push({ banco:l.banco, op:l.op, moneda:l.moneda, capital:l.saldo, tasa:l.tasa,
        desde: desde.toISOString().slice(0,10),
        hasta: hasta_sig.toISOString().slice(0,10),
        dias, interes: calcInt(l.saldo, l.tasa, dias) });
    });
    proyeccion.sort((a,b) => (a.moneda+a.banco+a.op).localeCompare(b.moneda+b.banco+b.op));

    const tC = totales(causado), tE = totales(ejecutado), tP = totales(proyeccion);

    return res.json({
      ok: true,
      generado: new Date().toISOString(),
      periodos: {
        causado:    { label: `${MESES[pAnt.mes]} ${pAnt.anio}`, ...pAnt },
        proyeccion: { label: `${MESES[pSig.mes]} ${pSig.anio}`, ...pSig },
      },
      totales: { causado: tC, ejecutado: tE, proyeccion: tP,
        diferencia: { crc: Math.round((tC.crc-tE.crc)*100)/100,
                      usd: Math.round((tC.usd-tE.usd)*100)/100 } },
      causado, ejecutado, proyeccion,
    });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
