import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useProject } from '../state/projectStore'
import { getActiveBuffer } from '../actions/sampleActions'
import { subscribePreview, isPreviewing, previewPosition, getCtx } from '../engines/audioEngine'
import { activeVoices, subscribeSampler } from '../engines/samplerEngine'
import { shouldIgnoreKey, padForCode } from '../engines/keyboardMap'
import { hitPad, auditionPad } from '../actions/samplerActions'
import { togglePlay } from '../actions/patternActions'
import { toggleGridPlay } from '../actions/gridActions'
import { hitDrum } from '../actions/drumActions'
import { drumForCode } from '../engines/drumKit'
import { subscribeSequencer, getSequencerSnapshot } from '../engines/sequencer'
import { undo, redo } from '../state/projectStore'
import { getUi } from '../state/uiStore'

/**
 * El buffer del sample activo tal y como suena (cambia si activas Old School
 * o pasas de 33 a 45 rpm).
 */
export function useActiveBuffer() {
  const sampleId = useProject(p => p.activeSampleId)
  const os = useProject(p => p.settings?.oldSchool)
  const speed = useProject(p => p.samples.find(s => s.id === p.activeSampleId)?.edits?.speed)
  return useMemo(() => getActiveBuffer(), [sampleId, os, speed])
}

/** ¿Está sonando la preescucha? (cambia pocas veces: React está bien aquí). */
export function usePreviewing() {
  return useSyncExternalStore(subscribePreview, isPreviewing)
}

/** Fase del secuenciador (idle/countin/recording/playing). Cambia pocas veces. */
export function useSequencerPhase() {
  return useSyncExternalStore(subscribeSequencer, () => getSequencerSnapshot().phase)
}

/**
 * Enciende el pad que suena tocando el DOM directamente (clase `is-hit` y
 * `--hit-ms`): tocar rápido no provoca re-renders. `els.current[i]` = elemento
 * del pad i. Los golpes de un pattern se programan por adelantado, así que el
 * destello espera a que suenen.
 */
export function usePadFlash(els) {
  const timers = useRef([])
  useEffect(() => {
    const off = subscribeSampler((ev) => {
      if (typeof ev.padKey !== 'number' || ev.type !== 'start') return
      const el = els.current[ev.padKey]
      if (!el) return
      const ms = Math.max(80, (ev.endAt - ev.startAt) * 1000)
      const delay = Math.max(0, (ev.startAt - getCtx().currentTime) * 1000)
      const k = ev.padKey
      clearTimeout(timers.current[k])
      timers.current[k] = setTimeout(() => {
        el.style.setProperty('--hit-ms', `${ms}ms`)
        el.classList.remove('is-hit')
        void el.offsetWidth // reinicia la animación al re-disparar
        el.classList.add('is-hit')
        timers.current[k] = setTimeout(() => el.classList.remove('is-hit'), ms + 60)
      }, delay)
    })
    return () => { off(); timers.current.forEach(clearTimeout) }
  }, [])
}

/** Para Waveform.getLive: playhead de la preescucha + chops sonando. */
export function liveState() {
  const heads = []
  const p = previewPosition()
  if (p !== null) heads.push({ t: p })
  const active = new Set()
  for (const v of activeVoices()) active.add(v.sliceId)
  return { heads, active }
}

/** Atajos globales: teclas → pads (en el Chop Lab) y deshacer/rehacer. */
export function useGlobalKeys() {
  useEffect(() => {
    const onKey = (ev) => {
      const mod = ev.metaKey || ev.ctrlKey
      if (mod && ev.code === 'KeyZ' && !isTyping(ev)) {
        ev.preventDefault()
        ev.shiftKey ? redo() : undo()
        return
      }
      if (mod && ev.code === 'KeyY' && !isTyping(ev)) { ev.preventDefault(); redo(); return }
      const screen = getUi().screen
      if (!['chop', 'grid', 'record', 'drums', 'beat'].includes(screen)) return
      if (ev.code === 'Space' && ev.target === document.body && screen !== 'chop') { ev.preventDefault(); screen === 'grid' ? toggleGridPlay() : togglePlay(); return }
      if (ev.repeat || shouldIgnoreKey(ev)) return
      if (screen === 'drums') {
        const d = drumForCode(ev.code)
        if (d) { ev.preventDefault(); hitDrum(d.id) }
        return
      }
      if (screen === 'beat') return
      const i = padForCode(ev.code)
      // en la rejilla las teclas solo sirven para oír un chop, no para anotarlo
      if (i >= 0) { ev.preventDefault(); screen === 'grid' ? auditionPad(i) : hitPad(i) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function isTyping(ev) {
  const tag = ev.target?.tagName
  return (tag === 'INPUT' && ev.target.type !== 'range') || tag === 'TEXTAREA'
}
