/**
 * beatActions.js — BEAT: escuchar y exportar el resultado.
 */
import { renderBeat } from '../engines/beatRenderer'
import { loadDrumKit } from '../engines/drumKit'
import { encodeWav, download } from '../engines/exportEngine'
import { getProject } from '../state/projectStore'
import { setUi, showToast } from '../state/uiStore'
import { getActiveBuffer } from './sampleActions'
import { getBpm } from './patternActions'
import { notify } from './learningActions'

export async function exportBeatWav(loops = 1) {
  const p = getProject()
  setUi({ busy: 'Preparando tu WAV…' })
  try {
    await loadDrumKit()
    const bpm = getBpm(p)
    const buffer = await renderBeat(p, { bpm, loops, sampleBuffer: getActiveBuffer(p) })
    download(encodeWav(buffer), `samplrk-beat-${Math.round(bpm)}bpm${loops > 1 ? `-x${loops}` : ''}.wav`)
    notify({ type: 'beat:exported' })
    showToast('Beat exportado a WAV.')
  } catch (err) {
    showToast(err.message?.includes('nada') ? err.message : 'No he podido exportar el beat. Inténtalo de nuevo.', 'error')
  } finally {
    setUi({ busy: null })
  }
}
