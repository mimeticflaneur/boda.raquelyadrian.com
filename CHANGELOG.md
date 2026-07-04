# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [2.2.0] - 2026-07-04

### Corregido
- **Mapas con las ubicaciones reales**: la Dehesa de Pedrosillo estaba pinchada
  ~10 km al sur; en realidad está en la **N-403 km 144, ~4 km al norte de
  Ávila**, junto al embalse de Las Cogotas (dirección verificada). Corregidos
  también los pines de los hoteles (Velada en Plaza de la Catedral, Sofraga en
  López Núñez y Las Leyendas junto al lienzo sur) y afinado el del Monasterio
  de Santo Tomás. Actualizados la dirección visible de la finca, los datos
  estructurados (SEO) y los enlaces de Google Maps.

### Eliminado
- Fleuron ❦ bajo las cabeceras de sección (introducido en 2.1.0).

## [2.1.0] - 2026-07-04

### Añadido
- **Llamada a la acción en el hero**: enlace «Confirma tu asistencia →» bajo la
  cuenta atrás, con subrayado sienna — el RSVP ya tiene puerta de entrada.
- **Tarjeta para WhatsApp** (`assets/og.png`): imagen Open Graph 1200×630
  generada con el escudo, los nombres y la fecha sobre papel; el enlace de la
  web se previsualiza como una invitación. Metas `og:image`/`twitter:image`
  actualizadas.
- **Detalles editoriales**: numeración automática de secciones («01 · …») con
  contadores CSS (los modales quedan excluidos), fleuron ❦ bajo cada cabecera,
  letra capitular en el primer párrafo de la historia y comillas tipográficas
  con más cuerpo en la cita de Santa Teresa.
- **Accesibilidad**: `:focus-visible` con contorno sienna en toda la web y
  contraste del texto atenuado mejorado (`--mute` más oscuro).

### Cambiado
- La foto de «Nuestra historia» se muestra con un virado suave en pantallas
  táctiles (antes solo se coloreaba con hover, inexistente en móvil).
- Mapas de los lugares entonados en sepia para integrarse con la paleta.
- La cuadrícula de regalos se adapta al número de cajas visibles.

### Eliminado
- Caja de transferencia con IBAN de relleno (comentada en el HTML hasta tener
  el número real) y enlace muerto del pie de página.

## [2.0.0] - 2026-07-04

### Añadido
- **Panel editable**: cada respuesta se puede **editar** desde `/admin` (modal
  con todos los campos: asistencia, contacto, preboda, menú, alergias, autobús
  y acompañantes, con añadir/quitar) y **eliminar** (respuestas y canciones).
  Nuevos endpoints protegidos `POST /api/update` y `POST /api/delete` en las
  dos vías (autoalojada y Vercel). Las ediciones quedan marcadas con la fecha.
- **Vista «una fila por persona»**: el panel lista al titular y, debajo, cada
  acompañante como *«Dependiente de [titular]»*, con su menú y alergias.
  Nueva exportación `personas.csv` con columnas `tipo` y `dependiente_de`.
- Tarjeta de resumen «Con alergias» en las estadísticas.

### Cambiado
- **Rediseño completo del panel** con la estética editorial de la web: papel
  cálido, sienna, Bodoni Moda + Jost, tarjetas en retícula, chips de estado,
  pantalla de acceso a juego y modal de edición con doble marco.
- Pulido del RSVP público: mensaje de confirmación con ornamento y serifas, y
  caja de acompañantes diferenciada sobre fondo cálido.

## [1.9.0] - 2026-06-13

### Añadido
- **Alergias e intolerancias por acompañante**: además de las del titular, cada
  acompañante tiene su propio campo de alergias/intolerancias en el menú. Se
  guarda, se muestra en el panel y se incluye en el CSV.

### Cambiado
- **Transporte simplificado**: una sola pregunta «¿Necesitas autobús?» con dos
  opciones — *Sí, necesitaré transporte* (y entonces *¿para cuántas personas?*,
  acotado al tamaño de tu grupo) o *No necesitaré transporte*. Sustituye a los
  antiguos campos separados de ida y vuelta.
- El panel y las estadísticas muestran ahora el **total de personas en autobús**
  (en lugar de los conteos de ida/vuelta).

## [1.8.0] - 2026-06-13

### Añadido
- **Despliegue en Vercel con base de datos** (gratis y persistente): funciones
  serverless en `api/` (`rsvp`, `cancion`, `admin`, `stats`, `export`, `health`)
  que guardan los datos en **Upstash Redis** mediante su API REST con `fetch`
  nativo (sin dependencias npm). `vercel.json` mapea `/admin` y `/export/*.csv`
  a las funciones; el sitio y la API quedan en el mismo origen (sin CORS).
