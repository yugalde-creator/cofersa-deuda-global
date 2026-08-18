/**
 * Endpoint temporal — agrega LC-048 (Davivienda 10410129972707607) y LC-049 (BAC 200095282)
 * con sus planes de pago exactos según tablas de amortización oficiales.
 * Llamar una sola vez: GET /api/setup-lineas-nuevas?secret=cofersa2026
 */
import { readRows, appendRow, SHEETS } from '../../lib/sheets';

const SECRET = 'cofersa2026';

const LINEAS_NUEVAS = [
  {
    id: 'LC-048',
    banco: 'Davivienda',
    numOp: '10410129972707607',
    tipo: 'Préstamo a Plazo',
    moneda: 'CRC',
    aprobado: 84000000,
    tasa: 8.4,
    plazo: 12,
    inicio: '2026-08-14',
    vencimiento: '2027-08-14',
    garantia: '—',
    // Tabla de amortización oficial Davivienda — 14 agosto 2026
    cuotas: [
      { fecha: '2026-09-14', capital: 6737639.38, interes: 607600.00 },
      { fecha: '2026-10-14', capital: 6784802.86, interes: 540836.52 },
      { fecha: '2026-11-14', capital: 6815851.71, interes: 509787.67 },
      { fecha: '2026-12-14', capital: 6880007.44, interes: 445631.94 },
      { fecha: '2027-01-14', capital: 6914918.43, interes: 410720.95 },
      { fecha: '2027-02-14', capital: 6964936.34, interes: 360703.04 },
      { fecha: '2027-03-14', capital: 7045347.33, interes: 280292.05 },
      { fecha: '2027-04-14', capital: 7066277.39, interes: 259361.99 },
      { fecha: '2027-05-14', capital: 7124107.85, interes: 201531.53 },
      { fecha: '2027-06-14', capital: 7168921.18, interes: 156718.20 },
      { fecha: '2027-07-14', capital: 7224159.05, interes: 101480.33 },
      { fecha: '2027-08-14', capital: 7273031.04, interes: 52608.26 },
    ],
  },
  {
    id: 'LC-049',
    banco: 'BAC',
    numOp: '200095282',
    tipo: 'Préstamo a Plazo',
    moneda: 'CRC',
    aprobado: 100000000,
    tasa: 7.25,
    plazo: 12,
    inicio: '2026-08-07',
    vencimiento: '2027-08-07',
    garantia: '—',
    // Tabla BAC — 6 meses gracia capital (solo intereses), luego amortización
    cuotas: [
      { fecha: '2026-09-07', capital: 0,            interes: 624305.56 },
      { fecha: '2026-10-07', capital: 0,            interes: 604166.67 },
      { fecha: '2026-11-07', capital: 0,            interes: 624305.56 },
      { fecha: '2026-12-07', capital: 0,            interes: 604166.67 },
      { fecha: '2027-01-07', capital: 0,            interes: 624305.56 },
      { fecha: '2027-02-07', capital: 0,            interes: 624305.56 },
      { fecha: '2027-03-07', capital: 16461922.11,  interes: 563888.89 },
      { fecha: '2027-04-07', capital: 16504278.14,  interes: 521532.86 },
      { fecha: '2027-05-07', capital: 16620815.13,  interes: 404995.87 },
      { fecha: '2027-06-07', capital: 16711079.94,  interes: 314731.06 },
      { fecha: '2027-07-07', capital: 16822195.33,  interes: 203615.67 },
      { fecha: '2027-08-07', capital: 16879709.35,  interes: 105380.96 },
    ],
  },
];

export default async function handler(req, res) {
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // Verificar que no existan ya
    const activas = await readRows(SHEETS.ACTIVAS);
    const existentes = activas.map(r => r.NumOp);

    const resultados = [];

    for (const linea of LINEAS_NUEVAS) {
      if (existentes.includes(linea.numOp)) {
        resultados.push({ id: linea.id, estado: 'ya_existe', numOp: linea.numOp });
        continue;
      }

      // Agregar la línea a Operaciones_Activas
      await appendRow(SHEETS.ACTIVAS, [
        linea.id,
        linea.banco,
        linea.numOp,
        linea.tipo,
        linea.moneda,
        linea.aprobado,
        linea.tasa,
        linea.plazo,
        linea.inicio,
        linea.vencimiento,
        linea.garantia,
      ]);

      // Agregar cuotas a Pagos_Programados
      for (const c of linea.cuotas) {
        await appendRow(SHEETS.PAGOS_PROG, [
          linea.id,
          c.fecha,
          c.capital,
          c.interes,
          'Pendiente',
        ]);
      }

      resultados.push({
        id: linea.id,
        estado: 'agregado',
        numOp: linea.numOp,
        banco: linea.banco,
        cuotas: linea.cuotas.length,
        monto: linea.aprobado.toLocaleString(),
        moneda: linea.moneda,
      });
    }

    // Auditoría
    const now = new Date().toISOString().slice(0,16).replace('T',' ');
    await appendRow(SHEETS.AUDITORIA, [
      now,
      'sistema',
      `Líneas nuevas agregadas: ${resultados.filter(r=>r.estado==='agregado').map(r=>r.id).join(', ')}`,
      'Configuración',
      'Éxito',
    ]);

    return res.status(200).json({ ok: true, resultados });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
