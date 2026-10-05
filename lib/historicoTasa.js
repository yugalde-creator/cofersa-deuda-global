/**
 * Historial mensual por acreedor (saldo en US$ equivalentes + tasa ponderada por saldo) para la tasa efectiva a 12 meses.
 * Pestaña Historico_Tasa del Sheet: Periodo (YYYY-MM) | Banco | SaldoUSD | TasaPond (%) | Fuente.
 * Los meses anteriores a Set-2026 vienen de lib/historicoTasaSeed.js (matrices de tesorería); lo que esté en el Sheet
 * tiene prioridad sobre el seed. Cada cierre que genera el informe se guarda aquí (upsert por Periodo + Banco).
 */
const { SEED } = require('./historicoTasaSeed');

const TAB = 'Historico_Tasa';
const HEAD = ['Periodo', 'Banco', 'SaldoUSD', 'TasaPond', 'Fuente'];
const per = (a, m) => `${a}-${String(m).padStart(2, '0')}`;

/** Devuelve { 'YYYY-MM': { banco: { saldo, tasa } } } mezclando seed + pestaña del Sheet. */
async function leerHistorial(parseMonto) {
  const out = {};
  Object.entries(SEED).forEach(([p, bancos]) => { out[p] = {}; Object.entries(bancos).forEach(([b, [saldo, tasa]]) => { out[p][b] = { saldo, tasa }; }); });
  try {
    const { readRows } = require('./sheets');
    const rows = await readRows(TAB);
    rows.forEach(r => {
      const p = (r.Periodo || '').toString().trim(), b = (r.Banco || '').toString().trim();
      const saldo = parseMonto(r.SaldoUSD), tasa = parseMonto(r.TasaPond);
      if (/^\d{4}-\d{2}$/.test(p) && b && saldo > 0 && tasa > 0) (out[p] = out[p] || {})[b] = { saldo, tasa };
    });
  } catch (e) { /* la pestaña aún no existe: se usa solo el seed */ }
  return out;
}

/** Crea la pestaña si falta y hace upsert de las filas del periodo: filas = [{banco, saldo, tasa}]. */
async function guardarSnapshot(periodo, filas, fuente = 'Informe CFO') {
  const { getSheetsClient, SPREADSHEET_ID } = require('./sheets');
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  if (!meta.data.sheets.some(s => s.properties.title === TAB)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } });
    const semilla = Object.entries(SEED).flatMap(([p, bs]) => Object.entries(bs).map(([b, [saldo, tasa]]) => [p, b, saldo, tasa, 'Matriz de tesorería']));
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${TAB}!A1`, valueInputOption: 'RAW', requestBody: { values: [HEAD, ...semilla] } });
  }
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${TAB}!A:B` });
  const vals = cur.data.values || [];
  const nuevos = [];
  for (const f of filas) {
    const fila = [periodo, f.banco, Math.round(f.saldo * 100) / 100, Math.round(f.tasa * 100) / 100, fuente];
    const idx = vals.findIndex((r, i) => i > 0 && r[0] === periodo && r[1] === f.banco);
    if (idx >= 0) await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${TAB}!A${idx + 1}:E${idx + 1}`, valueInputOption: 'RAW', requestBody: { values: [fila] } });
    else nuevos.push(fila);
  }
  if (nuevos.length) await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `${TAB}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: nuevos } });
  return { periodo, filas: filas.length, nuevas: nuevos.length };
}

module.exports = { leerHistorial, guardarSnapshot, per };
