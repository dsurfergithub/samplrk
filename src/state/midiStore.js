/**
 * midiStore.js — estado MIDI de la interfaz (preferencia del equipo, no del proyecto).
 */
import { createStore } from './createStore'
import { defaultMidiMap } from '../engines/midiMap'

const store = createStore({
  status: 'off',        // off | asking | on | denied | unsupported | error
  devices: [],          // [{ id, name, state }]
  map: defaultMidiMap(),
  learn: null,          // destino esperando una nota: { kind, pad } | { kind, id }
  last: null,           // { note, velocity, target } — último golpe recibido
})

export const useMidi = store.use
export const getMidi = store.get
export const setMidi = store.set
export const subscribeMidi = store.subscribe
