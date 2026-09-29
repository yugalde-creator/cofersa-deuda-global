/**
 * Asistente con IA (Yeison Bot) de Deuda Global, sobre Gemini (plan gratis de Google).
 * POST /api/bot  body: { interactionId: 'id de la última respuesta o null', texto: 'pregunta' }
 * Responde: { interactionId, respuesta, propuestas }
 * Google guarda el hilo de la conversación (plan gratis: 1 día); el cliente solo manda el último id.
 */
import { GoogleGenAI } from '@google/genai';
import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]';
import { getUserRecord } from '../../lib/backend';
import { GEMINI_TOOLS, ejecutar } from '../../lib/botTools';

export const config = { maxDuration: 60 };

const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_VUELTAS = 8;

function systemPrompt(user) {
  const hoy = new Date().toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  return `Eres Yeison Bot, el asistente de la app "Deuda Global" de Cofersa (tesorería). Hablas con ${user.nombre || user.email}, rol ${user.rol}.
Hoy es ${hoy} (${iso}), hora de Costa Rica. La semana va de lunes a domingo.

Cómo trabajas:
- Toda cifra sale de las herramientas. Nunca inventes montos, fechas ni IDs. Si una herramienta no trae el dato, dilo.
- Montos: colones con ₡ y dólares con $, separador de miles con punto y decimales con coma (₡1.234.567,89). Indica siempre la moneda.
- Responde corto y directo, en español de Costa Rica. Usa listas con guiones y **negritas** para los totales. No uses tablas.
- Para cambios de datos (registrar un pago, editar una línea, eliminar un pago, conciliar leasing) usa las herramientas proponer_*. Eso NO ejecuta nada: el usuario ve un botón para confirmar. Di "te dejé el cambio listo para confirmar", nunca que ya quedó hecho.
- Antes de proponer, verifica con las consultas que la línea, la cuota o el pago existan. Si falta un dato (monto, fecha, cuál cuota), pregunta.
${user.rol === 'Admin' ? '' : '- Este usuario tiene rol Consulta: solo puede consultar. Si pide un cambio, explícale que necesita rol Admin.\n'}- Si piden un cambio a la app misma (pantallas, columnas, gráficos, reportes nuevos), todavía no puedes hacerlo tú. Resume la solicitud en una frase clara para que Yeison la pase a desarrollo.`;
}

function mensajeError(err) {
  const s = err?.status;
  if (s === 429) return 'Se alcanzó el límite gratis de consultas por ahora. Espera un minuto e intenta de nuevo.';
  if (s === 400 || s === 403) return 'La API key de Gemini no es válida o no tiene acceso a este modelo.';
  return 'No pude responder. Intenta de nuevo.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: 'No autenticado' });
  const user = await getUserRecord(email);
  if (!user) return res.status(403).json({ error: 'Tu cuenta no está en la hoja Usuarios.' });
  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
  }

  const { interactionId = null, texto = '' } = req.body || {};
  if (!String(texto).trim()) return res.status(400).json({ error: 'Mensaje vacío.' });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const system_instruction = systemPrompt(user);
  const ctx = { propuestas: [] };
  const pedir = (input, previo) => ai.interactions.create({
    model: MODELO, input, system_instruction, tools: GEMINI_TOOLS,
    ...(previo ? { previous_interaction_id: previo } : {}),
  });

  try {
    let input = String(texto).slice(0, 4000);
    let it;
    try {
      it = await pedir(input, interactionId);
    } catch (err) {
      // El hilo guardado vence (1 día en el plan gratis): se sigue en uno nuevo.
      if (!interactionId || err?.status === 429) throw err;
      it = await pedir(input, null);
    }

    let respuesta = '';
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const llamadas = (it.steps || []).filter(s => s.type === 'function_call');
      if (!llamadas.length) {
        respuesta = (it.output_text || '').trim();
        if (it.status === 'failed' || (!respuesta && it.status !== 'completed')) {
          respuesta = 'No pude completar la respuesta. Prueba a reformular la pregunta.';
        }
        break;
      }
      const resultados = [];
      for (const c of llamadas) {
        let out;
        try { out = await ejecutar(c.name, c.arguments || {}, ctx); }
        catch (e) { console.error('[bot tool]', c.name, e); out = { error: `Error leyendo datos: ${e.message}` }; }
        resultados.push({ type: 'function_result', call_id: c.id, name: c.name, result: JSON.stringify(out), is_error: !!out?.error });
      }
      it = await pedir(resultados, it.id);
      if (vuelta === MAX_VUELTAS - 1) respuesta = 'Me tomó demasiados pasos. Prueba con una pregunta más concreta.';
    }
    return res.status(200).json({ interactionId: it.id, respuesta, propuestas: ctx.propuestas });
  } catch (err) {
    console.error('[bot]', err);
    return res.status(200).json({ error: mensajeError(err) });
  }
}
