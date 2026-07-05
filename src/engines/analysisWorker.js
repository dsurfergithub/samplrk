/**
 * analysisWorker.js — analysis_engine (hilo de trabajo)
 * Ejecuta el análisis DSP completo fuera del hilo principal:
 * la UI nunca se bloquea por muy largo que sea el archivo.
 */
import { fullAnalysis } from './dsp.js'

self.onmessage = (e) => {
  const { jobId, data, sampleRate } = e.data
  try {
    const result = fullAnalysis(data, sampleRate)
    self.postMessage({ jobId, ok: true, result })
  } catch (err) {
    self.postMessage({ jobId, ok: false, error: String(err) })
  }
}
