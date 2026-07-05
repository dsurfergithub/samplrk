/**
 * loopEngine.js — loop_engine
 * Genera loops alineados al compás desde un EditableSample, los valida
 * (Loop Validator), corrige puntos problemáticos y los categoriza.
 */
import * as dsp from './dsp'
import { renderEditedData, editedMono, editedTransients, uid } from './sampleEngine'
import { getCtx } from './audioEngine'

const loopBuffers = new Map() // loopId → AudioBuffer

export function getLoopBuffer(id) { return loopBuffers.get(id) }
export function releaseLoopBuffer(id) { loopBuffers.delete(id) }

const CATEGORY_COLORS = {
  'Batería': '#ff4fa3',
  'Bajo': '#ffb03a',
  'Rítmico': '#4fd8ff',
  'Melódico': '#a3ff3f',
  'Ambiental': '#b48cff',
  'Vocal': '#ff6e5e',
}
export function categoryColor(cat) { return CATEGORY_COLORS[cat] || '#a3ff3f' }

/**
 * Renderiza el buffer definitivo de un loop (segmento del sample editado).
 * Si el validador detectó riesgo de clic aplica micro-fades de 5 ms en los bordes.
 */
function renderLoopBuffer(channels, sampleRate, startSec, endSec, antiClick) {
  const s = Math.floor(startSec * sampleRate)
  const e = Math.min(channels[0].length, Math.floor(endSec * sampleRate))
  const n = Math.max(1, e - s)
  const ctx = getCtx()
  const buf = ctx.createBuffer(channels.length, n, sampleRate)
  const fade = antiClick ? Math.floor(sampleRate * 0.005) : 0
  for (let c = 0; c < channels.length; c++) {
    const out = new Float32Array(n)
    out.set(channels[c].subarray(s, e))
    for (let i = 0; i < fade && i < n; i++) {
      out[i] *= i / fade
      out[n - 1 - i] *= i / fade
    }
    buf.copyToChannel(out, c)
  }
  return buf
}

function segmentStats(mono, sampleRate, startSec, endSec, transients) {
  const s = Math.floor(startSec * sampleRate)
  const e = Math.floor(endSec * sampleRate)
  const seg = mono.slice(s, e)
  const dur = (e - s) / sampleRate
  const { env } = dsp.rmsEnvelope(seg, sampleRate)
  let m = 0; for (const v of env) m += v; m /= env.length || 1
  let va = 0; for (const v of env) va += (v - m) * (v - m); va = va / (env.length || 1)
  const tCount = transients.filter(t => t >= startSec && t < endSec).length
  const profile = dsp.spectralProfile(seg, sampleRate)
  return {
    energyMean: m, energyVar: va,
    transientDensity: tCount / Math.max(0.001, dur),
    ...profile, seg,
  }
}

function moodFor(category, energy) {
  if (energy > 0.6) return category === 'Ambiental' ? 'Expansivo' : 'Enérgico'
  if (energy > 0.3) return 'Groove'
  return category === 'Bajo' ? 'Profundo' : 'Relajado'
}

/** Construye el objeto Loop (contrato de la Loop Library) y registra su buffer. */
function buildLoop(sample, channels, sampleRate, mono, transients, cand, index) {
  const stats = segmentStats(mono, sampleRate, cand.s, cand.e, transients)
  const category = dsp.classifyLoopSegment(stats)
  const energyScale = Math.max(1e-6, ...(sample.analysis?.energy?.map(x => x.energy) ?? [1]))
  const energy = Math.min(1, Math.round((stats.energyMean / 0.25) * 100) / 100)
  const antiClick = cand.v.click > 0.05
  const buffer = renderLoopBuffer(channels, sampleRate, cand.s, cand.e, antiClick)
  const loop = {
    id: uid('loop'),
    name: `${category} ${index + 1} · ${cand.bars}c`,
    category,
    color: categoryColor(category),
    sourceSampleId: sample.id,
    bars: cand.bars,
    duration: cand.e - cand.s,
    bpm: sample.analysis?.bpm ?? 120,
    key: sample.analysis?.key ?? '—',
    mode: sample.analysis?.mode ?? '',
    tags: [category.toLowerCase(), `${cand.bars} compases`, sample.name],
    energy,
    mood: moodFor(category, energy),
    loopStart: cand.s,
    loopEnd: cand.e,
    peaks: Array.from(dsp.peaksFromData(stats.seg, 120)),
    valid: cand.v.valid,
    score: cand.v.score,
    issues: cand.v.issues,
    pitch: 0,
    compatibleWith: [],
  }
  loopBuffers.set(loop.id, buffer)
  return loop
}

