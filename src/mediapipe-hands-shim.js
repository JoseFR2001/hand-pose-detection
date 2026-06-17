/**
 * MediaPipe Hands Proxy Shim for Vite/Rollup
 * 
 * This file shims the "@mediapipe/hands" module to bypass Vite/Rolldown compilation and export errors.
 * Since the hand-pose-detection model loads the actual MediaPipe script dynamically from CDN,
 * this proxy captures the static import and forwards all calls to the globally loaded `window.Hands` at runtime.
 */

export class Hands {
  constructor(config) {
    if (typeof window !== 'undefined' && window.Hands) {
      this.instance = new window.Hands(config);
    } else {
      console.warn("window.Hands no está definido en el constructor de la clase Proxy. Asegurándose de cargar vía CDN.");
      // Fallback instance creation (will be tried again when methods are called)
      this.instance = null;
      this.config = config;
    }
  }

  _ensureInstance() {
    if (!this.instance && typeof window !== 'undefined' && window.Hands) {
      this.instance = new window.Hands(this.config);
    }
    return this.instance;
  }

  setOptions(options) {
    const inst = this._ensureInstance();
    if (inst) {
      inst.setOptions(options);
    } else {
      console.error("No se pudo llamar a setOptions: window.Hands no está listo.");
    }
  }

  onResults(callback) {
    const inst = this._ensureInstance();
    if (inst) {
      inst.onResults(callback);
    } else {
      console.error("No se pudo registrar onResults: window.Hands no está listo.");
    }
  }

  async send(input) {
    const inst = this._ensureInstance();
    if (inst) {
      return inst.send(input);
    } else {
      console.error("No se pudo llamar a send: window.Hands no está listo.");
      return null;
    }
  }

  close() {
    if (this.instance) {
      this.instance.close();
    }
  }

  reset() {
    if (this.instance) {
      this.instance.reset();
    }
  }

  initialize() {
    const inst = this._ensureInstance();
    if (inst && typeof inst.initialize === 'function') {
      return inst.initialize();
    }
    // If original class doesn't have initialize or not loaded yet, return resolved promise
    return Promise.resolve();
  }
}
