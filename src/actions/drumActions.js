/**
 * drumActions.js — DRUMS: tocar la batería con el mismo sampler que los chops.
 */
import { loadDrumKit, getDrumBuffer, drumById, drumAsSlice } from '../engines/drumKit'
import { triggerSlice } from '../engines/samplerEngine'
import { getProject } from '../state/projectStore'
import { showToast } from '../state/uiStore'
import { captureHit } from './patternActions'
import { notify } from './learningActions'

function settingsOf(id, p = getProject()) {
  return p.drumKit?.pads.find(x => x.id === id) ?? {}
}

/** Prepara el kit (se sintetiza una vez, en milisegundos). */
export async function ensureKit() {
  try { await loadDrumKit() } catch { showToast('No he podido preparar la batería.', 'error') }
}

function trigger(id, when, velocity) {
  const buffer = getDrumBuffer(id)
  const def = drumById(id)
  if (!buffer || !def) return null
  return triggerSlice(buffer, drumAsSlice(id, buffer, settingsOf(id)), {
    padKey: `drum:${id}`, bus: 'drums', choke: def.choke, when, velocity,
  })
}

/** Golpe en vivo: suena ya, se graba si toca y, si corta al charles abierto, el coach lo explica. */
export function hitDrum(id, velocity = 1) {
  const v = trigger(id, 0, velocity)
  if (!v) return
  captureHit('drums', id, v.startAt, v.endAt - v.startAt, velocity)
  if (v.choked) notify({ type: 'drum:choke' })
}

/** Golpe programado por el secuenciador. */
export function playDrum(id, when, velocity = 1) { trigger(id, when, velocity) }
