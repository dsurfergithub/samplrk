import { describe, it, expect } from 'vitest'
import * as SM from '../src/engines/sliceModel.js'

const total = (slices) => slices.reduce((a, s) => a + SM.sliceDuration(s), 0)

describe('crear chops', () => {
  it('equalSlices reparte la región sin huecos', () => {
    const s = SM.equalSlices('smp', 1, 6, 8)
    expect(s).toHaveLength(8)
    expect(s[0].start).toBe(1)
    expect(s[7].end).toBe(6)
    for (let i = 1; i < 8; i++) expect(s[i].start).toBeCloseTo(s[i - 1].end, 10)
    expect(total(s)).toBeCloseTo(5, 10)
    expect(new Set(s.map(x => x.color)).size).toBe(8)
  })

  it('slicesFromHits corta en los golpes dentro de la región', () => {
    const s = SM.slicesFromHits('smp', 0, 4, [0.5, 1, 1.5, 3.5, 9])
    expect(s.map(x => x.start)).toEqual([0, 0.5, 1, 1.5, 3.5])
    expect(s.at(-1).end).toBe(4)
  })

  it('con más golpes que pads elimina los trozos más cortos', () => {
    const hits = Array.from({ length: 40 }, (_, i) => 0.1 + i * 0.1 + (i % 3) * 0.01)
    const b = SM.hitBoundaries(0, 4.5, hits, 8)
    expect(b.length - 1).toBe(8)
    expect(b[0]).toBe(0)
    expect(b.at(-1)).toBe(4.5)
  })

  it('ignora golpes pegados al borde', () => {
    const b = SM.hitBoundaries(0, 2, [0.01, 1, 1.99])
    expect(b).toEqual([0, 1, 2])
  })
})

describe('editar chops', () => {
  const base = SM.equalSlices('smp', 0, 4, 4)

  it('split divide por la mitad sin perder audio', () => {
    const r = SM.splitSlice(base, base[1].id)
    expect(r.slices).toHaveLength(5)
    expect(total(r.slices)).toBeCloseTo(4, 10)
    expect(r.created.start).toBeCloseTo(1.5, 10)
  })

  it('split rechaza trozos demasiado cortos', () => {
    expect(SM.splitSlice(base, base[0].id, 0.01)).toBeNull()
  })

  it('merge une con el vecino contiguo y conserva el primero', () => {
    const named = SM.updateSlice(base, base[0].id, { name: 'Intro', pitch: 3 })
    const r = SM.mergeWithNext(named, base[0].id)
    expect(r.slices).toHaveLength(3)
    const m = r.slices.find(s => s.id === base[0].id)
    expect(m.end).toBe(2)
    expect(m.name).toBe('Intro')
    expect(m.pitch).toBe(3)
    expect(r.removed.id).toBe(base[1].id)
  })

  it('merge del último no hace nada', () => {
    expect(SM.mergeWithNext(base, base[3].id)).toBeNull()
  })

  it('mover un borde compartido mueve también al vecino', () => {
    const out = SM.moveEdge(base, base[1].id, 'start', 0.8, { min: 0, max: 4 })
    expect(out[1].start).toBe(0.8)
    expect(out[0].end).toBe(0.8)
  })

  it('un borde no puede cruzar al vecino ni salirse de la región', () => {
    const a = SM.moveEdge(base, base[1].id, 'end', 99, { min: 0, max: 4 })
    expect(a[1].end).toBeCloseTo(3 - SM.MIN_SLICE, 10)
    const b = SM.moveEdge(base, base[0].id, 'start', -5, { min: 0.5, max: 4 })
    expect(b[0].start).toBe(0.5)
  })

  it('no muta la entrada', () => {
    const copy = JSON.stringify(base)
    SM.moveEdge(base, base[1].id, 'start', 0.9)
    SM.splitSlice(base, base[2].id)
    expect(JSON.stringify(base)).toBe(copy)
  })
})

describe('banco de pads', () => {
  const s = SM.equalSlices('smp', 0, 4, 4)

  it('ordena por tiempo y deja el resto vacío', () => {
    const pads = SM.padsInTimeOrder([s[2], s[0], s[3], s[1]])
    expect(pads.slice(0, 4)).toEqual(s.map(x => x.id))
    expect(pads.slice(4).every(p => p === null)).toBe(true)
    expect(pads).toHaveLength(16)
  })

  it('placeInPads usa el siguiente pad libre', () => {
    const pads = SM.padsInTimeOrder(s)
    const out = SM.placeInPads(pads, 'nuevo', 1)
    expect(out[4]).toBe('nuevo')
  })

  it('visiblePadCount pasa a 16 solo si hace falta', () => {
    const pads = SM.padsInTimeOrder(s)
    expect(SM.visiblePadCount(pads)).toBe(8)
    const p2 = [...pads]; p2[12] = 'x'
    expect(SM.visiblePadCount(p2)).toBe(16)
  })

  it('swapPads intercambia y respeta los límites', () => {
    const pads = SM.padsInTimeOrder(s)
    expect(SM.swapPads(pads, 0, 1).slice(0, 2)).toEqual([s[1].id, s[0].id])
    expect(SM.swapPads(pads, 0, -1)).toBe(pads)
  })

  it('originalOrder sigue la grabación aunque los pads estén cambiados', () => {
    const pads = SM.swapPads(SM.padsInTimeOrder(s), 0, 2) // C B A D
    expect(SM.originalOrder(pads, s)).toEqual([2, 1, 0, 3])
  })

  it('letras de pad', () => {
    expect(SM.padLetter(0)).toBe('A')
    expect(SM.padLetter(15)).toBe('P')
  })
})
