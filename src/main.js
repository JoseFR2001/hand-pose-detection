import './style.css';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';

// ==========================================================================
// STATE & CONFIGURATION VARIABLES
// ==========================================================================
let currentRoute = 'modern'; // 'modern' or 'legacy'

// --- MODEL 1: MODERN (MediaPipe Hands) ---
let detector = null;
let activeStream = null;
let isCameraActive = false;
let rafId = null;

let maxHands = 2;
let minConfidence = 0.65;

// Forbidden Pose Configuration & State
let forbiddenPose = null;
let matchThreshold = 85;
let lastDetectedHands = []; // Cache to store hands for capture

// Performance metrics (Modern)
let fpsCount = 0;
let lastFpsUpdate = 0;
let frameCount = 0;


// --- MODEL 2: LEGACY (TF.js Handpose) ---
let legacyModel = null;
let activeStreamLegacy = null;
let isLegacyCameraActive = false;
let rafIdLegacy = null;

let minConfidenceLegacy = 0.75;

// Performance metrics (Legacy)
let fpsCountLegacy = 0;
let lastFpsUpdateLegacy = 0;
let frameCountLegacy = 0;


// ==========================================================================
// DOM ELEMENT SELECTORS
// ==========================================================================

// --- Shared Elements ---
const elStatusDot = document.getElementById('status-dot');
const elStatusText = document.getElementById('status-text');

// --- Page 1: Modern (MediaPipe) Elements ---
const elVideo = document.getElementById('webcam');
const elCanvas = document.getElementById('output-canvas');
const ctx = elCanvas.getContext('2d');

const elBtnToggleCamera = document.getElementById('btn-toggle-camera');
const elBtnCameraText = document.getElementById('btn-camera-text');
const elCameraSelectGroup = document.getElementById('camera-select-group');
const elCameraSelect = document.getElementById('camera-select');

const elSliderMaxHands = document.getElementById('max-hands');
const elValMaxHands = document.getElementById('val-max-hands');
const elSliderConfidence = document.getElementById('min-confidence');
const elValConfidence = document.getElementById('val-confidence');

const elMetricFps = document.getElementById('metric-fps');
const elMetricLatency = document.getElementById('metric-latency');
const elMetricHandsCount = document.getElementById('metric-hands-count');

const elLoadingOverlay = document.getElementById('viewport-loading');
const elLoadingDetail = document.getElementById('loading-detail-text');
const elIdleOverlay = document.getElementById('viewport-idle');
const elViewportContainer = document.querySelector('.viewport-container');

// Forbidden Pose Elements
const elBtnCapturePose = document.getElementById('btn-capture-pose');
const elBtnClearPose = document.getElementById('btn-clear-pose');
const elMatchThreshold = document.getElementById('match-threshold');
const elValMatchThreshold = document.getElementById('val-match-threshold');
const elValCurrentSimilarity = document.getElementById('val-current-similarity');
const elSimilarityProgress = document.getElementById('similarity-progress');
const elAlertBanner = document.getElementById('alert-banner');
const elPoseRegisteredStatus = document.getElementById('pose-registered-status');


// --- Page 2: Legacy (TF.js Handpose) Elements ---
const elVideoLegacy = document.getElementById('webcam-legacy');
const elCanvasLegacy = document.getElementById('output-canvas-legacy');
const ctxLegacy = elCanvasLegacy.getContext('2d');

const elBtnToggleCameraLegacy = document.getElementById('btn-toggle-camera-legacy');
const elBtnCameraTextLegacy = document.getElementById('btn-camera-text-legacy');
const elCameraSelectGroupLegacy = document.getElementById('camera-select-group-legacy');
const elCameraSelectLegacy = document.getElementById('camera-select-legacy');

const elSliderConfidenceLegacy = document.getElementById('min-confidence-legacy');
const elValConfidenceLegacy = document.getElementById('val-confidence-legacy');

const elMetricFpsLegacy = document.getElementById('metric-fps-legacy');
const elMetricLatencyLegacy = document.getElementById('metric-latency-legacy');
const elMetricHandsCountLegacy = document.getElementById('metric-hands-count-legacy');

const elStatusDotLegacy = document.getElementById('status-dot-legacy');
const elStatusTextLegacy = document.getElementById('status-text-legacy');
const elLoadingOverlayLegacy = document.getElementById('viewport-loading-legacy');
const elIdleOverlayLegacy = document.getElementById('viewport-idle-legacy');
const elViewportContainerLegacy = elCanvasLegacy.parentElement;


