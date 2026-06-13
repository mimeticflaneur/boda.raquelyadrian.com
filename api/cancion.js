'use strict';

const { normalizeSong, clean } = require('../lib/core');
const { append, isConfigured } = require('../lib/store');
const { cors, getBody } = require('../lib/api');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Metodo no permitido' });

  const data = getBody(req);

  // Honeypot anti-bots.
  if (clean(data.website, 100)) return res.status(200).json({ ok: true });

  const { rec, error } = normalizeSong(data);
  if (error) return res.status(422).json({ ok: false, error });

  if (!isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Base de datos no configurada. Conecta Upstash Redis en Vercel.' });
  }

  try {
    await append('canciones', rec);
  } catch (e) {
    console.error('Cancion append error:', e.message);
    return res.status(500).json({ ok: false, error: 'No se pudo guardar. Intentalo de nuevo.' });
  }
  return res.status(200).json({ ok: true });
};
