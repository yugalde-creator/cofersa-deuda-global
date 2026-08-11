/**
 * LÃ³gica de negocio â portada directamente de CÃ³digo.gs.
 * Reemplaza SpreadsheetApp, Session, LockService con equivalentes de Node.js.
 */
const { SHEETS, readRows, appendRow, setCellValue, deleteRow, nextId, fmtDate, keyOp } = require('./sheets');

/* ============================= HELPERS ============================= */

function parseMonto(s) {
  if (typeof s === 'number') return s;
  let str = (s || '').toString().trim().replace(/[â¡$]/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(str)) return parseFloat(str.replace(/\./g, ''));
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(str)) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+$/.test(str)) return parseFloat(str.replace(/,/g, ''));
  return parseFloat(str) || 0;
}

function normMoneda(m) {
  const s = (m || '').toString().trim().toLowerCase();
  return (s === 'crc' || s === 'colones' || s === 'colÃ³n' || s === 'colon') ? 'CRC' : 'USD';
}

function normEstadoPago(e) {
  const s = (e || '').toString().trim().toLowerCase();
  return (s.includes('cancel') || s.includes('concil') || s.includes('pagad')) ? 'Conciliado' : 'Pendiente';
}

function nowCR() {
  return new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

/* ============================= AMORTIZACIÃN ============================= */

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
  if (!user) throw new Error('No autorizado: tu cuenta no estÃ¡ en la hoja Usuarios.');
  if (user.rol !== 'Admin') {
    await logAudit(user.email, 'Intento de acciÃ³n restringida', 'Sistema', 'Bloqueado');
    throw new Error('AcciÃ³n bloqueada: tu rol "Consulta" es de solo lectura.');
  }
  return user;
}

