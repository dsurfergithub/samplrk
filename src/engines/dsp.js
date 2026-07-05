/**
 * dsp.js — analysis_engine (núcleo puro)
 * Funciones de análisis de audio sin dependencias de DOM/Web Audio.
 * Se ejecutan dentro del worker de análisis y son testeables en Node.
 */

// ---------------------------------------------------------------- utilidades

/** Mezcla N canales a mono. */
export function mixdownChannels(channels) {
  if (channels.length === 1) return Float32Array.from(channels[0])
  const n = channels[0].length
  const out = new Float32Array(n)
  for (let c = 0; c < channels.length; c++) {
    const d = channels[c]
    for (let i = 0; i < n; i++) out[i] += d[i] / channels.length
  }
  return out
}

/** Pares min/max por bucket para dibujar la forma de onda. */
export function peaksFromData(data, buckets = 2000) {
  const out = new Float32Array(buckets * 2)
  const per = data.length / buckets
  for (let b = 0; b < buckets; b++) {
    let mn = 1, mx = -1
    const s = Math.floor(b * per)
    const e = Math.min(data.length, Math.max(s + 1, Math.floor((b + 1) * per)))
    for (let i = s; i < e; i++) { const v = data[i]; if (v < mn) mn = v; if (v > mx) mx = v }
    out[b * 2] = mn; out[b * 2 + 1] = mx
  }
  return out
}

/** Envolvente RMS. Devuelve { env, rate } donde rate = tramas por segundo. */
export function rmsEnvelope(data, sampleRate, hop = 512, win = 1024) {
  const frames = Math.max(1, Math.floor((data.length - win) / hop))
  const env = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    const s = f * hop
    for (let i = 0; i < win; i++) { const v = data[s + i] || 0; sum += v * v }
    env[f] = Math.sqrt(sum / win)
  }
  return { env, rate: sampleRate / hop }
}

/** Envolvente de onsets: diferencia positiva de energía (detecta ataques). */
export function onsetEnvelope(env) {
  const out = new Float32Array(env.length)
  for (let i = 1; i < env.length; i++) out[i] = Math.max(0, env[i] - env[i - 1])
  return out
}

function mean(arr) { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i]; return s / (arr.length || 1) }
function std(arr, m) { let s = 0; for (let i = 0; i < arr.length; i++) { const d = arr[i] - m; s += d * d } return Math.sqrt(s / (arr.length || 1)) }

/** Correlación de Pearson entre dos ventanas. */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  const ma = mean(a), mb = mean(b)
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb
    num += x * y; da += x * x; db += y * y
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? 0 : num / den
}

// ---------------------------------------------------------------- BPM y ritmo

/**
 * Detección de BPM por autocorrelación de la envolvente de onsets.
 * Devuelve { bpm, confidence }.
 */
export function detectBPM(onset, rate) {
  const minLag = Math.max(1, Math.floor(rate * 60 / 190)) // 190 BPM
  const maxLag = Math.min(onset.length - 1, Math.ceil(rate * 60 / 55)) // 55 BPM
  if (maxLag <= minLag) return { bpm: 120, confidence: 0 }
  let best = -1, bestLag = minLag, total = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i + lag < onset.length; i++) sum += onset[i] * onset[i + lag]
    sum /= (onset.length - lag)
    // ligera preferencia por tempos habituales (80–150)
    const bpm = 60 * rate / lag
    const pref = Math.exp(-Math.pow((bpm - 115) / 90, 2))
    const score = sum * (0.7 + 0.3 * pref)
    total += sum
    if (score > best) { best = score; bestLag = lag }
  }
  let bpm = 60 * rate / bestLag
  // plegar a un rango musical razonable
  while (bpm < 68) bpm *= 2
  while (bpm > 185) bpm /= 2
  const avg = total / (maxLag - minLag + 1)
  const confidence = avg > 0 ? Math.max(0, Math.min(1, (best / avg - 1) / 4)) : 0
  return { bpm: Math.round(bpm * 10) / 10, confidence: Math.round(confidence * 100) / 100 }
}

/** Fase del primer beat: offset que maximiza la energía de onsets en la rejilla. */
export function beatPhase(onset, rate, bpm) {
  const period = rate * 60 / bpm
  if (period < 2) return 0
  let best = -1, bestOff = 0
  const steps = Math.floor(period)
  for (let off = 0; off < steps; off++) {
    let sum = 0, count = 0
    for (let t = off; t < onset.length; t += period) { sum += onset[Math.floor(t)]; count++ }
    if (count > 0 && sum / count > best) { best = sum / count; bestOff = off }
  }
  return bestOff / rate
}

