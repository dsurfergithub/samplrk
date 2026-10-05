/**
 * beatPlan.js — plan de reproducción de un beat (puro).
 *
 * Convierte las pistas (chops + batería) en una lista de golpes con su hora
 * exacta y, si hace falta, la hora a la que se cortan: un pad que se vuelve
 * a tocar corta su golpe anterior, y los pads de un mismo grupo de choke
 * (charles cerrado / abierto) se cortan entre sí. El export offline sigue
 * este plan, así que suena igual que en vivo.
 */
import { effectiveEvents, lengthBeats, secondsPerBeat } from './patternEngine'

/**
 * tracks: [{ kind, pattern, keyOf(event) → padKey, chokeOf(event) → grupo|null }]
 * Devuelve { duration, hits: [{ kind, event, at, key, choke, cutAt|null }] }.
 */
export function planBeat(tracks, bpm, loops = 1) {
  const live = tracks.filter(t => t.pattern?.events.length)
  if (!live.length) return { duration: 0, hits: [] }
  const len = Math.max(...live.map(t => lengthBeats(t.pattern)))
  const spb = secondsPerBeat(bpm)
  const hits = []
  for (const t of live) {
    for (let k = 0; k < loops; k++) {
      for (const e of effectiveEvents(t.pattern)) {
        hits.push({ kind: t.kind, event: e, at: (k * len + e.beat) * spb, key: `${t.kind}:${t.keyOf(e)}`, choke: t.chokeOf?.(e) ?? null, cutAt: null })
      }
    }
  }
  hits.sort((a, b) => a.at - b.at)
  const lastByKey = new Map()
  const lastByChoke = new Map()
  for (const h of hits) {
    const prev = lastByKey.get(h.key)
    if (prev) prev.cutAt = h.at
    if (h.choke) {
      const pc = lastByChoke.get(h.choke)
      if (pc && pc !== prev && pc.key !== h.key) pc.cutAt = pc.cutAt === null ? h.at : Math.min(pc.cutAt, h.at)
      lastByChoke.set(h.choke, h)
    }
    lastByKey.set(h.key, h)
  }
  return { duration: loops * len * spb, hits }
}

/** Resumen objetivo del beat (nunca una nota de calidad). */
export function beatSummary(project, bpm) {
  const chops = project.patterns.find(p => p.kind !== 'drums') ?? null
  const drums = project.patterns.find(p => p.kind === 'drums') ?? null
  const bars = Math.max(chops?.bars ?? 0, drums?.bars ?? 0)
  const pads = project.padBanks[0].pads
  const usedPads = new Set((chops?.events ?? []).map(e => e.padId))
  const usedSlices = [...usedPads].map(i => project.slices.find(s => s.id === pads[i])).filter(Boolean)
  return {
    bars,
    seconds: bars * 4 * secondsPerBeat(bpm),
    bpm,
    chopsUsed: usedSlices.length,
    chopsTotal: project.slices.filter(s => s.sampleId === project.activeSampleId).length,
    pitched: usedSlices.filter(s => s.pitch !== 0).length,
    reversed: usedSlices.filter(s => s.reversed).length,
    chopHits: chops?.events.length ?? 0,
    drumHits: drums?.events.length ?? 0,
    drumsUsed: [...new Set((drums?.events ?? []).map(e => e.padId))],
    quantize: { chops: chops?.quantize ?? 'off', drums: drums?.quantize ?? 'off' },
  }
}
