/**
 * midiEngine.js — Web MIDI (sin React).
 *
 * Detecta controladores, escucha note on/off y avisa de conexiones y
 * desconexiones. SAMPLRK nunca depende de MIDI: si el navegador no lo tiene
 * (Safari) o el usuario no da permiso, todo sigue con teclado y pantalla.
 */
import { parseMidiMessage } from './midiMap'

let access = null
const listeners = new Set()   // fn(message, input)
const deviceListeners = new Set() // fn(devices, change)

export function isMidiSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

export function onMidiMessage(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function onMidiDevices(fn) { deviceListeners.add(fn); return () => deviceListeners.delete(fn) }

export function listInputs() {
  if (!access) return []
  return [...access.inputs.values()].map(i => ({ id: i.id, name: i.name || 'Controlador MIDI', state: i.state }))
}

function attach(input) {
  input.onmidimessage = (ev) => {
    const msg = parseMidiMessage(ev.data)
    if (msg) listeners.forEach(fn => fn(msg, input))
  }
}

/** Pide acceso (en Chrome puede mostrar un permiso). Devuelve la lista de entradas. */
export async function startMidi() {
  if (!isMidiSupported()) throw Object.assign(new Error('unsupported'), { code: 'unsupported' })
  if (!access) {
    access = await navigator.requestMIDIAccess({ sysex: false })
    access.onstatechange = (ev) => {
      const port = ev.port
      if (port?.type === 'input' && port.state === 'connected') attach(port)
      const change = port?.type === 'input' ? { name: port.name || 'Controlador MIDI', state: port.state } : null
      deviceListeners.forEach(fn => fn(listInputs(), change))
    }
  }
  for (const input of access.inputs.values()) attach(input)
  return listInputs()
}

export function stopMidi() {
  if (!access) return
  for (const input of access.inputs.values()) input.onmidimessage = null
}
