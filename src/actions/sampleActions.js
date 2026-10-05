/**
 * sampleActions.js — elegir audio, escucharlo y cortar el fragmento (FIND + CUT).
 */
import { createEditableSample, getRuntime, registerBuffer } from '../engines/sampleEngine'
import { oldSchoolOf, isLofi, lofiKey, speedOf, degradeChannels, fitsInMemory } from '../engines/oldSchool'
import { analyzeSample } from '../engines/analysisEngine'
import { getCtx, unlockAudio, playPreview, stopPreview } from '../engines/audioEngine'
import { stopAllVoices } from '../engines/samplerEngine'
import { stopSequencer } from '../engines/sequencer'
import { setRecorder } from '../state/recorderStore'
import { decodeFile, friendlyAudioError } from '../engines/audioImport'
import { renderPracticeSample, PRACTICE_SAMPLES } from '../engines/demo/practiceSamples'
import { createProject } from '../engines/projectModel'
import { defaultProjectName } from '../engines/persistModel'
import { flushSave, saveSampleAudio } from './projectActions'
import { commit, getProject, replaceProject } from '../state/projectStore'
import { setUi, showToast } from '../state/uiStore'
import { notify, clearHits } from './learningActions'

const analyses = new Map() // sampleId → Promise<analysis>

export function goto(screen) {
  stopPreview()
  if (screen === 'home') stopSequencer()
  setUi({ screen })
}

/** Primer gesto del usuario: desbloquea el audio. Devuelve true si suena. */
export async function startAudio() {
  try {
    const state = await unlockAudio()
    return state === 'running'
  } catch (err) {
    showToast(friendlyAudioError(err, err?.message?.includes('Web Audio') ? 'unsupported' : 'unlock'), 'error')
    return false
  }
}

export function getActiveSample(project = getProject()) {
  return project.samples.find(s => s.id === project.activeSampleId) ?? null
}

/** El audio original del sample, sin ninguna transformación. */
export function getSourceBuffer(sampleId) {
  return getRuntime(sampleId)?.buffer ?? null
}

const lofiCache = new Map() // `${sampleId}|${ajustes}` → AudioBuffer degradado

/**
 * El audio TAL Y COMO SUENA: en Old School, degradado (bits, kHz, mono)
 * según la velocidad a la que se sampleó. Se calcula una vez y se cachea;
 * el original nunca se modifica.
 */
export function getPlayableBuffer(sampleId, project = getProject()) {
  const src = getSourceBuffer(sampleId)
  if (!src) return null
  const os = oldSchoolOf(project)
  if (!isLofi(os, src.sampleRate)) return src
  const sample = project.samples.find(s => s.id === sampleId)
  const key = `${sampleId}|${lofiKey(os, speedOf(sample))}`
  let buf = lofiCache.get(key)
  if (!buf) {
    const channels = []
    for (let c = 0; c < src.numberOfChannels; c++) channels.push(src.getChannelData(c))
    const out = degradeChannels(channels, src.sampleRate, { ...os, speed: speedOf(sample) })
    buf = getCtx().createBuffer(out.length, src.length, src.sampleRate)
    out.forEach((ch, i) => buf.copyToChannel(ch, i))
    lofiCache.set(key, buf)
  }
  return buf
}

export function getActiveBuffer(project = getProject()) {
  const s = getActiveSample(project)
  return s ? getPlayableBuffer(s.id, project) : null
}

/** Un chop listo para sonar: con la velocidad del disco de su sample. */
export function playableSlice(slice, project = getProject()) {
  const sample = project.samples.find(s => s.id === slice.sampleId)
  return { ...slice, speed: speedOf(sample) }
}

/** 33 ⇄ 45 rpm: a qué velocidad «sampleas» el disco (Old School). */
export function setSampleSpeed(speed) {
  const sample = getActiveSample()
  if (!sample || speedOf(sample) === speed) return
  commit(p => ({ ...p, samples: p.samples.map(s => s.id === sample.id ? { ...s, edits: { ...s.edits, speed } } : s) }))
  if (speed !== 1) notify({ type: 'rpm:45' })
}

/** Empieza un proyecto nuevo con este audio y lo analiza en segundo plano. */
function startWithBuffer(buffer, name, origin, extra = {}) {
  flushSave() // el proyecto anterior queda guardado tal cual
  stopPreview()
  stopSequencer()
  setRecorder({ take: null })
  stopAllVoices()
  clearHits()
  const sample = { ...createEditableSample({ name, buffer, source: origin.kind }), origin, ...extra }
  const prev = getProject()
  const project = createProject({ mode: prev.mode, name: defaultProjectName(name) })
  // Old School se activa a menudo antes de elegir disco: el proyecto nuevo lo hereda
  if (prev.settings?.oldSchool) project.settings = { ...project.settings, oldSchool: prev.settings.oldSchool }
  project.samples = [sample]
  project.activeSampleId = sample.id
  replaceProject(project)
  setUi({ screen: 'cut', selectedSliceId: null, chopTool: 'select', cutDraft: null })

  const job = analyzeSample(sample.id)
    .then(analysis => {
      commit(p => ({
        ...p,
        samples: p.samples.map(s => s.id === sample.id ? { ...s, analysis } : s),
      }), { undoable: false })
      return analysis
    })
    .catch(() => null) // el análisis es ayuda opcional: si falla, se puede cortar a mano
  analyses.set(sample.id, job)
  return sample
}

