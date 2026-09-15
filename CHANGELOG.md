# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Unreleased]

## [0.4.0] - 2026-09-16

### Added

- PWA instalable, pensada para uso en el móvil: `manifest.webmanifest`, iconos
  (192/512/512-maskable/apple-touch-icon) e íconos de instalación en la misma
  identidad visual del resto de la serie.
- Service worker (`sw.js`) que cachea el shell estático (HTML/CSS/JS/iconos) con
  estrategia stale-while-revalidate, para carga instantánea y funcionamiento sin
  conexión en visitas repetidas. Deliberadamente no cachea OpenCV.js (CDN de
  terceros, cross-origin): una respuesta opaca no permite distinguir un fetch
  fallido de uno correcto, así que se apoya en la caché HTTP normal del navegador.
- Aviso de "versión nueva disponible" con botón de recarga manual cuando el
  service worker detecta una actualización mientras la app sigue abierta, en vez
  de recargar sola y cortar una captura o un arrastre de esquinas en curso.

## [0.3.0] - 2026-09-16

### Changed

- Se divide `zscanner.html` en `index.html` + `css/styles.css` + `js/*.js`
  (`dom`, `state`, `ui`, `camera`, `detection`, `adjust`, `perspective`, `main`),
  usando ES modules nativos del navegador — sin bundler ni build step.
- Rediseño visual para seguir la misma identidad que el resto de la serie de
  portfolio (BusYa, Disaster Watch): tipografía IBM Plex Mono, paleta oscura con
  acento verde, cabecera con punto pulsante, badges en mayúsculas y radios de
  borde pequeños.

### Added

- README, licencia MIT, `.gitignore` y `favicon.svg` en el mismo estilo plano
  que los favicons de los otros proyectos de la serie.

## [0.2.0] - 2026-09-16

### Added

- Ajuste manual de esquinas: cuando la detección automática falla, o cuando se
  quiere corregir el encuadre, se congela el frame y se muestran las 4 esquinas
  como puntos arrastrables antes de aplicar `warpPerspective`, en vez de forzar
  un recorte a frame completo sin detección. Accesible desde el disparador (si
  no hay detección), el botón de encuadre manual, y un botón "Ajustar" nuevo en
  el panel de resultado.
- Parámetros de detección (área mínima, umbrales de Canny, tamaño de blur,
  epsilon de `approxPolyDP`) ajustables por query string, más un panel de
  sliders opcional con `?debug=1` para ajustarlos en caliente durante desarrollo.

### Fixed

- Fuga de memoria en el bucle de detección: el kernel de `dilate` y el `Mat`
  del mejor cuadrilátero candidato podían quedar sin liberar si una llamada de
  OpenCV lanzaba una excepción a mitad del bucle.
- Condición de carrera en la carga de OpenCV.js: el `<script onload="...">`
  podía disparar el evento `load` antes de que el bloque de script siguiente
  (que define el callback) llegara a ejecutarse, sobre todo con el archivo ya
  cacheado. Ahora se carga programáticamente, registrando antes los listeners.

## [0.1.0] - 2026-09-15

### Added

- Prototipo inicial en un único archivo HTML: apertura de cámara trasera,
  detección automática de documentos con OpenCV.js (gris → blur → Canny →
  contornos → `approxPolyDP`), corrección de perspectiva, tres modos de salida
  (blanco y negro, escala de grises, color) y descarga como PNG.

[Unreleased]: https://github.com/rzazo24/zscanner/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/rzazo24/zscanner/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/rzazo24/zscanner/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rzazo24/zscanner/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rzazo24/zscanner/releases/tag/v0.1.0
