'use strict';

const { renderAdmin, adminLogin } = require('../lib/core');
const { readAll, isConfigured } = require('../lib/store');
const { authed } = require('../lib/api');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!authed(req)) {
    return res.status(401).send(adminLogin());
  }
  if (!isConfigured()) {
    return res.status(503).send('<p style="font-family:sans-serif;padding:2rem">Base de datos no configurada. Conecta Upstash Redis en la pestana Storage de Vercel y vuelve a desplegar.</p>');
  }

  try {
    const [rsvps, songs] = await Promise.all([readAll('rsvp'), readAll('canciones')]);
    rsvps.reverse();
    songs.reverse();
    const token = (req.query && req.query.token) || '';
    return res.status(200).send(renderAdmin(rsvps, songs, token));
  } catch (e) {
    console.error('Admin error:', e.message);
    return res.status(500).send('<p style="font-family:sans-serif;padding:2rem">Error al leer los datos.</p>');
  }
};
