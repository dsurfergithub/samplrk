/**
 * demo/synth.js — instrumentos sintetizados para los samples de práctica.
 *
 * Todo el audio de práctica de SAMPLRK se genera aquí, en el navegador, con
 * código propio: no hay grabaciones de terceros ni derechos de por medio.
 * Cada función programa notas en un OfflineAudioContext (`ctx`) hacia un nodo
 * de salida (`out`). Los tiempos van en segundos.
 */

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

/** PRNG determinista: la misma "grabación" suena igual cada vez. */
export function seeded(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const noiseCache = new WeakMap()
function noise(ctx) {
  let b = noiseCache.get(ctx)
  if (!b) {
    const rnd = seeded(7)
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1
    noiseCache.set(ctx, b)
  }
  return b
}

function env(ctx, t, peak, attack, decay, release = null) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  if (release === null) {
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  } else {
    g.gain.setTargetAtTime(peak * 0.6, t + attack, decay)
    g.gain.setTargetAtTime(0.0001, t + release, 0.08)
  }
  return g
}

const offsetRnd = seeded(11)
function noiseSource(ctx, t, dur) {
  const s = ctx.createBufferSource()
  s.buffer = noise(ctx)
  s.start(t, offsetRnd() * 1.5)
  s.stop(t + dur)
  return s
}

// ------------------------------------------------------------------ batería

export function kick(ctx, out, t, vel = 1) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12)
  const g = env(ctx, t, 0.9 * vel, 0.002, 0.32)
  o.connect(g).connect(out)
  o.start(t); o.stop(t + 0.4)
}

export function snare(ctx, out, t, vel = 1, tone = 1800) {
  const n = noiseSource(ctx, t, 0.25)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = tone; bp.Q.value = 0.8
  n.connect(bp).connect(env(ctx, t, 0.5 * vel, 0.001, 0.16)).connect(out)
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(220, t)
  o.frequency.exponentialRampToValueAtTime(160, t + 0.08)
  o.connect(env(ctx, t, 0.3 * vel, 0.001, 0.09)).connect(out)
  o.start(t); o.stop(t + 0.2)
}

export function rim(ctx, out, t, vel = 1) {
  const o = ctx.createOscillator()
  o.type = 'triangle'; o.frequency.value = 1700
  o.connect(env(ctx, t, 0.28 * vel, 0.0005, 0.035)).connect(out)
  o.start(t); o.stop(t + 0.08)
}

export function hat(ctx, out, t, vel = 1, open = false) {
  const n = noiseSource(ctx, t, open ? 0.5 : 0.08)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 7500
  n.connect(hp).connect(env(ctx, t, 0.22 * vel, 0.001, open ? 0.32 : 0.045)).connect(out)
}

export function shaker(ctx, out, t, vel = 1) {
  const n = noiseSource(ctx, t, 0.1)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = 6000; bp.Q.value = 1.4
  n.connect(bp).connect(env(ctx, t, 0.12 * vel, 0.012, 0.05)).connect(out)
}

/** Ride metálico: osciladores cuadrados inarmónicos + paso alto (estilo 808). */
export function ride(ctx, out, t, vel = 1) {
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 5000
  const g = env(ctx, t, 0.07 * vel, 0.001, 0.9)
  hp.connect(g).connect(out)
  for (const f of [263, 400, 421, 474, 587, 845]) {
    const o = ctx.createOscillator()
    o.type = 'square'; o.frequency.value = f * 2.6
    o.connect(hp); o.start(t); o.stop(t + 1)
  }
}

// ------------------------------------------------------------------ teclas

/** Piano eléctrico FM (tipo "tine"): cálido, con brillo de ataque. */
export function ePiano(ctx, out, t, midi, dur, vel = 1) {
  const f = midiToFreq(midi)
  const car = ctx.createOscillator()
  car.frequency.value = f
  const mod = ctx.createOscillator()
  mod.frequency.value = f
  const modGain = ctx.createGain()
  modGain.gain.setValueAtTime(f * 1.6 * vel, t)
  modGain.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6)
  mod.connect(modGain).connect(car.frequency)
  const bell = ctx.createOscillator()
  bell.frequency.value = f * 14
  const bellG = env(ctx, t, 0.03 * vel, 0.001, 0.12)
  bell.connect(bellG).connect(out)
  const g = env(ctx, t, 0.16 * vel, 0.004, 0.5, dur)
  car.connect(g).connect(out)
  for (const o of [car, mod, bell]) { o.start(t); o.stop(t + dur + 0.6) }
}