// ==========================================================================
// SKELTON CONNECTIONS & COLORING HELPERS
// ==========================================================================
const connections = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index Finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle Finger
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring Finger
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];

function getKeypointColor(index) {
  if (index === 0) return '#f43f5e';       // Wrist - Rose/Red
  if (index >= 1 && index <= 4) return '#ff7849';   // Thumb - Orange
  if (index >= 5 && index <= 8) return '#ffc82c';   // Index - Yellow
  if (index >= 9 && index <= 12) return '#13ce66';  // Middle - Green
  if (index >= 13 && index <= 16) return '#00b4d8'; // Ring - Cyan/Blue
  if (index >= 17 && index <= 20) return '#9d4edd'; // Pinky - Purple
}


// ==========================================================================
// CLIENT-SIDE ROUTING LOGIC
// ==========================================================================
function handleRoute() {
  const hash = window.location.hash;
  
  // 1. Stop all cameras when switching models
  stopCamera();
  stopCameraLegacy();
  
  // 2. Select DOM View Elements
  const navModern = document.getElementById('nav-modern');
  const navLegacy = document.getElementById('nav-legacy');
  const pageModern = document.getElementById('page-modern');
  const pageLegacy = document.getElementById('page-legacy');
  
  const badgeModern = document.getElementById('model-status-badge');
  const badgeLegacy = document.getElementById('model-status-badge-legacy');
  
  // 3. Switch layout based on route hash
  if (hash === '#/legacy') {
    currentRoute = 'legacy';
    
    // UI active states
    navModern.classList.remove('active');
    navLegacy.classList.add('active');
    pageModern.classList.remove('active-page');
    pageLegacy.classList.add('active-page');
    
    badgeModern.style.display = 'none';
    badgeLegacy.style.display = 'flex';
    
    // Lazy-load legacy handpose model if not loaded yet
    if (!legacyModel) {
      loadLegacyModel();
    }
  } else {
    currentRoute = 'modern';
    
    // UI active states
    navModern.classList.add('active');
    navLegacy.classList.remove('active');
    pageModern.classList.add('active-page');
    pageLegacy.classList.remove('active-page');
    
    badgeModern.style.display = 'flex';
    badgeLegacy.style.display = 'none';
  }
}


// ==========================================================================
// INITIALIZATION
// ==========================================================================
async function init() {
  setupTabs();
  setupEventListeners();
  
  // Load saved forbidden pose from localStorage if exists
  const savedPose = localStorage.getItem('forbiddenPose');
  if (savedPose) {
    try {
      forbiddenPose = JSON.parse(savedPose);
      updatePoseUIState(true);
    } catch (e) {
      console.error("Error cargando la postura prohibida guardada:", e);
    }
  }
  
  // Trigger initial routing setup
  handleRoute();
  
  // Load main modern MediaPipe detector
  try {
    updateStatus('Cargando MediaPipe...', 'red');
    elLoadingDetail.textContent = 'Cargando pesos y config de MediaPipe Hands (Local)...';
    
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    detector = await handPoseDetection.createDetector(model, {
      runtime: 'mediapipe',
      solutionPath: '/mediapipe',
      modelType: 'full'
    });
    
    updateStatus('MediaPipe Listo', 'green');
    
    // Load available camera devices for modern page
    await loadCameras();
    
    elLoadingOverlay.classList.remove('active');
    elIdleOverlay.classList.add('active');
    
  } catch (error) {
    console.error('Error inicializando el modelo MediaPipe:', error);
    updateStatus('Error al Cargar MediaPipe', 'red');
    elLoadingDetail.innerHTML = `<span style="color:#ef4444;">Error: ${error.message}. Por favor verifica los archivos locales.</span>`;
  }
}

// Update status badge for MediaPipe Hands
function updateStatus(text, type) {
  elStatusText.textContent = text;
  elStatusDot.className = 'badge-dot';
  if (type === 'green') {
    elStatusDot.classList.add('pulse-green');
  } else {
    elStatusDot.classList.add('pulse-red');
  }
}

