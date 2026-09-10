const nodemailer = require('nodemailer');
const { readRows, SHEETS } = require('../../../lib/sheets');

function parseMonto(v) {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0;
}

function fmtDateGlosa(s) {
  if (!s) return '?';
  const d = new Date(String(s).split('T')[0] + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  return dd+'-'+mm+'-'+yy;
}

function fmtDateDisplay(s) {
  if (!s) return '-';
  const d = new Date(String(s).split('T')[0]+'T12:00:00');
  return d.toLocaleDateString('es-CR',{day:'2-digit',month:'2-digit',year:'numeric'});
}

function buildGlosa(linea, fechaPago, fechaAnterior) {
  const banco = linea.Banco;
  const numOp = linea.NumOp;
  const moneda = linea.Moneda || 'CRC';
  const monto = parseMonto(linea.Aprobado);
  const vcto = linea.FechaVencimiento;
  let montoStr;
  if (moneda === 'USD') {
    montoStr = '$' + monto.toLocaleString('en-US',{minimumFractionDigits:2});
  } else {
    const parts = monto.toFixed(2).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    montoStr = String.fromCharCode(8353) + intPart + ',' + parts[1];
  }
  return 'Pago '+banco+' Prest.Nro.'+numOp+' + Ints.D/'+fmtDateGlosa(fechaAnterior)+'/'+fmtDateGlosa(fechaPago)+' '+montoStr+' vcto '+fmtDateGlosa(vcto);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const { lineaId, fecha, capitalReal, interesReal } = req.body;
  if (!lineaId || !fecha) return res.status(400).json({error:'Faltan datos'});
  try {
    const [activas, pagos] = await Promise.all([
      readRows(SHEETS.ACTIVAS),
      readRows(SHEETS.PAGOS_PROG),
    ]);
    const linea = activas.find(a => a.ID === lineaId);
    if (!linea) return res.status(404).json({error:'Linea no encontrada: '+lineaId});

    const pagosPrevios = pagos
      .filter(p => p.ID_Linea === lineaId && p.Estado === 'Pagado' && p.Fecha < fecha)
      .sort((a,b) => b.Fecha.localeCompare(a.Fecha));
    const fechaAnterior = pagosPrevios.length > 0 ? pagosPrevios[0].Fecha : linea.FechaInicio;

    const glosa = buildGlosa(linea, fecha, fechaAnterior);
    const moneda = linea.Moneda || 'CRC';
    const symbol = moneda === 'USD' ? '$' : String.fromCharCode(8353);
    const capFmt = symbol + Math.abs(capitalReal||0).toLocaleString('es-CR',{minimumFractionDigits:2});
    const intFmt = symbol + Math.abs(interesReal||0).toLocaleString('es-CR',{minimumFractionDigits:2});
    const totalFmt = symbol + (Math.abs(capitalReal||0)+Math.abs(interesReal||0)).toLocaleString('es-CR',{minimumFractionDigits:2});

    const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">'+
      '<h2 style="color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:.5rem">Comprobante de Pago - COFERSA</h2>'+
      '<table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">'+
      '<tr><td style="padding:.4rem .6rem;color:#666">Banco</td><td style="padding:.4rem .6rem;font-weight:600">'+linea.Banco+'</td></tr>'+
      '<tr style="background:#f8f9fa"><td style="padding:.4rem .6rem;color:#666">N Operacion</td><td style="padding:.4rem .6rem;font-weight:600">'+linea.NumOp+'</td></tr>'+
      '<tr><td style="padding:.4rem .6rem;color:#666">Moneda</td><td style="padding:.4rem .6rem">'+moneda+'</td></tr>'+
      '<tr style="background:#f8f9fa"><td style="padding:.4rem .6rem;color:#666">Fecha de Pago</td><td style="padding:.4rem .6rem">'+fmtDateDisplay(fecha)+'</td></tr>'+
      '<tr><td style="padding:.4rem .6rem;color:#666">Periodo</td><td style="padding:.4rem .6rem">'+fmtDateDisplay(fechaAnterior)+' al '+fmtDateDisplay(fecha)+'</td></tr>'+
      '</table>'+
      '<h3 style="color:#1a5276">Desglose del Pago</h3>'+
      '<table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">'+
      '<thead><tr style="background:#1a5276;color:#fff"><th style="padding:.5rem;text-align:left">Concepto</th><th style="padding:.5rem;text-align:right">Monto ('+moneda+')</th></tr></thead>'+
      '<tbody>'+
      '<tr><td style="padding:.4rem .6rem;border-bottom:1px solid #eee">Amortizacion de Capital</td><td style="padding:.4rem .6rem;text-align:right">'+capFmt+'</td></tr>'+
      '<tr style="background:#f8f9fa"><td style="padding:.4rem .6rem;border-bottom:1px solid #eee">Interes</td><td style="padding:.4rem .6rem;text-align:right">'+intFmt+'</td></tr>'+
      '<tr style="font-weight:700;background:#e8f4fd"><td style="padding:.5rem .6rem">Total Pagado</td><td style="padding:.5rem .6rem;text-align:right">'+totalFmt+'</td></tr>'+
      '</tbody></table>'+
      '<div style="background:#f0f9ff;border-left:4px solid #1a5276;padding:1rem;margin-bottom:1.5rem">'+
      '<p style="margin:0 0 .4rem;font-size:.85rem;color:#666;font-weight:600">GLOSA ERP - COPIAR Y PEGAR EN ASIENTO CONTABLE</p>'+
      '<code style="font-family:monospace;font-size:.95rem;color:#1a5276">'+glosa+'</code>'+
      '</div>'+
      '<p style="font-size:.8rem;color:#999;border-top:1px solid #eee;padding-top:.75rem">'+
      'COFERSA - '+linea.Banco+' | '+linea.NumOp+' - '+moneda+' - '+fmtDateDisplay(fecha)+'</p>'+
      '</div>';

    let emailSent = false, emailError = null;
    try {
      const transporter = nodemailer.createTransport({service:'gmail',auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS}});
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'yugalde@cofersa.cr',
        subject: 'Pago registrado: '+linea.Banco+' '+linea.NumOp+' - '+fmtDateDisplay(fecha),
        html,
      });
      emailSent = true;
    } catch(e) { emailError = e.message; }

    return res.status(200).json({ok:true, glosa, emailSent, emailError});
  } catch(err) {
    console.error('notificar-pago:', err);
    return res.status(500).json({error: err.message});
  }
}
