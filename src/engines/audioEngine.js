/**
 * audioEngine.js — audio_engine
 * AudioContext único, master bus con limitador, desbloqueo del audio,
 * preescucha y el transporte compartido (BPM + compases) de la v0.1.
 *
 * Tres tipos de reproducción conviven sin pisarse:
 *   preview  → escuchar el sample (una voz, opcionalmente en bucle) — aquí
 *   pads     → samplerEngine.js (polifónico)
 *   loops    → transporte legacy (escenas/timeline) — aquí
 */

let ctx = null
let master = null    // { input: GainNode, limiter: DynamicsCompressorNode }

const audioListeners = new Set()
let audioState = 'idle' // idle | suspended | running | closed | unsupported

function setAudioState(s) {
  if (s === audioState) return
  audioState = s
  audioListeners.forEach(fn => fn())
}

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) { setAudioState('unsupported'); throw new Error('Web Audio no disponible') }
    ctx = new AC({ latencyHint: 'interactive' })
    ctx.onstatechange = () => setAudioState(ctx.state)
    setAudioState(ctx.state)
  }
  return ctx
}

/**
 * Entrada del master bus. Todo lo que suena pasa por aquí:
 * ganancia general → limitador suave → altavoces.
 * Evita la saturación cuando suenan muchos pads a la vez.
 */
export function getMasterInput() {
  const c = getCtx()
  if (!master) {
    const input = c.createGain()
    input.gain.value = 0.8
    const limiter = c.createDynamicsCompressor()
    limiter.threshold.value = -4
    limiter.knee.value = 2
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.12
    input.connect(limiter)
    limiter.connect(c.destination)
    master = { input, limiter }
  }
  return master.input
}

export function setMasterVolume(v) {
  getMasterInput().gain.setTargetAtTime(Math.max(0, Math.min(1.5, v)), getCtx().currentTime, 0.02)
}

export function getAudioState() { return audioState }
export function subscribeAudioState(fn) { audioListeners.add(fn); return () => audioListeners.delete(fn) }

/**
 * Desbloquea el audio. Debe llamarse dentro de un gesto del usuario
 * (pulsar un botón). En iOS además hace sonar un buffer silencioso.
 * Devuelve el estado final ('running' si todo va bien).
 */
export async function unlockAudio() {
  const c = getCtx()
  if (c.state === 'suspended' || c.state === 'interrupted') await c.resume()
  const silent = c.createBuffer(1, 1, c.sampleRate)
  const src = c.createBufferSource()
  src.buffer = silent
  src.connect(c.destination)
  src.start(0)
  getMasterInput()
  setAudioState(c.state)
  return c.state
}

/** Reanuda sin esperar (para el camino crítico de los pads). */
export function ensureRunning() {
  const c = getCtx()
  if (c.state !== 'running') c.resume().catch(() => { /* lo reporta audioState */ })
  return c
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
  gain.connect(getMasterInput())
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

let preview = null   // { src, startedAt, offset, rate, loop, loopStart, loopEnd, duration }
const previewListeners = new Set()
function notifyPreview() { previewListeners.forEach(fn => fn()) }

/**
 * Preescucha un buffer (o un tramo) sin cuantizar; corta la preescucha anterior.
 * Con `loop: true` repite el tramo [offset, offset + duration] hasta que se pare.
 */
export function playPreview(buffer, { offset = 0, duration = null, rate = 1, loop = false } = {}) {
  const c = ensureRunning()
  stopPreview()
  const src = c.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  src.connect(getMasterInput())
  const dur = duration ?? buffer.duration - offset
  const startedAt = c.currentTime + 0.01
  if (loop) {
    src.loop = true
    src.loopStart = offset
    src.loopEnd = offset + dur
    src.start(startedAt, offset)
  } else {
    src.start(startedAt, offset)
    src.stop(startedAt + dur / rate)
  }
  src.onended = () => { if (preview?.src === src) { preview = null; notifyPreview() } }
  preview = { src, startedAt, offset, rate, loop, loopStart: offset, loopEnd: offset + dur, duration: dur }
  notifyPreview()
  return src
}

export function stopPreview() {
  if (preview) {
    try { preview.src.stop() } catch { /* noop */ }
    preview = null
    notifyPreview()
  }
}

export function isPreviewing() { return preview !== null }
export function subscribePreview(fn) { previewListeners.add(fn); return () => previewListeners.delete(fn) }

/** Posición actual de la preescucha en segundos del buffer (o null). Para playheads. */
export function previewPosition() {
  if (!preview || !ctx) return null
  const elapsed = Math.max(0, ctx.currentTime - preview.startedAt) * preview.rate
  if (preview.loop) return preview.loopStart + (elapsed % (preview.loopEnd - preview.loopStart))
  return Math.min(preview.offset + elapsed, preview.offset + preview.duration)
}