// Update status badge for Legacy TF.js
function updateStatusLegacy(text, type) {
  elStatusTextLegacy.textContent = text;
  elStatusDotLegacy.className = 'badge-dot';
  if (type === 'green') {
    elStatusDotLegacy.classList.add('pulse-green');
  } else {
    elStatusDotLegacy.classList.add('pulse-red');
  }
}


// ==========================================================================
// FORBIDDEN POSE ALGORITHMS (NORMALIZATION & COMPARISON)
// ==========================================================================
function normalizeHand(keypoints) {
  const wrist = keypoints[0];
  
  // Step 1: Translation relative to wrist
  const translated = keypoints.map(pt => ({
    x: pt.x - wrist.x,
    y: pt.y - wrist.y,
    z: pt.z !== undefined ? pt.z - wrist.z : 0
  }));

  // Step 2: Scale estimation (max Euclidean distance from wrist)
  let maxDist = 0.001;
  translated.forEach(pt => {
    const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y + pt.z * pt.z);
    if (dist > maxDist) maxDist = dist;
  });

  // Step 3: Normalize
  return translated.map(pt => ({
    x: pt.x / maxDist,
    y: pt.y / maxDist,
    z: pt.z / maxDist
  }));
}

function compareHands(handA, handB) {
  let sumDist = 0;
  for (let i = 0; i < 21; i++) {
    const dx = handA[i].x - handB[i].x;
    const dy = handA[i].y - handB[i].y;
    const dz = handA[i].z - handB[i].z;
    sumDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  const avgDist = sumDist / 21;
  // Map average distance (0 to 0.45) to similarity (100% to 0%)
  const similarity = Math.max(0, 100 * (1 - avgDist / 0.45));
  return similarity;
}

function updatePoseUIState(isRegistered) {
  if (isRegistered) {
    elPoseRegisteredStatus.textContent = 'Registrado';
    elPoseRegisteredStatus.className = 'pose-status-badge registered';
    elBtnClearPose.removeAttribute('disabled');
  } else {
    elPoseRegisteredStatus.textContent = 'Sin Registrar';
    elPoseRegisteredStatus.className = 'pose-status-badge unregistered';
    elBtnClearPose.setAttribute('disabled', 'true');
  }
}


// ==========================================================================
// CAMERA 1: MODERN CAMERA SYSTEM
// ==========================================================================
async function loadCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    elCameraSelect.innerHTML = '';
    
    if (videoDevices.length === 0) {
      elCameraSelect.innerHTML = '<option value="">No se detectó cámara</option>';
      return;
    }
    
    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Cámara ${index + 1}`;
      elCameraSelect.appendChild(option);
    });
    
    elCameraSelectGroup.style.display = 'block';
  } catch (e) {
    console.warn('No se pudieron listar las cámaras:', e);
  }
}

async function startCamera() {
  if (activeStream) {
    stopCamera();
  }
  
  const deviceId = elCameraSelect.value;
  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId }, width: 640, height: 480 } : { width: 640, height: 480 },
    audio: false
  };
  
  try {
    updateStatus('Iniciando Cámara...', 'red');
    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    elVideo.srcObject = activeStream;
    
    await new Promise((resolve) => {
      elVideo.onloadedmetadata = () => {
        elVideo.play();
        resolve();
      };
    });
    
    elCanvas.width = elVideo.videoWidth;
    elCanvas.height = elVideo.videoHeight;
    
    isCameraActive = true;
    elBtnCameraText.textContent = 'Desactivar Cámara';
    elBtnToggleCamera.classList.add('btn-active-cam');
    
    elIdleOverlay.classList.remove('active');
    elViewportContainer.classList.add('active-running');
    
    updateStatus('Cámara Activa & Analizando', 'green');
    
    lastFpsUpdate = performance.now();
    frameCount = 0;
    
    runDetectionLoop();
    
  } catch (error) {
    console.error('Error al acceder a la cámara:', error);
    updateStatus('Error de Cámara', 'red');
    alert('No se pudo acceder a la cámara web. Otorga los permisos necesarios.');
    stopCamera();
  }
}

function stopCamera() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
  
  elVideo.srcObject = null;
  isCameraActive = false;
  elBtnCameraText.textContent = 'Activar Cámara';
  elBtnToggleCamera.classList.remove('btn-active-cam');
  
  ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);
  
  elMetricFps.textContent = '0';
  elMetricLatency.textContent = '0 ms';
  elMetricHandsCount.textContent = '0';
  
  elIdleOverlay.classList.add('active');
  elViewportContainer.classList.remove('active-running');
  elAlertBanner.classList.remove('active');
  elViewportContainer.classList.remove('active-warning');
  
  if (detector) {
    updateStatus('MediaPipe Listo', 'green');
  } else {
    updateStatus('Cargando MediaPipe...', 'red');
  }
}

// ==========================================================================
// CAMERA 2: LEGACY CAMERA SYSTEM
// ==========================================================================
async function loadCamerasLegacy() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    elCameraSelectLegacy.innerHTML = '';
    
    if (videoDevices.length === 0) {
      elCameraSelectLegacy.innerHTML = '<option value="">No se detectó cámara</option>';
      return;
    }
    
    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Cámara ${index + 1}`;
      elCameraSelectLegacy.appendChild(option);
    });
    
    elCameraSelectGroupLegacy.style.display = 'block';
  } catch (e) {
    console.warn('No se pudieron listar las cámaras legacy:', e);
  }
}

