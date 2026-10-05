/**
 * ids.js — identificadores únicos y estables (sirven también tras recargar).
 */
let seq = 0

export function makeId(prefix = 'id') {
  const rnd = globalThis.crypto?.randomUUID?.().slice(0, 8)
    ?? Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rnd}${(++seq).toString(36)}`
}
