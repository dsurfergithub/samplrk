/**
 * ProgressPanel — «Sampling Basics»: qué conceptos has practicado.
 * Nunca puntúa la calidad musical: solo hechos objetivos (has usado pitch,
 * has grabado un pattern…). Aquí también se cambia de modo.
 */
import { useEffect, useRef, useState } from 'react'
import { ListChecks, Check, Circle, X, SkipForward, Clock } from 'lucide-react'
import { useLearning } from '../state/learningStore'
import { useProject } from '../state/projectStore'
import { checklist } from '../engines/missions'
import { setMode, resetProgress, goToCurrentMission } from '../actions/learningActions'
import { goto } from '../actions/sampleActions'

export default function ProgressPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const progress = useLearning(s => s.progress)
  const skipped = useLearning(s => s.skipped)
  const mode = useProject(p => p.mode)
  const items = checklist(progress, skipped)
  const counted = items.filter(i => !i.upcoming && !i.optional) // lo opcional no suma ni resta
  const doneCount = counted.filter(i => i.done).length
  const total = counted.length

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="progress" ref={ref}>
      <button className="btn btn-ghost progress-toggle" onClick={() => setOpen(o => !o)}
        aria-expanded={open} aria-controls="progress-panel" aria-label={`Progreso: ${doneCount} de ${total}`}>
        <ListChecks size={18} /> <span className="progress-count">{doneCount}/{total}</span>
      </button>
      {open && (
        <section id="progress-panel" className="progress-panel" aria-label="Sampling Basics">
          <header className="row">
            <h3>Sampling Basics</h3>
            <span className="spacer" />
            <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={16} /></button>
          </header>
          <ul>
            {items.map(i => (
              <li key={i.id} className={i.done ? 'is-done' : i.upcoming ? 'is-upcoming' : ''}>
                {i.done ? <Check size={16} /> : i.upcoming ? <Clock size={16} /> : i.skipped ? <SkipForward size={16} /> : <Circle size={16} />}
                <span>{i.label}</span>
                {i.skipped && <small>saltada</small>}
                {i.upcoming && <small>pronto</small>}
                {i.optional && <small>opcional</small>}
              </li>
            ))}
          </ul>
          <div className="progress-mode">
            <span className="insp-label">Modo</span>
            <div className="segmented" role="radiogroup" aria-label="Modo">
              <button role="radio" aria-checked={mode === 'learning'} className={`btn${mode === 'learning' ? ' is-on' : ''}`}
                onClick={() => { setMode('learning'); goToCurrentMission(); setOpen(false) }}>Aprendizaje</button>
              <button role="radio" aria-checked={mode === 'free'} className={`btn${mode === 'free' ? ' is-on' : ''}`}
                onClick={() => setMode('free')}>Libre</button>
            </div>
          </div>
          <p className="progress-note">
            {mode === 'learning' ? 'Misiones cortas, una cada vez. Puedes saltarlas o experimentar cuando quieras.'
              : 'Todo disponible, sin misiones. El coach está apagado (lo puedes encender con la bombilla).'}
          </p>
          <div className="row">
            <button className="link-btn" onClick={() => { goto('oldschool'); setOpen(false) }}>Modo Old School →</button>
            <span className="spacer" />
            <button className="link-btn" onClick={resetProgress}>Reiniciar progreso</button>
          </div>
        </section>
      )}
    </div>
  )
}