- **`lib/core.js`**: lógica compartida (validación, estadísticas, CSV y panel)
  como única fuente de verdad entre el backend autoalojado y las funciones de
  Vercel. Nuevos `lib/store.js` (Upstash) y `lib/api.js` (CORS, auth, body).
- **Guía `DEPLOY-VERCEL.md`**: pasos para dejar la web y el formulario
  funcionando en Vercel + Upstash, conectar el dominio y exportar los datos.

### Cambiado
- **`server/server.js` refactorizado** para reutilizar `lib/core.js` en lugar de
  duplicar la lógica; el comportamiento (RSVP, panel, CSV) es idéntico.

## [1.7.0] - 2026-06-13

### Añadido
- **Backend propio y portable** en `server/`: servidor Node **sin dependencias**
  (solo módulos nativos) que recoge los RSVP y las sugerencias de canciones y los
  guarda en ficheros **NDJSON** (texto plano, fáciles de copiar, mover o importar
  a Excel/Sheets). Incluye `Dockerfile`, `docker-compose.yml`, `.env.example` y
  documentación de despliegue.
- **Panel de administración** `/admin` protegido por token: resumen de comensales,
  menús, preboda y autobús, con tablas de confirmaciones y canciones y
  **exportación a CSV** (`/export/rsvp.csv`, `/export/canciones.csv`).
- **Protección anti-bots** (honeypot) en los formularios de RSVP y canciones.
- El backend **también sirve el sitio estático**: con `node server/server.js` se
  levanta la web entera (frontend + API) en un solo comando.

### Cambiado
- **RSVP rediseñado en dos ramas** según el recorrido del invitado:
  - *No asistiré* → solo nombre y correo.
  - *Asistiré* → datos de contacto (nombre, teléfono, correo) → confirmación de la
    **preboda** del viernes 11 de junio → **menú** (carne / pescado / vegano) y
    **acompañantes** (desplegable numérico con nombre, contacto y menú de cada
    uno) → **transporte de ida y vuelta** a la finca (autobús).
- Los formularios ahora envían **JSON** al backend mediante `fetch`; la URL de la
  API se configura en una sola línea (`window.BODA_API_BASE`).

### Eliminado
- **Formspree**: se sustituye por completo (RSVP y sugerencias musicales) por el
  backend propio. Se elimina la dependencia de un tercero y las limitaciones de su
  plan gratuito.
- Opción «solo a la ceremonia» del RSVP, simplificando el flujo a las dos ramas
  anteriores.

## [1.6.0] - 2026-06-10

### Cambiado
- **Ceremonia en el Real Monasterio de Santo Tomás** (Plaza de Granada, 1) en lugar de la Catedral: actualizado en metadatos, datos estructurados, tarjeta de lugar, mapas, RSVP, FAQ y archivo de calendario.
- **Nuevo horario**: llegada de invitados 12:30h, ceremonia 13:00h, traslado 14:30h, cóctel 15:30h, banquete 17:30h, primer baile 21:00h y fiesta 22:00h.
- **Hoteles recomendados reducidos a tres**: Palacio de los Velada, Palacio Sofraga (nuevo) y Hotel Las Leyendas.

### Añadido
- **Pop-up de tarifa especial del Palacio de los Velada**: 105€/noche con IVA incluido escribiendo a reservas.avila@hotelesvelada.com o llamando al +34 920 255 100 presentándose como invitado de la boda, con enlace a las habitaciones de su web oficial.
- **Código de descuento del Palacio Sofraga**: chip copiable «R&A15» (−15%) con enlace a sofragapalacio.com.

### Eliminado
- Parador de Ávila (tarjeta destacada), Palacio de Valderrabanos, La Casa del Presidente y Hotel Arco San Vicente de la lista de hoteles y del mapa.

## [1.5.0] - 2026-06-10

### Añadido
- **Hero cinematográfico**: el corazón transverberado se dibuja con animación de trazo al cargar y después se rellena; líneas ornamentales que se trazan a ambos lados de la fecha; textura de grano de película sutil sobre el hero; el ampersand gigante "respira" con un zoom muy lento.
- **Cuenta atrás compacta**: línea tipográfica única bajo los nombres (`días · h · min`) con números en Bodoni Moda, actualizada cada 30 segundos.
- **Barra de progreso de lectura**: línea fija de 2px en siena en la parte superior que avanza con el scroll.
- **Parallax sutil** en los fondos del retablo (Lugares) y la vidriera (Ceremonia), solo en escritorio.
- Bloque `prefers-reduced-motion` que desactiva las animaciones decorativas para quien lo prefiera.

