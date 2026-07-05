/**
 * exportEngine.js — export_engine
 * Render offline (OfflineAudioContext) y codificación WAV PCM16.
 * MP3/FLAC quedan en hoja de ruta (requieren codificadores externos).
 */

/** Codifica un AudioBuffer (o algo con su misma forma) a WAV PCM 16-bit. */
export function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels
  const sr = buffer.sampleRate
  const len = buffer.length
  const bytesPerSample = 2
  const blockAlign = numCh * bytesPerSample
  const dataSize = len * blockAlign
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)            // PCM
  view.setUint16(22, numCh, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, sr * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  const channels = []
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c))
  let off = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      off += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

/** Descarga un blob con nombre de archivo. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function scheduleInOffline(octx, loop, buffer, startAt, stopAt, vol, pan, projectBpm) {
  const src = octx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.playbackRate.value = (projectBpm / loop.bpm) * Math.pow(2, (loop.pitch || 0) / 12)
  const gain = octx.createGain()
  gain.gain.value = vol
  if (octx.createStereoPanner) {
    const p = octx.createStereoPanner()
    p.pan.value = pan
    src.connect(p); p.connect(gain)
  } else {
    src.connect(gain)
  }
  gain.connect(octx.destination)
  src.start(startAt)
  src.stop(stopAt)
}

/** Renderiza una escena N compases a un AudioBuffer (sin tocar el audio en vivo). */
export async function renderSceneOffline(scene, loops, getBuffer, bpm, bars = 4, sampleRate = 44100) {
  const dur = bars * 240 / bpm
  const octx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate)
  for (const [loopId, mix] of Object.entries(scene.loops)) {
    const loop = loops.find(l => l.id === loopId)
    const buffer = getBuffer(loopId)
    if (!loop || !buffer) continue
    scheduleInOffline(octx, loop, buffer, 0, dur, mix.vol, mix.pan, bpm)
  }
  return octx.startRendering()
}

/** Renderiza la canción completa (todas las secciones de la timeline). */
export async function renderTimelineOffline(sections, scenes, loops, getBuffer, bpm, sampleRate = 44100) {
  const barDur = 240 / bpm
  const total = sections.reduce((a, s) => a + s.bars, 0) * barDur
  if (total <= 0) throw new Error('La timeline está vacía')
  const octx = new OfflineAudioContext(2, Math.ceil(total * sampleRate), sampleRate)
  let cursor = 0
  for (const section of sections) {
    const scene = scenes.find(s => s.id === section.sceneId)
    const end = cursor + section.bars * barDur
    if (scene) {
      for (const [loopId, mix] of Object.entries(scene.loops)) {
        const loop = loops.find(l => l.id === loopId)
        const buffer = getBuffer(loopId)
        if (!loop || !buffer) continue
        scheduleInOffline(octx, loop, buffer, cursor, end, mix.vol, mix.pan, bpm)
      }
    }
    cursor = end
  }
  return octx.startRendering()
}