/** Transitorios (golpes/ataques) en segundos, con umbral adaptativo. */
export function detectTransients(onset, rate, sensitivity = 1.2) {
  const m = mean(onset), sd = std(onset, m)
  const thr = m + sd * sensitivity
  const minDist = Math.max(1, Math.floor(rate * 0.06)) // 60 ms entre golpes
  const out = []
  let last = -minDist
  for (let i = 1; i < onset.length - 1; i++) {
    if (onset[i] > thr && onset[i] >= onset[i - 1] && onset[i] >= onset[i + 1] && i - last >= minDist) {
      out.push(i / rate)
      last = i
    }
  }
  return out
}

/** Silencios: tramos con RMS por debajo del 2% del máximo, de ≥ minDur s. */
export function detectSilences(env, rate, minDur = 0.3) {
  let max = 0
  for (let i = 0; i < env.length; i++) if (env[i] > max) max = env[i]
  const thr = max * 0.02 + 1e-5
  const out = []
  let start = null
  for (let i = 0; i <= env.length; i++) {
    const silent = i < env.length && env[i] < thr
    if (silent && start === null) start = i
    if (!silent && start !== null) {
      const dur = (i - start) / rate
      if (dur >= minDur) out.push({ start: start / rate, end: i / rate })
      start = null
    }
  }
  return out
}

/** Energía por segundo, normalizada 0–1 (para detectar cambios de energía). */
export function energySections(env, rate) {
  const perSec = Math.max(1, Math.round(rate))
  const out = []
  let max = 1e-9
  for (let s = 0; s * perSec < env.length; s++) {
    let sum = 0, n = 0
    for (let i = s * perSec; i < Math.min(env.length, (s + 1) * perSec); i++) { sum += env[i]; n++ }
    const v = n ? sum / n : 0
    if (v > max) max = v
    out.push({ t: s, energy: v })
  }
  return out.map(x => ({ t: x.t, energy: Math.round((x.energy / max) * 100) / 100 }))
}

// ---------------------------------------------------------------- FFT y tonalidad

/** FFT radix-2 in-place → magnitudes (longitud n/2). La entrada debe ser potencia de 2. */
export function fftMag(signal) {
  const n = signal.length
  const re = Float32Array.from(signal)
  const im = new Float32Array(n)
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2
        const vr = re[b] * cr - im[b] * ci
        const vi = re[b] * ci + im[b] * cr
        re[b] = re[a] - vr; im[b] = im[a] - vi
        re[a] += vr; im[a] += vi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr; cr = nr
      }
    }
  }
  const mag = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i])
  return mag
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
// Perfiles de Krumhansl-Schmuckler
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

/** Cromagrama de 12 clases de altura sobre tramas espaciadas. */
export function chromaFromData(data, sampleRate, frame = 4096, hop = 16384) {
  const chroma = new Float32Array(12)
  const hann = new Float32Array(frame)
  for (let i = 0; i < frame; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / frame)
  const buf = new Float32Array(frame)
  for (let s = 0; s + frame <= data.length; s += hop) {
    for (let i = 0; i < frame; i++) buf[i] = data[s + i] * hann[i]
    const mag = fftMag(buf)
    for (let bin = 1; bin < mag.length; bin++) {
      const f = bin * sampleRate / frame
      if (f < 55 || f > 4000) continue
      const st = Math.round(12 * Math.log2(f / 440))
      const pc = ((st + 9) % 12 + 12) % 12 // A=440 → clase 9; C=0
      chroma[pc] += mag[bin]
    }
  }
  const total = chroma.reduce((a, b) => a + b, 0) || 1
  return Array.from(chroma, v => v / total)
}

/** Tonalidad por correlación con perfiles mayor/menor. */
export function detectKey(chroma) {
  let best = { key: 'C', mode: 'major', confidence: 0, score: -Infinity }
  for (let r = 0; r < 12; r++) {
    const rotated = chroma.map((_, i) => chroma[(i + r) % 12])
    const cMaj = correlation(rotated, MAJOR_PROFILE)
    const cMin = correlation(rotated, MINOR_PROFILE)
    if (cMaj > best.score) best = { key: NOTE_NAMES[r], mode: 'major', score: cMaj }
    if (cMin > best.score) best = { key: NOTE_NAMES[r], mode: 'minor', score: cMin }
  }
  return { key: best.key, mode: best.mode, confidence: Math.round(Math.max(0, best.score) * 100) / 100 }
}

// ---------------------------------------------------------------- loops

/** Cruce por cero ascendente más cercano a idx (evita clics al cortar). */
export function findZeroCrossing(data, idx, maxSearch = 4000) {
  idx = Math.max(1, Math.min(data.length - 1, Math.round(idx)))
  for (let off = 0; off < maxSearch; off++) {
    const a = idx - off, b = idx + off
    if (a > 0 && data[a - 1] <= 0 && data[a] > 0) return a
    if (b > 0 && b < data.length && data[b - 1] <= 0 && data[b] > 0) return b
  }
  return idx
}

