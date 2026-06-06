import { pushSubmission } from './_lib/store.js';
import { notify } from './_lib/email.js';
import { rateLimit, getIp } from './_lib/ratelimit.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ip = getIp(req);
    if (!(await rateLimit(ip, 'rsvp', 5, 600))) {
        return res.status(429).json({ error: 'Demasiados envíos. Espera unos minutos.' });
    }

    const body = req.body || {};
    if (body.website) return res.status(200).json({ ok: true }); // honeypot

    const asistencia = String(body.asistencia || '').trim();
    const nombre = String(body.nombre || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().slice(0, 120);

    if (!['si', 'solo_ceremonia', 'no'].includes(asistencia)) {
        return res.status(400).json({ error: 'Asistencia inválida' });
    }
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (asistencia !== 'no' && !email) return res.status(400).json({ error: 'Email requerido' });

    const data = {
        asistencia,
        nombre,
        email,
        telefono: String(body.telefono || '').slice(0, 30),
        mi_menu: String(body.mi_menu || '').slice(0, 20),
        alergias: String(body.alergias || '').slice(0, 500),
        autobus: String(body.autobus || '').slice(0, 5),
        acompanantes: []
    };

    for (let i = 1; i <= 5; i++) {
        const name = body[`acompanante_${i}_nombre`];
        if (name) {
            data.acompanantes.push({
                nombre: String(name).slice(0, 120),
                menu: String(body[`acompanante_${i}_menu`] || '').slice(0, 20)
            });
        }
    }

    const entry = await pushSubmission('rsvp', data);

    const lines = [
        `${nombre} ha respondido: ${asistencia.toUpperCase()}`,
        `Email: ${email || '—'}`,
        data.telefono ? `Teléfono: ${data.telefono}` : null,
        asistencia === 'si' ? `Menú: ${data.mi_menu || '—'}` : null,
        asistencia === 'si' && data.alergias ? `Alergias: ${data.alergias}` : null,
        asistencia === 'si' ? `Autobús: ${data.autobus || '—'}` : null,
        data.acompanantes.length
            ? `Acompañantes:\n${data.acompanantes.map((a, i) => `  ${i + 1}. ${a.nombre} (${a.menu || 'sin menú'})`).join('\n')}`
            : null
    ].filter(Boolean);

    await notify(`RSVP · ${nombre} — ${asistencia}`, lines.join('\n'));

    return res.status(200).json({ ok: true, id: entry.id });
}
