/**
 * actions.js — orquestación de la app.
 * Une store + motores. Las vistas y el asistente solo llaman a estas funciones.
 */
import { getState, setState, updateSample, updateSampleEdits, showToast } from '../state/store'
import {
  createEditableSample, getRuntime, releaseBuffer, renderEditedBuffer,
  editedTransients, editedDuration, pitchRate, uid,
} from '../engines/sampleEngine'
import { analyzeSample } from '../engines/analysisEngine'
import {
  generateLoops as engineGenerateLoops, loopFromSelection,
  getLoopBuffer, releaseLoopBuffer,
} from '../engines/loopEngine'
import { computeCompatibility } from '../engines/library'
import { createScene } from '../engines/projectEngine'
import { createSection } from '../engines/timelineEngine'
import {
  getCtx, setBpm as engineSetBpm, playPreview, stopPreview, getTransport,
  toggleLoop as engineToggleLoop, launchScene as engineLaunchScene, stopAllLoops,
} from '../engines/audioEngine'
import { encodeWav, download, renderSceneOffline, renderTimelineOffline } from '../engines/exportEngine'

export function gotoView(view) { setState({ view }) }

// ------------------------------------------------------------- importación

async function addDecodedBuffer(buffer, name, source) {
  const sample = createEditableSample({ name, buffer, source })
  setState(s => ({ samples: [...s.samples, sample], activeSampleId: sample.id }))
  showToast(`«${name}» importado (${buffer.duration.toFixed(1)} s)`)
  analyze(sample.id) // análisis automático en segundo plano
  return sample
}

/** Importa archivos de audio o vídeo (se decodifica su pista de audio). */
export async function importFiles(fileList) {
  for (const file of Array.from(fileList)) {
    try {
      const ab = await file.arrayBuffer()
      const buffer = await getCtx().decodeAudioData(ab)
      await addDecodedBuffer(buffer, file.name.replace(/\.[^.]+$/, ''), 'archivo')
      setState({ view: 'editor' })
    } catch {
      showToast(`No pude decodificar «${file.name}». ¿Formato soportado por el navegador?`)
    }
  }
}

// --- grabación desde micrófono
let recorder = null
let recChunks = []

export async function toggleRecording() {
  if (recorder) {
    recorder.stop()
    return false
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorder = new MediaRecorder(stream)
    recChunks = []
    recorder.ondataavailable = (e) => recChunks.push(e.data)
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(recChunks, { type: recorder.mimeType })
      recorder = null
      setState({ recording: false })
      try {
        const buffer = await getCtx().decodeAudioData(await blob.arrayBuffer())
        await addDecodedBuffer(buffer, `Grabación ${new Date().toLocaleTimeString()}`, 'micrófono')
        setState({ view: 'editor' })
      } catch {
        showToast('No pude decodificar la grabación')
      }
    }
    recorder.start()
    setState({ recording: true })
    return true
  } catch {
    showToast('Sin acceso al micrófono')
    return false
  }
}

/** Sintetiza un beat de demostración (para probar el flujo sin archivos). */
export function createDemoSample() {
  const sr = 44100
  const bpm = 100
  const beat = 60 / bpm
  const bars = 8
  const n = Math.floor(bars * 4 * beat * sr)
  const L = new Float32Array(n)
  const noise = () => Math.random() * 2 - 1
  const A1 = 55
  const bassNotes = [A1, A1, A1 * Math.pow(2, 3 / 12), A1 * Math.pow(2, 5 / 12)] // A C D
  for (let b = 0; b < bars * 4; b++) {
    const t0 = b * beat
    // bombo en cada beat
    for (let i = 0; i < sr * 0.22; i++) {
      const t = i / sr
      const idx = Math.floor((t0 + t) * sr)
      if (idx < n) L[idx] += Math.sin(2 * Math.PI * (52 + 60 * Math.exp(-t * 22)) * t) * Math.exp(-t * 14) * 0.85
    }
    // caja en beats 2 y 4
    if (b % 4 === 1 || b % 4 === 3) {
      for (let i = 0; i < sr * 0.14; i++) {
        const idx = Math.floor(t0 * sr) + i
        if (idx < n) L[idx] += noise() * Math.exp(-i / sr * 34) * 0.4
      }
    }
    // hats a corcheas
    for (const off of [0, beat / 2]) {
      for (let i = 0; i < sr * 0.03; i++) {
        const idx = Math.floor((t0 + off) * sr) + i
        if (idx < n) L[idx] += noise() * Math.exp(-i / sr * 160) * 0.16
      }
    }
    // bajo por compás
    const f = bassNotes[Math.floor(b / 4) % bassNotes.length]
    for (let i = 0; i < sr * beat * 0.9; i++) {
      const t = i / sr
      const idx = Math.floor(t0 * sr) + i
      if (idx < n) L[idx] += (Math.sin(2 * Math.PI * f * t) * 0.7 + Math.sin(2 * Math.PI * f * 2 * t) * 0.2) * Math.exp(-t * 2.2) * 0.3
    }
  }
  // pad suave (La menor: A3 C4 E4)
  for (const f of [220, 261.63, 329.63]) {
    for (let i = 0; i < n; i++) {
      const t = i / sr
      L[i] += Math.sin(2 * Math.PI * f * t) * 0.035 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.15 * t))
    }
  }
  for (let i = 0; i < n; i++) L[i] = Math.tanh(L[i] * 1.1) * 0.9
  const buf = getCtx().createBuffer(2, n, sr)
  buf.copyToChannel(L, 0)
  buf.copyToChannel(L, 1)
  addDecodedBuffer(buf, 'Demo beat 100 BPM', 'demo')
  setState({ view: 'editor' })
}

