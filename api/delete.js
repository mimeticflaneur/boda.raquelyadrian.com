'use strict';

const { deleteById, isConfigured } = require('../lib/store');
const { cors, authed, getBody } = require('../lib/api');

// Borrado de un registro desde el panel. Protegido con ADMIN_TOKEN.
// Body: { tipo: 'rsvp' | 'canciones', id }
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Metodo no permitido' });
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'No autorizado' });
  if (!isConfigured()) return res.status(503).json({ ok: false, error: 'Base de datos no configurada.' });

  const body = getBody(req);
  const tipo = body.tipo === 'canciones' ? 'canciones' : (body.tipo === 'rsvp' ? 'rsvp' : '');
  const id = String(body.id || '');
  if (!tipo || !id) return res.status(422).json({ ok: false, error: 'Faltan tipo o id.' });

  try {
    const done = await deleteById(tipo, id);
    if (!done) return res.status(404).json({ ok: false, error: 'Registro no encontrado.' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Delete error:', e.message);
    return res.status(500).json({ ok: false, error: 'No se pudo eliminar.' });
  }
};
