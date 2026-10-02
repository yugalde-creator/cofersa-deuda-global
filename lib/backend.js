/**
 * Lógica de negocio — portada directamente de Código.gs.
 * Reemplaza SpreadsheetApp, Session, LockService con equivalentes de Node.js.
 */
const { SHEETS, readRows, appendRow, appendRowRaw, setCellValue, setCellValueRaw, setNumberFormat, setCellsA1, deleteRow, nextId, fmtDate, keyOp, addColumnHeaderIfMissing } = require('./sheets');
const nodemailer = require('nodemailer');
const { aplicarRealesAPlan, aplicarTasaVigente } = require('./intereses');

/* ============================= HELPERS ============================= */

/**
 * Lee Pagos_Programados y normaliza el nombre de la columna de ID de línea.
 * El spreadsheet tiene la columna A como 'ID' en lugar de 'ID_Linea'.
 * Este helper garantiza que siempre esté disponible como p.ID_Linea.
 */
async function readPP() {
  const rows = await readRows(SHEETS.PAGOS_PROG);
  // Normaliza la columna ID de línea sin importar cómo se llame en la hoja.
  rows.forEach(p => {
    if (!p.ID_Linea) {
      p.ID_Linea = p.ID
        || p['Operaciones_Activas!A1']
        || Object.entries(p).find(([k, v]) => k !== '_row' && typeof v === 'string' && /^LC-\d+$/.test(v))?.[1];
    }
  });
  return rows;
}

/* ============================= EMAIL ============================= */

function fmtGlosaDate(fechaStr) {
  // Convierte 'YYYY-MM-DD' a 'dd-mm-yy'
  if (!fechaStr) return '';
  const parts = fechaStr.split('-');
  if (parts.length !== 3) return fechaStr;
  return parts[2] + '-' + parts[1] + '-' + parts[0].slice(2);
}

function fmtGlosaMonto(monto, moneda) {
  // Formato: $470 000,00  o  ¢150 000 000,00
  const simbolo = moneda === 'USD' ? '$' : '¢';
  const num = parseFloat(monto) || 0;
  const parts = num.toFixed(2).split('.');
  const entero = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return simbolo + entero + ',' + parts[1];
}

function fmtVctoDate(fechaStr) {
  // Convierte 'YYYY-MM-DD' a 'dd-mm-yy'
  return fmtGlosaDate(fechaStr);
}

async function enviarEmailPago(pagoInfo) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass) {
    console.warn('[Email] EMAIL_USER / EMAIL_PASS no configurados, email omitido.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  });

  const {
    pagoId, lineaId, banco, numOp, moneda, fecha, capital, interes, monto,
    estado, fechaDesde, fechaVcto
  } = pagoInfo;

  const simbolo = moneda === 'USD' ? '$' : '¢';
  const glosa = `Pago ${banco} Prest.Nro.${numOp} + Ints.D/${fmtGlosaDate(fechaDesde)}/${fmtGlosaDate(fecha)} ${fmtGlosaMonto(monto, moneda)} vcto ${fmtVctoDate(fechaVcto)}`;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;">
  <div style="background:#1a2b4a;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:18px;">✅ Pago Registrado — Cofersa Deuda Global</h2>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;color:#666;width:140px;">Número de Pago</td><td style="padding:8px 0;font-weight:bold;">${pagoId}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px 4px;color:#666;">Línea</td><td style="padding:8px 4px;font-weight:bold;">${lineaId}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Banco</td><td style="padding:8px 0;">${banco}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px 4px;color:#666;">N° Operación</td><td style="padding:8px 4px;">${numOp}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Moneda</td><td style="padding:8px 0;">${moneda}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px 4px;color:#666;">Fecha de Pago</td><td style="padding:8px 4px;">${fecha}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Capital</td><td style="padding:8px 0;">${fmtGlosaMonto(capital, moneda)}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px 4px;color:#666;">Intereses</td><td style="padding:8px 4px;">${fmtGlosaMonto(interes, moneda)}</td></tr>
      <tr><td style="padding:8px 0;color:#666;font-weight:bold;">Monto Total</td><td style="padding:8px 0;font-weight:bold;font-size:16px;">${fmtGlosaMonto(monto, moneda)}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px 4px;color:#666;">Estado</td><td style="padding:8px 4px;">${estado}</td></tr>
    </table>
    <div style="background:#eef4ff;border:1px solid #b0c8f0;border-radius:6px;padding:16px;margin-top:16px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#555;font-weight:bold;">📋 GLOSA PARA ERP</p>
      <p style="margin:0;font-family:monospace;font-size:14px;color:#1a2b4a;font-weight:bold;letter-spacing:0.3px;">${glosa}</p>
    </div>
    <p style="margin-top:20px;font-size:12px;color:#999;">Generado automáticamente por Cofersa Deuda Global · ${new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })}</p>
  </div>
