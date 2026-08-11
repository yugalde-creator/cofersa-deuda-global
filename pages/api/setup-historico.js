/**
 * Endpoint temporal para crear la pestaña Historico_Deuda y poblarla con datos reales.
 * Llamar UNA sola vez: GET /api/setup-historico?token=cofersa2026
 * Luego se puede eliminar este archivo.
 */
import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1WXw5-pbPqVtxG4BeaCe9C2wfx_ChrnRV9dbf9x9kpcQ';

// Datos reales del reporte de gerencia (cierre mensual en USD)
const HISTORICO = [
  ['Periodo', 'MontoUSD'],
  ['2025-08', 11999000],
  ['2025-09', 11936000],
  ['2025-10', 11892000],
  ['2025-11', 12664000],
  ['2025-12', 12375000],
  ['2026-01', 12670000],
  ['2026-02', 13456000],
  ['2026-03', 12093000],
  ['2026-04', 11908000],
  ['2026-05', 11393000],
  ['2026-06', 11137000],
  ['2026-07', 12005337],
];

async function getSheetsClient() {
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export default async function handler(req, res) {
  // Proteger con token simple o sesión admin
  const session = await getServerSession(req, res, authOptions);
  const token = req.query.token;
  if (token !== 'cofersa2026' && (!session || session.user?.email !== 'yugalde@cofersa.cr')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const sheets = await getSheetsClient();

    // 1. Crear la pestaña Historico_Deuda si no existe
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const exists = meta.data.sheets.some(s => s.properties.title === 'Historico_Deuda');

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'Historico_Deuda' } } }],
        },
      });
    }

    // 2. Escribir los datos (sobreescribe todo)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Historico_Deuda!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: HISTORICO },
    });

    return res.status(200).json({
      success: true,
      message: `Pestaña Historico_Deuda ${exists ? 'actualizada' : 'creada'} con ${HISTORICO.length - 1} registros.`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
