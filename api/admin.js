'use strict';

const { renderAdmin, adminLogin } = require('../lib/core');
const { readAll, isConfigured } = require('../lib/store');
const { authed, adminConfigured, tokenOk, getBody, sessionCookie, clearCookie } = require('../lib/api');

// Panel de administracion.
//
// El acceso se hace por POST y la sesion queda en una cookie HttpOnly, de modo
// que el token no viaja en la URL (donde acababa en el historial, en los
// marcadores y en los registros del servidor). Los enlaces antiguos con
// ?token=... siguen funcionando: se canjean por la cookie y se limpia la URL.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const html = (code, cuerpo) => res.status(code).send(cuerpo);
  if (!['GET', 'POST'].includes(req.method)) return html(405, 'Método no permitido');

  // Sin ADMIN_TOKEN no puede entrar nadie: hay que decirlo en vez de devolver
  // el formulario una y otra vez sin explicacion.
  if (!adminConfigured()) {
    return html(503, adminLogin('sin-configurar'));
  }

  // Cerrar sesion.
  if (req.query && req.query.logout) {
    res.setHeader('Set-Cookie', clearCookie());
    return html(200, adminLogin());
  }

  // Entrar: formulario enviado por POST.
  if (req.method === 'POST') {
    const enviado = getBody(req).token || '';
    if (!tokenOk(enviado)) return html(401, adminLogin('incorrecto'));
    res.setHeader('Set-Cookie', sessionCookie(enviado, req));
    res.setHeader('Location', '/admin');
    return res.status(303).send('');
  }

  // Enlace antiguo con ?token=... : se canjea por cookie y se limpia la URL.
  if (req.query && req.query.token) {
    if (!tokenOk(req.query.token)) return html(401, adminLogin('incorrecto'));
    res.setHeader('Set-Cookie', sessionCookie(req.query.token, req));
    res.setHeader('Location', '/admin');
    return res.status(303).send('');
  }

  if (!authed(req)) return html(401, adminLogin());
  return panel(res);
};

async function panel(res) {
  if (!isConfigured()) {
    return res.status(503).send(
      '<p style="font-family:sans-serif;padding:2rem">Base de datos no configurada. ' +
      'Conecta Upstash Redis en la pestana Storage de Vercel y vuelve a desplegar.</p>');
  }
  try {
    const [rsvps, songs] = await Promise.all([readAll('rsvp'), readAll('canciones')]);
    rsvps.reverse();
    songs.reverse();
    return res.status(200).send(renderAdmin(rsvps, songs));
  } catch (e) {
    console.error('Admin error:', e.cause?.code || e.message);
    return res.status(503).send('<main style="font-family:sans-serif;max-width:640px;margin:12vh auto;padding:2rem"><h1>No podemos leer las confirmaciones</h1><p>El acceso al panel es correcto, pero la base de datos no está respondiendo. No es un error de tu token.</p><p>Comprueba la conexión de Upstash en Vercel. No se han modificado ni borrado respuestas.</p><a href="/admin">Volver a intentar</a> · <a href="/admin?logout=1">Cerrar sesión</a></main>');
  }
}
