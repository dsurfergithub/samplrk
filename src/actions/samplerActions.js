/**
 * samplerActions.js — CHOP + PLAY: crear y editar chops, tocar pads,
 * pitch y reverse por chop. Todo deshacible.
 */
import * as SM from '../engines/sliceModel'
import { clampPitch } from '../engines/pitch'
import { triggerSlice } from '../engines/samplerEngine'
import { commit, getProject } from '../state/projectStore'
import { getUi, setUi, showToast } from '../state/uiStore'
import { getActiveSample, getActiveBuffer, cutRegion, whenAnalyzed } from './sampleActions'
import { notify, recordHit } from './learningActions'
import { captureHit } from './patternActions'

// ---------------------------------------------------------------- helpers

const bank = (p) => p.padBanks[0]

function withBank(p, pads) {
  return { ...p, padBanks: p.padBanks.map((b, i) => i === 0 ? { ...b, pads } : b) }
}

export function sliceById(id, p = getProject()) { return p.slices.find(s => s.id === id) ?? null }

function select(id) { if (getUi().selectedSliceId !== id) setUi({ selectedSliceId: id }) }

// ---------------------------------------------------------------- crear chops

/**
 * Sugerencias de corte: 4 / 8 / 16 partes iguales, 'hits' (en los golpes) o
 * 'manual' (un único trozo; el usuario corta tocando la onda).
 * Sustituye los chops del sample activo.
 */
export async function createChops(mode) {
  const sample = getActiveSample()
  if (!sample) return
  const { start, end } = cutRegion(sample)
  let slices

  if (mode === 'hits') {
    let analysis = sample.analysis
    if (!analysis) {
      setUi({ busy: 'Escuchando dónde están los golpes…' })
      analysis = await whenAnalyzed(sample.id)
      setUi({ busy: null })
    }
    slices = SM.slicesFromHits(sample.id, start, end, analysis?.transients ?? [], 16)
    if (slices.length < 2) {
      showToast('No encuentro golpes claros en este fragmento. Prueba con 8 cortes iguales o corta tú.')
      return
    }
  } else if (mode === 'manual') {
    slices = SM.equalSlices(sample.id, start, end, 1)
  } else {
    slices = SM.equalSlices(sample.id, start, end, mode)
  }

  commit(p => withBank({
    ...p,
    slices: [...p.slices.filter(s => s.sampleId !== sample.id), ...slices],
  }, SM.padsInTimeOrder(slices)))
  setUi({ selectedSliceId: slices[0].id, chopTool: mode === 'manual' ? 'cut' : 'select' })
  if (mode !== 'manual') notify({ type: 'chops:created', count: slices.length })
  if (slices.length > 8) notify({ type: 'chops:many' })
}

/** Borra todos los chops del sample activo (vuelve a la pregunta inicial). */
export function clearChops() {
  const sample = getActiveSample()
  if (!sample) return
  commit(p => withBank({ ...p, slices: p.slices.filter(s => s.sampleId !== sample.id) }, SM.emptyPads()))
  setUi({ selectedSliceId: null, chopTool: 'select' })
}

// ---------------------------------------------------------------- editar chops

/** Divide el chop que contiene `t` (modo "Yo corto") o el seleccionado por la mitad. */
export function splitAt(t = null, sliceId = null) {
  const p = getProject()
  const target = sliceId ? sliceById(sliceId, p) : SM.sliceAt(p.slices, t)
  if (!target) return
  if (p.slices.length >= SM.MAX_PADS) { showToast('Ya tienes 16 chops: es el máximo de pads.'); return }
  const r = SM.splitSlice(p.slices, target.id, t)
  if (!r) { showToast('Ese trozo es demasiado corto para dividirlo.'); return }
  const from = SM.padIndexOf(bank(p).pads, target.id)
  commit(q => withBank({ ...q, slices: r.slices }, SM.placeInPads(bank(q).pads, r.created.id, from)))
  const count = r.slices.length
  if (count === 2 && getUi().chopTool === 'cut') notify({ type: 'chops:created', count })
}

