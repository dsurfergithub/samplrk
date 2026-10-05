/**
 * projectActions.js — guardar, abrir y recuperar proyectos (local-first).
 *
 * Autoguardado: cada cambio del proyecto programa un guardado (700 ms);
 * al salir de la página se guarda al momento. Se guarda el JSON del
 * proyecto y, aparte, el archivo de audio importado; nunca AudioBuffer.
 * Al abrir, el audio se reconstruye: los discos de práctica se regeneran
 * y los archivos se vuelven a decodificar.
 */
import * as DB from '../engines/persistenceEngine'
import {
  projectRecord, isWorthSaving, learningSnapshot, restoreLearning,
} from '../engines/persistModel'
import { migrateProject, createProject } from '../engines/projectModel'
import { registerBuffer, getRuntime } from '../engines/sampleEngine'
import { renderPracticeSample } from '../engines/demo/practiceSamples'
import { getCtx, stopPreview } from '../engines/audioEngine'
import { stopAllVoices } from '../engines/samplerEngine'
import { stopSequencer } from '../engines/sequencer'
import { setMetronomeVolume, getMetronomeVolume } from '../engines/metronomeEngine'
import { subscribeProject, getProject, replaceProject, commit } from '../state/projectStore'
import { getUi, setUi, subscribeUi, showToast } from '../state/uiStore'
import { getLearning, setLearning, subscribeLearning } from '../state/learningStore'
import { getRecorder, setRecorder, subscribeRecorder } from '../state/recorderStore'
import { clearHits } from './learningActions'
import { applyMix } from './mixActions'

const SAVE_DELAY = 400
let lastSaved = null       // última versión del proyecto guardada (referencia)
let timer = null
let errorShown = false
let started = false
let booted = false

function setSave(status, extra = {}) { setUi({ save: { status, at: Date.now(), ...extra } }) }

// ---------------------------------------------------------------- guardar

export async function saveNow() {
  clearTimeout(timer); timer = null
  const p = getProject()
  if (!isWorthSaving(p) || p === lastSaved) return
  setSave('saving')
  try {
    await DB.putProjectRecord(projectRecord(p))
    await DB.setMeta('lastProjectId', p.id)
    lastSaved = p
    errorShown = false
    setSave('saved')
    refreshProjects()
  } catch (err) {
    setSave('error', { message: err.message })
    if (!errorShown) { showToast(err.message, 'error'); errorShown = true }
  }
}

function scheduleSave() {
  clearTimeout(timer)
  // honesto: en cuanto hay un cambio sin guardar, el indicador lo dice
  if (isWorthSaving(getProject()) && getUi().save.status !== 'saving') setSave('pending')
  timer = setTimeout(saveNow, SAVE_DELAY)
}

/** Guarda ya lo pendiente (antes de cambiar de proyecto o al salir). */
export function flushSave() { if (timer) return saveNow() }

let metaTimer = null
function scheduleMeta() {
  clearTimeout(metaTimer)
  metaTimer = setTimeout(saveMeta, 400)
}

async function saveMeta() {
  try {
    await DB.setMeta('learning', learningSnapshot(getLearning()))
    const r = getRecorder()
    await DB.setMeta('prefs', { bars: r.bars, countIn: r.countIn, metronome: r.metronome, metronomeVolume: getMetronomeVolume() })
    const p = getProject()
    const ui = getUi()
    if (isWorthSaving(p)) await DB.setMeta(`ui:${p.id}`, { screen: ui.screen, selectedSliceId: ui.selectedSliceId })
  } catch { /* lo esencial es el proyecto: su error ya se avisa */ }
}

/** Guarda el archivo original de un audio importado (no el AudioBuffer). */
export async function saveSampleAudio(sampleId, blob, name) {
  try { await DB.putAudio(sampleId, blob, name) } catch (err) { showToast(err.message, 'error') }
}

export async function refreshProjects() {
  try { setUi({ projects: await DB.listProjectRecords() }) } catch { /* sin lista */ }
}

function startAutosave() {
  if (started) return
  started = true
  subscribeProject(() => { if (getProject() !== lastSaved) scheduleSave() })
  subscribeLearning(scheduleMeta)
  subscribeRecorder(scheduleMeta)
  let lastScreen = getUi().screen, lastSel = getUi().selectedSliceId
  subscribeUi(() => {
    const { screen, selectedSliceId } = getUi()
    // cambiar de pantalla es raro y decide dónde vuelves al recargar: se guarda ya
    if (screen !== lastScreen) { lastScreen = screen; lastSel = selectedSliceId; saveMeta(); return }
    if (selectedSliceId !== lastSel) { lastSel = selectedSliceId; scheduleMeta() }
  })
  const flushAll = () => { flushSave(); saveMeta() }
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll() })
}

// ---------------------------------------------------------------- abrir

