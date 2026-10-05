/**
 * uiStore.js — estado de interfaz (no se guarda con el proyecto).
 */
import { createStore } from './createStore'

const store = createStore({
  screen: 'home',          // home | source | cut | chop
  selectedSliceId: null,   // chop seleccionado (pad ↔ segmento)
  chopTool: 'select',      // select | cut  ("Yo corto": tocar la onda añade un corte)
  busy: null,              // texto de operación en curso
  toast: null,             // { text, tone: 'info' | 'error' }
  cutDraft: null,          // { start, end, mark } mientras se elige el fragmento
})

export const useUi = store.use
export const getUi = store.get
export const setUi = store.set

let toastTimer = null
export function showToast(text, tone = 'info') {
  store.set({ toast: { text, tone } })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => store.set({ toast: null }), tone === 'error' ? 6000 : 3200)
}
