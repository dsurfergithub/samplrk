import { describe, it, expect } from 'vitest'
import {
  detectBPM, beatPhase, findZeroCrossing, validateLoop, detectKey,
  peaksFromData, rmsEnvelope, onsetEnvelope, correlation,
} from '../src/engines/dsp.js'

describe('detectBPM', () => {
  it('detecta 120 BPM en una envolvente de impulsos cada 0.5 s', () => {
    const rate = 86
    const onset = new Float32Array(rate * 12)
    for (let t = 0; t < 12; t += 0.5) onset[Math.round(t * rate)] = 1
    const { bpm, confidence } = detectBPM(onset, rate)
    // acepta 120 o su doble/mitad plegados al rango musical
    expect(Math.abs(bpm - 120)).toBeLessThan(4)
    expect(confidence).toBeGreaterThan(0)
  })

  it('devuelve algo razonable sin material rítmico', () => {
    const { bpm } = detectBPM(new Float32Array(200), 86)
    expect(bpm).toBeGreaterThanOrEqual(55)
    expect(bpm).toBeLessThanOrEqual(200)
  })
})

describe('beatPhase', () => {
  it('encuentra el desfase del primer beat', () => {
    const rate = 100
    const onset = new Float32Array(rate * 10)
    for (let t = 0.25; t < 10; t += 0.5) onset[Math.round(t * rate)] = 1
    const phase = beatPhase(onset, rate, 120)
    expect(Math.abs(phase - 0.25)).toBeLessThan(0.05)
  })
})

describe('findZeroCrossing', () => {
  it('ajusta a un cruce por cero ascendente', () => {
    const sr = 1000
    const data = new Float32Array(sr)
    for (let i = 0; i < sr; i++) data[i] = Math.sin(2 * Math.PI * 10 * i / sr) // 10 Hz
    const idx = findZeroCrossing(data, 130) // el cruce ascendente real está en 100
    expect(data[idx - 1]).toBeLessThanOrEqual(0)
    expect(data[idx]).toBeGreaterThan(0)
  })
})

describe('validateLoop (Loop Validator)', () => {
  const sr = 44100
  it('acepta un loop de seno cortado en períodos exactos', () => {
    const data = new Float32Array(sr) // 1 s de 440 Hz
    for (let i = 0; i < sr; i++) data[i] = Math.sin(2 * Math.PI * 440 * i / sr)
    const v = validateLoop(data, sr, 0, 0.5) // 220 períodos exactos
    expect(v.valid).toBe(true)
    expect(v.score).toBeGreaterThan(0.5)
  })

  it('rechaza un corte con salto de amplitud (clic)', () => {
    const data = new Float32Array(sr)
    for (let i = 0; i < sr; i++) data[i] = i / sr // rampa 0→1
    const v = validateLoop(data, sr, 0.2, 0.7)
    expect(v.valid).toBe(false)
    expect(v.issues.length).toBeGreaterThan(0)
  })

  it('rechaza loops demasiado cortos', () => {
    const v = validateLoop(new Float32Array(sr), sr, 0, 0.05)
    expect(v.valid).toBe(false)
  })
})

describe('detectKey', () => {
  it('reconoce Do mayor a partir de un cromagrama C-E-G', () => {
    const chroma = new Array(12).fill(0.02)
    chroma[0] = 1; chroma[4] = 0.8; chroma[7] = 0.9 // C E G
    const { key, mode } = detectKey(chroma)
    expect(key).toBe('C')
    expect(mode).toBe('major')
  })
})

describe('utilidades', () => {
  it('peaksFromData devuelve pares min/max', () => {
    const data = new Float32Array(1000).map(() => Math.random() * 2 - 1)
    const peaks = peaksFromData(data, 50)
    expect(peaks.length).toBe(100)
    for (let i = 0; i < 50; i++) expect(peaks[i * 2]).toBeLessThanOrEqual(peaks[i * 2 + 1])
  })

  it('la envolvente de onsets solo tiene valores positivos', () => {
    const data = new Float32Array(44100).map(() => Math.random() * 2 - 1)
    const { env } = rmsEnvelope(data, 44100)
    const onset = onsetEnvelope(env)
    for (const v of onset) expect(v).toBeGreaterThanOrEqual(0)
  })

  it('correlation es 1 para señales idénticas', () => {
    const a = [1, 2, 3, 4, 2, 1]
    expect(correlation(a, a)).toBeCloseTo(1, 5)
  })
})
