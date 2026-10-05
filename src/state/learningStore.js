/**
 * learningStore.js — progreso de aprendizaje y mensajes del coach.
 * Separado del proyecto: lo que has aprendido no depende de qué beat abres.
 */
import { createStore } from './createStore'

export const PROGRESS_KEYS = [
  'findComplete', 'cutComplete', 'loopComplete', 'chopComplete', 'playComplete',
  'recordComplete', 'flipComplete', 'pitchComplete', 'drumsComplete', 'resampleComplete',
]

const store = createStore({
  progress: Object.fromEntries(PROGRESS_KEYS.map(k => [k, false])),
  seen: [],                // ids de mensajes del coach ya mostrados
  message: null,           // { id, kind, text, term? }
  coachEnabled: true,
})

export const useLearning = store.use
export const getLearning = store.get
export const setLearning = store.set

export function markProgress(key) {
  store.set(s => (s.progress[key] ? null : { progress: { ...s.progress, [key]: true } }))
}
