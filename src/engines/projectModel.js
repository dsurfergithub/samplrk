/**
 * projectModel.js — schema del proyecto SAMPLRK 2 (puro, versionado).
 *
 * El proyecto es JSON plano: nada de AudioBuffer ni nodos. El audio se
 * guarda aparte (Fase 5: blobs en IndexedDB) y se reconstruye al abrir.
 * Cada cambio de forma sube SCHEMA_VERSION y añade una migración.
 */
import { makeId } from './ids'
import { emptyPads, padsInTimeOrder, CHOP_COLORS } from './sliceModel'

export const SCHEMA_VERSION = 1

export function createPadBank(name = 'Banco A') {
  return { id: makeId('bank'), name, pads: emptyPads() }
}

export function createProject({ name = 'Mi primer beat', mode = 'learning' } = {}) {
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: makeId('prj'),
    name, mode,
    createdAt: now, updatedAt: now,
    bpm: null,
    samples: [],
    activeSampleId: null,
    slices: [],
    padBanks: [createPadBank()],
    patterns: [],
    drumKit: null,
    settings: { keymap: 'default' },
  }
}

/** Copia serializable (descarta cualquier campo runtime que se haya colado). */
export function serializeProject(project) {
  return JSON.stringify({ ...project, updatedAt: new Date().toISOString() })
}

/**
 * Lleva cualquier proyecto conocido a la versión actual.
 * Acepta también el JSON de SAMPLRK v0.1 (`{ app: 'SAMPLRK', version: 1 }`).
 */
export function migrateProject(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!data || typeof data !== 'object') throw new Error('Proyecto ilegible')

  if (data.schemaVersion === undefined && data.app === 'SAMPLRK') return fromLegacy(data)
  if (data.schemaVersion === SCHEMA_VERSION) return data
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Este proyecto se creó con una versión más nueva de SAMPLRK')
  }
  throw new Error('Formato de proyecto desconocido')
}

/** v0.1 → v1: los samples se conservan; sus slices (tiempo editado) pasan a tiempo original. */
function fromLegacy(old) {
  const p = createProject({ name: 'Proyecto importado de v0.1', mode: 'free' })
  p.bpm = old.bpm ?? null
  p.samples = (old.samples ?? []).map(s => ({ ...s, slices: [] }))
  p.activeSampleId = p.samples[0]?.id ?? null
  let colorIdx = 0
  for (const s of old.samples ?? []) {
    if (s.edits?.reversed) continue // los slices invertidos de v0.1 no tienen equivalente directo
    const offset = s.edits?.trimStart ?? 0
    for (const sl of s.slices ?? []) {
      p.slices.push({
        id: sl.id, sampleId: s.id,
        start: sl.start + offset, end: sl.end + offset,
        name: sl.name ?? '', color: CHOP_COLORS[colorIdx++ % CHOP_COLORS.length],
        pitch: 0, gain: 1, reversed: false, triggerMode: 'oneshot',
        fadeInMs: 2, fadeOutMs: 6, keyBinding: null, midiNote: null,
      })
    }
  }
  p.padBanks[0].pads = padsInTimeOrder(p.slices)
  return p
}
