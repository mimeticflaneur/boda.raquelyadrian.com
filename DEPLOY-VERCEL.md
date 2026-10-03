# Desplegar la web + backend en Vercel (gratis)

Esta guía deja la web **y** el formulario funcionando de verdad en Vercel, con
los datos guardados en una base de datos **Upstash Redis** (gratuita y
persistente). Todo en el mismo sitio, sin Formspree y sin servidores que
mantener.

> ¿Por qué una base de datos y no un fichero? Vercel es *serverless*: no tiene
> disco permanente, así que un fichero se borraría. Upstash Redis guarda los
> datos de forma persistente. Sigues pudiendo exportarlo todo a CSV cuando
> quieras desde el panel `/admin`.

Tardarás unos **10 minutos**. No hace falta saber programar.

---

## Paso 1 · Crear la cuenta de Vercel

1. Entra en <https://vercel.com> y regístrate con tu cuenta de **GitHub**
   (botón «Continue with GitHub»). Es gratis.

## Paso 2 · Importar el proyecto

1. En Vercel: **Add New… → Project**.
2. Busca el repositorio `boda.raquelyadrian.com` y pulsa **Import**.
3. No cambies nada de la configuración (Vercel detecta solo la web estática y
   las funciones de la carpeta `api/`). Pulsa **Deploy**.
4. Espera a que termine. Tendrás una URL tipo `https://boda-xxxx.vercel.app`.
   La web ya se ve, pero el formulario aún no guarda: falta la base de datos.

## Paso 3 · Conectar la base de datos (Upstash Redis)

1. Abre tu proyecto en Vercel → pestaña **Storage**.
2. **Create Database** → elige **Upstash** → **Redis** → **Continue**.
3. Ponle un nombre (lo que quieras), región cercana (p. ej. *Frankfurt*), plan
   **Free**, y **Create**.
4. Cuando pregunte, **conéctala a este proyecto** (Connect Project).
   Esto añade solas las variables `UPSTASH_REDIS_REST_URL` y
   `UPSTASH_REDIS_REST_TOKEN`. No tienes que copiar nada a mano.

## Paso 4 · Poner tu contraseña de administración

1. Proyecto → **Settings → Environment Variables**.
2. Añade una variable:
   - **Name**: `ADMIN_TOKEN`
   - **Value**: una contraseña larga e inventada (p. ej. `boda-RA-2027-x7Qm…`).
   - Marca los tres entornos (Production, Preview, Development) y **Save**.
3. (Opcional) Si en el futuro sirves la web desde otro dominio distinto al de
   la API, añade también `ALLOW_ORIGIN` con la URL de la web.

## Paso 5 · Volver a desplegar

1. Proyecto → pestaña **Deployments** → en el último, menú **···** → **Redeploy**.
   (Hace falta para que el sitio coja la base de datos y el token nuevos.)

## Paso 6 · Probar

1. Abre tu URL `https://boda-xxxx.vercel.app` y rellena una confirmación de
   prueba.
2. Entra en el panel:
   `https://boda-xxxx.vercel.app/admin` e introduce el token en el formulario de acceso
   Deberías ver tu prueba, el resumen de comensales y los botones para
   descargar en CSV.
3. Comprueba la salud en `…/api/health` (debe responder HTTP 200 con `"ok":true` y `"db":"ok"`). Esta comprobación envía un PING real a Redis; si falla responde 503.

¡Listo! Cada confirmación queda guardada en tu base de datos.

---

## Tu dominio propio (raquelyadrian.com)

1. Proyecto → **Settings → Domains** → añade `raquelyadrian.com` (y
   `www.raquelyadrian.com`).
2. Vercel te dirá qué registros DNS poner en tu proveedor del dominio.
3. Importante: si antes servías la web con **GitHub Pages**, deja el dominio
   apuntando **solo a Vercel** para no tener dos versiones. Puedes desactivar
   GitHub Pages en el repositorio (Settings → Pages).

## Si prefieres mantener la web en GitHub Pages y usar Vercel solo para la API

Funciona, pero hay que decirle a la web dónde está la API:

1. En `index.html`, justo antes del `<script>` principal, añade:
   ```html
   <script>window.BODA_API_BASE = 'https://boda-xxxx.vercel.app';</script>
   ```
2. En Vercel, añade la variable `ALLOW_ORIGIN` con la URL de tu web
   (p. ej. `https://raquelyadrian.com`).

Lo más sencillo, de todas formas, es servir **todo desde Vercel** (Paso 6): así
no hay que tocar nada y no hay problemas de permisos entre dominios.

---

## Copias de seguridad / exportar

Entra en `/admin` e inicia sesión y pulsa **Descargar RSVP (CSV)** o
**Descargar canciones (CSV)**. Ese CSV se abre en Excel o Google Sheets. Tus
datos son tuyos y puedes sacarlos cuando quieras.

## Coste

- **Vercel**: plan Hobby gratuito (de sobra para una web de boda).
- **Upstash Redis**: plan Free (miles de operaciones al día; una boda no se
  acerca ni de lejos al límite).

> Nota: el backend autoalojado de la carpeta `server/` sigue existiendo por si
> algún día quieres llevarte todo a un servidor propio. En Vercel no se usa
> (lo ignora `.vercelignore`); allí mandan `api/` + `lib/`.


## Incidencias de base de datos y acceso

Si el token permite entrar pero aparece «No podemos leer las confirmaciones»,
el problema está en la base de datos, no en la contraseña. Revisa en Storage
que la base esté activa. Si Upstash muestra «Archived due to inactivity», sigue
su restauración de bases inactivas antes de conectar una base vacía: las
respuestas anteriores deben recuperarse, no reemplazarse.

Después de restaurar, conecta las credenciales de la misma base al proyecto y
redespliega. Comprueba `/api/health`, una confirmación de prueba, su aparición en
`/admin`, la edición y las exportaciones; elimina únicamente esa prueba.

`ADMIN_TOKEN` es la contraseña del panel, distinta del token de Redis. Nunca
la incluyas en la URL, el repositorio, capturas ni mensajes públicos. Vercel
no permite recuperar su valor si se guardó como variable Sensitive; si se ha
perdido hay que establecer una nueva en Settings → Environment Variables y
redesplegar. Los accesos nuevos usan una cookie firmada, HttpOnly y de siete días.

### Comprobación diaria

`vercel.json` programa `/api/check-ingestion` cada día a las 08:00 UTC. El
endpoint necesita `CRON_SECRET` en producción (aleatorio y Sensitive, distinto
de `ADMIN_TOKEN`). Vercel añade la cabecera de autorización automáticamente.
Comprueba que las listas de respuestas y canciones se pueden leer y contienen
registros válidos; no modifica invitados ni devuelve sus datos personales.
Esta lectura mantiene actividad de la base incluso sin nuevas respuestas.
Consulta sus ejecuciones en Vercel → Cron Jobs. No sustituye las copias de
seguridad ni envía avisos por correo.
