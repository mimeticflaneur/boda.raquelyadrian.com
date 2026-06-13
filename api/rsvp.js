'use strict';

const { normalizeRsvp, clean } = require('../lib/core');
const { append, isConfigured } = require('../lib/store');
const { cors, getBody, clientIp } = require('../lib/api');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Metodo no permitido' });

  const data = getBody(req);

  // Honeypot anti-bots: si el campo trampa viene relleno, fingimos exito.
  if (clean(data.website, 100)) return res.status(200).json({ ok: true });

  const { rec, error } = normalizeRsvp(data);
  if (error) return res.status(422).json({ ok: false, error });

  if (!isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Base de datos no configurada. Conecta Upstash Redis en Vercel.' });
  }

  rec.ip = clientIp(req);
  rec.ua = clean(req.headers['user-agent'], 200);
  try {
    await append('rsvp', rec);
  } catch (e) {
    console.error('RSVP append error:', e.message);
    return res.status(500).json({ ok: false, error: 'No se pudo guardar. Intentalo de nuevo.' });
  }
  return res.status(200).json({ ok: true, id: rec.id });
};
