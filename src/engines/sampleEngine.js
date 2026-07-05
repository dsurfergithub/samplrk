/**
 * sampleEngine.js — sample_engine
 * Modelo EditableSample: el núcleo de SAMPLRK.
 * El audio original nunca se toca; las ediciones son un objeto declarativo
 * que se aplica al renderizar (trim, reverse, gain, normalize, fades, pitch).
 */
import { getCtx } from './audioEngine'
import { mixdownChannels } from './dsp'

let idSeq = 0
export function uid(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${(++idSeq).toString(36)}` }

// Los AudioBuffer viven fuera del store (no son serializables ni reactivos).
const runtime = new Map() // sampleId → { buffer }

export function registerBuffer(id, buffer) { runtime.set(id, { buffer }) }
export function getRuntime(id) { return runtime.get(id) }
export function releaseBuffer(id) { runtime.delete(id) }

export function defaultEdits() {
  return {
    trimStart: 0, trimEnd: null,      // segundos sobre el original
    gain: 1, normalize: false,
    fadeInMs: 0, fadeOutMs: 0,
    reversed: false, pitchSemitones: 0,
  }
}

/** Crea un EditableSample a partir de un AudioBuffer decodificado. */
export function createEditableSample({ name, buffer, source = 'archivo' }) {
  const id = uid('smp')
  registerBuffer(id, buffer)
  return {
    id, name, source,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    duration: buffer.duration,
    createdAt: new Date().toISOString(),
    analysis: null,
    markers: [], regions: [], slices: [],
    edits: defaultEdits(),
  }
}

/** Duración tras aplicar el recorte. */
export function editedDuration(sample) {
  const end = sample.edits.trimEnd ?? sample.duration
  return Math.max(0, end - sample.edits.trimStart)
}

/**
 * Renderiza las ediciones a canales Float32Array nuevos (no destructivo).
 * Orden: trim → reverse → gain/normalize → fades.
 */
export function renderEditedData(sample) {
  const rt = getRuntime(sample.id)
  if (!rt) throw new Error('Buffer no registrado para ' + sample.id)
  const { buffer } = rt
  const sr = buffer.sampleRate
  const e = sample.edits
  const s0 = Math.max(0, Math.floor(e.trimStart * sr))
  const s1 = Math.min(buffer.length, Math.floor((e.trimEnd ?? buffer.duration) * sr))
  const n = Math.max(1, s1 - s0)
  const channels = []
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const v = src[e.reversed ? s1 - 1 - i : s0 + i]
      out[i] = v
      const a = Math.abs(v)
      if (a > peak) peak = a
    }
    channels.push(out)
  }
  const g = e.gain * (e.normalize && peak > 0 ? 0.98 / peak : 1)
  const fadeIn = Math.floor(e.fadeInMs / 1000 * sr)
  const fadeOut = Math.floor(e.fadeOutMs / 1000 * sr)
  for (const ch of channels) {
    if (g !== 1) for (let i = 0; i < n; i++) ch[i] *= g
    for (let i = 0; i < Math.min(fadeIn, n); i++) ch[i] *= i / fadeIn
    for (let i = 0; i < Math.min(fadeOut, n); i++) ch[n - 1 - i] *= i / fadeOut
  }
  return { channels, sampleRate: sr }
}

/** Igual que renderEditedData pero devuelve un AudioBuffer listo para reproducir. */
export function renderEditedBuffer(sample) {
  const { channels, sampleRate } = renderEditedData(sample)
  const ctx = getCtx()
  const buf = ctx.createBuffer(channels.length, channels[0].length, sampleRate)
  channels.forEach((ch, i) => buf.copyToChannel(ch, i))
  return buf
}

/** Mezcla mono del sample editado (para análisis y dibujo). */
export function editedMono(sample) {
  const { channels, sampleRate } = renderEditedData(sample)
  return { data: mixdownChannels(channels), sampleRate }
}

/** Transitorios del análisis mapeados al dominio editado (tras trim/reverse). */
export function editedTransients(sample) {
  if (!sample.analysis) return []
  const e = sample.edits
  const dur = editedDuration(sample)
  const end = e.trimEnd ?? sample.duration
  return sample.analysis.transients
    .filter(t => t >= e.trimStart && t <= end)
    .map(t => e.reversed ? end - t : t - e.trimStart)
    .filter(t => t >= 0 && t <= dur)
    .sort((a, b) => a - b)
}

/** Rate de reproducción derivado del pitch no destructivo. */
export function pitchRate(sample) {
  return Math.pow(2, sample.edits.pitchSemitones / 12)
}
