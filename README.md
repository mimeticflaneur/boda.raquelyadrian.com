# R & A -- Avila, 12.06.27

Sitio web para la boda de Raquel y Adrian. 12 de junio de 2027, Avila.

Ceremonia a las 13:30h en el Real Monasterio de Santo Tomás de Ávila. Celebracion en la Dehesa del Pedrosillo.

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
  galeria/                   Diez fotos del álbum en WebP, dos tamaños por foto
  retablo.jpeg                Fondo seccion venues
  vidriera.jpeg               Fondo seccion ceremonia
  escaleta-musical.pdf        PDF escaleta musical
server/
  server.js                   Backend portable (Node, sin dependencias)
  README.md                   Como arrancar, desplegar y exportar datos
  Dockerfile / docker-compose.yml
```

## RSVP y backend

El álbum «Nosotros» es una cinta automática continua, sin textura de fondo.
El botón permite pausar y reanudar; al tocar o enfocar las fotografías se puede
explorar con desplazamiento nativo. El movimiento se detiene al pasar el ratón,
al salir de pantalla o al ocultar la pestaña. Con movimiento reducido, o sin
JavaScript, queda una galería horizontal manual. Las fotos conservan su encuadre
completo y la copia que permite cerrar el bucle está oculta a lectores de pantalla.
La lógica está en `assets/gallery.js`.

El RSVP guia al invitado por dos ramas:

- **No asistire** -> nombre y correo.
- **Asistire** -> contacto (nombre, telefono, correo) -> preboda del viernes 11
  -> menu (carne / pescado / vegano) + acompanantes (nombre, contacto y menu de
  cada uno) -> autobus de ida y vuelta a la finca.

Esos datos los recoge un backend propio. Hay dos formas de desplegarlo, según
prefieras:

- **Vercel + Upstash Redis (gratis, recomendado)**: la web y la API en el mismo
  sitio, sin servidores que mantener. Las funciones están en `api/` y la lógica
  común en `lib/`. Guía paso a paso en [`DEPLOY-VERCEL.md`](DEPLOY-VERCEL.md).
- **Autoalojado (Node, sin dependencias)**: el servidor de `server/` guarda todo
  en ficheros NDJSON (texto plano, portables). Ideal para una VPS o local. Ver
  [`server/README.md`](server/README.md).

Ambas comparten la misma validación, panel `/admin` y exportación a CSV. No
usamos Formspree.

## Desarrollo local

El teléfono de los asistentes es obligatorio y se guarda con prefijo internacional.
El formulario ofrece España (+34), Chile (+56) y un prefijo editable para otros países.
La normalización se comparte entre navegador y servidor en `assets/phone.js`.
Los registros antiguos se conservan sin atribuirles un país automáticamente.

Los envíos incluyen una clave de reintento: Redis guarda la respuesta y su recibo
en una operación atómica y evita duplicados durante siete días. El formulario
solo anuncia éxito al recibir un recibo válido. Las ediciones detectan cambios
concurrentes y los borrados buscan por identificador dentro de una operación atómica.

Pruebas: `npm test` valida teléfonos, autenticación, fallos de red, CSV y 20.000
entradas aleatorias. `npm run test:integration` necesita `redis-server` instalado
y crea un Redis efímero local para comprobar 300 grupos simultáneos, reintentos,
ediciones, borrados, panel y exportaciones. Nunca utiliza la base de producción.

`npm run test:stress` amplía la carga por HTTP a 3.000 grupos (7.500 personas),
100 solicitudes en vuelo, reintentos, conexiones perdidas después de guardar,
caída y recuperación de Redis, 450 ediciones/borrados, conflictos y límites por IP.
Necesita `redis-server` y solo usa un Redis local efímero. Se puede guardar el
resultado con `STRESS_REPORT=/ruta/informe.json npm run test:stress`.
Sus tiempos miden este entorno local, no la capacidad de Vercel o Upstash.

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

- **Todo en Vercel (recomendado)**: web estatica + funciones `api/` + base de
  datos Upstash Redis. Mismo origen, sin CORS, gratis. Guia:
  [`DEPLOY-VERCEL.md`](DEPLOY-VERCEL.md).
- **Frontend en GitHub Pages**: desde la rama `main`. Si el backend esta en otro
  dominio, define su URL en `index.html` con
  `window.BODA_API_BASE = 'https://tu-backend'`.
- **Backend autoalojado**: cualquier host con Node o Docker (VPS, Render,
  Railway, Fly.io). Ver [`server/README.md`](server/README.md).

## Licencia

Uso personal. Todos los derechos reservados.
