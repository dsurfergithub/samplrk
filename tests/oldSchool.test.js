import { describe, it, expect } from 'vitest'
import {
  SPEED_45, DEFAULT_OLD_SCHOOL, OLD_SCHOOL_PRESETS, oldSchoolOf, isLofi, memoryUsed, fitsInMemory,
  compensatingPitch, degradeChannels, memoryFor,
} from '../src/engines/oldSchool.js'

const proj = (samples, os = {}) => ({ samples, settings: { oldSchool: { ...DEFAULT_OLD_SCHOOL, enabled: true, ...os } } })
const smp = (id, start, end, speed = 1) => ({ id, edits: { trimStart: start, trimEnd: end, speed } })

describe('33 / 45 rpm', () => {
  it('45 rpm es un 35 % más rápido', () => {
    expect(SPEED_45).toBeCloseTo(1.35, 10)
  })
  it('samplear a 45 ocupa menos memoria', () => {
    expect(memoryFor(13.5, SPEED_45)).toBeCloseTo(10, 10)
  })
  it('para volver al tono original hay que bajar unos 5 semitonos', () => {
    expect(compensatingPitch(SPEED_45)).toBe(-5)
    expect(compensatingPitch(1)).toBe(0)
  })
})

describe('memoria', () => {
  it('cuenta lo cortado, a su velocidad', () => {
    expect(memoryUsed(proj([smp('a', 2, 6), smp('b', 0, 2.7, SPEED_45)]))).toBeCloseTo(6, 10)
  })
  it('un sample sin cortar todavía no ocupa', () => {
    expect(memoryUsed(proj([{ id: 'x', edits: { trimStart: 0, trimEnd: null } }]))).toBe(0)
  })
  it('decide si un tramo cabe, liberando el que se está recortando', () => {
    const p = proj([smp('a', 0, 8)])
    expect(fitsInMemory(p, 3, 1).fits).toBe(false)
    expect(fitsInMemory(p, 2, 1).fits).toBe(true)
    expect(fitsInMemory(p, 9, 1, 'a').fits).toBe(true)        // recortar de nuevo el mismo sample
    expect(fitsInMemory(p, 2.7, SPEED_45).fits).toBe(true)     // 2,7 s a 45 = 2 s de memoria
  })
  it('sin Old School no hay límite', () => {
    expect(fitsInMemory({ samples: [smp('a', 0, 100)], settings: {} }, 50, 1).fits).toBe(true)
  })
})

describe('sonido lo-fi', () => {
  const sr = 1000
  const ramp = [Float32Array.from({ length: 100 }, (_, i) => (i / 100) * 2 - 1)]

  it('12 bits: cuantiza a 2048 niveles por polaridad', () => {
    const [out] = degradeChannels([Float32Array.from([0.12345, -0.5, 0.99999])], sr, { bits: 12 })
    for (const v of out) expect(Math.abs(v * 2048 - Math.round(v * 2048))).toBeLessThan(1e-3)
  })
  it('8 bits suena más escalonado que 12', () => {
    const levels = (bits) => new Set(degradeChannels(ramp, sr, { bits })[0]).size
    expect(levels(4)).toBeLessThan(levels(12))
  })
  it('menos kHz: repite cada muestra (sample-and-hold)', () => {
    const [out] = degradeChannels(ramp, sr, { sampleRate: 250 })
    expect(out[0]).toBe(out[1]); expect(out[1]).toBe(out[3]); expect(out[4]).not.toBe(out[3])
  })
  it('a 45 rpm el muestreo efectivo es más bajo (más crujiente)', () => {
    const steps = (speed) => new Set(degradeChannels(ramp, sr, { sampleRate: 250, speed })[0]).size
    expect(steps(SPEED_45)).toBeLessThan(steps(1))
  })
  it('mono mezcla los canales; nunca modifica la entrada', () => {
    const L = Float32Array.from([1, 1]), R = Float32Array.from([0, -1])
    const out = degradeChannels([L, R], sr, { mono: true })
    expect(out).toHaveLength(1)
    expect([...out[0]]).toEqual([0.5, 0])
    expect([...L]).toEqual([1, 1])
  })
  it('isLofi solo con el modo activo', () => {
    expect(isLofi({ ...DEFAULT_OLD_SCHOOL, enabled: false })).toBe(false)
    expect(isLofi({ ...DEFAULT_OLD_SCHOOL, enabled: true })).toBe(true)
    expect(isLofi({ enabled: true, bits: 16, sampleRate: 44100, mono: false })).toBe(false)
  })
})

describe('ajustes', () => {
  it('presets con límites coherentes y valores por defecto para proyectos antiguos', () => {
    for (const p of OLD_SCHOOL_PRESETS) expect(p.settings.maxPads).toBe(8)
    expect(oldSchoolOf({ settings: {} })).toEqual(DEFAULT_OLD_SCHOOL)
    expect(oldSchoolOf({ settings: { oldSchool: { enabled: true, memorySec: 5 } } }).memorySec).toBe(5)
  })
})
