# R & A -- Avila, 12.06.27

Sitio web para la boda de Raquel y Adrian. 12 de junio de 2027, Avila.

Ceremonia en la Catedral de Avila. Celebracion en la Dehesa del Pedrosillo.

## Stack

HTML + CSS + JS vanilla. Sin frameworks, sin build tools. Un solo archivo `index.html`.

- **Tipografia**: Bodoni Moda + Jost (Google Fonts)
- **Formularios**: Formspree (RSVP, sugerencias musicales, libro de firmas)
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
```

## Desarrollo local

```bash
python -m http.server 8000
# o
npx http-server
```

## Despliegue

GitHub Pages desde la rama `main`.

## Licencia

Uso personal. Todos los derechos reservados.
