import { describe, it, expect } from 'vitest'
import {
  noteName, parseMidiMessage, velocityToGain, defaultMidiMap, resolveNote, assignNote, notesFor, sanitizeMap,
} from '../src/engines/midiMap.js'

describe('mensajes MIDI', () => {
  it('note on, note off y note on con velocity 0 (= off)', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ type: 'noteon', channel: 1, note: 60, velocity: 100 })
    expect(parseMidiMessage([0x99, 36, 90])).toMatchObject({ type: 'noteon', channel: 10, note: 36 })
    expect(parseMidiMessage([0x80, 60, 0]).type).toBe('noteoff')
    expect(parseMidiMessage([0x90, 60, 0]).type).toBe('noteoff')
  })
  it('control change y mensajes que no interesan', () => {
    expect(parseMidiMessage([0xb0, 7, 64])).toEqual({ type: 'cc', channel: 1, controller: 7, value: 64 })
    expect(parseMidiMessage([0xf8])).toBeNull()      // clock
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull() // pitch bend
  })
  it('nombres de nota con C3 = 60', () => {
    expect(noteName(60)).toBe('C3')
    expect(noteName(36)).toBe('C1')
    expect(noteName(61)).toBe('C#3')
    expect(noteName(0)).toBe('C-2')
  })
})

describe('velocity', () => {
  it('más fuerte suena más alto, nunca más de 1', () => {
    expect(velocityToGain(127)).toBeCloseTo(1, 10)
    expect(velocityToGain(64)).toBeGreaterThan(0.4)
    expect(velocityToGain(64)).toBeLessThan(0.5)
    expect(velocityToGain(1)).toBeGreaterThan(0)
    expect(velocityToGain(0)).toBe(0)
    expect(velocityToGain(30)).toBeLessThan(velocityToGain(100))
  })
})

describe('mapa nota → pad', () => {
  const map = defaultMidiMap()
  it('pads de controlador (36…) y teclas blancas desde C3 tocan los chops', () => {
    expect(resolveNote(map, 36, 'chop')).toEqual({ kind: 'chops', pad: 0 })
    expect(resolveNote(map, 51, 'record')).toEqual({ kind: 'chops', pad: 15 })
    expect(resolveNote(map, 60, 'chop')).toEqual({ kind: 'chops', pad: 0 })   // C3 → A
    expect(resolveNote(map, 62, 'chop')).toEqual({ kind: 'chops', pad: 1 })   // D3 → B
    expect(resolveNote(map, 72, 'chop')).toEqual({ kind: 'chops', pad: 7 })   // C4 → H
    expect(resolveNote(map, 61, 'chop')).toBeNull()                            // tecla negra libre
  })
  it('en DRUMS manda el mapa General MIDI de batería', () => {
    expect(resolveNote(map, 36, 'drums')).toEqual({ kind: 'drums', id: 'kick' })
    expect(resolveNote(map, 38, 'drums')).toEqual({ kind: 'drums', id: 'snare' })
    expect(resolveNote(map, 42, 'drums')).toEqual({ kind: 'drums', id: 'hat' })
    expect(resolveNote(map, 46, 'drums')).toEqual({ kind: 'drums', id: 'open' })
    expect(resolveNote(map, 50, 'drums')).toBeNull()
  })
  it('MIDI learn: una nota toca un solo pad y no muta el mapa', () => {
    const before = JSON.stringify(map)
    const m2 = assignNote(map, 61, { kind: 'chops', pad: 2 })
    expect(resolveNote(m2, 61, 'chop')).toEqual({ kind: 'chops', pad: 2 })
    const m3 = assignNote(m2, 61, { kind: 'chops', pad: 5 })
    expect(resolveNote(m3, 61, 'chop').pad).toBe(5)
    expect(notesFor(m3, { kind: 'chops', pad: 2 })).not.toContain(61)
    expect(JSON.stringify(map)).toBe(before)
  })
  it('notas asignadas a cada pad (para mostrarlas)', () => {
    expect(notesFor(map, { kind: 'chops', pad: 0 })).toEqual([36, 60])
    expect(notesFor(map, { kind: 'drums', id: 'open' })).toEqual([46, 65])
  })
  it('un mapa guardado roto vuelve al de por defecto', () => {
    expect(sanitizeMap(null)).toEqual(defaultMidiMap())
    expect(sanitizeMap({ chops: [1, 2] }).chops).toEqual(defaultMidiMap().chops)
    expect(sanitizeMap({ chops: { 61: 3 }, drums: {} }).chops).toEqual({ 61: 3 })
  })
})