// ------------------------------------------------------------- análisis

export async function analyze(sampleId) {
  const sample = getState().samples.find(s => s.id === sampleId)
  if (!sample) return
  setState({ busy: `Analizando «${sample.name}»…` })
  try {
    const analysis = await analyzeSample(sampleId)
    updateSample(sampleId, { analysis })
    // el primer análisis fija el BPM del proyecto
    const st = getState()
    if (st.loops.length === 0) {
      engineSetBpm(analysis.bpm)
      setState({ bpm: analysis.bpm })
    }
    showToast(`Análisis listo: ${analysis.bpm} BPM · ${analysis.key} ${analysis.mode === 'minor' ? 'menor' : 'mayor'}`)
  } catch (err) {
    showToast('Error en el análisis: ' + err.message)
  } finally {
    setState({ busy: null })
  }
}

export function trimSilence(sampleId, endOfSilence) {
  updateSampleEdits(sampleId, { trimStart: Math.max(0, endOfSilence - 0.02) })
  showToast('Silencio inicial recortado (edición no destructiva)')
}

export function autoSlice(sampleId) {
  const sample = getState().samples.find(s => s.id === sampleId)
  if (!sample?.analysis) return
  const ts = editedTransients(sample)
  const dur = editedDuration(sample)
  const slices = []
  for (let i = 0; i < ts.length; i++) {
    slices.push({ id: uid('slc'), start: ts[i], end: ts[i + 1] ?? dur, name: `Slice ${i + 1}` })
  }
  updateSample(sampleId, { slices })
  showToast(`${slices.length} slices creados en los golpes detectados`)
}

// ------------------------------------------------------------- loops

export function generateLoops(sampleId) {
  const sample = getState().samples.find(s => s.id === sampleId)
  if (!sample) return
  if (!sample.analysis) { showToast('Primero analiza el sample'); return }
  setState({ busy: 'Buscando y validando loops…' })
  // deja respirar a la UI antes del trabajo síncrono
  setTimeout(() => {
    try {
      const newLoops = engineGenerateLoops(sample)
      setState(s => ({ loops: computeCompatibility([...s.loops, ...newLoops]), view: 'loops' }))
      showToast(`${newLoops.length} loops generados y validados`)
    } catch (err) {
      showToast(err.message)
    } finally {
      setState({ busy: null })
    }
  }, 30)
}

export function createLoopFromSelection(sampleId, startSec, endSec) {
  const sample = getState().samples.find(s => s.id === sampleId)
  if (!sample) return
  try {
    const loop = loopFromSelection(sample, startSec, endSec)
    setState(s => ({ loops: computeCompatibility([...s.loops, loop]) }))
    showToast(loop.valid
      ? `Loop creado (${loop.bars} compases, sin problemas)`
      : `Loop creado con avisos: ${loop.issues[0]}`)
  } catch (err) {
    showToast(err.message)
  }
}

export function deleteLoop(loopId) {
  releaseLoopBuffer(loopId)
  setState(s => ({
    loops: computeCompatibility(s.loops.filter(l => l.id !== loopId)),
    scenes: s.scenes.map(sc => {
      const { [loopId]: _, ...rest } = sc.loops
      return { ...sc, loops: rest }
    }),
  }))
}

