/**
 * Envío de correo de Deuda global.
 * Preferido: Gmail API con permiso "enviar" (gmail.send) de la cuenta del usuario
 * (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN). Respaldo: contraseña de aplicación
 * (EMAIL_USER / EMAIL_PASS) por SMTP. Misma interfaz que nodemailer: { verify(), sendMail(opts) }.
 */
const nodemailer = require('nodemailer');

function crearTransporte() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, EMAIL_USER, EMAIL_PASS } = process.env;
  if (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
    const { google } = require('googleapis');
    const MailComposer = require('nodemailer/lib/mail-composer');
    const auth = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth });
    const remitente = EMAIL_USER || 'yugalde@cofersa.cr';
    return {
      async verify() { await auth.getAccessToken(); return true; },
      async sendMail(opts) {
        const mime = await new MailComposer({ from: remitente, ...opts }).compile().build();
        const raw = Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const r = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
        return { messageId: r.data.id };
      },
    };
  }
  if (!EMAIL_USER || !EMAIL_PASS) throw new Error('No hay credenciales de correo (GMAIL_* o EMAIL_USER/EMAIL_PASS).');
  return nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS } });
}

module.exports = { crearTransporte };
