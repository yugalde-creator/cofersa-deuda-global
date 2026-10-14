/**
 * Comprobante de pago (correo para el registro contable) — calculado desde los datos REALES:
 *  - el pago sale de Pagos_Historicos (capital e interés reales que cobró el banco);
 *  - "saldo antes del pago" = monto aprobado − capital real de los pagos anteriores de esa operación;
 *  - "fecha pago anterior" = el pago real anterior (o la fecha de inicio si es el primero);
 *  - la cuota programada es la del plan de pagos más cercana a la fecha (±15 días).
 * Cada envío queda anotado en la columna "Comprobante" de Pagos_Historicos (fecha y hora), para saber
 * qué falta enviar y poder reenviar. Si el correo falla, se informa (nunca en silencio).
 */
const nodemailer = require('nodemailer');
const { readRows, SHEETS, setCellValueRaw, addColumnHeaderIfMissing } = require('./sheets');
const { parseMonto } = require('./backend');

const COL_COMPROBANTE = 'Comprobante';

/** Fecha de celda a AAAA-MM-DD (acepta AAAA-MM-DD, D/M/AAAA y fechas). */
function iso(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const dmy = (s) => (s ? s.split('-').reverse().join('/') : '-');
const dmyCorto = (s) => { if (!s) return '?'; const [y, m, d] = s.split('-'); return `${d}-${m}-${y.slice(2)}`; };

function fmtMonto(n, moneda) {
  const v = Math.abs(Number(n) || 0);
  if (moneda === 'USD') return '$ ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [e, d] = v.toFixed(2).split('.');
  return '₡ ' + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d;
}
function fmtGlosa(n, moneda) {
  const v = Math.abs(Number(n) || 0);
  if (moneda === 'USD') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [e, d] = v.toFixed(2).split('.');
  return '₡' + e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Un monto de la hoja es confiable si existe y no es absurdo (hay filas viejas dañadas, p. ej. 1,4e16). */
function montoSano(v, tope) {
  const n = parseMonto(v);
  return Number.isFinite(n) && n >= 0 && (!tope || n <= tope * 1.05) ? n : null;
}

/** Lee todo lo necesario una sola vez (para enviar varios comprobantes seguidos). */
async function leerDatos() {
  const [activas, canceladas, historicos, programados, config, usuarios] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readRows(SHEETS.CANCELADAS).catch(() => []), readRows(SHEETS.PAGOS_HIST),
    readRows(SHEETS.PAGOS_PROG), readRows(SHEETS.CONFIG).catch(() => []), readRows(SHEETS.USUARIOS),
  ]);
  return { activas, canceladas, historicos, programados, config, usuarios };
}

