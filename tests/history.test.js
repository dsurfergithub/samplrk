import { describe, it, expect } from 'vitest'
import { createHistory, record, undo, redo, canUndo, canRedo, HISTORY_LIMIT } from '../src/state/history.js'

describe('historial deshacer/rehacer', () => {
  it('deshace y rehace en orden', () => {
    let h = createHistory()
    h = record(h, 'A', { now: 0 })
    h = record(h, 'B', { now: 1000 })
    let r = undo(h, 'C')
    expect(r.state).toBe('B')
    r = undo(r.history, r.state)
    expect(r.state).toBe('A')
    expect(canUndo(r.history)).toBe(false)
    const f = redo(r.history, r.state)
    expect(f.state).toBe('B')
    expect(canRedo(f.history)).toBe(true)
  })

  it('agrupa gestos continuos con la misma key', () => {
    let h = createHistory()
    h = record(h, 'p0', { key: 'pitch', now: 0 })
    h = record(h, 'p1', { key: 'pitch', now: 100 })
    h = record(h, 'p2', { key: 'pitch', now: 200 })
    expect(h.past).toEqual(['p0'])
    h = record(h, 'x', { key: 'other', now: 300 })
    expect(h.past).toEqual(['p0', 'x'])
  })

  it('un cambio nuevo borra el futuro', () => {
    let h = record(createHistory(), 'A', { now: 0 })
    const r = undo(h, 'B')
    h = record(r.history, 'A', { now: 5000 })
    expect(canRedo(h)).toBe(false)
  })

  it('respeta el límite', () => {
    let h = createHistory()
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = record(h, i, { now: i * 1000 })
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(10)
  })

  it('undo/redo vacíos devuelven null', () => {
    expect(undo(createHistory(), 'x')).toBeNull()
    expect(redo(createHistory(), 'x')).toBeNull()
  })
})
