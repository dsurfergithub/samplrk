/**
 * createStore.js — store observable mínimo (sin dependencias).
 * Mismo patrón que el store de la v0.1, pero como fábrica: así el estado
 * del proyecto, la UI y el aprendizaje viven en stores separados.
 */
import { useSyncExternalStore } from 'react'

export function createStore(initial) {
  let state = initial
  const listeners = new Set()

  const get = () => state
  const set = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch
    if (!next) return
    state = { ...state, ...next }
    listeners.forEach(l => l())
  }
  const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
  const use = (selector) => useSyncExternalStore(subscribe, () => selector(state))

  return { get, set, subscribe, use }
}
