'use strict';

const { buildStats } = require('../lib/core');
const { readAll, isConfigured } = require('../lib/store');
const { cors, authed } = require('../lib/api');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
  if (!isConfigured()) return res.status(503).json({ ok: false, error: 'Base de datos no configurada.' });

  try {
    const rsvps = await readAll('rsvp');
    return res.status(200).json({ ok: true, stats: buildStats(rsvps) });
  } catch (e) {
    console.error('Stats error:', e.message);
    return res.status(500).json({ ok: false, error: 'Error al leer los datos.' });
  }
};
