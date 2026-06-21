import { TONE_CONFIG } from '../utils/config.js';
import { pipeline, env } from '@huggingface/transformers';

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = null;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  // TODO [Basic] Muat model dan inisialisasi pipeline text2text-generation
  // TODO [Advance] Implementasikan strategi Backend Adaptive
  async loadModel() {
    try {
      // Backend Adaptive
      if (navigator.gpu) {
        env.backends.onnx.wasm.numThreads = 1;
        this.currentBackend = 'webgpu';
        console.log('Transformers.js using WebGPU backend');
      } else {
        env.backends.onnx.wasm.numThreads = Math.max(1, navigator.hardwareConcurrency - 1 || 1);
        this.currentBackend = 'wasm';
        console.log('Transformers.js using WASM backend');
      }

      this.generator = await pipeline('text2text-generation', 'Xenova/flan-t5-small', {
        dtype: 'q4',
        device: this.currentBackend
      });

      this.isModelLoaded = true;
      console.log('Transformers.js model loaded successfully');
    } catch (error) {
      console.error('Failed to load Transformers model:', error);
      throw error;
    }
  }

  // TODO [Advance] Konfigurasi tone fakta yang dihasilkan
  setTone(tone) {
    this.currentTone = tone;
  }

  // TODO [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  // TODO [Skilled] Konfigurasikan parameter generasi berdasarkan kebutuhan
  // TODO [Advance] Implemenasikan parameter tone untuk mengatur nada fakta yang dihasilkan
  async generateFacts(vegetableName) {
    if (!this.generator) return null;
    this.isGenerating = true;

    try {
      let promptPrefix = "Give me a fun fact about";
      switch(this.currentTone) {
        case 'funny':
          promptPrefix = "Tell me a hilarious and funny fun fact about";
          break;
        case 'professional':
          promptPrefix = "Provide a scientific and professional fact about";
          break;
        case 'casual':
          promptPrefix = "Tell me a casual interesting fact about";
          break;
        default:
          promptPrefix = "Give me a fun fact about";
      }

      const prompt = `${promptPrefix} ${vegetableName}.`;

      const result = await this.generator(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true
      });

      this.isGenerating = false;
      return result[0].generated_text;
    } catch (error) {
      console.error('Error generating fact:', error);
      this.isGenerating = false;
      throw error;
    }
  }

  // TODO [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isReady() {
    return this.isModelLoaded && !this.isGenerating;
  }
}
