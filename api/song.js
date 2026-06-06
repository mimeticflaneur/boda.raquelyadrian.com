import { pushSubmission } from './_lib/store.js';
import { notify } from './_lib/email.js';
import { rateLimit, getIp } from './_lib/ratelimit.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ip = getIp(req);
    if (!(await rateLimit(ip, 'song', 10, 600))) {
        return res.status(429).json({ error: 'Demasiados envíos.' });
    }

    const body = req.body || {};
    if (body.website) return res.status(200).json({ ok: true });

    const cancion = String(body.cancion || '').trim().slice(0, 200);
    const artista = String(body.artista || '').trim().slice(0, 200);
    const nombre = String(body.nombre || '').trim().slice(0, 120);

    if (!cancion) return res.status(400).json({ error: 'Canción requerida' });

    const entry = await pushSubmission('song', { cancion, artista, nombre });
    await notify(
        `Canción sugerida: ${cancion}`,
        `${cancion}${artista ? ` — ${artista}` : ''}\nSugerida por: ${nombre || 'anónimo'}`
    );
    return res.status(200).json({ ok: true, id: entry.id });
}
