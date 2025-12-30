# boda.raquelyadrian.com
# 💍 Boda Raquel & Adrián

 

Sitio web elegante y moderno para la boda de Raquel y Adrián, celebrando su amor el **12 de junio de 2027** en Ávila, España.

 

> *"Y sin amor, todo es nada"* — Santa Teresa de Jesús

 

[![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://github.com/mimeticflaneur/boda.raquelyadrian.com)

[![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)

[![CSS3](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/es/docs/Web/CSS)

[![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)

 

## ✨ Características

 

### 🎨 Diseño y UX

- **Dark Mode / Light Mode** con toggle persistente en localStorage

- **Glassmorphism** moderno en todas las tarjetas

- **Animaciones suaves** con fade-in y efectos hover

- **Responsive Design** optimizado para mobile, tablet y desktop

- **Paleta de colores** elegante: cream, sage, forest, gold, blush

- **Tipografías** premium: Cormorant Garamond + Montserrat

 

### 🎵 Sección de Ceremonia

- **Ministro**: Alejandro Santos

- **Padrinos y Testigos**: Antonio Sainz, María del Rosario Rollán, Alejandro Pedrera, Zuriñe

- **Escaleta Musical**: 8 piezas sacras cuidadosamente seleccionadas

- **Descarga PDF**: Escaleta completa generada en LaTeX

- **Tarjetas informativas** con badges dorados para cada momento

 

### 📝 Formulario RSVP

- **Tres flujos de confirmación**: Asistencia completa, solo ceremonia, no asistencia

- **Validación completa** con HTML5 y JavaScript

- **Gestión de acompañantes**: campos dinámicos para hasta 5 personas

- **Selección de menú**: Carne, Pescado, Vegano

- **Integración Formspree**: envío directo de respuestas

- **Campos adicionales**: Alergias, transporte, contacto

 

### 🏨 Información para Invitados

- **6 hoteles recomendados** con descuentos especiales

- **2 ubicaciones** con mapas interactivos (Google Maps embebidos)

- **Timeline del día** con 7 momentos clave

- **Detalles prácticos**: Código de vestimenta, transporte, niños, hashtag

 

### 🎁 Extras

- **Lista de bodas** con 6 regalos y barras de progreso

- **Playlist Spotify** embebida + formulario de sugerencias

- **Libro de firmas** para mensajes de los invitados

- **Countdown en vivo** hasta el día de la boda

- **SVG animado** del Corazón Transverberado de Santa Teresa

 

## 🛠️ Tecnologías

 

- **HTML5** - Estructura semántica

- **CSS3** - Estilos modernos con variables CSS, Grid, Flexbox, glassmorphism

- **JavaScript (ES6)** - Interactividad sin frameworks

- **Formspree** - Gestión de formularios (3 endpoints)

- **Google Maps API** - Mapas embebidos

- **Spotify Embed** - Integración de playlist

- **LaTeX** - Generación de PDF de escaleta musical

 

## 📂 Estructura del Proyecto

 

```

boda.raquelyadrian.com/

├── index.html              # Página principal (SPA)

├── assets/

│   └── escaleta-musical.pdf   # PDF generado en LaTeX

├── CHANGELOG.md            # Historial de versiones

├── README.md               # Este archivo

└── .git/                   # Control de versiones

```

 

## 🚀 Uso

 

### Visualización Local

 

1. **Clonar el repositorio**:

   ```bash

   git clone https://github.com/mimeticflaneur/boda.raquelyadrian.com.git

   cd boda.raquelyadrian.com

   ```

 

2. **Abrir en el navegador**:

   - Opción 1: Doble clic en `index.html`

   - Opción 2: Usar un servidor local:

     ```bash

     # Python 3

     python -m http.server 8000

 

     # Node.js (con npx)

     npx http-server

 

     # VS Code

     # Instalar extensión "Live Server" y hacer clic derecho → "Open with Live Server"

     ```

 

3. **Navegar a**: `http://localhost:8000`

 

### Despliegue

 

El sitio es estático y puede desplegarse en:

- **GitHub Pages** (recomendado)

- **Netlify**

- **Vercel**

- **Firebase Hosting**

- Cualquier servidor web estático

 

#### Despliegue en GitHub Pages:

```bash

# Activar GitHub Pages en Settings → Pages

# Source: Deploy from a branch

# Branch: main / (root)

```

 

## 🎨 Personalización

 

### Colores

 

Los colores se definen en variables CSS en `index.html`:

 

```css

:root {

    --cream: #faf8f5;

    --sage: #9aad96;

    --forest: #2c3e2d;

    --gold: #d4a574;

    --blush: #f4e6e1;

}

```

 

### Dark Mode

 

El tema se guarda en `localStorage`. Variables específicas:

 

```css

[data-theme="dark"] {

    --bg-primary: #1a2320;

    --bg-secondary: #222d2a;

    --text-primary: #f5f3ed;

    /* ... más variables */

}

```

 

### Formspree

 

Para usar tus propios formularios, reemplaza los endpoints en `index.html`:

 

```html

<!-- Línea 339 - RSVP -->

<form action="https://formspree.io/f/TU_ENDPOINT_RSVP" method="POST">

 

<!-- Línea 598 - Sugerencias musicales -->

<form action="https://formspree.io/f/TU_ENDPOINT_MUSICA" method="POST">

 

<!-- Línea 613 - Libro de firmas -->

<form action="https://formspree.io/f/TU_ENDPOINT_FIRMAS" method="POST">

```

 

## 📱 Responsive Breakpoints

 

- **Mobile**: < 768px (1 columna)

- **Tablet**: 768px - 992px (2 columnas en hoteles)

- **Desktop**: > 992px (3 columnas en hoteles)

 

## 🌐 Navegadores Soportados

 

- ✅ Chrome 90+

- ✅ Firefox 88+

- ✅ Safari 14+

- ✅ Edge 90+

- ✅ Opera 76+

 

## 📊 Versiones

 

Ver [CHANGELOG.md](CHANGELOG.md) para el historial completo de cambios.

 

**Versión actual**: 1.3.0 (2024-12-30)

 

### Roadmap

- [ ] Galería de fotos real (actualmente placeholders)

- [ ] Fotos de padrinos y testigos

- [ ] Integración con lista de bodas real

- [ ] Sistema de check-in para invitados

- [ ] Mapa interactivo de mesas

 

## 🤝 Contribución

 

Este es un proyecto personal, pero si encuentras algún error o tienes sugerencias:

 

1. Abre un **Issue** describiendo el problema o mejora

2. Haz un **Fork** del proyecto

3. Crea una **rama** (`git checkout -b feature/mejora`)

4. **Commit** tus cambios (`git commit -m 'Añadir mejora'`)

5. **Push** a la rama (`git push origin feature/mejora`)

6. Abre un **Pull Request**

 

## 📝 Créditos

 

### Diseño y Desarrollo

- **Desarrollado por**: Claude (Anthropic) + Raquel & Adrián

- **Inspiración**: Diseño de bodas moderno con toque clásico y religioso

 

### Música Sacra

- Johann Pachelbel - Canon en Re

- Franz Schubert - Ave María

- Wolfgang Amadeus Mozart - Ave Verum Corpus

- Gabriel Fauré - Pie Jesu

- César Franck - Panis Angelicus

- George Frideric Handel - Aleluya

 

### Recursos

- [Google Fonts](https://fonts.google.com/) - Tipografías

- [Formspree](https://formspree.io/) - Gestión de formularios

- [Spotify](https://open.spotify.com/) - Playlist embebida

- [SVG Patterns](https://www.heropatterns.com/) - Patrón de fondo

 

## 📄 Licencia

 

Copyright © 2024 Raquel & Adrián. Todos los derechos reservados.

 

Este sitio web es de uso personal para la celebración de nuestra boda.

No se permite la reproducción, distribución o uso comercial sin autorización expresa.

 

---

 

## 💌 Contacto

 

¿Preguntas sobre la boda? Contáctanos:

 

- 📧 Email: [tu-email@ejemplo.com]

- 📱 Teléfono: [tu-telefono]

- 📍 Ávila, España

 

---

 

<div align="center">

 

**Hecho con ❤️ para celebrar nuestro amor**

 

*12 de Junio de 2027 • Ávila*

 

#RaquelYAdrian2027

 

</div>

 
