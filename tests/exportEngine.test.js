import { describe, it, expect } from 'vitest'
import { encodeWav } from '../src/engines/exportEngine.js'

function fakeBuffer(channels, sampleRate = 44100) {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0].length,
    getChannelData: (i) => channels[i],
  }
}

describe('encodeWav', () => {
  it('genera una cabecera RIFF/WAVE válida y el tamaño exacto', async () => {
    const blob = encodeWav(fakeBuffer([Float32Array.from([0, 0.5, -0.5, 1])]))
    expect(blob.size).toBe(44 + 4 * 2) // cabecera + 4 muestras PCM16 mono
    const view = new DataView(await blob.arrayBuffer())
    const str = (off, len) => String.fromCharCode(...new Uint8Array(view.buffer, off, len))
    expect(str(0, 4)).toBe('RIFF')
    expect(str(8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)        // mono
    expect(view.getUint32(24, true)).toBe(44100)    // sample rate
    expect(view.getUint16(34, true)).toBe(16)       // bits
  })

  it('intercala los canales en estéreo y satura fuera de rango', async () => {
    const L = Float32Array.from([1.5, 0])
    const R = Float32Array.from([-1.5, 0])
    const blob = encodeWav(fakeBuffer([L, R]))
    const view = new DataView(await blob.arrayBuffer())
    expect(view.getInt16(44, true)).toBe(0x7fff)    // saturado a +1
    expect(view.getInt16(46, true)).toBe(-0x8000)   // saturado a −1
  })
})
