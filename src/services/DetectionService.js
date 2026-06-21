import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = null;
  }

  // TODO [Basic] Muat model dan metadata secara bersamaan, lalu simpan ke instance
  // TODO [Advance] Implementasikan strategi Backend Adaptive
  async loadModel() {
    try {
      // Backend Adaptive WebGPU fallback WebGL
      try {
        await tf.setBackend('webgpu');
        await tf.ready();
        console.log('Using WebGPU backend');
      } catch (e) {
        console.warn('WebGPU not supported, falling back to WebGL', e);
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('Using WebGL backend');
      }

      const [model, metadataResponse] = await Promise.all([
        tf.loadLayersModel('/model/model.json'),
        fetch('/model/metadata.json')
      ]);

      this.model = model;
      const metadata = await metadataResponse.json();
      this.labels = metadata.labels;
      
      console.log('Model and metadata loaded successfully');
    } catch (error) {
      console.error('Error loading detection model:', error);
      throw error;
    }
  }

  // TODO [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  async predict(imageElement) {
    if (!this.model) return null;

    return tf.tidy(() => {
      // Create tensor from image
      let tensor = tf.browser.fromPixels(imageElement)
        .resizeNearestNeighbor([224, 224])
        .toFloat();
        
      // Normalize to [-1, 1] as standard for Teachable Machine models (MobileNet)
      tensor = tensor.div(tf.scalar(127.5)).sub(tf.scalar(1)).expandDims();

      const predictions = this.model.predict(tensor);
      const scores = predictions.dataSync();
      
      const classId = predictions.argMax(-1).dataSync()[0];
      const score = scores[classId];

      return {
        className: this.labels[classId],
        score: score,
        confidence: score * 100, // kept just in case
        isValid: true
      };
    });
  }

  // TODO [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isLoaded() {
    return this.model !== null;
  }
}
