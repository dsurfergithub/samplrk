/**
 * gridActions.js — GRID LAB: escribir el pattern de chops celda a celda.
 *
 * La rejilla edita el MISMO pattern `chops` que graba el Record (un pattern
 * son eventos: pad + beat). Por eso lo que haces con clics suena igual en
 * Drums y Beat, y una toma en directo se convierte en rejilla pegando sus
 * golpes al paso más cercano. Grabar en directo sigue siendo una opción.
 *
 * Toda edición es una sola `commit` (se deshace con Ctrl/Cmd+Z). Si hay una
 * toma pendiente de «Quedármela», editarla la guarda.
 */
import * as P from '../engines/patternEngine'
import * as G from '../engines/gridModel'
import { commit } from '../state/projectStore'
import { getRecorder, setRecorder } from '../state/recorderStore'
import { showToast } from '../state/uiStore'
import { getSequencerSnapshot, isRecording } from '../engines/sequencer'
import { currentPattern, lockedBars, getBpm, playPattern, stopPattern } from './patternActions'
import { auditionPad } from './samplerActions'
import { goto } from './sampleActions'
import { notify } from './learningActions'

const kindOf = (pt) => pt.kind ?? 'chops'

/** Vista de la rejilla ahora mismo (a partir de los stores). */
export function gridViewNow() {
  return G.gridView(currentPattern('chops'), getRecorder(), lockedBars('chops'))
}

/**
 * Aplica `fn(pattern) → pattern|null` al pattern de chops y lo guarda en el
 * proyecto (creándolo si no existía). Una sola entrada de deshacer.
 * `drums(pattern) → pattern` ajusta además la batería guardada (al cambiar de compases).
 */
function editChops(fn, { key = null, drums = null } = {}) {
  const v = gridViewNow()
  const existing = currentPattern('chops')
  const base = existing ?? { ...P.createPattern({ bars: v.bars, bpm: getBpm(), name: 'Chops' }), kind: 'chops', grid: v.res }
  const next = fn(base)
  if (!next || (next === base && existing)) return false
  const saved = { ...next, kind: 'chops', name: 'Chops' }
  commit(q => ({
    ...q,
    patterns: [
      ...q.patterns.filter(x => kindOf(x) !== 'chops').map(x => (drums && kindOf(x) === 'drums' ? drums(x) : x)),
      saved,
    ],
  }), { key })
  if (getRecorder().take?.kind === 'chops') setRecorder({ take: null }) // la toma pendiente pasa al proyecto
  return true
}

const busy = () => isRecording()

// ---------------------------------------------------------------- celdas

/**
 * Enciende/apaga una celda. Si la toma estaba suelta (grabada en directo), se
 * pega primero a la rejilla: lo que ves es lo que suena.
 * `audition`: oír el chop al ponerlo (solo si no hay nada sonando).
 */
export function setStep(padId, step, on, { audition = true, key = null } = {}) {
  if (busy()) return false
  const v = gridViewNow()
  const changed = editChops(base => {
    const p = G.isLoose(base, v.res) ? G.snapPattern(base, v.res).pattern : base
    const next = G.setStep(p, padId, step, on, v.res, { bpm: getBpm() })
    return next === base ? null : next
  }, { key })
  if (changed && on && audition && getSequencerSnapshot().phase === 'idle') auditionPad(padId)
  return changed
}

// ---------------------------------------------------------------- resolución y longitud

export function setGridResolution(res) {
  if (!G.GRID_RESOLUTIONS.includes(res)) return
  setRecorder({ grid: res })
  const p = currentPattern('chops')
  if (!p || p.grid === res) return
  if (getRecorder().take?.kind === 'chops') setRecorder({ take: { ...p, grid: res } })
  else commit(q => ({ ...q, patterns: q.patterns.map(x => (kindOf(x) === 'chops' ? { ...x, grid: res } : x)) }), { undoable: false })
}

/**
 * Cambia los compases de la rejilla. Las dos pistas duran lo mismo, así que la
 * batería (si la hay) se ajusta repitiéndose o recortándose. `tile`: al alargar,
 * repite también los chops (lo usa «Duplicar»).
 */
