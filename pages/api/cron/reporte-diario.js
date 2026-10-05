/**
 * Cron diario (13:00 UTC, ver vercel.json). Desde este único trigger se envían:
 *  - Alerta de pagos próximos (siempre, si hay cuotas dentro de PAGOS_ALERTA_DIAS días)
 *  - Resumen diario (siempre)
 *  - Resumen semanal (si hoy es lunes)
 *  - Resumen mensual (si hoy es día 1 del mes)
 * Todo se arma con lib/reportes.js, que reutiliza parseMonto()/readPP() de
 * backend.js — la misma fuente de verdad que usa el frontend.
 */
const { buildResumenDeuda, buildAlertaPagosHtml, buildResumenHtml, enviarEmail } = require('../../../lib/reportes');
const { generarApartadoXlsx } = require('../../../lib/apartadoXlsx');
const { generarInformeCfoXlsx } = require('../../../lib/informeCfoXlsx');

const fmtN = (n, cur) => (cur === 'USD' ? '$' : '₡') + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Correo mensual con el Excel oficial "Apartado de Intereses" adjunto. */
async function enviarApartado(anio, mes) {
  const { buffer, filename, resumen } = await generarApartadoXlsx(anio, mes);
  const t = resumen;
  const html = `<div style="font-family:sans-serif;font-size:14px;"><h3 style="color:#1F3864;">Apartado de Intereses — ${t.mes}</h3>` +
    `<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px;"><tr style="background:#1F3864;color:#fff;"><th>Concepto</th><th>Colones</th><th>Dólares</th></tr>` +
    `<tr><td>Interés causado (${t.mes})</td><td align="right">${fmtN(t.causado.crc, 'CRC')}</td><td align="right">${fmtN(t.causado.usd, 'USD')}</td></tr>` +
    `<tr><td>Interés ejecutado (pagado)</td><td align="right">${fmtN(t.ejecutado.crc, 'CRC')}</td><td align="right">${fmtN(t.ejecutado.usd, 'USD')}</td></tr>` +
    `<tr><td>Proyectado (${t.sig})</td><td align="right">${fmtN(t.proyeccion.crc, 'CRC')}</td><td align="right">${fmtN(t.proyeccion.usd, 'USD')}</td></tr></table>` +
    `<p style="color:#555;">Detalle por operación en el Excel adjunto (Resumen · Causado · Ejecutado · Proyección).</p></div>`;
  const r = await enviarEmail(`Apartado de Intereses COFERSA — ${t.mes} / Proyección ${t.sig}`, html, [{ filename, content: buffer }]);
  return { tipo: 'apartado', archivo: filename, ...r };
}

/** Correo mensual con el informe de deuda para el CFO (Excel) adjunto. */
async function enviarInformeCfo(anio, mes) {
  const { buffer, filename, resumen: t } = await generarInformeCfoXlsx(anio, mes);
  const sg = n => (n >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
  const html = `<div style="font-family:sans-serif;font-size:14px;"><h3 style="color:#1F3864;">Informe de deuda financiera — cierre ${t.mes}</h3>` +
    `<table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px;"><tr style="background:#1F3864;color:#fff;"><th>Concepto</th><th>Monto</th></tr>` +
    `<tr><td>Deuda en colones</td><td align="right">${fmtN(t.crc, 'CRC')}</td></tr>` +
    `<tr><td>Deuda en dólares</td><td align="right">${fmtN(t.usd, 'USD')}</td></tr>` +
    `<tr><td><b>Deuda total equivalente (TC ₡${t.tc.toFixed(2)})</b></td><td align="right"><b>${fmtN(t.eqUSD, 'USD')}</b></td></tr>` +
    `<tr><td>Variación vs. cierre anterior</td><td align="right">${sg(t.variacionUSD)}</td></tr>` +
    `<tr><td>Tasa ponderada</td><td align="right">${(t.tasaPond * 100).toFixed(2)}%</td></tr>` +
    `<tr><td>Interés causado del mes</td><td align="right">${fmtN(t.causado.crc, 'CRC')} + ${fmtN(t.causado.usd, 'USD')}</td></tr></table>` +
    `<ul style="color:#333;">${t.puntos.map(p => '<li>' + p + '</li>').join('')}</ul>` +
    `<p style="color:#555;">Detalle en el Excel adjunto. Complete la hoja <b>Conciliación</b> con los saldos de los estados de cuenta para validar cada operación.</p></div>`;
  const r = await enviarEmail(`Informe de deuda COFERSA — cierre ${t.mes}`, html, [{ filename, content: buffer }]);
  return { tipo: 'informe-cfo', archivo: filename, ...r };
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== 'Bearer ' + secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const r = await buildResumenDeuda();
    const fecha = r.today.toLocaleDateString('es-CR');
    const enviados = [];

    // Envío a demanda del Apartado de Intereses: /api/cron/reporte-diario?apartado=1[&anio=2026&mes=9]
    if (req.query.apartado) {
      const a = await enviarApartado(parseInt(req.query.anio, 10) || undefined, parseInt(req.query.mes, 10) || undefined);
      return res.status(200).json({ ok: true, fecha, enviados: [a] });
    }

    // Envío a demanda del informe para el CFO: /api/cron/reporte-diario?cfo=1[&anio=2026&mes=9]
    if (req.query.cfo) {
      const a = await enviarInformeCfo(parseInt(req.query.anio, 10) || undefined, parseInt(req.query.mes, 10) || undefined);
      return res.status(200).json({ ok: true, fecha, enviados: [a] });
    }

    const alertaHtml = buildAlertaPagosHtml(r);
    if (alertaHtml) {
      const res1 = await enviarEmail('⚠️ Alerta de Pagos Próximos — Cofersa ' + fecha, alertaHtml);
      enviados.push({ tipo: 'alerta', ...res1 });
    }

    const res2 = await enviarEmail('Resumen Diario de Deuda — Cofersa ' + fecha, buildResumenHtml(r, 'diario'));
    enviados.push({ tipo: 'diario', ...res2 });

    if (r.today.getDay() === 1) {
      const res3 = await enviarEmail('Resumen Semanal de Deuda — Cofersa ' + fecha, buildResumenHtml(r, 'semanal'));
      enviados.push({ tipo: 'semanal', ...res3 });
    }

    if (r.today.getDate() === 1) {
      enviados.push(await enviarApartado());
      enviados.push(await enviarInformeCfo());
      const res4 = await enviarEmail('Resumen Mensual de Deuda — Cofersa ' + fecha, buildResumenHtml(r, 'mensual'));
      enviados.push({ tipo: 'mensual', ...res4 });
    }

    return res.status(200).json({
      ok: true,
      fecha,
      saldoCRC: r.saldoCRC,
      saldoUSD: r.saldoUSD,
      vencidas: r.vencidasLineas.length,
      proxVencer: r.proxVencerLineas.length,
      cuotasPendientes: r.cuotasPendientes.length,
      enviados,
    });
  } catch (err) {
    console.error('reporte-diario:', err);
    return res.status(500).json({ error: err.message });
  }
}
