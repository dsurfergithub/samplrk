/**
 * sliceModel.js — chops (slices) y banco de pads. Funciones puras.
 *
 * Un slice es solo { start, end } en segundos sobre el buffer ORIGINAL del
 * sample: nunca se copia audio. Un banco de pads es un array de 16 posiciones
 * que referencian slices por id (o null si el pad está vacío).
 *
 * Todas las funciones devuelven estructuras nuevas (no mutan la entrada),
 * así encajan con el historial de deshacer/rehacer.
 */
import { makeId } from './ids'

export const MAX_PADS = 16
export const MIN_SLICE = 0.03          // s — por debajo no se oye como "trozo"
const EPS = 1e-4

/** Colores de chop: distinguibles entre sí y legibles sobre fondo oscuro. */
export const CHOP_COLORS = [
  '#ff9f43', '#4dabf7', '#69db7c', '#f783ac', '#ffd43b', '#9775fa', '#38d9a9', '#ff6b6b',
  '#e599f7', '#74c0fc', '#c0eb75', '#ffa8a8', '#66d9e8', '#ffc078', '#b197fc', '#8ce99a',
]

export function padLetter(index) { return String.fromCharCode(65 + index) }

export function createSlice({ sampleId, start, end, color = CHOP_COLORS[0], name = '' }) {
  return {
    id: makeId('slc'),
    sampleId,
    start, end,
    name, color,
    pitch: 0, gain: 1, reversed: false,
    triggerMode: 'oneshot',
    fadeInMs: 2, fadeOutMs: 6,
    keyBinding: null, midiNote: null,
  }
}

export const sliceDuration = (s) => Math.max(0, s.end - s.start)

export function byStart(slices) { return [...slices].sort((a, b) => a.start - b.start) }

export function sliceAt(slices, t) {
  return slices.find(s => t >= s.start - EPS && t < s.end + EPS) ?? null
}

/** Color menos usado de la paleta (para chops nuevos). */
export function nextColor(slices) {
  const used = new Map(CHOP_COLORS.map(c => [c, 0]))
  for (const s of slices) if (used.has(s.color)) used.set(s.color, used.get(s.color) + 1)
  let best = CHOP_COLORS[0], min = Infinity
  for (const [c, n] of used) if (n < min) { min = n; best = c }
  return best
}

// ---------------------------------------------------------------- creación

/** Divide [start, end] en n partes iguales. */
export function equalSlices(sampleId, start, end, n) {
  n = Math.max(1, Math.min(MAX_PADS, Math.floor(n)))
  const len = (end - start) / n
  return Array.from({ length: n }, (_, i) => createSlice({
    sampleId,
    start: start + i * len,
    end: i === n - 1 ? end : start + (i + 1) * len,
    color: CHOP_COLORS[i % CHOP_COLORS.length],
  }))
}

/**
 * Cortes en los golpes detectados dentro de [start, end].
 * Si hay más golpes que pads, se eliminan primero los cortes que crean los
 * trozos más cortos (los menos útiles para tocar).
 */
export function hitBoundaries(start, end, hits, maxCount = MAX_PADS, minGap = 0.08) {
  const inside = hits.filter(t => t > start + minGap && t < end - minGap).sort((a, b) => a - b)
  const bounds = [start]
  for (const t of inside) if (t - bounds[bounds.length - 1] >= minGap) bounds.push(t)
  bounds.push(end)
  while (bounds.length - 1 > maxCount) {
    // quita el límite interior cuyo trozo resultante más corto es mínimo
    let worst = 1, worstLen = Infinity
    for (let i = 1; i < bounds.length - 1; i++) {
      const len = Math.min(bounds[i] - bounds[i - 1], bounds[i + 1] - bounds[i])
      if (len < worstLen) { worstLen = len; worst = i }
    }
    bounds.splice(worst, 1)
  }
  return bounds
}

export function slicesFromHits(sampleId, start, end, hits, maxCount = MAX_PADS) {
  const b = hitBoundaries(start, end, hits, maxCount)
  return b.slice(0, -1).map((s, i) => createSlice({
    sampleId, start: s, end: b[i + 1], color: CHOP_COLORS[i % CHOP_COLORS.length],
  }))
}

// ---------------------------------------------------------------- edición

