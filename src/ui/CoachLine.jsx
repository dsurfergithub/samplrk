/**
 * CoachLine — la única voz del coach: una frase, después de la acción.
 * Siempre se puede cerrar o ignorar.
 */
import { X, Lightbulb, GraduationCap } from 'lucide-react'
import { useLearning } from '../state/learningStore'
import { dismissMessage } from '../actions/learningActions'

export default function CoachLine() {
  const msg = useLearning(s => s.message)
  const enabled = useLearning(s => s.coachEnabled)
  if (!msg || !enabled) return null
  const learned = msg.kind === 'learned'
  return (
    <div className={`coach${learned ? ' is-learned' : ''}`} role="status" aria-live="polite" key={msg.id}>
      {learned ? <GraduationCap size={18} className="coach-icon" /> : <Lightbulb size={18} className="coach-icon" />}
      <p className="coach-text">
        {learned && msg.term && <span className="coach-term">Nuevo: {msg.term}</span>}
        {msg.text}
      </p>
      <button className="btn btn-ghost btn-icon" onClick={dismissMessage} aria-label="Cerrar consejo"><X size={16} /></button>
    </div>
  )
}
