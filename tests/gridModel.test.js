import { describe, it, expect } from 'vitest'
import * as P from '../src/engines/patternEngine.js'
import * as G from '../src/engines/gridModel.js'

const BPM = 120
const base = (extra = {}) => ({ ...P.createPattern({ bars: 1, bpm: BPM }), kind: 'chops', ...extra })
const ev = (padId, beat, extra = {}) => ({ ...P.createEvent({ padId, beat, bpm: BPM }), ...extra })
const pads = (pattern) => pattern.events.map(e => e.padId)
const beats = (pattern) => pattern.events.map(e => e.beat)

describe('rejilla: pasos y resolución', () => {
  it('cuenta los pasos según compases y resolución', () => {
    expect(G.stepCount(1, '1/4')).toBe(4)
    expect(G.stepCount(2, '1/8')).toBe(16)
    expect(G.stepCount(4, '1/16')).toBe(64)
  })
  it('un paso mide una fracción de negra', () => {
    expect(G.beatOfStep(3, '1/4')).toBe(3)
    expect(G.beatOfStep(3, '1/8')).toBe(1.5)
    expect(G.beatOfStep(3, '1/16')).toBe(0.75)
  })
  it('etiquetas: 1 e & a / 1 & / 1', () => {
    expect([0, 1, 2, 3, 4].map(s => G.stepLabel(s, '1/16'))).toEqual(['1', 'e', '&', 'a', '2'])
    expect([0, 1, 2, 3].map(s => G.stepLabel(s, '1/8'))).toEqual(['1', '&', '2', '&'])
    expect([0, 1, 2, 3, 4].map(s => G.stepLabel(s, '1/4'))).toEqual(['1', '2', '3', '4', '1'])
  })
  it('paso de un beat: redondea y envuelve el final del loop al paso 0', () => {
    expect(G.stepOfBeat(1.4, '1/8', 1)).toBe(3)
    expect(G.stepOfBeat(3.9, '1/4', 1)).toBe(0)
    expect(G.stepOfBeat(0.1, '1/4', 1)).toBe(0)
  })
  it('paso del playhead (sin redondear hacia arriba)', () => {
    expect(G.stepAtBeat(0.49, '1/8', 1)).toBe(0)
    expect(G.stepAtBeat(0.5, '1/8', 1)).toBe(1)
    expect(G.stepAtBeat(3.99, '1/4', 1)).toBe(3)
  })
})

describe('crear una frase con clics: A C C B', () => {
  it('cuatro celdas, una por paso, en el orden de la rejilla', () => {
    let p = base({ grid: '1/4' })
    for (const [pad, step] of [[0, 0], [2, 1], [2, 2], [1, 3]]) p = G.setStep(p, pad, step, true, '1/4', { bpm: BPM })
    expect(pads(p)).toEqual([0, 2, 2, 1])
    expect(beats(p)).toEqual([0, 1, 2, 3])
    expect(P.padSequence(p)).toEqual([0, 2, 2, 1])
  })
  it('cada golpe guarda beat, tiempo y duración del paso', () => {
    const p = G.setStep(base(), 3, 2, true, '1/8', { bpm: BPM })
    expect(p.events[0]).toMatchObject({ padId: 3, beat: 1, time: 0.5, duration: 0.25, velocity: 1 })
  })
  it('apagar una celda quita solo ese golpe', () => {
    let p = base()
    p = G.setStep(p, 0, 0, true, '1/4')
    p = G.setStep(p, 1, 0, true, '1/4') // otro pad en el mismo paso: conviven
    p = G.setStep(p, 0, 0, false, '1/4')
    expect(pads(p)).toEqual([1])
  })
  it('encender una celda ya encendida (o apagar una vacía) no cambia nada', () => {
    const p = G.setStep(base(), 0, 0, true, '1/4')
    expect(G.setStep(p, 0, 0, true, '1/4')).toBe(p)
    expect(G.setStep(p, 5, 3, false, '1/4')).toBe(p)
  })
  it('no modifica el pattern original', () => {
    const p = base()
    const before = JSON.stringify(p)
    G.setStep(p, 0, 0, true, '1/4')
    expect(JSON.stringify(p)).toBe(before)
  })
  it('las celdas reflejan lo que suena', () => {
    const p = G.setStep(G.setStep(base(), 0, 0, true, '1/8'), 2, 3, true, '1/8')
    const cells = G.gridCells(p, '1/8')
    expect([...cells.keys()].sort()).toEqual(['0:0', '2:3'])
  })
})