/** Divide un slice en `at` (por defecto, en su mitad). Devuelve null si no cabe. */
export function splitSlice(slices, id, at = null) {
  const s = slices.find(x => x.id === id)
  if (!s) return null
  const t = at ?? (s.start + s.end) / 2
  if (t - s.start < MIN_SLICE || s.end - t < MIN_SLICE) return null
  const right = { ...s, id: makeId('slc'), start: t, name: '', color: nextColor(slices) }
  return {
    slices: slices.map(x => x.id === id ? { ...x, end: t } : x).concat(right),
    created: right,
  }
}

/** El slice que empieza justo donde termina `id` (vecino contiguo), si existe. */
export function nextAdjacent(slices, id) {
  const s = slices.find(x => x.id === id)
  if (!s) return null
  return slices.find(x => x.id !== id && x.sampleId === s.sampleId && Math.abs(x.start - s.end) < 1e-3) ?? null
}

/** Une un slice con su vecino contiguo de la derecha. Conserva las propiedades del primero. */
export function mergeWithNext(slices, id) {
  const s = slices.find(x => x.id === id)
  const n = nextAdjacent(slices, id)
  if (!s || !n) return null
  return {
    slices: slices.filter(x => x.id !== n.id).map(x => x.id === id ? { ...x, end: n.end } : x),
    removed: n,
  }
}

export function removeSlice(slices, id) {
  return slices.filter(x => x.id !== id)
}

/**
 * Mueve un borde de un slice. Si otro slice comparte ese borde (están pegados)
 * se mueve con él, para que arrastrar un corte se sienta como mover una tijera.
 * `bounds` limita el movimiento a la región del sample.
 */
export function moveEdge(slices, id, edge, t, bounds = { min: 0, max: Infinity }) {
  const s = slices.find(x => x.id === id)
  if (!s) return slices
  const shared = edge === 'start'
    ? slices.find(x => x.id !== id && Math.abs(x.end - s.start) < 1e-3)
    : slices.find(x => x.id !== id && Math.abs(x.start - s.end) < 1e-3)
  let lo = bounds.min, hi = bounds.max
  if (edge === 'start') {
    hi = Math.min(hi, s.end - MIN_SLICE)
    if (shared) lo = Math.max(lo, shared.start + MIN_SLICE)
  } else {
    lo = Math.max(lo, s.start + MIN_SLICE)
    if (shared) hi = Math.min(hi, shared.end - MIN_SLICE)
  }
  const v = Math.max(lo, Math.min(hi, t))
  return slices.map(x => {
    if (x.id === id) return edge === 'start' ? { ...x, start: v } : { ...x, end: v }
    if (shared && x.id === shared.id) return edge === 'start' ? { ...x, end: v } : { ...x, start: v }
    return x
  })
}

export function updateSlice(slices, id, patch) {
  return slices.map(x => x.id === id ? { ...x, ...patch } : x)
}

// ---------------------------------------------------------------- banco de pads

export function emptyPads() { return Array(MAX_PADS).fill(null) }

/** Pads en orden temporal: A = primer trozo de la grabación. */
export function padsInTimeOrder(slices) {
  const pads = emptyPads()
  byStart(slices).slice(0, MAX_PADS).forEach((s, i) => { pads[i] = s.id })
  return pads
}

/** Coloca un slice en el primer pad libre a partir de `after` (circular). */
export function placeInPads(pads, sliceId, after = -1) {
  const out = [...pads]
  for (let k = 1; k <= MAX_PADS; k++) {
    const i = (after + k + MAX_PADS) % MAX_PADS
    if (out[i] === null) { out[i] = sliceId; return out }
  }
  return out
}

export function removeFromPads(pads, sliceId) {
  return pads.map(p => p === sliceId ? null : p)
}

export function swapPads(pads, i, j) {
  if (i < 0 || j < 0 || i >= pads.length || j >= pads.length) return pads
  const out = [...pads]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export function padIndexOf(pads, sliceId) { return pads.indexOf(sliceId) }

/** 8 pads mientras quepan; 16 si hay alguno asignado en la segunda mitad. */
export function visiblePadCount(pads) {
  return pads.some((p, i) => i >= 8 && p !== null) ? 16 : 8
}

/** Orden en el que los pads reproducen la grabación original (para el coach). */
export function originalOrder(pads, slices) {
  const byId = new Map(slices.map(s => [s.id, s]))
  return pads
    .map((id, i) => ({ i, s: id ? byId.get(id) : null }))
    .filter(x => x.s)
    .sort((a, b) => a.s.start - b.s.start)
    .map(x => x.i)
}