### Cambiado
- **Imágenes en WebP con fallback JPEG** mediante `<picture>`: retablo y vidriera reescaladas y en escala de grises (el CSS ya las desatura), y foto de Nuestra Historia con `srcset` en dos tamaños.
- `fondo-programa.svg` reoptimizado con SVGO.

### Eliminado
- **Libro de Firmas**: sección, enlace del menú, formulario de Formspree y estilos asociados (los mensajes nunca se mostraban públicamente).
- `assets/Gemini_Generated_Image_*.svg` (578 KB, duplicado sin uso de `fondo-programa.svg`).

### Técnico
- Peso de las imágenes servidas en navegadores modernos reducido de ~1,5 MB a ~460 KB.
- Listener de scroll unificado (timeline, barra de progreso y parallax) con un solo `requestAnimationFrame`.

## [1.4.0] - 2026-06-06

### Añadido
- **SEO enriquecido**: descripción específica de la boda, etiquetas Open Graph completas (locale, site_name, image dimensions, alt), Twitter Cards mejoradas y datos estructurados Schema.org (`Event`) para que las tarjetas compartidas en WhatsApp y redes sean atractivas.
- **Mapa ilustrado de Ávila**: vista única con Catedral, Dehesa del Pedrosillo, los 6 hoteles recomendados y leyenda con autobús de enlace.
- **Cuenta atrás cinematográfica**: sección a pantalla completa con fotografía de fondo (retablo), gradiente vignette y animación de pan/zoom sutil.
- **Código de vestimenta visual**: paleta cromática con 6 swatches (Sienna, Terracota, Arena, Oliva, Tabaco, Tinta) y guía Sí / Mejor evitar.
- **Hotel destacado**: tarjeta "Recomendado por los novios" para el Parador de Ávila con cita personal y diseño editorial sobredimensionado.
- Etiqueta `<link rel="canonical">` y `theme-color`.

### Cambiado
- **Formulario RSVP progresivo en 4 pasos**: ¿Vienes? → Datos → Menú + Alergias → Transporte. Reduce la sensación de carga y previene abandono.
  - Paso 1: tres opciones grandes con tarjetas tipográficas (sí / solo ceremonia / no).
  - Bifurcación inteligente: las rutas "no" y "solo ceremonia" sólo muestran los campos imprescindibles y finalizan en el paso 2.
  - Indicador de progreso dinámico que se adapta a la ruta del invitado.
  - Acompañantes con nombres y menús individuales.
- Eliminada la fila "Vestimenta" en Detalles (reemplazada por la nueva sección visual de código de vestimenta).
- Cuenta atrás trasladada de la sección Detalles a un bloque cinematográfico independiente entre Lugares y Detalles.

### Técnico
- Mapbox Static API ahora también genera el mapa global de Ávila con 8 marcadores (2 lugares + 6 hoteles).
- Datos estructurados JSON-LD con `Event`, `Place` y `PostalAddress`.

### Añadido
- Botón de descarga para PDF de escaleta musical generado en LaTeX
- Archivo `assets/escaleta-musical.pdf` con la escaleta completa
- Texto introductorio para la sección de escaleta musical

### Cambiado
- Rediseño completo de la escaleta musical de timeline a grid de tarjetas
- Las piezas musicales ahora se muestran en tarjetas individuales (2 columnas en desktop)
- Badges con gradient dorado para identificar cada momento de la ceremonia
- Mejora visual con border superior dorado en cada tarjeta musical
- Efectos hover mejorados en tarjetas musicales (elevación + escala)

## [1.2.0] - 2024-12-30

### Añadido
- Nueva sección "La Ceremonia" con información completa
- Ministro de la celebración: Alejandro Santos
- Escaleta musical completa con 8 piezas sacras:
  - Preludio: Canon en Re Mayor (Pachelbel)
  - Entrada de la novia: Ave María (Schubert)
  - Durante la liturgia: Salve Regina (Canto gregoriano)
  - Ofertorio: Ave Verum Corpus (Mozart) + O Sacrum Convivium (Santo Tomás de Aquino)
  - Comunión: Pie Jesu (Fauré) + Panis Angelicus (Franck)
  - Salida de los novios: Aleluya (Handel)
- Enlace "Ceremonia" en el menú de navegación
- Estilos específicos para la sección de ceremonia (minister-card, music-timeline, music-item)

### Cambiado
- Actualización de padrinos y testigos con nombres reales:
  - Padrino: Antonio Sainz (Padre de la novia)
  - Madrina: María del Rosario Rollán (Madre del novio)
  - Testigo: Alejandro Pedrera (Amigo del novio)
  - Testigo: Zuriñe (Amiga de la novia)

