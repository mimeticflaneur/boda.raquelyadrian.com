'use strict';

const { applyRsvpEdit } = require('../lib/core');
const { readAll, updateById, isConfigured } = require('../lib/store');
const { cors, authed, getBody } = require('../lib/api');

// Edicion de una respuesta desde el panel. Protegido con ADMIN_TOKEN.
// Body: { tipo: 'rsvp', id, datos: {...campos editados...} }
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
  if (!isConfigured()) return res.status(503).json({ ok: false, error: 'Base de datos no configurada.' });

  const body = getBody(req);
  if (body.tipo !== 'rsvp') return res.status(422).json({ ok: false, error: 'Solo se pueden editar respuestas de RSVP.' });
  const id = String(body.id || '');
  if (!id) return res.status(422).json({ ok: false, error: 'Falta el id.' });

  try {
    const rows = await readAll('rsvp');
    const existing = rows.find(r => r.id === id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Registro no encontrado.' });

    const { rec, error } = applyRsvpEdit(existing, body.datos || {});
    if (error) return res.status(422).json({ ok: false, error });

    const done = await updateById('rsvp', id, rec);
    if (!done) return res.status(404).json({ ok: false, error: 'Registro no encontrado.' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Update error:', e.message);
    return res.status(500).json({ ok: false, error: 'No se pudo guardar.' });
  }
};
