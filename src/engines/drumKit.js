/**
 * drumKit.js — el kit de batería de SAMPLRK.
 *
 * Un solo kit, bueno y simple: bombo, caja, charles cerrado y abierto.
 * Los sonidos se sintetizan en el navegador con código propio (sin derechos
 * de terceros) y se tocan con el MISMO sampler que los chops: cada pad de
 * batería es un "slice" que ocupa todo su buffer.
 */
import * as S from './demo/synth'

export const DRUM_PADS = [
  { id: 'kick', name: 'Kick', label: 'Bombo', short: 'K', color: '#ff8787', key: 'KeyJ', gain: 1, choke: null, length: 0.5 },
  { id: 'snare', name: 'Snare', label: 'Caja', short: 'S', color: '#ffd43b', key: 'KeyK', gain: 0.85, choke: null, length: 0.4 },
  { id: 'hat', name: 'Hat', label: 'Charles', short: 'H', color: '#74c0fc', key: 'KeyL', gain: 0.55, choke: 'hat', length: 0.15 },
  { id: 'open', name: 'Open', label: 'Abierto', short: 'O', color: '#b197fc', key: 'Semicolon', gain: 0.5, choke: 'hat', length: 0.7 },
]

export const DRUM_IDS = DRUM_PADS.map(d => d.id)
export const drumById = (id) => DRUM_PADS.find(d => d.id === id) ?? null
export const drumForCode = (code) => DRUM_PADS.find(d => d.key === code) ?? null

/** Modelo serializable del kit para el proyecto (ajustes por pad). */
export function createDrumKit() {
  return {
    id: 'kit-samplrk-1',
    name: 'Kit SAMPLRK',
    pads: DRUM_PADS.map(d => ({ id: d.id, gain: d.gain, pitch: 0 })),
  }
}

/** El pad de batería como "slice" para el sampler (todo el buffer). */
export function drumAsSlice(drumId, buffer, settings = {}) {
  const def = drumById(drumId)
  return {
    id: `drum:${drumId}`,
    start: 0, end: buffer.duration,
    pitch: settings.pitch ?? 0,
    gain: settings.gain ?? def?.gain ?? 1,
    reversed: false,
    fadeInMs: 0, fadeOutMs: 8,
  }
}

const RENDER = {
  kick: (ctx, out) => { S.kick(ctx, out, 0, 1); S.rim(ctx, out, 0, 0.25) },
  snare: (ctx, out) => S.snare(ctx, out, 0, 1, 1900),
  hat: (ctx, out) => S.hat(ctx, out, 0, 1, false),
  open: (ctx, out) => S.hat(ctx, out, 0, 1, true),
}

const cache = new Map() // id → AudioBuffer
let loading = null

/** Prepara (una vez) los buffers del kit. */
export function loadDrumKit() {
  if (!loading) {
    loading = Promise.all(DRUM_PADS.map(async (d) => {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
      const sr = 44100
      const ctx = new OAC(1, Math.ceil(d.length * sr), sr)
      const bus = ctx.createGain()
      bus.connect(ctx.destination)
      RENDER[d.id](ctx, bus)
      const buf = await ctx.startRendering()
      normalize(buf, 0.9)
      cache.set(d.id, buf)
    })).then(() => cache)
  }
  return loading
}

export function getDrumBuffer(id) { return cache.get(id) ?? null }

function normalize(buffer, target) {
  const d = buffer.getChannelData(0)
  let peak = 0
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]))
  if (peak > 1e-6) for (let i = 0; i < d.length; i++) d[i] *= target / peak
  // micro-fade final: el buffer termina en silencio exacto
  const f = Math.min(64, d.length)
  for (let i = 0; i < f; i++) d[d.length - 1 - i] *= i / f
}