describe('toma en directo → rejilla editable', () => {
  const live = base({ bars: 1, events: [ev(0, 0.04), ev(2, 0.52), ev(2, 1.47), ev(1, 3.9)] })

  it('una toma suelta se detecta; una pegada, no', () => {
    expect(G.isLoose(live, '1/8')).toBe(true)
    expect(G.looseCount(live, '1/8')).toBe(4)
    const snapped = G.snapPattern(live, '1/8').pattern
    expect(G.isLoose(snapped, '1/8')).toBe(false)
    expect(G.looseCount(snapped, '1/8')).toBe(0)
  })
  it('pega cada golpe al paso más cercano y conserva el pad', () => {
    const { pattern } = G.snapPattern(live, '1/8')
    expect(beats(pattern)).toEqual([0, 0, 0.5, 1.5])
    expect(pads(pattern).sort()).toEqual([0, 1, 2, 2])
    expect(pattern.events.find(e => e.padId === 2 && e.beat === 1.5).time).toBeCloseTo(0.75, 10)
    expect(pattern.quantize).toBe('off')
    expect(pattern.grid).toBe('1/8')
  })
  it('un golpe anticipado al final del loop pasa al paso 1', () => {
    const { pattern } = G.snapPattern(base({ events: [ev(1, 3.9)] }), '1/4')
    expect(beats(pattern)).toEqual([0])
  })
  it('dos golpes del mismo pad en el mismo paso se unen y queda el más fuerte', () => {
    const p = base({ events: [ev(0, 0.02, { velocity: 0.4 }), ev(0, 0.1, { velocity: 0.9 }), ev(1, 0.05)] })
    const r = G.snapPattern(p, '1/4')
    expect(r.merged).toBe(1)
    expect(r.pattern.events.find(e => e.padId === 0).velocity).toBe(0.9)
    expect(r.pattern.events).toHaveLength(2)
  })
  it('hornea el quantize que ya tenía la toma', () => {
    const q = base({ quantize: '1/8', events: [ev(0, 0.1), ev(1, 1.4)] })
    expect(G.isLoose(q, '1/8')).toBe(true) // quantize aplicado: la toma original sigue dentro
    const { pattern } = G.snapPattern(q, '1/8')
    expect(beats(pattern)).toEqual([0, 1.5])
    expect(pattern.quantize).toBe('off')
    expect(G.isLoose(pattern, '1/8')).toBe(false)
  })
  it('no toca la toma original', () => {
    const before = JSON.stringify(live)
    G.snapPattern(live, '1/16')
    expect(JSON.stringify(live)).toBe(before)
  })
  it('un pattern vacío nunca es «suelto»', () => {
    expect(G.isLoose(base(), '1/8')).toBe(false)
    expect(G.isLoose(null, '1/8')).toBe(false)
  })
})

describe('resolución sugerida', () => {
  const at = (...b) => b.map(x => ev(0, x))
  it('negras limpias → 1/4', () => expect(G.suggestResolution(at(0, 1.02, 2, 2.96))).toBe('1/4'))
  it('corcheas → 1/8', () => expect(G.suggestResolution(at(0, 0.5, 1, 1.52, 2.5))).toBe('1/8'))
  it('semicorcheas → 1/16', () => expect(G.suggestResolution(at(0, 0.25, 0.75, 1, 1.25))).toBe('1/16'))
  it('una toma muy suelta → la más fina (pierde menos)', () => expect(G.suggestResolution(at(0.13, 0.37, 0.88, 1.12))).toBe('1/16'))
  it('sin golpes → la de por defecto', () => expect(G.suggestResolution([])).toBe(G.DEFAULT_RESOLUTION))
})

