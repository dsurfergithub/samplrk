/**
 * demo/practiceSamples.js — "discos" de práctica de SAMPLRK.
 *
 * Dos tipos de disco:
 *  · grabaciones reales con licencia libre (`src`): fragmentos cortos
 *    incluidos en src/assets/practice (créditos en CREDITS.md de esa carpeta)
 *  · mini-grabaciones compuestas para aprender a samplear (`synth`):
 *    motivo melódico, acordes, algo rítmico, huecos y golpes claros.
 *    Se sintetizan en el navegador (OfflineAudioContext): código propio.
 * Todo se prepara la primera vez que se pide y queda en caché.
 */
import * as S from './synth'
import { getCtx } from '../audioEngine'
import pianoOctaveEfect from '../../assets/practice/piano-octave-efect-120.wav?url'
import pianoOctaveDown from '../../assets/practice/piano-octave-down-120.wav?url'

const SR = 44100

export const PRACTICE_SAMPLES = [
  {
    id: 'piano-octave-down', crate: 'Piano', title: 'Octava abajo', bpm: 120, bars: 8,
    blurb: 'Piano real en un bucle de ocho compases. Notas claras y separadas: perfecto para tu primer chop.',
    color: '#ffd43b', src: pianoOctaveDown,
    credit: 'Piano Loops 213 · josefpres (Freesound)',
  },
  {
    id: 'piano-octave-efect', crate: 'Piano', title: 'Octavas con efecto', bpm: 120, bars: 8,
    blurb: 'Piano real que va cambiando poco a poco. Escucha bien: cada compás esconde algo distinto.',
    color: '#9775fa', src: pianoOctaveEfect,
    credit: 'Piano Loops 051 · josefpres (Freesound)',
  },
  {
    id: 'soul-keys', crate: 'Soul', title: 'Domingo en Rhodes', bpm: 86, bars: 4,
    blurb: 'Piano eléctrico cálido, bajo y escobillas. Al final, una pequeña melodía sola.',
    color: '#ff9f43',
  },
  {
    id: 'funk-break', crate: 'Funk', title: 'Break del callejón', bpm: 98, bars: 4,
    blurb: 'Dos compases de batería sola (un "break") y después entra la guitarra.',
    color: '#69db7c',
  },
  {
    id: 'jazz-trio', crate: 'Jazz', title: 'Trío de medianoche', bpm: 76, bars: 4,
    blurb: 'Piano, contrabajo y ride con swing. Acordes con mucho color para trocear.',
    color: '#4dabf7',
  },
  {
    id: 'voices', crate: 'Voz', title: 'Coro del sótano', bpm: 80, bars: 4,
    blurb: 'Una voz que canta sobre un coro suave. Ideal para chops vocales.',
    color: '#f783ac',
  },
]

