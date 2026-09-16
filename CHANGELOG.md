# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Unreleased]

## [0.12.1] - 2026-09-16

### Fixed

- **Bug grave reportado en iOS: el teléfono entero se ralentizaba progresivamente
  hasta tener que forzar el cierre**, sin llegar a completar una captura. El bucle
  de detección nunca tuvo límite de fotogramas — corría una vez por
  `requestAnimationFrame`, es decir, a la frecuencia de refresco de la propia
  pantalla (hasta 120Hz en iPhones con pantalla ProMotion). Eso ya era más de lo
  necesario desde el principio, y se volvió un problema real conforme el pipeline
  se hizo más pesado (CLAHE en cada frame desde v0.7.0, un segundo pase de
  Canny+contornos en algunos frames desde v0.6.0): CPU sostenida cerca del 100%
  a hasta 120 ejecuciones por segundo, con el consiguiente calentamiento y
  ralentización del dispositivo. Ahora la detección está limitada a ~10 fps —
  de sobra para seguir un documento sujeto con la mano — verificado
  directamente contando las ejecuciones reales del pipeline (antes sin tope,
  ahora ~9.7 fps constantes).

## [0.12.0] - 2026-09-16

### Added

- Captura a resolución completa con la API `ImageCapture` (`takePhoto()`) en vez
  de solo tomar el frame actual del vídeo en directo. El stream de vídeo continuo
  de `getUserMedia` está limitado muy por debajo de la resolución de foto real de
  la cámara (necesita seguir decodificando frames en tiempo real) — confirmado
  directamente: un stream negociado a 2400×2160 dio una foto de 3840×2160 con
  `takePhoto()` sobre el mismo track, en el mismo dispositivo. Cae
  automáticamente al frame de vídeo de siempre cuando la API no existe (Safari
  no la soporta) o falla/tarda más de 4s en un dispositivo concreto.

### Changed

- `grabFullFrame()` pasa a ser asíncrona (para poder esperar `takePhoto()`);
  actualizados los tres puntos de llamada (disparador, ajuste manual,
  `captureDetected()`).

## [0.11.0] - 2026-09-16

### Added

- Nuevo modo de salida "Mejorado", activado por defecto: aplana la iluminación
  desigual/sombras y sube el contraste sin binarizar, a diferencia de "B/N"
  (renombrado desde "Blanco y negro"). Es el mismo tipo de filtro que usa
  CamScanner en su modo de blanco y negro — que pese al nombre no es una
  binarización dura, sino gris continuo con fondo limpio. Técnica de
  normalización de fondo: estima la iluminación con un desenfoque fuerte de
  una copia dilatada, la resta de la imagen original, e invierte y normaliza
  (estira el contraste) el resultado. Los tamaños de kernel escalan con la
  resolución real de la imagen, verificado visualmente contra una imagen
  sintética con degradado de sombra y ruido tipo sensor de cámara.
- El selector de modo pasa de 3 a 4 botones ("Mejorado", "B/N", "Grises",
  "Color"); etiquetas acortadas para que quepan en una fila sin desbordar en
  móviles estrechos.

## [0.10.0] - 2026-09-16

### Added

- Pantalla previa a la solicitud de acceso a la cámara, con el estilo de la app,
  explicando para qué hace falta y que todo el procesado ocurre en el propio
  navegador. El diálogo nativo de "permitir cámara" del navegador es UI del
  sistema y no se puede personalizar (por seguridad — si una web pudiera
  diseñarlo, podría usarlo para engañar al usuario), así que esta pantalla
  solo aparece justo antes, dándole contexto en vez de que salte de golpe en
  mitad de la carga de OpenCV.js. Incluye manejo de error si se deniega el
  permiso o falla el acceso, con botón de "Reintentar".

## [0.9.1] - 2026-09-16

### Fixed

- **Regresión de v0.9.0**: el modo blanco y negro se veía con ruido tipo "sal y
  pimienta" a las nuevas resoluciones de captura más altas. `adaptiveThreshold`
  usaba un tamaño de bloque fijo en píxeles (25) implícitamente ajustado para la
  resolución antigua (~1400px de ancho) — al subir la resolución de captura sin
  tocar este valor, ese mismo bloque de 25px pasó a cubrir proporcionalmente
  mucha menos área del documento, amplificando el ruido del sensor de la cámara
  en vez de promediarlo. Ahora el tamaño de bloque escala con el ancho real del
  recorte (a 1400px de ancho da exactamente 25, igual que antes; a 2400px da 43),
  verificado visualmente contra una imagen sintética con ruido realista tipo
  sensor de cámara: notablemente menos ruido sin perder nitidez en el texto.

