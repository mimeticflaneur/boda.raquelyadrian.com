import { Resend } from 'resend';

export async function notify(subject, text) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_FROM;
    const to = process.env.NOTIFY_TO;
    if (!apiKey || !from || !to) return;
    try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
            from,
            to: to.split(',').map(s => s.trim()).filter(Boolean),
            subject,
            text
        });
    } catch (e) {
        console.error('Resend error:', e);
    }
}
