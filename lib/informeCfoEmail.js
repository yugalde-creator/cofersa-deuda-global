/**
 * Cuerpo HTML del correo mensual "Informe de deuda para el CFO".
 * Diseño de correo: tablas + estilos en línea (compatible con Gmail/Outlook y móvil), 640 px máximo.
 * t = resumen que devuelve generarInformeCfoXlsx().
 */
const NAVY = '#1F3864', BLUE = '#2E75B6', INK = '#1a1a1a', MUTED = '#6b7280', LINE = '#e5e7eb', SOFT = '#f4f6fa';
const FONT = "font-family:'Segoe UI',Helvetica,Arial,sans-serif;";

const num = (n, d = 0) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const usdM = n => '$' + num(n / 1e6, 2) + ' M';
const crcM = n => '₡' + num(n / 1e6, 0) + ' M';
const pct = (v, d = 2) => (v * 100).toFixed(d) + '%';

const TEND = {
  Subiendo: { txt: '↑ Subiendo', fg: '#b42318', bg: '#fee4e2' },
  Bajando: { txt: '↓ Bajando', fg: '#067647', bg: '#d1fadf' },
  Estable: { txt: '→ Estable', fg: '#475467', bg: '#eaecf0' },
};

const th = (txt, al = 'right') => `<td align="${al}" style="${FONT}font-size:11px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:.4px;padding:0 0 8px;">${txt}</td>`;
const seccion = txt => `<tr><td style="padding:26px 28px 10px;${FONT}font-size:15px;font-weight:700;color:${NAVY};">${txt}</td></tr>`;

function kpi(label, valor, sub, subColor) {
  return `<td width="33%" valign="top" style="padding:0 5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:8px;"><tr><td style="padding:14px 14px 12px;">
    <div style="${FONT}font-size:11px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:.4px;">${label}</div>
    <div style="${FONT}font-size:24px;font-weight:700;color:${NAVY};margin:6px 0 4px;line-height:1.1;">${valor}</div>
    <div style="${FONT}font-size:12px;color:${subColor || MUTED};">${sub}</div></td></tr></table></td>`;
}

