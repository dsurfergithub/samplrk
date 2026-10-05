/**
 * patternActions.js — RECORD y DRUMS: grabar lo que tocas, repetirlo, ajustarlo.
 *
 * Dos pistas con la misma duración: 'chops' (pads del sample) y 'drums'
 * (batería). Mientras grabas una, la otra suena de fondo. La batería se graba
 * sumando a lo que ya había (como en una MPC); los chops sustituyen la toma.
 * La grabación guarda eventos (pad + tiempo), nunca audio. Nada se cuantiza
 * mientras tocas: el ajuste a la rejilla es opcional y no destructivo.
 */
import * as P from '../engines/patternEngine'
import { startSequencer, stopSequencer, setSequencerBpm, setSequencerMetronome, beatAt, isRecording, getSequencerSnapshot } from '../engines/sequencer'
import { triggerSlice } from '../engines/samplerEngine'
import { stopPreview } from '../engines/audioEngine'
import { commit, getProject } from '../state/projectStore'
import { getRecorder, setRecorder } from '../state/recorderStore'
import { getActiveSample, getPlayableBuffer, playableSlice } from './sampleActions'
import { playDrum } from './drumActions'
import { notify } from './learningActions'

export const TRACKS = ['chops', 'drums']
const other = (kind) => (kind === 'drums' ? 'chops' : 'drums')

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

// ---------------------------------------------------------------- pistas

/** Pattern guardado de una pista (los de la v1 sin `kind` son de chops). */
export function getPattern(kind, p = getProject()) {
  return p.patterns.find(x => (x.kind ?? 'chops') === kind) ?? null
}

/** Lo que suena ahora en una pista: la toma pendiente o el pattern guardado. */
export function currentPattern(kind = 'chops') {
  const take = getRecorder().take
  return take?.kind === kind ? take : getPattern(kind)
}

/** Compases fijados por la otra pista (todas duran lo mismo), o null. */
export function lockedBars(kind) {
  const o = currentPattern(other(kind))
  return o?.events.length ? o.bars : null
}

const tagged = (kind, pattern) => (pattern ? P.effectiveEvents(pattern).map(e => ({ ...e, kind })) : [])

function allEvents() {
  return TRACKS.flatMap(k => tagged(k, currentPattern(k)))
}

function beatLength() {
  const lens = TRACKS.map(k => currentPattern(k)).filter(x => x?.events.length).map(P.lengthBeats)
  return lens.length ? Math.max(...lens) : null
}

// ---------------------------------------------------------------- reproducir

function playEvent(event, when) {
  if (event.kind === 'drums') { playDrum(event.padId, when, event.velocity); return }
  const p = getProject()
  const sliceId = p.padBanks[0].pads[event.padId]
  const slice = sliceId && p.slices.find(s => s.id === sliceId)
  const buffer = slice && getPlayableBuffer(slice.sampleId, p)
  if (slice && buffer) triggerSlice(buffer, playableSlice(slice, p), { padKey: event.padId, when, velocity: event.velocity })
}

export function hasBeat() { return beatLength() !== null }

export function playPattern() {
  const len = beatLength()
  if (!len) return
  stopPreview()
  ensureBpm()
  startSequencer({
    bpm: getBpm(), lengthBeats: len, metronome: getRecorder().metronome,
    getEvents: allEvents, onEvent: playEvent,
  })
}

export function stopPattern() { stopSequencer() }

export function togglePlay() {
  getSequencerSnapshot().phase === 'idle' ? playPattern() : stopPattern()
}

// ---------------------------------------------------------------- grabar

let preEvents = [] // batería: lo que ya había antes de esta toma (suena de fondo solo durante la grabación)