async function bufferFor(sample) {
  if (sample.origin?.kind === 'demo') return renderPracticeSample(sample.origin.demoId)
  const a = await DB.getAudio(sample.id)
  if (!a?.blob) throw new Error('No encuentro el audio de este proyecto en el navegador.')
  try {
    return await getCtx().decodeAudioData(await a.blob.arrayBuffer())
  } catch {
    throw new Error('No he podido volver a abrir el audio de este proyecto.')
  }
}

/** Abre un proyecto guardado y vuelve a la pantalla donde lo dejaste. */
export async function openProject(id) {
  const current = getProject()
  if (current.id === id && current.samples.every(s => getRuntime(s.id))) {
    const ui = await DB.getMeta(`ui:${id}`).catch(() => null)
    setUi({ screen: ui?.screen && ui.screen !== 'home' ? ui.screen : 'chop' })
    return true
  }
  await flushSave()
  setUi({ busy: 'Abriendo tu proyecto…' })
  try {
    const rec = await DB.getProjectRecord(id)
    if (!rec) throw new Error('Este proyecto ya no existe.')
    const project = migrateProject(rec.json)
    for (const s of project.samples) registerBuffer(s.id, await bufferFor(s))
    stopPreview(); stopSequencer(); stopAllVoices(); clearHits()
    setRecorder({ take: null })
    lastSaved = project
    replaceProject(project)
    applyMix(project)
    const ui = await DB.getMeta(`ui:${id}`).catch(() => null)
    const fallback = project.slices.length ? 'chop' : 'cut'
    setUi({
      screen: ui?.screen && ui.screen !== 'home' ? ui.screen : fallback,
      selectedSliceId: ui?.selectedSliceId ?? null, chopTool: 'select',
    })
    await DB.setMeta('lastProjectId', id)
    return true
  } catch (err) {
    showToast(err.message || 'No he podido abrir el proyecto.', 'error')
    return false
  } finally {
    setUi({ busy: null })
  }
}

/**
 * Proyecto nuevo y vacío (Empezar / Modo libre desde el inicio). El anterior
 * queda guardado tal cual en «Mis proyectos»; el vacío no se guarda hasta
 * que tenga audio.
 */
export function newProject(mode) {
  flushSave()
  stopPreview(); stopSequencer(); stopAllVoices(); clearHits()
  setRecorder({ take: null })
  const fresh = createProject({ mode })
  lastSaved = fresh
  replaceProject(fresh)
  applyMix(fresh)
  setUi({ selectedSliceId: null, chopTool: 'select' })
}

// ---------------------------------------------------------------- gestionar

export async function renameProject(id, name) {
  const clean = name.trim().slice(0, 60)
  if (!clean) return
  if (getProject().id === id) { commit(p => ({ ...p, name: clean }), { undoable: false }); return }
  try {
    const rec = await DB.getProjectRecord(id)
    if (!rec) return
    const project = { ...migrateProject(rec.json), name: clean }
    await DB.putProjectRecord(projectRecord(project, rec.updatedAt))
    refreshProjects()
  } catch (err) { showToast(err.message, 'error') }
}

export async function deleteProject(id) {
  try {
    const rec = await DB.getProjectRecord(id)
    if (rec) {
      const project = migrateProject(rec.json)
      for (const s of project.samples) if (s.origin?.kind === 'file') await DB.deleteAudio(s.id)
    }
    await DB.deleteProjectRecord(id)
    await DB.deleteMeta(`ui:${id}`)
    if ((await DB.getMeta('lastProjectId')) === id) await DB.deleteMeta('lastProjectId')
    if (getProject().id === id) {
      stopSequencer()
      const fresh = createProject({ mode: getProject().mode })
      lastSaved = fresh
      replaceProject(fresh)
    }
    refreshProjects()
  } catch (err) { showToast(err.message, 'error') }
}

// ---------------------------------------------------------------- arranque

/**
 * Al cargar la app: recupera aprendizaje y preferencias y, si la última vez
 * estabas dentro de un proyecto, te devuelve exactamente ahí.
 */
export async function bootPersistence() {
  if (booted) return // StrictMode monta dos veces en desarrollo
  booted = true
  if (!DB.isPersistenceAvailable()) { setSave('unavailable'); return }
  try {
    const learning = await DB.getMeta('learning')
    if (learning) setLearning(s => restoreLearning(s, learning))
    const prefs = await DB.getMeta('prefs')
    if (prefs) {
      setRecorder({ bars: prefs.bars ?? 2, countIn: prefs.countIn ?? true, metronome: !!prefs.metronome })
      if (typeof prefs.metronomeVolume === 'number') setMetronomeVolume(prefs.metronomeVolume)
    }
    await refreshProjects()
    const last = await DB.getMeta('lastProjectId')
    if (last && getUi().projects.some(p => p.id === last)) {
      const ui = await DB.getMeta(`ui:${last}`)
      if (ui?.screen && ui.screen !== 'home' && getUi().screen === 'home') await openProject(last)
    }
    DB.requestPersistentStorage()
  } catch (err) {
    setSave('unavailable', { message: err.message })
  } finally {
    startAutosave()
  }
}
