/**
 * Plan de pagos del banco adjunto a cada operación (Vercel Blob privado).
 * El archivo se guarda como planes/{N° de operación}, así no depende de ninguna columna del Sheet.
 *   GET  /api/plan-pdf?list=1        → { ops: ['10026846', ...] }
 *   GET  /api/plan-pdf?op=10026846   → el archivo (PDF/TXT del banco), en línea
 *   POST /api/plan-pdf?op=10026846   → cuerpo = archivo (máx. 4 MB). Solo Admin.
 */
import { put, get, list } from '@vercel/blob';
import { getServerSession } from 'next-auth/next';
import authOptions from './auth/[...nextauth]';
import { getUserRecord } from '../../lib/backend';

export const config = { api: { bodyParser: false } };
const MAX_BYTES = 4 * 1024 * 1024;
const opLimpio = s => String(s || '').replace(/[^0-9A-Za-z-]/g, '').slice(0, 40);

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
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: 'No autenticado' });
  const user = await getUserRecord(email);
  if (!user) return res.status(403).json({ error: 'Tu cuenta no está en la hoja Usuarios.' });

  try {
    if (req.method === 'GET' && req.query.list) {
      const ops = [];
      let cursor;
      do {
        const r = await list({ prefix: 'planes/', cursor, limit: 1000 });
        r.blobs.forEach(b => ops.push(b.pathname.slice('planes/'.length)));
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return res.status(200).json({ ops });
    }

    const op = opLimpio(req.query.op);
    if (!op) return res.status(400).json({ error: 'Falta el número de operación.' });

    if (req.method === 'GET') {
      const r = await get(`planes/${op}`, { access: 'private' });
      if (!r || r.statusCode !== 200) return res.status(404).send('Esta operación no tiene plan de pagos adjunto.');
      res.setHeader('Content-Type', r.blob.contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="plan-${op}${/pdf/.test(r.blob.contentType || '') ? '.pdf' : ''}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      const reader = r.stream.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
      return res.end();
    }

    if (req.method === 'POST') {
      if (user.rol !== 'Admin') return res.status(403).json({ error: 'Acción bloqueada: tu rol "Consulta" es de solo lectura.' });
      const cuerpo = await leerCuerpo(req);
      if (!cuerpo.length) return res.status(400).json({ error: 'Archivo vacío.' });
      const blob = await put(`planes/${op}`, cuerpo, {
        access: 'private', addRandomSuffix: false, allowOverwrite: true,
        contentType: req.headers['content-type'] || 'application/pdf',
      });
      return res.status(200).json({ ok: true, op, size: cuerpo.length, pathname: blob.pathname });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[plan-pdf]', err);
    return res.status(err.status || 500).json({ error: err.message || 'Error con el archivo.' });
  }
}
