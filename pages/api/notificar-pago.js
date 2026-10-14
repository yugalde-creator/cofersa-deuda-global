/**
 * Comprobantes de pago por correo (para el registro contable). Ver lib/comprobante.js.
 *   POST { pagoId }                    → envía el comprobante de ese pago (lo llama la app al registrar un pago)
 *   POST { pagoIds: [...] }            → envía varios
 *   GET  ?pendientes=AAAA-MM           → lista los pagos del mes sin comprobante enviado
 *   POST { pendientes: 'AAAA-MM' }     → envía todos los pendientes del mes
 * Requiere sesión de un usuario registrado en la hoja Usuarios. Siempre responde si el correo salió o no.
 */
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: 'Inicie sesión.' });
  const { getUserRecord } = require('../../lib/backend');
  if (!(await getUserRecord(email))) return res.status(403).json({ error: 'Su correo no está en la hoja Usuarios.' });

  const { enviarComprobantes, pendientesDelMes } = require('../../lib/comprobante');
  const MES = /^\d{4}-\d{2}$/;
  try {
    if (req.method === 'GET') {
      const mes = String(req.query.pendientes || '');
      if (!MES.test(mes)) return res.status(400).json({ error: 'Use ?pendientes=AAAA-MM' });
      return res.status(200).json({ mes, pendientes: await pendientesDelMes(mes) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};
    let ids = [];
    if (b.pendientes) {
      if (!MES.test(String(b.pendientes))) return res.status(400).json({ error: 'pendientes debe ser AAAA-MM' });
      ids = await pendientesDelMes(String(b.pendientes));
    } else if (Array.isArray(b.pagoIds)) ids = b.pagoIds.map(String);
    else if (b.pagoId) ids = [String(b.pagoId)];
    else return res.status(400).json({ error: 'Indique pagoId, pagoIds o pendientes.' });
    if (!ids.length) return res.status(200).json({ ok: true, enviados: 0, resultados: [], mensaje: 'No hay comprobantes pendientes.' });
    const r = await enviarComprobantes(ids);
    const enviados = r.resultados.filter((x) => x.ok).length;
    return res.status(200).json({ ok: enviados === ids.length, enviados, total: ids.length, para: r.para, resultados: r.resultados });
  } catch (err) {
    console.error('notificar-pago:', err);
    const msg = /Invalid login|BadCredentials|EAUTH/i.test(String(err.message))
      ? 'Gmail rechazó la contraseña de envío (EMAIL_PASS). Hay que generar una contraseña de aplicación nueva y ponerla en Vercel.'
      : err.message;
    return res.status(500).json({ ok: false, error: msg });
  }
}
