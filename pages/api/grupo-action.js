/**
 * Endpoint del módulo "Grupo" (Febeca/Beval/Sillaca/FQ) — hoja separada de
 * la de Cofersa (Matriz - Deuda Financiera 25-26, pestaña MAESTRO_PRESTAMOS).
 * Por ahora solo lectura. POST /api/grupo-action  body: { action, args }
 */
import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]';
import { getGrupoBootstrapData } from '../../lib/backendGrupo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { action } = req.body;

  try {
    let result;
    switch (action) {
      case 'getGrupoBootstrapData':
        result = await getGrupoBootstrapData();
        break;
      default:
        return res.status(400).json({ error: `Acción desconocida: ${action}` });
    }
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error(`[grupo-action:${action}]`, err);
    return res.status(200).json({ success: false, error: err.message || 'Error en el servidor' });
  }
}
