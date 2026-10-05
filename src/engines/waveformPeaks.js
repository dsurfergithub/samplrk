/**
 * waveformPeaks.js — datos para dibujar ondas rápido (sin React ni DOM).
 *
 * Por cada AudioBuffer se calcula UNA vez una mezcla mono y una tabla de
 * mínimos/máximos por bloques de BLOCK muestras. Al dibujar, cada píxel
 * agrega bloques en lugar de recorrer todas las muestras: con 3 minutos de
 * audio, ~2.000 operaciones por píxel pasan a ser ~10.
 */
import { mixdownChannels } from './dsp'

export const BLOCK = 128
const cache = new WeakMap() // AudioBuffer → { mono, mins, maxs, sampleRate }

export function peaksFor(buffer) {
  let p = cache.get(buffer)
  if (p) return p
  const channels = []
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c))
  const mono = mixdownChannels(channels)
  const nBlocks = Math.ceil(mono.length / BLOCK)
  const mins = new Float32Array(nBlocks)
  const maxs = new Float32Array(nBlocks)
  for (let b = 0; b < nBlocks; b++) {
    let mn = 1, mx = -1
    const end = Math.min(mono.length, (b + 1) * BLOCK)
    for (let i = b * BLOCK; i < end; i++) { const v = mono[i]; if (v < mn) mn = v; if (v > mx) mx = v }
    mins[b] = mn; maxs[b] = mx
  }
  p = { mono, mins, maxs, sampleRate: buffer.sampleRate }
  cache.set(buffer, p)
  return p
}

/** [min, max] entre las muestras s0 y s1 (s1 exclusivo). */
export function rangeMinMax(p, s0, s1) {
  s0 = Math.max(0, Math.floor(s0))
  s1 = Math.min(p.mono.length, Math.ceil(s1))
  if (s1 <= s0) return null
  let mn = 1, mx = -1
  if (s1 - s0 < BLOCK * 2) {
    for (let i = s0; i < s1; i++) { const v = p.mono[i]; if (v < mn) mn = v; if (v > mx) mx = v }
    return [mn, mx]
  }
  // bordes con muestras sueltas, centro con bloques
  const b0 = Math.ceil(s0 / BLOCK), b1 = Math.floor(s1 / BLOCK)
  for (let i = s0; i < b0 * BLOCK; i++) { const v = p.mono[i]; if (v < mn) mn = v; if (v > mx) mx = v }
  for (let b = b0; b < b1; b++) { if (p.mins[b] < mn) mn = p.mins[b]; if (p.maxs[b] > mx) mx = p.maxs[b] }
  for (let i = b1 * BLOCK; i < s1; i++) { const v = p.mono[i]; if (v < mn) mn = v; if (v > mx) mx = v }
  return [mn, mx]
}

/** Columnas [min, max] para `width` píxeles entre t0 y t1 (segundos). */
export function columns(p, t0, t1, width) {
  const out = new Float32Array(width * 2)
  const spp = (t1 - t0) * p.sampleRate / width
  for (let x = 0; x < width; x++) {
    const s0 = (t0 * p.sampleRate) + x * spp
    const r = rangeMinMax(p, s0, Math.max(s0 + 1, s0 + spp))
    out[x * 2] = r ? r[0] : 0
    out[x * 2 + 1] = r ? r[1] : 0
  }
  return out
}
