# R & A -- Avila, 12.06.27

Sitio web para la boda de Raquel y Adrian. 12 de junio de 2027, Avila.

Ceremonia en la Catedral de Avila. Celebracion en la Dehesa del Pedrosillo.

## Stack

Frontend en HTML + CSS + JS vanilla. Sin frameworks, sin build tools. Un solo
archivo `index.html`. Backend propio en `server/` (Node sin dependencias).

- **Tipografia**: Bodoni Moda + Jost (Google Fonts)
- **Formularios**: backend propio y portable en `server/` (RSVP y sugerencias
  musicales). Los datos son nuestros, no de un tercero. Ver [`server/README.md`](server/README.md).
- **Mapas**: Mapbox Static Images API
- **Musica**: Spotify embed

## Estructura

```
index.html                    Pagina completa (SPA)
assets/
  corazon_transverberado.svg  Favicon (escudo)
  nuestra-historia.jpeg       Foto de pareja
  retablo.jpeg                Fondo seccion venues
  vidriera.jpeg               Fondo seccion ceremonia
  escaleta-musical.pdf        PDF escaleta musical
server/
  server.js                   Backend portable (Node, sin dependencias)
  README.md                   Como arrancar, desplegar y exportar datos
  Dockerfile / docker-compose.yml
```

## RSVP y backend

El RSVP guia al invitado por dos ramas:

- **No asistire** -> nombre y correo.
- **Asistire** -> contacto (nombre, telefono, correo) -> preboda del viernes 11
  -> menu (carne / pescado / vegano) + acompanantes (nombre, contacto y menu de
  cada uno) -> autobus de ida y vuelta a la finca.

Esos datos los recoge el backend de `server/`, que los guarda en ficheros NDJSON
(texto plano, portables) y ofrece un panel `/admin` con resumen y exportacion a
CSV. No usamos Formspree. Detalles en [`server/README.md`](server/README.md).

## Desarrollo local

Opcion A — solo el sitio estatico:

```bash
python -m http.server 8000
# o
npx http-server
```

Opcion B — sitio + backend funcionando (RSVP real):

```bash
cd server
ADMIN_TOKEN=mi-token node server.js   # http://localhost:3000
```

## Despliegue

- **Frontend**: GitHub Pages desde la rama `main`. Si el backend esta en otro
  dominio, define su URL en `index.html` con
  `window.BODA_API_BASE = 'https://tu-backend'`.
- **Backend**: cualquier host con Node o Docker (VPS, Render, Railway, Fly.io).
  Ver [`server/README.md`](server/README.md).

## Licencia

Uso personal. Todos los derechos reservados.