/** Calcula el comprobante de un pago (Pagos_Historicos.ID = pagoId). */
function calcular(pagoId, d) {
  const pago = d.historicos.find((p) => p.ID === pagoId);
  if (!pago) throw new Error(`Pago ${pagoId} no encontrado`);
  const idLinea = pago.ID_Linea;
  const linea = d.activas.find((a) => a.ID === idLinea) || d.canceladas.find((c) => c.ID === idLinea || c.IDOriginal === idLinea);
  if (!linea) throw new Error(`Operación ${idLinea} no encontrada (pago ${pagoId})`);
  const moneda = (linea.Moneda || 'CRC').toUpperCase() === 'USD' ? 'USD' : 'CRC';
  const aprobado = parseMonto(linea.Aprobado);
  const fecha = iso(pago.Fecha);

  const plan = d.programados.filter((p) => (p.ID_Linea || p.ID || p['Operaciones_Activas!A1']) === idLinea);
  const cuota = plan
    .map((p) => ({ p, dd: Math.abs(dias(iso(p.Fecha), fecha)) }))
    .filter((x) => x.dd <= 15)
    .sort((a, b) => a.dd - b.dd)[0]?.p;
  const capProg = cuota ? parseMonto(cuota.Capital) : 0;
  const intProg = cuota ? parseMonto(cuota.Interes) : 0;

  const total = montoSano(pago.Monto, aprobado * 2);
  let capReal = montoSano(pago.CapitalReal, aprobado);
  let intReal = montoSano(pago.InteresReal, aprobado);
  if (capReal == null && total != null && intReal != null) capReal = Math.max(total - intReal, 0);
  if (intReal == null && total != null && capReal != null) intReal = Math.max(total - capReal, 0);
  if (capReal == null) capReal = capProg;
  if (intReal == null) intReal = intProg;
  const totalReal = capReal + intReal;

  // Saldo y período según el PLAN DE PAGOS del banco (así calcula el banco el interés): capital de las
  // cuotas anteriores a la cuota pagada y fecha de la cuota anterior. Los pagos históricos viejos no
  // siempre traen el capital real, por eso no se usan para el saldo.
  let capitalPrevio, fechaAnterior;
  if (cuota) {
    const fCuota = iso(cuota.Fecha);
    const antes = plan.filter((p) => iso(p.Fecha) < fCuota).sort((a, b) => iso(a.Fecha).localeCompare(iso(b.Fecha)));
    capitalPrevio = antes.reduce((s, p) => s + parseMonto(p.Capital), 0);
    fechaAnterior = antes.length ? iso(antes[antes.length - 1].Fecha) : iso(linea.FechaInicio);
  } else {
    const previos = d.historicos
      .filter((p) => p.ID_Linea === idLinea && p.ID !== pagoId && (iso(p.Fecha) < fecha || (iso(p.Fecha) === fecha && p.ID < pagoId)))
      .sort((a, b) => iso(a.Fecha).localeCompare(iso(b.Fecha)));
    capitalPrevio = previos.reduce((s, p) => s + (montoSano(p.CapitalReal, aprobado) ?? 0), 0);
    fechaAnterior = previos.length ? iso(previos[previos.length - 1].Fecha) : iso(linea.FechaInicio);
  }
  const saldoAntes = Math.max(aprobado - capitalPrevio, 0);
  const diasPeriodo = fechaAnterior ? Math.max(dias(fechaAnterior, fecha), 0) : 0;
  const tasaRaw = parseMonto(linea.Tasa);
  const tasa = tasaRaw > 50 ? tasaRaw / 100 : tasaRaw;
  const interesCalculado = saldoAntes * (tasa / 100) * (diasPeriodo / 360);
  const tcRow = d.config.find((c) => /tipocambio/i.test(String(c.Clave || '')));
  const tc = tcRow ? parseMonto(tcRow.Valor) : 0;

  const glosa = `Pago ${linea.Banco} Prest.Nro.${linea.NumOp} + Ints.D/${dmyCorto(fechaAnterior)}/${dmyCorto(fecha)} ${fmtGlosa(saldoAntes, moneda)} vcto ${dmyCorto(iso(linea.FechaVencimiento))}`;
  return { pago, linea, moneda, aprobado, fecha, cuota, capProg, intProg, capReal, intReal, totalReal, saldoAntes, saldoDespues: Math.max(saldoAntes - capReal, 0), fechaAnterior, diasPeriodo, tasa, interesCalculado, tc, glosa };
}

