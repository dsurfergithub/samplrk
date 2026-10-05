import { describe, it, expect } from 'vitest'
import * as P from '../src/engines/patternEngine.js'

const pat = (events, extra = {}) => ({ ...P.createPattern({ bars: 2, bpm: 120 }), events, ...extra })
const ev = (padId, beat) => P.createEvent({ padId, beat, bpm: 120 })

describe('tiempo de los golpes', () => {
  it('convierte segundos a tiempos', () => {
    expect(P.beatOfHit(0.5, 120, 8)).toBeCloseTo(1, 10)
    expect(P.beatOfHit(3.75, 120, 8)).toBeCloseTo(7.5, 10)
  })
  it('un golpe anticipado al 1 se envuelve al final del loop', () => {
    expect(P.beatOfHit(-0.1, 120, 8)).toBeCloseTo(7.8, 10)
  })
  it('ignora lo que cae fuera de la toma', () => {
    expect(P.beatOfHit(-1, 120, 8)).toBeNull()
    expect(P.beatOfHit(4, 120, 8)).toBeNull()
  })
  it('el evento guarda beat y tiempo', () => {
    const e = ev(2, 3)
    expect(e.padId).toBe(2)
    expect(e.time).toBeCloseTo(1.5, 10)
  })
  it('duración del pattern según BPM', () => {
    expect(P.patternSeconds(pat([]))).toBeCloseTo(4, 10)
    expect(P.patternSeconds(pat([]), 60)).toBeCloseTo(8, 10)
  })
})

describe('quantize no destructivo', () => {
  const p = pat([ev(0, 0.1), ev(1, 1.4), ev(2, 7.9)])

  it('off devuelve la toma tal cual', () => {
    expect(P.effectiveEvents(p).map(e => e.beat)).toEqual([0.1, 1.4, 7.9])
  })
  it('1/8 ajusta a la corchea y envuelve el final del loop', () => {
    const q = P.effectiveEvents({ ...p, quantize: '1/8' })
    expect(q.map(e => e.beat)).toEqual([0, 0, 1.5])
    expect(q.find(e => e.padId === 2).rawBeat).toBeCloseTo(7.9, 10)
  })
  it('1/4 y 1/16', () => {
    expect(P.quantizeBeat(1.4, 1, 8)).toBe(1)
    expect(P.quantizeBeat(1.4, 0.25, 8)).toBe(1.5)
    expect(P.quantizeBeat(1.3, 0.25, 8)).toBe(1.25)
  })
  it('nunca modifica los eventos originales', () => {
    const before = JSON.stringify(p)
    P.effectiveEvents({ ...p, quantize: '1/16' })
    expect(JSON.stringify(p)).toBe(before)
  })
})

describe('scheduler (ventanas)', () => {
  const events = [ev(0, 0), ev(1, 2.5)]
  it('repite el pattern en bucle', () => {
    const w = P.eventsInWindow(events, 8, 0, 17)
    expect(w.map(x => x.at)).toEqual([0, 2.5, 8, 10.5, 16])
  })
  it('respeta el inicio de la reproducción (tras grabar)', () => {
    const w = P.eventsInWindow(events, 8, 0, 12, 8)
    expect(w.map(x => x.at)).toEqual([8, 10.5])
  })
  it('ventanas consecutivas no repiten ni pierden eventos', () => {
    const all = []
    for (let a = 0; a < 23.9; a += 0.37) all.push(...P.eventsInWindow(events, 8, a, Math.min(24, a + 0.37)))
    expect(all.map(x => x.at)).toEqual([0, 2.5, 8, 10.5, 16, 18.5])
  })
  it('clics de metrónomo en tiempos enteros, también en la cuenta atrás', () => {
    expect(P.beatsInWindow(-4, -1.5)).toEqual([-4, -3, -2])
    expect(P.beatsInWindow(0.2, 3)).toEqual([1, 2])
  })
})

describe('tempo', () => {
  it('tap tempo con la mediana de los intervalos', () => {
    expect(P.tapTempo([0, 0.5, 1, 1.5])).toBe(120)
    expect(P.tapTempo([0, 0.5, 1.2, 1.5, 2])).toBe(120) // un toque torpe no importa
  })
  it('una pausa larga empieza una cuenta nueva', () => {
    expect(P.tapTempo([0, 0.3, 5, 5.75, 6.5])).toBe(80)
    expect(P.tapTempo([0, 5])).toBeNull()
  })
  it('×2 y ÷2 dentro del rango', () => {
    expect(P.doubleBpm(80)).toBe(160)
    expect(P.doubleBpm(150)).toBe(150)
    expect(P.halveBpm(70)).toBe(70)
    expect(P.halveBpm(180)).toBe(90)
  })
  it('BPM inicial: pista del disco, después detector fiable, si no 90', () => {
    expect(P.initialBpm({ tempoHint: 86 })).toBe(86)
    expect(P.initialBpm({ analysis: { bpm: 93.7, bpmConfidence: 0.4 } })).toBe(93.7)
    expect(P.initialBpm({ analysis: { bpm: 93.7, bpmConfidence: 0.02 } })).toBe(90)
    expect(P.initialBpm(null)).toBe(90)
  })
})
