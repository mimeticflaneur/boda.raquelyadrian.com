export const config = {
    matcher: ['/admin', '/admin.html', '/api/admin/:path*']
};

export default function middleware(request) {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASS;

    if (!user || !pass) {
        return new Response(
            'ADMIN_USER y ADMIN_PASS no configurados en Vercel.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        );
    }

    const expected = 'Basic ' + btoa(`${user}:${pass}`);
    const got = request.headers.get('authorization') || '';

    if (got !== expected) {
        return new Response('Auth requerida', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Boda Admin", charset="UTF-8"',
                'Content-Type': 'text/plain; charset=utf-8'
            }
        });
    }
}
