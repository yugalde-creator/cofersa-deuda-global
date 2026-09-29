/**
 * Herramientas del asistente (Bot Cofersa) para Deuda Global.
 * Las consultas leen el Sheet directamente. Los cambios NUNCA se ejecutan aquí:
 * se devuelven como "propuestas" que el usuario confirma en la pantalla, y la
 * confirmación pasa por /api/action (que vuelve a validar el rol Admin).
 */
const { SHEETS, readRows, fmtDate } = require('./sheets');
const { readPP, parseMonto } = require('./backend');

const MAX_FILAS = 200;
const pagada = e => /pagad|concil|cancel/i.test(String(e || ''));

async function cargarDatos() {
  const [activas, plan, hist, leasing, leasingPagos, config] = await Promise.all([
    readRows(SHEETS.ACTIVAS),
    readPP(),
    readRows(SHEETS.PAGOS_HIST),
    readRows(SHEETS.LEASING).catch(() => []),
    readRows(SHEETS.LEASING_PAGOS).catch(() => []),
    readRows(SHEETS.CONFIG).catch(() => []),
  ]);
  const cfg = Object.fromEntries(config.map(c => [c.Clave, c.Valor]));
  const tc = parseMonto(cfg.TipoCambioUSD) || 455;
  const lineas = activas.map(a => ({
    id: a.ID, banco: a.Banco, numOp: a.NumOp, tipo: a.Tipo, moneda: (a.Moneda || 'CRC').toUpperCase(),
    aprobado: parseMonto(a.Aprobado), tasa: parseMonto(a.Tasa), plazo: parseMonto(a.Plazo),
    inicio: fmtDate(a.FechaInicio), vencimiento: fmtDate(a.FechaVencimiento), garantia: a.Garantia || '',
  }));
  const cuotas = plan.map(p => ({
    fila: p._row, lineaId: p.ID_Linea, fecha: fmtDate(p.Fecha),
    capital: parseMonto(p.Capital), interes: parseMonto(p.Interes), estado: p.Estado || 'Pendiente',
  }));
  const pagos = hist.map(h => ({
    id: h.ID, lineaId: h.ID_Linea, banco: h.Banco, fecha: fmtDate(h.Fecha), monto: parseMonto(h.Monto),
    estado: h.Estado, capitalReal: parseMonto(h.CapitalReal), interesReal: parseMonto(h.InteresReal),
  }));
  const contratos = leasing.map(l => ({
    id: l.ID, banco: l.Banco, numOp: l.NumOp, moneda: (l.Moneda || 'CRC').toUpperCase(), monto: parseMonto(l.Monto),
    tasa: parseMonto(l.Tasa), vencimiento: fmtDate(l.FechaVencimiento), estado: l.Estado,
  }));
  const cuotasLeasing = leasingPagos.map(p => ({
    fila: p._row, contratoId: p.ID_Contrato, fecha: fmtDate(p.Fecha), capital: parseMonto(p.Capital),
    interes: parseMonto(p.Interes), seguro: parseMonto(p.Seguro), iva: parseMonto(p.IVA), estado: p.Estado || 'Pendiente',
  }));
  return { lineas, cuotas, pagos, contratos, cuotasLeasing, tc };
}

// Mismo cálculo que el panel (lineaSaldoActual / leasingSaldoActual en public/app.js):
// monto aprobado menos el capital de las cuotas Pagado/Conciliado.
const cuotaPagada = e => e === 'Pagado' || e === 'Conciliado';
function saldoLinea(d, id) {
  const l = d.lineas.find(x => x.id === id);
  const pagado = d.cuotas.filter(c => c.lineaId === id && cuotaPagada(c.estado)).reduce((s, c) => s + c.capital, 0);
  return Math.max(r2((l ? l.aprobado : 0) - pagado), 0);
}
function saldoLeasing(d, c) {
  const pagado = d.cuotasLeasing.filter(q => q.contratoId === c.id && cuotaPagada(q.estado)).reduce((s, q) => s + q.capital, 0);
  return Math.max(r2(c.monto - pagado), 0);
}
const aUSD = (d, monto, moneda) => (moneda === 'USD' ? monto : monto / d.tc);
const r2 = n => Math.round(n * 100) / 100;
const enRango = (f, desde, hasta) => (!desde || f >= desde) && (!hasta || f <= hasta);
const coincide = (v, filtro) => !filtro || String(v || '').toLowerCase().includes(String(filtro).toLowerCase());
function recortar(filas) {
  return filas.length > MAX_FILAS
    ? { filas: filas.slice(0, MAX_FILAS), nota: `Se muestran ${MAX_FILAS} de ${filas.length}. Acota el rango.` }
    : { filas };
}

