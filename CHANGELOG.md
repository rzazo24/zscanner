# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Unreleased]

## [0.15.4] - 2026-09-17

### Changed

- El hueco vertical entre la fila superior de botones (cambiar cámara/disparador/
  ajustar) y el botón de galería era mucho más pequeño (6px) que el hueco
  horizontal entre los botones de esa fila (18px), así que el conjunto se veía
  descompensado. Ahora ambos huecos miden lo mismo (18px), para que los 4 botones
  queden espaciados de forma simétrica en las dos direcciones.

## [0.15.3] - 2026-09-17

### Fixed

- Los botones de la cámara (y los del resultado) se desplazaban ligeramente hacia
  arriba o abajo según el mensaje mostrado bajo el visor: algunos textos ocupan una
  línea y otros dos, y al centrarse los botones en el espacio libre, ese cambio de
  altura del texto los movía con cada actualización del estado de detección. Ahora
  el texto de ayuda reserva siempre la altura de dos líneas (el caso más alto
  posible, medido directamente), así que los botones quedan fijos sin importar qué
  mensaje se muestre.

## [0.15.2] - 2026-09-17

### Changed

- La barra de páginas de la sesión multipágina ocupaba todo el ancho disponible
  aunque solo tuviera una miniatura, dejando un hueco vacío grande entre esta y
  "Finalizar PDF". Ahora la barra se ajusta a su contenido (ancho automático,
  centrada, con tope al 100% si hay muchas páginas) en vez de estirarse siempre
  al ancho completo, y se reducen miniaturas, paddings y tamaños de fuente para
  que ocupe menos alto también.

## [0.15.1] - 2026-09-16

### Changed

- El footer del enlace a GitHub baja un poco más (separación respecto a los
  controles de arriba) y su texto/icono se reducen de tamaño, para que pese
  menos visualmente frente al resto de la interfaz.

## [0.15.0] - 2026-09-16

### Added

- Footer con enlace al repositorio de GitHub, siempre visible al final de la app.

### Changed

- En pantallas más altas de lo estrictamente necesario, los botones (disparador,
  galería, acciones del resultado) se quedaban pegados justo debajo del visor,
  dejando un hueco vacío grande hasta abajo — poco simétrico. Ahora el visor
  mantiene exactamente su tamaño y posición de siempre, y los botones se centran
  en el espacio libre entre el texto de ayuda y el nuevo footer (`.controls-area`,
  un `flex:1` anidado dentro del bloque de la pantalla en vez de aplicado al
  bloque entero, para no afectar al visor). Verificado con Playwright en varios
  altos de pantalla: sin cambios en el tamaño/posición del visor, botones
  centrados con el mismo margen arriba y abajo, y sin desbordamiento en el
  viewport más bajo probado (iPhone SE, 667px, con la barra de páginas y el
  selector de modo visibles a la vez).

## [0.14.4] - 2026-09-16

### Fixed

- Las páginas del PDF multipágina salían "desiguales": cada una se dimensionaba a
  sus propios píxeles exactos en vez de compartir un tamaño común, así que un
  recorte ligeramente distinto entre una foto y otra (normal incluso escaneando
  el mismo documento físico a mano) hacía que cada página tuviera una proporción
  distinta y el PDF cambiara de tamaño/zoom al pasar de una página a otra. Ahora
  todas las páginas comparten el tamaño de la primera captura; el resto se
  encajan dentro de ese tamaño (sin recortar ni estirar, solo escaladas y
  centradas, con un margen blanco si la proporción no coincide exactamente).
  Verificado con Playwright generando un PDF con tres páginas de proporciones
  distintas a propósito: las tres comparten el mismo `/MediaBox` en el PDF
  resultante.

## [0.14.3] - 2026-09-16

### Fixed