async function startCameraLegacy() {
  if (activeStreamLegacy) {
    stopCameraLegacy();
  }
  
  const deviceId = elCameraSelectLegacy.value;
  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId }, width: 640, height: 480 } : { width: 640, height: 480 },
    audio: false
  };
  
  try {
    updateStatusLegacy('Iniciando Cámara...', 'red');
    activeStreamLegacy = await navigator.mediaDevices.getUserMedia(constraints);
    elVideoLegacy.srcObject = activeStreamLegacy;
    
    await new Promise((resolve) => {
      elVideoLegacy.onloadedmetadata = () => {
        elVideoLegacy.play();
        resolve();
      };
    });
    
    elCanvasLegacy.width = elVideoLegacy.videoWidth;
    elCanvasLegacy.height = elVideoLegacy.videoHeight;
    
    isLegacyCameraActive = true;
    elBtnCameraTextLegacy.textContent = 'Desactivar Cámara';
    elBtnToggleCameraLegacy.classList.add('btn-active-cam');
    
    elIdleOverlayLegacy.classList.remove('active');
    elViewportContainerLegacy.classList.add('active-running');
    
    updateStatusLegacy('Cámara Activa & Analizando', 'green');
    
    lastFpsUpdateLegacy = performance.now();
    frameCountLegacy = 0;
    
    runDetectionLoopLegacy();
    
  } catch (error) {
    console.error('Error al acceder a la cámara legacy:', error);
    updateStatusLegacy('Error de Cámara', 'red');
    alert('No se pudo acceder a la cámara web. Otorga los permisos necesarios.');
    stopCameraLegacy();
  }
}

function stopCameraLegacy() {
  if (rafIdLegacy) {
    cancelAnimationFrame(rafIdLegacy);
    rafIdLegacy = null;
  }
  
  if (activeStreamLegacy) {
    activeStreamLegacy.getTracks().forEach(track => track.stop());
    activeStreamLegacy = null;
  }
  
  elVideoLegacy.srcObject = null;
  isLegacyCameraActive = false;
  elBtnCameraTextLegacy.textContent = 'Activar Cámara';
  elBtnToggleCameraLegacy.classList.remove('btn-active-cam');
  
  ctxLegacy.clearRect(0, 0, elCanvasLegacy.width, elCanvasLegacy.height);
  
  elMetricFpsLegacy.textContent = '0';
  elMetricLatencyLegacy.textContent = '0 ms';
  elMetricHandsCountLegacy.textContent = '0';
  
  elIdleOverlayLegacy.classList.add('active');
  elViewportContainerLegacy.classList.remove('active-running');
  
  if (legacyModel) {
    updateStatusLegacy('TF.js Handpose Listo', 'green');
  } else {
    updateStatusLegacy('Cargando TF.js Legacy...', 'red');
  }
}


