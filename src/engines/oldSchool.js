/**
 * oldSchool.js — OLD SCHOOL MODE (puro).
 *
 * Aprender creatividad con limitaciones, como en los samplers de los 80:
 * poca memoria, 8 pads, 12 bits, frecuencia de muestreo baja, mono y sin
 * ayudas automáticas. No es decoración: cada límite cambia cómo trabajas
 * y cómo suena.
 *
 * El truco de 33/45 rpm: samplear el disco acelerado (45 en vez de 33)
 * ocupa menos memoria; luego se baja el pitch en el sampler para volver al
 * tono original. Como el sampler "vio" el audio acelerado, su frecuencia de
 * muestreo efectiva queda más baja al bajar el pitch: suena más crujiente.
 */

export const RPM_33 = 100 / 3          // 33⅓
export const RPM_45 = 45
export const SPEED_45 = RPM_45 / RPM_33 // 1,35

export const DEFAULT_OLD_SCHOOL = {
  enabled: false,
  memorySec: 10,
  bits: 12,
  sampleRate: 26040,
  mono: true,
  maxPads: 8,
  noHelpers: true, // sin detección de golpes ni pistas de corte
}

export const OLD_SCHOOL_PRESETS = [
  { id: 'classic', label: 'Memoria mínima', detail: '10 s · 12 bits · 26 kHz · mono',
    settings: { memorySec: 10, bits: 12, sampleRate: 26040, mono: true, maxPads: 8, noHelpers: true } },
  { id: 'roomy', label: 'Algo más de memoria', detail: '20 s · 12 bits · 40 kHz · mono',
    settings: { memorySec: 20, bits: 12, sampleRate: 40000, mono: true, maxPads: 8, noHelpers: true } },
  { id: 'crunch', label: 'Lo-fi extremo', detail: '5 s · 8 bits · 11 kHz · mono',
    settings: { memorySec: 5, bits: 8, sampleRate: 11025, mono: true, maxPads: 8, noHelpers: true } },
]

export function oldSchoolOf(project) {
  return { ...DEFAULT_OLD_SCHOOL, ...(project?.settings?.oldSchool ?? {}) }
}

/** ¿Hay que degradar el audio? (12 bits, menos kHz o mono) */
export function isLofi(os, srcRate = 44100) {
  return os.enabled && (os.bits < 16 || os.sampleRate < srcRate || os.mono)
}

/** Velocidad a la que se sampleó el disco (1 = 33 rpm, 1,35 = 45 rpm). */
export const speedOf = (sample) => sample?.edits?.speed ?? 1

/** Segundos de memoria que ocupa un tramo sampleado a `speed`. */
export const memoryFor = (seconds, speed = 1) => seconds / speed

/** Memoria usada por el proyecto: lo que se ha sampleado (cortes), a su velocidad. */
export function memoryUsed(project) {
  let used = 0
  for (const s of project.samples) {
    if (s.edits?.trimEnd === null || s.edits?.trimEnd === undefined) continue
    used += memoryFor(s.edits.trimEnd - s.edits.trimStart, speedOf(s))
  }
  return used
}

/** ¿Cabe un tramo nuevo? `excludeId` = sample que se está recortando (su memoria se libera). */
export function fitsInMemory(project, seconds, speed, excludeId = null) {
  const os = oldSchoolOf(project)
  if (!os.enabled) return { fits: true, used: 0, free: Infinity }
  let used = 0
  for (const s of project.samples) {
    if (s.id === excludeId || s.edits?.trimEnd === null || s.edits?.trimEnd === undefined) continue
    used += memoryFor(s.edits.trimEnd - s.edits.trimStart, speedOf(s))
  }
  const need = memoryFor(seconds, speed)
  return { fits: used + need <= os.memorySec + 1e-6, used, need, free: Math.max(0, os.memorySec - used) }
}

/** Semitonos que devuelven el tono original tras samplear a `speed` (entero, para el pad). */
export function compensatingPitch(speed) {
  return Math.round(-12 * Math.log2(speed)) || 0
}

/**
 * Degrada el audio como un sampler antiguo (no destructivo: devuelve canales nuevos).
 *  · frecuencia de muestreo: sample-and-hold (sin filtro: el aliasing es parte del sonido)
 *  · bits: cuantización a 2^bits niveles
 *  · mono: mezcla de canales
 * `speed` modela el truco de 45 rpm: el sampler toma una muestra cada
 * speed / sampleRate segundos del audio ORIGINAL.
 */
export function degradeChannels(channels, srcRate, { bits = 16, sampleRate = srcRate, mono = false, speed = 1 }) {
  const n = channels[0].length
  let input = channels
  if (mono && channels.length > 1) {
    const m = new Float32Array(n)
    for (const ch of channels) for (let i = 0; i < n; i++) m[i] += ch[i] / channels.length
    input = [m]
  }
  const hold = Math.max(1, (srcRate * speed) / sampleRate) // muestras originales por muestra del sampler
  const levels = Math.pow(2, Math.max(1, bits) - 1)
  const quant = bits < 16
  return input.map(ch => {
    const out = new Float32Array(n)
    let next = 0, v = 0
    for (let i = 0; i < n; i++) {
      if (i >= next) {
        v = ch[i]
        if (quant) v = Math.round(v * levels) / levels
        next += hold
      }
      out[i] = v
    }
    return out
  })
}

/** Clave estable de la degradación (para cachear el buffer derivado). */
export function lofiKey(os, speed) {
  return `${os.bits}|${os.sampleRate}|${os.mono ? 1 : 0}|${speed}`
}
