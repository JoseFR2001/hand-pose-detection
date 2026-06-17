# HandPose AI: Dashboard de Detección de Manos en Tiempo Real

Este proyecto es una aplicación web interactiva desarrollada para el examen del segundo parcial de la materia **Seminario de Actualización** de la carrera **Técnico Superior en Desarrollo de Software Multiplataforma (TSDSM)** (IPF 2026).

### 👥 Integrantes del Grupo

- **Mendoza José Francisco Rafael**
- **Miño Presentado Santiago**
- **Rodríguez Gonzalo Luis**

La aplicación integra dos modelos diferentes de estimación de pose de manos (uno moderno y uno legado) y sirve como soporte de exposición para responder a las preguntas teóricas de la consigna.

---

## 🚀 Características de la Aplicación

1. **Dashboard Sci-Fi de Alto Impacto**: Diseñado con un tema oscuro futurista (`#0a0e1a`), bordes glowing de neón y tarjetas con efecto _glassmorphism_ (desenfoque de fondo).
2. **Doble Modelo con Enrutamiento Hash**:
   - `#/modern`: Ejecuta el modelo **MediaPipe Hands** (Moderna), permitiendo la detección fluida de hasta 2 manos de forma simultánea.
   - `#/legacy`: Ejecuta el modelo clásico **TF.js Handpose** (Legado), limitado a rastrear una sola mano a la vez con mayor latencia.
3. **Módulo de Postura Prohibida (Prototipo 2)**: Permite registrar una pose de la mano del usuario en caliente y guardarla de forma persistente en `localStorage`. El sistema normaliza las coordenadas (independientemente del tamaño y la posición de la mano en pantalla) y compara en tiempo real (incluso en espejo) para disparar un parpadeo de alerta roja si coincide.
4. **Métricas en Tiempo Real**: Visualización en caliente de FPS, latencia de inferencia en milisegundos y contador de manos detectadas en pantalla.
5. **Edge AI 100% Offline**: Los archivos WebAssembly y modelos del detector moderno se sirven localmente desde el servidor de desarrollo (`public/mediapipe/`), permitiendo que la aplicación se inicialice sin necesidad de acceso a internet.
6. **Diapositivas Integradas**: Un sistema de pestañas interactivas en el pie de página que permite presentar el contenido teórico directamente desde la misma web del proyecto.

---

## 📖 Respuestas a las Consignas del Trabajo

### 1. ¿Cuál es el objetivo del modelo?

El objetivo de **MediaPipe Hands** es estimar la estructura ósea y las articulaciones de la mano humana en tiempo real a partir de un flujo de video estándar en 2D (cámara web convencional), sin requerir hardware de profundidad costoso. El modelo predice la ubicación tridimensional (coordenadas X, Y y una profundidad Z estimada) de **21 puntos clave anatómicos** (landmarks) en cada mano.

---

### 2. ¿Quiénes lo desarrollaron?

El modelo fue desarrollado y publicado por el equipo de investigadores de **Google AI / Google Research** en el año 2019, formando parte del framework de código abierto de visión artificial **MediaPipe**.

---

### 3. ¿Con qué datos fue entrenado?

El modelo fue entrenado mediante un dataset mixto que combina:

- **Imágenes del mundo real**: Aproximadamente **30,000 imágenes reales** con gran diversidad de tonos de piel, condiciones de luz y fondos, etiquetadas manualmente con coordenadas 2D.
- **Modelos Sintéticos 3D**: Google renderizó manos sintéticas en 3D de alta fidelidad sobre fondos variables. Esto proveyó al modelo de datos tridimensionales exactos para aprender a predecir la coordenada Z (profundidad estimada) ante dobleces y oclusiones de dedos.

---

### 4. Estructura del modelo y su funcionamiento

El sistema opera mediante un **pipeline de dos etapas secuenciales** para optimizar el consumo de batería y CPU/GPU:

1. **Detector de Palmas (BlazePalm)**: Una red neuronal convolucional ultra-rápida que escanea el frame completo buscando la presencia de palmas. Al buscar solo palmas en lugar de dedos, reduce el espacio de búsqueda. Define una caja delimitadora (Bounding Box) alrededor de la mano.
2. **Modelo de Puntos Clave (Hand Landmark Model)**: Toma la región recortada de la palma y realiza una regresión directa para predecir las posiciones tridimensionales de los 21 puntos clave. En frames subsiguientes, el sistema asume que la mano se movió poco y realiza un autoseguimiento usando la caja anterior, ejecutando el detector BlazePalm solo cuando se pierde el rastro de la mano.

---

### 5. ¿En qué áreas de la vida real puede aplicarse?

- **Traducción de Lengua de Señas**: Interpretación en tiempo real del abecedario dactilológico y vocabulario para personas con discapacidad auditiva.
- **Interfaces sin contacto (Touchless UIs)**: Manejo de pantallas en quirófanos médicos, cabinas industriales o terminales públicas para higiene y seguridad.
- **Realidad Virtual y Aumentada (XR/VR)**: Control natural de menús y objetos tridimensionales simulados usando las propias manos en lugar de mandos físicos (ej. Oculus Quest, Apple Vision Pro).

---

### 6. ¿Qué dificultades encontraron al momento de hacerlo funcionar? (Foco de Desarrollo)

