import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

/**
 * Entrada desde el portal Tesorería COFERSA: recibe el pase firmado (?t=) y abre la sesión
 * con el proveedor "portal" (sin Google, que no permite iniciar sesión dentro de otra página).
 */
export default function Acceso() {
  const [error, setError] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t');
    if (!t) { window.location.replace('/login'); return; }
    signIn('portal', { token: t, redirect: false }).then((r) => {
      if (r && r.ok && !r.error) window.location.replace('/');
      else setError('El pase del portal no es válido o venció. Vuelva a abrir Deuda global desde el portal.');
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f2942', color: '#fff', fontFamily: "'Inter', -apple-system, sans-serif", textAlign: 'center', padding: 24 }}>
      <div>
        <img src="/cofersa-logo.png" alt="Cofersa" style={{ height: 56, width: 'auto', marginBottom: 18, background: '#fff', borderRadius: 10, padding: '6px 10px' }} />
        <p style={{ fontSize: 18, margin: 0 }}>{error || 'Entrando a Deuda global…'}</p>
        {error && <p style={{ marginTop: 16 }}><a href="/login" style={{ color: '#85b7eb' }}>Entrar con Google</a></p>}
      </div>
    </div>
  );
}
