/**
 * patternActions.js — RECORD: grabar lo que tocas, repetirlo, ajustarlo.
 * La grabación guarda eventos (pad + tiempo), nunca audio. Nada se cuantiza
 * mientras tocas: el ajuste a la rejilla es opcional y no destructivo.
 */
import * as P from '../engines/patternEngine'
import { startSequencer, stopSequencer, setSequencerBpm, setSequencerMetronome, beatAt, isRecording, getSequencerSnapshot } from '../engines/sequencer'
import { triggerSlice } from '../engines/samplerEngine'
import { stopPreview } from '../engines/audioEngine'
import { commit, getProject } from '../state/projectStore'
import { getRecorder, setRecorder } from '../state/recorderStore'
import { getActiveSample, getActiveBuffer } from './sampleActions'
import { notify } from './learningActions'

// ---------------------------------------------------------------- tempo

export function getBpm(p = getProject()) {
  return p.bpm ?? P.initialBpm(getActiveSample(p))
}

/** Fija el BPM del proyecto la primera vez que hace falta (no deshacible: es un valor inicial). */
export function ensureBpm() {
  const p = getProject()
  if (p.bpm === null) commit(q => ({ ...q, bpm: getBpm(q) }), { undoable: false })
  return getBpm()
}

export function setBpm(bpm) {
  const v = P.clampBpm(bpm)
  commit(q => (q.bpm === v ? null : { ...q, bpm: v }), { key: 'bpm' })
  setSequencerBpm(v)
}

const taps = []
export function tap() {
  const t = performance.now() / 1000
  taps.push(t)
  if (taps.length > 16) taps.shift()
  const bpm = P.tapTempo(taps)
  if (bpm) setBpm(bpm)
  return bpm
}

// ---------------------------------------------------------------- reproducir

/** Lo que suena ahora: la toma pendiente o el pattern guardado. */
export function currentPattern() {
  return getRecorder().take ?? getProject().patterns[0] ?? null
}

function playEvent(event, when) {
  const p = getProject()
  const sliceId = p.padBanks[0].pads[event.padId]
  const slice = sliceId && p.slices.find(s => s.id === sliceId)
  const buffer = getActiveBuffer(p)
  if (slice && buffer) triggerSlice(buffer, slice, { padKey: event.padId, when, velocity: event.velocity })
}

function sequencerOptions(pattern, extra = {}) {
  const r = getRecorder()
  return {
    bpm: getBpm(),
    lengthBeats: P.lengthBeats(pattern),
    metronome: r.metronome,
    getEvents: () => { const cp = currentPattern(); return cp ? P.effectiveEvents(cp) : [] },
    onEvent: playEvent,
    ...extra,
  }
}

export function playPattern() {
  const pattern = currentPattern()
  if (!pattern || !pattern.events.length) return
  stopPreview()
  ensureBpm()
  startSequencer(sequencerOptions(pattern))
}

export function stopPattern() { stopSequencer() }

export function togglePlay() {
  getSequencerSnapshot().phase === 'idle' ? playPattern() : stopPattern()
}

// ---------------------------------------------------------------- grabar

export function startRecording() {
  stopPreview()
  const bpm = ensureBpm()
  const r = getRecorder()
  const take = P.createPattern({ bars: r.bars, bpm, name: 'Toma' })
  setRecorder({ take })
  startSequencer(sequencerOptions(take, {
    record: true,
    countInBeats: r.countIn ? P.BEATS_PER_BAR : 0,
    onRecordEnd,
  }))
}

/** Llamado por cada golpe de pad: si se está grabando, se anota (sin cuantizar). */
export function captureHit(padId, when, duration) {
  if (!isRecording()) return
  const take = getRecorder().take
  if (!take) return
  const bpm = getBpm()
  const beat = P.beatOfHit(beatAt(when) * P.secondsPerBeat(bpm), bpm, P.lengthBeats(take))
  if (beat === null) return
  setRecorder({ take: P.addEvent(take, P.createEvent({ padId, beat, bpm, duration })) })
}

function onRecordEnd() {
  const take = getRecorder().take
  if (!take?.events.length) {
    stopSequencer()
    setRecorder({ take: null })
    notify({ type: 'record:empty' })
    return
  }
  notify({ type: 'record:done', count: take.events.length, sequence: P.padSequence(take) })
}

/** «Quedármela»: la toma pasa al proyecto (se puede deshacer). Sigue sonando. */
export function keepTake() {
  const take = getRecorder().take
  if (!take) return
  commit(q => ({ ...q, patterns: [{ ...take, name: 'Pattern 1' }] }))
  setRecorder({ take: null })
}

/** «Otra toma»: descarta y vuelve a grabar. */
export function retryTake() {
  setRecorder({ take: null })
  startRecording()
}

export function discardTake() {
  stopSequencer()
  setRecorder({ take: null })
}

export function clearPattern() {
  stopSequencer()
  commit(q => (q.patterns.length ? { ...q, patterns: [] } : null))
}

// ---------------------------------------------------------------- ajustes

export function setQuantize(q) {
  const r = getRecorder()
  const before = currentPattern()?.quantize ?? 'off'
  if (before === q) return
  if (r.take) setRecorder({ take: { ...r.take, quantize: q } })
  else commit(p => p.patterns.length ? { ...p, patterns: p.patterns.map((x, i) => i === 0 ? { ...x, quantize: q } : x) } : null)
  if (q !== 'off') { setRecorder({ usedQuantize: true }); notify({ type: 'quantize:on', grid: q }) }
  else if (r.usedQuantize) notify({ type: 'quantize:off' })
}

export function setMetronome(on) {
  setRecorder({ metronome: on })
  setSequencerMetronome(on)
}

export function setCountIn(on) { setRecorder({ countIn: on }) }
export function setBars(bars) { setRecorder({ bars }) }
