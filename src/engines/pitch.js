/**
 * pitch.js — matemática de pitch "old school" (puro, sin Web Audio).
 *
 * En SAMPLRK el pitch se hace como en los samplers clásicos: cambiando la
 * velocidad de reproducción. No hay time-stretch, así que pitch y duración
 * van siempre juntos:
 *   pitch ↓ → más grave y más largo
 *   pitch ↑ → más agudo y más corto
 */

export const PITCH_MIN = -12
export const PITCH_MAX = 12

/** Semitonos → factor de velocidad (playbackRate). +12 = ×2, −12 = ×0.5. */
export function semitonesToRate(semitones) {
  return Math.pow(2, (semitones || 0) / 12)
}

/** Factor de velocidad → semitonos. */
export function rateToSemitones(rate) {
  return 12 * Math.log2(rate)
}

/** Duración real de un fragmento de `seconds` reproducido con `semitones`. */
export function pitchedDuration(seconds, semitones) {
  return seconds / semitonesToRate(semitones)
}

export function clampPitch(semitones) {
  return Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.round(semitones)))
}

/** Texto corto para la UI: "+5", "0", "−3" (signo menos tipográfico). */
export function formatSemitones(semitones) {
  if (!semitones) return '0'
  return semitones > 0 ? `+${semitones}` : `−${Math.abs(semitones)}`
}