</div>`;

  await transporter.sendMail({
    from: `"Cofersa Deuda Global" <${emailUser}>`,
    to: 'yugalde@cofersa.cr',
    subject: `Pago ${pagoId} registrado — ${banco} ${numOp} · ${fecha}`,
    html,
    text: `Pago registrado\n\nID: ${pagoId}\nLínea: ${lineaId}\nBanco: ${banco}\nN° Op: ${numOp}\nFecha: ${fecha}\nMonto: ${fmtGlosaMonto(monto, moneda)}\nEstado: ${estado}\n\nGLOSA ERP:\n${glosa}`,
  });

  console.log(`[Email] Notificación de pago ${pagoId} enviada a yugalde@cofersa.cr`);
}

/* ============================= HELPERS ============================= */

function parseMonto(s) {
  if (typeof s === 'number') return s;
  let str = (s || '').toString().trim().replace(/[₡$]/g, '');
  // Solo la rama con coma decimal usa \d+ (enteros de 4+ dígitos sin miles,
  // ej. "1223,94"). Las ramas de solo-puntos / solo-comas DEBEN limitar el
  // grupo inicial a \d{1,3}: con \d+ un decimal con punto y 3 decimales como
  // "1223.940" se leía como 1223940 (miles) y disparaba cifras absurdas.
  if (/^\d{1,3}(\.\d{3})+$/.test(str)) return parseFloat(str.replace(/\./g, ''));
  if (/^\d+(\.\d{3})*,\d+$/.test(str)) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+$/.test(str)) return parseFloat(str.replace(/,/g, ''));
  return parseFloat(str) || 0;
}

function normMoneda(m) {
  const s = (m || '').toString().trim().toLowerCase();
  return (s === 'crc' || s === 'colones' || s === 'colón' || s === 'colon') ? 'CRC' : 'USD';
}

function normEstadoPago(e) {
  const s = (e || '').toString().trim().toLowerCase();
  return (s.includes('cancel') || s.includes('concil') || s.includes('pagad')) ? 'Conciliado' : 'Pendiente';
}

function nowCR() {
  return new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

/* ============================= AMORTIZACIÓN ============================= */

function pmtSchedule(monto, tasaAnual, plazo, fechaPrimerPagoStr) {
  const r = (tasaAnual / 100) / 12;
  let saldo = monto;
  const filas = [];
  let fecha = new Date(fechaPrimerPagoStr + 'T00:00:00');
  for (let i = 1; i <= plazo; i++) {
    const interes = saldo * r;
    let cuota = r === 0 ? monto / plazo : monto * r / (1 - Math.pow(1 + r, -plazo));
    let capital = cuota - interes;
    if (i === plazo) { capital = saldo; cuota = capital + interes; }
    const saldoFinal = Math.max(saldo - capital, 0);
    filas.push({ n: i, fecha: fmtDate(fecha), saldoInicial: saldo, cuota, capital, interes, saldoFinal });
    saldo = saldoFinal;
    fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());
  }
  const totalInteres = filas.reduce((s, f) => s + f.interes, 0);
  return {
    cuotaMensual: filas[0].cuota,
    totalInteres,
    totalPagar: monto + totalInteres,
    vencimiento: filas[filas.length - 1].fecha,
    filas,
  };
}

function pmtScheduleLeasing(monto, tasaAnual, plazo, fechaPrimerPagoStr, seguroMensual, ivaPct) {
  const base = pmtSchedule(monto, tasaAnual, plazo, fechaPrimerPagoStr);
  const iva = seguroMensual * (ivaPct / 100);
  base.filas = base.filas.map(f => Object.assign({}, f, { seguro: seguroMensual, iva, totalCuota: f.cuota + seguroMensual + iva }));
  base.seguroMensual = seguroMensual;
  base.iva = iva;
  return base;
}

/* ============================= AUTH ============================= */

async function getUserRecord(email) {
  if (!email) return null;
  const usuarios = await readRows(SHEETS.USUARIOS);
  const match = usuarios.find(u => (u.Email || '').toString().trim().toLowerCase() === email.toLowerCase());
  return match ? { email, nombre: match.Nombre, rol: match.Rol } : null;
}

async function requireAdmin(email) {
  const user = await getUserRecord(email);
  if (!user) throw new Error('No autorizado: tu cuenta no está en la hoja Usuarios.');
  if (user.rol !== 'Admin') {
    await logAudit(user.email, 'Intento de acción restringida', 'Sistema', 'Bloqueado');
    throw new Error('Acción bloqueada: tu rol "Consulta" es de solo lectura.');
  }
  return user;
}

/* ============================= AUDITORÍA ============================= */

async function logAudit(email, accion, modulo, resultado) {
  const now = nowCR();
  await appendRow(SHEETS.AUDITORIA, [now, email, accion, modulo, resultado]);
}

/* ============================= BOOTSTRAP ============================= */

async function getBootstrapData(email) {
  const user = await getUserRecord(email);
  if (!user) {
    return { authorized: false, email: email || '' };
  }

  const [activas, pagosProg, canceladas, pagosHist, leasing, leasingPagosRows, usuarios, auditoria, bancos, config, histDeudaRows] = await Promise.all([
    readRows(SHEETS.ACTIVAS),
    readPP(),
    readRows(SHEETS.CANCELADAS),
    readRows(SHEETS.PAGOS_HIST),
    readRows(SHEETS.LEASING),
    readRows(SHEETS.LEASING_PAGOS),
    readRows(SHEETS.USUARIOS),
    readRows(SHEETS.AUDITORIA),
    readRows(SHEETS.BANCOS),
    readRows(SHEETS.CONFIG),
    readRows(SHEETS.HIST_DEUDA).catch(()=>[]),
  ]);

  const lines = activas.map(a => ({
    id: a.ID, numOp: a.NumOp, banco: a.Banco, tipo: a.Tipo, moneda: a.Moneda,
    aprobado: parseMonto(a.Aprobado), tasa: parseMonto(a.Tasa), plazo: parseMonto(a.Plazo),
    inicio: fmtDate(a.FechaInicio), vencimiento: fmtDate(a.FechaVencimiento), garantia: a.Garantia || '—',
  }));

  const paymentPlans = {};
  pagosProg.forEach(p => {
    const lid = p.ID_Linea;
    if (!paymentPlans[lid]) paymentPlans[lid] = [];
    paymentPlans[lid].push({ _row: p._row, fecha: fmtDate(p.Fecha), capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), estado: p.Estado });
  });
  // El saldo debe seguir al banco: en cuotas pagadas con conciliación se usa el capital/interés REAL pagado.
  Object.keys(paymentPlans).forEach(lid => {
    const hs = pagosHist.filter(h => h.ID_Linea === lid);
    if (hs.length) aplicarRealesAPlan(paymentPlans[lid], hs, parseMonto, fmtDate);
  });
  // Tasa variable: cuotas pendientes recalculadas con la tasa vigente del Sheet cuando difiere del plan del banco.
  activas.forEach(a => {
    const items = paymentPlans[a.ID]; if (!items || !items.length) return;
    const ini = fmtDate(a.FechaInicio); const t = parseMonto(a.Tasa);
    aplicarTasaVigente(items, { aprobado: parseMonto(a.Aprobado), inicio: ini ? new Date(ini + 'T00:00:00') : null, tasa: t > 1 ? t / 100 : t });
  });

  const lineasCanceladas = canceladas.map(c => ({
    id: c.ID, numOp: c.NumOp, banco: c.Banco, moneda: c.Moneda, monto: parseMonto(c.Monto),
    tasa: parseMonto(c.Tasa), plazo: parseMonto(c.Plazo), inicio: fmtDate(c.FechaInicio), vencimiento: fmtDate(c.FechaVencimiento),
    idOriginal: c.IDOriginal || '',
  }));

  const history = pagosHist.map(h => ({
    id: h.ID, linea: h.ID_Linea, banco: h.Banco, fecha: fmtDate(h.Fecha), monto: parseMonto(h.Monto), estado: h.Estado,
    capitalReal: parseMonto(h.CapitalReal), interesReal: parseMonto(h.InteresReal),
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const leasingContratos = leasing.map(l => ({
    id: l.ID, numOp: l.NumOp, banco: l.Banco, moneda: l.Moneda, monto: parseMonto(l.Monto),
    tasa: parseMonto(l.Tasa), plazo: parseMonto(l.Plazo), inicio: fmtDate(l.FechaInicio), vencimiento: fmtDate(l.FechaVencimiento), estado: l.Estado,
  }));

  const leasingPagos = {};
  leasingPagosRows.forEach(p => {
    const lid = p.ID_Contrato;
    if (!leasingPagos[lid]) leasingPagos[lid] = [];
    leasingPagos[lid].push({ _row: p._row, fecha: fmtDate(p.Fecha), capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), seguro: parseMonto(p.Seguro), iva: parseMonto(p.IVA), estado: p.Estado });
  });

  const bankLimits = {};
  bancos.forEach(b => { bankLimits[b.Banco] = parseMonto(b.LimiteUSD); });

  const cfg = {};
  config.forEach(c => { cfg[c.Clave] = c.Valor; });

  await logAudit(user.email, 'Consulta de panel de control', 'Dashboard', 'Éxito');

  return {
    authorized: true,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    lines, paymentPlans, lineasCanceladas, history,
    leasingContratos, leasingPagos,
    usuarios: usuarios.map(u => ({ email: u.Email, nombre: u.Nombre, rol: u.Rol, notificar: (u.Notificar || 'Si').toString().trim().toLowerCase() !== 'no' })),
    auditLog: auditoria.map(a => ({ fecha: fmtDate(a.Fecha), usuario: a.Usuario, accion: a.Accion, modulo: a.Modulo, resultado: a.Resultado })).reverse(),
    bankLimits,
    historicoDeuda: Object.fromEntries((histDeudaRows||[]).map(r=>([r.Periodo, parseMonto(r.MontoUSD)]))),
    historicoTC: Object.fromEntries((histDeudaRows||[]).filter(r=>parseMonto(r.TipoCambio)>0).map(r=>([r.Periodo, parseMonto(r.TipoCambio)]))),
    fx: { CRC: parseMonto(cfg.TipoCambioUSD) || 455, USD: 1 },
    empresa: cfg.NombreEmpresa || 'Empresa',
    sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID || '1WXw5-pbPqVtxG4BeaCe9C2wfx_ChrnRV9dbf9x9kpcQ'}/edit`,
  };
}

