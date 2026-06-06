import { listSubmissions } from '../_lib/store.js';

const VALID = new Set(['rsvp', 'song', 'guestbook']);

export default async function handler(req, res) {
    const type = String(req.query.type || 'rsvp');
    if (!VALID.has(type)) return res.status(400).json({ error: 'Tipo inválido' });

    const list = await listSubmissions(type);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`);

    if (!list.length) return res.status(200).send('Sin datos\n');

    const cols = new Set(['id', 'submittedAt']);
    list.forEach(item => Object.keys(item).forEach(k => cols.add(k)));
    cols.delete('type');
    const headers = Array.from(cols);

    const esc = v => {
        if (v == null) return '';
        if (typeof v === 'object') v = JSON.stringify(v);
        v = String(v);
        return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };

    const rows = [headers.join(',')];
    list.forEach(item => rows.push(headers.map(k => esc(item[k])).join(',')));
    return res.status(200).send('﻿' + rows.join('\r\n')); // BOM for Excel
}
