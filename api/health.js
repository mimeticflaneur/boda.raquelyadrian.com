'use strict';

const { isConfigured, ping } = require('../lib/store');
const { cors } = require('../lib/api');

module.exports = async (req, res) => {
  cors(res);
  if (!isConfigured()) return res.status(503).json({ ok: false, db: 'sin-configurar' });
  try {
    await ping();
    return res.status(200).json({ ok: true, db: 'ok', ts: new Date().toISOString() });
  } catch (e) {
    console.error('Health DB:', e.cause?.code || e.message);
    return res.status(503).json({ ok: false, db: 'no-disponible' });
  }
};
