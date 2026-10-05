import { describe, it, expect } from 'vitest'
import { DEFAULT_KEYMAP, keyLabel, padForCode, shouldIgnoreKey } from '../src/engines/keyboardMap.js'

describe('keyboardMap', () => {
  it('16 teclas únicas en rejilla 4×4', () => {
    expect(DEFAULT_KEYMAP).toHaveLength(16)
    expect(new Set(DEFAULT_KEYMAP).size).toBe(16)
  })
  it('1 2 3 4 / Q W E R para los 8 primeros pads', () => {
    expect(DEFAULT_KEYMAP.slice(0, 8).map(keyLabel).join('')).toBe('1234QWER')
    expect(padForCode('KeyQ')).toBe(4)
    expect(padForCode('KeyV')).toBe(15)
    expect(padForCode('KeyP')).toBe(-1)
  })
  it('ignora teclas mientras se escribe o con modificadores', () => {
    expect(shouldIgnoreKey({ target: { tagName: 'INPUT', type: 'text' } })).toBe(true)
    expect(shouldIgnoreKey({ target: { tagName: 'INPUT', type: 'range' } })).toBe(false)
    expect(shouldIgnoreKey({ ctrlKey: true, target: { tagName: 'BODY' } })).toBe(true)
    expect(shouldIgnoreKey({ target: { tagName: 'BUTTON' } })).toBe(false)
  })
})
