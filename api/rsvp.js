'use strict';

const { normalizeRsvp, clean } = require('../lib/core');
const { appendOnce, isConfigured, overLimit } = require('../lib/store');
const { cors, getBody, clientIp } = require('../lib/api');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Metodo no permitido' });

  const data = getBody(req);

  // Honeypot anti-bots: si el campo trampa viene relleno, fingimos exito.
  if (clean(data.website, 100)) return res.status(200).json({ ok: true });

  const { rec, error } = normalizeRsvp(data, { strict: true });
  if (error) return res.status(422).json({ ok: false, error });
  if (data.request_id && (typeof data.request_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.request_id))) {
    return res.status(422).json({ ok: false, error: 'Identificador de envío inválido. Recarga la página.' });
  }

  if (!isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Base de datos no configurada. Conecta Upstash Redis en Vercel.' });
  }

  rec.ip = clientIp(req);
  rec.ua = clean(req.headers['user-agent'], 200);

  // Tope generoso: una familia entera desde el mismo wifi cabe de sobra.
  if (await overLimit('rsvp', rec.ip, 20, 3600)) {
    return res.status(429).json({ ok: false, error: 'Has enviado muchas confirmaciones seguidas. Prueba otra vez dentro de un rato.' });
  }

  try {
    const id = await appendOnce('rsvp', rec, data.request_id);
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error('RSVP append error:', e.cause?.code || e.message);
    return res.status(e.status || 503).json({ ok: false, error: e.status === 409 ? e.message : 'No hemos podido confirmar el guardado. Tus datos siguen en el formulario; espera un momento y vuelve a enviar.' });
  }
};
