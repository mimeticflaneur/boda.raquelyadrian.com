import { pushSubmission } from './_lib/store.js';
import { notify } from './_lib/email.js';
import { rateLimit, getIp } from './_lib/ratelimit.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ip = getIp(req);
    if (!(await rateLimit(ip, 'guestbook', 10, 600))) {
        return res.status(429).json({ error: 'Demasiados envíos.' });
    }

    const body = req.body || {};
    if (body.website) return res.status(200).json({ ok: true });

    const mensaje = String(body.mensaje || '').trim().slice(0, 2000);
    const nombre = String(body.nombre || '').trim().slice(0, 120);

    if (!mensaje || !nombre) return res.status(400).json({ error: 'Mensaje y nombre requeridos' });

    const entry = await pushSubmission('guestbook', { mensaje, nombre });
    await notify(`Libro de firmas · ${nombre}`, `${nombre} ha firmado:\n\n"${mensaje}"`);
    return res.status(200).json({ ok: true, id: entry.id });
}