const ARRANGEMENTS = {
  'soul-keys': (ctx, bus, beat) => {
    const chords = [[50, 53, 57, 60, 64], [53, 59, 64, 69], [52, 55, 59, 62], [55, 60, 64, 71]]
    const roots = [38, 43, 36, 45]
    for (let bar = 0; bar < 4; bar++) {
      const b0 = bar * 4 * beat
      const last = bar === 3
      const hits = last ? [[0, 1.8]] : [[0, 1.4], [1.5, 0.45], [2.75, 1.0]]
      for (const [at, len] of hits) for (const m of chords[bar]) S.ePiano(ctx, bus.keys, b0 + at * beat, m, len * beat, at ? 0.75 : 0.9)
      S.bass(ctx, bus.low, b0, roots[bar], 1.5 * beat, 0.9)
      if (!last) S.bass(ctx, bus.low, b0 + 2.5 * beat, roots[bar] + 7, beat, 0.7)
      // escobillas: se van en la segunda mitad del último compás (hueco para la melodía)
      const drumBeats = last ? 2 : 4
      for (let i = 0; i < drumBeats * 2; i++) S.shaker(ctx, bus.drums, b0 + i * beat / 2, i % 2 ? 0.9 : 0.5)
      S.kick(ctx, bus.drums, b0, 0.8)
      S.rim(ctx, bus.drums, b0 + beat, 0.8)
      if (!last) {
        S.kick(ctx, bus.drums, b0 + 2.5 * beat, 0.6)
        S.rim(ctx, bus.drums, b0 + 3 * beat, 0.8)
      }
    }
    // motivo final: cuatro notas que piden ser troceadas
    const b3 = 12 * beat
    ;[[76, 2], [74, 2.5], [72, 3], [69, 3.5]].forEach(([m, at]) => S.ePiano(ctx, bus.keys, b3 + at * beat, m, 0.45 * beat, 1))
  },

  'funk-break': (ctx, bus, beat) => {
    const step = beat / 4
    const bars = [
      { k: [0, 7, 10], s: [4, 12], g: [9, 15], oh: [] },
      { k: [0, 2, 10], s: [4, 12], g: [7, 14], oh: [14] },
    ]
    for (let bar = 0; bar < 4; bar++) {
      const b0 = bar * 16 * step
      const p = bars[bar % 2]
      p.k.forEach(i => S.kick(ctx, bus.drums, b0 + i * step, 1))
      p.s.forEach(i => S.snare(ctx, bus.drums, b0 + i * step, 1))
      p.g.forEach(i => S.snare(ctx, bus.drums, b0 + i * step, 0.22))
      for (let i = 0; i < 16; i += 2) if (!p.oh.includes(i)) S.hat(ctx, bus.drums, b0 + i * step, i % 4 ? 0.6 : 0.9)
      p.oh.forEach(i => S.hat(ctx, bus.drums, b0 + i * step, 0.8, true))
    }
    // guitarra (compases 3 y 4)
    const riff = [[0, 52], [2, 52], [3, 55], [6, 57], [8, 52], [10, 62], [11, 59], [14, 57]]
    for (const bar of [2, 3]) {
      const b0 = bar * 16 * step
      const notes = bar === 3 ? riff.slice(0, 5) : riff
      notes.forEach(([i, m]) => S.pluck(ctx, bus.keys, b0 + i * step, m, step * 1.6, 0.9, 0.8))
      S.bass(ctx, bus.low, b0, 40, step * 3, 1)
      S.bass(ctx, bus.low, b0 + 8 * step, 40, step * 2, 0.8)
      if (bar === 3) [52, 56, 62, 66].forEach((m, k) => S.pluck(ctx, bus.keys, b0 + 12 * step + k * 0.012, m, step * 2, 0.8, 0.9))
    }
  },

  'jazz-trio': (ctx, bus, beat) => {
    const sw = beat * 2 / 3 // corchea con swing
    const chords = [[58, 62, 63, 67], [57, 62, 63, 67], [57, 60, 62, 65], [59, 63, 65, 68]]
    const walk = [[36, 38, 39, 40], [41, 45, 48, 47], [46, 50, 53, 51], [43, 47, 50, 44]]
    for (let bar = 0; bar < 4; bar++) {
      const b0 = bar * 4 * beat
      // comping "Charleston"
      for (const [at, len, v] of [[0, 0.5 * beat, 0.8], [beat + sw, 0.9 * beat, 0.65]]) {
        chords[bar].forEach(m => S.piano(ctx, bus.keys, b0 + at, m, len, v))
      }
      walk[bar].forEach((m, i) => S.bass(ctx, bus.low, b0 + i * beat, m, beat * 0.9, 0.85))
      for (const at of [0, beat, beat + sw, 2 * beat, 3 * beat, 3 * beat + sw]) S.ride(ctx, bus.drums, b0 + at, 0.9)
      S.hat(ctx, bus.drums, b0 + beat, 0.4)
      S.hat(ctx, bus.drums, b0 + 3 * beat, 0.4)
    }
    const mel = [[8, 0, 77, 1], [8, 1 + 2 / 3, 74, 0.3], [8, 2, 72, 0.6], [8, 2 + 2 / 3, 70, 1.2],
      [12, 1 + 2 / 3, 68, 0.3], [12, 2, 71, 0.6], [12, 2 + 2 / 3, 74, 1]]
    mel.forEach(([barBeat, at, m, len]) => S.piano(ctx, bus.keys, (barBeat + at) * beat, m, len * beat, 1))
  },

  voices: (ctx, bus, beat) => {
    const pads = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]
    pads.forEach((ch, bar) => ch.forEach(m => S.voice(ctx, bus.keys, bar * 4 * beat, m, 3.8 * beat, 0.35, 'o')))
    const lead = [
      [0, 76, 1.5, 'a'], [1.5, 74, 0.5, 'a'], [2, 72, 2, 'o'],
      [4, 69, 1, 'a'], [5, 72, 1, 'a'], [6, 74, 1.5, 'a'],
      [10, 79, 1, 'a'], [11, 76, 1, 'a'],
      [12, 74, 1, 'u'], [13, 72, 0.5, 'a'], [13.5, 71, 0.5, 'a'], [14, 69, 2, 'o'],
    ]
    lead.forEach(([at, m, len, v]) => S.voice(ctx, bus.lead, at * beat, m, len * beat, 1, v))
    for (const bar of [2, 3]) for (const b of [1, 3]) S.rim(ctx, bus.drums, (bar * 4 + b) * beat, 0.7)
    S.bass(ctx, bus.low, 8 * beat, 43, 4 * beat, 0.6)
    S.bass(ctx, bus.low, 12 * beat, 45, 4 * beat, 0.6)
  },
}