#### A. Incompatibilidad del Modelo TensorFlow.js Clásico en Bundlers Modernos (Vite/Rollup)

La principal dificultad del proyecto radicó en que el paquete clásico de TensorFlow.js (`@tensorflow-models/handpose` e incluso `@mediapipe/hands` instalado vía npm) **no está empaquetado bajo los estándares modernos de ES Modules (ESM)**.

- Al intentar compilar o ejecutar el servidor con Vite, el empaquetador arrojaba el error fatal:
  `[MISSING_EXPORT] "Hands" is not exported by "node_modules/@mediapipe/hands/hands.js"`
- Esto ocurre porque el código interno de la librería de TensorFlow realiza una importación estática de `Hands` desde un script compilado en formato CommonJS/UMD que no expone ese nombre directamente.
- **Solución implementada**: Creamos un **Proxy Shim personalizado (`src/mediapipe-hands-shim.js`)** y configuramos un alias en `vite.config.js`. Este shim intercepta la importación de `@mediapipe/hands` a nivel del bundler y delega la ejecución al script global de MediaPipe. Además, cargamos la librería base directamente en el `index.html` para asegurar que `window.Hands` esté disponible globalmente antes del inicio de la aplicación.

#### B. Dependencia de Conexión de Red para Cargar Assets

Por defecto, el runtime de MediaPipe intenta descargar archivos WebAssembly (`.wasm`) y pesos del modelo de internet en cada inicio de la app. Si la conexión de la universidad falla el día del examen, el modelo no cargaría.

- **Solución implementada**: Copiamos todos los binarios y modelos (.tflite, .wasm, .data) desde `node_modules/@mediapipe/hands` a la carpeta local pública `/public/mediapipe/`. Cambiamos la configuración de `solutionPath` en el detector a `/mediapipe` para forzar la carga 100% local y offline.

#### C. Espejado de Coordenadas

Al mostrar el video espejado para comodidad del usuario, el canvas debe reflejarse. Sin embargo, si se le pasa el video espejado a la red de TensorFlow, la velocidad disminuye.

- **Solución implementada**: Alimentamos al modelo con la imagen cruda sin reflejar, y aplicamos una transformación manual de coordenadas sobre los landmarks resultantes antes de dibujarlos en el canvas: `X_dibujo = Ancho_Canvas - X_estimada`.

---

## 📈 Análisis del Estado Actual de estos Modelos

### ¿Siguen vigentes?

**Sí.** Los modelos basados en pipelines livianos como **MediaPipe Hands** siguen plenamente vigentes para aplicaciones de cliente final (Edge AI), ya que logran una velocidad de ejecución en navegadores estándar (30-60 FPS) que los hace ideales para interacción en tiempo real en computadoras de oficina y teléfonos móviles de gama media. Por el contrario, el modelo clásico **TF.js Handpose** está **obsoleto y discontinuado** debido a sus limitaciones de rastreo monomano y mayor consumo de GPU.

### ¿Fueron reemplazados por enfoques más modernos?

En el ámbito de alta investigación y dispositivos dedicados, sí. Están siendo reemplazados por:

- **Vision Transformers (ViT)** (como ViTPose): Arquitecturas basadas en Transformers de atención visual que mejoran el rastreo bajo oclusiones complejas (dedos cruzados) y estiman mallas más exactas, aunque a expensas de requerir tarjetas gráficas potentes.
- **Seguimiento Holístico de un solo paso**: Modelos integrados de extremo a extremo que detectan cuerpo, rostro y manos simultáneamente en una sola red neuronal unificada, en lugar de ejecutar múltiples sub-redes encadenadas.

### ¿Qué avances relevantes existen en la actualidad?

1. **Reconstrucción de Malla 3D Completa**: En lugar de estimar solo 21 articulaciones (esqueleto), los modelos de última generación reconstruyen una **malla tridimensional densa de 778 vértices** que estima el volumen de la mano y de la piel para una interacción física más real.
2. **Coprocesadores NPU en Realidad Extendida**: Cascos como las Apple Vision Pro o Meta Quest 3 integran chips de redes neuronales (NPU) a nivel de silicio específicamente programados para procesar imágenes infrarrojas y mapear las manos a 90Hz con un consumo ínfimo de batería.

---

## 🛠️ Tecnologías Utilizadas

- **HTML5 & Vanilla CSS**: Maquetado semántico y diseño sci-fi.
- **Vite 8**: Servidor de desarrollo rápido con Hot Module Replacement (HMR).
- **JavaScript (ES6+)**: Lógica del enrutador, cálculo de FPS, y normalización matemática.
- **TensorFlow.js (TFJS)**: Ejecución y adaptador del modelo clásico.
- **MediaPipe Hands**: Inferencia de alto rendimiento en WebAssembly local para el modelo moderno.

---

## 💻 Instalación y Ejecución Local

Para ejecutar la aplicación localmente en tu máquina:

1. **Instalar Dependencias**:

   ```bash
   npm install
   ```

2. **Iniciar Servidor de Desarrollo**:

   ```bash
   npm run dev
   ```

3. **Abrir en Navegador**:
   Accede a la dirección local que arroja la consola (usualmente [http://localhost:5173/](http://localhost:5173/)).