/** Piano acústico aditivo: parciales con ligera inarmonicidad. */
export function piano(ctx, out, t, midi, dur, vel = 1) {
  const f = midiToFreq(midi)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 2400 + vel * 2500
  lp.connect(out)
  const partials = [1, 0.5, 0.3, 0.16, 0.1, 0.05]
  partials.forEach((amp, k) => {
    const n = k + 1
    const o = ctx.createOscillator()
    o.frequency.value = f * n * (1 + 0.0004 * n * n)
    const g = env(ctx, t, 0.09 * amp * vel, 0.003, 0.9 / n, Math.min(dur, 2.2 / n))
    o.connect(g).connect(lp)
    o.start(t); o.stop(t + dur + 0.6)
  })
}

/** Bajo redondo (triangular + seno con paso bajo). */
export function bass(ctx, out, t, midi, dur, vel = 1) {
  const f = midiToFreq(midi)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t)
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.25)
  const g = env(ctx, t, 0.42 * vel, 0.006, 0.35, dur * 0.92)
  lp.connect(g).connect(out)
  for (const [type, mul, amp] of [['triangle', 1, 1], ['sine', 0.5, 0.6]]) {
    const o = ctx.createOscillator()
    o.type = type; o.frequency.value = f * mul
    const a = ctx.createGain(); a.gain.value = amp
    o.connect(a).connect(lp)
    o.start(t); o.stop(t + dur + 0.3)
  }
}

/** Cuerda pulsada Karplus-Strong (guitarra/clavinet) renderizada en JS. */
export function pluck(ctx, out, t, midi, dur, vel = 1, bright = 0.5) {
  const sr = ctx.sampleRate
  const f = midiToFreq(midi)
  const n = Math.floor(sr * (dur + 0.2))
  const buf = ctx.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  const period = Math.max(2, Math.round(sr / f))
  const rnd = seeded(midi * 31 + Math.round(t * 100))
  const line = new Float32Array(period)
  for (let i = 0; i < period; i++) line[i] = (rnd() * 2 - 1) * vel
  const damp = 0.494 + bright * 0.005
  for (let i = 0; i < n; i++) {
    const j = i % period
    const next = line[(j + 1) % period]
    const v = line[j]
    d[i] = v
    line[j] = (v + next) * damp
  }
  const s = ctx.createBufferSource()
  s.buffer = buf
  const g = env(ctx, t, 0.5, 0.001, 0.2, dur)
  s.connect(g).connect(out)
  s.start(t); s.stop(t + dur + 0.2)
}

/** Voz sintética: diente de sierra con vibrato por filtros de formantes. */
const VOWELS = {
  a: [[800, 1], [1150, 0.5], [2900, 0.25]],
  o: [[450, 1], [800, 0.45], [2830, 0.15]],
  u: [[325, 1], [700, 0.3], [2530, 0.1]],
}
export function voice(ctx, out, t, midi, dur, vel = 1, vowel = 'a') {
  const f = midiToFreq(midi)
  const o = ctx.createOscillator()
  o.type = 'sawtooth'; o.frequency.value = f
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 5.2
  const lfoG = ctx.createGain()
  lfoG.gain.setValueAtTime(0, t)
  lfoG.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.5, dur))
  lfo.connect(lfoG).connect(o.frequency)
  const g = env(ctx, t, 0.18 * vel, 0.09, 0.4, dur)
  for (const [freq, amp] of VOWELS[vowel] ?? VOWELS.a) {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 9
    const a = ctx.createGain(); a.gain.value = amp * 3
    o.connect(bp).connect(a).connect(g)
  }
  g.connect(out)
  for (const x of [o, lfo]) { x.start(t); x.stop(t + dur + 0.4) }
}

// ------------------------------------------------------------------ "grabación"

/** Reverb por convolución con respuesta impulsional generada. */
export function reverb(ctx, seconds = 1.8, decay = 3) {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * seconds)
  const ir = ctx.createBuffer(2, n, sr)
  const rnd = seeded(99)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, decay)
  }
  const conv = ctx.createConvolver()
  conv.buffer = ir
  return conv
}

/** Crujido de vinilo suave: pequeños clics aleatorios + siseo. Da sensación de "disco". */
export function vinyl(ctx, out, duration, amount = 1) {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * duration)
  const buf = ctx.createBuffer(1, n, sr)
  const d = buf.getChannelData(0)
  const rnd = seeded(3)
  for (let i = 0; i < n; i++) {
    let v = (rnd() * 2 - 1) * 0.004
    if (rnd() < 0.00022) v += (rnd() * 2 - 1) * 0.25
    d[i] = v * amount
  }
  const s = ctx.createBufferSource()
  s.buffer = buf
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 7000
  s.connect(lp).connect(out)
  s.start(0)
}