const nullable = t => ({ type: [t, 'null'] });
const schema = (props) => ({
  type: 'object', properties: props, required: Object.keys(props), additionalProperties: false,
});

const TOOLS = [
  {
    name: 'resumen_deuda',
    description: 'Totales de la deuda activa: saldo por banco y moneda, equivalente en USD, tipo de cambio y próximas cuotas (30 días). Úsala para preguntas generales de deuda.',
    input_schema: schema({}),
  },
  {
    name: 'listar_lineas',
    description: 'Lista las líneas de crédito activas con su saldo pendiente de capital, tasa, plazo y vencimiento.',
    input_schema: schema({ banco: { ...nullable('string'), description: 'Filtro por nombre de banco (parcial) o null' } }),
  },
  {
    name: 'pagos_realizados',
    description: 'Pagos ya registrados (hoja Pagos_Historicos) en un rango de fechas. Fechas YYYY-MM-DD.',
    input_schema: schema({
      desde: nullable('string'), hasta: nullable('string'),
      banco: nullable('string'), lineaId: { ...nullable('string'), description: 'ID tipo LC-001' },
    }),
  },
  {
    name: 'cuotas_programadas',
    description: 'Cuotas del plan de pagos (capital e interés) en un rango de fechas. Incluye "fila", necesaria para conciliar una cuota al registrar su pago.',
    input_schema: schema({
      desde: nullable('string'), hasta: nullable('string'),
      banco: nullable('string'), lineaId: nullable('string'),
      soloPendientes: { type: 'boolean' },
    }),
  },
  {
    name: 'leasing',
    description: 'Contratos de leasing y sus cuotas pendientes (con "fila" para conciliarlas).',
    input_schema: schema({ banco: nullable('string') }),
  },
  {
    name: 'proponer_registrar_pago',
    description: 'Prepara el registro de un pago de una línea. NO lo ejecuta: el usuario lo confirma en pantalla. Si el pago corresponde a una cuota programada, pasa su "fila" (cuotaRow) para conciliarla.',
    input_schema: schema({
      lineaId: { type: 'string' }, fecha: { type: 'string', description: 'YYYY-MM-DD' }, monto: { type: 'number' },
      cuotaRow: nullable('integer'), capitalReal: nullable('number'), interesReal: nullable('number'),
      resumen: { type: 'string', description: 'Una frase que describe el cambio para el botón de confirmar' },
    }),
  },
  {
    name: 'proponer_editar_linea',
    description: 'Prepara la edición de campos de una línea activa. NO la ejecuta: el usuario confirma. Pasa null en los campos que no cambian.',
    input_schema: schema({
      lineaId: { type: 'string' },
      Banco: nullable('string'), NumOp: nullable('string'), Tipo: nullable('string'), Moneda: nullable('string'),
      Aprobado: nullable('number'), Tasa: nullable('number'), Plazo: nullable('integer'),
      FechaInicio: nullable('string'), FechaVencimiento: nullable('string'), Garantia: nullable('string'),
      resumen: { type: 'string' },
    }),
  },
  {
    name: 'proponer_eliminar_pago',
    description: 'Prepara la eliminación de un pago registrado (ID tipo PG-0001). NO la ejecuta: el usuario confirma.',
    input_schema: schema({ pagoId: { type: 'string' }, resumen: { type: 'string' } }),
  },
  {
    name: 'proponer_pago_leasing',
    description: 'Prepara la conciliación de una cuota de leasing (por su "fila"). NO la ejecuta: el usuario confirma.',
    input_schema: schema({ contratoId: { type: 'string' }, cuotaRow: { type: 'integer' }, resumen: { type: 'string' } }),
  },
];

