/**
 * sequencer.js — reloj musical de SAMPLRK (sin React).
 *
 * Patrón "lookahead": un temporizador ligero (cada 25 ms) programa con
 * antelación (120 ms) los sonidos que caen en la siguiente ventana, usando
 * el reloj del AudioContext. El temporizador puede llegar tarde; el audio no,
 * porque cada sonido ya lleva su hora exacta.
 *
 *   beat < 0           → cuenta atrás (clics)
 *   0 ≤ beat < len     → grabando (modo 'record') o sonando
 *   beat ≥ playFrom    → el pattern se repite en bucle
 *
 * La UI no recibe ticks: consulta `position()` con rAF cuando lo necesita y
 * solo se entera de los cambios de fase (idle/countin/recording/playing).
 */
import { getCtx, ensureRunning } from './audioEngine'
import { click, cancelClicks } from './metronomeEngine'
import { eventsInWindow, beatsInWindow, BEATS_PER_BAR } from './patternEngine'
import { stopAllVoices } from './samplerEngine'

const LOOKAHEAD = 0.12  // s
const TICK_MS = 25

let S = null           // estado de la sesión en curso
let timer = null
const listeners = new Set()
let snapshot = { phase: 'idle' }

function setPhase(phase) {
  if (snapshot.phase === phase) return
  snapshot = { phase }
  listeners.forEach(fn => fn())
}

export function subscribeSequencer(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function getSequencerSnapshot() { return snapshot }

/**
 * Arranca. Opciones:
 *  bpm, lengthBeats, countInBeats (0 = sin cuenta atrás),
 *  record (bool), metronome (bool),
 *  getEvents() → eventos a reproducir (se consulta en cada tick: el quantize cambia en vivo);
 *               al grabar, son los de la toma y empiezan a sonar tras ella,
 *  getBacking() → [{ events, until? }] pistas que suenan desde el "1" incluso
 *               mientras grabas (p. ej. tus chops al grabar batería);
 *               `until` = beat absoluto a partir del cual esa pista calla,
 *  onEvent(event, when) → dispara el sonido,
 *  onRecordEnd() → al terminar la toma.
 */
export function startSequencer(opts) {
  stopSequencer()
  const c = ensureRunning()
  const spb = 60 / opts.bpm
  const countIn = opts.countInBeats ?? 0
  const startAt = c.currentTime + 0.1
  S = {
    ...opts,
    spb,
    origin: startAt + countIn * spb,   // hora del "1"
    scheduledTo: -countIn,             // beats ya programados
    playFrom: opts.record ? opts.lengthBeats : 0,
    recordEnded: false,
  }
  timer = setInterval(tick, TICK_MS)
  tick()
  setPhase(countIn > 0 ? 'countin' : opts.record ? 'recording' : 'playing')
}

function tick() {
  if (!S) return
  const c = getCtx()
  const now = c.currentTime
  const horizon = (now + LOOKAHEAD - S.origin) / S.spb
  const from = S.scheduledTo
  if (horizon > from) {
    for (const b of beatsInWindow(from, horizon)) {
      const countIn = b < 0
      if (countIn || S.metronome) click(S.origin + b * S.spb, ((b % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0)
    }
    const events = S.getEvents()
    for (const { event, at } of eventsInWindow(events, S.lengthBeats, Math.max(0, from), horizon, S.playFrom)) {
      S.onEvent(event, S.origin + at * S.spb)
    }
    for (const track of S.getBacking?.() ?? []) {
      for (const { event, at } of eventsInWindow(track.events, S.lengthBeats, Math.max(0, from), horizon, 0)) {
        if (track.until === undefined || at < track.until) S.onEvent(event, S.origin + at * S.spb)
      }
    }
    S.scheduledTo = horizon
  }
  // cambios de fase (para la UI)
  const beat = (now - S.origin) / S.spb
  if (beat < 0) return
  if (S.record && !S.recordEnded) {
    if (beat >= S.lengthBeats) { S.recordEnded = true; setPhase('playing'); S.onRecordEnd?.() }
    else setPhase('recording')
  } else if (!S.record) setPhase('playing')
}

export function stopSequencer() {
  clearInterval(timer)
  timer = null
  if (S) { cancelClicks(); stopAllVoices() }
  S = null
  setPhase('idle')
}

/** Cambia el tempo sin saltos: el beat actual se mantiene. */
export function setSequencerBpm(bpm) {
  if (!S) return
  const now = getCtx().currentTime
  const beat = (now - S.origin) / S.spb
  S.spb = 60 / bpm
  S.origin = now - beat * S.spb
  // lo ya programado se queda (≤ 120 ms); a partir de ahí, nuevo tempo
}

export function setSequencerMetronome(on) { if (S) S.metronome = on }

/**
 * Posición actual: { phase, beat, loopBeat, lengthBeats }.
 * `beat` es negativo en la cuenta atrás. Para playheads (rAF), no para React.
 */
export function position() {
  if (!S) return { phase: 'idle', beat: 0, loopBeat: 0, lengthBeats: 0 }
  const beat = (getCtx().currentTime - S.origin) / S.spb
  const loopBeat = beat < 0 ? beat : beat % S.lengthBeats
  return { phase: snapshot.phase, beat, loopBeat, lengthBeats: S.lengthBeats }
}

/** Beat (relativo al "1") de un instante del AudioContext, durante una sesión. */
export function beatAt(when) {
  if (!S) return null
  return (when - S.origin) / S.spb
}

export function isRecording() {
  return snapshot.phase === 'countin' || snapshot.phase === 'recording'
}
