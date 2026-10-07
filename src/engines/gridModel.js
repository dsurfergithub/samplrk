/**
 * gridModel.js — Grid Lab: el pattern de chops como rejilla de pasos (puro).
 *
 * La rejilla NO es otro formato: es una vista del mismo pattern de eventos
 * (`padId` + `beat`) que graba el Record. Una celda encendida es un evento
 * cuyo beat cae exactamente en ese paso. Así lo que haces con clics suena
 * igual en Record, Drums y Beat, y una toma en directo se puede «pegar» a la
 * rejilla (snap) para editarla celda a celda.
 *
 *   resolución  1/4 → 1 paso por negra · 1/8 → 2 · 1/16 → 4
 *   pasos       compases × 4 × pasos por negra
 *
 * `pattern.grid` (opcional) recuerda la resolución con la que se editó.
 */
import { BEATS_PER_BAR, QUANTIZE_GRIDS, addEvent, createEvent, effectiveEvents, lengthBeats, secondsPerBeat } from './patternEngine'
import { makeId } from './ids'

export const GRID_RESOLUTIONS = ['1/4', '1/8', '1/16']
export const GRID_BARS = [1, 2, 4]
export const MAX_BARS = 4
export const DEFAULT_RESOLUTION = '1/8'
/** Golpes que hacen falta para decir «has escrito una frase». */
export const GRID_MIN_HITS = 4

const EPS = 1e-4

// ---------------------------------------------------------------- rejilla

export const stepBeats = (res) => QUANTIZE_GRIDS[res] || QUANTIZE_GRIDS[DEFAULT_RESOLUTION]
export const stepsPerBeat = (res) => 1 / stepBeats(res)
export const stepsPerBar = (res) => BEATS_PER_BAR / stepBeats(res)
export const stepCount = (bars, res) => bars * stepsPerBar(res)
export const beatOfStep = (step, res) => step * stepBeats(res)
export const cellKey = (padId, step) => `${padId}:${step}`

/** Paso más cercano a un beat. El final exacto del loop se envuelve al paso 0. */
export function stepOfBeat(beat, res, bars) {
  const n = stepCount(bars, res)
  const s = Math.round(beat / stepBeats(res))
  return ((s % n) + n) % n
}

/** Paso en el que está un instante del loop (para el playhead). */
export function stepAtBeat(loopBeat, res, bars) {
  const n = stepCount(bars, res)
  return Math.floor(loopBeat / stepBeats(res) + 1e-6) % n
}

export function onGrid(beat, res) {
  const s = beat / stepBeats(res)
  return Math.abs(s - Math.round(s)) * stepBeats(res) < EPS
}

/** Etiqueta de un paso en el compás: 1 e & a 2 e & a… (1 & 2 & con corcheas). */
export function stepLabel(step, res) {
  const per = stepsPerBeat(res)
  const sub = step % per
  if (sub === 0) return String(Math.floor(step / per) % BEATS_PER_BAR + 1)
  return per === 2 ? '&' : ['', 'e', '&', 'a'][sub]
}

// ---------------------------------------------------------------- toma ↔ rejilla

/** ¿La toma no encaja tal cual en la rejilla? (golpes sueltos, o quantize aplicado) */
export function isLoose(pattern, res) {
  if (!pattern?.events.length) return false
  if ((pattern.quantize ?? 'off') !== 'off') return true
  return pattern.events.some(e => !onGrid(e.beat, res))
}

/** Cuántos golpes están fuera de la rejilla (para explicarlo en lenguaje humano). */
export function looseCount(pattern, res) {
  return pattern ? pattern.events.filter(e => !onGrid(e.beat, res)).length : 0
}

/** Mapa «pad:paso» → evento de lo que suena, redondeado a la rejilla. */
export function gridCells(pattern, res) {
  const cells = new Map()
  if (!pattern) return cells
  for (const e of effectiveEvents(pattern)) {
    const k = cellKey(e.padId, stepOfBeat(e.beat, res, pattern.bars))
    if (!cells.has(k)) cells.set(k, e)
  }
  return cells
}

/**
 * Resolución más gruesa en la que encaja casi toda la toma (≥ 80 % de golpes a
 * menos de un quinto de paso de la rejilla). Si ninguna, la más fina: pierde menos.
 */
export function suggestResolution(events) {
  if (!events.length) return DEFAULT_RESOLUTION
  for (const res of GRID_RESOLUTIONS) {
    const step = stepBeats(res)
    const near = events.filter(e => Math.abs(e.beat - Math.round(e.beat / step) * step) < step * 0.2).length
    if (near / events.length >= 0.8) return res
  }
  return GRID_RESOLUTIONS[GRID_RESOLUTIONS.length - 1]
}