export function startRecording(kind = 'chops') {
  stopPreview()
  const bpm = ensureBpm()
  const r = getRecorder()
  const bars = lockedBars(kind) ?? r.bars
  const take = { ...P.createPattern({ bars, bpm, name: 'Toma' }), kind }
  const saved = getPattern(kind)
  if (kind === 'drums' && saved && saved.bars === bars) {
    // la batería se graba encima de lo que ya hay
    take.events = [...saved.events]
    take.quantize = saved.quantize
  }
  preEvents = take.events
  setRecorder({ take, recordedNew: 0 })
  const len = P.lengthBeats(take)
  startSequencer({
    bpm, lengthBeats: len, metronome: r.metronome,
    record: true,
    countInBeats: r.countIn ? P.BEATS_PER_BAR : 0,
    getEvents: () => tagged(kind, currentPattern(kind)),
    getBacking: () => {
      const tracks = [{ events: tagged(other(kind), currentPattern(other(kind))) }]
      if (preEvents.length) tracks.push({ events: tagged(kind, { ...take, events: preEvents }), until: len })
      return tracks
    },
    onEvent: playEvent,
    onRecordEnd: () => onRecordEnd(kind),
  })
}

/** Llamado por cada golpe de pad: si se está grabando ESA pista, se anota (sin cuantizar). */
export function captureHit(kind, padId, when, duration, velocity = 1) {
  if (!isRecording()) return
  const { take, recordedNew } = getRecorder()
  if (!take || take.kind !== kind) return
  const bpm = getBpm()
  const beat = P.beatOfHit(beatAt(when) * P.secondsPerBeat(bpm), bpm, P.lengthBeats(take))
  if (beat === null) return
  setRecorder({ take: P.addEvent(take, P.createEvent({ padId, beat, bpm, duration, velocity })), recordedNew: recordedNew + 1 })
}

function onRecordEnd(kind) {
  const { take, recordedNew } = getRecorder()
  if (!take || !recordedNew) {
    stopSequencer()
    setRecorder({ take: null })
    notify({ type: 'record:empty', kind })
    return
  }
  notify({ type: 'record:done', kind, count: recordedNew, sequence: P.padSequence(take) })
}

/** «Quedármela»: la toma pasa al proyecto (se puede deshacer). Sigue sonando. */
export function keepTake() {
  const take = getRecorder().take
  if (!take) return
  const name = take.kind === 'drums' ? 'Batería' : 'Chops'
  commit(q => ({ ...q, patterns: [...q.patterns.filter(x => (x.kind ?? 'chops') !== take.kind), { ...take, name }] }))
  setRecorder({ take: null })
}

/** «Otra toma»: descarta y vuelve a grabar la misma pista. */
export function retryTake() {
  const kind = getRecorder().take?.kind ?? 'chops'
  setRecorder({ take: null })
  startRecording(kind)
}

export function discardTake() {
  stopSequencer()
  setRecorder({ take: null })
}

export function clearPattern(kind = 'chops') {
  stopSequencer()
  commit(q => (getPattern(kind, q) ? { ...q, patterns: q.patterns.filter(x => (x.kind ?? 'chops') !== kind) } : null))
}

// ---------------------------------------------------------------- ajustes

export function setQuantize(kind, q) {
  const r = getRecorder()
  const before = currentPattern(kind)?.quantize ?? 'off'
  if (before === q) return
  if (r.take?.kind === kind) setRecorder({ take: { ...r.take, quantize: q } })
  else commit(p => getPattern(kind, p)
    ? { ...p, patterns: p.patterns.map(x => ((x.kind ?? 'chops') === kind ? { ...x, quantize: q } : x)) }
    : null)
  if (q !== 'off') { setRecorder({ usedQuantize: true }); notify({ type: 'quantize:on', grid: q }) }
  else if (r.usedQuantize) notify({ type: 'quantize:off' })
}

export function setMetronome(on) {
  setRecorder({ metronome: on })
  setSequencerMetronome(on)
}

export function setCountIn(on) { setRecorder({ countIn: on }) }
export function setBars(bars) { setRecorder({ bars }) }
