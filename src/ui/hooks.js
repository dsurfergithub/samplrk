import { useEffect, useSyncExternalStore } from 'react'
import { subscribePreview, isPreviewing, previewPosition } from '../engines/audioEngine'
import { activeVoices } from '../engines/samplerEngine'
import { shouldIgnoreKey, padForCode } from '../engines/keyboardMap'
import { hitPad } from '../actions/samplerActions'
import { togglePlay } from '../actions/patternActions'
import { hitDrum } from '../actions/drumActions'
import { drumForCode } from '../engines/drumKit'
import { subscribeSequencer, getSequencerSnapshot } from '../engines/sequencer'
import { undo, redo } from '../state/projectStore'
import { getUi } from '../state/uiStore'

/** ¿Está sonando la preescucha? (cambia pocas veces: React está bien aquí). */
export function usePreviewing() {
  return useSyncExternalStore(subscribePreview, isPreviewing)
}

/** Fase del secuenciador (idle/countin/recording/playing). Cambia pocas veces. */
export function useSequencerPhase() {
  return useSyncExternalStore(subscribeSequencer, () => getSequencerSnapshot().phase)
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
      if (!['chop', 'record', 'drums', 'beat'].includes(screen)) return
      if (ev.code === 'Space' && ev.target === document.body && screen !== 'chop') { ev.preventDefault(); togglePlay(); return }
      if (ev.repeat || shouldIgnoreKey(ev)) return
      if (screen === 'drums') {
        const d = drumForCode(ev.code)
        if (d) { ev.preventDefault(); hitDrum(d.id) }
        return
      }
      if (screen === 'beat') return
      const i = padForCode(ev.code)
      if (i >= 0) { ev.preventDefault(); hitPad(i) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function isTyping(ev) {
  const tag = ev.target?.tagName
  return (tag === 'INPUT' && ev.target.type !== 'range') || tag === 'TEXTAREA'
}
