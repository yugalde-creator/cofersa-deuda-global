/**
 * GET /api/test-email — diagnóstico: confirma que el permiso de envío de correo es válido.
 * No envía ningún correo.
 */
export default async function handler(req, res) {
  try {
    const t = require('../../lib/correo').crearTransporte();
    await t.verify();
    return res.json({ ok: true, via: process.env.GMAIL_REFRESH_TOKEN ? 'Gmail API (permiso enviar)' : 'SMTP' });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
}
