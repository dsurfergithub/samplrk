import { describe, it, expect } from 'vitest'
import { semitonesToRate, rateToSemitones, pitchedDuration, clampPitch, formatSemitones } from '../src/engines/pitch.js'

describe('pitch old school', () => {
  it('+12 duplica la velocidad y −12 la reduce a la mitad', () => {
    expect(semitonesToRate(12)).toBeCloseTo(2, 10)
    expect(semitonesToRate(-12)).toBeCloseTo(0.5, 10)
    expect(semitonesToRate(0)).toBe(1)
  })
  it('rateToSemitones es la inversa', () => {
    for (const st of [-7, -3, 0, 5, 11]) expect(rateToSemitones(semitonesToRate(st))).toBeCloseTo(st, 10)
  })
  it('bajar el pitch alarga el sonido y subirlo lo acorta', () => {
    expect(pitchedDuration(1, -12)).toBeCloseTo(2, 10)
    expect(pitchedDuration(1, 12)).toBeCloseTo(0.5, 10)
    expect(pitchedDuration(2, -3)).toBeGreaterThan(2)
    expect(pitchedDuration(2, 5)).toBeLessThan(2)
  })
  it('limita y redondea', () => {
    expect(clampPitch(30)).toBe(12)
    expect(clampPitch(-30)).toBe(-12)
    expect(clampPitch(2.6)).toBe(3)
  })
  it('formatea con signo', () => {
    expect(formatSemitones(5)).toBe('+5')
    expect(formatSemitones(-3)).toBe('−3')
    expect(formatSemitones(0)).toBe('0')
  })
})
