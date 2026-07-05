/**
 * library.js — library
 * Biblioteca de loops: compatibilidad musical entre loops
 * (tonalidad igual o relativa + BPM en rango razonable).
 */
import { NOTE_NAMES } from './dsp'

function noteIndex(key) { return NOTE_NAMES.indexOf(key) }

/** Compatibilidad tonal: misma tonalidad, o relativo mayor/menor. */
export function keysCompatible(a, b) {
  if (!a.key || !b.key || a.key === '—' || b.key === '—') return true
  const ia = noteIndex(a.key), ib = noteIndex(b.key)
  if (ia < 0 || ib < 0) return true
  if (ia === ib && a.mode === b.mode) return true
  // relativo: A menor ↔ C mayor → menor = (mayor + 9) % 12
  if (a.mode === 'major' && b.mode === 'minor' && (ia + 9) % 12 === ib) return true
  if (a.mode === 'minor' && b.mode === 'major' && (ib + 9) % 12 === ia) return true
  return false
}

/** BPM compatibles si la relación queda dentro de ±25% (ajustable por rate). */
export function bpmCompatible(a, b) {
  const r = a.bpm / b.bpm
  return r >= 0.75 && r <= 1.33
}

/** Recalcula el campo compatibleWith de todos los loops. */
export function computeCompatibility(loops) {
  return loops.map(l => ({
    ...l,
    compatibleWith: loops
      .filter(o => o.id !== l.id && keysCompatible(l, o) && bpmCompatible(l, o))
      .map(o => o.id),
  }))
}
