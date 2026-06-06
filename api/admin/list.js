import { listSubmissions } from '../_lib/store.js';

export default async function handler(req, res) {
    const [rsvp, song, guestbook] = await Promise.all([
        listSubmissions('rsvp'),
        listSubmissions('song'),
        listSubmissions('guestbook')
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ rsvp, song, guestbook });
}
