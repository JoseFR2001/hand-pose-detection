# Trabajo Práctico: Detección y Seguimiento de Manos en Tiempo Real

Este proyecto implementa y analiza el modelo de aprendizaje automático **MediaPipe Hands** (desarrollado por Google) para la detección y seguimiento de puntos clave (landmarks) de las manos en tiempo real a través de la webcam en el navegador.

---

## 📋 Cuestionario Evaluativo

### 1. ¿Cuál es el objetivo del modelo?
El objetivo principal de **MediaPipe Hands** es realizar el seguimiento y la reconstrucción en 3D de la pose física de las manos en tiempo real a partir de un flujo de video (cámara web). 
El modelo localiza de manera precisa **21 puntos clave tridimensionales (landmarks)** en cada mano detectada (articulaciones, muñeca y puntas de los dedos).

---

### 2. ¿Quiénes lo desarrollaron?
Fue desarrollado por el equipo de investigación en Inteligencia Artificial y Visión por Computadora de **Google** (Google Research / Google AI Edge) y forma parte del ecosistema de código abierto **MediaPipe**, diseñado para construir pipelines de aprendizaje automático aplicados a datos multimedia.

---

### 3. ¿Con qué datos fue entrenado?
El modelo fue entrenado utilizando un conjunto de datos masivo y diverso:
* **Imágenes del mundo real:** Cerca de 30,000 imágenes reales de manos en diversas condiciones de iluminación, fondos variados, tonos de piel y oclusiones físicas de los dedos, anotadas manualmente con coordenadas 2D.
* **Modelos sintéticos 3D:** Renderizados digitales en 3D de manos virtuales con diferentes poses para obtener anotaciones de profundidad tridimensional (`Z` relativas a la muñeca) extremadamente precisas, imposibles de etiquetar a mano de forma exacta en fotos planas.

---

### 4. Estructura del modelo y su funcionamiento
MediaPipe Hands funciona mediante un *pipeline* optimizado de dos modelos cooperativos (enfoque de cascada):

1. **Detector de Palmas (Palm Detector):**
   * Es una red neuronal de detección de objetos basada en **Single Shot Multibox Detector (SSD)** optimizada para móviles y web.
   * En lugar de buscar toda la mano entera (lo cual es difícil porque los dedos se mueven y cambian de forma), el detector se enfoca en localizar la **palma de la mano** y el puño (que son formas mucho más rígidas y estables).
   * Genera un cuadro delimitador (bounding box) alrededor de la mano detectada.

2. **Modelo de Puntos Clave (Hand Landmark Model):**
   * Recibe la imagen recortada de la palma generada por el paso anterior.
   * Realiza una regresión matemática para predecir las **coordenadas 3D de los 21 puntos clave** de la mano.
   * Además, predice dos métricas adicionales:
     * **Probabilidad de presencia:** Si decae por debajo de un umbral, el sistema vuelve a activar el detector de palmas.
     * **Lateralidad (Handedness):** Clasifica si es la mano izquierda o derecha.

---

### 5. ¿En qué áreas de la vida real puede aplicarse?
* **Realidad Virtual y Aumentada (VR/AR):** Interacción natural sin necesidad de mandos físicos (como en las gafas Apple Vision Pro o Meta Quest).
* **Control por Gestos (Hands-Free UI):** Controlar interfaces multimedia, televisores inteligentes o dispositivos médicos en quirófanos sin tocar superficies físicas.
* **Traducción de Lengua de Señas:** Automatización del reconocimiento de letras y palabras para personas sordas.
* **Rehabilitación Médica:** Monitoreo del rango de movimiento de las articulaciones de los pacientes en terapias kinesiológicas.
* **Videojuegos e Interacción Humano-Computadora (HCI):** Control de avatares virtuales o mecánicas basadas en gestos de la mano.

---

### 6. ¿Qué dificultades encontraron al momento de hacerlo funcionar?
* **Políticas de Seguridad del Navegador (Secure Context):** Las APIs de acceso a dispositivos de captura de video (`getUserMedia`) están restringidas por seguridad a contextos seguros (`HTTPS` o `localhost`). Al abrir el archivo localmente (`file:///`), el navegador bloquea la cámara.
* **Carga de Archivos WebAssembly (WASM):** El motor matemático de MediaPipe corre sobre archivos `.wasm`. Cargar estos recursos binarios externamente desde CDNs puede generar demoras en la inicialización o bloqueos de CORS si no se configuran correctamente las cabeceras de red.

---

## 🔄 Modelo Alternativo (TensorFlow.js Handpose)

Para cumplir con la consigna de implementar un modelo similar basado directamente en **TensorFlow.js**, se puede utilizar el paquete oficial de TensorFlow: `@tensorflow-models/handpose` (o su versión más moderna integrada en `@tensorflow-models/hand-pose-detection` con el backend de TensorFlow).

### Comparativa Técnica:
* **MediaPipe Hands (Tasks Vision):** Es sumamente rápido, está escrito en C++ compilado a WebAssembly (WASM) y utiliza aceleración de GPU nativa mediante WebGL.
* **TensorFlow.js Handpose:** Utiliza los tensores de TensorFlow.js bajo un wrapper JS. Tiende a ser ligeramente más pesado de inicializar en el navegador, pero ofrece un control de bajo nivel muy potente si se desean entrenar capas clasificadoras personalizadas encima del modelo usando `tf.js`.

---

## 📈 Análisis del Estado Actual de este Tipo de Modelos

### ¿Siguen vigentes?
**Sí, absolutamente.** Estos modelos basados en redes neuronales convolucionales (CNN) ligeras y optimizadas para *Edge Computing* (procesamiento en el dispositivo del cliente) son indispensables hoy en día para aplicaciones de baja latencia en navegadores web y smartphones.

### ¿Fueron reemplazados por otros enfoques más modernos?
* **En el dispositivo (Edge):** No han sido reemplazados, ya que arquitecturas masivas como los Transformers tradicionales consumen demasiados recursos (batería, memoria, CPU) para correr en tiempo real a 60 FPS dentro de una pestaña web.
* **En servidores / investigación:** Sí existen enfoques más modernos basados en **Vision Transformers (ViTs)** y modelos generativos espaciales que estiman no solo 21 puntos, sino la **malla tridimensional completa de la piel (3D Hand Mesh Reconstruction)**.

### ¿Qué avances relevantes existen en la actualidad?
1. **Modelos Multimodales en Tiempo Real:** Integración de la detección de manos con comandos de voz mediante modelos locales pequeños (SLMs) que permiten interacciones complejas.
2. **Seguimiento Multimano Masivo:** Capacidad de seguir de forma estable más de 2 manos simultáneamente en entornos interactivos colaborativos.
3. **Sensores de Profundidad Integrados:** Los modelos actuales combinan los datos de cámaras RGB estándar con sensores LiDAR/ToF de los smartphones modernos para mejorar la precisión del eje `Z` (profundidad).
