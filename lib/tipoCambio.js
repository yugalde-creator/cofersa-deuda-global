/**
 * Tipo de cambio único del entorno Tesorería COFERSA: referencia de VENTA del BCCR, servida por el portal
 * (la misma fuente que usan Cash flow y el módulo Tipo de cambio). Config!TipoCambioUSD queda solo como
 * respaldo si el portal no responde.
 */
const PORTAL_TC = 'https://cofersa-tesoreria.vercel.app/api/publico/tipo-cambio';
const cache = new Map(); // fecha → { venta, t }

const iso = d => (d instanceof Date ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString() : String(d)).slice(0, 10);

/** Venta BCCR vigente en `fecha` (por defecto hoy; si ese día no tiene dato, el último anterior). */
async function tcBCCR(fecha, respaldo) {
  const dia = fecha ? iso(fecha) : null;
  const key = dia || 'hoy';
  const c = cache.get(key);
  if (c && Date.now() - c.t < 30 * 60 * 1000) return c.venta;
  try {
    let url = PORTAL_TC;
    if (dia) { const desde = new Date(dia + 'T00:00:00Z'); desde.setUTCDate(desde.getUTCDate() - 10); url += `?desde=${desde.toISOString().slice(0, 10)}&hasta=${dia}`; }
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const body = await r.json();
    const serie = (body.serie || []).filter(s => s.venta > 0 && (!dia || s.fecha <= dia));
    const venta = serie.length ? serie[serie.length - 1].venta : null;
    if (venta) { cache.set(key, { venta, t: Date.now() }); return venta; }
  } catch (e) { console.warn('[tipoCambio] portal BCCR sin respuesta:', e.message); }
  return respaldo || 455;
}

module.exports = { tcBCCR };
