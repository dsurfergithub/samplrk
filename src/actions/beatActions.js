/**
 * beatActions.js — BEAT: escuchar y exportar el resultado.
 */
import { renderBeat } from '../engines/beatRenderer'
import { loadDrumKit } from '../engines/drumKit'
import { encodeWav, download } from '../engines/exportEngine'
import { getProject } from '../state/projectStore'
import { setUi, showToast } from '../state/uiStore'
import { getPlayableBuffer, playableSlice, startWithResample } from './sampleActions'
import { getBpm } from './patternActions'
import { notify } from './learningActions'

export async function exportBeatWav(loops = 1) {
  const p = getProject()
  setUi({ busy: 'Preparando tu WAV…' })
  try {
    await loadDrumKit()
    const bpm = getBpm(p)
    const buffer = await renderBeat(p, { bpm, loops, chopVoice: (s) => ({ buffer: getPlayableBuffer(s.sampleId, p), slice: playableSlice(s, p) }) })
    download(encodeWav(buffer), `samplrk-beat-${Math.round(bpm)}bpm${loops > 1 ? `-x${loops}` : ''}.wav`)
    notify({ type: 'beat:exported' })
    showToast('Beat exportado a WAV.')
  } catch (err) {
    showToast(err.message?.includes('nada') ? err.message : 'No he podido exportar el beat. Inténtalo de nuevo.', 'error')
  } finally {
    setUi({ busy: null })
  }
}

/**
 * RESAMPLE: tu beat (una vuelta, tal y como suena) se convierte en un sample
 * nuevo que puedes volver a cortar y trocear. Se crea un proyecto nuevo con
 * él; el original queda intacto en «Mis proyectos».
 */
export async function resampleBeat() {
  const p = getProject()
  setUi({ busy: 'Resampleando tu beat…' })
  try {
    await loadDrumKit()
    const bpm = getBpm(p)
    const buffer = await renderBeat(p, { bpm, loops: 1, chopVoice: (s) => ({ buffer: getPlayableBuffer(s.sampleId, p), slice: playableSlice(s, p) }) })
    await startWithResample(buffer, p, bpm)
    notify({ type: 'resample:done' })
  } catch (err) {
    showToast(err.message?.includes('nada') ? err.message : 'No he podido resamplear el beat.', 'error')
  } finally {
    setUi({ busy: null })
  }
}
