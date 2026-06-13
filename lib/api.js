'use strict';

/**
 * Ayudas comunes para las funciones serverless de Vercel (api/*).
 * CORS, autenticacion del panel y lectura del cuerpo JSON.
 */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  res.setHeader('Vary', 'Origin');
}

// El token llega por ?token=... (panel y export) o por la cabecera X-Admin-Token.
function authed(req) {
  const q = req.query || {};
  const token = q.token || req.headers['x-admin-token'] || '';
  const admin = process.env.ADMIN_TOKEN || '';
  return Boolean(token) && Boolean(admin) && token === admin;
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

module.exports = { cors, authed, getBody, clientIp };
