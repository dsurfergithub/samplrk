/**
 * projectStore.js — el proyecto (serializable) + deshacer/rehacer.
 *
 * Aquí solo vive JSON: samples (EditableSample), slices, bancos de pads…
 * Nada de AudioBuffer ni nodos (eso está en el runtime de cada motor).
 * Toda modificación pasa por `commit`, que guarda el estado previo en el
 * historial. Los gestos continuos usan `key` para ocupar una sola entrada.
 */
import { createStore } from './createStore'
import { createProject } from '../engines/projectModel'
import { createHistory, record, undo as hUndo, redo as hRedo } from './history'

const store = createStore({ project: createProject(), history: createHistory() })

export const useProject = (selector) => store.use(s => selector(s.project))
export const useHistory = (selector) => store.use(s => selector(s.history))
export const getProject = () => store.get().project

/** Cambio deshacible. `fn(project) → project` (o null para no hacer nada). */
export function commit(fn, { key = null, undoable = true } = {}) {
  store.set(s => {
    const next = fn(s.project)
    if (!next || next === s.project) return null
    return {
      project: next,
      history: undoable ? record(s.history, s.project, { key }) : s.history,
    }
  })
}

export function undo() {
  store.set(s => {
    const r = hUndo(s.history, s.project)
    return r && { project: r.state, history: r.history }
  })
}

export function redo() {
  store.set(s => {
    const r = hRedo(s.history, s.project)
    return r && { project: r.state, history: r.history }
  })
}

/** Sustituye el proyecto entero (nuevo proyecto / cargar). Limpia el historial. */
export function replaceProject(project) {
  store.set({ project, history: createHistory() })
}

export const subscribeProject = store.subscribe
