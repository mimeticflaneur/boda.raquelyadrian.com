import { kv } from '@vercel/kv';

export async function rateLimit(ip, scope, max = 5, windowSeconds = 600) {
    const key = `rl:${scope}:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSeconds);
    return count <= max;
}

export function getIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}