/* ============================= OPERACIONES ============================= */

async function crearLinea(email, payload) {
  const user = await requireAdmin(email);
  const { banco, numOp, desembolso, monto, moneda, tasa, plazo, primerPago, filasTabla } = payload;
  if (!banco || !numOp) throw new Error('Banco y N° de Operación son requeridos.');
  if (!(monto > 0)) throw new Error('Monto inválido.');
  if (!(filasTabla && filasTabla.length > 0) && !(plazo > 0 && plazo <= 360)) {
    throw new Error('El plazo debe estar entre 1 y 360 meses, o adjunta la tabla del banco.');
  }

  const k = keyOp(banco, numOp);
  const [activasRows, canceladasRows] = await Promise.all([readRows(SHEETS.ACTIVAS), readRows(SHEETS.CANCELADAS)]);
  const existentes = activasRows.concat(canceladasRows);
  if (existentes.some(r => keyOp(r.Banco, r.NumOp) === k)) {
    throw new Error('Ya existe una operación con ese banco y número.');
  }

  let filas, vencimiento, plazoFinal;
  if (filasTabla && filasTabla.length > 0) {
    // Use exact bank-provided table
    filas = filasTabla.map(f => ({ fecha: f.fecha, capital: Number(f.capital) || 0, interes: Number(f.interes) || 0 }));
    vencimiento = filas[filas.length - 1].fecha;
    plazoFinal = filas.length;
  } else {
    const schedule = pmtSchedule(monto, tasa, plazo, primerPago);
    filas = schedule.filas;
    vencimiento = schedule.vencimiento;
    plazoFinal = plazo;
  }

  const newId = await nextId('LC', SHEETS.ACTIVAS, 3);
  await appendRow(SHEETS.ACTIVAS, [newId, banco, numOp, 'Préstamo a Plazo', moneda, monto, tasa || 0, plazoFinal, desembolso, vencimiento, '—']);
  for (const f of filas) {
    await appendRow(SHEETS.PAGOS_PROG, [newId, f.fecha, f.capital, f.interes, 'Pendiente']);
  }

  await logAudit(user.email, `Nueva línea con plan de pagos ${newId} (${plazoFinal} cuotas)`, 'Operaciones', 'Éxito');
  return { id: newId, numOp };
}

