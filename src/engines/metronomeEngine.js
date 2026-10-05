/**
 * metronomeEngine.js — clics de metrónomo y cuenta atrás.
 * Volumen independiente del resto (su propio GainNode hacia el master).
 */
import { getCtx, getMasterInput } from './audioEngine'

let bus = null
let volume = 0.6
const pending = new Set() // osciladores programados (para cancelarlos al parar)

function getBus() {
  if (!bus) {
    bus = getCtx().createGain()
    bus.gain.value = volume
    bus.connect(getMasterInput())
  }
  return bus
}

export function setMetronomeVolume(v) {
  volume = Math.max(0, Math.min(1, v))
  if (bus) bus.gain.setTargetAtTime(volume, getCtx().currentTime, 0.02)
}
export function getMetronomeVolume() { return volume }

/** Programa un clic en `when`. `accent` = primer tiempo del compás (más agudo). */
export function click(when, accent = false) {
  const c = getCtx()
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.value = accent ? 1760 : 1175
  const g = c.createGain()
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(accent ? 0.9 : 0.55, when + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
  o.connect(g).connect(getBus())
  o.start(when)
  o.stop(when + 0.06)
  pending.add(o)
  o.onended = () => { pending.delete(o); g.disconnect() }
}

/** Cancela los clics que aún no han sonado. */
export function cancelClicks() {
  const now = getCtx().currentTime
  for (const o of pending) { try { o.stop(now) } catch { /* ya sonó */ } }
  pending.clear()
}
