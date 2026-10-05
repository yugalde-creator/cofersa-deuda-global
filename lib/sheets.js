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
  HIST_TASA: 'Historico_Tasa',
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
  [SHEETS.HIST_TASA]: ['Periodo', 'Banco', 'SaldoUSD', 'TasaPond', 'Fuente'],
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
    // Los números se envían como número (no como texto): con coma decimal en el Sheet, "25584288.90" se leía mal.
    requestBody: { values: [rowArray.map(v => v === null || v === undefined ? '' : (typeof v === 'number' ? v : String(v)))] },
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
    requestBody: { values: [[typeof value === 'number' ? value : String(value)]] },
  });
}

/** Igual que setCellValue pero valueInputOption RAW: el valor se guarda tal cual (número como número, texto como texto). */
async function setCellValueRaw(sheetName, rowIndex, colName, value) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1` });
  const headers = (res.data.values || [[]])[0];
  const colIdx = headers.indexOf(colName);
  if (colIdx < 0) throw new Error(`Columna no encontrada: ${colName}`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${columnToLetter(colIdx + 1)}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
}

/** Añade una fila con valueInputOption RAW (números como números, texto como texto). */
async function appendRowRaw(sheetName, rowArray) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'RAW',
    requestBody: { values: [rowArray.map(v => (v === null || v === undefined ? '' : v))] },
  });
}

/** Fija el formato numérico de una celda (p. ej. quitar un formato de fecha de una celda de tasa). */
async function setNumberFormat(sheetName, rowIndex, colName, pattern) {
  const sheets = await getSheetsClient();
  const head = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1` });
  const colIdx = ((head.data.values || [[]])[0]).indexOf(colName);
  if (colIdx < 0) throw new Error(`Columna no encontrada: ${colName}`);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sh = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sh) throw new Error(`Hoja no encontrada: ${sheetName}`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ repeatCell: {
      range: { sheetId: sh.properties.sheetId, startRowIndex: rowIndex - 1, endRowIndex: rowIndex, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern } } },
      fields: 'userEnteredFormat.numberFormat',
    } }] },
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

// Hojas donde un ID sigue existiendo aunque la fila principal ya no esté (líneas archivadas
// conservan sus cuotas y pagos con el ID original).
const ID_TAMBIEN_EN = {
  LC: [[SHEETS.PAGOS_PROG, 0], [SHEETS.PAGOS_HIST, 1], [SHEETS.CANCELADAS, 'IDOriginal']],
  LS: [[SHEETS.LEASING_PAGOS, 0]],
};

/**
 * Siguiente ID: el número más alto usado + 1 (no la cantidad de filas: al archivar o borrar
 * filas, "filas + 1" repetía IDs existentes y mezclaba los planes de pago de dos operaciones).
 */
async function nextId(prefix, sheetName, padding) {
  const sheets = await getSheetsClient();
  const extra = ID_TAMBIEN_EN[prefix] || [];
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [sheetName, ...extra.map(([s]) => s)],
  });
  const re = new RegExp('^' + prefix + '-(\\d+)$');
  let max = 0;
  res.data.valueRanges.forEach((vr, i) => {
    const rows = vr.values || [];
    const col = i === 0 ? 0 : (typeof extra[i - 1][1] === 'number' ? extra[i - 1][1] : (rows[0] || []).indexOf(extra[i - 1][1]));
    if (col < 0) return;
    rows.slice(1).forEach(r => { const m = String(r[col] || '').trim().match(re); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  });
  return prefix + '-' + String(max + 1).padStart(padding || 3, '0');
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
/** Añade un encabezado de columna si no existe ya en la fila 1 de la hoja */
async function addColumnHeaderIfMissing(sheetName, colName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = (res.data.values || [[]])[0] || [];
  if (!headers.includes(colName)) {
    const colLetter = columnToLetter(headers.length + 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${colLetter}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[colName]] },
    });
  }
}

/** Escribe varias celdas por referencia A1 (ej. 'Pagos_Programados!A547') en una sola llamada. */
async function setCellsA1(cells) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data: cells.map(c => ({ range: c.range, values: [[c.value]] })) },
  });
}

module.exports = { SPREADSHEET_ID, getSheetsClient, SHEETS, SCHEMA, readRows, appendRow, appendRowRaw, setCellValue, setCellValueRaw, setNumberFormat, setCellsA1, deleteRow, nextId, fmtDate, keyOp, addColumnHeaderIfMissing };