async function registrarPago(email, payload) {
  const user = await requireAdmin(email);
  const { lineaId, fecha, monto, cuotaRow, capitalReal, interesReal } = payload;
  if (!(monto > 0)) throw new Error('Monto inválido.');

  const [historicos, activas, pagosProg] = await Promise.all([
    readRows(SHEETS.PAGOS_HIST),
    readRows(SHEETS.ACTIVAS),
    readPP(),
  ]);

  const dup = historicos.some(h => h.ID_Linea === lineaId && fmtDate(h.Fecha) === fecha && Math.abs(Number(h.Monto) - monto) < 0.01);
  if (dup) {
    await logAudit(user.email, `Intento de pago duplicado ${lineaId}`, 'Conciliación', 'Bloqueado');
    throw new Error('Pago duplicado detectado para esta línea y fecha.');
  }

  const linea = activas.find(l => l.ID === lineaId);
  const banco = linea ? linea.Banco : '';
  const numOp = linea ? linea.NumOp : lineaId;
  const moneda = linea ? (linea.Moneda || 'CRC').toUpperCase() : 'CRC';
  const fechaVcto = linea ? (linea.FechaVencimiento || '') : '';

  // Obtener capital e interés de la cuota si está conciliando
  let capitalCuota = 0, interesCuota = 0;
  let cuotaData = null;
  if (cuotaRow) {
    cuotaData = pagosProg.find(p => p._row === cuotaRow && p.ID_Linea === lineaId);
    if (cuotaData) {
      capitalCuota = parseMonto(cuotaData.Capital) || 0;
      interesCuota = parseMonto(cuotaData.Interes) || 0;
    }
  }

  // Calcular fecha "desde" para la glosa de intereses
  // = último pago Pagado/Conciliado de esta línea + 1 día, o FechaInicio si es el primero
  let fechaDesde = linea ? (linea.FechaInicio || '') : '';
  const pagosAnterioresPagados = pagosProg.filter(p =>
    p.ID_Linea === lineaId &&
    (p.Estado === 'Pagado' || p.Estado === 'Conciliado') &&
    p.Fecha && p.Fecha < fecha
  );
  if (pagosAnterioresPagados.length > 0) {
    pagosAnterioresPagados.sort((a, b) => a.Fecha.localeCompare(b.Fecha));
    const ultFecha = pagosAnterioresPagados[pagosAnterioresPagados.length - 1].Fecha;
    // desde = día siguiente al último pago
    const d = new Date(ultFecha + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    fechaDesde = d.toISOString().slice(0, 10);
  } else if (cuotaData && cuotaData.Fecha) {
    // Si es el primer pago, "desde" = fecha de inicio de la línea
    fechaDesde = linea ? (linea.FechaInicio || cuotaData.Fecha) : cuotaData.Fecha;
  }

  let estado = 'Pendiente';
  if (cuotaRow) {
    await setCellValue(SHEETS.PAGOS_PROG, cuotaRow, 'Estado', 'Pagado');
    estado = 'Conciliado';
  }
  const newId = await nextId('PG', SHEETS.PAGOS_HIST, 4);

  // Asegurar que las columnas de desglose existen en la hoja
  await Promise.all([
    addColumnHeaderIfMissing(SHEETS.PAGOS_HIST, 'CapitalReal'),
    addColumnHeaderIfMissing(SHEETS.PAGOS_HIST, 'InteresReal'),
  ]);

  // Si no se enviaron valores reales, usar los de la cuota planificada como referencia
  const capReal = capitalReal != null ? Number(capitalReal) : capitalCuota;
  const intReal = interesReal != null ? Number(interesReal) : interesCuota;

  await appendRow(SHEETS.PAGOS_HIST, [newId, lineaId, banco, fecha, monto, estado, capReal, intReal]);

  await logAudit(user.email, `Registro de pago ${newId} sobre ${lineaId}${estado === 'Conciliado' ? ' (cuota conciliada)' : ''}`, 'Conciliación', 'Éxito');

  // El comprobante detallado lo envía /api/notificar-pago desde el cliente
  return { id: newId };
}

async function cargaMasivaCuotas(email, lineaId, rowsRaw) {
  const user = await requireAdmin(email);
  const existentes = (await readPP()).filter(p => p.ID_Linea === lineaId);
  let added = 0, dup = 0;
  for (const r of rowsRaw) {
    if (r.length < 3) continue;
    const [fecha, capital, interes] = r;
    if (existentes.some(p => fmtDate(p.Fecha) === fecha)) { dup++; continue; }
    await appendRow(SHEETS.PAGOS_PROG, [lineaId, fecha, Number(capital) || 0, Number(interes) || 0, 'Pendiente']);
    added++;
  }
  await logAudit(user.email, `Carga masiva de ${added} cuota(s) en ${lineaId}`, 'Conciliación', 'Éxito');
  return { added, dup };
}

async function reemplazarPlanPagos(email, lineaId, rowsRaw) {
  const user = await requireAdmin(email);
  const existentes = (await readPP()).filter(p => p.ID_Linea === lineaId);

  // Delete all Pendiente rows (keep Pagado / Conciliado)
  const toDelete = existentes.filter(p => p.Estado === 'Pendiente' || !p.Estado);
  // Sort descending by row index so deletes don't shift indices
  toDelete.sort((a, b) => b._row - a._row);
  for (const p of toDelete) {
    await deleteRow(SHEETS.PAGOS_PROG, p._row);
  }

  // Insert new rows from bank table
  let added = 0;
  for (const r of rowsRaw) {
    if (r.length < 3) continue;
    const [fecha, capital, interes] = r;
    await appendRow(SHEETS.PAGOS_PROG, [lineaId, fecha.trim(), Number(capital) || 0, Number(interes) || 0, 'Pendiente']);
    added++;
  }

  await logAudit(user.email, `Plan de pagos reemplazado en ${lineaId}: ${toDelete.length} eliminadas, ${added} nuevas`, 'Operaciones', 'Éxito');
  return { deleted: toDelete.length, added };
}

async function archivarLinea(email, lineaId) {
  const user = await requireAdmin(email);
  const activas = await readRows(SHEETS.ACTIVAS);
  const linea = activas.find(l => l.ID === lineaId);
  if (!linea) throw new Error('Línea no encontrada.');

  const newId = await nextId('LX', SHEETS.CANCELADAS, 3);
  // IDOriginal: permite ubicar el N° de operación de pagos históricos registrados con el ID activo.
  await addColumnHeaderIfMissing(SHEETS.CANCELADAS, 'IDOriginal');
  await appendRow(SHEETS.CANCELADAS, [newId, linea.Banco, linea.NumOp, linea.Moneda, linea.Aprobado, linea.Tasa, linea.Plazo, fmtDate(linea.FechaInicio), fmtDate(linea.FechaVencimiento), linea.ID]);
  await deleteRow(SHEETS.ACTIVAS, linea._row);

  await logAudit(user.email, `Archivado de línea ${lineaId} como cancelada`, 'Operaciones', 'Éxito');
  return { id: newId };
}

/* ============================= IMPORTAR HISTORICAL ============================ */

async function importarActivas(email, rowsRaw) {
  const user = await requireAdmin(email);
  const existentes = await readRows(SHEETS.ACTIVAS);
  let added = 0, dupCount = 0, invalid = 0;
  for (const r of rowsRaw) {
    if (r.length < 8) { invalid++; continue; }
    const [banco, numOp, fechaDesembolso, monto, monedaRaw, tasa, plazo, vencimiento] = r;
    const moneda = normMoneda(monedaRaw);
    const montoNum = parseMonto(monto);
    if (!banco || !numOp || montoNum <= 0) { invalid++; continue; }
    const k = keyOp(banco, numOp);
    if (existentes.some(l => keyOp(l.Banco, l.NumOp) === k)) { dupCount++; continue; }
    const newId = await nextId('LC', SHEETS.ACTIVAS, 3);
    await appendRow(SHEETS.ACTIVAS, [newId, banco, numOp, 'Préstamo a Plazo', moneda, montoNum, parseFloat(tasa) || 0, parseInt(plazo, 10) || 12, fechaDesembolso, vencimiento, '—']);
    existentes.push({ Banco: banco, NumOp: numOp });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} línea(s) activa(s)`, 'Importar histórico', added > 0 ? 'Éxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

async function importarCanceladas(email, rowsRaw) {
  const user = await requireAdmin(email);
  const [canceladasRows, activasRows] = await Promise.all([readRows(SHEETS.CANCELADAS), readRows(SHEETS.ACTIVAS)]);
  const existentes = canceladasRows.concat(activasRows);
  let added = 0, dupCount = 0, invalid = 0;
  for (const r of rowsRaw) {
    if (r.length < 7) { invalid++; continue; }
    const [banco, numOp, fechaDesembolso, monto, monedaRaw, tasa, plazo, vencimiento] = r;
    const moneda = normMoneda(monedaRaw);
    const montoNum = parseMonto(monto);
    if (!banco || !numOp || montoNum <= 0) { invalid++; continue; }
    const k = keyOp(banco, numOp);
    if (existentes.some(l => keyOp(l.Banco, l.NumOp) === k)) { dupCount++; continue; }
    const newId = await nextId('LX', SHEETS.CANCELADAS, 3);
    await appendRow(SHEETS.CANCELADAS, [newId, banco, numOp, moneda, montoNum, parseFloat(tasa) || 0, parseInt(plazo, 10) || 12, fechaDesembolso, vencimiento || fechaDesembolso]);
    existentes.push({ Banco: banco, NumOp: numOp });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} línea(s) cancelada(s)`, 'Importar histórico', added > 0 ? 'Éxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

async function importarPagos(email, rowsRaw) {
  const user = await requireAdmin(email);
  const [activas, canceladas, historicos, pagosProg] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readRows(SHEETS.CANCELADAS), readRows(SHEETS.PAGOS_HIST), readPP(),
  ]);
  let added = 0, dupCount = 0, invalid = 0;

  for (const r of rowsRaw) {
    if (r.length < 5) { invalid++; continue; }
    const [banco, numOp, fecha, capitalRaw, interesRaw, estadoRaw] = r;
    const capital = parseMonto(capitalRaw);
    const interes = parseMonto(interesRaw);
    if (!banco || !numOp || !fecha) { invalid++; continue; }
    const lineaActiva = activas.find(l => keyOp(l.Banco, l.NumOp) === keyOp(banco, numOp));
    const lineaCancelada = canceladas.find(l => keyOp(l.Banco, l.NumOp) === keyOp(banco, numOp));
    const lineaId = lineaActiva ? lineaActiva.ID : (lineaCancelada ? lineaCancelada.ID : numOp);
    const montoTotal = capital + interes;
    const esDup = historicos.some(h => h.ID_Linea === lineaId && fmtDate(h.Fecha) === fecha && Math.abs(Number(h.Monto) - montoTotal) < 1);
    if (esDup) { dupCount++; continue; }
    const estadoFinal = normEstadoPago(estadoRaw);
    if (estadoFinal === 'Conciliado' && lineaActiva) {
      const cuota = pagosProg.find(p => p.ID_Linea === lineaActiva.ID && fmtDate(p.Fecha) === fecha && p.Estado === 'Pendiente');
      if (cuota) {
        await setCellValue(SHEETS.PAGOS_PROG, cuota._row, 'Estado', 'Pagado');
        cuota.Estado = 'Pagado';
      }
    }
    const newId = await nextId('PG', SHEETS.PAGOS_HIST, 4);
    // Guarda también capital e interés reales (lo usan el saldo y el reporte de Apartado de Intereses).
    await Promise.all([
      addColumnHeaderIfMissing(SHEETS.PAGOS_HIST, 'CapitalReal'),
      addColumnHeaderIfMissing(SHEETS.PAGOS_HIST, 'InteresReal'),
    ]);
    await appendRow(SHEETS.PAGOS_HIST, [newId, lineaId, banco, fecha, montoTotal, estadoFinal, capital, interes]);
    historicos.push({ ID_Linea: lineaId, Fecha: fecha, Monto: montoTotal });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} pago(s)`, 'Importar histórico', added > 0 ? 'Éxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

/* ============================= LEASING ============================= */

async function crearLeasing(email, payload) {
  const user = await requireAdmin(email);
  const { banco, numOp, desembolso, monto, moneda, tasa, plazo, primerPago, seguro, ivaPct } = payload;
  if (!banco || !numOp) throw new Error('Banco y N° de Operación son requeridos.');
  if (!(monto > 0)) throw new Error('Monto inválido.');
  if (!(plazo > 0 && plazo <= 60)) throw new Error('El plazo debe estar entre 1 y 60 meses.');

  const k = keyOp(banco, numOp);
  const leasingRows = await readRows(SHEETS.LEASING);
  if (leasingRows.some(l => keyOp(l.Banco, l.NumOp) === k)) {
    throw new Error('Ya existe un contrato con ese banco y número.');
  }

  const schedule = pmtScheduleLeasing(monto, tasa, plazo, primerPago, seguro || 0, ivaPct || 0);
  const newId = await nextId('LS', SHEETS.LEASING, 3);
  await appendRow(SHEETS.LEASING, [newId, banco, numOp, moneda, monto, tasa, plazo, desembolso, schedule.vencimiento, 'Activo']);
  for (const f of schedule.filas) {
    await appendRow(SHEETS.LEASING_PAGOS, [newId, f.fecha, f.capital, f.interes, f.seguro, f.iva, 'Pendiente']);
  }

  await logAudit(user.email, `Nuevo contrato de leasing ${newId} (${plazo} cuotas)`, 'Leasing Financiero', 'Éxito');
  return { id: newId };
}

async function importarLeasing(email, contratosRaw, cuotasRaw) {
  const user = await requireAdmin(email);
  const contratosExistentes = await readRows(SHEETS.LEASING);
  let addedC = 0, dupC = 0, invalidC = 0;

  for (const r of (contratosRaw || [])) {
    if (r.length < 8) { invalidC++; continue; }
    const [banco, numOp, fechaDesembolso, monto, monedaRaw, tasa, plazo, vencimiento] = r;
    const moneda = normMoneda(monedaRaw);
    const montoNum = parseMonto(monto);
    if (!banco || !numOp || montoNum <= 0) { invalidC++; continue; }
    const k = keyOp(banco, numOp);
    if (contratosExistentes.some(l => keyOp(l.Banco, l.NumOp) === k)) { dupC++; continue; }
    const newId = await nextId('LS', SHEETS.LEASING, 3);
    await appendRow(SHEETS.LEASING, [newId, banco, numOp, moneda, montoNum, parseFloat(tasa) || 0, parseInt(plazo, 10) || 12, fechaDesembolso, vencimiento || fechaDesembolso, 'Activo']);
    contratosExistentes.push({ Banco: banco, NumOp: numOp, ID: newId });
    addedC++;
  }

  const contratosActuales = await readRows(SHEETS.LEASING);
  const pagosExistentes = await readRows(SHEETS.LEASING_PAGOS);
  let addedP = 0, dupP = 0, invalidP = 0;

  for (const r of (cuotasRaw || [])) {
    if (r.length < 5) { invalidP++; continue; }
    const [banco, numOp, fecha, capitalRaw, interesRaw, seguroRaw, ivaRaw, estadoRaw] = r;
    const capital = parseMonto(capitalRaw);
    const interes = parseMonto(interesRaw);
    const seguro = parseMonto(seguroRaw || 0);
    const iva = parseMonto(ivaRaw || 0);
    if (!banco || !numOp || !fecha) { invalidP++; continue; }
    const contrato = contratosActuales.find(l => keyOp(l.Banco, l.NumOp) === keyOp(banco, numOp));
    const lid = contrato ? contrato.ID : numOp;
    const dup = pagosExistentes.some(p => p.ID_Contrato === lid && fmtDate(p.Fecha) === fecha && Math.abs(Number(p.Capital) - capital) < 1);
    if (dup) { dupP++; continue; }
    await appendRow(SHEETS.LEASING_PAGOS, [lid, fecha, capital, interes, seguro, iva, normEstadoPago(estadoRaw)]);
    pagosExistentes.push({ ID_Contrato: lid, Fecha: fecha, Capital: capital });
    addedP++;
  }

  await logAudit(user.email, `Importación de leasing: ${addedC} contrato(s), ${addedP} cuota(s)`, 'Leasing Financiero', 'Éxito');
  return { addedC, dupC, invalidC, addedP, dupP, invalidP };
}

async function registrarPagoLeasing(email, payload) {
  const user = await requireAdmin(email);
  const { contratoId, cuotaRow } = payload;
  if (!cuotaRow) throw new Error('Selecciona una cuota pendiente.');
  await setCellValue(SHEETS.LEASING_PAGOS, cuotaRow, 'Estado', 'Pagado');
  await logAudit(user.email, `Conciliación de cuota de leasing sobre ${contratoId}`, 'Leasing Financiero', 'Éxito');
  return { ok: true };
}

/* ============================= USUARIOS ============================= */

async function crearUsuario(email, payload) {
  const user = await requireAdmin(email);
  const { nombre, email: newEmail, rol, notificar } = payload;
  if (!nombre || !newEmail) throw new Error('Completa nombre y correo.');
  const existentes = await readRows(SHEETS.USUARIOS);
  if (existentes.some(u => (u.Email || '').toLowerCase() === newEmail.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese correo.');
  }
  await addColumnHeaderIfMissing(SHEETS.USUARIOS, 'Notificar');
  await appendRow(SHEETS.USUARIOS, [newEmail, nombre, rol || 'Consulta', notificar === false ? 'No' : 'Si']);
  await logAudit(user.email, `Creación de usuario ${newEmail} (${rol})`, 'Usuarios', 'Éxito');
  return { ok: true };
}

/* ============================= EDICIÓN ============================= */

async function editarLinea(email, lineaId, payload) {
  const user = await requireAdmin(email);
  const activas = await readRows(SHEETS.ACTIVAS);
  const linea = activas.find(l => l.ID === lineaId);
  if (!linea) throw new Error('Línea no encontrada.');

  const editables = ['Banco', 'NumOp', 'Tipo', 'Moneda', 'Aprobado', 'Tasa', 'Plazo', 'FechaInicio', 'FechaVencimiento', 'Garantia'];
  const changed = [];
  for (const campo of editables) {
    if (payload[campo] !== undefined && String(payload[campo]) !== String(linea[campo])) {
      const _storeVal = campo === 'NumOp' ? "'" + payload[campo] : payload[campo];
      await setCellValue(SHEETS.ACTIVAS, linea._row, campo, _storeVal);
      changed.push(campo);
    }
  }

  await logAudit(user.email, `Edición de línea ${lineaId}: ${changed.join(', ') || 'sin cambios'}`, 'Operaciones', 'Éxito');
  return { changed };
}

async function eliminarPago(email, pagoId) {
  const user = await requireAdmin(email);
  const pagos = await readRows(SHEETS.PAGOS_HIST);
  const pago = pagos.find(p => p.ID === pagoId);
  if (!pago) throw new Error('Pago no encontrado.');

  await deleteRow(SHEETS.PAGOS_HIST, pago._row);
  await logAudit(user.email, `Eliminación de pago ${pagoId}`, 'Conciliación', 'Éxito');
  return { ok: true };
}

async function editarUsuario(email, targetEmail, payload) {
  const user = await requireAdmin(email);
  const usuarios = await readRows(SHEETS.USUARIOS);
  const target = usuarios.find(u => (u.Email || '').toLowerCase() === targetEmail.toLowerCase());
  if (!target) throw new Error('Usuario no encontrado.');

  if (payload.Nombre !== undefined) await setCellValue(SHEETS.USUARIOS, target._row, 'Nombre', payload.Nombre);
  if (payload.Rol !== undefined) await setCellValue(SHEETS.USUARIOS, target._row, 'Rol', payload.Rol);
  if (payload.Notificar !== undefined) {
    await addColumnHeaderIfMissing(SHEETS.USUARIOS, 'Notificar');
    await setCellValue(SHEETS.USUARIOS, target._row, 'Notificar', payload.Notificar);
  }

  await logAudit(user.email, `Edición de usuario ${targetEmail}`, 'Usuarios', 'Éxito');
  return { ok: true };
}

/* ======================= HISTÓRICO DE DEUDA (BECONSULT) ======================= */

// rows: [{ periodo: 'YYYY-MM', montoUSD, tc }] — totales mensuales del reporte de balance.
async function importarHistoricoDeuda(email, rows) {
  const user = await requireAdmin(email);
  const validas = (rows || []).filter(r => /^\d{4}-\d{2}$/.test(r.periodo) && parseMonto(r.montoUSD) > 0);
  if (!validas.length) throw new Error('El archivo no trae meses válidos.');
  // Coma decimal: la hoja usa formato europeo; parseMonto() lo lee igual si queda como texto.
  const num = n => parseMonto(n).toFixed(2).replace('.', ',');
  await addColumnHeaderIfMissing(SHEETS.HIST_DEUDA, 'TipoCambio');
  const existentes = await readRows(SHEETS.HIST_DEUDA);
  let actualizados = 0, agregados = 0;
  for (const r of validas) {
    const ex = existentes.find(e => String(e.Periodo).trim() === r.periodo);
    if (ex) {
      await setCellValue(SHEETS.HIST_DEUDA, ex._row, 'MontoUSD', num(r.montoUSD));
      if (r.tc) await setCellValue(SHEETS.HIST_DEUDA, ex._row, 'TipoCambio', num(r.tc));
      actualizados++;
    } else {
      await appendRow(SHEETS.HIST_DEUDA, ["'" + r.periodo, num(r.montoUSD), r.tc ? num(r.tc) : '']);
      agregados++;
    }
  }
  await logAudit(user.email, `Carga balance Beconsult: ${validas[0].periodo} a ${validas[validas.length - 1].periodo} (${actualizados} actualizados, ${agregados} nuevos)`, 'Histórico Deuda', 'Éxito');
  return { actualizados, agregados };
}

/**
 * Reparación puntual: una operación creada con un ID ya usado por otra (bug de nextId) recibe un ID
 * nuevo, junto con sus cuotas. Se indican exactamente las filas y se valida cada una antes de escribir;
 * si algo no coincide no se escribe nada.
 * payload: { idActual, numOp, filaActivas, filasPP: [n, ...] }
 */
async function repararIdLinea(email, payload) {
  const user = await requireAdmin(email);
  const { idActual, numOp, filaActivas, filasPP } = payload || {};
  const dig = s => String(s || '').replace(/\D/g, '');
  const [activas, pp] = await Promise.all([readRows(SHEETS.ACTIVAS), readPP()]);
  if (activas.filter(a => a.ID === idActual).length < 2) throw new Error(`${idActual} no está duplicado; no hay nada que reparar.`);
  const linea = activas.find(a => a._row === filaActivas);
  if (!linea || linea.ID !== idActual || dig(linea.NumOp) !== dig(numOp)) throw new Error(`La fila ${filaActivas} de Operaciones_Activas no es ${numOp} con ${idActual}. No se cambió nada.`);
  if (!Array.isArray(filasPP) || !filasPP.length) throw new Error('Faltan las filas de cuotas.');
  for (const f of filasPP) {
    const c = pp.find(p => p._row === f);
    if (!c || c.ID_Linea !== idActual) throw new Error(`La fila ${f} de Pagos_Programados no tiene ${idActual}. No se cambió nada.`);
  }
  const nuevoId = await nextId('LC', SHEETS.ACTIVAS, 3);
  await setCellsA1([{ range: `${SHEETS.ACTIVAS}!A${filaActivas}`, value: nuevoId },
    ...filasPP.map(f => ({ range: `${SHEETS.PAGOS_PROG}!A${f}`, value: nuevoId }))]);
  await logAudit(user.email, `Reparación de ID duplicado: operación ${numOp} de ${idActual} a ${nuevoId} (${filasPP.length} cuotas)`, 'Operaciones', 'Éxito');
  return { nuevoId, cuotas: filasPP.length };
}

/* ============ CORRECCIONES DEL CIERRE DE SETIEMBRE 2026 (botón de un clic, solo Admin, idempotente) ============ */

// Tasas vigentes según los bancos (BCT: captura al cierre; BCR: estado de cuenta set-2026; Davivienda ₡84 M: plan del banco).
const CORR_TASAS = { '10025923': 7.75, '10026299': 7.75, '10026801': 8, '10026946': 8, '10027186': 8, '6141293': 5.63, '6171315': 5.73, '10410129972707607': 8.4 };
// Vencimientos finales según el banco (planes PDF / estado de cuenta / capturas).
const CORR_VENCIMIENTOS = {
  '10024938': '2026-10-01', '10025234': '2026-11-09', '10025858': '2027-02-12', '10025976': '2027-03-01', '10026299': '2027-04-19',
  '10026946': '2027-07-23', '10026983': '2026-11-02', '10027339': '2027-09-20', '6141293': '2026-12-10', '10410129972706105': '2026-11-24',
};
// Pagos finales de operaciones vencidas en setiembre que no estaban registrados (plan PDF del banco).
const CORR_PAGOS_FINALES = [
  { lineaId: 'LX-048', banco: 'BCT', numOp: '10024733', fecha: '2026-09-01', capital: 13012701.12, interes: 89100.86 },
  { lineaId: 'LX-049', banco: 'BCT', numOp: '10024849', fecha: '2026-09-16', capital: 13432621.86, interes: 95259.68 },
];
const opKey = v => (v || '').toString().replace(/^'/, '').trim();

async function evaluarCorreccionesCierre() {
  const [activas, historicos, leasing, leasingPagos] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readRows(SHEETS.PAGOS_HIST), readRows(SHEETS.LEASING), readRows(SHEETS.LEASING_PAGOS),
  ]);
  const tareas = [];
  // 1) Tasas
  activas.forEach(a => {
    const nuevo = CORR_TASAS[opKey(a.NumOp)]; if (nuevo === undefined) return;
    const actual = parseMonto(a.Tasa);
    const raw = (a.Tasa || '').toString().trim();
    const esFecha = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(raw);
    tareas.push({
      key: 'tasa-' + opKey(a.NumOp), desc: `Tasa ${a.Banco} ${opKey(a.NumOp)}: ${esFecha ? 'celda con formato de fecha' : (a.Tasa || '—')} → ${nuevo}%`,
      pendiente: esFecha || Math.abs(actual - nuevo) > 0.0049,
      run: async () => { await setNumberFormat(SHEETS.ACTIVAS, a._row, 'Tasa', '0.00'); await setCellValueRaw(SHEETS.ACTIVAS, a._row, 'Tasa', nuevo); },
    });
  });
  // 2) Vencimientos
  activas.forEach(a => {
    const nuevo = CORR_VENCIMIENTOS[opKey(a.NumOp)]; if (!nuevo) return;
    tareas.push({
      key: 'vcto-' + opKey(a.NumOp), desc: `Vencimiento ${a.Banco} ${opKey(a.NumOp)}: ${fmtDate(a.FechaVencimiento)} → ${nuevo} (según el banco)`,
      pendiente: fmtDate(a.FechaVencimiento) !== nuevo,
      run: async () => { await setCellValueRaw(SHEETS.ACTIVAS, a._row, 'FechaVencimiento', nuevo); },
    });
  });
  // 3) BCT 10024938: el pago final lo aplicó el banco el 1/10
  const pg = historicos.find(h => h.ID === 'PG-0768');
  if (pg) tareas.push({
    key: 'pg-0768', desc: 'BCT 10024938: fecha del pago final 2026-09-30 → 2026-10-01 (lo aplicó el banco el 1/10)', pendiente: fmtDate(pg.Fecha) !== '2026-10-01',
    run: async () => { await setCellValueRaw(SHEETS.PAGOS_HIST, pg._row, 'Fecha', '2026-10-01'); },
  });
  // 4) Pagos finales faltantes
  CORR_PAGOS_FINALES.forEach(p => {
    const existe = historicos.some(h => h.ID_Linea === p.lineaId && fmtDate(h.Fecha) === p.fecha);
    tareas.push({
      key: 'pago-' + p.numOp, desc: `Registrar pago final de ${p.banco} ${p.numOp} (${p.fecha}): capital ${p.capital.toLocaleString('en-US')} + interés ${p.interes.toLocaleString('en-US')}`, pendiente: !existe,
      run: async () => {
        await Promise.all([addColumnHeaderIfMissing(SHEETS.PAGOS_HIST, 'CapitalReal'), addColumnHeaderIfMissing(SHEETS.PAGOS_HIST, 'InteresReal')]);
        const id = await nextId('PG', SHEETS.PAGOS_HIST, 4);
        await appendRowRaw(SHEETS.PAGOS_HIST, [id, p.lineaId, p.banco, p.fecha, Math.round((p.capital + p.interes) * 100) / 100, 'Conciliado', p.capital, p.interes]);
      },
    });
  });
  // 5) Leasing BCT 10000002611: cuota del 4/9 pagada
  const lc = leasing.find(l => opKey(l.NumOp) === '10000002611');
  if (lc) {
    const cuota = leasingPagos.find(p => p.ID_Contrato === lc.ID && fmtDate(p.Fecha) === '2026-09-04');
    if (cuota) tareas.push({
      key: 'leasing-10000002611', desc: 'Leasing BCT 10000002611: cuota del 2026-09-04 → Pagado', pendiente: (cuota.Estado || '').toString().trim() !== 'Pagado',
      run: async () => { await setCellValueRaw(SHEETS.LEASING_PAGOS, cuota._row, 'Estado', 'Pagado'); },
    });
  }
  return tareas;
}

async function getCorreccionesCierre(email) {
  await requireAdmin(email);
  const t = await evaluarCorreccionesCierre();
  return { total: t.length, pendientes: t.filter(x => x.pendiente).map(x => ({ key: x.key, desc: x.desc })) };
}

async function aplicarCorreccionesCierre(email) {
  const user = await requireAdmin(email);
  const tareas = (await evaluarCorreccionesCierre()).filter(t => t.pendiente);
  const resultados = [];
  for (const t of tareas) {
    try {
      await t.run(); resultados.push({ desc: t.desc, ok: true });
      await logAudit(user.email, 'Corrección de cierre: ' + t.desc, 'Correcciones cierre', 'Éxito');
    } catch (e) {
      resultados.push({ desc: t.desc, ok: false, error: e.message });
      await logAudit(user.email, 'Corrección de cierre fallida: ' + t.desc + ' — ' + e.message, 'Correcciones cierre', 'Error');
    }
  }
  return { aplicadas: resultados.filter(r => r.ok).length, errores: resultados.filter(r => !r.ok).length, resultados };
}

module.exports = {
  getCorreccionesCierre,
  aplicarCorreccionesCierre,
  repararIdLinea,
  importarHistoricoDeuda,
  getBootstrapData,
  crearLinea,
  registrarPago,
  cargaMasivaCuotas,
  reemplazarPlanPagos,
  archivarLinea,
  importarActivas,
  importarCanceladas,
  importarPagos,
  crearLeasing,
  importarLeasing,
  registrarPagoLeasing,
  crearUsuario,
  editarLinea,
  eliminarPago,
  editarUsuario,
  getUserRecord,
  readPP,
  parseMonto,
};