## [0.9.0] - 2026-09-16

### Changed

- Resolución de captura aumentada: `getUserMedia` pasa a pedir ~2400×3200 (antes
  1280×1706), y `grabFullFrame()` usa la resolución nativa real del recorte de
  cámara (topada en ~2400px de ancho, ≈300dpi para un A4/carta — el estándar
  razonable para lectura/OCR) en vez de un tamaño fijo de 1400px sin relación
  con lo que la cámara podía dar realmente. La detección en vivo corre sobre
  una copia reducida a 360px (`DET_W` en `detection.js`) independientemente de
  esto, así que la resolución de captura no afecta a la velocidad del escaneo
  en vivo — solo a la calidad del PNG final.

## [0.8.0] - 2026-09-16

### Added

- Lupa de precisión al arrastrar una esquina en el ajuste manual: muestra un
  recorte ampliado (2.5x) con mira exacta, desplazada por encima (o por debajo,
  cerca del borde superior) del punto de contacto para no quedar tapada por el
  propio dedo — el problema número uno de cualquier interfaz de recorte táctil.
- El ajuste manual ahora parte de la mejor detección disponible aunque no haya
  llegado a confirmarse como estable (`state.rawQuad`, expuesto cada frame junto
  al `state.lastQuad` ya confirmado), en vez de forzar siempre un rectángulo
  genérico centrado. No afecta a la captura automática — esa sigue exigiendo la
  detección confirmada de siempre.

## [0.7.1] - 2026-09-16

### Removed

- **Revertido el botón de linterna de v0.7.0**: probado en dispositivo real, activar
  el flash empeora la detección en vez de ayudar. A la distancia típica de escaneo,
  el flash del móvil es una fuente de luz puntual muy cerca del documento — crea un
  punto muy brillante en el centro con caída brusca hacia los bordes (en vez de luz
  ambiente uniforme), lo que genera bordes falsos alrededor del propio brillo y
  descompensa el cálculo de la mediana usado por el Canny adaptativo. Es un problema
  conocido en apps de escaneo de documentos — por eso ninguna las serias ofrece
  "activar el flash mientras escaneas". El aviso de poca luz ya no sugiere activar
  el flash, solo buscar una zona más iluminada.

## [0.7.0] - 2026-09-16

### Added

- CLAHE (realce de contraste local adaptativo) antes de blur+Canny, activado por
  defecto (`?clahe=0` para desactivarlo) — mejora bastante la detección en
  habitaciones con poca luz donde el documento tiene poco contraste pero la
  escena en sí no es imposible de procesar. Verificado contra el build real de
  OpenCV.js: `cv.CLAHE` existe como constructor y `.apply()` funciona como se
  espera.
- Aviso de "poca luz" en el texto de ayuda cuando la mediana de brillo del frame
  (antes de CLAHE, para reflejar la luz ambiente real) cae por debajo de un
  umbral — honesto sobre el límite físico: ningún procesado añade luz que la
  cámara nunca captó.
- Botón de linterna (flash trasero como luz continua) sobre la vista de cámara,
  visible solo cuando el navegador/dispositivo confirma soportarlo
  (`track.getCapabilities().torch`) — la mayoría de cámaras frontales y Safari
  en iOS no lo soportan, así que el botón se oculta en vez de fallar en silencio.

## [0.6.0] - 2026-09-16

### Added

- Filtro de rectangularidad: un cuadrilátero candidato solo se acepta si sus 4
  ángulos internos están dentro de un margen amplio (30°-150°, generoso a
  propósito para no rechazar documentos vistos con perspectiva pronunciada) —
  descarta formas degeneradas/con picos que antes podían aceptarse como
  documento válido solo por tener área grande y 4 vértices.
- Reintento con umbrales más permisivos: si el Canny adaptativo no encuentra
  ningún cuadrilátero válido en un frame, se reintenta una vez con un umbral
  más ancho antes de rendirse — ayuda en escenas de contraste marginal donde
  la estimación por mediana fue demasiado estricta para cerrar el contorno.
- Área mínima por defecto más permisiva (`minArea`: 0.15 → 0.10), para
  documentos capturados desde algo más lejos.

