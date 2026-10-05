/**
 * TransportMini — play/stop del pattern siempre a mano (también en móvil):
 * puedes dejarlo sonando y volver al Chop Lab a cambiar pitch o reverse.
 */
import { Play, Square } from 'lucide-react'
import { useProject } from '../state/projectStore'
import { useRecorder } from '../state/recorderStore'
import { togglePlay } from '../actions/patternActions'
import { useSequencerPhase } from './hooks'

export default function TransportMini() {
  const saved = useProject(p => p.patterns[0])
  const take = useRecorder(s => s.take)
  const phase = useSequencerPhase()
  const pattern = take ?? saved
  if (!pattern?.events.length && phase === 'idle') return null
  const rec = phase === 'countin' || phase === 'recording'
  return (
    <button className={`btn btn-ghost btn-icon transport-mini${rec ? ' is-rec' : phase === 'playing' ? ' is-playing' : ''}`}
      onClick={togglePlay} disabled={rec} aria-label={phase === 'idle' ? 'Reproducir pattern' : 'Parar pattern'}
      title={phase === 'idle' ? 'Reproducir pattern' : 'Parar'}>
      {phase === 'idle' ? <Play size={18} /> : <Square size={16} />}
    </button>
  )
}