/**
 * Loop Validator: comprueba clics, continuidad fin→inicio y estabilidad de energía.
 * Devuelve { valid, score, issues[], click, continuity }.
 */
export function validateLoop(data, sampleRate, startSec, endSec) {
  const s = Math.max(0, Math.floor(startSec * sampleRate))
  const e = Math.min(data.length, Math.floor(endSec * sampleRate))
  const issues = []
  if (e - s < sampleRate * 0.2) {
    return { valid: false, score: 0, issues: ['El loop es demasiado corto'], click: 1, continuity: 0 }
  }
  // 1) clic en el punto de unión (el final salta al principio)
  const click = Math.abs((data[e - 1] ?? 0) - (data[s] ?? 0))
  if (click > 0.12) issues.push('Salto de amplitud en la unión fin→inicio (clic audible)')
  // 2) continuidad: el audio tras el inicio debería parecerse al audio tras el final
  const w = Math.min(2048, Math.floor((e - s) / 4))
  let continuity = 1
  if (e + w <= data.length && w > 64) {
    continuity = correlation(data.slice(s, s + w), data.slice(e, e + w))
    if (continuity < 0.03) issues.push('La transición fin→inicio no suena natural')
  }
  // 3) estabilidad de energía entre mitades
  const half = Math.floor((e - s) / 2)
  const r1 = rmsOf(data, s, s + half), r2 = rmsOf(data, s + half, e)
  const ratio = Math.max(r1, r2) / Math.max(1e-6, Math.min(r1, r2))
  if (ratio > 3.5) issues.push('La energía cambia bruscamente dentro del loop')
  if (Math.max(r1, r2) < 1e-4) issues.push('El loop está prácticamente en silencio')
  const score = Math.max(0, Math.min(1,
    (1 - Math.min(1, click * 3)) * 0.4 +
    Math.max(0, Math.min(1, continuity)) * 0.35 +
    (1 - Math.min(1, (ratio - 1) / 4)) * 0.25
  ))
  return { valid: issues.length === 0, score: Math.round(score * 100) / 100, issues, click, continuity }
}

function rmsOf(data, s, e) {
  let sum = 0
  for (let i = s; i < e; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / Math.max(1, e - s))
}

/** Perfil espectral de un segmento (para categorizar loops). */
export function spectralProfile(data, sampleRate) {
  const frame = 2048
  const n = Math.max(1, Math.min(8, Math.floor(data.length / frame)))
  let centroid = 0, lowRatio = 0, frames = 0
  for (let f = 0; f < n; f++) {
    const s = Math.floor(f * (data.length - frame) / n)
    const mag = fftMag(data.slice(s, s + frame))
    let num = 0, den = 0, low = 0
    for (let b = 1; b < mag.length; b++) {
      const freq = b * sampleRate / frame
      num += freq * mag[b]; den += mag[b]
      if (freq < 250) low += mag[b]
    }
    if (den > 0) { centroid += num / den; lowRatio += low / den; frames++ }
  }
  return frames ? { centroid: centroid / frames, lowRatio: lowRatio / frames } : { centroid: 0, lowRatio: 0 }
}

/** Clasifica un segmento en una categoría musical aproximada. */
export function classifyLoopSegment({ centroid, lowRatio, transientDensity, energyVar }) {
  if (lowRatio > 0.45) return 'Bajo'
  if (transientDensity >= 2.5 && centroid > 1800) return 'Batería'
  if (transientDensity >= 1.2) return 'Rítmico'
  if (energyVar < 0.04) return 'Ambiental'
  return 'Melódico'
}

// ---------------------------------------------------------------- análisis completo

/** Análisis completo de un sample (se ejecuta en el worker). */
export function fullAnalysis(data, sampleRate) {
  const { env, rate } = rmsEnvelope(data, sampleRate)
  const onset = onsetEnvelope(env)
  const { bpm, confidence: bpmConfidence } = detectBPM(onset, rate)
  const firstBeat = beatPhase(onset, rate, bpm)
  const transients = detectTransients(onset, rate)
  const silences = detectSilences(env, rate)
  const energy = energySections(env, rate)
  const { key, mode, confidence: keyConfidence } = detectKey(chromaFromData(data, sampleRate))
  const peaks = Array.from(peaksFromData(data, 1200))
  return {
    bpm, bpmConfidence, firstBeat: Math.round(firstBeat * 1000) / 1000,
    timeSignature: '4/4',
    key, mode, keyConfidence,
    transients: transients.map(t => Math.round(t * 1000) / 1000),
    silences, energy, peaks,
  }
}
