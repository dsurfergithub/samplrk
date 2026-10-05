/**
 * patternEngine.js — patterns: qué pad tocaste y cuándo (puro).
 *
 * Un pattern guarda EVENTOS, no audio. La posición canónica de cada evento
 * es `beat` (tiempos de negra desde el inicio del pattern): si cambias el
 * BPM o el pitch de un chop, la toma se adapta sola.
 *
 * El quantize es NO destructivo: `beat` siempre es tu toma original y el
 * ajuste a la rejilla se calcula al reproducir (`effectiveEvents`).
 */
import { makeId } from './ids'

export const BEATS_PER_BAR = 4
export const QUANTIZE_GRIDS = { off: 0, '1/4': 1, '1/8': 0.5, '1/16': 0.25 }
/** Golpes tocados justo antes del "1" (hasta media negra) cuentan como anticipados. */
export const EARLY_WINDOW = 0.5

export const secondsPerBeat = (bpm) => 60 / bpm
export const lengthBeats = (pattern) => pattern.bars * BEATS_PER_BAR
export const patternSeconds = (pattern, bpm = pattern.bpm) => lengthBeats(pattern) * secondsPerBeat(bpm)

export function createPattern({ bars = 2, bpm = 90, name = 'Pattern 1' } = {}) {
  return { id: makeId('pat'), name, bars, bpm, quantize: 'off', events: [] }
}

/**
 * Posición en tiempos de un golpe dado su tiempo relativo al "1" del pattern
 * (segundos, negativo durante la cuenta atrás). Devuelve null si cae fuera.
 * Un golpe anticipado (justo antes del 1) se envuelve al final del loop:
 * al repetir suena exactamente donde lo tocaste, un pelín antes del 1.
 */
export function beatOfHit(secondsFromStart, bpm, lenBeats) {
  const b = secondsFromStart / secondsPerBeat(bpm)
  if (b >= lenBeats) return null
  if (b < 0) return b >= -EARLY_WINDOW ? lenBeats + b : null
  return b
}

export function createEvent({ padId, beat, bpm, duration = 0.25, velocity = 1 }) {
  return {
    id: makeId('evt'),
    padId, beat,
    time: beat * secondsPerBeat(bpm),
    duration, velocity,
  }
}

export function addEvent(pattern, event) {
  return { ...pattern, events: [...pattern.events, event].sort((a, b) => a.beat - b.beat) }
}

/** Ajusta un beat a la rejilla (en tiempos); el resultado se envuelve dentro del loop. */
export function quantizeBeat(beat, grid, lenBeats) {
  if (!grid) return beat
  const q = Math.round(beat / grid) * grid
  return ((q % lenBeats) + lenBeats) % lenBeats
}

/** Eventos tal y como suenan: con quantize aplicado (sin tocar la toma). */
export function effectiveEvents(pattern) {
  const grid = QUANTIZE_GRIDS[pattern.quantize] ?? 0
  const len = lengthBeats(pattern)
  if (!grid) return pattern.events
  return pattern.events
    .map(e => ({ ...e, beat: quantizeBeat(e.beat, grid, len), rawBeat: e.beat }))
    .sort((a, b) => a.beat - b.beat)
}

/**
 * Eventos que caen en la ventana [fromBeat, toBeat) de una línea de tiempo
 * que repite el pattern en bucle desde el beat `startBeat`.
 * Devuelve [{ event, at }] con `at` = beat absoluto. Lo usa el scheduler.
 */
export function eventsInWindow(events, lenBeats, fromBeat, toBeat, startBeat = 0) {
  const out = []
  const a = Math.max(fromBeat, startBeat)
  if (toBeat <= a || !events.length) return out
  const firstCycle = Math.floor((a - startBeat) / lenBeats)
  const lastCycle = Math.floor((toBeat - startBeat) / lenBeats)
  for (let k = firstCycle; k <= lastCycle; k++) {
    const base = startBeat + k * lenBeats
    for (const e of events) {
      const at = base + e.beat
      if (at >= a && at < toBeat) out.push({ event: e, at })
    }
  }
  return out.sort((x, y) => x.at - y.at)
}

/** Clics de metrónomo (beats enteros) en [fromBeat, toBeat). */
export function beatsInWindow(fromBeat, toBeat) {
  const out = []
  for (let b = Math.ceil(fromBeat - 1e-9); b < toBeat; b++) out.push(b)
  return out
}

/** Secuencia de pads de la toma, en orden (para el coach). */
export function padSequence(pattern) {
  return [...pattern.events].sort((a, b) => a.beat - b.beat).map(e => e.padId)
}

// ---------------------------------------------------------------- tempo

export const BPM_MIN = 40
export const BPM_MAX = 220

export function clampBpm(bpm) {
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm * 10) / 10))
}

/** ×2 / ÷2 manteniéndose dentro del rango (el detector a veces se equivoca por el doble o la mitad). */
export function doubleBpm(bpm) { return bpm * 2 <= BPM_MAX ? clampBpm(bpm * 2) : bpm }
export function halveBpm(bpm) { return bpm / 2 >= BPM_MIN ? clampBpm(bpm / 2) : bpm }

/**
 * Tap tempo: BPM a partir de los últimos toques (en segundos).
 * Usa la mediana de los intervalos (resiste un toque torpe). Una pausa
 * de más de 2 s empieza una cuenta nueva. Devuelve null con < 2 toques.
 */
export function tapTempo(taps, maxTaps = 8) {
  let start = taps.length - 1
  while (start > 0 && taps[start] - taps[start - 1] <= 2) start--
  const recent = taps.slice(Math.max(start, taps.length - maxTaps))
  if (recent.length < 2) return null
  const iv = recent.slice(1).map((t, i) => t - recent[i]).sort((a, b) => a - b)
  const mid = iv.length >> 1
  const median = iv.length % 2 ? iv[mid] : (iv[mid - 1] + iv[mid]) / 2
  return clampBpm(60 / median)
}

/** BPM inicial del proyecto: pista del disco > detector (si se fía) > 90. */
export function initialBpm(sample) {
  if (sample?.tempoHint) return clampBpm(sample.tempoHint)
  const a = sample?.analysis
  if (a?.bpm && a.bpmConfidence >= 0.1) return clampBpm(a.bpm)
  return 90
}
