/**
 * sampleActions.js — elegir audio, escucharlo y cortar el fragmento (FIND + CUT).
 */
import { createEditableSample, getRuntime } from '../engines/sampleEngine'
import { analyzeSample } from '../engines/analysisEngine'
import { getCtx, unlockAudio, playPreview, stopPreview } from '../engines/audioEngine'
import { stopAllVoices } from '../engines/samplerEngine'
import { stopSequencer } from '../engines/sequencer'
import { setRecorder } from '../state/recorderStore'
import { decodeFile, friendlyAudioError } from '../engines/audioImport'
import { renderPracticeSample, PRACTICE_SAMPLES } from '../engines/demo/practiceSamples'
import { createProject } from '../engines/projectModel'
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

export function getActiveBuffer(project = getProject()) {
  const s = getActiveSample(project)
  return s ? getRuntime(s.id)?.buffer ?? null : null
}

/** Empieza un proyecto nuevo con este audio y lo analiza en segundo plano. */
function startWithBuffer(buffer, name, origin, extra = {}) {
  stopPreview()
  stopSequencer()
  setRecorder({ take: null })
  stopAllVoices()
  clearHits()
  const sample = { ...createEditableSample({ name, buffer, source: origin.kind }), origin, ...extra }
  const project = createProject()
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
    startWithBuffer(buffer, file.name.replace(/\.[^.]+$/, ''), { kind: 'file', fileName: file.name, mime: file.type })
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
  playPreview(buffer, { offset: start, duration: Math.max(0.02, end - start), loop })
}

export function previewAll(from = 0) {
  const buffer = getActiveBuffer()
  if (buffer) playPreview(buffer, { offset: Math.min(from, buffer.duration - 0.05) })
}

export { stopPreview }

// ---------------------------------------------------------------- cortar

/** "ESTE ES MI SAMPLE": fija el corte (no destructivo) y pasa al Chop Lab. */
export function confirmCut(start, end) {
  const sample = getActiveSample()
  if (!sample) return
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
