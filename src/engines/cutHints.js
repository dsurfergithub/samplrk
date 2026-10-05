/**
 * cutHints.js — ayuda al cortar (pura). Nunca mueve nada por sí misma:
 * devuelve una sugerencia que el usuario puede ver, aplicar o ignorar.
 */
import { validateLoop } from './dsp'

const PRE_ROLL = 0.004 // s antes del golpe: conserva el ataque completo

/**
 * ¿Hay un golpe justo al lado del inicio de la selección?
 *  'before-hit' → el inicio arrastra un resto del sonido anterior
 *  'cuts-hit'   → el inicio corta el ataque de un golpe
 */
export function startHint(start, hits = []) {
  for (const h of hits) {
    const d = h - start
    if (d > 0.012 && d < 0.15) {
      return { kind: 'before-hit', hit: h, suggested: Math.max(0, h - PRE_ROLL),
        text: 'Escucha el comienzo: parece que has dejado parte del sonido anterior antes del golpe.' }
    }
    if (d < -0.006 && d > -0.06) {
      return { kind: 'cuts-hit', hit: h, suggested: Math.max(0, h - PRE_ROLL),
        text: 'El inicio corta un golpe por la mitad. Prueba a moverlo un poco a la izquierda.' }
    }
  }
  return null
}

/** Mensaje humano sobre cómo empalma un loop (o null si suena bien). */
export function loopHint(mono, sampleRate, start, end) {
  if (end - start > 30) return null
  const v = validateLoop(mono, sampleRate, start, end)
  if (v.click > 0.12) return 'Al volver al principio se oye un pequeño clic. Mueve un poco el inicio o el final.'
  if (v.continuity < 0.03) return 'El final y el principio no conectan del todo. Prueba a mover el final hasta que el salto deje de notarse.'
  return null
}