/* ============================= AUDITORÃA ============================= */

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

  const [activas, pagosProg, canceladas, pagosHist, leasing, leasingPagosRows, usuarios, auditoria, bancos, config] = await Promise.all([
    readRows(SHEETS.ACTIVAS),
    readRows(SHEETS.PAGOS_PROG),
    readRows(SHEETS.CANCELADAS),
    readRows(SHEETS.PAGOS_HIST),
    readRows(SHEETS.LEASING),
    readRows(SHEETS.LEASING_PAGOS),
    readRows(SHEETS.USUARIOS),
    readRows(SHEETS.AUDITORIA),
    readRows(SHEETS.BANCOS),
    readRows(SHEETS.CONFIG),
  ]);

  const lines = activas.map(a => ({
    id: a.ID, numOp: a.NumOp, banco: a.Banco, tipo: a.Tipo, moneda: a.Moneda,
    aprobado: Number(a.Aprobado) || 0, tasa: Number(a.Tasa) || 0, plazo: Number(a.Plazo) || 0,
    inicio: fmtDate(a.FechaInicio), vencimiento: fmtDate(a.FechaVencimiento), garantia: a.Garantia || 'â',
  }));

  const paymentPlans = {};
  pagosProg.forEach(p => {
    const lid = p.ID_Linea;
    if (!paymentPlans[lid]) paymentPlans[lid] = [];
    paymentPlans[lid].push({ _row: p._row, fecha: fmtDate(p.Fecha), capital: Number(p.Capital) || 0, interes: Number(p.Interes) || 0, estado: p.Estado });
  });

  const lineasCanceladas = canceladas.map(c => ({
    id: c.ID, numOp: c.NumOp, banco: c.Banco, moneda: c.Moneda, monto: Number(c.Monto) || 0,
    tasa: Number(c.Tasa) || 0, plazo: Number(c.Plazo) || 0, inicio: fmtDate(c.FechaInicio), vencimiento: fmtDate(c.FechaVencimiento),
  }));

  const history = pagosHist.map(h => ({
    id: h.ID, linea: h.ID_Linea, banco: h.Banco, fecha: fmtDate(h.Fecha), monto: Number(h.Monto) || 0, estado: h.Estado,
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const leasingContratos = leasing.map(l => ({
    id: l.ID, numOp: l.NumOp, banco: l.Banco, moneda: l.Moneda, monto: Number(l.Monto) || 0,
    tasa: Number(l.Tasa) || 0, plazo: Number(l.Plazo) || 0, inicio: fmtDate(l.FechaInicio), vencimiento: fmtDate(l.FechaVencimiento), estado: l.Estado,
  }));

  const leasingPagos = {};
  leasingPagosRows.forEach(p => {
    const lid = p.ID_Contrato;
    if (!leasingPagos[lid]) leasingPagos[lid] = [];
    leasingPagos[lid].push({ _row: p._row, fecha: fmtDate(p.Fecha), capital: Number(p.Capital) || 0, interes: Number(p.Interes) || 0, seguro: Number(p.Seguro) || 0, iva: Number(p.IVA) || 0, estado: p.Estado });
  });

  const bankLimits = {};
  bancos.forEach(b => { bankLimits[b.Banco] = Number(b.LimiteUSD) || 0; });

  const cfg = {};
  config.forEach(c => { cfg[c.Clave] = c.Valor; });

  await logAudit(user.email, 'Consulta de panel de control', 'Dashboard', 'Ãxito');

  return {
    authorized: true,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    lines, paymentPlans, lineasCanceladas, history,
    leasingContratos, leasingPagos,
    usuarios: usuarios.map(u => ({ email: u.Email, nombre: u.Nombre, rol: u.Rol })),
    auditLog: auditoria.map(a => ({ fecha: fmtDate(a.Fecha), usuario: a.Usuario, accion: a.Accion, modulo: a.Modulo, resultado: a.Resultado })).reverse(),
    bankLimits,
    fx: { CRC: Number(cfg.TipoCambioUSD) || 455, USD: 1 },
    empresa: cfg.NombreEmpresa || 'Empresa',
    sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID || '1WXw5-pbPqVtxG4BeaCe9C2wfx_ChrnRV9dbf9x9kpcQ'}/edit`,
  };
}

/* ============================= OPERACIONES ============================= */

async function crearLinea(email, payload) {
  const user = await requireAdmin(email);
  const { banco, numOp, desembolso, monto, moneda, tasa, plazo, primerPago } = payload;
  if (!banco || !numOp) throw new Error('Banco y NÂ° de OperaciÃ³n son requeridos.');
  if (!(monto > 0)) throw new Error('Monto invÃ¡lido.');
  if (!(plazo > 0 && plazo <= 60)) throw new Error('El plazo debe estar entre 1 y 60 meses.');

  const k = keyOp(banco, numOp);
  const [activasRows, canceladasRows] = await Promise.all([readRows(SHEETS.ACTIVAS), readRows(SHEETS.CANCELADAS)]);
  const existentes = activasRows.concat(canceladasRows);
  if (existentes.some(r => keyOp(r.Banco, r.NumOp) === k)) {
    throw new Error('Ya existe una operaciÃ³n con ese banco y nÃºmero.');
  }

  const schedule = pmtSchedule(monto, tasa, plazo, primerPago);
  const newId = await nextId('LC', SHEETS.ACTIVAS, 3);

  await appendRow(SHEETS.ACTIVAS, [newId, banco, numOp, 'PrÃ©stamo a Plazo', moneda, monto, tasa, plazo, desembolso, schedule.vencimiento, 'â']);
  for (const f of schedule.filas) {
    await appendRow(SHEETS.PAGOS_PROG, [newId, f.fecha, f.capital, f.interes, 'Pendiente']);
  }

  await logAudit(user.email, `Nueva lÃ­nea con plan de pagos ${newId} (${plazo} cuotas)`, 'Operaciones', 'Ãxito');
  return { id: newId };
}

async function registrarPago(email, payload) {
  const user = await requireAdmin(email);
  const { lineaId, fecha, monto, cuotaRow } = payload;
  if (!(monto > 0)) throw new Error('Monto invÃ¡lido.');

  const historicos = await readRows(SHEETS.PAGOS_HIST);
  const dup = historicos.some(h => h.ID_Linea === lineaId && fmtDate(h.Fecha) === fecha && Math.abs(Number(h.Monto) - monto) < 0.01);
  if (dup) {
    await logAudit(user.email, `Intento de pago duplicado ${lineaId}`, 'ConciliaciÃ³n', 'Bloqueado');
    throw new Error('Pago duplicado detectado para esta lÃ­nea y fecha.');
  }

  const activas = await readRows(SHEETS.ACTIVAS);
  const linea = activas.find(l => l.ID === lineaId);
  const banco = linea ? linea.Banco : '';
  let estado = 'Pendiente';
  if (cuotaRow) {
    await setCellValue(SHEETS.PAGOS_PROG, cuotaRow, 'Estado', 'Pagado');
    estado = 'Conciliado';
  }
  const newId = await nextId('PG', SHEETS.PAGOS_HIST, 4);
  await appendRow(SHEETS.PAGOS_HIST, [newId, lineaId, banco, fecha, monto, estado]);

  await logAudit(user.email, `Registro de pago ${newId} sobre ${lineaId}${estado === 'Conciliado' ? ' (cuota conciliada)' : ''}`, 'ConciliaciÃ³n', 'Ãxito');
  return { id: newId };
}

async function cargaMasivaCuotas(email, lineaId, rowsRaw) {
  const user = await requireAdmin(email);
  const existentes = (await readRows(SHEETS.PAGOS_PROG)).filter(p => p.ID_Linea === lineaId);
  let added = 0, dup = 0;
  for (const r of rowsRaw) {
    if (r.length < 3) continue;
    const [fecha, capital, interes] = r;
    if (existentes.some(p => fmtDate(p.Fecha) === fecha)) { dup++; continue; }
    await appendRow(SHEETS.PAGOS_PROG, [lineaId, fecha, Number(capital) || 0, Number(interes) || 0, 'Pendiente']);
    added++;
  }
  await logAudit(user.email, `Carga masiva de ${added} cuota(s) en ${lineaId}`, 'ConciliaciÃ³n', 'Ãxito');
  return { added, dup };
}

async function archivarLinea(email, lineaId) {
  const user = await requireAdmin(email);
  const activas = await readRows(SHEETS.ACTIVAS);
  const linea = activas.find(l => l.ID === lineaId);
  if (!linea) throw new Error('LÃ­nea no encontrada.');

  const newId = await nextId('LX', SHEETS.CANCELADAS, 3);
  await appendRow(SHEETS.CANCELADAS, [newId, linea.Banco, linea.NumOp, linea.Moneda, linea.Aprobado, linea.Tasa, linea.Plazo, fmtDate(linea.FechaInicio), fmtDate(linea.FechaVencimiento)]);
  await deleteRow(SHEETS.ACTIVAS, linea._row);

  await logAudit(user.email, `Archivado de lÃ­nea ${lineaId} como cancelada`, 'Operaciones', 'Ãxito');
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
    await appendRow(SHEETS.ACTIVAS, [newId, banco, numOp, 'PrÃ©stamo a Plazo', moneda, montoNum, parseFloat(tasa) || 0, parseInt(plazo, 10) || 12, fechaDesembolso, vencimiento, 'â']);
    existentes.push({ Banco: banco, NumOp: numOp });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} lÃ­nea(s) activa(s)`, 'Importar histÃ³rico', added > 0 ? 'Ãxito' : 'Bloqueado');
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
  await logAudit(user.email, `Carga de historial: ${added} lÃ­nea(s) cancelada(s)`, 'Importar histÃ³rico', added > 0 ? 'Ãxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

async function importarPagos(email, rowsRaw) {
  const user = await requireAdmin(email);
  const [activas, canceladas, historicos, pagosProg] = await Promise.all([
    readRows(SHEETS.ACTIVAS), readRows(SHEETS.CANCELADAS), readRows(SHEETS.PAGOS_HIST), readRows(SHEETS.PAGOS_PROG),
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
    await appendRow(SHEETS.PAGOS_HIST, [newId, lineaId, banco, fecha, montoTotal, estadoFinal]);
    historicos.push({ ID_Linea: lineaId, Fecha: fecha, Monto: montoTotal });
    added++;
  }
  await logAudit(user.email, `Carga de historial: ${added} pago(s)`, 'Importar histÃ³rico', added > 0 ? 'Ãxito' : 'Bloqueado');
  return { added, dupCount, invalid };
}

/* ============================= LEASING ============================= */

async function crearLeasing(email, payload) {
  const user = await requireAdmin(email);
  const { banco, numOp, desembolso, monto, moneda, tasa, plazo, primerPago, seguro, ivaPct } = payload;
  if (!banco || !numOp) throw new Error('Banco y NÂ° de OperaciÃ³n son requeridos.');
  if (!(monto > 0)) throw new Error('Monto invÃ¡lido.');
  if (!(plazo > 0 && plazo <= 60)) throw new Error('El plazo debe estar entre 1 y 60 meses.');

  const k = keyOp(banco, numOp);
  const leasingRows = await readRows(SHEETS.LEASING);
  if (leasingRows.some(l => keyOp(l.Banco, l.NumOp) === k)) {
    throw new Error('Ya existe un contrato con ese banco y nÃºmero.');
  }

  const schedule = pmtScheduleLeasing(monto, tasa, plazo, primerPago, seguro || 0, ivaPct || 0);
  const newId = await nextId('LS', SHEETS.LEASING, 3);
  await appendRow(SHEETS.LEASING, [newId, banco, numOp, moneda, monto, tasa, plazo, desembolso, schedule.vencimiento, 'Activo']);
  for (const f of schedule.filas) {
    await appendRow(SHEETS.LEASING_PAGOS, [newId, f.fecha, f.capital, f.interes, f.seguro, f.iva, 'Pendiente']);
  }

  await logAudit(user.email, `Nuevo contrato de leasing ${newId} (${plazo} cuotas)`, 'Leasing Financiero', 'Ãxito');
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

  await logAudit(user.email, `ImportaciÃ³n de leasing: ${addedC} contrato(s), ${addedP} cuota(s)`, 'Leasing Financiero', 'Ãxito');
  return { addedC, dupC, invalidC, addedP, dupP, invalidP };
}

async function registrarPagoLeasing(email, payload) {
  const user = await requireAdmin(email);
  const { contratoId, cuotaRow } = payload;
  if (!cuotaRow) throw new Error('Selecciona una cuota pendiente.');
  await setCellValue(SHEETS.LEASING_PAGOS, cuotaRow, 'Estado', 'Pagado');
  await logAudit(user.email, `ConciliaciÃ³n de cuota de leasing sobre ${contratoId}`, 'Leasing Financiero', 'Ãxito');
  return { ok: true };
}

/* ============================= USUARIOS ============================= */

async function crearUsuario(email, payload) {
  const user = await requireAdmin(email);
  const { nombre, email: newEmail, rol } = payload;
  if (!nombre || !newEmail) throw new Error('Completa nombre y correo.');
  const existentes = await readRows(SHEETS.USUARIOS);
  if (existentes.some(u => (u.Email || '').toLowerCase() === newEmail.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese correo.');
  }
  await appendRow(SHEETS.USUARIOS, [newEmail, nombre, rol || 'Consulta']);
  await logAudit(user.email, `CreaciÃ³n de usuario ${newEmail} (${rol})`, 'Usuarios', 'Ãxito');
  return { ok: true };
}

/* ============================= EDICIÃN ============================= */

async function editarLinea(email, lineaId, payload) {
  const user = await requireAdmin(email);
  const activas = await readRows(SHEETS.ACTIVAS);
  const linea = activas.find(l => l.ID === lineaId);
  if (!linea) throw new Error('LÃ­nea no encontrada.');

  const editables = ['Banco', 'NumOp', 'Tipo', 'Moneda', 'Aprobado', 'Tasa', 'Plazo', 'FechaInicio', 'FechaVencimiento', 'Garantia'];
  const changed = [];
  for (const campo of editables) {
    if (payload[campo] !== undefined && String(payload[campo]) !== String(linea[campo])) {
      await setCellValue(SHEETS.ACTIVAS, linea._row, campo, payload[campo]);
      changed.push(campo);
    }
  }

  await logAudit(user.email, `EdiciÃ³n de lÃ­nea ${lineaId}: ${changed.join(', ') || 'sin cambios'}`, 'Operaciones', 'Ãxito');
  return { changed };
}

async function eliminarPago(email, pagoId) {
  const user = await requireAdmin(email);
  const pagos = await readRows(SHEETS.PAGOS_HIST);
  const pago = pagos.find(p => p.ID === pagoId);
  if (!pago) throw new Error('Pago no encontrado.');

  await deleteRow(SHEETS.PAGOS_HIST, pago._row);
  await logAudit(user.email, `EliminaciÃ³n de pago ${pagoId}`, 'ConciliaciÃ³n', 'Ãxito');
  return { ok: true };
}

async function editarUsuario(email, targetEmail, payload) {
  const user = await requireAdmin(email);
  const usuarios = await readRows(SHEETS.USUARIOS);
  const target = usuarios.find(u => (u.Email || '').toLowerCase() === targetEmail.toLowerCase());
  if (!target) throw new Error('Usuario no encontrado.');

  if (payload.Nombre !== undefined) await setCellValue(SHEETS.USUARIOS, target._row, 'Nombre', payload.Nombre);
  if (payload.Rol !== undefined) await setCellValue(SHEETS.USUARIOS, target._row, 'Rol', payload.Rol);

  await logAudit(user.email, `EdiciÃ³n de usuario ${targetEmail}`, 'Usuarios', 'Ãxito');
  return { ok: true };
}

module.exports = {
  getBootstrapData,
  crearLinea,
  registrarPago,
  cargaMasivaCuotas,
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
};
