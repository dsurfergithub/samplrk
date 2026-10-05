/**
 * history.js — deshacer/rehacer por snapshots (puro).
 *
 * El proyecto es JSON pequeño (sin audio), así que guardar el estado completo
 * en cada paso es barato y mucho más simple que un sistema de comandos.
 * Los gestos continuos (arrastrar un corte, mover un slider) se agrupan con
 * una `key`: cambios seguidos con la misma key ocupan una sola entrada.
 */

export const HISTORY_LIMIT = 100
const COALESCE_MS = 800

export function createHistory() {
  return { past: [], future: [], lastKey: null, lastAt: 0 }
}

/** Registra `prev` como estado deshacible antes de un cambio. */
export function record(h, prev, { key = null, now = Date.now() } = {}) {
  const coalesce = key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS
  if (coalesce) return { ...h, future: [], lastAt: now }
  const past = [...h.past, prev]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [], lastKey: key, lastAt: now }
}

export function canUndo(h) { return h.past.length > 0 }
export function canRedo(h) { return h.future.length > 0 }

/** Devuelve { history, state } o null si no hay nada que deshacer. */
export function undo(h, current) {
  if (!h.past.length) return null
  const state = h.past[h.past.length - 1]
  return {
    state,
    history: { past: h.past.slice(0, -1), future: [current, ...h.future], lastKey: null, lastAt: 0 },
  }
}

export function redo(h, current) {
  if (!h.future.length) return null
  const [state, ...future] = h.future
  return {
    state,
    history: { past: [...h.past, current], future, lastKey: null, lastAt: 0 },
  }
}
