/**
 * midiMap.js — MIDI sin dispositivos (puro y testeable).
 *
 * Mensajes, nombres de nota, velocity y el mapa nota → pad.
 * Nombres de nota con C3 = 60 (convención de Ableton/Yamaha).
 *
 * Mapa por defecto, pensado para que funcione sin configurar nada:
 *  · Chops: pads de controlador (36–51, el estándar de MPC/Akai: pad 1 = 36)
 *           y teclas blancas desde C3 en un teclado (C3 → A, D3 → B…).
 *  · Batería: notas General MIDI (36 bombo, 38 caja, 42 charles, 46 abierto)
 *           y C3 D3 E3 F3 para teclado.
 * Cada pantalla decide qué mapa se usa: en DRUMS manda la batería.
 */

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function noteName(n) {
  return `${NAMES[n % 12]}${Math.floor(n / 12) - 2}`
}

/** [status, data1, data2] → { type, channel, note, velocity } o null. */
export function parseMidiMessage(data) {
  if (!data || data.length < 2) return null
  const status = data[0] & 0xf0
  const channel = (data[0] & 0x0f) + 1
  const note = data[1]
  const velocity = data[2] ?? 0
  if (status === 0x90 && velocity > 0) return { type: 'noteon', channel, note, velocity }
  if (status === 0x80 || (status === 0x90 && velocity === 0)) return { type: 'noteoff', channel, note, velocity: 0 }
  if (status === 0xb0) return { type: 'cc', channel, controller: note, value: velocity }
  return null
}

/** Velocity (1–127) → ganancia. Curva suave: golpe medio ≈ 0,45; fuerte = 1. */
export function velocityToGain(velocity) {
  if (!velocity || velocity <= 0) return 0
  return Math.max(0.06, Math.pow(Math.min(127, velocity) / 127, 1.2))
}

const WHITE_FROM_C3 = (() => {
  const steps = [0, 2, 4, 5, 7, 9, 11]
  const out = []
  for (let i = 0; out.length < 16; i++) out.push(60 + Math.floor(i / 7) * 12 + steps[i % 7])
  return out
})()

export function defaultMidiMap() {
  const chops = {}
  for (let i = 0; i < 16; i++) { chops[36 + i] = i; chops[WHITE_FROM_C3[i]] = i }
  const drums = { 35: 'kick', 36: 'kick', 37: 'snare', 38: 'snare', 40: 'snare', 42: 'hat', 44: 'hat', 46: 'open',
    60: 'kick', 62: 'snare', 64: 'hat', 65: 'open' }
  return { chops, drums }
}

/** ¿Qué toca esta nota en esta pantalla? → { kind: 'chops', pad } | { kind: 'drums', id } | null */
export function resolveNote(map, note, screen) {
  if (screen === 'drums') {
    const id = map.drums?.[note]
    return id ? { kind: 'drums', id } : null
  }
  const pad = map.chops?.[note]
  return pad === undefined || pad === null ? null : { kind: 'chops', pad: Number(pad) }
}

/**
 * MIDI learn: asigna `note` al destino. La nota deja de tocar cualquier
 * otro pad de su mapa (una nota, un pad). No muta la entrada.
 */
export function assignNote(map, note, target) {
  const kind = target.kind
  const value = kind === 'drums' ? target.id : target.pad
  return { ...map, [kind]: { ...map[kind], [note]: value } }
}

/** Notas asignadas a un destino, ordenadas (para mostrarlas). */
export function notesFor(map, target) {
  const kind = target.kind
  const value = kind === 'drums' ? target.id : target.pad
  return Object.entries(map[kind] ?? {})
    .filter(([, v]) => String(v) === String(value))
    .map(([n]) => Number(n))
    .sort((a, b) => a - b)
}

/** Acepta un mapa guardado si tiene buena forma; si no, el de por defecto. */
export function sanitizeMap(saved) {
  const def = defaultMidiMap()
  if (!saved || typeof saved !== 'object') return def
  const ok = (o) => o && typeof o === 'object' && !Array.isArray(o)
  return { chops: ok(saved.chops) ? saved.chops : def.chops, drums: ok(saved.drums) ? saved.drums : def.drums }
}