- Los botones de "Repetir/Ajustar/+Página/Descargar" en la vista de resultado
  volvían a desplazarse fuera de la pantalla en móviles bajos, esta vez al
  finalizar una página *durante* una sesión multipágina: la barra de páginas y
  el selector de modo (Mejorado/B-N/Grises/Color) se suman encima de la imagen
  de resultado, y el límite `max-height: 60dvh` de esa imagen no tenía en cuenta
  ese espacio extra (a diferencia del arreglo de `.stage` en v0.14.1, que sí lo
  hace de forma dinámica). Se baja el límite a `44dvh` — verificado con
  Playwright: con la barra de páginas y el selector de modo visibles a la vez en
  un viewport de 667px, el botón más bajo pasa de desbordarse ~63px a quedar
  ~44px por encima del borde; sin sesión multipágina activa sigue habiendo de
  sobra (~120px de margen a 667px, ~220px a 844px).

## [0.14.2] - 2026-09-16

### Changed

- **Vuelve el límite de ~10 fps en el bucle de detección**, revertido en v0.12.2
  junto con `ImageCapture.takePhoto()` por precaución (ver esa entrada). Se
  reintroduce ahora solo, sin tocar la captura, tras confirmar con el usuario que
  el móvil se calienta y a veces se bloquea con la app abierta un rato *aunque no
  se capture nada* — un patrón que apunta al bucle de detección corriendo CLAHE +
  Canny + contornos en cada `requestAnimationFrame` (hasta 120 Hz en iPhones con
  ProMotion) más que a la API de captura, que ya no está en el código desde el
  revert anterior. Verificado con Playwright que el bucle corre a ~9.9 fps tras el
  cambio y que la detección, el flujo de galería y la sesión multipágina siguen
  funcionando sin errores de consola. **Pendiente de confirmar en un iPhone real**
  si esto resuelve el calentamiento/bloqueo — no se puede verificar ese punto
  específico desde aquí.

## [0.14.1] - 2026-09-16

### Fixed

- En pantallas bajas (p. ej. iPhone SE, ~667px de alto), la barra de páginas de
  la sesión multipágina empujaba el disparador y el botón de galería fuera del
  viewport, dejándolos casi invisibles y sin poder tocarlos. El problema ya
  existía en menor medida antes de la sesión multipágina (el espacio vertical
  se había ido ajustando entre varios cambios anteriores), pero la nueva barra
  lo hacía mucho más grave. Solución: el recuadro de la cámara (`.stage`) ahora
  usa `width: min(100%, calc(52dvh * 0.75))` en vez de un ancho fijo al 100%,
  con lo que se encoge proporcionalmente (ancho y alto a la vez, sin romper la
  proporción 3:4) solo en viewports realmente bajos, además de recortar un
  poco de espaciado vertical en varios elementos (cabecera, texto de ayuda,
  controles, barra de páginas). Verificado con Playwright en 667px (antes:
  ~119px de desbordamiento con la barra de páginas visible; ahora: ~19px de
  margen) y en 844px (sin regresión, todo sigue cabiendo perfectamente).

## [0.14.0] - 2026-09-16

### Added

- Sesión multipágina: el botón "+ Página" del resultado guarda la página actual
  (en el modo de salida que tuviera en ese momento) y vuelve a la cámara para la
  siguiente, en vez de forzar a descargar y empezar de cero cada vez. Una barra
  de páginas (con miniaturas y botón de quitar por página) queda visible en
  cualquier pantalla —cámara en vivo, ajuste o resultado— mientras la sesión
  siga activa, independientemente de la lógica de cambio de pantalla habitual.
- "Finalizar PDF" une todas las páginas guardadas en un único PDF (`jsPDF`,
  cargado por CDN solo la primera vez que hace falta, no en cada visita), cada
  página a su propio tamaño en píxeles en vez de forzar todas a un A4 fijo —
  verificado directamente contra la API real de jsPDF, incluyendo páginas de
  proporciones distintas dentro del mismo documento. Las imágenes se comprimen
  como JPEG (calidad 0.92): son fotos de papel, no gráficos con colores planos,
  así que la pérdida de PNG a JPEG es prácticamente imperceptible y el archivo
  final pesa mucho menos con varias páginas de por medio.
