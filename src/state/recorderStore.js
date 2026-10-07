/**
 * recorderStore.js — estado del grabador (runtime, no se guarda).
 * La toma en curso vive aquí hasta que el usuario decide quedársela:
 * entonces pasa al proyecto como pattern (deshacible).
 */
import { createStore } from './createStore'

const store = createStore({
  take: null,          // Pattern recién grabado (con `kind`), pendiente de «Quedármela / Otra toma»
  recordedNew: 0,      // golpes nuevos en la toma en curso (la batería suma sobre lo anterior)
  bars: 2,             // compases a grabar (y los de la rejilla mientras no exista pattern)
  grid: '1/8',         // resolución de la rejilla mientras no exista pattern
  countIn: true,       // cuenta atrás de un compás
  metronome: false,    // opcional: nunca se impone
  usedQuantize: false, // para la pista de "groove" al volver a Original
})

export const useRecorder = store.use
export const getRecorder = store.get
export const setRecorder = store.set
export const subscribeRecorder = store.subscribe
