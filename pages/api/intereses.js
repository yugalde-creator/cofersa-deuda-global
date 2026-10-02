/**
 * GET /api/intereses[?anio=2026&mes=9]
 * Causado (devengo diario), ejecutado (intereses de cuotas pagadas) y proyección
 * del mes siguiente — operaciones y leasing. Ver lib/intereses.js.
 */
import { calcularIntereses } from '../../lib/intereses';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default async function handler(req, res) {
  try {
    const hoy = new Date();
    const qAnio = parseInt(req.query.anio, 10);
    const qMes = parseInt(req.query.mes, 10);
    let anio, mes;
    if (qAnio && qMes) { anio = qAnio; mes = qMes; }
    else if (hoy.getMonth() === 0) { anio = hoy.getFullYear() - 1; mes = 12; }
    else { anio = hoy.getFullYear(); mes = hoy.getMonth(); }

    const r = await calcularIntereses(anio, mes);
    return res.json({
      ok: true,
      generado: new Date().toISOString(),
      periodos: {
        causado: { label: `${MESES[mes]} ${anio}`, anio, mes },
        proyeccion: { label: `${MESES[r.siguiente.mes]} ${r.siguiente.anio}`, ...r.siguiente },
      },
      totales: r.totales,
      causado: r.causado,
      ejecutado: r.ejecutado,
      proyeccion: r.proyeccion,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
