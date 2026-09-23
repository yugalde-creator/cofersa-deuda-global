/**
 * Cliente de Google Sheets para la hoja "Matriz - Deuda Financiera 25-26"
 * (grupo de empresas: Febeca, Beval, Sillaca, FQ). Es una hoja distinta a la
 * de Cofersa (SPREADSHEET_ID) — usa el mismo service account, pero necesita
 * permiso de Editor sobre este otro archivo (compartir client_email).
 *
 * No se modifica la hoja original: solo se lee la pestaña MAESTRO_PRESTAMOS,
 * que ya es una tabla limpia (un préstamo por fila).
 */
const { google } = require('googleapis');

const GRUPO_SPREADSHEET_ID = process.env.GRUPO_SPREADSHEET_ID || '1nTBCSXweeyFpG2Xb7bw3gw5yK-UyVUBfbX3FZk8c_aE';
const HOJA_MAESTRO = 'MAESTRO_PRESTAMOS';
// Rango real de la tabla: encabezados en fila 3, datos desde fila 4, columnas C..AC
// (columnas A y B están vacías/congeladas en el archivo original).
const RANGO = `${HOJA_MAESTRO}!C3:AC1000`;

function getAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
  const creds = JSON.parse(credJson);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

/** Lee MAESTRO_PRESTAMOS y devuelve un array de objetos {header: valor},
 * saltando filas completamente vacías (la hoja original tiene huecos entre
 * bloques de compañía). Cada fila incluye _row (número de fila real en la
 * hoja, 1-indexed) por si en el futuro se necesita escribir de vuelta. */
async function readMaestroPrestamos() {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: GRUPO_SPREADSHEET_ID,
    range: RANGO,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const rows = resp.data.values || [];
  if (!rows.length) return [];
  const headers = rows[0].map(h => (h || '').toString().trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const deudor = (row[0] || '').toString().trim();
    if (!deudor) continue; // fila vacía / separadora de bloque
    const obj = { _row: i + 3 }; // +3 porque el rango empieza en fila 3 (encabezado) y i=0 es esa fila
    headers.forEach((h, idx) => { if (h) obj[h] = row[idx]; });
    out.push(obj);
  }
  return out;
}

module.exports = { GRUPO_SPREADSHEET_ID, HOJA_MAESTRO, getSheetsClient, readMaestroPrestamos };
