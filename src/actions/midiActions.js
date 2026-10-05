/**
 * midiActions.js — MIDI → pads. Velocity incluida (también al grabar).
 * MIDI learn: elegir un pad y pulsar una tecla del controlador.
 */
import { startMidi, stopMidi, onMidiMessage, onMidiDevices, isMidiSupported } from '../engines/midiEngine'
import { resolveNote, assignNote, defaultMidiMap, sanitizeMap, velocityToGain, noteName } from '../engines/midiMap'
import { getDrumBuffer, drumById } from '../engines/drumKit'
import * as DB from '../engines/persistenceEngine'
import { getMidi, setMidi } from '../state/midiStore'
import { getUi, showToast } from '../state/uiStore'
import { hitPad } from './samplerActions'
import { hitDrum, ensureKit } from './drumActions'
import { notify } from './learningActions'
import { padLetter } from '../engines/sliceModel'

let wired = false

function save() {
  const { status, map } = getMidi()
  DB.setMeta('midi', { enabled: status === 'on', map }).catch(() => { /* preferencia: no crítica */ })
}

export function targetLabel(t) {
  if (!t) return ''
  return t.kind === 'drums' ? (drumById(t.id)?.label ?? t.id) : `Pad ${padLetter(t.pad)}`
}

function onMessage(msg) {
  if (msg.type !== 'noteon') return
  const { learn, map } = getMidi()
  if (learn) {
    setMidi({ map: assignNote(map, msg.note, learn), learn: null, last: { note: msg.note, velocity: msg.velocity, target: learn } })
    showToast(`${noteName(msg.note)} → ${targetLabel(learn)}`)
    save()
    return
  }
  const target = resolveNote(map, msg.note, getUi().screen)
  setMidi({ last: { note: msg.note, velocity: msg.velocity, target } })
  if (!target) return
  const gain = velocityToGain(msg.velocity)
  if (target.kind === 'drums') {
    if (!getDrumBuffer(target.id)) { ensureKit(); return }
    hitDrum(target.id, gain)
  } else {
    hitPad(target.pad, gain)
  }
  if (msg.velocity < 90) notify({ type: 'midi:soft' })
}

function onDevices(devices, change) {
  setMidi({ devices })
  if (!change) return
  showToast(change.state === 'connected' ? `Controlador conectado: ${change.name}` : `Controlador desconectado: ${change.name}`)
}

/** Activa MIDI (desde un botón). En Safari explica que no está disponible. */
export async function enableMidi({ silent = false } = {}) {
  if (!isMidiSupported()) { setMidi({ status: 'unsupported' }); return false }
  setMidi({ status: 'asking' })
  try {
    const devices = await startMidi()
    if (!wired) { onMidiMessage(onMessage); onMidiDevices(onDevices); wired = true }
    setMidi({ status: 'on', devices })
    save()
    return true
  } catch (err) {
    const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
    setMidi({ status: denied ? 'denied' : 'error' })
    if (!silent) showToast(denied ? 'Sin permiso para usar MIDI. Puedes darlo en los ajustes del sitio del navegador.' : 'No he podido activar MIDI.', 'error')
    return false
  }
}

export function disableMidi() {
  stopMidi()
  setMidi({ status: 'off', learn: null })
  save()
}

export function startLearn(target) { setMidi({ learn: target }) }
export function cancelLearn() { setMidi({ learn: null }) }

export function resetMidiMap() {
  setMidi({ map: defaultMidiMap(), learn: null })
  save()
}

/** Al arrancar: recupera el mapa y, si MIDI estaba activo, lo reactiva sin molestar. */
export async function bootMidi() {
  if (!isMidiSupported()) { setMidi({ status: 'unsupported' }); return }
  try {
    const saved = await DB.getMeta('midi')
    if (saved?.map) setMidi({ map: sanitizeMap(saved.map) })
    if (saved?.enabled) await enableMidi({ silent: true })
  } catch { /* sin preferencias guardadas */ }
}
