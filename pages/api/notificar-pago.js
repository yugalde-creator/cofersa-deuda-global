import nodemailer from 'nodemailer';
import { readRows, SHEETS } from '../../lib/sheets.js';

function parseMonto(v) {
  if (!v && v !== 0) return 0;
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

function fmtToday() {
  return fmtDateDisplay(new Date().toISOString().split('T')[0]);
}

function fmtCRC(n) {
  if (!n && n !== 0) return '\u20a1 0,00';
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  return '\u20a1 ' + intPart + ',' + parts[1];
}

function fmtUSD(n) {
  if (!n && n !== 0) return '$ 0.00';
  return '$ ' + Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function fmtMonto(n, moneda) {
  return moneda === 'USD' ? fmtUSD(n) : fmtCRC(n);
}

function fmtMontoGlosa(n, moneda) {
  if (moneda === 'USD') {
    return '$' + Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2});
  } else {
    const parts = Math.abs(n).toFixed(2).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    return '\u20a1' + intPart + ',' + parts[1];
  }
}

function daysBetween(d1, d2) {
  const a = new Date(String(d1).split('T')[0]+'T12:00:00');
  const b = new Date(String(d2).split('T')[0]+'T12:00:00');
  return Math.round((b - a) / 86400000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  const { lineaId, fecha, capitalReal, interesReal, tc, estado } = req.body;
  if (!lineaId || !fecha) return res.status(400).json({error:'Faltan datos'});

  try {
    const [activas, pagos] = await Promise.all([
      readRows(SHEETS.ACTIVAS),
      readRows(SHEETS.PAGOS_PROG),
    ]);

    const linea = activas.find(a => a.ID === lineaId);
    if (!linea) return res.status(404).json({error:'Linea no encontrada: '+lineaId});

    const pagosPrevios = pagos
      .filter(p => p.ID_Linea === lineaId && (p.Estado === 'Pagado' || p.Estado === 'Cancelado') && p.Fecha < fecha)
      .sort((a,b) => b.Fecha.localeCompare(a.Fecha));
    const fechaAnterior = pagosPrevios.length > 0 ? pagosPrevios[0].Fecha : linea.FechaInicio;

    const cuotaPlan = pagos.find(p => p.ID_Linea === lineaId && p.Fecha === fecha)
      || pagos.filter(p => p.ID_Linea === lineaId && p.Fecha <= fecha)
          .sort((a,b) => b.Fecha.localeCompare(a.Fecha))[0];

    const capitalProg  = cuotaPlan ? parseMonto(cuotaPlan.Capital)  : 0;
    const interesProg  = cuotaPlan ? parseMonto(cuotaPlan.Interes)  : 0;

    const montoAprobado = parseMonto(linea.Aprobado);
    const capitalPrevioTotal = pagosPrevios.reduce((sum, p) => sum + parseMonto(p.Capital), 0);
    const saldoAntes = montoAprobado - capitalPrevioTotal;

    const tasa = parseMonto(linea.Tasa);
    const diasPeriodo = daysBetween(fechaAnterior, fecha);
    const interesCalculado = saldoAntes * (tasa / 100) * (diasPeriodo / 360);

    const capReal   = parseMonto(capitalReal)  || 0;
    const intReal   = parseMonto(interesReal)  || 0;
    const totalReal = capReal + intReal;

    const tcVal = parseMonto(tc) || 0;
    const capUSD   = tcVal > 0 ? capReal   / tcVal : 0;
    const totalUSD = tcVal > 0 ? totalReal / tcVal : 0;

    const moneda = linea.Moneda || 'CRC';
    const estadoLabel = estado || 'Pagado';

    const glosa = 'Pago '+linea.Banco+' Prest.Nro.'+linea.NumOp
      +' + Ints.D/'+fmtDateGlosa(fechaAnterior)+'/'+fmtDateGlosa(fecha)
      +' '+fmtMontoGlosa(saldoAntes, moneda)
      +' vcto '+fmtDateGlosa(linea.FechaVencimiento);

    const difInt  = intReal  - interesProg;

    function fmtDif(n) {
      if (Math.abs(n) < 0.01) return '<span style="color:#27ae60">\u2014 igual \u2014</span>';
      const sign = n > 0 ? '+' : '';
      return '<span style="color:'+(n<0?'#27ae60':'#e74c3c')+'">'+sign+fmtMonto(n, moneda)+'</span>';
    }

    const estatusBg = estadoLabel === 'Cancelado' || estadoLabel === 'Pagado' ? '#27ae60' : '#e74c3c';

    const html = `
<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#222;background:#fff">
  <table style="width:100%;border-bottom:3px solid #1a5276;padding-bottom:12px;margin-bottom:16px">
    <tr>
      <td>
        <div style="font-size:11px;color:#888;font-weight:600;letter-spacing:1px">COFERSA</div>
        <div style="font-size:22px;font-weight:700;color:#1a5276">Comprobante de Pago</div>
        <div style="margin-top:4px">
          <span style="background:${estatusBg};color:#fff;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.5px">${estadoLabel.toUpperCase()}</span>
          <span style="color:#555;font-size:12px;margin-left:8px">\u2014 ${fmtDateDisplay(fecha)}</span>
        </div>
      </td>
      <td style="text-align:right;font-size:12px;color:#555;line-height:1.8">
        <div><strong>Operaci\u00f3n:</strong> ${linea.Banco} | ${linea.NumOp}</div>
        <div><strong>Moneda:</strong> ${moneda}</div>
        <div><strong>Generado:</strong> ${fmtToday()}</div>
        ${tcVal > 0 ? '<div><strong>TC:</strong> '+fmtCRC(tcVal)+'</div>' : ''}
      </td>
    </tr>
  </table>
  <table style="width:100%;margin-bottom:20px;vertical-align:top">
    <tr>
      <td style="width:48%;vertical-align:top;padding-right:12px">
        <div style="font-size:10px;font-weight:700;color:#1a5276;letter-spacing:.8px;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">\u25c6 DATOS DE LA OPERACI\u00d3N</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <tr><td style="padding:3px 0;color:#666">Banco</td><td style="text-align:right;font-weight:600">${linea.Banco}</td></tr>
          <tr><td style="padding:3px 0;color:#666">N\u00b0 Operaci\u00f3n</td><td style="text-align:right;font-weight:600">${linea.NumOp}</td></tr>
          <tr><td style="padding:3px 0;color:#666">Monto Original</td><td style="text-align:right">${fmtMonto(montoAprobado, moneda)}</td></tr>
          <tr><td style="padding:3px 0;color:#666">Tasa Anual</td><td style="text-align:right">${tasa.toFixed(2)}%</td></tr>
          <tr><td style="padding:3px 0;color:#666">Plazo</td><td style="text-align:right">${linea.Plazo || '-'}</td></tr>
          <tr><td style="padding:3px 0;color:#666">F. Vencimiento</td><td style="text-align:right">${fmtDateDisplay(linea.FechaVencimiento)}</td></tr>
          <tr style="border-top:1px solid #eee"><td style="padding:5px 0;color:#666;font-weight:600">Saldo antes del pago</td><td style="text-align:right;font-weight:700">${fmtMonto(saldoAntes, moneda)}</td></tr>
        </table>
      </td>
      <td style="width:4%"></td>
      <td style="width:48%;vertical-align:top">
        <div style="font-size:10px;font-weight:700;color:#1a5276;letter-spacing:.8px;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">\u25c6 DETALLE DEL PAGO</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <tr><td style="padding:3px 0;color:#666">Fecha de pago</td><td style="text-align:right;font-weight:600">${fmtDateDisplay(fecha)}</td></tr>
          <tr><td style="padding:3px 0;color:#666">Fecha pago anterior</td><td style="text-align:right">${fmtDateDisplay(fechaAnterior)}</td></tr>
          <tr><td style="padding:3px 0;color:#666">D\u00edas del per\u00edodo</td><td style="text-align:right;font-weight:600">${diasPeriodo} d\u00edas</td></tr>
          <tr><td style="padding:3px 0;color:#666">Capital</td><td style="text-align:right">${fmtMonto(capReal, moneda)}</td></tr>
          <tr><td style="padding:3px 0;color:#666">Inter\u00e9s programado</td><td style="text-align:right">${fmtMonto(interesProg, moneda)}</td></tr>
          <tr style="border-top:1px solid #eee"><td style="padding:5px 0;font-weight:600">Total pagado al banco</td><td style="text-align:right;font-weight:700">${fmtMonto(totalReal, moneda)}</td></tr>
          ${moneda !== 'USD' && tcVal > 0 ? `
          <tr><td style="padding:3px 0;color:#666;font-size:11px">Capital USD equiv.</td><td style="text-align:right;font-size:11px">${fmtUSD(capUSD)}</td></tr>
          <tr><td style="padding:3px 0;color:#666;font-size:11px">Total USD equiv.</td><td style="text-align:right;font-size:11px">${fmtUSD(totalUSD)}</td></tr>
          ` : ''}
          <tr><td style="padding:3px 0;color:#666;font-size:11px">KEY OPERACI\u00d3N</td><td style="text-align:right;font-size:10px;font-weight:700;letter-spacing:.5px">${linea.Banco.toUpperCase()}|${linea.NumOp}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:6px;padding:14px;margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;color:#1a5276;margin-bottom:6px">\u24d8 C\u00c1LCULO DE INTER\u00c9S \u2014 VERIFICACI\u00d3N</div>
    <div style="font-size:10px;color:#888;margin-bottom:4px">F\u00f3rmula: Inter\u00e9s = Saldo \u00d7 (Tasa \u00f7 100) \u00d7 (D\u00edas \u00f7 360)</div>
    <div style="font-size:10px;color:#888;margin-bottom:10px">Tasa: ${tasa.toFixed(4)}% &nbsp;Base: 360 d\u00edas &nbsp;Valores: ${fmtMonto(saldoAntes,moneda)} \u00d7 (${tasa.toFixed(4)}% \u00f7 100) \u00d7 (${diasPeriodo} \u00f7 360)</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#e8ecf0;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px">
          <th style="padding:6px 8px;text-align:left">CONCEPTO</th>
          <th style="padding:6px 8px;text-align:right">SISTEMA<br>CALCULADO</th>
          <th style="padding:6px 8px;text-align:right">PROGRAMADO<br>PLAN DE PAGOS</th>
          <th style="padding:6px 8px;text-align:right">REAL BANCO<br>PAGADO</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #e0e0e0">
          <td style="padding:6px 8px;color:#555">Inter\u00e9s calculado (sistema)</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600">${fmtMonto(interesCalculado, moneda)}</td>
          <td style="padding:6px 8px;text-align:right;color:#888">\u2014</td>
          <td style="padding:6px 8px;text-align:right;color:#888">\u2014</td>
        </tr>
        <tr style="border-bottom:1px solid #e0e0e0">
          <td style="padding:6px 8px;color:#555">Inter\u00e9s programado (banco)</td>
          <td style="padding:6px 8px;text-align:right;color:#888">\u2014</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600">${fmtMonto(interesProg, moneda)}</td>
          <td style="padding:6px 8px;text-align:right;color:#888">\u2014</td>
        </tr>
        <tr style="background:#fff8e1">
          <td style="padding:6px 8px;font-weight:700">Inter\u00e9s real cobrado</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:#888">Sistema: ${fmtMonto(interesCalculado, moneda)}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:#888">Prog: ${fmtMonto(interesProg, moneda)}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700">${fmtMonto(intReal, moneda)}</td>
        </tr>
        ${Math.abs(difInt) > 1 ? `
        <tr style="background:#ffeaea">
          <td style="padding:4px 8px;font-size:11px;color:#e74c3c">\u26a0 Diferencia inter\u00e9s (real vs programado)</td>
          <td></td><td></td>
          <td style="padding:4px 8px;text-align:right;font-size:11px">${fmtDif(difInt)}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>
  <div style="background:#f0f9ff;border-left:4px solid #1a5276;padding:14px;margin-bottom:20px;border-radius:0 6px 6px 0">
    <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:.6px;margin-bottom:6px">\u25c6 GLOSA ERP \u2014 COPIAR Y PEGAR EN ASIENTO CONTABLE</div>
    <code style="font-family:monospace;font-size:13px;color:#1a5276;font-weight:600;word-break:break-all">${glosa}</code>
  </div>
  <div style="font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px;text-align:center">
    COFERSA \u00b7 ${linea.Banco} | ${linea.NumOp} \u00b7 ${moneda} \u00b7 ${fmtDateDisplay(fecha)}
    ${tcVal > 0 ? '\u00b7 TC: '+fmtCRC(tcVal) : ''}
  </div>
</div>`;

    let emailSent = false, emailError = null;
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'yugalde@cofersa.cr',
        subject: `Comprobante ${estadoLabel}: ${linea.Banco} ${linea.NumOp} \u2014 ${fmtDateDisplay(fecha)}`,
        html,
      });
      emailSent = true;
    } catch(e) { emailError = e.message; }

    return res.status(200).json({
      ok: true,
      glosa,
      emailSent,
      emailError,
      debug: {
        saldoAntes,
        diasPeriodo,
        interesCalculado: Math.round(interesCalculado * 100) / 100,
        interesProg,
        capitalProg,
        fechaAnterior
      }
    });

  } catch(err) {
    console.error('notificar-pago:', err);
    return res.status(500).json({error: err.message});
  }
}