/**
 * Pega los golpes (tal y como suenan, con quantize incluido) al paso más
 * cercano. Dos golpes del mismo pad que caen en el mismo paso se unen (queda
 * el más fuerte). Devuelve { pattern, merged }.
 */
export function snapPattern(pattern, res) {
  const byCell = new Map()
  let merged = 0
  for (const e of effectiveEvents(pattern)) {
    const step = stepOfBeat(e.beat, res, pattern.bars)
    const k = cellKey(e.padId, step)
    const prev = byCell.get(k)
    if (prev) {
      merged++
      if ((e.velocity ?? 1) <= (prev.e.velocity ?? 1)) continue
    }
    byCell.set(k, { e, step })
  }
  const events = [...byCell.values()].map(({ e, step }) => {
    const { rawBeat, ...rest } = e
    const beat = beatOfStep(step, res)
    return { ...rest, beat, time: beat * secondsPerBeat(pattern.bpm) }
  }).sort((a, b) => a.beat - b.beat || a.padId - b.padId)
  return { pattern: { ...pattern, events, quantize: 'off', grid: res }, merged }
}

// ---------------------------------------------------------------- editar celdas

/** Enciende o apaga una celda. Se asume un pattern ya pegado a la rejilla. */
export function setStep(pattern, padId, step, on, res, { bpm = pattern.bpm, velocity = 1 } = {}) {
  const beat = beatOfStep(step, res)
  const here = (e) => e.padId === padId && Math.abs(e.beat - beat) < EPS
  const exists = pattern.events.some(here)
  if (on === exists) return pattern
  if (!on) return { ...pattern, events: pattern.events.filter(e => !here(e)) }
  const duration = stepBeats(res) * secondsPerBeat(bpm)
  return addEvent(pattern, createEvent({ padId, beat, bpm, duration, velocity }))
}

export function clearEvents(pattern) {
  return pattern.events.length ? { ...pattern, events: [] } : pattern
}

// ---------------------------------------------------------------- longitud

/**
 * Cambia los compases. Al acortar se quitan los golpes que quedan fuera
 * (`dropped`); al alargar, con `tile` el contenido se repite (así la batería
 * sigue sonando bajo una frase más larga) y sin `tile` los compases nuevos
 * quedan vacíos, listos para escribir.
 */
export function resizePattern(pattern, bars, { tile = false } = {}) {
  if (bars === pattern.bars) return { pattern, dropped: 0 }
  const oldLen = lengthBeats(pattern)
  const newLen = bars * BEATS_PER_BAR
  let events = pattern.events
  if (newLen < oldLen) {
    events = events.filter(e => e.beat < newLen - EPS)
  } else if (tile && oldLen > 0) {
    events = [...events]
    for (let k = 1; k * oldLen < newLen; k++) {
      for (const e of pattern.events) {
        const beat = e.beat + k * oldLen
        events.push({ ...e, id: makeId('evt'), beat, time: beat * secondsPerBeat(pattern.bpm) })
      }
    }
    events.sort((a, b) => a.beat - b.beat)
  }
  return { pattern: { ...pattern, bars, events }, dropped: pattern.events.length - Math.min(pattern.events.length, events.length) }
}

/** Duplicar: el patrón se repite en los compases siguientes (1→2, 2→4). null si ya es el máximo. */
export function duplicatePattern(pattern) {
  if (pattern.bars * 2 > MAX_BARS) return null
  return resizePattern(pattern, pattern.bars * 2, { tile: true }).pattern
}

// ---------------------------------------------------------------- vista

/**
 * Todo lo que la pantalla necesita saber del pattern de chops (o de su
 * ausencia): resolución, compases, pasos, celdas y si hay que pegarlo.
 * `draft` = { bars, grid } elegidos antes de que exista el pattern;
 * `locked` = compases fijados por la batería, si la hay.
 */
export function gridView(pattern, draft, locked = null) {
  const res = pattern?.grid
    ?? (pattern?.events.length ? suggestResolution(effectiveEvents(pattern)) : draft.grid)
  const bars = pattern?.bars ?? locked ?? draft.bars
  return {
    res, bars,
    steps: stepCount(bars, res),
    cells: gridCells(pattern, res),
    hits: pattern?.events.length ?? 0,
    loose: isLoose(pattern, res),
    looseCount: looseCount(pattern, res),
  }
}