// ==========================================================================
// DETECTOR LOOP: CAMERA 1 (MODERN MEDIAPIPE)
// ==========================================================================
async function runDetectionLoop() {
  if (!isCameraActive) return;
  
  const startTime = performance.now();
  let hands = [];
  
  if (detector && elVideo.readyState >= 2) {
    try {
      hands = await detector.estimateHands(elVideo, {
        flipHorizontal: false
      });
    } catch (err) {
      console.error('Inference error:', err);
    }
  }
  
  // Cache hands for capture
  lastDetectedHands = hands;
  
  let maxSimilarity = 0;
  let anyHandMatchesForbidden = false;
  
  if (forbiddenPose && hands.length > 0) {
    const forbiddenPoseMirrored = forbiddenPose.map(pt => ({
      x: -pt.x,
      y: pt.y,
      z: pt.z
    }));

    hands.forEach(hand => {
      if (hand.score < minConfidence) return;
      
      const normalizedHand = normalizeHand(hand.keypoints);
      const similarityOriginal = compareHands(normalizedHand, forbiddenPose);
      const similarityMirrored = compareHands(normalizedHand, forbiddenPoseMirrored);
      
      const similarity = Math.max(similarityOriginal, similarityMirrored);
      hand.similarity = similarity;
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
      
      if (similarity >= matchThreshold) {
        hand.isForbidden = true;
        anyHandMatchesForbidden = true;
      } else {
        hand.isForbidden = false;
      }
    });
  }

  // Update similarity bar UI
  if (forbiddenPose) {
    elValCurrentSimilarity.textContent = `${Math.round(maxSimilarity)}%`;
    elSimilarityProgress.style.width = `${Math.round(maxSimilarity)}%`;
  } else {
    elValCurrentSimilarity.textContent = `0%`;
    elSimilarityProgress.style.width = `0%`;
  }

  // Trigger alerts
  if (anyHandMatchesForbidden) {
    elAlertBanner.classList.add('active');
    elViewportContainer.classList.add('active-warning');
  } else {
    elAlertBanner.classList.remove('active');
    elViewportContainer.classList.remove('active-warning');
  }
  
  const endTime = performance.now();
  const latency = Math.round(endTime - startTime);
  
  draw(hands);
  updatePerformanceMetrics(latency, hands.length);
  
  rafId = requestAnimationFrame(runDetectionLoop);
}

function draw(hands) {
  ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);
  
  // 1. Draw mirrored video
  ctx.save();
  ctx.translate(elCanvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(elVideo, 0, 0, elCanvas.width, elCanvas.height);
  ctx.restore();
  
  if (hands.length === 0) return;
  
  const scaleX = elCanvas.width / elVideo.videoWidth;
  const scaleY = elCanvas.height / elVideo.videoHeight;
  
  const getCanvasCoords = (landmark) => {
    return {
      x: elCanvas.width - (landmark.x * scaleX),
      y: landmark.y * scaleY
    };
  };
  
  hands.forEach(hand => {
    if (hand.score < minConfidence) return;
    
    const keypoints = hand.keypoints;
    const isForbidden = hand.isForbidden;
    
    // 2. Draw connections
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    connections.forEach(([indexA, indexB]) => {
      const ptA = getCanvasCoords(keypoints[indexA]);
      const ptB = getCanvasCoords(keypoints[indexB]);
      
      ctx.strokeStyle = isForbidden ? '#ef4444' : getKeypointColor(indexA);
      
      ctx.save();
      ctx.shadowColor = isForbidden ? '#ef4444' : getKeypointColor(indexA);
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.stroke();
      ctx.restore();
    });
    
    // 3. Draw keypoints
    keypoints.forEach((keypoint, index) => {
      const pt = getCanvasCoords(keypoint);
      const color = isForbidden ? '#ef4444' : getKeypointColor(index);
      
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      
      ctx.beginPath();
      const radius = (index === 0 || index === 4 || index === 8 || index === 12 || index === 16 || index === 20) ? 6 : 4.5;
      ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius / 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    });
    
    // 4. Draw Label
    const wristPt = getCanvasCoords(keypoints[0]);
    const isLeftHand = hand.handedness === 'Left'; 
    const handLabelText = isLeftHand ? 'Mano Derecha' : 'Mano Izquierda';
    
    const labelText = isForbidden 
      ? `⚠️ PROHIBIDA (${Math.round(hand.similarity)}%)` 
      : `${handLabelText} (${Math.round(hand.score * 100)}%)`;
    
    ctx.save();
    ctx.font = 'bold 12px "Outfit", sans-serif';
    const textWidth = ctx.measureText(labelText).width;
    const padding = 6;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 22;
    
    const badgeX = Math.max(10, Math.min(elCanvas.width - boxWidth - 10, wristPt.x - boxWidth / 2));
    const badgeY = Math.max(30, Math.min(elCanvas.height - 10, wristPt.y - 20));
    
    ctx.fillStyle = isForbidden ? 'rgba(239, 68, 68, 0.95)' : 'rgba(10, 14, 26, 0.85)';
    ctx.strokeStyle = isForbidden ? '#ffffff' : (isLeftHand ? 'var(--accent-cyan)' : 'var(--primary-purple)');
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.moveTo(badgeX + 5, badgeY);
    ctx.lineTo(badgeX + boxWidth - 5, badgeY);
    ctx.quadraticCurveTo(badgeX + boxWidth, badgeY, badgeX + boxWidth, badgeY + 5);
    ctx.lineTo(badgeX + boxWidth, badgeY + boxHeight - 5);
    ctx.quadraticCurveTo(badgeX + boxWidth, badgeY + boxHeight, badgeX + boxWidth - 5, badgeY + boxHeight);
    ctx.lineTo(badgeX + 5, badgeY + boxHeight);
    ctx.quadraticCurveTo(badgeX, badgeY + boxHeight, badgeX, badgeY + boxHeight - 5);
    ctx.lineTo(badgeX, badgeY + 5);
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + 5, badgeY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, badgeX + padding, badgeY + boxHeight / 2);
    ctx.restore();
  });
}

