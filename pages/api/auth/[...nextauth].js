import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Pase firmado por el portal Tesorería COFERSA (PORTAL_SSO_SECRET, prefijo "portal|"):
 * { c: correo, x: vencimiento ms, n: destino }. Vence en minutos; solo entra quien
 * esté en la hoja Usuarios (los permisos los sigue decidiendo esa hoja).
 */
function leerPase(token) {
  const secreto = process.env.PORTAL_SSO_SECRET;
  const [p, f] = String(token || '').split('.');
  if (!secreto || !p || !f) return null;
  const esperada = createHmac('sha256', secreto).update(`portal|${p}`).digest('base64url');
  if (esperada.length !== f.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(f))) return null;
  try {
    const o = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    return o.c && o.x && o.x > Date.now() ? String(o.c).toLowerCase() : null;
  } catch {
    return null;
  }
}

// La app se muestra dentro del portal (iframe de otro dominio): con SameSite=Lax el navegador
// no enviaría la sesión. Quién puede mostrarla lo limita frame-ancestors en next.config.mjs.
const prod = process.env.NODE_ENV === 'production';
const pre = prod ? '__Secure-' : '';
const opc = { httpOnly: true, sameSite: prod ? 'none' : 'lax', path: '/', secure: prod };

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      id: 'portal',
      name: 'Portal Tesorería COFERSA',
      credentials: { token: { type: 'text' } },
      async authorize(c) {
        const correo = leerPase(c?.token);
        if (!correo) return null;
        const { getUserRecord } = await import('../../../lib/backend');
        const u = await getUserRecord(correo);
        return u ? { id: correo, email: correo, name: u.nombre || correo } : null;
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  cookies: {
    sessionToken: { name: `${pre}next-auth.session-token`, options: opc },
    callbackUrl: { name: `${pre}next-auth.callback-url`, options: opc },
    csrfToken: { name: `${prod ? '__Host-' : ''}next-auth.csrf-token`, options: opc },
    pkceCodeVerifier: { name: `${pre}next-auth.pkce.code_verifier`, options: { ...opc, maxAge: 900 } },
    state: { name: `${pre}next-auth.state`, options: { ...opc, maxAge: 900 } },
    nonce: { name: `${pre}next-auth.nonce`, options: opc },
  },
  callbacks: {
    async session({ session, token }) {
      // Make email available in session
      session.user.email = token.email;
      return session;
    },
    async jwt({ token, account }) {
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
};

export default NextAuth(authOptions);
