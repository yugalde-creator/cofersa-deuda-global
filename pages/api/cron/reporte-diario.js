import nodemailer from 'nodemailer';
const { readRows, SHEETS } = require('../../../lib/sheets');

const FX = 452.93;

function parseMonto(v) {
  if (v === undefined || v === null || v === '') return 0;
  return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0;
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
      pagosByLinea[lid].push({ fecha: p.Fecha, capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), estado: p.Estado || 'Pendiente' });
    });

    let saldoCRC = 0, saldoUSD = 0;
    lineas.forEach(l => {
      const cuotas = (pagosByLinea[l.id] || []).filter(c => c.estado !== 'Pagado');
      saldoCRC += l.moneda === 'USD' ? 0 : cuotas.reduce((s,c)=>s+c.capital,0);
      saldoUSD += l.moneda === 'USD' ? cuotas.reduce((s,c)=>s+c.capital,0) : 0;
    });
    leasing.forEach(lr => {
      const moneda = lr.Moneda || 'CRC';
      const lPags = leasingPagos.filter(p => p.ID_Contrato === lr.ID && (p.Estado||'Pendiente') !== 'Pagado');
      const s = lPags.reduce((t,p)=>t+parseMonto(p.Capital)+parseMonto(p.Interes),0);
      if (moneda === 'USD') saldoUSD += s; else saldoCRC += s;
    });

    const en90 = new Date(today); en90.setDate(en90.getDate()+90);
    const proxVencer = lineas.filter(l => { if(!l.vencimiento) return false; const d=new Date(String(l.vencimiento).split('T')[0]+'T12:00:00'); return d>=today&&d<=en90; });
    const vencidas = lineas.filter(l => { if(!l.vencimiento) return false; const d=new Date(String(l.vencimiento).split('T')[0]+'T12:00:00'); return d<today; });

    const cuotasMes = [];
    lineas.forEach(l => {
      (pagosByLinea[l.id]||[]).forEach(c => {
        if(c.fecha && c.fecha.slice(0,7)===mesActual && c.estado!=='Pagado')
          cuotasMes.push({banco:l.banco, moneda:l.moneda, capital:c.capital, interes:c.interes||0, fecha:c.fecha});
      });
    });

    const reportData = {
      saldoCRC: Math.round(saldoCRC),
      saldoUSD: Math.round(saldoUSD),
      saldoTotalCRC: Math.round(saldoCRC + saldoUSD*FX),
      proxVencer: proxVencer.length,
      proxVencerDetalle: proxVencer.map(l=>({banco:l.banco, tipo:l.tipo, vencimiento:fmtDate(l.vencimiento)})),
      vencidas: vencidas.length,
      vendidasDetalle: vencidas.map(l=>({banco:l.banco, tipo:l.tipo, vencimiento:fmtDate(l.vencimiento)})),
      cuotasMes: cuotasMes.length,
      cuotasMesDetalle: cuotasMes.map(c=>({banco:c.banco, moneda:c.moneda, capital:c.capital, interes:c.interes, fecha:fmtDate(c.fecha)})),
      fecha: today.toLocaleDateString('es-CR'),
    };

    // Try email — never fail the request if email breaks
    let emailSent = false, emailError = null;
    try {
      const html = '<h2>Reporte Diario Cofersa - '+reportData.fecha+'</h2>'+
        '<p><b>Saldo CRC:</b> '+String.fromCharCode(8353)+reportData.saldoCRC.toLocaleString('en-US')+'<br>'+
        '<b>Saldo USD:</b> $'+reportData.saldoUSD.toLocaleString('en-US')+'<br>'+
        '<b>Total CRC (FX '+FX+'):</b> '+String.fromCharCode(8353)+reportData.saldoTotalCRC.toLocaleString('en-US')+'</p>'+
        '<h3>Cuotas del mes ('+cuotasMes.length+')</h3>'+
        '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Banco</th><th>Capital</th><th>Interes</th><th>Fecha</th></tr>'+
        cuotasMes.map(c=>'<tr><td>'+c.banco+'</td><td>'+c.capital.toLocaleString('en-US')+'</td><td>'+(c.interes||0).toLocaleString('en-US')+'</td><td>'+fmtDate(c.fecha)+'</td></tr>').join('')+'</table>'+
        '<h3>Proximos a vencer ('+proxVencer.length+')</h3>'+
        proxVencer.map(l=>'<p>'+l.banco+' - '+l.tipo+' - '+fmtDate(l.vencimiento)+'</p>').join('')+
        '<h3>Vencidas ('+vencidas.length+')</h3>'+
        vencidas.map(l=>'<p>'+l.banco+' - '+l.tipo+' - '+fmtDate(l.vencimiento)+'</p>').join('');
      const transporter = nodemailer.createTransport({ service:'gmail', auth:{user:process.env.EMAIL_USER, pass:process.env.EMAIL_PASS} });
      await transporter.sendMail({ from:process.env.EMAIL_USER, to:'yugalde@cofersa.cr', subject:'Reporte Diario Cofersa '+reportData.fecha, html });
      emailSent = true;
    } catch(e) { emailError = e.message; }

    return res.status(200).json({ ok:true, emailSent, emailError, ...reportData });
  } catch(err) {
    console.error('reporte-diario:', err);
    return res.status(500).json({ error: err.message });
  }
}
