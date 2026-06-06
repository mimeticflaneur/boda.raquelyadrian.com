# Setup en Vercel

Backend serverless para los formularios (RSVP, sugerir canción, libro de firmas) con almacenamiento en Vercel KV (Redis) y email vía Resend.

## 1. Conectar el repositorio

1. Crea cuenta en https://vercel.com
2. **Add New** → **Project** → importa este repo de GitHub
3. **Framework Preset**: `Other` · **Build Command**: vacío · **Output Directory**: vacío · **Install Command**: `npm install`
4. **Deploy** (la primera vez fallará algún endpoint si no has configurado KV — es esperado)

## 2. Provisionar Vercel KV

1. En el dashboard del proyecto → **Storage** → **Create Database** → **KV**
2. Nombre: `boda-kv` · Region: la más cercana (Madrid `cdg1` o Frankfurt `fra1`)
3. **Connect** al proyecto en `Production`, `Preview` y `Development`
4. Las env vars `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` se inyectan solas

## 3. Configurar Resend (email)

1. Crea cuenta en https://resend.com (gratis, 3000 emails/mes con dominio propio)
2. **Domains** → **Add Domain** → `raquelyadrian.com` (o tu dominio)
3. Añade los registros DNS que te muestra (DKIM/SPF) en tu registrar
4. Espera a que se valide (~5–30 min)
5. **API Keys** → **Create** → permisos `Sending access` → copia la key

## 4. Variables de entorno en Vercel

En **Settings** → **Environment Variables**, añade en `Production`, `Preview` y `Development`:

| Variable | Ejemplo |
|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxx` |
| `NOTIFY_FROM` | `Boda R&A <noreply@raquelyadrian.com>` |
| `NOTIFY_TO` | `adrian@…,raquel@…` (separados por coma) |
| `ADMIN_USER` | usuario para el panel |
| `ADMIN_PASS` | contraseña larga aleatoria |

## 5. Redeploy

Cualquier cambio de env vars requiere redeploy. **Deployments** → la última → **⋯** → **Redeploy**.

## 6. Verificar

- `https://tudominio.com/` → la web pública
- `https://tudominio.com/admin` → pide usuario/contraseña → panel con stats, tablas y exportación CSV
- Rellena un RSVP de prueba y confirma que:
  - Llega un email a `NOTIFY_TO`
  - Aparece en `/admin`

## 7. Dominio propio

**Settings** → **Domains** → añade `raquelyadrian.com`. Sigue las instrucciones DNS (A/CNAME).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/rsvp` | Confirmación de asistencia (público) |
| POST | `/api/song` | Sugerencia de canción (público) |
| POST | `/api/guestbook` | Firma del libro (público) |
| GET | `/api/admin/list` | JSON con todos los envíos (Basic Auth) |
| GET | `/api/admin/export?type=rsvp\|song\|guestbook` | Descarga CSV (Basic Auth) |
| GET | `/admin` | Panel HTML (Basic Auth) |

## Costes

- **Vercel Hobby**: gratis. Incluye 100k function invocations/mes, deploys ilimitados.
- **Vercel KV**: gratis hasta 30k comandos/mes (cada submission ≈ 2 comandos, sobra).
- **Resend**: gratis 3000 emails/mes con dominio verificado.
- **Total**: 0 €/mes para una boda.

## Migración desde Formspree

Las `action` URLs del formulario ya apuntan a `/api/*`. Cuando se despliegue en Vercel, los formularios usarán este backend automáticamente. Formspree queda obsoleto.

## Rate limit y antispam

- Honeypot: campo oculto `website` — si se rellena, la submission se descarta silenciosamente.
- Rate limit por IP en Vercel KV (5 RSVPs / 10 canciones / 10 firmas por 10 min por IP).
