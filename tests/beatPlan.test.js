import { describe, it, expect } from 'vitest'
import { planBeat, beatSummary } from '../src/engines/beatPlan.js'
import { createPattern, createEvent } from '../src/engines/patternEngine.js'
import { DRUM_PADS, drumForCode, drumById, createDrumKit } from '../src/engines/drumKit.js'
import { keyLabel, DEFAULT_KEYMAP } from '../src/engines/keyboardMap.js'
import { createProject, mixOf, defaultMix } from '../src/engines/projectModel.js'

const pat = (kind, hits, extra = {}) => ({
  ...createPattern({ bars: 1, bpm: 120 }), kind, ...extra,
  events: hits.map(([padId, beat]) => createEvent({ padId, beat, bpm: 120 })),
})
const drumTrack = (p) => ({ kind: 'drums', pattern: p, keyOf: e => e.padId, chokeOf: e => drumById(e.padId)?.choke ?? null })
const chopTrack = (p) => ({ kind: 'chops', pattern: p, keyOf: e => e.padId })

describe('plan del beat', () => {
  it('ordena los golpes de las dos pistas y calcula la duración', () => {
    const plan = planBeat([chopTrack(pat('chops', [[0, 0], [1, 2]])), drumTrack(pat('drums', [['kick', 0], ['snare', 1]]))], 120, 2)
    expect(plan.duration).toBeCloseTo(4, 10)          // 2 vueltas × 4 tiempos × 0,5 s
    expect(plan.hits).toHaveLength(8)
    expect(plan.hits.map(h => h.at)).toEqual([...plan.hits.map(h => h.at)].sort((a, b) => a - b))
  })

  it('volver a tocar un pad corta su golpe anterior', () => {
    const plan = planBeat([chopTrack(pat('chops', [[2, 0], [2, 1]]))], 120)
    expect(plan.hits[0].cutAt).toBeCloseTo(0.5, 10)
    expect(plan.hits[1].cutAt).toBeNull()
  })

  it('el charles cerrado corta al abierto (choke), pero no al bombo', () => {
    const plan = planBeat([drumTrack(pat('drums', [['open', 0], ['kick', 0.5], ['hat', 1]]))], 120)
    const open = plan.hits.find(h => h.event.padId === 'open')
    const kick = plan.hits.find(h => h.event.padId === 'kick')
    expect(open.cutAt).toBeCloseTo(0.5, 10)
    expect(kick.cutAt).toBeNull()
  })

  it('chops y batería con el mismo número no se mezclan', () => {
    const plan = planBeat([chopTrack(pat('chops', [[0, 0]])), drumTrack(pat('drums', [[0, 1]]))], 120)
    expect(plan.hits.every(h => h.cutAt === null)).toBe(true)
  })

  it('sin eventos no hay beat', () => {
    expect(planBeat([chopTrack(pat('chops', []))], 120)).toEqual({ duration: 0, hits: [] })
  })
})

describe('resumen del beat', () => {
  it('cuenta hechos objetivos, nunca una nota', () => {
    const p = createProject()
    p.activeSampleId = 's'
    p.slices = ['a', 'b', 'c'].map((id, i) => ({ id, sampleId: 's', start: i, end: i + 1, pitch: id === 'b' ? -3 : 0, reversed: id === 'c' }))
    p.padBanks[0].pads = ['a', 'b', 'c', ...Array(13).fill(null)]
    p.patterns = [pat('chops', [[0, 0], [1, 1], [2, 2], [1, 3]], { quantize: '1/8' }), pat('drums', [['kick', 0], ['snare', 2]])]
    const s = beatSummary(p, 120)
    expect(s).toMatchObject({ bars: 1, chopsUsed: 3, chopsTotal: 3, pitched: 1, reversed: 1, chopHits: 4, drumHits: 2 })
    expect(s.seconds).toBeCloseTo(2, 10)
    expect(s.drumsUsed).toEqual(['kick', 'snare'])
    expect(s.quantize.chops).toBe('1/8')
    expect(Object.keys(s)).not.toContain('score')
  })
})

describe('kit de batería', () => {
  it('bombo, caja, charles cerrado y abierto; cerrado y abierto comparten choke', () => {
    expect(DRUM_PADS.map(d => d.id)).toEqual(['kick', 'snare', 'hat', 'open'])
    expect(drumById('hat').choke).toBe(drumById('open').choke)
    expect(drumById('kick').choke).toBeNull()
  })
  it('teclas J K L Ñ, sin chocar con las de los chops', () => {
    expect(DRUM_PADS.map(d => keyLabel(d.key))).toEqual(['J', 'K', 'L', 'Ñ'])
    for (const d of DRUM_PADS) expect(DEFAULT_KEYMAP).not.toContain(d.key)
    expect(drumForCode('KeyK').id).toBe('snare')
    expect(drumForCode('KeyQ')).toBeNull()
  })
  it('modelo del kit y mezcla por defecto (también para proyectos antiguos)', () => {
    expect(createDrumKit().pads).toHaveLength(4)
    expect(mixOf(createProject())).toEqual(defaultMix())
    expect(mixOf({ settings: { keymap: 'default' } })).toEqual(defaultMix())
    expect(mixOf({ settings: { mix: { drums: 0.5 } } }).drums).toBe(0.5)
  })
})