function makeBus(ctx, dest, verb, { pan = 0, send = 0.15, gain = 1 } = {}) {
  const g = ctx.createGain()
  g.gain.value = gain
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  g.connect(p).connect(dest)
  const s = ctx.createGain()
  s.gain.value = send
  g.connect(s).connect(verb)
  return g
}

function softClip(ctx) {
  const ws = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4)
  }
  ws.curve = curve
  return ws
}

const cache = new Map()

/** Renderiza (o devuelve de caché) la grabación de práctica `id` como AudioBuffer. */
export async function renderPracticeSample(id) {
  if (cache.has(id)) return cache.get(id)
  const meta = PRACTICE_SAMPLES.find(x => x.id === id)
  if (meta?.src) {
    const res = await fetch(meta.src)
    if (!res.ok) throw new Error('No se pudo descargar el sample de práctica')
    const buffer = await getCtx().decodeAudioData(await res.arrayBuffer())
    cache.set(id, buffer)
    return buffer
  }
  const arrange = ARRANGEMENTS[id]
  if (!meta || !arrange) throw new Error('Sample de práctica desconocido')
  const beat = 60 / meta.bpm
  const duration = meta.bars * 4 * beat + 1.2 // cola para la reverb
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const ctx = new OAC(2, Math.ceil(duration * SR), SR)

  const masterIn = ctx.createGain()
  const warm = ctx.createBiquadFilter()
  warm.type = 'lowpass'; warm.frequency.value = 11000
  masterIn.connect(warm).connect(softClip(ctx)).connect(ctx.destination)
  const verb = S.reverb(ctx, 1.6, 3)
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.5
  verb.connect(verbGain).connect(masterIn)

  const bus = {
    drums: makeBus(ctx, masterIn, verb, { send: 0.08 }),
    keys: makeBus(ctx, masterIn, verb, { pan: -0.12, send: 0.25 }),
    low: makeBus(ctx, masterIn, verb, { send: 0.02 }),
    lead: makeBus(ctx, masterIn, verb, { pan: 0.08, send: 0.35 }),
  }
  arrange(ctx, bus, beat)
  S.vinyl(ctx, masterIn, duration, 1)

  const buffer = await ctx.startRendering()
  normalize(buffer, 0.89)
  cache.set(id, buffer)
  return buffer
}

function normalize(buffer, target) {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a }
  }
  if (peak < 1e-6) return
  const g = target / peak
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] *= g
  }
}
