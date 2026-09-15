# <img src="favicon.svg" width="30" height="30" align="absmiddle" alt=""> ZScanner

![Version](https://img.shields.io/badge/version-0.3.0-3ef27a?style=flat)
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
- Con el documento detectado, el disparador captura directamente: recorta con
  `getPerspectiveTransform` + `warpPerspective` usando las 4 esquinas encontradas,
  escaladas a resolución completa.
- Si la detección automática falla, o si el resultado no queda bien encuadrado, hay una
  red de seguridad: el botón de encuadre manual (o "Ajustar" ya en el resultado) congela
  el frame y muestra las 4 esquinas como puntos arrastrables para corregirlas a mano
  antes de aplicar la corrección de perspectiva.
- El resultado se puede ver en tres modos — blanco y negro (`adaptiveThreshold`), escala
  de grises o color — y descargarse como PNG.

### Parámetros de detección ajustables

El área mínima del contorno, los umbrales de `Canny`, el tamaño del blur y el epsilon de
`approxPolyDP` son overridables por query string, para probar valores distintos sin tocar
código:

```
index.html?minArea=0.1&cannyLow=40&cannyHigh=120&blur=7&epsilon=0.015
```

Añadiendo `?debug=1` aparece además un panel con sliders para los mismos parámetros,
con el valor aplicándose en vivo al siguiente frame.

## Limitaciones conocidas

- OpenCV.js pesa ~10 MB; la primera carga depende de la conexión y no hay caché
  offline (no hay service worker, a diferencia de otros proyectos de la serie).
- La detección depende de contraste entre el documento y la superficie — fondos muy
  claros o con poca luz pueden requerir el ajuste manual de esquinas.
- Procesa un documento a la vez; no hay modo de captura por lotes ni PDF multipágina.

## Stack

- Vanilla HTML/CSS/JS, sin frameworks ni build step. La lógica se separa en módulos ES
  nativos (`js/*.js` con `import`/`export`) que el navegador resuelve directamente, sin
  bundler.
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
│   └── main.js             # orquestación: carga de OpenCV.js y listeners de botones
├── index.html
├── favicon.svg
├── LICENSE
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
