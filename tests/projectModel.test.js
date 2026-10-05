import { describe, it, expect } from 'vitest'
import { createProject, serializeProject, migrateProject, SCHEMA_VERSION } from '../src/engines/projectModel.js'

describe('modelo de proyecto', () => {
  it('crea un proyecto versionado y serializable', () => {
    const p = createProject()
    expect(p.schemaVersion).toBe(SCHEMA_VERSION)
    expect(p.padBanks[0].pads).toHaveLength(16)
    const back = migrateProject(serializeProject(p))
    expect(back.id).toBe(p.id)
    expect(back.padBanks).toEqual(p.padBanks)
  })

  it('migra un proyecto de SAMPLRK v0.1 a tiempo original', () => {
    const legacy = {
      app: 'SAMPLRK', version: 1, bpm: 100,
      samples: [{
        id: 's1', name: 'Demo', duration: 10,
        edits: { trimStart: 2, trimEnd: null, reversed: false },
        slices: [{ id: 'a', start: 0, end: 1, name: 'Slice 1' }, { id: 'b', start: 1, end: 2.5, name: 'Slice 2' }],
      }],
      loops: [], scenes: [], timeline: [],
    }
    const p = migrateProject(legacy)
    expect(p.schemaVersion).toBe(SCHEMA_VERSION)
    expect(p.mode).toBe('free')
    expect(p.slices.map(s => [s.start, s.end])).toEqual([[2, 3], [3, 4.5]])
    expect(p.padBanks[0].pads.slice(0, 2)).toEqual(['a', 'b'])
    expect(p.samples[0].slices).toEqual([])
  })

  it('rechaza versiones futuras o desconocidas', () => {
    expect(() => migrateProject({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/más nueva/)
    expect(() => migrateProject({ foo: 1 })).toThrow()
  })
})
