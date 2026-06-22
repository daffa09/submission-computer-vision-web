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

    // tf.tidy tidak mendukung async, jadi kelola tensor secara manual
    const tensorsToDispose = [];

    try {
      // Create tensor from image
      const imgTensor = tf.browser.fromPixels(imageElement);
      tensorsToDispose.push(imgTensor);

      const resized = imgTensor.resizeNearestNeighbor([224, 224]);
      tensorsToDispose.push(resized);

      const floated = resized.toFloat();
      tensorsToDispose.push(floated);

      // Normalize to [-1, 1] as standard for Teachable Machine models (MobileNet)
      const divisor = tf.scalar(127.5);
      tensorsToDispose.push(divisor);

      const one = tf.scalar(1);
      tensorsToDispose.push(one);

      const divided = floated.div(divisor);
      tensorsToDispose.push(divided);

      const normalized = divided.sub(one);
      tensorsToDispose.push(normalized);

      const batched = normalized.expandDims();
      tensorsToDispose.push(batched);

      const predictions = this.model.predict(batched);
      tensorsToDispose.push(predictions);

      // Gunakan async data() bukan dataSync() agar kompatibel dengan WebGPU
      const scores = await predictions.data();

      const argMaxTensor = predictions.argMax(-1);
      tensorsToDispose.push(argMaxTensor);

      const classIdArray = await argMaxTensor.data();
      const classId = classIdArray[0];
      const score = scores[classId];

      return {
        className: this.labels[classId],
        score: score,
        confidence: score * 100,
        isValid: true
      };
    } finally {
      // Bersihkan semua tensor
      tensorsToDispose.forEach(t => {
        if (t && !t.isDisposed) t.dispose();
      });
    }
  }

  // TODO [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isLoaded() {
    return this.model !== null;
  }
}