function updatePerformanceMetrics(latencyMs, handsCount) {
  frameCount++;
  const currentTime = performance.now();
  const timeElapsed = currentTime - lastFpsUpdate;
  
  if (timeElapsed >= 1000) {
    fpsCount = Math.round((frameCount * 1000) / timeElapsed);
    elMetricFps.textContent = fpsCount;
    frameCount = 0;
    lastFpsUpdate = currentTime;
  }
  
  elMetricLatency.textContent = `${latencyMs} ms`;
  elMetricHandsCount.textContent = handsCount;
}


// ==========================================================================
// MODEL 2 LOADING & RUNNING: CAMERA 2 (LEGACY TF.JS HANDPOSE)
// ==========================================================================
async function loadLegacyModel() {
  try {
    updateStatusLegacy('Cargando TF.js Legacy...', 'red');
    
    if (typeof window !== 'undefined' && window.handpose) {
      legacyModel = await window.handpose.load();
      updateStatusLegacy('TF.js Handpose Listo', 'green');
      
      // Enumerate cameras for page 2
      await loadCamerasLegacy();
      
      elLoadingOverlayLegacy.classList.remove('active');
      elIdleOverlayLegacy.classList.add('active');
    } else {
      throw new Error("Librería global 'window.handpose' no cargó vía CDN.");
    }
  } catch (error) {
    console.error("Error cargando el modelo Handpose Clásico:", error);
    updateStatusLegacy('Error de Carga', 'red');
  }
}

async function runDetectionLoopLegacy() {
  if (!isLegacyCameraActive) return;
  
  const startTime = performance.now();
  let predictions = [];
  
  if (legacyModel && elVideoLegacy.readyState >= 2) {
    try {
      predictions = await legacyModel.estimateHands(elVideoLegacy);
    } catch (err) {
      console.error('Legacy inference error:', err);
    }
  }
  
  const endTime = performance.now();
  const latency = Math.round(endTime - startTime);
  
  // Adapt predictions array to conform to our visualizer draw function coordinates format
  const handsMapped = predictions
    .filter(p => p.handInViewConfidence >= minConfidenceLegacy)
    .map(p => {
      // Map [[x,y,z], ...] landmarks to [{x,y,z}] coordinates objects
      const keypoints = p.landmarks.map((pt, idx) => ({
        x: pt[0],
        y: pt[1],
        z: pt[2]
      }));
      
      return {
        keypoints,
        score: p.handInViewConfidence,
        handedness: 'Desconocido',
        isForbidden: false
      };
    });
    
  drawLegacy(handsMapped);
  updatePerformanceMetricsLegacy(latency, handsMapped.length);
  
  rafIdLegacy = requestAnimationFrame(runDetectionLoopLegacy);
}

