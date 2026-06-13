'use strict';

const { isConfigured } = require('../lib/store');
const { cors } = require('../lib/api');

module.exports = async (req, res) => {
  cors(res);
  return res.status(200).json({
    ok: true,
    db: isConfigured() ? 'ok' : 'sin-configurar',
    ts: new Date().toISOString()
  });
};
