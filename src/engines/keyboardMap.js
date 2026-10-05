/**
 * keyboardMap.js — teclado del ordenador → pads (puro).
 *
 * Se usa `KeyboardEvent.code` (posición física), así el mapa funciona igual
 * en teclados QWERTY, AZERTY o QWERTZ. Disposición 4×4, como la rejilla:
 *
 *   1 2 3 4   → pads A B C D
 *   Q W E R   → pads E F G H
 *   A S D F   → pads I J K L   (solo con 16 chops)
 *   Z X C V   → pads M N O P
 */

export const DEFAULT_KEYMAP = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'KeyQ', 'KeyW', 'KeyE', 'KeyR',
  'KeyA', 'KeyS', 'KeyD', 'KeyF',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV',
]

/** Etiqueta visible de un code: 'KeyQ' → 'Q', 'Digit1' → '1'. */
export function keyLabel(code) {
  if (!code) return ''
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

/** Índice de pad para un code, o -1. */
export function padForCode(code, keymap = DEFAULT_KEYMAP) {
  return keymap.indexOf(code)
}

/** ¿Debe ignorarse la tecla? (escribiendo en un campo, o con modificadores). */
export function shouldIgnoreKey(ev) {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return true
  const t = ev.target
  const tag = t?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) {
    // los sliders no "escriben": dejamos tocar pads con el foco en ellos
    return !(tag === 'INPUT' && t.type === 'range')
  }
  return false
}