function drawLegacy(hands) {
  ctxLegacy.clearRect(0, 0, elCanvasLegacy.width, elCanvasLegacy.height);
  
  // 1. Draw mirrored video frame
  ctxLegacy.save();
  ctxLegacy.translate(elCanvasLegacy.width, 0);
  ctxLegacy.scale(-1, 1);
  ctxLegacy.drawImage(elVideoLegacy, 0, 0, elCanvasLegacy.width, elCanvasLegacy.height);
  ctxLegacy.restore();
  
  if (hands.length === 0) return;
  
  const scaleX = elCanvasLegacy.width / elVideoLegacy.videoWidth;
  const scaleY = elCanvasLegacy.height / elVideoLegacy.videoHeight;
  
  const getCanvasCoords = (landmark) => {
    return {
      x: elCanvasLegacy.width - (landmark.x * scaleX),
      y: landmark.y * scaleY
    };
  };
  
  hands.forEach(hand => {
    const keypoints = hand.keypoints;
    
    // 2. Draw connections
    ctxLegacy.lineWidth = 3;
    ctxLegacy.lineCap = 'round';
    
    connections.forEach(([indexA, indexB]) => {
      const ptA = getCanvasCoords(keypoints[indexA]);
      const ptB = getCanvasCoords(keypoints[indexB]);
      
      ctxLegacy.strokeStyle = getKeypointColor(indexA);
      
      ctxLegacy.save();
      ctxLegacy.shadowColor = getKeypointColor(indexA);
      ctxLegacy.shadowBlur = 8;
      ctxLegacy.beginPath();
      ctxLegacy.moveTo(ptA.x, ptA.y);
      ctxLegacy.lineTo(ptB.x, ptB.y);
      ctxLegacy.stroke();
      ctxLegacy.restore();
    });
    
    // 3. Draw keypoints
    keypoints.forEach((keypoint, index) => {
      const pt = getCanvasCoords(keypoint);
      const color = getKeypointColor(index);
      
      ctxLegacy.save();
      ctxLegacy.shadowColor = color;
      ctxLegacy.shadowBlur = 12;
      ctxLegacy.fillStyle = color;
      
      ctxLegacy.beginPath();
      const radius = (index === 0 || index === 4 || index === 8 || index === 12 || index === 16 || index === 20) ? 6 : 4.5;
      ctxLegacy.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
      ctxLegacy.fill();
      
      ctxLegacy.fillStyle = '#ffffff';
      ctxLegacy.beginPath();
      ctxLegacy.arc(pt.x, pt.y, radius / 2.5, 0, 2 * Math.PI);
      ctxLegacy.fill();
      ctxLegacy.restore();
    });
    
    // 4. Draw Hand Label near Wrist
    const wristPt = getCanvasCoords(keypoints[0]);
    const labelText = `Mano (${Math.round(hand.score * 100)}%)`;
    
    ctxLegacy.save();
    ctxLegacy.font = 'bold 12px "Outfit", sans-serif';
    const textWidth = ctxLegacy.measureText(labelText).width;
    const padding = 6;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 22;
    
    const badgeX = Math.max(10, Math.min(elCanvasLegacy.width - boxWidth - 10, wristPt.x - boxWidth / 2));
    const badgeY = Math.max(30, Math.min(elCanvasLegacy.height - 10, wristPt.y - 20));
    
    ctxLegacy.fillStyle = 'rgba(10, 14, 26, 0.85)';
    ctxLegacy.strokeStyle = 'var(--primary-purple)';
    ctxLegacy.lineWidth = 1.5;
    
    ctxLegacy.beginPath();
    ctxLegacy.moveTo(badgeX + 5, badgeY);
    ctxLegacy.lineTo(badgeX + boxWidth - 5, badgeY);
    ctxLegacy.quadraticCurveTo(badgeX + boxWidth, badgeY, badgeX + boxWidth, badgeY + 5);
    ctxLegacy.lineTo(badgeX + boxWidth, badgeY + boxHeight - 5);
    ctxLegacy.quadraticCurveTo(badgeX + boxWidth, badgeY + boxHeight, badgeX + boxWidth - 5, badgeY + boxHeight);
    ctxLegacy.lineTo(badgeX + 5, badgeY + boxHeight);
    ctxLegacy.quadraticCurveTo(badgeX, badgeY + boxHeight, badgeX, badgeY + boxHeight - 5);
    ctxLegacy.lineTo(badgeX, badgeY + 5);
    ctxLegacy.quadraticCurveTo(badgeX, badgeY, badgeX + 5, badgeY);
    ctxLegacy.closePath();
    ctxLegacy.fill();
    ctxLegacy.stroke();
    
    ctxLegacy.fillStyle = '#ffffff';
    ctxLegacy.textBaseline = 'middle';
    ctxLegacy.fillText(labelText, badgeX + padding, badgeY + boxHeight / 2);
    ctxLegacy.restore();
  });
}

