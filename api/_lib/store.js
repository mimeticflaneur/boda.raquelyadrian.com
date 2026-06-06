import { kv } from '@vercel/kv';

const PREFIX = 'sub:';

export async function pushSubmission(type, data) {
    const entry = {
        id: crypto.randomUUID(),
        type,
        submittedAt: new Date().toISOString(),
        ...data
    };
    await kv.lpush(`${PREFIX}${type}`, JSON.stringify(entry));
    return entry;
}

export async function listSubmissions(type) {
    const raw = (await kv.lrange(`${PREFIX}${type}`, 0, -1)) || [];
    return raw.map(r => (typeof r === 'string' ? JSON.parse(r) : r));
}