function resizeTracks(bars, { tile = false } = {}) {
  const wasPlaying = getSequencerSnapshot().phase === 'playing'
  const r = getRecorder()
  const chops = currentPattern('chops')
  const drumsSaved = (p) => p.patterns.find(x => kindOf(x) === 'drums')
  let dropped = 0
  let drumsChanged = false

  setRecorder({ bars })
  if (chops) {
    editChops(base => {
      const out = G.resizePattern(base, bars, { tile })
      dropped = out.dropped
      return out.pattern
    }, { drums: (d) => { const o = G.resizePattern(d, bars, { tile: true }); drumsChanged = d.bars !== bars; return o.pattern } })
  } else {
    // sin chops todavía: solo hay que acompasar la batería
    commit(q => {
      const d = drumsSaved(q)
      if (!d || d.bars === bars) return null
      drumsChanged = true
      return { ...q, patterns: q.patterns.map(x => (x === d ? G.resizePattern(d, bars, { tile: true }).pattern : x)) }
    })
  }
  if (r.take?.kind === 'drums') {
    drumsChanged ||= r.take.bars !== bars
    setRecorder({ take: G.resizePattern(r.take, bars, { tile: true }).pattern })
  }

  if (dropped) showToast(`Se han quitado ${dropped} ${dropped === 1 ? 'golpe' : 'golpes'} de los compases que sobraban. Puedes deshacerlo.`)
  else if (drumsChanged) showToast(`La batería se ha ajustado a ${bars} ${bars === 1 ? 'compás' : 'compases'}.`)
  if (wasPlaying) playPattern() // el bucle tiene otra duración: vuelve a empezar
}

export function setGridBars(bars) {
  if (busy() || !G.GRID_BARS.includes(bars) || gridViewNow().bars === bars) return
  resizeTracks(bars)
}

/** Duplicar: el patrón se repite en los compases siguientes (1→2, 2→4) para variar la segunda mitad. */
export function duplicateGrid() {
  const p = currentPattern('chops')
  if (busy() || !p?.events.length) return
  const bars = p.bars * 2
  if (bars > G.MAX_BARS) { showToast(`Ya tienes el máximo: ${G.MAX_BARS} compases.`); return }
  resizeTracks(bars, { tile: true })
  showToast('Patrón duplicado. Ahora puedes cambiar la segunda mitad.')
}

export function clearGrid() {
  if (busy()) return
  if (editChops(base => (base.events.length ? G.clearEvents(base) : null))) {
    showToast('Rejilla limpia. Si te arrepientes: Deshacer (Ctrl/Cmd+Z).')
  }
}

// ---------------------------------------------------------------- toma en directo → rejilla

/** Pega los golpes de una toma en directo a la rejilla para poder editarla celda a celda. */
export function convertToGrid({ quiet = false } = {}) {
  const v = gridViewNow()
  let merged = 0
  const done = editChops(base => {
    const out = G.snapPattern(base, v.res)
    merged = out.merged
    return out.pattern
  })
  if (done && !quiet) {
    showToast(merged
      ? `Lista para editar. ${merged} ${merged === 1 ? 'golpe repetido se ha unido' : 'golpes repetidos se han unido'} en el mismo paso.`
      : 'Lista para editar: ahora cada golpe está en una celda.')
  }
  return done
}

/** Desde Record: lleva la toma (o el pattern) a la rejilla, ya convertida. */
export function editInGrid() {
  if (gridViewNow().loose) convertToGrid({ quiet: true })
  goto('grid')
}

// ---------------------------------------------------------------- reproducir

/** Play/stop del bucle (chops + batería, si la hay). */
export function toggleGridPlay() {
  if (getSequencerSnapshot().phase !== 'idle') { stopPattern(); return }
  playPattern()
  const p = currentPattern('chops')
  if (p && p.events.length >= G.GRID_MIN_HITS) notify({ type: 'grid:played', count: p.events.length, sequence: P.padSequence(p) })
}