function updatePerformanceMetricsLegacy(latencyMs, handsCount) {
  frameCountLegacy++;
  const currentTime = performance.now();
  const timeElapsed = currentTime - lastFpsUpdateLegacy;
  
  if (timeElapsed >= 1000) {
    fpsCountLegacy = Math.round((frameCountLegacy * 1000) / timeElapsed);
    elMetricFpsLegacy.textContent = fpsCountLegacy;
    frameCountLegacy = 0;
    lastFpsUpdateLegacy = currentTime;
  }
  
  elMetricLatencyLegacy.textContent = `${latencyMs} ms`;
  elMetricHandsCountLegacy.textContent = handsCount;
}


// ==========================================================================
// INTERACTIVE COMPONENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  
  // --- Page 1: Modern controls ---
  elBtnToggleCamera.addEventListener('click', () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  });
  
  elCameraSelect.addEventListener('change', () => {
    if (isCameraActive) {
      startCamera();
    }
  });
  
  elSliderMaxHands.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    maxHands = val;
    elValMaxHands.textContent = val;
    
    if (detector) {
      detector = null;
      recreateDetector();
    }
  });
  
  elSliderConfidence.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    minConfidence = val;
    elValConfidence.textContent = `${Math.round(val * 100)}%`;
  });

  elBtnCapturePose.addEventListener('click', () => {
    if (!isCameraActive) {
      alert("Por favor activa la cámara antes de registrar una postura.");
      return;
    }
    
    if (lastDetectedHands && lastDetectedHands.length > 0) {
      const targetHand = lastDetectedHands[0];
      forbiddenPose = normalizeHand(targetHand.keypoints);
      localStorage.setItem('forbiddenPose', JSON.stringify(forbiddenPose));
      updatePoseUIState(true);
      alert("¡Postura prohibida registrada y guardada con éxito!");
    } else {
      alert("No se detectó ninguna mano en pantalla. Coloca tu mano frente a la cámara y vuelve a presionar Registrar.");
    }
  });

  elBtnClearPose.addEventListener('click', () => {
    forbiddenPose = null;
    localStorage.removeItem('forbiddenPose');
    updatePoseUIState(false);
    
    elValCurrentSimilarity.textContent = '0%';
    elSimilarityProgress.style.width = '0%';
    elAlertBanner.classList.remove('active');
    elViewportContainer.classList.remove('active-warning');
  });

  elMatchThreshold.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    matchThreshold = val;
    elValMatchThreshold.textContent = `${val}%`;
  });


  // --- Page 2: Legacy controls ---
  elBtnToggleCameraLegacy.addEventListener('click', () => {
    if (isLegacyCameraActive) {
      stopCameraLegacy();
    } else {
      startCameraLegacy();
    }
  });
  
  elCameraSelectLegacy.addEventListener('change', () => {
    if (isLegacyCameraActive) {
      startCameraLegacy();
    }
  });
  
  elSliderConfidenceLegacy.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    minConfidenceLegacy = val;
    elValConfidenceLegacy.textContent = `${Math.round(val * 100)}%`;
  });
}

async function recreateDetector() {
  try {
    updateStatus('Ajustando Modelo...', 'red');
    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    detector = await handPoseDetection.createDetector(model, {
      runtime: 'mediapipe',
      solutionPath: '/mediapipe',
      modelType: 'full',
      maxHands: maxHands
    });
    updateStatus(isCameraActive ? 'Cámara Activa & Analizando' : 'MediaPipe Listo', 'green');
  } catch (error) {
    console.error('Error al actualizar configuraciones del modelo:', error);
  }
}

// Presentation Slides Tab Handler
function setupTabs() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      tabLinks.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      link.classList.add('active');
      const targetTabId = link.getAttribute('data-tab');
      document.getElementById(targetTabId).classList.add('active');
    });
  });
}

// ==========================================================================
// ROUTE CHANGE LISTENER & DOM BOOTSTRAP
// ==========================================================================
window.addEventListener('hashchange', handleRoute);

// Start application
window.addEventListener('DOMContentLoaded', init);