// Formato de herramientas para la Interactions API de Gemini: los campos que aceptan
// null pasan a ser opcionales (Gemini no maneja tipos compuestos como ['string','null']).
const GEMINI_TOOLS = TOOLS.map(t => {
  const props = {}, required = [];
  for (const [k, v] of Object.entries(t.input_schema.properties)) {
    const tipos = [].concat(v.type);
    props[k] = { ...v, type: tipos.find(x => x !== 'null') };
    if (!tipos.includes('null')) required.push(k);
  }
  const tool = { type: 'function', name: t.name, description: t.description };
  if (Object.keys(props).length) tool.parameters = { type: 'object', properties: props, required };
  return tool;
});

/** Ejecuta una herramienta. `ctx` = { datos (cache perezoso), propuestas[] }. */
async function ejecutar(nombre, input, ctx) {
  const d = ctx.datos || (ctx.datos = await cargarDatos());
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const lineaDe = id => d.lineas.find(l => l.id === id);

  switch (nombre) {
    case 'resumen_deuda': {
      const porBanco = {};
      let totalUSD = 0;
      for (const l of d.lineas) {
        const saldo = saldoLinea(d, l.id);
        const k = `${l.banco} (${l.moneda})`;
        porBanco[k] = r2((porBanco[k] || 0) + saldo);
        totalUSD += aUSD(d, saldo, l.moneda);
      }
      const leasingUSD = d.contratos.reduce((s, c) => s + aUSD(d, saldoLeasing(d, c), c.moneda), 0);
      const en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const proximas = d.cuotas
        .filter(c => !pagada(c.estado) && enRango(c.fecha, hoy, en30))
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map(c => ({ ...c, banco: lineaDe(c.lineaId)?.banco, moneda: lineaDe(c.lineaId)?.moneda }));
      return {
        hoy, tipoCambioUSD: d.tc, lineasActivas: d.lineas.length,
        saldoPorBanco: porBanco, saldoLeasingUSD: r2(leasingUSD), totalEquivalenteUSD: r2(totalUSD + leasingUSD),
        cuotasProximos30Dias: proximas,
      };
    }
    case 'listar_lineas':
      return d.lineas.filter(l => coincide(l.banco, input.banco))
        .map(l => ({ ...l, saldoPendiente: r2(saldoLinea(d, l.id)) }));
    case 'pagos_realizados':
      return recortar(d.pagos
        .filter(p => enRango(p.fecha, input.desde, input.hasta) && coincide(p.banco, input.banco) && (!input.lineaId || p.lineaId === input.lineaId))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(p => ({ ...p, moneda: lineaDe(p.lineaId)?.moneda || '' })));
    case 'cuotas_programadas':
      return recortar(d.cuotas
        .filter(c => enRango(c.fecha, input.desde, input.hasta) && (!input.lineaId || c.lineaId === input.lineaId)
          && coincide(lineaDe(c.lineaId)?.banco, input.banco) && (!input.soloPendientes || !pagada(c.estado)))
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map(c => ({ ...c, banco: lineaDe(c.lineaId)?.banco, moneda: lineaDe(c.lineaId)?.moneda })));
    case 'leasing':
      return d.contratos.filter(c => coincide(c.banco, input.banco)).map(c => ({
        ...c, saldo: saldoLeasing(d, c), cuotasPendientes: d.cuotasLeasing.filter(q => q.contratoId === c.id && !pagada(q.estado)).slice(0, 24),
      }));

    case 'proponer_registrar_pago': {
      const l = lineaDe(input.lineaId);
      if (!l) return { error: `No existe la línea activa ${input.lineaId}.` };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { error: 'La fecha debe ser YYYY-MM-DD.' };
      if (!(input.monto > 0)) return { error: 'El monto debe ser mayor a cero.' };
      if (input.cuotaRow != null && !d.cuotas.some(c => c.fila === input.cuotaRow && c.lineaId === l.id)) {
        return { error: `La fila ${input.cuotaRow} no es una cuota de ${l.id}.` };
      }
      const args = [{ lineaId: l.id, fecha: input.fecha, monto: input.monto, cuotaRow: input.cuotaRow ?? undefined,
        capitalReal: input.capitalReal ?? undefined, interesReal: input.interesReal ?? undefined }];
      return proponer(ctx, 'registrarPago', args, input.resumen);
    }
    case 'proponer_editar_linea': {
      if (!lineaDe(input.lineaId)) return { error: `No existe la línea activa ${input.lineaId}.` };
      const { lineaId, resumen, ...campos } = input;
      const cambios = Object.fromEntries(Object.entries(campos).filter(([, v]) => v != null));
      if (!Object.keys(cambios).length) return { error: 'No hay campos para cambiar.' };
      return proponer(ctx, 'editarLinea', [lineaId, cambios], resumen);
    }
    case 'proponer_eliminar_pago':
      if (!d.pagos.some(p => p.id === input.pagoId)) return { error: `No existe el pago ${input.pagoId}.` };
      return proponer(ctx, 'eliminarPago', [input.pagoId], input.resumen);
    case 'proponer_pago_leasing':
      if (!d.cuotasLeasing.some(q => q.fila === input.cuotaRow && q.contratoId === input.contratoId)) {
        return { error: `La fila ${input.cuotaRow} no es una cuota del contrato ${input.contratoId}.` };
      }
      return proponer(ctx, 'registrarPagoLeasing', [{ contratoId: input.contratoId, cuotaRow: input.cuotaRow }], input.resumen);
    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}

/**
 * Foto compacta de los datos recientes que va en las instrucciones de cada pregunta,
 * para que la mayoría de las consultas se respondan sin llamar herramientas
 * (el plan gratis de Gemini permite pocas solicitudes por minuto).
 */
async function snapshot(ctx) {
  const d = ctx.datos || (ctx.datos = await cargarDatos());
  const dia = n => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const desde = dia(-90), hasta = dia(120);
  const lineaDe = id => d.lineas.find(l => l.id === id);
  const resumen = await ejecutar('resumen_deuda', {}, ctx);
  return JSON.stringify({
    resumen: { ...resumen, cuotasProximos30Dias: undefined },
    lineas: d.lineas.map(l => ({ ...l, saldoPendiente: saldoLinea(d, l.id) })),
    cuotas: { rango: [desde, hasta], filas: d.cuotas.filter(c => enRango(c.fecha, desde, hasta))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(c => ({ ...c, banco: lineaDe(c.lineaId)?.banco, moneda: lineaDe(c.lineaId)?.moneda })) },
    pagos: { rango: [desde, resumen.hoy], filas: d.pagos.filter(p => enRango(p.fecha, desde, null))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(p => ({ ...p, moneda: lineaDe(p.lineaId)?.moneda || '' })) },
    leasing: d.contratos.map(c => ({ ...c, saldo: saldoLeasing(d, c),
      cuotasPendientes: d.cuotasLeasing.filter(q => q.contratoId === c.id && !pagada(q.estado) && enRango(q.fecha, null, hasta)) })),
  });
}

function proponer(ctx, action, args, resumen) {
  const id = 'P' + (ctx.propuestas.length + 1) + '-' + Date.now().toString(36);
  ctx.propuestas.push({ id, action, args, resumen });
  return { estado: 'pendiente_de_confirmacion', propuestaId: id, mensaje: 'El usuario verá un botón para confirmar o cancelar. Aún no se ha escrito nada.' };
}

module.exports = { GEMINI_TOOLS, ejecutar, snapshot };
