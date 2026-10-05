import { describe, it, expect } from 'vitest'
import { checkFile, extensionOf, friendlyAudioError, MAX_FILE_MB } from '../src/engines/audioImport.js'

const file = (name, size = 1000, type = '') => ({ name, size, type })

describe('importación de audio', () => {
  it('extrae la extensión', () => {
    expect(extensionOf('mi Tema.MP3')).toBe('mp3')
    expect(extensionOf('sin')).toBe('')
  })
  it('acepta WAV y MP3 siempre', () => {
    expect(checkFile(file('a.wav'), () => false).ok).toBe(true)
    expect(checkFile(file('a.mp3'), () => false).ok).toBe(true)
  })
  it('rechaza formatos que el navegador no abre, con mensaje humano', () => {
    const r = checkFile(file('a.ogg'), () => false)
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/WAV o MP3/)
    expect(checkFile(file('a.ogg'), () => true).ok).toBe(true)
  })
  it('rechaza vídeo, archivos enormes y extensiones raras', () => {
    expect(checkFile(file('v.mp4', 10, 'video/mp4')).ok).toBe(false)
    expect(checkFile(file('a.wav', (MAX_FILE_MB + 1) * 1048576)).ok).toBe(false)
    expect(checkFile(file('doc.pdf', 10, 'application/pdf')).ok).toBe(false)
  })
  it('los errores nunca muestran jerga técnica', () => {
    const msg = friendlyAudioError(new DOMException('decodeAudioData failed', 'EncodingError'))
    expect(msg).not.toMatch(/DOMException|decodeAudioData/)
  })
})
