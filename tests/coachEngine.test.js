import { describe, it, expect } from 'vitest'
import { lastPhrase, classifyPhrase, react } from '../src/engines/coachEngine.js'

const hits = (pads, gap = 0.3, t0 = 0) => pads.map((pad, i) => ({ pad, t: t0 + i * gap }))
const ORDER = [0, 1, 2, 3, 4, 5, 6, 7]

describe('frases', () => {
  it('la última frase empieza tras una pausa larga', () => {
    const h = [...hits([0, 1], 0.3, 0), ...hits([2, 2, 0], 0.3, 10)]
    expect(lastPhrase(h)).toEqual([2, 2, 0])
  })
  it('A B C D es el orden original', () => {
    expect(classifyPhrase([0, 1, 2, 3], ORDER)).toBe('original')
    expect(classifyPhrase([2, 3, 4, 5], ORDER)).toBe('original')
  })
  it('C C A D es un flip', () => {
    expect(classifyPhrase([2, 2, 0, 3], ORDER)).toBe('flip')
    expect(classifyPhrase([0, 2, 1, 2], ORDER)).toBe('flip')
  })
  it('repetir un solo pad es stutter', () => {
    expect(classifyPhrase([1, 1, 1, 1], ORDER)).toBe('stutter')
  })
  it('frases cortas no se clasifican', () => {
    expect(classifyPhrase([2, 0], ORDER)).toBeNull()
  })
  it('respeta pads reordenados', () => {
    expect(classifyPhrase([2, 1, 0, 3], [2, 1, 0, 3])).toBe('original')
  })
})

describe('react (coach)', () => {
  it('sugiere romper el orden y luego explica el flip, una sola vez', () => {
    const seen = new Set()
    const m1 = react({ type: 'pad:hit' }, { hits: hits([0, 1, 2, 3]), order: ORDER }, seen)
    expect(m1.id).toBe('hint:break-order')
    expect(m1.text).toContain('C')
    seen.add(m1.id)
    const m2 = react({ type: 'pad:hit' }, { hits: hits([2, 2, 0, 3]), order: ORDER }, seen)
    expect(m2.kind).toBe('learned')
    expect(m2.term).toBe('flip')
    seen.add(m2.id)
    expect(react({ type: 'pad:hit' }, { hits: hits([3, 1, 0, 2]), order: ORDER }, seen)).toBeNull()
  })

  it('explica la relación pitch/duración después de cambiar el pitch', () => {
    const m = react({ type: 'pitch:changed', semitones: -4 })
    expect(m.text).toContain('bajado el pitch 4 semitonos')
    expect(m.text).toContain('más largo')
    expect(react({ type: 'pitch:changed', semitones: 0 })).toBeNull()
  })

  it('no habla antes de que haya acción', () => {
    expect(react({ type: 'pad:hit' }, { hits: [], order: ORDER })).toBeNull()
    expect(react({ type: 'desconocido' })).toBeNull()
  })
})

import { startHint } from '../src/engines/cutHints.js'

describe('cutHints.startHint', () => {
  it('avisa si el inicio deja un resto antes del golpe', () => {
    const h = startHint(1.0, [0.5, 1.05, 2])
    expect(h.kind).toBe('before-hit')
    expect(h.suggested).toBeCloseTo(1.046, 6)
  })
  it('avisa si el inicio corta un golpe', () => {
    expect(startHint(1.02, [1.0]).kind).toBe('cuts-hit')
  })
  it('calla si el inicio ya está bien', () => {
    expect(startHint(0.996, [1.0])).toBeNull()
    expect(startHint(3, [1.0])).toBeNull()
  })
})

import { flipKind } from '../src/engines/coachEngine.js'

describe('flip (definición unificada)', () => {
  it('reordenar, cambiar pitch o hacer reverse son flips', () => {
    expect(flipKind({ type: 'pad:hit' }, { hits: hits([2, 2, 0, 3]), order: ORDER })).toBe('reorder')
    expect(flipKind({ type: 'pitch:changed', semitones: -3 })).toBe('pitch')
    expect(flipKind({ type: 'reverse:on' })).toBe('reverse')
  })
  it('tocar en el orden original o volver el pitch a 0 no lo es', () => {
    expect(flipKind({ type: 'pad:hit' }, { hits: hits([0, 1, 2, 3]), order: ORDER })).toBeNull()
    expect(flipKind({ type: 'pitch:changed', semitones: 0 })).toBeNull()
  })
  it('pitch y reverse lo explican como flip', () => {
    expect(react({ type: 'reverse:on' }).text).toContain('flip')
    expect(react({ type: 'pitch:changed', semitones: 2 }).text).toContain('flip')
  })
})

describe('coach: grabación y quantize', () => {
  it('explica qué es un pattern al terminar la toma', () => {
    const m = react({ type: 'record:done', count: 6, sequence: [0, 1] })
    expect(m.term).toBe('pattern')
    expect(m.text).toContain('6 golpes')
  })
  it('una toma reordenada también cuenta como flip', () => {
    expect(flipKind({ type: 'record:done', sequence: [2, 2, 0, 3] }, { order: ORDER })).toBe('reorder')
    expect(flipKind({ type: 'record:done', sequence: [0, 1, 2, 3] }, { order: ORDER })).toBeNull()
  })
  it('una frase escrita en la rejilla explica el pattern y cuenta como flip si rompe el orden', () => {
    const m = react({ type: 'grid:played', count: 4, sequence: [0, 2, 2, 1] })
    expect(m.id).toBe('learned:pattern')
    expect(m.text).toContain('4 golpes')
    expect(react({ type: 'grid:played', count: 4, sequence: [0, 2, 2, 1] }, {}, new Set([m.id]))).toBeNull()
    expect(flipKind({ type: 'grid:played', sequence: [0, 2, 2, 1] }, { order: ORDER })).toBe('reorder')
    expect(flipKind({ type: 'grid:played', sequence: [0, 1, 2, 3] }, { order: ORDER })).toBeNull()
    expect(flipKind({ type: 'grid:played', sequence: [1, 1, 1, 1] }, { order: ORDER })).toBeNull() // repetir un solo chop es otra cosa
  })
  it('quantize se explica después de usarlo, y el groove al volver a Original', () => {
    expect(react({ type: 'quantize:off' })).toBeNull()
    const seen = new Set()
    const q = react({ type: 'quantize:on', grid: '1/8' }, {}, seen)
    expect(q.term).toBe('quantize')
    seen.add(q.id)
    expect(react({ type: 'quantize:off' }, {}, seen).text).toContain('groove')
  })
})

describe('coach: old school y resampling', () => {
  it('explica el truco de 45 rpm y la memoria llena', () => {
    expect(react({ type: 'rpm:45' }).text).toMatch(/5 semitonos/)
    expect(react({ type: 'memory:full' }).kind).toBe('hint')
    expect(react({ type: 'oldschool:on' }).term).toBe('old school')
    expect(react({ type: 'resample:done' }).term).toBe('resampling')
  })
})
