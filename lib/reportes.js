/**
 * Lógica compartida para las alertas y resúmenes por email (cron diario).
 * Reutiliza parseMonto()/readPP() de backend.js para evitar duplicar el
 * parseo de montos (bug histórico: parseFloat() no entiende formato europeo).
 */
const nodemailer = require('nodemailer');
const { readRows, SHEETS, fmtDate } = require('./sheets');
const { readPP, parseMonto } = require('./backend');

const ALERTA_DIAS = parseInt(process.env.PAGOS_ALERTA_DIAS, 10) || 3;

function fmtMontoCRC(n) { return '₡' + Math.round(n).toLocaleString('en-US'); }
function fmtMontoUSD(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function fmtMonto(n, moneda) { return moneda === 'USD' ? fmtMontoUSD(n) : fmtMontoCRC(n); }
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
  const [activas, pagosProg, leasing, leasingPagosRows] = await Promise.all([
    readRows(SHEETS.ACTIVAS),
    readPP(),
    readRows(SHEETS.LEASING),
    readRows(SHEETS.LEASING_PAGOS),
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
      cuotasPendientes.push({ origen: 'Operación', numOp: l.numOp || l.id, banco: l.banco, moneda: l.moneda, fecha: p.fecha, monto: p.capital + p.interes });
    });
  });
  leasingContratos.forEach(l => {
    (leasingPagos[l.id] || []).filter(p => p.estado === 'Pendiente').forEach(p => {
      cuotasPendientes.push({ origen: 'Leasing', numOp: l.numOp || l.id, banco: l.banco, moneda: l.moneda, fecha: p.fecha, monto: p.capital + p.interes + (p.seguro || 0) + (p.iva || 0) });
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

  return { lines, leasingContratos, cuotasPendientes, saldoCRC, saldoUSD, fx, diasHasta, vencidasLineas, proxVencerLineas, today };
}

function tablaCuotas(cuotas) {
  if (!cuotas.length) return '<p style="color:#666;">Sin cuotas en este período.</p>';
  return '<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;width:100%;">' +
    '<tr style="background:#0f2437;color:#fff;"><th>N° Operación</th><th>Banco</th><th>Origen</th><th>Fecha</th><th>Monto</th></tr>' +
    cuotas.map(c => `<tr><td>${c.numOp}</td><td>${c.banco}</td><td>${c.origen}</td><td>${fmtDateEs(c.fecha)}</td><td style="text-align:right;">${fmtMonto(c.monto, c.moneda)}</td></tr>`).join('') +
    '</table>';
}

function headerHtml(titulo, subtitulo) {
  return `<div style="background:#0f2437;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-family:sans-serif;">${titulo}</h2>
    <div style="opacity:.8;font-family:sans-serif;font-size:13px;">${subtitulo}</div>
  </div>`;
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
  return headerHtml('⚠️ Alerta de Pagos Próximos', `Cuotas que vencen en los próximos ${ALERTA_DIAS} días o ya vencidas — ${r.today.toLocaleDateString('es-CR')}`) +
    `<div style="padding:16px 20px;">${tablaCuotas(proximas)}</div>`;
}

function buildResumenHtml(r, periodo) {
  const en = { diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual' }[periodo] || periodo;
  const dias = { diario: 1, semanal: 7, mensual: 31 }[periodo] || 1;
  const proximas = r.cuotasPendientes.filter(c => { const d = r.diasHasta(c.fecha); return d !== null && d >= 0 && d < dias; });
  return headerHtml(`Resumen ${en} de Deuda — Cofersa`, r.today.toLocaleDateString('es-CR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })) +
    resumenSaldoHtml(r) +
    `<div style="padding:0 20px 20px;font-family:sans-serif;">
      <h3>Cuotas de este período (${proximas.length})</h3>
      ${tablaCuotas(proximas)}
      ${r.vencidasLineas.length ? `<h3 style="color:#b91c1c;">Operaciones vencidas (${r.vencidasLineas.length})</h3>` +
        r.vencidasLineas.map(l => `<p style="margin:4px 0;">${l.banco} — ${l.numOp || l.id} — venció ${fmtDateEs(l.vencimiento)}</p>`).join('') : ''}
    </div>`;
}

async function enviarEmail(subject, html) {
  const to = await getRecipients();
  if (!to.length) return { emailSent: false, emailError: 'Sin destinatarios en hoja Usuarios' };
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: to.join(','), subject, html });
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
