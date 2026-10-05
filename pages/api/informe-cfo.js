/**
 * GET /api/informe-cfo[?anio=2026&mes=9]
 * Descarga el informe mensual de deuda para el CFO (Excel). Requiere sesión de un usuario registrado.
 */
import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]';
import { getUserRecord } from '../../lib/backend';
import { generarInformeCfoXlsx } from '../../lib/informeCfoXlsx';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.email) return res.status(401).json({ error: 'No autenticado' });
  const user = await getUserRecord(session.user.email);
  if (!user) return res.status(403).json({ error: 'Usuario no autorizado' });

  try {
    const anio = parseInt(req.query.anio, 10) || undefined;
    const mes = parseInt(req.query.mes, 10) || undefined;
    const { buffer, filename } = await generarInformeCfoXlsx(anio, mes);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('informe-cfo:', e);
    return res.status(500).json({ error: e.message });
  }
}