function html(c) {
  const m = c.moneda;
  const fila = (k, v, fuerte) => `<tr><td style="padding:3px 0;color:#666">${k}</td><td style="text-align:right;${fuerte ? 'font-weight:700' : ''}">${v}</td></tr>`;
  const difInt = c.intReal - c.intProg;
  return `
<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#222;background:#fff">
  <table style="width:100%;border-bottom:3px solid #1a5276;padding-bottom:12px;margin-bottom:16px"><tr>
    <td><div style="font-size:11px;color:#888;font-weight:600;letter-spacing:1px">COFERSA</div>
      <div style="font-size:22px;font-weight:700;color:#1a5276">Comprobante de Pago</div>
      <div style="margin-top:4px"><span style="background:#27ae60;color:#fff;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700">PAGADO</span>
      <span style="color:#555;font-size:12px;margin-left:8px">— ${dmy(c.fecha)}</span></div></td>
    <td style="text-align:right;font-size:12px;color:#555;line-height:1.8">
      <div><strong>Operación:</strong> ${esc(c.linea.Banco)} | ${esc(c.linea.NumOp)}</div><div><strong>Moneda:</strong> ${m}</div>
      <div><strong>Generado:</strong> ${dmy(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }))}</div>
      ${c.tc ? `<div><strong>TC:</strong> ${fmtMonto(c.tc, 'CRC')}</div>` : ''}</td></tr></table>
  <table style="width:100%;margin-bottom:20px"><tr>
    <td style="width:48%;vertical-align:top;padding-right:12px">
      <div style="font-size:10px;font-weight:700;color:#1a5276;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">◆ DATOS DE LA OPERACIÓN</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        ${fila('Banco', esc(c.linea.Banco))}${fila('N° Operación', esc(c.linea.NumOp))}${fila('Monto original', fmtMonto(c.aprobado, m))}
        ${fila('Tasa anual', c.tasa.toFixed(2) + '%')}${fila('Plazo', esc(c.linea.Plazo || '-'))}${fila('F. vencimiento', dmy(iso(c.linea.FechaVencimiento)))}
        ${fila('Saldo antes del pago', fmtMonto(c.saldoAntes, m), true)}${fila('Saldo después del pago', fmtMonto(c.saldoDespues, m), true)}
      </table></td>
    <td style="width:4%"></td>
    <td style="width:48%;vertical-align:top">
      <div style="font-size:10px;font-weight:700;color:#1a5276;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">◆ DETALLE DEL PAGO</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        ${fila('Fecha de pago (banco)', dmy(c.fecha), true)}${fila('Fecha pago anterior', dmy(c.fechaAnterior))}${fila('Días del período', c.diasPeriodo + ' días')}
        ${fila('Amortización (capital)', fmtMonto(c.capReal, m))}${fila('Intereses', fmtMonto(c.intReal, m))}
        ${fila('Total pagado al banco', fmtMonto(c.totalReal, m), true)}
        ${fila('<span style="font-size:11px">KEY OPERACIÓN</span>', `<span style="font-size:10px;font-weight:700">${esc(String(c.linea.Banco).toUpperCase())}|${esc(c.linea.NumOp)}</span>`)}
      </table></td></tr></table>
  <div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:6px;padding:14px;margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;color:#1a5276;margin-bottom:6px">ⓘ VERIFICACIÓN CONTRA EL PLAN DE PAGOS</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#e8ecf0;font-size:10px;font-weight:700;color:#555"><th style="padding:6px 8px;text-align:left">CONCEPTO</th><th style="padding:6px 8px;text-align:right">PLAN DE PAGOS${c.cuota ? ' (' + dmy(iso(c.cuota.Fecha)) + ')' : ''}</th><th style="padding:6px 8px;text-align:right">REAL BANCO</th><th style="padding:6px 8px;text-align:right">DIFERENCIA</th></tr>
      <tr style="border-bottom:1px solid #e0e0e0"><td style="padding:6px 8px">Amortización</td><td style="padding:6px 8px;text-align:right">${fmtMonto(c.capProg, m)}</td><td style="padding:6px 8px;text-align:right">${fmtMonto(c.capReal, m)}</td><td style="padding:6px 8px;text-align:right">${Math.abs(c.capReal - c.capProg) < 0.01 ? '—' : (c.capReal - c.capProg > 0 ? '+' : '−') + fmtMonto(c.capReal - c.capProg, m)}</td></tr>
      <tr style="border-bottom:1px solid #e0e0e0"><td style="padding:6px 8px">Intereses</td><td style="padding:6px 8px;text-align:right">${fmtMonto(c.intProg, m)}</td><td style="padding:6px 8px;text-align:right">${fmtMonto(c.intReal, m)}</td><td style="padding:6px 8px;text-align:right;${Math.abs(difInt) >= 0.01 ? 'color:#c0392b;font-weight:700' : ''}">${Math.abs(difInt) < 0.01 ? '—' : (difInt > 0 ? '+' : '−') + fmtMonto(difInt, m)}</td></tr>
      <tr><td style="padding:6px 8px;color:#666;font-size:11px" colspan="4">Referencia: saldo × tasa × días ÷ 360 = ${fmtMonto(c.saldoAntes, m)} × ${c.tasa.toFixed(4)}% × ${c.diasPeriodo} ÷ 360 = <b>${fmtMonto(c.interesCalculado, m)}</b></td></tr>
    </table>${c.cuota ? '' : '<div style="margin-top:8px;font-size:11px;color:#c0392b">No se encontró la cuota del plan de pagos a ±15 días de este pago: revise el plan de la operación.</div>'}
  </div>
  <div style="background:#f0f9ff;border-left:4px solid #1a5276;padding:14px;margin-bottom:20px">
    <div style="font-size:10px;font-weight:700;color:#888;margin-bottom:6px">◆ GLOSA ERP — COPIAR Y PEGAR EN ASIENTO CONTABLE</div>
    <code style="font-family:monospace;font-size:13px;color:#1a5276;font-weight:600">${esc(c.glosa)}</code></div>
  <div style="font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px;text-align:center">COFERSA · ${esc(c.linea.Banco)} | ${esc(c.linea.NumOp)} · ${m} · Pago ${esc(c.pago.ID)}</div>
</div>`;
}