export function mergeWithNext(sliceId) {
  const p = getProject()
  const r = SM.mergeWithNext(p.slices, sliceId)
  if (!r) { showToast('No hay un chop pegado a la derecha para unir.'); return }
  commit(q => withBank({ ...q, slices: r.slices }, SM.removeFromPads(bank(q).pads, r.removed.id)))
  select(sliceId)
}

export function deleteSlice(sliceId) {
  commit(q => withBank({ ...q, slices: SM.removeSlice(q.slices, sliceId) }, SM.removeFromPads(bank(q).pads, sliceId)))
  const left = getProject().slices.filter(s => s.sampleId === getProject().activeSampleId)
  select(left[0]?.id ?? null)
}

export function moveSliceEdge(sliceId, edge, t) {
  const sample = getActiveSample()
  const { start, end } = cutRegion(sample)
  commit(q => ({ ...q, slices: SM.moveEdge(q.slices, sliceId, edge, t, { min: start, max: end }) }),
    { key: `edge:${sliceId}:${edge}` })
}

export function updateSliceProps(sliceId, patch, key = null) {
  commit(q => ({ ...q, slices: SM.updateSlice(q.slices, sliceId, patch) }), { key })
}

export function renameSlice(sliceId, name) {
  updateSliceProps(sliceId, { name: name.slice(0, 24) }, `name:${sliceId}`)
}

export function setSlicePitch(sliceId, semitones) {
  const v = clampPitch(semitones)
  const s = sliceById(sliceId)
  if (!s || s.pitch === v) return
  updateSliceProps(sliceId, { pitch: v }, `pitch:${sliceId}`)
  notify({ type: 'pitch:changed', semitones: v })
}

export function toggleReverse(sliceId) {
  const s = sliceById(sliceId)
  if (!s) return
  updateSliceProps(sliceId, { reversed: !s.reversed })
  if (!s.reversed) notify({ type: 'reverse:on' })
}

export function setSliceGain(sliceId, gain) {
  updateSliceProps(sliceId, { gain: Math.max(0, Math.min(2, gain)) }, `gain:${sliceId}`)
}

export function resetSlice(sliceId) {
  updateSliceProps(sliceId, { pitch: 0, gain: 1, reversed: false, name: '' })
}

/** Mueve un chop a otro pad (intercambia con el vecino). `dir` = −1 / +1. */
export function movePad(sliceId, dir) {
  const pads = bank(getProject()).pads
  const i = SM.padIndexOf(pads, sliceId)
  if (i < 0) return
  commit(q => withBank(q, SM.swapPads(bank(q).pads, i, i + dir)))
}

/** Vuelve a ordenar los pads como en la grabación (A = primer trozo). */
export function sortPadsByTime() {
  const sample = getActiveSample()
  commit(q => withBank(q, SM.padsInTimeOrder(q.slices.filter(s => s.sampleId === sample?.id))))
}

// ---------------------------------------------------------------- tocar

/** Toca el pad `index`. Camino crítico: sin esperas, sin React antes del audio. */
export function hitPad(index, velocity = 1) {
  const p = getProject()
  const id = bank(p).pads[index]
  if (!id) return
  const slice = sliceById(id, p)
  const buffer = getActiveBuffer(p)
  if (!slice || !buffer) return
  const voice = triggerSlice(buffer, slice, { padKey: index, velocity })
  // después del sonido: grabación (si la hay), selección y coach
  if (voice) captureHit(index, voice.startAt, voice.endAt - voice.startAt)
  select(id)
  recordHit(index)
  notify({ type: 'pad:hit', pad: index })
}

/** Toca el chop `sliceId` (clic en su segmento de la onda). */
export function hitSlice(sliceId) {
  const p = getProject()
  const i = SM.padIndexOf(bank(p).pads, sliceId)
  if (i >= 0) { hitPad(i); return }
  const slice = sliceById(sliceId, p)
  const buffer = getActiveBuffer(p)
  if (slice && buffer) triggerSlice(buffer, slice, { padKey: `slice:${sliceId}` })
  select(sliceId)
}
