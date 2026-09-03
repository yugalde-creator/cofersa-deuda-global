/**
 * Endpoint unificado que maneja todas las acciones del servidor.
 * POST /api/action  body: { action: 'crearLinea', args: [...] }
 */
import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]';
import {
  getBootstrapData,
  crearLinea,
  registrarPago,
  cargaMasivaCuotas,
  reemplazarPlanPagos,
  archivarLinea,
  importarActivas,
  importarCanceladas,
  importarPagos,
  crearLeasing,
  importarLeasing,
  registrarPagoLeasing,
  crearUsuario,
  editarLinea,
  eliminarPago,
  editarUsuario,
  getUsuarioRecord,
} from '../../lib/backend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get authenticated user email
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const email = session.user.email;

  const { action, args = [] } = req.body;

  try {
    let result;
    switch (action) {
      case 'getBootstrapData':
        result = await getBootstrapData(email);
        break;
      case 'crearLinea':
        result = await crearLinea(email, args[0]);
        break;
      case 'registrarPago':
        result = await registrarPago(email, args[0]);
        break;
      case 'cargaMasivaCuotas':
        result = await cargaMasivaCuotas(email, args[0], args[1]);
        break;
      case 'reemplazarPlanPagos':
        result = await reemplazarPlanPagos(email, args[0], args[1]);
        break;
      case 'archivarLinea':
        result = await archivarLinea(email, args[0]);
        break;
      case 'importarActivas':
        result = await importarActivas(email, args[0]);
        break;
      case 'importarCanceladas':
        result = await importarCanceladas(email, args[0]);
        break;
      case 'importarPagos':
        result = await importarPagos(email, args[0]);
        break;
      case 'crearLeasing':
        result = await crearLeasing(email, args[0]);
        break;
      case 'importarLeasing':
        result = await importarLeasing(email, args[0], args[1]);
        break;
      case 'registrarPagoLeasing':
        result = await registrarPagoLeasing(email, args[0]);
        break;
      case 'crearUsuario':
        result = await crearUsuario(email, args[0]);
        break;
      case 'editarLinea':
        result = await editarLinea(email, args[0], args[1]);
        break;
      case 'eliminarPago':
        result = await eliminarPago(email, args[0]);
        break;
      case 'editarUsuario':
        result = await editarUsuario(email, args[0], args[1]);
        break;
      default:
        return res.status(400).json({ error: `Acción desconocida: ${action}` });
    }
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error(`[action:${action}]`, err);
    return res.status(200).json({ success: false, error: err.message || 'Error en el servidor' });
  }
}
