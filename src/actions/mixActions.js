/**
 * mixActions.js — mezcla sencilla: volumen del sample, de la batería y general.
 * Mejor un limitador en el master que tocar el volumen de cada sample.
 */
import { setBusVolume } from '../engines/samplerEngine'
import { setMasterVolume } from '../engines/audioEngine'
import { mixOf } from '../engines/projectModel'
import { commit, getProject } from '../state/projectStore'

export function setMix(channel, value) {
  const v = Math.max(0, Math.min(1.5, value))
  commit(p => ({ ...p, settings: { ...p.settings, mix: { ...mixOf(p), [channel]: v } } }), { key: `mix:${channel}` })
  applyMix()
}

/** Lleva la mezcla del proyecto al audio (al abrir un proyecto, deshacer, etc.). */
export function applyMix(p = getProject()) {
  const m = mixOf(p)
  setBusVolume('chops', m.chops)
  setBusVolume('drums', m.drums)
  try { setMasterVolume(m.master) } catch { /* audio aún no desbloqueado */ }
}
