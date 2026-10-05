/**
 * recorderStore.js — estado del grabador (runtime, no se guarda).
 * La toma en curso vive aquí hasta que el usuario decide quedársela:
 * entonces pasa al proyecto como pattern (deshacible).
 */
import { createStore } from './createStore'

const store = createStore({
  take: null,          // Pattern recién grabado, pendiente de «Quedármela / Otra toma»
  bars: 2,             // compases a grabar
  countIn: true,       // cuenta atrás de un compás
  metronome: false,    // opcional: nunca se impone
  usedQuantize: false, // para la pista de "groove" al volver a Original
})

export const useRecorder = store.use
export const getRecorder = store.get
export const setRecorder = store.set
