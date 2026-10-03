'use strict';

const { timingSafeEqual } = require('crypto');
const { readAll } = require('../lib/store');

// Lectura diaria real: comprueba que ambas listas siguen siendo accesibles y
// legibles también cuando pasan varios días sin nuevas confirmaciones.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  const provided = Buffer.from(req.headers.authorization || '');
  if (!secret || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return res.status(401).json({ ok: false });
  }
  try {
    const [rsvps, songs] = await Promise.all([readAll('rsvp'), readAll('canciones')]);
    return res.status(200).json({ ok: true, responses: rsvps.length, songs: songs.length, ts: new Date().toISOString() });
  } catch (error) {
    console.error('Comprobación de ingesta:', error.cause?.code || error.message);
    return res.status(503).json({ ok: false, db: 'no-disponible' });
  }
};