function destinatarios(usuarios) {
  return [...new Set(usuarios
    .filter((u) => (u.Notificar || 'Si').toString().trim().toLowerCase() !== 'no')
    .map((u) => (u.Email || '').toString().trim().toLowerCase())
    .filter(Boolean))];
}

/**
 * Envía el comprobante de cada pago indicado y anota la fecha de envío. Devuelve el resultado por pago.
 * `soloA` (opcional): enviar solo a ese correo (pruebas).
 */
async function enviarComprobantes(pagoIds, { soloA } = {}) {
  const d = await leerDatos();
  const to = soloA ? [soloA] : destinatarios(d.usuarios);
  if (!to.length) throw new Error('Sin destinatarios: nadie tiene Notificar = Si en la hoja Usuarios.');
  const transporter = require('./correo').crearTransporte();
  await transporter.verify(); // si la contraseña no sirve, falla aquí con un mensaje claro
  await addColumnHeaderIfMissing(SHEETS.PAGOS_HIST, COL_COMPROBANTE);
  const out = [];
  for (const id of pagoIds) {
    try {
      const c = calcular(id, d);
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: to.join(','),
        subject: `Comprobante Pagado: ${c.linea.Banco} ${c.linea.NumOp} — ${dmy(c.fecha)}`,
        html: html(c),
      });
      if (!soloA) {
        const ahora = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
        await setCellValueRaw(SHEETS.PAGOS_HIST, c.pago._row, COL_COMPROBANTE, `Enviado ${ahora}`);
      }
      out.push({ id, ok: true, operacion: `${c.linea.Banco} ${c.linea.NumOp}`, fecha: c.fecha, total: c.totalReal, moneda: c.moneda });
    } catch (e) {
      out.push({ id, ok: false, error: e.message });
    }
  }
  return { para: to, resultados: out };
}

/** Pagos de un mes (AAAA-MM) cuyo comprobante no se ha enviado. */
async function pendientesDelMes(mes) {
  const d = await leerDatos();
  return d.historicos
    .filter((p) => iso(p.Fecha).startsWith(mes) && !String(p[COL_COMPROBANTE] || '').startsWith('Enviado'))
    .filter((p) => String(p.ID_Linea || '').startsWith('LC-') || String(p.ID_Linea || '').startsWith('LX-'))
    .map((p) => p.ID);
}

module.exports = { enviarComprobantes, pendientesDelMes, calcular, leerDatos, html, iso };
