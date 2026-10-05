/**
 * learningActions.js — la app informa al coach de lo que acaba de pasar.
 * El coach responde (o no) con una frase; nunca toca el proyecto.
 */
import { react, flipKind } from '../engines/coachEngine'
import { originalOrder } from '../engines/sliceModel'
import { getLearning, setLearning, markProgress, emptyProgress } from '../state/learningStore'
import { getProject, commit } from '../state/projectStore'
import { setUi } from '../state/uiStore'
import { stopPreview } from '../engines/audioEngine'
import { currentMission, doneIds, COVERED_MESSAGES } from '../engines/missions'

const hits = [] // { pad, t } — últimos golpes de pad (solo runtime)

export function recordHit(pad) {
  hits.push({ pad, t: performance.now() / 1000 })
  if (hits.length > 32) hits.shift()
}

export function clearHits() { hits.length = 0 }

const PROGRESS_BY_EVENT = {
  'find:marked': ['findComplete'],
  'cut:confirmed': ['findComplete', 'cutComplete'],
  'loop:on': ['loopComplete'],
  'chops:created': ['chopComplete'],
  'pitch:changed': ['pitchComplete'],
  'reverse:on': ['reverseComplete'],
  'beat:played': ['beatComplete'],
  'beat:exported': ['beatComplete'],
  'resample:done': ['resampleComplete'],
}

/** Golpes seguidos que cuentan como «has tocado los pads». */
const PLAY_HITS = 4

export function notify(event) {
  const p = getProject()
  const ctx = { hits, order: originalOrder(p.padBanks[0].pads, p.slices) }
  // el progreso no depende de que el coach esté encendido
  for (const k of PROGRESS_BY_EVENT[event.type] ?? []) markProgress(k)
  if (event.type === 'pad:hit' && hits.length >= PLAY_HITS) markProgress('playComplete')
  if (event.type === 'record:done') markProgress(event.kind === 'drums' ? 'drumsComplete' : 'recordComplete')
  const flip = flipKind(event, ctx)
  if (flip) markProgress('flipComplete')
  if (flip === 'reorder') markProgress('reorderComplete')
  const L = getLearning()
  if (!L.coachEnabled) return
  const msg = react(event, ctx, new Set(L.seen))
  if (!msg) return
  // en Aprendizaje, si la misión ya explica este concepto, el coach no lo repite
  if (p.mode === 'learning' && COVERED_MESSAGES.has(msg.id)) {
    setLearning(s => ({ seen: [...s.seen, msg.id] }))
    return
  }
  setLearning(s => ({ message: msg, seen: [...s.seen, msg.id] }))
}

export function dismissMessage() { setLearning({ message: null }) }

export function setCoachEnabled(on) { setLearning({ coachEnabled: on, message: on ? getLearning().message : null }) }

// ---------------------------------------------------------------- misiones

/** «Ya sé hacer esto»: salta la misión y pasa a la siguiente. */
export function skipMission(id) {
  setLearning(s => ({ skipped: [...new Set([...s.skipped, id])], exploring: false }))
  goToCurrentMission()
}

function ackDone() {
  const L = getLearning()
  setLearning({ acked: [...new Set([...L.acked, ...doneIds(L.progress)])] })
}

/** «Seguir»: cierra lo cumplido y lleva a la pantalla de la misión siguiente. */
export function continueMissions() {
  ackDone()
  setLearning({ exploring: false })
  goToCurrentMission()
}

/** «Quedarme aquí y experimentar»: la misión siguiente espera sin interrumpir. */
export function stayAndExplore() {
  ackDone()
  setLearning({ exploring: true })
}

export function goToCurrentMission() {
  const L = getLearning()
  const m = currentMission(L.progress, L.skipped)
  setLearning({ exploring: false })
  if (!m) return
  const p = getProject()
  // si la misión necesita un sample y aún no hay, se empieza por elegir disco
  const screen = !p.activeSampleId ? 'source' : m.screens[m.screens.length - 1]
  stopPreview()
  setUi({ screen })
}

export function setMode(mode) {
  commit(p => (p.mode === mode ? null : { ...p, mode }), { undoable: false })
  setCoachEnabled(mode === 'learning')
}

export function resetProgress() {
  setLearning({ progress: emptyProgress(), skipped: [], acked: [], exploring: false, seen: [], message: null })
}
