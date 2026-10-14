/**
 * Lógica compartida para las alertas y resúmenes por email (cron diario).
 * Reutiliza parseMonto()/readPP() de backend.js para evitar duplicar el
 * parseo de montos (bug histórico: parseFloat() no entiende formato europeo).
 */
const nodemailer = require('nodemailer');
const { readRows, SHEETS, fmtDate } = require('./sheets');
const { readPP, parseMonto } = require('./backend');
const { calcularIntereses, aplicarRealesAPlan } = require('./intereses');

const ALERTA_DIAS = parseInt(process.env.PAGOS_ALERTA_DIAS, 10) || 7;

function fmtMontoCRC(n) { return '₡' + Math.round(n).toLocaleString('en-US'); }
function fmtMontoUSD(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function fmtMonto(n, moneda) { return moneda === 'USD' ? fmtMontoUSD(n) : fmtMontoCRC(n); }
function fmtMonto2(n, moneda) {
  const v = (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (moneda === 'USD' ? '$' : '₡') + v;
}
const MESES_ES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function fmtDateEs(iso) {
  if (!iso) return '-';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function getFxRate() {
  const config = await readRows(SHEETS.CONFIG);
  const cfg = {};
  config.forEach(c => { cfg[c.Clave] = c.Valor; });
  return parseMonto(cfg.TipoCambioUSD) || 455;
}

async function getRecipients() {
  const usuarios = await readRows(SHEETS.USUARIOS);
  const emails = usuarios
    .filter(u => (u.Notificar || 'Si').toString().trim().toLowerCase() !== 'no')
    .map(u => (u.Email || '').toString().trim())
    .filter(Boolean);
  return [...new Set(emails)];
}

/** Construye el estado completo de la deuda a partir de las hojas, con el mismo
 * parseo correcto que usa la app (parseMonto + readPP), sin requerir sesión de usuario. */
async function buildResumenDeuda() {
  const [activas, pagosProg, leasing, leasingPagosRows, pagosHist] = await Promise.all([
    readRows(SHEETS.ACTIVAS),
    readPP(),
    readRows(SHEETS.LEASING),
    readRows(SHEETS.LEASING_PAGOS),
    readRows(SHEETS.PAGOS_HIST),
  ]);
  const fx = await getFxRate();

  const lines = activas.map(a => ({
    id: a.ID, numOp: a.NumOp, banco: a.Banco, tipo: a.Tipo, moneda: a.Moneda,
    aprobado: parseMonto(a.Aprobado), vencimiento: fmtDate(a.FechaVencimiento),
  }));

  const paymentPlans = {};
  pagosProg.forEach(p => {
    const lid = p.ID_Linea;
    if (!lid) return;
    if (!paymentPlans[lid]) paymentPlans[lid] = [];
    paymentPlans[lid].push({ fecha: fmtDate(p.Fecha), capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), estado: (p.Estado || 'Pendiente').trim() });
  });

  Object.keys(paymentPlans).forEach(lid => {
    const hs = pagosHist.filter(h => h.ID_Linea === lid);
    if (hs.length) aplicarRealesAPlan(paymentPlans[lid], hs, parseMonto, fmtDate);
  });

  const leasingContratos = leasing.map(l => ({
    id: l.ID, numOp: l.NumOp, banco: l.Banco, moneda: l.Moneda,
    monto: parseMonto(l.Monto), vencimiento: fmtDate(l.FechaVencimiento),
  }));

  const leasingPagos = {};
  leasingPagosRows.forEach(p => {
    const lid = p.ID_Contrato;
    if (!lid) return;
    if (!leasingPagos[lid]) leasingPagos[lid] = [];
    leasingPagos[lid].push({ fecha: fmtDate(p.Fecha), capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), seguro: parseMonto(p.Seguro), iva: parseMonto(p.IVA), estado: (p.Estado || 'Pendiente').trim() });
  });

  function saldoDe(monto, plan) {
    const pagado = plan.filter(p => p.estado === 'Pagado' || p.estado === 'Conciliado').reduce((s, p) => s + p.capital, 0);
    const saldo = monto - pagado;
    return Math.max(Math.round(saldo * 100) / 100, 0);
  }

  let saldoCRC = 0, saldoUSD = 0;
  lines.forEach(l => {
    const s = saldoDe(l.aprobado, paymentPlans[l.id] || []);
    if (l.moneda === 'USD') saldoUSD += s; else saldoCRC += s;
  });
  leasingContratos.forEach(l => {
    const s = saldoDe(l.monto, leasingPagos[l.id] || []);
    if (l.moneda === 'USD') saldoUSD += s; else saldoCRC += s;
  });

  const cuotasPendientes = [];
  lines.forEach(l => {
    (paymentPlans[l.id] || []).filter(p => p.estado === 'Pendiente').forEach(p => {
      cuotasPendientes.push({ origen: 'Operación', numOp: l.numOp || l.id, banco: l.banco, moneda: l.moneda, fecha: p.fecha, capital: p.capital, interes: p.interes, otros: 0, monto: p.capital + p.interes });
    });
  });
  leasingContratos.forEach(l => {
    (leasingPagos[l.id] || []).filter(p => p.estado === 'Pendiente').forEach(p => {
      cuotasPendientes.push({ origen: 'Leasing', numOp: l.numOp || l.id, banco: l.banco, moneda: l.moneda, fecha: p.fecha, capital: p.capital, interes: p.interes, otros: (p.seguro || 0) + (p.iva || 0), monto: p.capital + p.interes + (p.seguro || 0) + (p.iva || 0) });
    });
  });
  cuotasPendientes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  function diasHasta(fechaStr) {
    if (!fechaStr) return null;
    const d = new Date(fechaStr + 'T00:00:00');
    if (isNaN(d)) return null;
    return Math.round((d - today) / 86400000);
  }

  const vencidasLineas = lines.filter(l => { const d = diasHasta(l.vencimiento); return d !== null && d < 0; });
  const proxVencerLineas = lines.filter(l => { const d = diasHasta(l.vencimiento); return d !== null && d >= 0 && d <= 90; });

  const mesPrev = today.getMonth() === 0 ? { anio: today.getFullYear() - 1, mes: 12 } : { anio: today.getFullYear(), mes: today.getMonth() };
  let intereses = null;
  try { intereses = { ...(await calcularIntereses(mesPrev.anio, mesPrev.mes)), mesPrev }; } catch (e) { console.error('intereses:', e.message); }

  return { lines, leasingContratos, cuotasPendientes, saldoCRC, saldoUSD, fx, diasHasta, vencidasLineas, proxVencerLineas, today, intereses };
}

function tablaCuotas(cuotas) {
  if (!cuotas.length) return '<p style="color:#666;">Sin cuotas en este período.</p>';
  const td = 'style="text-align:right;"';
  const filas = cuotas.map(c => `<tr><td>${c.numOp}</td><td>${c.banco}</td><td>${c.origen}</td><td>${fmtDateEs(c.fecha)}</td>` +
    `<td ${td}>${fmtMonto2(c.capital, c.moneda)}</td><td ${td}>${fmtMonto2(c.interes, c.moneda)}</td>` +
    `<td ${td}>${c.otros ? fmtMonto2(c.otros, c.moneda) : '—'}</td><td ${td}><b>${fmtMonto2(c.monto, c.moneda)}</b></td></tr>`).join('');
  const tot = {};
  cuotas.forEach(c => { const t = (tot[c.moneda] = tot[c.moneda] || { capital: 0, interes: 0, otros: 0, monto: 0 }); t.capital += c.capital; t.interes += c.interes; t.otros += c.otros; t.monto += c.monto; });
  const totales = Object.entries(tot).map(([m, t]) => `<tr style="background:#eef2f6;font-weight:bold;"><td colspan="4">Total ${m === 'USD' ? 'USD' : 'CRC'}</td>` +
    `<td ${td}>${fmtMonto2(t.capital, m)}</td><td ${td}>${fmtMonto2(t.interes, m)}</td><td ${td}>${t.otros ? fmtMonto2(t.otros, m) : '—'}</td><td ${td}>${fmtMonto2(t.monto, m)}</td></tr>`).join('');
  return '<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;width:100%;">' +
    '<tr style="background:#0f2437;color:#fff;"><th>N° Operación</th><th>Banco</th><th>Origen</th><th>Fecha</th><th>Amortización (capital)</th><th>Interés</th><th>Seguro/IVA</th><th>Total cuota</th></tr>' +
    filas + totales + '</table>';
}

function headerHtml(titulo, subtitulo) {
  return `<div style="background:#0f2437;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-family:sans-serif;">${titulo}</h2>
    <div style="opacity:.8;font-family:sans-serif;font-size:13px;">${subtitulo}</div>
  </div>`;
}

function interesesHtml(r) {
  const i = r.intereses;
  if (!i) return '';
  const eq = t => fmtMontoCRC(t.crc + t.usd * r.fx);
  const fila = (lbl, t) => `<tr><td>${lbl}</td><td style="text-align:right;">${fmtMonto2(t.crc, 'CRC')}</td><td style="text-align:right;">${fmtMonto2(t.usd, 'USD')}</td><td style="text-align:right;"><b>${eq(t)}</b></td></tr>`;
  const mp = i.mesPrev, ms = i.siguiente;
  return `<div style="font-family:sans-serif;padding:0 20px 16px;"><h3 style="margin:8px 0;">Intereses (operaciones + leasing)</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px;width:100%;">
      <tr style="background:#0f2437;color:#fff;"><th style="text-align:left;">Concepto</th><th>Colones</th><th>Dólares</th><th>Total equivalente (₡${r.fx})</th></tr>
      ${fila('Causado ' + MESES_ES[mp.mes] + ' ' + mp.anio + ' (devengado)', i.totales.causado)}
      ${fila('Pagado en ' + MESES_ES[mp.mes] + ' (cuotas pagadas)', i.totales.ejecutado)}
      ${fila('Proyectado ' + MESES_ES[ms.mes] + ' ' + ms.anio, i.totales.proyeccion)}
    </table>
    <div style="font-size:11px;color:#777;margin-top:4px;">El interés se muestra separado de la amortización (capital).</div></div>`;
}

function resumenSaldoHtml(r) {
  const totalCRC = Math.round(r.saldoCRC + r.saldoUSD * r.fx);
  return `<div style="font-family:sans-serif;padding:16px 20px;background:#f7f9fb;">
    <table style="width:100%;">
      <tr><td><b>Saldo en Colones</b></td><td style="text-align:right;">${fmtMontoCRC(r.saldoCRC)}</td></tr>
      <tr><td><b>Saldo en Dólares</b></td><td style="text-align:right;">${fmtMontoUSD(r.saldoUSD)}</td></tr>
      <tr><td><b>Total equivalente (₡${r.fx})</b></td><td style="text-align:right;"><b>${fmtMontoCRC(totalCRC)}</b></td></tr>
      <tr><td>Operaciones vencidas</td><td style="text-align:right;">${r.vencidasLineas.length}</td></tr>
      <tr><td>Operaciones por vencer (90 días)</td><td style="text-align:right;">${r.proxVencerLineas.length}</td></tr>
    </table>
  </div>`;
}

/** Email de alerta: cuotas que vencen dentro de ALERTA_DIAS días (o ya vencidas y sin marcar pagadas). */
function buildAlertaPagosHtml(r) {
  const proximas = r.cuotasPendientes.filter(c => { const d = r.diasHasta(c.fecha); return d !== null && d <= ALERTA_DIAS; });
  if (!proximas.length) return null;
  const NAVY = '#0f2942', AZUL = '#009fe3', GRIS = '#64748b', LINEA = '#e2e8f0', FONDO = '#f1f5f9', ROJO = '#dc2626';
  const fuente = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const fx = r.fx || 0;
  const eqCRC = c => (c.moneda === 'USD' ? c.monto * fx : c.monto);
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const nombreDia = f => { const d = new Date(f + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`; };
  const etiqueta = f => { const n = r.diasHasta(f); return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : nombreDia(f).charAt(0).toUpperCase() + nombreDia(f).slice(1); };
  const totalPorMoneda = l => {
    const t = {}; l.forEach(c => { t[c.moneda] = (t[c.moneda] || 0) + c.monto; });
    return Object.entries(t).map(([m, v]) => fmtMonto2(v, m)).join(' + ');
  };
  const vencidas = proximas.filter(c => r.diasHasta(c.fecha) < 0);
  const futuras = proximas.filter(c => r.diasHasta(c.fecha) >= 0);
  const totalEq = proximas.reduce((s, c) => s + eqCRC(c), 0);

  const fila = (c, rojo) => `<tr>
      <td style="padding:10px 0;border-top:1px solid ${LINEA};vertical-align:top">
        <div style="font-size:14px;font-weight:700;color:${NAVY}">${c.banco} · ${c.numOp}</div>
        <div style="font-size:12px;color:${GRIS};margin-top:2px">${c.origen === 'Leasing' ? 'Leasing · ' : ''}Amortización ${fmtMonto2(c.capital, c.moneda)} · Interés ${fmtMonto2(c.interes, c.moneda)}${c.otros ? ' · Seguro/IVA ' + fmtMonto2(c.otros, c.moneda) : ''}${rojo ? ` · <b style="color:${ROJO}">vencida el ${fmtDateEs(c.fecha)}</b>` : ''}</div>
      </td>
      <td align="right" style="padding:10px 0;border-top:1px solid ${LINEA};vertical-align:top;white-space:nowrap">
        <div style="font-size:15px;font-weight:700;color:${rojo ? ROJO : '#0f172a'}">${fmtMonto2(c.monto, c.moneda)}</div>
        ${c.moneda === 'USD' && fx ? `<div style="font-size:11px;color:${GRIS}">≈ ${fmtMontoCRC(c.monto * fx)}</div>` : ''}
      </td></tr>`;
  const bloque = (titulo, lista, rojo) => `
    <tr><td style="padding:18px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:${rojo ? ROJO : AZUL}">${titulo}</td>
            <td align="right" style="padding-bottom:6px;font-size:12px;color:${GRIS}">${lista.length} cuota(s) · <b style="color:#0f172a">${totalPorMoneda(lista)}</b></td></tr>
        ${lista.map(c => fila(c, rojo)).join('')}
      </table>
    </td></tr>`;

  const dias = [...new Set(futuras.map(c => c.fecha))].sort();
  const tile = (t, v, oscuro) => `<td width="33%" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${oscuro ? NAVY : FONDO};border-radius:10px">
      <tr><td style="padding:12px 14px 2px;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:${oscuro ? '#93c5fd' : GRIS}">${t}</td></tr>
      <tr><td style="padding:0 14px 12px;font-size:17px;font-weight:700;color:${oscuro ? '#fff' : NAVY};white-space:nowrap">${v}</td></tr></table></td>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};padding:24px 12px;${fuente}"><tr><td align="center">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:${NAVY};padding:22px 28px">
      <div style="font-size:12px;letter-spacing:3px;color:#93c5fd;font-weight:600">COFERSA · TESORERÍA</div>
      <div style="font-size:22px;color:#fff;font-weight:700;margin-top:4px">Pagos de deuda próximos</div>
      <div style="font-size:13px;color:#cbd5e1;margin-top:4px">Cuotas del plan de pagos de los próximos ${ALERTA_DIAS} días · ${r.today.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </td></tr>
    <tr><td style="height:4px;background:${AZUL};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:20px 24px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${tile('Cuotas', String(proximas.length))}${tile('Vencidas sin registrar', String(vencidas.length))}${tile('Total ≈ colones', fmtMontoCRC(totalEq), true)}
    </tr></table></td></tr>
    ${vencidas.length ? bloque('Vencidas sin registrar el pago', vencidas, true) : ''}
    ${dias.map(f => bloque(etiqueta(f) + ' · ' + fmtDateEs(f), futuras.filter(c => c.fecha === f))).join('')}
    <tr><td style="padding:22px 28px 26px">
      <div style="border-top:1px solid ${LINEA};padding-top:14px;font-size:11px;color:${GRIS}">Fechas según el plan de pagos de cada banco. Dólares convertidos a ₡${fx} solo como referencia. Deuda global · Tesorería COFERSA</div>
    </td></tr>
  </table></td></tr></table>`;
}

function buildResumenHtml(r, periodo) {
  const en = { diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual' }[periodo] || periodo;
  const dias = { diario: 1, semanal: 7, mensual: 31 }[periodo] || 1;
  const proximas = r.cuotasPendientes.filter(c => { const d = r.diasHasta(c.fecha); return d !== null && d >= 0 && d < dias; });
  return headerHtml(`Resumen ${en} de Deuda — Cofersa`, r.today.toLocaleDateString('es-CR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })) +
    resumenSaldoHtml(r) + interesesHtml(r) +
    `<div style="padding:0 20px 20px;font-family:sans-serif;">
      <h3>Cuotas de este período (${proximas.length})</h3>
      ${tablaCuotas(proximas)}
      ${r.vencidasLineas.length ? `<h3 style="color:#b91c1c;">Operaciones vencidas (${r.vencidasLineas.length})</h3>` +
        r.vencidasLineas.map(l => `<p style="margin:4px 0;">${l.banco} — ${l.numOp || l.id} — venció ${fmtDateEs(l.vencimiento)}</p>`).join('') : ''}
    </div>`;
}

/** soloA (opcional, para pruebas): envía únicamente a ese correo, que debe estar registrado en la hoja Usuarios. */
async function enviarEmail(subject, html, attachments, soloA) {
  let to = await getRecipients();
  if (soloA) {
    const m = to.find(e => e.toLowerCase() === String(soloA).trim().toLowerCase());
    if (!m) return { emailSent: false, emailError: 'El correo de prueba no está registrado en la hoja Usuarios' };
    to = [m]; subject = '[PRUEBA] ' + subject;
  }
  if (!to.length) return { emailSent: false, emailError: 'Sin destinatarios en hoja Usuarios' };
  try {
    const transporter = require('./correo').crearTransporte();
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: to.join(','), subject, html, ...(attachments && attachments.length ? { attachments } : {}) });
    return { emailSent: true, to };
  } catch (e) {
    return { emailSent: false, emailError: e.message };
  }
}

module.exports = {
  buildResumenDeuda,
  buildAlertaPagosHtml,
  buildResumenHtml,
  enviarEmail,
  ALERTA_DIAS,
};