function buildInformeCfoHtml(t) {
  const sube = t.variacionUSD >= 0;
  const varTxt = `${sube ? '▲ +' : '▼ −'}$${num(Math.abs(t.variacionUSD) / 1000, 0)} mil (${sube ? '+' : '−'}${Math.abs(t.variacionPct * 100).toFixed(1)}%) vs. mes anterior`;

  const maxPct = Math.max(...t.bancos.map(b => b.pct), 0.01);
  const filasBanco = t.bancos.map(b => `<tr>
      <td style="${FONT}font-size:14px;font-weight:600;color:${INK};padding:7px 0;width:104px;">${b.banco}</td>
      <td style="padding:7px 10px 7px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${Math.max(3, Math.round(b.pct / maxPct * 100))}%" style="background:${BLUE};height:9px;border-radius:5px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
      <td align="right" style="${FONT}font-size:14px;color:${INK};padding:7px 0;white-space:nowrap;width:96px;">${usdM(b.eqUSD)}</td>
      <td align="right" style="${FONT}font-size:13px;color:${MUTED};padding:7px 0 7px 10px;width:48px;">${(b.pct * 100).toFixed(0)}%</td></tr>`).join('');

  const filasTasa = t.tasas.map(x => {
    const tot = x.banco === 'TOTAL', T = TEND[x.tend];
    return `<tr style="${tot ? `background:${SOFT};` : ''}">
      <td style="${FONT}font-size:14px;font-weight:${tot ? 700 : 600};color:${INK};padding:9px ${tot ? '8px' : '0'};border-top:1px solid ${LINE};">${tot ? 'COFERSA' : x.banco}</td>
      <td align="right" style="${FONT}font-size:14px;color:${MUTED};padding:9px 8px;border-top:1px solid ${LINE};">${pct(x.nominal)}</td>
      <td align="right" style="${FONT}font-size:16px;font-weight:700;color:${NAVY};padding:9px 8px;border-top:1px solid ${LINE};">${pct(x.efectiva12)}</td>
      <td align="right" style="padding:9px ${tot ? '8px' : '0'} 9px 8px;border-top:1px solid ${LINE};"><span style="${FONT}display:inline-block;font-size:12px;font-weight:600;color:${T.fg};background:${T.bg};border-radius:10px;padding:3px 10px;white-space:nowrap;">${T.txt}</span></td></tr>`;
  }).join('');

  const puntos = t.puntos.slice(0, 4).map(p => `<tr><td valign="top" style="padding:0 0 10px;width:14px;${FONT}font-size:14px;color:${BLUE};">●</td><td style="padding:0 0 10px;${FONT}font-size:14px;line-height:1.5;color:#374151;">${p}</td></tr>`).join('');

  return `<!doctype html><html><body style="margin:0;padding:0;background:#eef1f6;">
<div style="display:none;max-height:0;overflow:hidden;color:#eef1f6;">Deuda total ${usdM(t.eqUSD)} al cierre de ${t.mes}. Tasa ponderada ${pct(t.tasaPond)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">

<tr><td style="background:${NAVY};padding:26px 28px 22px;">
  <div style="${FONT}font-size:11px;font-weight:600;color:#9db8e0;letter-spacing:1.4px;text-transform:uppercase;">COFERSA · Gerencia Financiera</div>
  <div style="${FONT}font-size:24px;font-weight:700;color:#ffffff;margin:6px 0 2px;">Informe de deuda financiera</div>
  <div style="${FONT}font-size:14px;color:#cfe0f7;">Cierre al ${t.fechaCierre}</div>
</td></tr>

<tr><td style="padding:22px 23px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  ${kpi('Deuda total', usdM(t.eqUSD), varTxt, sube ? '#b42318' : '#067647')}
  ${kpi('En colones', crcM(t.eqUSD * t.tc), 'TC ₡' + num(t.tc, 2))}
  ${kpi('Tasa ponderada', pct(t.tasaPond), t.ops + ' operaciones')}
</tr></table></td></tr>

${seccion('Deuda por acreedor')}
<tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filasBanco}</table>
  <div style="${FONT}font-size:12px;color:${MUTED};padding-top:6px;">Saldos en US$ equivalentes · ₡${num(t.crc, 0)} + $${num(t.usd, 0)}</div></td></tr>

${seccion('Tasa efectiva real por acreedor · 12 meses')}
<tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>${th('Acreedor', 'left')}${th('Nominal hoy')}${th('Efectiva 12 m')}${th('Tendencia')}</tr>${filasTasa}</table>
  <div style="${FONT}font-size:12px;color:${MUTED};padding-top:8px;">Tendencia: últimos 6 meses contra los 6 anteriores.</div></td></tr>

${seccion('Costo financiero de ' + t.mes.split(' ')[0].toLowerCase())}
<tr><td style="padding:0 23px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  ${kpi('Causado', '$' + num(t.causado.usd + t.causado.crc / t.tc, 0), '₡' + num(t.causado.crc, 0) + ' + $' + num(t.causado.usd, 0))}
  ${kpi('Pagado', '$' + num(t.ejecutado.usd + t.ejecutado.crc / t.tc, 0), '₡' + num(t.ejecutado.crc, 0) + ' + $' + num(t.ejecutado.usd, 0))}
  ${kpi('Proyectado', '$' + num(t.proyeccion.usd + t.proyeccion.crc / t.tc, 0), 'mes siguiente')}
</tr></table></td></tr>

${seccion('Puntos de atención')}
<tr><td style="padding:0 28px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${puntos}</table></td></tr>

<tr><td style="padding:14px 28px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:8px;"><tr><td style="padding:14px 16px;${FONT}font-size:13px;line-height:1.5;color:#374151;">
  <b style="color:${NAVY};">Detalle en el Excel adjunto:</b> operaciones, vencimientos a 12 meses, intereses y conciliación con los estados de cuenta. Complete la hoja <i>Conciliación</i> con los saldos de los bancos para validar cada operación.
</td></tr></table></td></tr>

<tr><td style="padding:14px 28px;border-top:1px solid ${LINE};${FONT}font-size:11px;color:${MUTED};">Generado automáticamente por Deuda Global · COFERSA</td></tr>
</table></td></tr></table></body></html>`;
}

module.exports = { buildInformeCfoHtml };