### Changed

- Refactor interno de `detection.js`: el pipeline Canny→contornos→approxPolyDP
  se extrae a una función reutilizable (`findBestQuadPoints`) que gestiona sus
  propios `cv.Mat` de principio a fin, en vez de mantener uno vivo entre
  iteraciones del bucle — permite reintentar con otro umbral dentro del mismo
  frame sin duplicar la gestión de memoria, y simplifica el ciclo de vida de
  los `Mat` en general.

## [0.5.2] - 2026-09-16

### Fixed

- Los botones circulares (cambiar cámara, ajustar esquinas manualmente, cancelar)
  usaban símbolos Unicode sueltos (⟲ ▭ ✕) en vez de iconos propios, con dos
  problemas: renderizaban de forma inconsistente entre dispositivos (a veces como
  emoji a color, desalineados o con peso visual distinto entre sí), y su borde
  (`--grid`) apenas se distinguía del fondo. Sustituidos por iconos SVG inline
  (`stroke="currentColor"`, mismo patrón que BusYa/Disaster Watch) y borde
  `--text-dim`, mucho más visible.

## [0.5.1] - 2026-09-16

### Fixed

- **Regresión de v0.5.0**: la auto-detección prácticamente dejaba de bloquear nunca.
  El contador de frames consecutivos exigidos para confirmar un cuadrilátero se
  reiniciaba a cero ante *cualquier* frame sin detección, incluso durante la propia
  fase de acumulación — y en vídeo real es normal que algún frame suelto no
  encuentre un contorno limpio (desenfoque, autoenfoque, parpadeo de exposición)
  aunque el documento esté quieto, así que el contador casi nunca llegaba a los 4
  frames necesarios. Ahora ese margen de tolerancia (`missGrace`) aplica también
  antes de bloquear, no solo para mantener un bloqueo ya conseguido.
- De paso, se simplifica la lógica de re-enganche: en vez de exigir que un salto
  brusco mientras ya está bloqueado vuelva a demostrarse durante varios frames,
  cualquier detección válida simplemente suaviza el cuadrilátero bloqueado hacia
  ella — un frame puntual erróneo ya se corrige solo en el siguiente.

## [0.5.0] - 2026-09-16

### Added

- Umbrales de `Canny` calculados en cada frame a partir de la mediana de brillo de la
  imagen (heurística sigma=0.33), en vez de un par de valores fijos — se adapta sola a
  luz mala o poco contraste. Se puede forzar de vuelta a valores fijos con
  `?cannyLow=`/`?cannyHigh=` explícitos, o desactivarlo a mano con `?autoCanny=0`.
- Estabilidad temporal en la detección: un cuadrilátero necesita varios frames
  consecutivos similares (`?stableFrames=`, 4 por defecto) antes de marcarse como
  "detectado", y un bloqueo ya activo tolera varios frames seguidos sin detección
  (`?missGrace=`, 6 por defecto) antes de soltarse — evita que el estado parpadee con
  ruido puntual o una oclusión breve. El panel `?debug=1` incluye ahora un checkbox
  para `autoCanny` (con lectura en vivo de los valores calculados) y sliders para los
  dos parámetros nuevos.

### Fixed

- La cabecera ("ZScanner" + el punto de estado) quedaba tapada por el notch/isla
  dinámica o la barra de estado del móvil, ya que `viewport-fit=cover` deja que la
  página se dibuje debajo de esa zona. Se reserva espacio con
  `env(safe-area-inset-*)` en el padding de `.app`.
- El color del contorno detectado en la cámara en vivo se había quedado con el verde
  del diseño anterior al rediseño de v0.3.0; ahora usa `--accent` como el resto de la
  interfaz.

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

[Unreleased]: https://github.com/rzazo24/zscanner/compare/v0.12.1...HEAD
[0.12.1]: https://github.com/rzazo24/zscanner/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/rzazo24/zscanner/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/rzazo24/zscanner/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/rzazo24/zscanner/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/rzazo24/zscanner/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/rzazo24/zscanner/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/rzazo24/zscanner/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/rzazo24/zscanner/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/rzazo24/zscanner/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/rzazo24/zscanner/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/rzazo24/zscanner/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/rzazo24/zscanner/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/rzazo24/zscanner/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rzazo24/zscanner/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/rzazo24/zscanner/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rzazo24/zscanner/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rzazo24/zscanner/releases/tag/v0.1.0
