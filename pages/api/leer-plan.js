/**
 * Lee con Gemini la tabla de un plan de pagos escaneado (PDF sin texto) o que el lector
 * por banco no pudo interpretar.
 *   POST /api/leer-plan  cuerpo = PDF (máx. 4 MB) → { filas: [{fecha, capital, interes}], modelo }
 * El cliente valida que la suma del capital cuadre con el monto antes de dejar guardar.
 */
import { GoogleGenAI } from '@google/genai';
import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]';
import { getUserRecord } from '../../lib/backend';

export const config = { api: { bodyParser: false }, maxDuration: 120 };
const MAX_BYTES = 4 * 1024 * 1024;
const MODELOS = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])];

const PROMPT = `Este documento es la tabla (plan) de pagos de un préstamo bancario en Costa Rica (BAC, BCT, Davivienda o BCR).
Extrae UNA fila por cuota programada, en orden, con:
- fecha: fecha de pago de la cuota en formato YYYY-MM-DD (las fechas del documento son día/mes/año).
- capital: amortización o principal de la cuota (0 si la cuota es solo intereses).
- interes: intereses corrientes de la cuota.
Reglas: no incluyas la fila de desembolso, ni filas de pagos ya aplicados ("Pgo"), ni totales, seguros, mora ni comisiones.
En BCT cada fecha tiene dos renglones: "P110 Intereses corrientes" (interes) y "A125 Amortización" (capital); júntalos en una fila.
Los montos son números sin símbolo ni separador de miles, con punto decimal. Copia los montos exactamente como aparecen.`;

const ESQUEMA = {
  type: 'object',
  properties: {
    filas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { fecha: { type: 'string' }, capital: { type: 'number' }, interes: { type: 'number' } },
        required: ['fecha', 'capital', 'interes'],
      },
    },
  },
  required: ['filas'],
};

async function leerCuerpo(req) {
  const partes = []; let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > MAX_BYTES) throw Object.assign(new Error('El archivo supera 4 MB.'), { status: 413 });
    partes.push(c);
  }
  return Buffer.concat(partes);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: 'No autenticado' });
  const user = await getUserRecord(email);
  if (!user) return res.status(403).json({ error: 'Tu cuenta no está en la hoja Usuarios.' });
  if (!process.env.GEMINI_API_KEY) return res.status(200).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });

  let pdf;
  try { pdf = await leerCuerpo(req); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (!pdf.length) return res.status(400).json({ error: 'Archivo vacío.' });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let ultimoError;
  for (const modelo of MODELOS) {
    try {
      const r = await ai.models.generateContent({
        model: modelo,
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: req.headers['content-type'] || 'application/pdf', data: pdf.toString('base64') } },
          { text: PROMPT },
        ] }],
        config: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0 },
      });
      const datos = JSON.parse(r.text || '{}');
      const filas = (datos.filas || [])
        .filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha))
        .map(f => ({ fecha: f.fecha, capital: Math.round((+f.capital || 0) * 100) / 100, interes: Math.round((+f.interes || 0) * 100) / 100 }));
      return res.status(200).json({ filas, modelo });
    } catch (err) {
      ultimoError = err;
      console.warn('[leer-plan]', modelo, err?.status || err?.message);
      if (![429, 500, 503, 504].includes(err?.status) && !/timeout|aborted|JSON/i.test(String(err?.message))) break;
    }
  }
  const s = ultimoError?.status;
  return res.status(200).json({ error: s === 429 ? 'Se alcanzó el límite gratis de Gemini por este minuto. Espera un minuto e intenta de nuevo.' : 'No se pudo leer el PDF con IA. Puedes pegar la tabla en CSV o calcular el plan.' });
}
