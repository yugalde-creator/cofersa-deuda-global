/**
 * Lógica del módulo "Grupo" (Febeca / Beval / Sillaca / FQ) — hoja separada
 * de la de Cofersa. Por ahora es solo lectura: arma la vista por compañía y
 * el consolidado, a partir de MAESTRO_PRESTAMOS. Ninguna escritura desde acá
 * todavía — cualquier corrección se hace directamente en el Sheet.
 */
const { readMaestroPrestamos } = require('./sheetsGrupo');

/** Convierte fechas tipo "13/02/2026" (D/M/AAAA) a "2026-02-13" (ISO).
 * Si ya viene en otro formato reconocible la deja pasar. */
function parseFechaDMY(s) {
  if (!s) return '';
  const str = s.toString().trim();
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}

function parseNum(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(v.toString().replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function diasHasta(fechaISO, today) {
  if (!fechaISO) return null;
  const d = new Date(fechaISO + 'T00:00:00');
  if (isNaN(d)) return null;
  return Math.round((d - today) / 86400000);
}

function estadoPrestamo(dias) {
  if (dias === null) return { label: 'Sin fecha', cls: 'badge-gray' };
  if (dias < 0) return { label: 'Vencido', cls: 'badge-red', detail: `hace ${Math.abs(dias)} día(s)` };
  if (dias <= 30) return { label: 'Próximo', cls: 'badge-amber', detail: `en ${dias} día(s)` };
  return { label: 'Activo', cls: 'badge-blue', detail: `vence en ${dias} días` };
}

/** Empresas reconocidas actualmente en MAESTRO_PRESTAMOS. Si aparece una
 * nueva en la hoja, igual se incluye (no se descarta), solo no tendrá
 * nombre "bonito" predefinido. */
const EMPRESAS_CONOCIDAS = ['FEBECA', 'BEVAL', 'SILLACA', 'FQ'];

async function getGrupoBootstrapData() {
  const rows = await readMaestroPrestamos();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const prestamos = rows.map(r => {
    const empresa = (r['Deudor'] || '').toString().trim().toUpperCase();
    const fechaEmision = parseFechaDMY(r['Fecha Emision'] || r['Fecha Emisión']);
    const fechaVencimiento = parseFechaDMY(r['Fecha Vencimiento']);
    const dias = diasHasta(fechaVencimiento, today);
    const abonos = [];
    for (let n = 1; n <= 6; n++) {
      const fecha = r[`Fecha_Abono_Prog_${n}`];
      const monto = r[`Monto_Abono_Prog_${n}`];
      if (fecha || monto) abonos.push({ fecha: parseFechaDMY(fecha), monto: parseNum(monto) });
    }
    return {
      row: r._row,
      empresa,
      prestamoId: (r['PRESTAMO_ID'] || '').toString(),
      acreedor: (r['Acreedor'] || '').toString().trim(),
      amortCapital: (r['Amortizacion Capital'] || '').toString().trim(),
      amortIntereses: (r['Amortizacion Intereses'] || '').toString().trim(),
      tipoDocumento: (r['Tipo de Documento'] || '').toString().trim(),
      fechaEmision,
      fechaVencimiento,
      capitalInicial: parseNum(r['Capital Inicial']),
      capitalActual: parseNum(r['Capital Actual']),
      tasa: parseNum(r['Tasa']),
      apartadoUSD: parseNum(r['Apartado ($)']),
      apartadoBs: parseNum(r['Apartado (Bs.)']),
      linkContrato: (r['Link de Contrato'] || '').toString(),
      abonos,
      estado: estadoPrestamo(dias),
    };
  }).filter(p => p.empresa); // descarta filas separadoras sin compañía

  const empresas = [...new Set([...EMPRESAS_CONOCIDAS, ...prestamos.map(p => p.empresa)])]
    .filter(e => prestamos.some(p => p.empresa === e));

  const porEmpresa = {};
  empresas.forEach(e => {
    const lista = prestamos.filter(p => p.empresa === e);
    porEmpresa[e] = {
      prestamos: lista,
      totalCapitalActual: lista.reduce((s, p) => s + p.capitalActual, 0),
      totalCapitalInicial: lista.reduce((s, p) => s + p.capitalInicial, 0),
      cantidad: lista.length,
      vencidos: lista.filter(p => p.estado.label === 'Vencido').length,
    };
  });

  const totalGrupo = {
    totalCapitalActual: prestamos.reduce((s, p) => s + p.capitalActual, 0),
    totalCapitalInicial: prestamos.reduce((s, p) => s + p.capitalInicial, 0),
    cantidad: prestamos.length,
    vencidos: prestamos.filter(p => p.estado.label === 'Vencido').length,
  };

  return { empresas, porEmpresa, totalGrupo, fecha: today.toISOString().slice(0, 10) };
}

module.exports = { getGrupoBootstrapData };
