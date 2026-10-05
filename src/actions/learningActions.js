/**
 * learningActions.js — la app informa al coach de lo que acaba de pasar.
 * El coach responde (o no) con una frase; nunca toca el proyecto.
 */
import { react } from '../engines/coachEngine'
import { originalOrder } from '../engines/sliceModel'
import { getLearning, setLearning, markProgress } from '../state/learningStore'
import { getProject } from '../state/projectStore'

const hits = [] // { pad, t } — últimos golpes de pad (solo runtime)

export function recordHit(pad) {
  hits.push({ pad, t: performance.now() / 1000 })
  if (hits.length > 32) hits.shift()
}

export function clearHits() { hits.length = 0 }

const PROGRESS_BY_EVENT = {
  'cut:confirmed': ['findComplete', 'cutComplete'],
  'loop:on': ['loopComplete'],
  'chops:created': ['chopComplete'],
  'pad:hit': ['playComplete'],
  'pitch:changed': ['pitchComplete'],
}

export function notify(event) {
  for (const k of PROGRESS_BY_EVENT[event.type] ?? []) markProgress(k)
  const L = getLearning()
  if (!L.coachEnabled) return
  const p = getProject()
  const bank = p.padBanks[0]
  const ctx = { hits, order: originalOrder(bank.pads, p.slices) }
  const msg = react(event, ctx, new Set(L.seen))
  if (!msg) return
  if (msg.term === 'flip') markProgress('flipComplete')
  setLearning(s => ({ message: msg, seen: [...s.seen, msg.id] }))
}

export function dismissMessage() { setLearning({ message: null }) }

export function setCoachEnabled(on) { setLearning({ coachEnabled: on, message: on ? getLearning().message : null }) }
