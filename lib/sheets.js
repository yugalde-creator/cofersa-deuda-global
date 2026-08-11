/**
 * Google Sheets API v4 wrapper — reemplaza SpreadsheetApp de Apps Script.
 * Usa Service Account (creds en GOOGLE_SERVICE_ACCOUNT_JSON env var).
 */
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1WXw5-pbPqVtxG4BeaCe9C2wfx_ChrnRV9dbf9x9kpcQ';

const SHEETS = {
  ACTIVAS: 'Operaciones_Activas',
  PAGOS_PROG: 'Pagos_Programados',
  CANCELADAS: 'Operaciones_Canceladas',
  PAGOS_HIST: 'Pagos_Historicos',
  LEASING: 'Leasing_Contratos',
  LEASING_PAGOS: 'Leasing_Pagos',
  USUARIOS: 'Usuarios',
  AUDITORIA: 'Auditoria',
  BANCOS: 'Bancos',
  CONFIG: 'Config',
  HIST_DEUDA: 'Historico_Deuda',
};

const SCHEMA = {
  [SHEETS.ACTIVAS]: ['ID', 'Banco', 'NumOp', 'Tipo', 'Moneda', 'Aprobado', 'Tasa', 'Plazo', 'FechaInicio', 'FechaVencimiento', 'Garantia'],
  [SHEETS.PAGOS_PROG]: ['ID_Linea', 'Fecha', 'Capital', 'Interes', 'Estado'],
  [SHEETS.CANCELADAS]: ['ID', 'Banco', 'NumOp', 'Moneda', 'Monto', 'Tasa', 'Plazo', 'FechaInicio', 'FechaVencimiento'],
  [SHEETS.PAGOS_HIST]: ['ID', 'ID_Linea', 'Banco', 'Fecha', 'Monto', 'Estado'],
  [SHEETS.LEASING]: ['ID', 'Banco', 'NumOp', 'Moneda', 'Monto', 'Tasa', 'Plazo', 'FechaInicio', 'FechaVencimiento', 'Estado'],
  [SHEETS.LEASING_PAGOS]: ['ID_Contrato', 'Fecha', 'Capital', 'Interes', 'Seguro', 'IVA', 'Estado'],
  [SHEETS.USUARIOS]: ['Email', 'Nombre', 'Rol'],
  [SHEETS.AUDITORIA]: ['Fecha', 'Usuario', 'Accion', 'Modulo', 'Resultado'],
  [SHEETS.BANCOS]: ['Banco', 'LimiteUSD'],
  [SHEETS.CONFIG]: ['Clave', 'Valor'],
  [SHEETS.HIST_DEUDA]: ['Periodo', 'MontoUSD'],
};

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

/** Formato de fecha yyyy-MM-dd */
function fmtDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.split('T')[0];
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lee todas las filas de una hoja como array de objetos */
async function readRows(sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1)
    .map((row, i) => {
      const obj = { _row: i + 2 };
      headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? row[j] : ''; });
      return obj;
    })
    .filter(obj => obj[headers[0]] !== '' && obj[headers[0]] != null);
}

/** Añade una fila al final de la hoja */
async function appendRow(sheetName, rowArray) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowArray.map(v => v === null || v === undefined ? '' : String(v))] },
  });
}

/** Actualiza una celda específica por rowIndex (1-indexed) y nombre de columna */
async function setCellValue(sheetName, rowIndex, colName, value) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = (res.data.values || [[]])[0];
  const colIdx = headers.indexOf(colName);
  if (colIdx < 0) throw new Error(`Columna no encontrada: ${colName}`);
  const colLetter = columnToLetter(colIdx + 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${colLetter}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[String(value)]] },
  });
}

/** Elimina una fila por índice (1-indexed) */
async function deleteRow(sheetName, rowIndex) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Hoja no encontrada: ${sheetName}`);
  const sheetId = sheet.properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
        },
      }],
    },
  });
}

/** Siguiente ID auto-incremental */
async function nextId(prefix, sheetName, padding) {
  const rows = await readRows(sheetName);
  return prefix + '-' + String(rows.length + 1).padStart(padding || 3, '0');
}

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

function keyOp(banco, numOp) {
  return (banco || '').toString().trim().toUpperCase() + '|' + (numOp || '').toString().trim();
}

module.exports = { SHEETS, SCHEMA, readRows, appendRow, setCellValue, deleteRow, nextId, fmtDate, keyOp };