/**
 * Proyecto nuevo a partir de un resample: el audio ya es un loop exacto, así
 * que se corta entero y se va directo a trocearlo. Hereda tempo, modo y
 * ajustes Old School. Se guarda como WAV para poder reabrirlo.
 */
export async function startWithResample(buffer, from, bpm) {
  const baseName = from.samples.find(s => s.id === from.activeSampleId)?.name ?? 'beat'
  const name = `Resample de «${baseName}»`
  const sample = startWithBuffer(buffer, name, { kind: 'file', fileName: 'resample.wav', mime: 'audio/wav', resample: true }, { tempoHint: bpm })
  commit(p => ({
    ...p,
    name,
    mode: from.mode,
    bpm,
    settings: { ...p.settings, oldSchool: from.settings?.oldSchool, mix: from.settings?.mix },
    samples: p.samples.map(s => s.id === sample.id ? { ...s, edits: { ...s.edits, trimStart: 0, trimEnd: buffer.duration } } : s),
  }), { undoable: false })
  setUi({ screen: 'chop' })
  const { encodeWav } = await import('../engines/exportEngine')
  saveSampleAudio(sample.id, encodeWav(buffer), 'resample.wav')
  return sample
}

export function whenAnalyzed(sampleId) {
  return analyses.get(sampleId) ?? Promise.resolve(null)
}

export async function openPractice(id) {
  const meta = PRACTICE_SAMPLES.find(x => x.id === id)
  setUi({ busy: 'Preparando el disco…' })
  try {
    await startAudio()
    const buffer = await renderPracticeSample(id)
    startWithBuffer(buffer, meta.title, { kind: 'demo', demoId: id }, { tempoHint: meta.bpm })
  } catch {
    showToast('No he podido preparar este sample de práctica. Prueba con otro.', 'error')
  } finally {
    setUi({ busy: null })
  }
}

/** Escucha un disco de práctica desde el selector, sin abrirlo todavía. */
export async function auditionPractice(id) {
  try {
    await startAudio()
    playPreview(await renderPracticeSample(id))
  } catch {
    showToast('No he podido reproducir este sample.', 'error')
  }
}

export async function importAudioFile(file) {
  if (!file) return
  setUi({ busy: `Abriendo «${file.name}»…` })
  try {
    await startAudio()
    const buffer = await decodeFile(file, getCtx())
    const sample = startWithBuffer(buffer, file.name.replace(/\.[^.]+$/, ''), { kind: 'file', fileName: file.name, mime: file.type })
    saveSampleAudio(sample.id, file, file.name) // el archivo original, para poder reabrir el proyecto
  } catch (err) {
    showToast(err.message || friendlyAudioError(err), 'error')
  } finally {
    setUi({ busy: null })
  }
}

// ---------------------------------------------------------------- escuchar

export function previewRange(start, end, { loop = false } = {}) {
  const buffer = getActiveBuffer()
  if (!buffer) return
  const rate = speedOf(getActiveSample())
  playPreview(buffer, { offset: start, duration: Math.max(0.02, end - start), loop, rate })
}

export function previewAll(from = 0) {
  const buffer = getActiveBuffer()
  if (buffer) playPreview(buffer, { offset: Math.min(from, buffer.duration - 0.05), rate: speedOf(getActiveSample()) })
}

export { stopPreview }

// ---------------------------------------------------------------- cortar

/** "ESTE ES MI SAMPLE": fija el corte (no destructivo) y pasa al Chop Lab. */
export function confirmCut(start, end) {
  const sample = getActiveSample()
  if (!sample) return
  // defensa: un corte siempre es un tramo válido dentro de la grabación
  start = Math.max(0, Math.min(start, sample.duration))
  end = Math.max(0, Math.min(end, sample.duration))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.05) return
  // Old School: el sample tiene que caber en la memoria
  const mem = fitsInMemory(getProject(), end - start, speedOf(sample), sample.id)
  if (!mem.fits) {
    showToast(`No cabe: ocupa ${mem.need.toFixed(1).replace('.', ',')} s y te quedan ${mem.free.toFixed(1).replace('.', ',')} s de memoria. Acórtalo o samplea a 45 rpm.`, 'error')
    notify({ type: 'memory:full' })
    return
  }
  stopPreview()
  commit(p => ({
    ...p,
    samples: p.samples.map(s => s.id === sample.id
      ? { ...s, edits: { ...s.edits, trimStart: start, trimEnd: end } }
      : s),
  }))
  setUi({ screen: 'chop' })
  notify({ type: 'cut:confirmed' })
  if (end - start > 12) notify({ type: 'cut:long' })
}

/** Región cortada del sample activo (o todo el audio si aún no se ha cortado). */
export function cutRegion(sample) {
  if (!sample) return null
  return { start: sample.edits.trimStart, end: sample.edits.trimEnd ?? sample.duration }
}
