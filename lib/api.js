'use strict';

/**
 * Ayudas comunes para las funciones serverless de Vercel (api/*).
 * CORS, autenticacion del panel y lectura del cuerpo JSON.
 */

const crypto = require('crypto');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  res.setHeader('Vary', 'Origin');
}

// ¿Hay token de administracion configurado en el entorno? Si no lo hay, el
// panel es inaccesible y hay que DECIRLO, no dejar al usuario en un bucle de
// login que nunca entra.
function adminConfigured() {
  return Boolean(process.env.ADMIN_TOKEN);
}

// Comparacion en tiempo constante, para no filtrar el token caracter a caracter.
function tokenOk(token) {
  const admin = process.env.ADMIN_TOKEN || '';
  if (!token || !admin) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(admin);
  if (a.length !== b.length) {
    // Igualamos longitudes para que el tiempo no delate el tamano del token.
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// Lee una cookie del encabezado Cookie.
function readCookie(req, name) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return '';
  for (const trozo of String(raw).split(';')) {
    const i = trozo.indexOf('=');
    if (i < 0) continue;
    if (trozo.slice(0, i).trim() === name) {
      try { return decodeURIComponent(trozo.slice(i + 1).trim()); } catch { return ''; }
    }
  }
  return '';
}

// La sesion del panel viaja en una cookie HttpOnly: asi el token deja de ir en
// la URL (historial, marcadores, registros del servidor) y el navegador la
// manda sola en cada peticion, incluidas las descargas de CSV.
const COOKIE = 'boda_admin';

function sessionCookie(token, req) {
  const seguro = (req.headers && req.headers['x-forwarded-proto'] === 'https') ? ' Secure;' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly;${seguro} SameSite=Strict; Max-Age=604800`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

// El token vale por cookie de sesion, por cabecera (para scripts) o por
// ?token=... (enlaces antiguos, que el panel convierte en cookie y limpia).
function authed(req) {
  const q = req.query || {};
  return tokenOk(readCookie(req, COOKIE)) ||
         tokenOk(req.headers && req.headers['x-admin-token']) ||
         tokenOk(q.token);
}

// Vercel ya parsea el cuerpo JSON en req.body; reforzamos por si llega string.
function getBody(req) {
  let d = req.body;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { d = {}; }
  }
  return (d && typeof d === 'object') ? d : {};
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress || '';
}

module.exports = {
  cors, authed, getBody, clientIp,
  adminConfigured, tokenOk, readCookie, sessionCookie, clearCookie, COOKIE
};
