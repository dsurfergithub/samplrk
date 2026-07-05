/**
 * projectEngine.js — project_engine
 * Escenas: por diseño solo almacenan qué loops están activos + volumen + pan.
 */
import { uid } from './sampleEngine'

const SCENE_COLORS = ['#a3ff3f', '#4fd8ff', '#ff4fa3', '#ffb03a', '#b48cff', '#ff6e5e']

/** Captura el estado actual (loops activos + mezcla) como escena. */
export function createScene(name, activeLoopIds, mixer = {}, index = 0) {
  const loops = {}
  for (const id of activeLoopIds) {
    loops[id] = { vol: mixer[id]?.vol ?? 1, pan: mixer[id]?.pan ?? 0 }
  }
  return {
    id: uid('scn'),
    name: name || `Escena ${index + 1}`,
    color: SCENE_COLORS[index % SCENE_COLORS.length],
    loops,
  }
}

/** Serializa el proyecto a JSON (sin audio; los buffers no se serializan). */
export function serializeProject(state) {
  return JSON.stringify({
    app: 'SAMPLRK', version: 1,
    bpm: state.bpm,
    samples: state.samples.map(({ id, name, source, sampleRate, channels, duration, analysis, edits, markers, regions, slices }) =>
      ({ id, name, source, sampleRate, channels, duration, analysis, edits, markers, regions, slices })),
    loops: state.loops.map(l => ({ ...l })),
    scenes: state.scenes,
    timeline: state.timeline,
  }, null, 2)
}
