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