export function toggleLoopPad(loop) {
  const buffer = getLoopBuffer(loop.id)
  if (!buffer) { showToast('Buffer del loop no disponible'); return }
  engineToggleLoop(loop, buffer)
}

export function previewLoop(loop) {
  const buffer = getLoopBuffer(loop.id)
  if (buffer) playPreview(buffer)
}

export function previewSampleSelection(sample, sel) {
  const buffer = renderEditedBuffer(sample)
  const rate = pitchRate(sample)
  sel
    ? playPreview(buffer, { offset: sel.a, duration: sel.b - sel.a, rate })
    : playPreview(buffer, { rate })
}

export { stopPreview }

// ------------------------------------------------------------- escenas

export function saveScene(name) {
  const st = getState()
  const { activeLoopIds } = getTransport()
  if (activeLoopIds.length === 0) { showToast('Activa al menos un loop para guardar una escena'); return }
  const scene = createScene(name, activeLoopIds, {}, st.scenes.length)
  setState(s => ({ scenes: [...s.scenes, scene] }))
  showToast(`Escena «${scene.name}» guardada con ${activeLoopIds.length} loops`)
}

export function launchScene(sceneId) {
  const st = getState()
  const scene = st.scenes.find(s => s.id === sceneId)
  if (scene) engineLaunchScene(scene, st.loops, getLoopBuffer)
}

export function updateSceneFromLive(sceneId) {
  const { activeLoopIds } = getTransport()
  setState(s => ({
    scenes: s.scenes.map(sc => sc.id === sceneId
      ? { ...sc, loops: Object.fromEntries(activeLoopIds.map(id => [id, sc.loops[id] ?? { vol: 1, pan: 0 }])) }
      : sc),
  }))
  showToast('Escena actualizada con los loops activos')
}

export function deleteScene(sceneId) {
  setState(s => ({
    scenes: s.scenes.filter(sc => sc.id !== sceneId),
    timeline: s.timeline.filter(sec => sec.sceneId !== sceneId),
  }))
}

// ------------------------------------------------------------- timeline

export function addSection(name, sceneId, bars) {
  setState(s => ({ timeline: [...s.timeline, createSection(name, sceneId, bars)] }))
}

export function removeSection(id) {
  setState(s => ({ timeline: s.timeline.filter(x => x.id !== id) }))
}

export function moveSection(id, dir) {
  setState(s => {
    const arr = [...s.timeline]
    const i = arr.findIndex(x => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return {}
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return { timeline: arr }
  })
}

// ------------------------------------------------------------- exportación

export function exportLoopWav(loop) {
  const buffer = getLoopBuffer(loop.id)
  if (!buffer) return
  download(encodeWav(buffer), `${loop.name.replace(/[^\w\- ]+/g, '')}.wav`)
  showToast('Loop exportado a WAV')
}

export function exportSampleWav(sample) {
  download(encodeWav(renderEditedBuffer(sample)), `${sample.name}.wav`)
  showToast('Sample (editado) exportado a WAV')
}

export async function exportSceneWav(sceneId, bars = 4) {
  const st = getState()
  const scene = st.scenes.find(s => s.id === sceneId)
  if (!scene) return
  setState({ busy: 'Renderizando escena…' })
  try {
    const buf = await renderSceneOffline(scene, st.loops, getLoopBuffer, st.bpm, bars)
    download(encodeWav(buf), `${scene.name}.wav`)
    showToast('Escena exportada a WAV')
  } finally {
    setState({ busy: null })
  }
}

export async function exportSongWav() {
  const st = getState()
  if (st.timeline.length === 0) { showToast('La timeline está vacía'); return }
  setState({ busy: 'Renderizando canción completa…' })
  try {
    const buf = await renderTimelineOffline(st.timeline, st.scenes, st.loops, getLoopBuffer, st.bpm)
    download(encodeWav(buf), 'samplrk-song.wav')
    showToast('Canción exportada a WAV')
  } catch (err) {
    showToast(err.message)
  } finally {
    setState({ busy: null })
  }
}

// ------------------------------------------------------------- transporte

export function setProjectBpm(bpm) {
  engineSetBpm(bpm)
  setState({ bpm })
}

export function deleteSample(sampleId) {
  stopPreview()
  releaseBuffer(sampleId)
  setState(s => ({
    samples: s.samples.filter(x => x.id !== sampleId),
    activeSampleId: s.activeSampleId === sampleId ? (s.samples.find(x => x.id !== sampleId)?.id ?? null) : s.activeSampleId,
  }))
}

export function stopEverything() {
  stopPreview()
  stopAllLoops()
}
