/**
 * samplerEngine.js — sampler de pads (sin React).
 *
 * Cada disparo crea su propio AudioBufferSourceNode (son de un solo uso) que
 * lee directamente del buffer ORIGINAL con un offset: un chop nunca copia audio.
 *
 *   source(buffer original, offset = slice.start, rate = pitch)
 *     → gain (velocity × gain del chop, micro-fades anti-clic)
 *     → master bus
 *
 * Reverse: se usa un único buffer invertido por sample (creado bajo demanda y
 * cacheado) y se refleja el offset. Pitch: playbackRate, como los samplers
 * clásicos, así que también cambia la duración.
 *
 * Polifonía: varios pads suenan a la vez sin cortarse. Volver a tocar el MISMO
 * pad corta su voz anterior (con fade corto) — así un "C C C" suena nítido.
 * Si se supera MAX_VOICES se roba la voz más antigua.
 *
 * Choke groups: los pads de un mismo grupo se cortan entre sí (el charles
 * cerrado corta al abierto, como en una batería real).
 *
 * Buses: cada voz sale por un bus ('chops' o 'drums') con su volumen, y de
 * ahí al master. `buildVoice` es la misma receta para el audio en vivo y
 * para el render offline del export: lo que oyes es lo que exportas.
 */
import { getCtx, getMasterInput, ensureRunning } from './audioEngine'
import { semitonesToRate } from './pitch'

const MAX_VOICES = 24
const STEAL_FADE = 0.008   // s

const voices = []          // { padKey, src, gain, startAt, endAt, sliceId }
const reversedCache = new WeakMap() // AudioBuffer → AudioBuffer invertido
const listeners = new Set()

/** Suscripción a disparos: fn({ type: 'start'|'end', padKey, sliceId, startAt, endAt }). */
export function subscribeSampler(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function emit(ev) { listeners.forEach(fn => fn(ev)) }

// ---------------------------------------------------------------- buses

const busGain = { chops: 1, drums: 0.9 }
const buses = new Map() // nombre → GainNode (contexto en vivo)

export const BUS_NAMES = ['chops', 'drums']

function getBus(name = 'chops') {
  let b = buses.get(name)
  if (!b) {
    b = getCtx().createGain()
    b.gain.value = busGain[name] ?? 1
    b.connect(getMasterInput())
    buses.set(name, b)
  }
  return b
}

export function setBusVolume(name, v) {
  busGain[name] = Math.max(0, Math.min(1.5, v))
  const b = buses.get(name)
  if (b) b.gain.setTargetAtTime(busGain[name], getCtx().currentTime, 0.02)
}

export function getBusVolume(name) { return busGain[name] ?? 1 }

export function reversedOf(buffer) {
  let r = reversedCache.get(buffer)
  if (!r) {
    r = getCtx().createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c)
      const out = new Float32Array(src.length)
      for (let i = 0, n = src.length; i < n; i++) out[i] = src[n - 1 - i]
      r.copyToChannel(out, c)
    }
    reversedCache.set(buffer, r)
  }
  return r
}

export function releaseVoice(v, at) {
  const g = v.gain.gain
  try {
    g.cancelScheduledValues(at)
    g.setValueAtTime(g.value, at)
    g.linearRampToValueAtTime(0, at + STEAL_FADE)
    v.src.stop(at + STEAL_FADE + 0.002)
  } catch { /* la voz ya había terminado */ }
}

function removeVoice(v) {
  const i = voices.indexOf(v)
  if (i >= 0) voices.splice(i, 1)
}

/**
 * Construye una voz en cualquier contexto (en vivo u offline) hacia `dest`.
 * `slice` necesita { start, end, pitch, gain, reversed, fadeInMs, fadeOutMs }.
 * Devuelve { src, gain, startAt, endAt } o null si el trozo está vacío.
 */
export function buildVoice(ctx, dest, buffer, slice, at, velocity = 1) {
  const rate = semitonesToRate(slice.pitch)
  const start = Math.max(0, Math.min(slice.start, buffer.duration))
  const end = Math.max(start, Math.min(slice.end, buffer.duration))
  const len = end - start
  if (len <= 0) return null
  const outDur = len / rate

  const src = ctx.createBufferSource()
  src.buffer = slice.reversed ? reversedOf(buffer) : buffer
  src.playbackRate.value = rate
  const offset = slice.reversed ? buffer.duration - end : start

  const level = Math.max(0, (slice.gain ?? 1) * velocity)
  const fadeIn = Math.min((slice.fadeInMs ?? 2) / 1000, outDur / 4)
  const fadeOut = Math.min((slice.fadeOutMs ?? 6) / 1000, outDur / 4)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(level, at + Math.max(fadeIn, 0.0005))
  gain.gain.setValueAtTime(level, at + outDur - fadeOut)
  gain.gain.linearRampToValueAtTime(0, at + outDur)

  src.connect(gain)
  gain.connect(dest)
  // Sin el 3er parámetro de start(): su unidad con rate ≠ 1 es ambigua entre
  // navegadores. Se para en tiempo de salida = duración / rate.
  src.start(at, offset)
  src.stop(at + outDur + 0.005)
  return { src, gain, startAt: at, endAt: at + outDur }
}

/**
 * Dispara un chop (o un pad de batería). `padKey` identifica el pad (para
 * cortar su voz previa); `choke` es su grupo de corte (opcional); `bus` el
 * canal de mezcla. Devuelve { startAt, endAt } en tiempo de AudioContext.
 */
export function triggerSlice(buffer, slice, { padKey = slice.id, velocity = 1, when = 0, bus = 'chops', choke = null } = {}) {
  const c = ensureRunning()
  const now = c.currentTime
  const at = Math.max(now, when)

  // corta la voz anterior del mismo pad y las de su grupo de choke
  let choked = false
  for (const v of voices) {
    if (v.endAt <= at) continue
    const sameGroup = choke && v.choke === choke && v.padKey !== padKey
    if (v.padKey === padKey || sameGroup) {
      releaseVoice(v, at); v.endAt = at
      if (sameGroup) choked = true
    }
  }
  // límite de polifonía: roba la más antigua
  while (voices.length >= MAX_VOICES) { const old = voices.shift(); releaseVoice(old, at) }

  const built = buildVoice(c, getBus(bus), buffer, slice, at, velocity)
  if (!built) return null
  const { src, gain, endAt } = built
  const voice = { padKey, src, gain, startAt: at, endAt, sliceId: slice.id, choke }
  voices.push(voice)
  src.onended = () => {
    removeVoice(voice)
    gain.disconnect()
    emit({ type: 'end', padKey, sliceId: slice.id })
  }
  emit({ type: 'start', padKey, sliceId: slice.id, startAt: at, endAt, rate: src.playbackRate.value, reversed: !!slice.reversed, slice, choked })
  return { startAt: at, endAt, choked }
}

/** Para todas las voces de los pads (con fade corto, sin clic). */
export function stopAllVoices() {
  const at = getCtx().currentTime
  for (const v of [...voices]) releaseVoice(v, at)
  voices.length = 0
}

/**
 * Voces activas en este instante (para dibujar playheads con rAF).
 * Devuelve [{ sliceId, padKey, progress 0..1 }].
 */
export function activeVoices() {
  if (!voices.length) return []
  const now = getCtx().currentTime
  const out = []
  for (const v of voices) {
    if (now < v.startAt || now > v.endAt) continue
    out.push({ sliceId: v.sliceId, padKey: v.padKey, progress: (now - v.startAt) / (v.endAt - v.startAt) })
  }
  return out
}