- "Descargar PNG" se mantiene sin cambios para quien solo quiera una página
  suelta al instante, sin usar la sesión multipágina en absoluto.

## [0.13.3] - 2026-09-16

### Fixed

- El botón de galería (en su propia fila desde v0.13.2) se quedaba visible en
  todas las pantallas, montado encima del selector de modo en la de resultado
  — las funciones que cambian de pantalla (`ui.js`) solo ocultaban
  `#live-controls`, y esa fila nueva es un elemento hermano aparte que nunca
  se añadió a esa lógica. Ahora se oculta/muestra junto con el resto de
  controles de la vista en vivo.

## [0.13.2] - 2026-09-16

### Changed

- El botón de galería pasa a su propia fila, centrado debajo del disparador,
  en vez de ir agrupado con el de ajuste manual — deja la fila principal
  simétrica (1 botón a cada lado del disparador).

## [0.13.1] - 2026-09-16

### Fixed

- El disparador dejó de quedar centrado en la fila de controles al añadir el
  botón de galería (quedaban 1 botón a su izquierda y 2 a su derecha, y un
  `flex` simple no puede centrar un elemento así). `#live-controls` pasa a
  usar una rejilla de 3 columnas (`1fr auto 1fr`) — los botones de cada lado
  se agrupan en sus propias columnas, siempre del mismo ancho, así que el
  disparador queda exactamente centrado sin importar cuántos botones haya a
  cada lado.

## [0.13.0] - 2026-09-16

### Added

- Opción para elegir una foto de la galería en vez de usar la cámara en vivo, vía
  un `<input type="file">` estándar. Es una vía de escaneo completamente
  independiente de `getUserMedia`/el bucle de detección/`ImageCapture` — sigue
  funcionando igual aunque haya algún problema con la cámara en vivo en un
  dispositivo concreto (ver las notas de iOS sin resolver en versiones
  anteriores). La foto elegida siempre entra en el ajuste manual de esquinas,
  ya que no existe ninguna detección automática previa sobre una imagen que no
  pasó por la cámara en directo.

## [0.12.2] - 2026-09-16

### Reverted

- **Revertidas v0.12.0 (captura con `ImageCapture.takePhoto()`) y v0.12.1 (límite
  de ~10 fps en el bucle de detección)**, a petición explícita tras reportarse que
  la app (y el teléfono) seguían bloqueándose en iOS incluso después del fix de
  v0.12.1. Como los reportes mencionaban específicamente "la foto", y un bloqueo
  dentro de una API nativa del navegador no tiene por qué ser rescatable por un
  timeout en JS de la forma en que sí lo sería un bloqueo en JS normal, se optó
  por revertir en vez de seguir apilando intentos de arreglo sin poder verificar
  en el dispositivo real. La causa raíz **no está confirmada** — queda documentado
  en detalle en el CLAUDE.md local para retomarlo con contexto si hace falta.
- El código vuelve al estado de antes de v0.12.0: `grabFullFrame()` es de nuevo
  síncrona (solo `drawImage(video, ...)`, sin `ImageCapture`), y el bucle de
  detección vuelve a correr sin límite de fotogramas (una vez por
  `requestAnimationFrame`).

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

[Unreleased]: https://github.com/rzazo24/zscanner/compare/v0.14.0...HEAD
[0.14.0]: https://github.com/rzazo24/zscanner/compare/v0.13.3...v0.14.0
[0.13.3]: https://github.com/rzazo24/zscanner/compare/v0.13.2...v0.13.3
[0.13.2]: https://github.com/rzazo24/zscanner/compare/v0.13.1...v0.13.2
[0.13.1]: https://github.com/rzazo24/zscanner/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/rzazo24/zscanner/compare/v0.12.2...v0.13.0
[0.12.2]: https://github.com/rzazo24/zscanner/compare/v0.11.0...v0.12.2
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
