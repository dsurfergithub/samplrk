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
  const patterns = useProject(p => p.patterns)
  const take = useRecorder(s => s.take)
  const phase = useSequencerPhase()
  const hasEvents = !!take?.events.length || patterns.some(x => x.events.length)
  if (!hasEvents && phase === 'idle') return null
  const rec = phase === 'countin' || phase === 'recording'
  return (
    <button className={`btn btn-ghost btn-icon transport-mini${rec ? ' is-rec' : phase === 'playing' ? ' is-playing' : ''}`}
      onClick={togglePlay} disabled={rec} aria-label={phase === 'idle' ? 'Reproducir pattern' : 'Parar pattern'}
      title={phase === 'idle' ? 'Reproducir pattern' : 'Parar'}>
      {phase === 'idle' ? <Play size={18} /> : <Square size={16} />}
    </button>
  )
}
