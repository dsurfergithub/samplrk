/**
 * audioEngine.js — audio_engine
 * AudioContext único, transporte compartido (BPM + compases) y scheduler
 * cuantizado: ningún loop entra ni sale fuera del compás.
 */

let ctx = null

export function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

// ------------------------------------------------------------- transporte

const T = {
  playing: false,
  bpm: 120,
  startTime: 0,          // tiempo de AudioContext del compás 0
  active: new Map(),     // loopId → { src, gain, pan, loop }
  listeners: new Set(),
}

// snapshot inmutable cacheado (requisito de useSyncExternalStore)
let snapshot = { playing: false, bpm: 120, activeLoopIds: [] }

function notify() {
  snapshot = { playing: T.playing, bpm: T.bpm, activeLoopIds: [...T.active.keys()] }
  T.listeners.forEach(fn => fn())
}

/** Suscripción para la UI (estado de transporte y loops activos). */
export function subscribeTransport(fn) {
  T.listeners.add(fn)
  return () => T.listeners.delete(fn)
}

export function getTransport() { return snapshot }

export function barDuration() { return 240 / T.bpm } // 4/4

export function currentBar() {
  if (!T.playing) return 0
  return Math.max(0, (getCtx().currentTime - T.startTime) / barDuration())
}

/** Próximo límite de compás en tiempo de AudioContext. */
export function nextBarTime() {
  const c = getCtx()
  if (!T.playing) return c.currentTime + 0.06
  const bd = barDuration()
  const n = Math.max(0, Math.ceil((c.currentTime - T.startTime) / bd - 1e-4))
  return T.startTime + n * bd
}

export function setBpm(bpm) {
  bpm = Math.max(40, Math.min(220, bpm))
  T.bpm = bpm
  // reajustar la velocidad de los loops activos para mantener la sincronía
  for (const a of T.active.values()) {
    a.src.playbackRate.value = playbackRateFor(a.loop)
  }
  if (T.playing) T.startTime = getCtx().currentTime // reinicia la rejilla en el nuevo tempo
  notify()
}

export function startTransport() {
  const c = getCtx()
  if (c.state === 'suspended') c.resume()
  if (T.playing) return
  T.playing = true
  T.startTime = c.currentTime + 0.06
  notify()
}

export function stopTransport() {
  for (const [id] of T.active) stopLoopNow(id)
  T.playing = false
  notify()
}

// ------------------------------------------------------------- loops en vivo

function playbackRateFor(loop) {
  return (T.bpm / loop.bpm) * Math.pow(2, (loop.pitch || 0) / 12)
}

/** Programa un loop entre dos tiempos absolutos (usado por escenas y timeline). */
export function scheduleLoopAt(loop, buffer, startAt, stopAt = null, vol = 1, pan = 0) {
  const c = getCtx()
  const src = c.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.playbackRate.value = playbackRateFor(loop)
  const gain = c.createGain()
  gain.gain.value = vol
  let node = src
  let panner = null
  if (c.createStereoPanner) {
    panner = c.createStereoPanner()
    panner.pan.value = pan
    node.connect(panner); panner.connect(gain)
  } else {
    node.connect(gain)
  }
  gain.connect(c.destination)
  src.start(startAt)
  if (stopAt !== null) src.stop(stopAt)
  return { src, gain, pan: panner, loop }
}

/** Activa un loop cuantizado al próximo compás. Arranca el transporte si hace falta. */
export function startLoop(loop, buffer, { vol = 1, pan = 0 } = {}) {
  if (T.active.has(loop.id)) return
  if (!T.playing) startTransport()
  const entry = scheduleLoopAt(loop, buffer, nextBarTime(), null, vol, pan)
  entry.src.onended = () => { /* liberado por stop */ }
  T.active.set(loop.id, entry)
  notify()
}

/** Desactiva un loop en el próximo compás (nunca corta a mitad). */
export function stopLoop(loopId) {
  const a = T.active.get(loopId)
  if (!a) return
  try { a.src.stop(nextBarTime()) } catch { /* ya parado */ }
  T.active.delete(loopId)
  notify()
}

function stopLoopNow(loopId) {
  const a = T.active.get(loopId)
  if (!a) return
  try { a.src.stop() } catch { /* ya parado */ }
  T.active.delete(loopId)
}

export function toggleLoop(loop, buffer, opts) {
  T.active.has(loop.id) ? stopLoop(loop.id) : startLoop(loop, buffer, opts)
}

export function isLoopActive(loopId) { return T.active.has(loopId) }

export function stopAllLoops() {
  const t = nextBarTime()
  for (const [id, a] of T.active) {
    try { a.src.stop(t) } catch { /* noop */ }
    T.active.delete(id)
  }
  notify()
}

/** Lanza una escena: en el MISMO límite de compás paran unos loops y entran otros. */
export function launchScene(scene, loops, getBuffer) {
  if (!T.playing) startTransport()
  const t = nextBarTime()
  for (const [id, a] of T.active) {
    if (!scene.loops[id]) {
      try { a.src.stop(t) } catch { /* noop */ }
      T.active.delete(id)
    }
  }
  for (const [loopId, mix] of Object.entries(scene.loops)) {
    if (T.active.has(loopId)) {
      const a = T.active.get(loopId)
      a.gain.gain.setValueAtTime(mix.vol, t)
      if (a.pan) a.pan.pan.setValueAtTime(mix.pan, t)
      continue
    }
    const loop = loops.find(l => l.id === loopId)
    const buffer = loop && getBuffer(loopId)
    if (!loop || !buffer) continue
    T.active.set(loopId, scheduleLoopAt(loop, buffer, t, null, mix.vol, mix.pan))
  }
  notify()
}

// ------------------------------------------------------------- previews

let previewSrc = null

/** Preescucha un buffer (o un tramo) sin cuantizar; corta la preescucha anterior. */
export function playPreview(buffer, { offset = 0, duration = null, rate = 1 } = {}) {
  const c = getCtx()
  if (c.state === 'suspended') c.resume()
  stopPreview()
  const src = c.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  src.connect(c.destination)
  duration === null ? src.start(0, offset) : src.start(0, offset, duration)
  src.onended = () => { if (previewSrc === src) previewSrc = null }
  previewSrc = src
  return src
}

export function stopPreview() {
  if (previewSrc) { try { previewSrc.stop() } catch { /* noop */ } previewSrc = null }
}
