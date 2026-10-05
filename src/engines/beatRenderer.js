/**
 * beatRenderer.js — exporta el beat a audio (OfflineAudioContext).
 * Misma receta que en vivo: buildVoice del sampler, buses con su volumen,
 * master con limitador y el mismo plan de cortes (re-disparos y choke).
 * No se graba la salida de audio: se renderiza, más rápido y sin pérdidas.
 */
import { buildVoice } from './samplerEngine'
import { planBeat } from './beatPlan'
import { drumById, getDrumBuffer, drumAsSlice } from './drumKit'
import { mixOf } from './projectModel'

const SR = 44100
const CUT_FADE = 0.008

/** Renderiza `loops` vueltas del beat. `sampleBuffer` es el audio del sample activo. */
export async function renderBeat(project, { bpm, loops = 1, sampleBuffer }) {
  const pads = project.padBanks[0].pads
  const sliceOf = (padId) => project.slices.find(s => s.id === pads[padId]) ?? null
  const tracks = project.patterns.map(pattern => {
    const kind = pattern.kind ?? 'chops'
    return {
      kind, pattern,
      keyOf: e => e.padId,
      chokeOf: e => (kind === 'drums' ? drumById(e.padId)?.choke ?? null : null),
    }
  })
  const plan = planBeat(tracks, bpm, loops)
  if (!plan.hits.length) throw new Error('No hay nada que exportar todavía')

  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const ctx = new OAC(2, Math.ceil(plan.duration * SR), SR)
  const mix = mixOf(project)
  const master = ctx.createGain()
  master.gain.value = mix.master
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -4; limiter.knee.value = 2; limiter.ratio.value = 20
  limiter.attack.value = 0.002; limiter.release.value = 0.12
  master.connect(limiter).connect(ctx.destination)
  const bus = {}
  for (const name of ['chops', 'drums']) {
    bus[name] = ctx.createGain()
    bus[name].gain.value = mix[name]
    bus[name].connect(master)
  }

  for (const h of plan.hits) {
    let buffer, slice
    if (h.kind === 'drums') {
      buffer = getDrumBuffer(h.event.padId)
      if (!buffer) continue
      slice = drumAsSlice(h.event.padId, buffer, project.drumKit?.pads.find(x => x.id === h.event.padId))
    } else {
      buffer = sampleBuffer
      slice = sliceOf(h.event.padId)
      if (!slice) continue
    }
    const v = buildVoice(ctx, bus[h.kind === 'drums' ? 'drums' : 'chops'], buffer, slice, h.at, h.event.velocity ?? 1)
    if (v && h.cutAt !== null && h.cutAt < v.endAt) {
      // corte limpio: mantiene el nivel y baja en 8 ms (sin clic)
      const g = v.gain.gain
      g.cancelScheduledValues(h.cutAt)
      g.setValueAtTime((slice.gain ?? 1) * (h.event.velocity ?? 1), h.cutAt)
      g.linearRampToValueAtTime(0, h.cutAt + CUT_FADE)
      v.src.stop(h.cutAt + CUT_FADE + 0.002)
    }
  }
  return ctx.startRendering()
}
