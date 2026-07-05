/**
 * timelineEngine.js — timeline_engine
 * Secciones de canción sobre escenas. La reproducción programa todos los
 * inicios/fines con tiempos absolutos de AudioContext: sin drift acumulado.
 */
import { uid } from './sampleEngine'
import { getCtx, startTransport, stopTransport, stopAllLoops, barDuration, scheduleLoopAt } from './audioEngine'
import { getLoopBuffer } from './loopEngine'

export const SECTION_PRESETS = ['Intro', 'Verse', 'Bridge', 'Build', 'Drop', 'Outro']

export function createSection(name, sceneId, bars = 4) {
  return { id: uid('sec'), name, sceneId, bars }
}

export function totalBars(sections) {
  return sections.reduce((a, s) => a + s.bars, 0)
}

export function songDuration(sections, bpm) {
  return totalBars(sections) * 240 / bpm
}

let scheduled = []

/**
 * Reproduce la canción completa. Devuelve { startAt, duration } para la UI.
 */
export function playTimeline(sections, scenes, loops) {
  stopTimeline()
  stopAllLoops()
  stopTransport()      // reinicia la rejilla: la canción empieza en el compás 1
  startTransport()
  const c = getCtx()
  const bd = barDuration()
  const t0 = c.currentTime + 0.1
  let cursor = t0
  for (const section of sections) {
    const scene = scenes.find(s => s.id === section.sceneId)
    const end = cursor + section.bars * bd
    if (scene) {
      for (const [loopId, mix] of Object.entries(scene.loops)) {
        const loop = loops.find(l => l.id === loopId)
        const buffer = getLoopBuffer(loopId)
        if (!loop || !buffer) continue
        scheduled.push(scheduleLoopAt(loop, buffer, cursor, end, mix.vol, mix.pan))
      }
    }
    cursor = end
  }
  return { startAt: t0, duration: cursor - t0 }
}

export function stopTimeline() {
  for (const s of scheduled) { try { s.src.stop() } catch { /* noop */ } }
  scheduled = []
}
