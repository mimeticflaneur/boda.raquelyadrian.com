'use strict';

const { rsvpCsv, songsCsv } = require('../lib/core');
const { readAll, isConfigured } = require('../lib/store');
const { authed } = require('../lib/api');

// Descarga CSV. El tipo llega por ?type=rsvp|canciones (lo fija vercel.json
// mediante las rutas /export/rsvp.csv y /export/canciones.csv).
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!authed(req)) return res.status(401).send('No autorizado');
  if (!isConfigured()) return res.status(503).send('Base de datos no configurada.');

  const type = (req.query && req.query.type) === 'canciones' ? 'canciones' : 'rsvp';
  try {
    const rows = await readAll(type);
    const csv = type === 'canciones' ? songsCsv(rows) : rsvpCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    return res.status(200).send(csv);
  } catch (e) {
    console.error('Export error:', e.message);
    return res.status(500).send('Error al generar el CSV.');
  }
};
