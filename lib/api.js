'use strict';

/**
 * Ayudas comunes para las funciones serverless de Vercel (api/*).
 * CORS, autenticacion del panel y lectura del cuerpo JSON.
 */

const crypto = require('crypto');

function cors(res) {
  res.setHeader('Cache-Control', 'no-store');
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
  const payload = `v1.${Math.floor(Date.now() / 1000) + 604800}.${crypto.randomBytes(16).toString('hex')}`;
  const signature = crypto.createHmac('sha256', token).update(payload).digest('hex');
  return `${COOKIE}=${payload}.${signature}; Path=/; HttpOnly;${seguro} SameSite=Strict; Max-Age=604800`;
}

function sessionOk(value) {
  if (!adminConfigured() || typeof value !== 'string') return false;
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !/^\d+$/.test(parts[1]) || !/^[a-f0-9]{32}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
  const expires = Number(parts[1]);
  if (expires <= Date.now() / 1000 || expires > Date.now() / 1000 + 604801) return false;
  const signature = crypto.createHmac('sha256', process.env.ADMIN_TOKEN).update(parts.slice(0, 3).join('.')).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(parts[3]));
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

// Sesión por cookie o cabecera para scripts. Solo /admin canjea los enlaces
// antiguos con token: las API y exportaciones nunca lo aceptan en la URL.
function authed(req) {
  const cookie = readCookie(req, COOKIE);
  // Compatibilidad con sesiones anteriores; los nuevos accesos usan firma
  // temporal y no guardan la contraseña en la cookie.
  return sessionOk(cookie) || tokenOk(cookie) ||
         tokenOk(req.headers && req.headers['x-admin-token']);
}

// Vercel ya parsea el cuerpo JSON en req.body; reforzamos por si llega string.
function getBody(req) {
  let d = req.body;
  if (Buffer.isBuffer(d)) d = d.toString('utf8');
  if (typeof d === 'string') {
    if ((req.headers?.['content-type'] || '').split(';')[0].trim() === 'application/x-www-form-urlencoded') {
      d = Object.fromEntries(new URLSearchParams(d));
    } else {
      try { d = JSON.parse(d); } catch { d = {}; }
    }
  }
  return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress || '';
}

module.exports = {
  cors, authed, getBody, clientIp,
  adminConfigured, tokenOk, readCookie, sessionCookie, sessionOk, clearCookie, COOKIE
};
