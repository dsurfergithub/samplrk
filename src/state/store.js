/**
 * store.js — estado global observable, minimalista y sin dependencias.
 * La UI se suscribe con useStore(selector); los motores no conocen el store.
 */
import { useSyncExternalStore } from 'react'

const listeners = new Set()

let state = {
  view: 'import',            // import | editor | loops | scenes | timeline
  samples: [],               // EditableSample[]
  activeSampleId: null,
  loops: [],                 // Loop[]
  scenes: [],                // Scene[]
  timeline: [],              // Section[]
  bpm: 120,
  busy: null,                // texto de operación en curso (análisis, export…)
  toast: null,
}

export const getState = () => state

export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach(l => l())
}

export function useStore(selector) {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => selector(state),
  )
}

// -------- helpers de mutación frecuentes

export function updateSample(id, patch) {
  setState(s => ({
    samples: s.samples.map(x => x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x),
  }))
}

export function updateSampleEdits(id, editsPatch) {
  updateSample(id, x => ({ edits: { ...x.edits, ...editsPatch } }))
}

let toastTimer = null
export function showToast(msg) {
  setState({ toast: msg })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => setState({ toast: null }), 3200)
}