## [1.1.0] - 2024-12-30

### Añadido
- Sistema completo de Dark Mode / Light Mode
- Toggle button en navegación con iconos sol (☀️) / luna (🌙)
- Detección automática de preferencia del sistema (`prefers-color-scheme`)
- Persistencia de tema en `localStorage`
- Variables CSS dinámicas para ambos temas:
  - `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-card-hover`
  - `--bg-accent`, `--text-primary`, `--text-secondary`
  - `--border-color`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- Paleta dark mode coherente basada en verde oscuro (#1a2320)
- Transiciones suaves (0.3s) entre temas en todos los componentes
- Función JavaScript `toggleTheme()` y `loadTheme()`

### Cambiado
- Todos los componentes adaptados para usar variables CSS dinámicas
- Nav, hero, countdown, forms, cards adaptados al dark mode
- Glassmorphism ajustado para funcionar en ambos modos
- Responsive design del toggle button para mobile

## [1.0.0] - 2024-12-29

### Añadido
- Paquete completo de mejoras CSS con glassmorphism
- Efectos de glassmorphism en todas las tarjetas:
  - RSVP container
  - Hotel cards
  - Location cards
  - Detail cards
  - Gift cards
  - Padrino cards
- Efectos hover mejorados con `cubic-bezier(0.175, 0.885, 0.32, 1.275)`
- Sombras multi-capa para profundidad visual
- Botones con gradientes y efectos de brillo (pseudo-elemento `::before`)
- Countdown mejorado con glassmorphism
- Text shadows en títulos para mejor legibilidad
- Animaciones `fadeIn` mejoradas con mejor easing
- Border semi-transparente en cards (`rgba(255,255,255,0.3)`)

### Mejorado
- SVG del corazón transverberado (Sacred Heart):
  - Forma más anatómica del corazón
  - 5 llamas con capas dobles para más detalle
  - Cruz Teresiana añadida en la parte superior
  - Flecha/lanza mejorada con detalles ornamentales
  - Animaciones más suaves (float, heartGlow, flicker)

## [0.2.0] - 2024-12-28

### Añadido
- Validación mejorada del formulario RSVP
- Atributo `required` en selección de menú
- Atributo `required` en campos de acompañantes (nombre y menú)
- Mensaje de error visual para validación de menú
- Función `handleAttendance()` mejorada con limpieza de campos
- Reset completo de formulario al cambiar tipo de asistencia

### Cambiado
- Fecha de la boda actualizada: de 11 octubre 2026 a **12 junio 2027**
- Countdown JavaScript actualizado a nueva fecha (`2027-06-12T12:00:00`)
- Fecha en hero section
- Fecha en footer
- Hashtag actualizado a `#RaquelYAdrian2027`
- Deadline RSVP actualizado a 1 mayo 2027
- Deadline descuento hoteles actualizado a 1 mayo 2027
- Sección de detalles actualizada con nueva fecha

## [0.1.0] - 2024-12-18

### Añadido
- Sitio web inicial de boda
- Estructura HTML completa con todas las secciones:
  - Hero con countdown
  - Formulario RSVP con Formspree
  - Nuestra Historia
  - Galería de fotos (placeholders)
  - Padrinos y Testigos (placeholders)
  - Lugares del evento (Catedral de Ávila + Dehesa del Pedrosillo)
  - Hoteles recomendados (6 opciones con descuentos)
  - Detalles del evento
  - Timeline/Programa del día
  - Lista de bodas/Regalos
  - Playlist con Spotify embed
  - Libro de firmas
- Diseño responsive mobile-first
- Paleta de colores: cream, sage, forest, gold, blush
- Tipografías: Cormorant Garamond + Montserrat
- SVG del corazón transverberado (Sacred Heart) animado
- Integración con Formspree (3 formularios)
- Menú de navegación sticky con hamburger mobile
- Smooth scroll
- Animaciones fade-in con Intersection Observer
- Footer con hashtag y cita de Santa Teresa

### Infraestructura
- Repositorio GitHub
- Documentación CLAUDE.md para asistentes AI
- README básico

---

## Leyenda

- **Añadido** - para funcionalidades nuevas
- **Cambiado** - para cambios en funcionalidades existentes
- **Obsoleto** - para funcionalidades que serán eliminadas
- **Eliminado** - para funcionalidades eliminadas
- **Corregido** - para corrección de errores
- **Seguridad** - en caso de vulnerabilidades
- **Mejorado** - para mejoras de funcionalidades existentes
