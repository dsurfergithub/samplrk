/**
 * analysisEngine.js — analysis_engine (fachada)
 * Puente entre la app y el worker de análisis. Devuelve promesas.
 */
import { getRuntime } from './sampleEngine'
import { mixdownChannels } from './dsp'

let worker = null
let jobSeq = 0
const pending = new Map()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./analysisWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { jobId, ok, result, error } = e.data
      const job = pending.get(jobId)
      if (!job) return
      pending.delete(jobId)
      ok ? job.resolve(result) : job.reject(new Error(error))
    }
  }
  return worker
}

/** Analiza un sample registrado (BPM, tonalidad, transitorios…) en segundo plano. */
export function analyzeSample(sampleId) {
  const rt = getRuntime(sampleId)
  if (!rt) return Promise.reject(new Error('Sample no encontrado'))
  const channels = []
  for (let c = 0; c < rt.buffer.numberOfChannels; c++) channels.push(rt.buffer.getChannelData(c))
  const mono = mixdownChannels(channels)
  const jobId = ++jobSeq
  return new Promise((resolve, reject) => {
    pending.set(jobId, { resolve, reject })
    getWorker().postMessage({ jobId, data: mono, sampleRate: rt.buffer.sampleRate }, [mono.buffer])
  })
}
