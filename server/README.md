# Backend de la boda — Raquel & Adrián

Backend **portable y sin dependencias** para recoger las confirmaciones (RSVP) y
las sugerencias de canciones. Sustituye a Formspree: los datos son **tuyos** y se
guardan en ficheros de texto que puedes copiar, mover o importar a Excel/Sheets
cuando quieras.

- **Cero dependencias**: solo Node.js (18+). No hay `npm install` que falle ni
  bases de datos que instalar.
- **Almacenamiento NDJSON**: `data/rsvp.ndjson` y `data/canciones.ndjson`. Un
  JSON por línea. 100% portable.
- **Sirve también la web**: arranca el servidor y tienes `index.html` + la API en
  el mismo sitio.
- **Panel `/admin`** con estadísticas (comensales, menús, autobús, preboda) y
  **exportación a CSV**.

---

## Arranque rápido (local)

```bash
cd server
ADMIN_TOKEN=mi-token-secreto node server.js
```

Abre:

- Web: <http://localhost:3000/>
- Panel: <http://localhost:3000/admin?token=mi-token-secreto>

> Sin variables de entorno también arranca, usando un token por defecto
> (`cambia-este-token`). Úsalo solo para probar.

## Con Docker (recomendado para producción)

```bash
cd server
ADMIN_TOKEN=mi-token-secreto docker compose up -d
```

Los datos persisten en el volumen `boda-data`, fuera del contenedor.

---

## Variables de entorno

| Variable       | Por defecto          | Para qué sirve                                              |
| -------------- | -------------------- | ---------------------------------------------------------- |
| `PORT`         | `3000`               | Puerto de escucha.                                         |
| `HOST`         | `0.0.0.0`            | Interfaz de escucha.                                       |
| `ADMIN_TOKEN`  | `cambia-este-token`  | Clave para `/admin` y la descarga de CSV. **Cámbiala.**    |
| `ALLOW_ORIGIN` | `*`                  | Origen CORS permitido. En producción, la URL de tu web.    |
| `DATA_DIR`     | `./data`             | Carpeta donde se guardan los `.ndjson`.                    |

---

## Endpoints

| Método | Ruta                      | Descripción                                          |
| ------ | ------------------------- | ---------------------------------------------------- |
| `POST` | `/api/rsvp`               | Recibe una confirmación (JSON). Público.             |
| `POST` | `/api/cancion`            | Recibe una sugerencia de canción (JSON). Público.    |
| `GET`  | `/api/health`             | Estado del servicio.                                 |
| `GET`  | `/api/stats?token=…`      | Estadísticas en JSON. Protegido.                     |
| `GET`  | `/admin?token=…`          | Panel HTML con tablas y resumen. Protegido.          |
| `GET`  | `/export/rsvp.csv?token=…`| Descarga las confirmaciones en CSV. Protegido.       |
| `GET`  | `/export/canciones.csv?…` | Descarga las sugerencias en CSV. Protegido.          |
| `GET`  | `/*`                      | Sirve el sitio estático (`index.html`, `assets/…`).  |

### Ejemplo de cuerpo de `/api/rsvp`

```json
{
  "asistencia": "si",
  "nombre": "Ada Lovelace",
  "email": "ada@example.com",
  "telefono": "600123456",
  "preboda": "si",
  "menu": "pescado",
  "alergias": "frutos secos",
  "num_acompanantes": 1,
  "acompanantes": [
    { "nombre": "Charles Babbage", "contacto": "611222333", "menu": "carne", "alergias": "lactosa" }
  ],
  "transporte": "si",
  "transporte_personas": 2
}
```

Si `asistencia` es `"no"`, basta con `nombre` y `email`.

---

## Conectar el frontend

La web (`index.html`) envía los datos por `fetch` a este backend. La URL se
configura en **una sola línea** dentro de `index.html`:

```js
// Busca este bloque cerca del inicio del <script>:
const API_BASE = window.BODA_API_BASE || '';
```

- **Mismo origen** (sirves la web desde este backend): deja `API_BASE` vacío.
  Funciona sin tocar nada.
- **GitHub Pages u otro dominio**: define la URL del backend justo antes, p. ej.:

  ```html
  <script>window.BODA_API_BASE = 'https://api.raquelyadrian.com';</script>
  ```

  Y recuerda poner ese mismo dominio del sitio en `ALLOW_ORIGIN`.

---

## Dónde desplegarlo (opciones portables)

Como es Node puro, corre en cualquier sitio. Ideas, de más simple a más control:

1. **Una VPS** (Hetzner, DigitalOcean, etc.): `git clone`, `docker compose up -d`,
   un proxy (Caddy/Nginx) con HTTPS y listo.
2. **Render.com / Railway.app / Fly.io**: apuntan al repo, comando de arranque
   `node server/server.js`. Monta un disco persistente en `DATA_DIR`.
3. **Tu propio ordenador + túnel** (Cloudflare Tunnel): para algo temporal.

> Importante: el almacenamiento es en disco (`DATA_DIR`). En plataformas con disco
> efímero, monta un **volumen/disco persistente** ahí, o los datos se borrarán en
> cada despliegue.

## Copias de seguridad

Tus datos son dos ficheros de texto. Para respaldarlos:

```bash
cp data/rsvp.ndjson  ~/backup/rsvp-$(date +%F).ndjson
```

O entra en `/admin` y descarga los CSV. Eso es todo: portabilidad real.
