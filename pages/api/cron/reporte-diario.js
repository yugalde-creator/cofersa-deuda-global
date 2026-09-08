const nodemailer = require('nodemailer');
const { readRows, SHEETS } = require('../../../lib/sheets');

const FX = 452.93; // fallback CRC/USD

function parseMonto(v) {
  if (v === undefined || v === null || v === '') return 0;
  return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0;
}

function fmt(n, cur) {
  if (cur === 'USD') return '$' + Math.round(n).toLocaleString('en-US');
  return '₡' + Math.round(n).toLocaleString('es-CR');
}

function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(String(s).split('T')[0] + 'T12:00:00');
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== 'Bearer ' + secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [activas, pagosProg, leasing, leasingPagos] = await Promise.all([
      readRows(SHEETS.ACTIVAS),
      readRows(SHEETS.PAGOS_PROG),
      readRows(SHEETS.LEASING),
      readRows(SHEETS.LEASING_PAGOS),
    ]);

    const today = new Date(); today.setHours(0,0,0,0);
    const mesActual = today.toISOString().slice(0,7);

    const lineas = activas.map(a => ({
      id: a.ID, banco: a.Banco, tipo: a.Tipo, moneda: a.Moneda,
      aprobado: parseMonto(a.Aprobado), vencimiento: a.FechaVencimiento || '',
    }));

    const pagosByLinea = {};
    pagosProg.forEach(p => {
      const lid = p.ID_Linea;
      if (!pagosByLinea[lid]) pagosByLinea[lid] = [];
      pagosByLinea[lid].push({ fecha: p.Fecha, capital: parseMonto(p.Capital), estado: p.Estado || 'Pendiente' });
    });

    let saldoCRC = 0, saldoUSD = 0;
    lineas.forEach(l => {
      const cuotas = (pagosByLinea[l.id] || []).filter(c => c.estado !== 'Pagado');
      const saldo = cuotas.reduce((s, c) => s + c.capital, 0);
      if (l.moneda === 'USD') saldoUSD += saldo;
      else saldoCRC += saldo;
    });

    leasing.forEach(lr => {
      const lid = lr.ID;
      const moneda = lr.Moneda || 'CRC';
      const lPags = leasingPagos.filter(p => p.ID_Contrato === lid && (p.Estado || 'Pendiente') !== 'Pagado');
      const saldo = lPags.reduce((s, p) => s + parseMonto(p.Capital) + parseMonto(p.Interes), 0);
      if (moneda === 'USD') saldoUSD += saldo;
      else saldoCRC += saldo;
    });

    const saldoTotalCRC = saldoCRC + saldoUSD * FX;

    const cuotasMes = [];
    Object.entries(pagosByLinea).forEach(([lid, cuotas]) => {
      const l = lineas.find(x => x.id === lid);
      cuotas.filter(c => c.fecha && c.fecha.slice(0,7) === mesActual && c.estado !== 'Pagado')
        .forEach(c => cuotasMes.push({ banco: l?.banco||lid, moneda: l?.moneda||'CRC', capital: c.capital, fecha: c.fecha }));
    });

    const proxVencer = [], vencidas = [];
    lineas.forEach(l => {
      if (!l.vencimiento) return;
      const v = new Date(String(l.vencimiento).split('T')[0] + 'T12:00:00');
      const diff = Math.round((v - today) / 86400000);
      if (diff >= 0 && diff <= 30) proxVencer.push({ ...l, diff });
      if (diff < 0) vencidas.push({ ...l, diff: Math.abs(diff) });
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{color:#1a1a2e;font-size:22px;margin:0 0 4px} .sub{color:#666;font-size:13px;margin-bottom:20px}
h2{font-size:15px;color:#333;margin:0 0 12px;border-bottom:2px solid #e0e0e0;padding-bottom:6px}
.kpi-row{display:flex;gap:16px;flex-wrap:wrap}
.kpi{background:#f8f9ff;border-radius:6px;padding:12px 20px}
.kpi-label{font-size:11px;color:#888;text-transform:uppercase}
.kpi-value{font-size:20px;font-weight:bold;color:#1a1a2e}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f0f0f0;padding:8px;text-align:left;font-size:12px}
td{padding:8px;border-bottom:1px solid #f0f0f0}
.red{background:#fee;color:#c00;padding:2px 8px;border-radius:12px;font-size:11px}
.orange{background:#fff3e0;color:#e65c00;padding:2px 8px;border-radius:12px;font-size:11px}
.footer{font-size:11px;color:#aaa;text-align:center;margin-top:24px}
</style></head><body>
<h1>📊 Reporte Diario — Cofersa Deuda</h1>
<p class="sub">${today.toLocaleDateString('es-CR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
<div class="card"><h2>Saldo Total de Deuda</h2>
<div class="kpi-row">
<div class="kpi"><div class="kpi-label">Saldo CRC</div><div class="kpi-value">${fmt(saldoCRC,'CRC')}</div></div>
<div class="kpi"><div class="kpi-label">Saldo USD</div><div class="kpi-value">${fmt(saldoUSD,'USD')}</div></div>
<div class="kpi"><div class="kpi-label">Total (equiv. CRC)</div><div class="kpi-value">${fmt(saldoTotalCRC,'CRC')}</div></div>
</div></div>
${proxVencer.length?'<div class="card"><h2>⚠️ Vencimientos Próximos (30 días) — '+proxVencer.length+'</h2><table><tr><th>Banco</th><th>Tipo</th><th>Moneda</th><th>Vencimiento</th><th>Días</th></tr>'+proxVencer.sort((a,b)=>a.diff-b.diff).map(x=>'<tr><td>'+x.banco+'</td><td>'+x.tipo+'</td><td>'+x.moneda+'</td><td>'+fmtDate(x.vencimiento)+'</td><td><span class="orange">'+x.diff+'d</span></td></tr>').join('')+'</table></div>':''}
${vencidas.length?'<div class="card"><h2>🔴 Líneas Vencidas — '+vencidas.length+'</h2><table><tr><th>Banco</th><th>Tipo</th><th>Moneda</th><th>Vencimiento</th><th>Días</th></tr>'+vencidas.map(x=>'<tr><td>'+x.banco+'</td><td>'+x.tipo+'</td><td>'+x.moneda+'</td><td>'+fmtDate(x.vencimiento)+'</td><td><span class="red">'+x.diff+'d</span></td></tr>').join('')+'</table></div>':''}
${cuotasMes.length?'<div class="card"><h2>📅 Cuotas Este Mes ('+mesActual+')</h2><table><tr><th>Banco</th><th>Moneda</th><th>Capital</th><th>Fecha</th></tr>'+cuotasMes.map(c=>'<tr><td>'+c.banco+'</td><td>'+c.moneda+'</td><td>'+fmt(c.capital,c.moneda)+'</td><td>'+fmtDate(c.fecha)+'</td></tr>').join('')+'</table></div>':''}
<p class="footer">Generado automáticamente · <a href="https://cofersa-deuda-global.vercel.app">Cofersa Deuda Global</a></p>
</body></html>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const subject = proxVencer.length
      ? `⚠️ Reporte Deuda — ${proxVencer.length} vencimiento(s) próximo(s)`
      : `📊 Reporte Deuda — ${today.toLocaleDateString('es-CR')}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'yugalde@cofersa.cr',
      subject, html,
    });

    return res.status(200).json({
      ok: true,
      saldoCRC: Math.round(saldoCRC), saldoUSD: Math.round(saldoUSD),
      proxVencer: proxVencer.length, vencidas: vencidas.length, cuotasMes: cuotasMes.length,
    });
  } catch(err) {
    console.error('reporte-diario:', err);
    return res.status(500).json({ error: err.message });
  }
}
