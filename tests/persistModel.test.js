import { describe, it, expect } from 'vitest'
import { createProject, migrateProject } from '../src/engines/projectModel.js'
import {
  isWorthSaving, samplesNeedingBlob, projectSummary, projectRecord, defaultProjectName,
  learningSnapshot, restoreLearning, relativeTime,
} from '../src/engines/persistModel.js'

function demoProject() {
  const p = createProject({ name: 'Beat con «Octava abajo»' })
  p.samples = [
    { id: 's1', name: 'Octava abajo', origin: { kind: 'demo', demoId: 'piano-octave-down' }, edits: {}, duration: 16 },
    { id: 's2', name: 'mi-loop', origin: { kind: 'file', fileName: 'mi-loop.wav' }, edits: {}, duration: 8 },
  ]
  p.activeSampleId = 's1'
  p.slices = [{ id: 'a', sampleId: 's1' }, { id: 'b', sampleId: 's1' }, { id: 'c', sampleId: 's2' }]
  p.patterns = [{ kind: 'chops', events: [{ padId: 0 }] }, { kind: 'drums', events: [] }]
  p.bpm = 120
  return p
}

describe('qué se guarda', () => {
  it('un proyecto sin audio no se guarda', () => {
    expect(isWorthSaving(createProject())).toBe(false)
    expect(isWorthSaving(demoProject())).toBe(true)
  })
  it('solo el audio importado se guarda como archivo; los discos de práctica se regeneran', () => {
    expect(samplesNeedingBlob(demoProject()).map(s => s.id)).toEqual(['s2'])
  })
  it('el registro contiene el proyecto completo y vuelve igual', () => {
    const p = demoProject()
    const rec = projectRecord(p, '2026-10-05T10:00:00.000Z')
    expect(rec).toMatchObject({ id: p.id, name: p.name, updatedAt: '2026-10-05T10:00:00.000Z' })
    const back = migrateProject(rec.json)
    expect(back.slices).toEqual(p.slices)
    expect(back.patterns).toEqual(p.patterns)
    expect(back.updatedAt).toBe('2026-10-05T10:00:00.000Z')
    expect(rec.json).not.toMatch(/AudioBuffer/)
  })
  it('resumen para la lista de proyectos', () => {
    expect(projectSummary(demoProject())).toEqual({
      sampleName: 'Octava abajo', origin: 'demo', chops: 2, hasPattern: true, hasDrums: false, bpm: 120,
    })
  })
  it('nombre por defecto', () => {
    expect(defaultProjectName('Octava abajo')).toBe('Beat con «Octava abajo»')
    expect(defaultProjectName('')).toBe('Mi primer beat')
  })
})

describe('aprendizaje guardado', () => {
  const initial = { progress: { findComplete: false, beatComplete: false }, skipped: [], acked: [], seen: [], message: null, coachEnabled: true, exploring: false }
  it('no guarda el mensaje en pantalla', () => {
    const snap = learningSnapshot({ ...initial, message: { id: 'x' } })
    expect(snap).not.toHaveProperty('message')
  })
  it('restaura y conserva claves nuevas de versiones posteriores', () => {
    const r = restoreLearning(initial, { progress: { findComplete: true }, skipped: ['loop'], coachEnabled: false })
    expect(r.progress).toEqual({ findComplete: true, beatComplete: false })
    expect(r.skipped).toEqual(['loop'])
    expect(r.coachEnabled).toBe(false)
    expect(r.message).toBeNull()
  })
  it('ignora datos corruptos', () => {
    expect(restoreLearning(initial, 'basura')).toBe(initial)
    expect(restoreLearning(initial, { skipped: 'x' }).skipped).toEqual([])
  })
})

describe('tiempo relativo', () => {
  const now = new Date('2026-10-05T12:00:00Z').getTime()
  it('frases cortas', () => {
    expect(relativeTime('2026-10-05T11:59:40Z', now)).toBe('ahora mismo')
    expect(relativeTime('2026-10-05T11:45:00Z', now)).toBe('hace 15 min')
    expect(relativeTime('2026-10-04T11:00:00Z', now)).toBe('ayer')
    expect(relativeTime('2026-10-01T12:00:00Z', now)).toBe('hace 4 días')
  })
})
