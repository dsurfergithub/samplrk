/**
 * uiStore.js — estado de interfaz (no se guarda con el proyecto).
 */
import { createStore } from './createStore'

const store = createStore({
  screen: 'home',          // home | source | cut | chop | record | drums | beat
  selectedSliceId: null,   // chop seleccionado (pad ↔ segmento)
  chopTool: 'select',      // select | cut  ("Yo corto": tocar la onda añade un corte)
  busy: null,              // texto de operación en curso
  toast: null,             // { text, tone: 'info' | 'error' }
  cutDraft: null,          // { start, end, mark } mientras se elige el fragmento
  transformOpen: false,    // Aprendizaje: el usuario abrió las transformaciones antes de su misión
  moreOpen: false,         // Aprendizaje: idem para reverse y volumen
  save: { status: 'idle' }, // autoguardado: idle | pending | saving | saved | error | unavailable
  projects: [],            // «Mis proyectos» (resúmenes, sin abrir)
})

export const useUi = store.use
export const getUi = store.get
export const setUi = store.set
export const subscribeUi = store.subscribe

let toastTimer = null
export function showToast(text, tone = 'info') {
  store.set({ toast: { text, tone } })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => store.set({ toast: null }), tone === 'error' ? 6000 : 3200)
}
