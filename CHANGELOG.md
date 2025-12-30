# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.3.0] - 2024-12-30

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
