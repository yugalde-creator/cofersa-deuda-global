/**
 * GET /api/test-email
 * Prueba el envío de email — solo para diagnóstico, borrar después.
 */
export default async function handler(req, res) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    return res.json({ ok: false, error: 'Variables EMAIL_USER o EMAIL_PASS no están configuradas en Vercel.' });
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Cofersa Test" <${emailUser}>`,
      to: 'yugalde@cofersa.cr',
      subject: 'Prueba de email — Cofersa Deuda Global',
      text: 'Si recibes este mensaje, el sistema de email está funcionando correctamente.',
    });

    return res.json({ ok: true, message: 'Email enviado correctamente a yugalde@cofersa.cr', user: emailUser });
  } catch (e) {
    return res.json({ ok: false, error: e.message, code: e.code });
  }
}