/**
 * Genera automáticamente los mejores loops del sample (requiere análisis).
 * Sugiere inicio/fin alineados al compás, valida cada candidato y, si un punto
 * falla, prueba alternativas cercanas (cruce por cero / siguiente compás).
 */
export function generateLoops(sample, { maxLoops = 6 } = {}) {
  if (!sample.analysis) throw new Error('Analiza el sample antes de generar loops')
  const { channels, sampleRate } = renderEditedData(sample)
  const mono = dsp.mixdownChannels(channels)
  const duration = mono.length / sampleRate
  const transients = editedTransients(sample)
  const bpm = sample.analysis.bpm
  const barSec = 240 / bpm
  const firstBeat = Math.max(0, (sample.analysis.firstBeat ?? 0) - sample.edits.trimStart)

  const candidates = []
  for (const bars of [1, 2, 4]) {
    const len = bars * barSec
    if (len > duration + 1e-3) continue
    for (let start = firstBeat % barSec; start + len <= duration + 1e-3; start += barSec) {
      const s = dsp.findZeroCrossing(mono, start * sampleRate) / sampleRate
      const e = dsp.findZeroCrossing(mono, (start + len) * sampleRate) / sampleRate
      if (e - s < len * 0.9) continue
      const v = dsp.validateLoop(mono, sampleRate, s, e)
      candidates.push({ s, e, bars, v })
    }
  }
  // mejores primero; entre iguales, prefiere loops más largos (más musicales)
  candidates.sort((a, b) => (b.v.score - a.v.score) || (b.bars - a.bars))

  const chosen = []
  for (const c of candidates) {
    if (chosen.length >= maxLoops) break
    // diversidad: evita candidatos casi idénticos a los ya elegidos
    const overlap = chosen.some(x =>
      Math.min(x.e, c.e) - Math.max(x.s, c.s) > 0.6 * Math.min(x.e - x.s, c.e - c.s) && x.bars === c.bars)
    if (!overlap) chosen.push(c)
  }
  return chosen.map((c, i) => buildLoop(sample, channels, sampleRate, mono, transients, c, i))
}

/**
 * Crea un loop manual desde una selección del editor.
 * Ajusta a cruces por cero, valida y aplica anti-clic si hace falta.
 */
export function loopFromSelection(sample, startSec, endSec, name = null) {
  const { channels, sampleRate } = renderEditedData(sample)
  const mono = dsp.mixdownChannels(channels)
  const transients = editedTransients(sample)
  const s = dsp.findZeroCrossing(mono, startSec * sampleRate) / sampleRate
  const e = dsp.findZeroCrossing(mono, endSec * sampleRate) / sampleRate
  const v = dsp.validateLoop(mono, sampleRate, s, e)
  const bpm = sample.analysis?.bpm ?? 120
  const bars = Math.max(1, Math.round((e - s) / (240 / bpm)))
  const loop = buildLoop(sample, channels, sampleRate, mono, transients, { s, e, bars, v }, 0)
  if (name) loop.name = name
  // BPM efectivo del recorte manual: que N compases duren exactamente lo que dura el corte
  loop.bpm = Math.round((240 * bars / (e - s)) * 10) / 10
  return loop
}
