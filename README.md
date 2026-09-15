# <img src="favicon.svg" width="30" height="30" align="absmiddle" alt=""> ZScanner

![Version](https://img.shields.io/badge/version-0.5.2-3ef27a?style=flat)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat&logo=opencv&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)

Escáner de documentos que corre entero en el navegador: detecta el documento con la
cámara, corrige la perspectiva y exporta un PNG limpio en blanco y negro, escala de
grises o color — sin subir nada a ningún servidor. Toda la visión por computador
(detección de bordes, contornos y `warpPerspective`) la hace [OpenCV.js](https://docs.opencv.org/4.9.0/opencv.js)
cargado por CDN.

Uno más de una serie de proyectos pequeños para portfolio, junto a
[BusYa](https://github.com/rzazo24/busya) (tiempos de paso EMT/CRTM) y
[Disaster Watch](https://github.com/rzazo24/disaster-watch) (alertas globales GDACS).

**Demo en vivo:** https://zscanner.vercel.app/

## Cómo funciona

- La cámara trasera se abre con `getUserMedia` y, en cada frame, un bucle de detección
  corre el documento a través de OpenCV.js: gris → `GaussianBlur` → `Canny` →
  `findContours` → `approxPolyDP`, buscando el cuadrilátero convexo más grande. El
  contorno detectado se dibuja en tiempo real sobre el preview.
- Los umbrales de `Canny` se recalculan en cada frame a partir de la mediana de brillo de
  la imagen (heurística estándar, sigma=0.33), en vez de usar un par de valores fijos —
  así la detección se adapta sola a luz mala o poco contraste en vez de depender de un
  ajuste manual único que solo funciona bien en una escena.
- La detección exige varios frames consecutivos con un cuadrilátero similar antes de
  marcarlo como "detectado" (evita que el estado parpadee con ruido puntual), y tolera
  unos cuantos frames sin detección antes de soltar el bloqueo (una mano cruzando el
  encuadre, un poco de desenfoque de movimiento) en vez de perderlo al instante.
- Con el documento detectado, el disparador captura directamente: recorta con
  `getPerspectiveTransform` + `warpPerspective` usando las 4 esquinas encontradas,
  escaladas a resolución completa.
- Si la detección automática falla, o si el resultado no queda bien encuadrado, hay una
  red de seguridad: el botón de encuadre manual (o "Ajustar" ya en el resultado) congela
  el frame y muestra las 4 esquinas como puntos arrastrables para corregirlas a mano
  antes de aplicar la corrección de perspectiva.
- El resultado se puede ver en tres modos — blanco y negro (`adaptiveThreshold`), escala
  de grises o color — y descargarse como PNG.
- Es una PWA instalable en el móvil (icono en pantalla de inicio, pantalla completa sin
  barra del navegador). Un service worker (`sw.js`) cachea el shell estático de la app
  (HTML/CSS/JS/iconos) con estrategia stale-while-revalidate, para que cargue al instante
  y la interfaz funcione sin conexión en visitas repetidas; si detecta una versión nueva
  mientras la app está abierta, muestra un aviso con un botón para recargar en vez de
  hacerlo solo (podría cortar una captura o un arrastre de esquinas en curso).

### Parámetros de detección ajustables

El área mínima del contorno, el tamaño del blur, el epsilon de `approxPolyDP`, y los
frames requeridos para bloquear/soltar la detección, son overridables por query string,
para probar valores distintos sin tocar código. Pasar `cannyLow`/`cannyHigh` explícitos
desactiva el cálculo automático por mediana y fuerza esos valores fijos (o desactívalo a
mano con `autoCanny=0`):

```
index.html?minArea=0.1&cannyLow=40&cannyHigh=120&blur=7&epsilon=0.015&stableFrames=3&missGrace=8
```

Añadiendo `?debug=1` aparece además un panel con sliders para los mismos parámetros,
con el valor aplicándose en vivo al siguiente frame.

## Limitaciones conocidas

- OpenCV.js pesa ~10 MB y se sirve desde un CDN de terceros: el service worker no lo
  cachea a propósito (es cross-origin, y una respuesta opaca no permite distinguir un
  fetch fallido de uno correcto), así que la primera carga en cada dispositivo depende de
  la conexión. Se apoya en la caché HTTP normal del navegador (24h) para las recargas
  siguientes.
- La detección depende de contraste entre el documento y la superficie — fondos muy
  claros o con poca luz pueden requerir el ajuste manual de esquinas.
- Procesa un documento a la vez; no hay modo de captura por lotes ni PDF multipágina.

## Posibles mejoras futuras

- **Detección de esquinas por red neuronal en vez de Canny+contornos.** Apps como
  CamScanner ya no usan visión clásica: entrenan una CNN ligera para predecir
  directamente las 4 esquinas, lo que aguanta mucho mejor fondos de bajo contraste o
  escenas con desorden. [DocAligner](https://github.com/DocsaidLab/DocAligner)
  (Apache 2.0) es un proyecto open-source real que hace esto, exportado a ONNX, con
  una demo que corre en el navegador vía `onnxruntime-web`. No es un simple añadido:
  sería un modelo extra que descargar (además de OpenCV.js, no en su lugar), y las
  implementaciones que existen usan un bundler porque el backend WASM rápido de
  `onnxruntime-web` necesita cabeceras `Cross-Origin-Opener-Policy`/
  `Cross-Origin-Embedder-Policy` para `SharedArrayBuffer` (configurables en Vercel sin
  build step, pero no es un CDN-y-listo como OpenCV.js). Si se aborda, mejor como
  modo opt-in (p. ej. `?ml=1`) que conviva con el pipeline clásico, no como reemplazo.

## Stack

- Vanilla HTML/CSS/JS, sin frameworks ni build step. La lógica se separa en módulos ES
  nativos (`js/*.js` con `import`/`export`) que el navegador resuelve directamente, sin
  bundler.
- PWA instalable: `manifest.webmanifest` + `sw.js`, sin ninguna librería de terceros.
- Pensado para desplegarse como sitio estático en Vercel.

## Estructura

```
zscanner/
├── css/
│   └── styles.css
├── js/
│   ├── dom.js           # referencias a elementos del DOM
│   ├── state.js         # estado mutable compartido entre módulos
│   ├── ui.js             # transiciones entre las 3 pantallas (cámara/ajuste/resultado)
│   ├── camera.js         # getUserMedia y mapeo de coordenadas vídeo → stage
│   ├── detection.js       # pipeline de OpenCV.js + parámetros ajustables
│   ├── adjust.js          # esquinas arrastrables sobre el frame congelado
│   ├── perspective.js      # warpPerspective + modos de salida + descarga
│   └── main.js             # orquestación: carga de OpenCV.js, SW y listeners de botones
├── icons/                  # iconos de la PWA (192/512/512-maskable/apple-touch-icon)
├── index.html
├── favicon.svg
├── manifest.webmanifest
├── sw.js                   # service worker: cachea el shell estático, nunca OpenCV.js
├── LICENSE
├── CHANGELOG.md
└── README.md
```

## Desarrollo local

No requiere instalación de dependencias ni build step. Basta con servir los archivos
estáticos, por ejemplo:

```bash
python3 -m http.server 8000
# o: npx serve .
```

Y abrir `http://localhost:8000` en el navegador. La cámara requiere HTTPS o `localhost`
(la excepción que los navegadores hacen para `getUserMedia` en desarrollo).

## Despliegue en Vercel

Sin configuración de build: Vercel sirve `index.html`, `css/` y `js/` tal cual como
sitio estático.

## Historial de versiones

Ver [CHANGELOG.md](CHANGELOG.md).

## Licencia

Código bajo licencia MIT (ver [LICENSE](LICENSE)). OpenCV.js se carga desde su propio
CDN oficial y se rige por su propia licencia (Apache 2.0).