describe('longitud: 1, 2, 4 compases', () => {
  const two = G.setStep(G.setStep(base({ bars: 2 }), 0, 0, true, '1/4'), 1, 6, true, '1/4') // beats 0 y 6

  it('alargar deja los compases nuevos vacíos', () => {
    const { pattern, dropped } = G.resizePattern(two, 4)
    expect(pattern.bars).toBe(4)
    expect(beats(pattern)).toEqual([0, 6])
    expect(dropped).toBe(0)
  })
  it('acortar quita lo que queda fuera y dice cuánto', () => {
    const { pattern, dropped } = G.resizePattern(two, 1)
    expect(beats(pattern)).toEqual([0])
    expect(dropped).toBe(1)
  })
  it('con tile repite el contenido (la batería sigue sonando)', () => {
    const { pattern } = G.resizePattern(two, 4, { tile: true })
    expect(beats(pattern)).toEqual([0, 6, 8, 14])
    expect(new Set(pattern.events.map(e => e.id)).size).toBe(4)
    expect(pattern.events.find(e => e.beat === 14).time).toBeCloseTo(7, 10)
  })
  it('mismos compases → mismo objeto', () => {
    expect(G.resizePattern(two, 2).pattern).toBe(two)
  })
})

describe('duplicar y limpiar', () => {
  const one = ['A', 'C', 'C', 'B'].reduce((p, _, i) => G.setStep(p, [0, 2, 2, 1][i], i, true, '1/4'), base({ grid: '1/4' }))

  it('duplicar repite el patrón en el compás siguiente', () => {
    const d = G.duplicatePattern(one)
    expect(d.bars).toBe(2)
    expect(pads(d)).toEqual([0, 2, 2, 1, 0, 2, 2, 1])
    expect(beats(d)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
  it('la copia se puede editar sin tocar la primera mitad', () => {
    const d = G.setStep(G.duplicatePattern(one), 1, 7, false, '1/4')
    expect(pads(d)).toEqual([0, 2, 2, 1, 0, 2, 2])
  })
  it('duplicar dos veces llega a 4 compases y ahí se detiene', () => {
    const d4 = G.duplicatePattern(G.duplicatePattern(one))
    expect(d4.bars).toBe(4)
    expect(d4.events).toHaveLength(16)
    expect(G.duplicatePattern(d4)).toBeNull()
  })
  it('limpiar vacía los golpes y conserva compases y resolución', () => {
    const c = G.clearEvents(one)
    expect(c.events).toEqual([])
    expect(c).toMatchObject({ bars: 1, grid: '1/4' })
  })
})

describe('vista de la pantalla', () => {
  const draft = { bars: 2, grid: '1/8' }
  it('sin pattern usa lo elegido, o los compases de la batería', () => {
    expect(G.gridView(null, draft)).toMatchObject({ res: '1/8', bars: 2, steps: 16, hits: 0, loose: false })
    expect(G.gridView(null, draft, 4)).toMatchObject({ bars: 4, steps: 32 })
  })
  it('con pattern manda el pattern', () => {
    const p = G.setStep(base({ bars: 1, grid: '1/16' }), 0, 0, true, '1/16')
    expect(G.gridView(p, draft, 4)).toMatchObject({ res: '1/16', bars: 1, steps: 16, hits: 1, loose: false })
  })
  it('una toma sin resolución guardada propone la que le encaja', () => {
    const live = base({ bars: 2, events: [ev(0, 0.03), ev(1, 2.05), ev(0, 4.0)] })
    const v = G.gridView(live, draft)
    expect(v.res).toBe('1/4')
    expect(v.loose).toBe(true)
    expect(v.looseCount).toBe(2) // el golpe en 4.0 ya está en la rejilla
  })
})
