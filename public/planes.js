/**
 * Planes de pago: lectura de tablas de los bancos y cálculo financiero.
 *
 * Lectores verificados contra las tablas reales de BAC, Davivienda, BCT y BCR.
 * Motor: intereses por días reales / base 360 (o 365), gracia de capital y la
 * convención de cuota de cada banco:
 *   - BAC:        cuota = PMT(tasa·365/360/12, n) redondeada hacia arriba al entero.
 *   - Davivienda: cuota exacta que deja saldo cero con intereses por días reales.
 *   - BCT:        igual que Davivienda, corriendo al día hábil siguiente.
 *   - BCR:        capital fijo (monto/n truncado a céntimos) + intereses.
 */
(function (root) {
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

  // "1,234.56" | "1.234,56" | ".00" → número (el último separador es el decimal)
  function monto(s) {
    s = String(s || '').replace(/[₡¢$\s]/g, '');
    if (!s) return 0;
    const m = s.match(/^(-?)([\d.,]*?)([.,](\d{1,2}))?$/);
    if (!m) return parseFloat(s) || 0;
    const ent = (m[2] || '0').replace(/[.,]/g, '') || '0';
    return parseFloat((m[1] || '') + ent + '.' + (m[4] || '0')) || 0;
  }
  function iso(d, m, y) {
    y = +y; if (y < 100) y += 2000;
    return `${y}-${String(+m).padStart(2, '0')}-${String(+d).padStart(2, '0')}`;
  }
  const MONEY = /-?(?:\d{1,3}(?:[.,]\d{3})+|\d+)?[.,]\d{2}(?!\d)/g;

  function detectarBanco(texto) {
    const t = texto || '';
    if (/Tabla Externa|No\. OPERACION\s+\d{2}-\s?\d{3}/i.test(t) || /\tFecha de Pago\s*\t/i.test(t)) return 'BCR';
    if (/P110|A125|PLAN DE PAGO PROYECTADO|BCT/i.test(t) && /\d{2}\.\d{2}\.\d{4}/.test(t)) return 'BCT';
    if (/TABLA DE AMORTIZACION|DAVIVIENDA|SALDO CAP\./i.test(t)) return 'Davivienda';
    if (/BAC SAN JOSE|Calendario de Pagos|Prestamo\.\.:/i.test(t)) return 'BAC';
    return null;
  }

  // Recorta el texto en cada inicio de cuota "N dd/mm/aa(aa)". No depende de los saltos de línea:
  // el extractor de PDF del navegador a veces junta dos filas de la tabla en una sola línea.
  function segmentosCuota(t, anio) {
    const re = new RegExp(`(?:^|[\\s|])(\\d{1,3})\\s+(\\d{1,2})\\/(\\d{1,2})\\/(\\d{${anio}})(?=\\s)`, 'g');
    const marcas = [...t.matchAll(re)];
    return marcas.map((m, i) => ({
      fecha: iso(m[2], m[3], m[4]),
      nums: (t.slice(m.index + m[0].length, i + 1 < marcas.length ? marcas[i + 1].index : undefined).match(MONEY) || []).map(monto),
    }));
  }
  // Davivienda: "N dd/mm/aaaa SALDO CAPITAL INTERES ..."
  function leerDavivienda(t) {
    return segmentosCuota(t, '4').filter(s => s.nums.length >= 3)
      .map(s => ({ fecha: s.fecha, capital: s.nums[1], interes: s.nums[2] }));
  }
  // BAC: "N dd/mm/aa PRINCIPAL INTERESES ..." (las filas "Pgo" son pagos aplicados; quedan al final
  // del segmento anterior y no afectan porque se toman los dos primeros montos)
  function leerBAC(t) {
    return segmentosCuota(t, '2,4').filter(s => s.nums.length >= 2)
      .map(s => ({ fecha: s.fecha, capital: s.nums[0], interes: s.nums[1] }));
  }
  // BCT: por fecha, P110 = intereses, A125/A135 = amortización. El monto es el primero con 2 decimales
  // después del código (la tasa tiene 4 decimales).
  function leerBCT(t) {
    const rows = {}, orden = [];
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/(\d{2})\.(\d{2})\.(\d{4})\s*(P110|A125|A135)\b(.*)$/);
      if (!m) continue;
      const resto = m[5].replace(/\d{2}\.\d{2}\.\d{4}/g, ' ').replace(/\b\d+\.\d{4}\b/g, ' ');
      const nums = (resto.match(MONEY) || []).map(monto);
      if (!nums.length) continue;
      const f = iso(m[1], m[2], m[3]);
      if (!rows[f]) { rows[f] = { fecha: f, capital: 0, interes: 0 }; orden.push(f); }
      if (m[4] === 'P110') rows[f].interes = r2(rows[f].interes + nums[0]);
      else rows[f].capital = r2(rows[f].capital + nums[0]);
    }
    return orden.sort().map(f => rows[f]);
  }
  // BCR: texto separado por tabuladores (.txt / .xls exportado). Cuota 0 = desembolso.
  function leerBCR(t) {
    const out = [];
    for (const line of t.split(/\r?\n/)) {
      const c = line.split('\t').map(x => x.trim());
      if (c.length < 7 || !/^\d+$/.test(c[0]) || c[0] === '0' || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(c[1])) continue;
      const [d, mth, y] = c[1].split('/');
      out.push({ fecha: iso(d, mth, y), capital: parseFloat(c[6]) || 0, interes: parseFloat(c[5]) || 0 });
    }
    return out;
  }

  // Arma líneas de texto desde los items de pdf.js ({x, y, w, s}). Une sin espacio los pedazos
  // contiguos: algunos PDF (BAC) guardan "24/09/" y "26" como piezas separadas.
  function textoDeItems(items) {
    const orden = items.slice().sort((a, b) => b.y - a.y), grupos = [];
    for (const it of orden) {
      const g = grupos[grupos.length - 1];
      if (g && Math.abs(it.y - g.y) < 4) { g.items.push(it); g.y = (g.y + it.y) / 2; } else grupos.push({ y: it.y, items: [it] });
    }
    return grupos.map(g => {
      const its = g.items.sort((a, b) => a.x - b.x);
      let o = '';
      its.forEach((i, k) => { if (k) { const p = its[k - 1]; o += (i.x - (p.x + (p.w || 0)) < 1.5) ? '' : ' '; } o += i.s; });
      return o;
    }).join('\n');
  }

  function leer(texto, bancoHint) {
    const banco = detectarBanco(texto) || normBanco(bancoHint);
    const f = { BAC: leerBAC, Davivienda: leerDavivienda, BCT: leerBCT, BCR: leerBCR }[banco];
    return { banco, filas: f ? f(texto || '') : [] };
  }
  function normBanco(b) {
    const s = String(b || '').toUpperCase();
    if (s.includes('BAC')) return 'BAC';
    if (s.includes('DAVI')) return 'Davivienda';
    if (s.includes('BCT')) return 'BCT';
    if (s.includes('BCR') || s.includes('COSTA RICA')) return 'BCR';
    return null;
  }
  // Número de operación dentro de un nombre de archivo ("01- 562-01-03-6141293.txt" → dígitos)
  function digitos(s) { return String(s || '').replace(/\D/g, ''); }

  // ---------------- Motor de cálculo ----------------
  function sumarMeses(d, n, dia) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
    const ult = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(dia, ult)));
  }
  function diaHabil(d) {
    const w = d.getUTCDay();
    return w === 6 ? new Date(+d + 2 * 864e5) : w === 0 ? new Date(+d + 864e5) : d;
  }
  const METODO_BANCO = { BAC: 'cuota_bac', Davivienda: 'cuota_exacta', BCT: 'cuota_exacta', BCR: 'capital_fijo' };

  /**
   * opts: { monto, tasa (% anual), desembolso 'YYYY-MM-DD', plazo (meses), primerPago? 'YYYY-MM-DD',
   *         metodo: 'auto'|'cuota_bac'|'cuota_exacta'|'capital_fijo'|'bullet', gracia (meses solo intereses),
   *         base: 360|365, habil: bool, banco }
   */
  function calcular(opts) {
    const monto0 = +opts.monto, r = (+opts.tasa) / 100, n = +opts.plazo, g = Math.max(0, +opts.gracia || 0);
    const base = +opts.base || 360;
    const banco = normBanco(opts.banco);
    let metodo = opts.metodo && opts.metodo !== 'auto' ? opts.metodo : (METODO_BANCO[banco] || 'cuota_exacta');
    const habil = opts.habil != null ? !!opts.habil : banco === 'BCT';
    const t0 = new Date(opts.desembolso + 'T00:00:00Z');
    const p1 = opts.primerPago ? new Date(opts.primerPago + 'T00:00:00Z') : sumarMeses(t0, 1, t0.getUTCDate());
    const dia = p1.getUTCDate();
    const mesesOffset = (p1.getUTCFullYear() - t0.getUTCFullYear()) * 12 + p1.getUTCMonth() - t0.getUTCMonth();
    const fechas = [t0];
    for (let i = 0; i < n; i++) {
      let f = sumarMeses(t0, mesesOffset + i, dia);
      if (habil) f = diaHabil(f);
      fechas.push(f);
    }
    const truncBCR = banco === 'BCR' || metodo === 'capital_fijo';
    const interes = (s, i) => {
      const x = s * r * ((fechas[i] - fechas[i - 1]) / 864e5) / base;
      return truncBCR ? Math.floor(x * 100 + 1e-7) / 100 : r2(x);
    };
    const simular = cuota => {
      let s = monto0; const filas = [];
      for (let i = 1; i <= n; i++) {
        const it = interes(s, i);
        let cap = 0;
        if (i > g) {
          if (i === n) cap = r2(s);
          else if (metodo === 'capital_fijo') cap = Math.floor(monto0 / (n - g) * 100) / 100;
          else if (metodo === 'bullet') cap = 0;
          else cap = r2(Math.min(s, cuota - it));
        }
        s = r2(s - cap);
        filas.push({ fecha: fechas[i].toISOString().slice(0, 10), dias: Math.round((fechas[i] - fechas[i - 1]) / 864e5), capital: cap, interes: it, cuota: r2(cap + it), saldo: s });
      }
      return filas;
    };
    let cuota = null;
    if (metodo === 'cuota_bac') {
      const rm = r * 365 / 360 / 12, k = n - g;
      cuota = rm ? Math.ceil(monto0 * rm / (1 - Math.pow(1 + rm, -k))) : Math.ceil(monto0 / k);
    } else if (metodo === 'cuota_exacta') {
      // cuota tal que, con intereses por días reales, el saldo quede en cero en la última cuota
      const saldoFinal = c => { let s = monto0; for (let i = 1; i <= n; i++) { const it = interes(s, i); if (i > g) s = r2(s - (c - it)); } return s; };
      let lo = 0, hi = monto0 * 2;
      for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; saldoFinal(m) > 0 ? (lo = m) : (hi = m); }
      cuota = r2((lo + hi) / 2);
    }
    const filas = simular(cuota);
    return { metodo, banco, cuota, filas, vencimiento: filas.length ? filas[filas.length - 1].fecha : null,
      totalCapital: r2(filas.reduce((a, f) => a + f.capital, 0)), totalInteres: r2(filas.reduce((a, f) => a + f.interes, 0)) };
  }

  const api = { leer, textoDeItems, detectarBanco, calcular, digitos, normBanco, monto, METODO_BANCO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlanesBanco = api;
})(typeof window !== 'undefined' ? window : globalThis);
