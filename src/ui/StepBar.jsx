/**
 * StepBar — el recorrido, mostrado con discreción. Los pasos disponibles se
 * pueden visitar en cualquier orden (sandbox); los de fases futuras aparecen
 * apagados para que se vea hacia dónde vamos.
 */
import { useProject } from '../state/projectStore'
import { useUi } from '../state/uiStore'
import { useLearning } from '../state/learningStore'
import { goto } from '../actions/sampleActions'

const STEPS = [
  { id: 'find', label: 'Find', screen: 'source', done: 'findComplete' },
  { id: 'cut', label: 'Cut', screen: 'cut', done: 'cutComplete', needs: 'sample' },
  { id: 'chop', label: 'Chop', screen: 'chop', done: 'chopComplete', needs: 'sample' },
  { id: 'play', label: 'Play', screen: 'chop', done: 'playComplete', needs: 'sample' },
  { id: 'record', label: 'Record', screen: 'record', done: 'recordComplete', needs: 'sample' },
  { id: 'flip', label: 'Flip', screen: 'chop', done: 'flipComplete', needs: 'sample' },
  { id: 'drums', label: 'Drums' },
]

const CURRENT = { source: 'find', cut: 'cut', chop: 'chop', record: 'record' }

export default function StepBar() {
  const screen = useUi(s => s.screen)
  const hasSample = useProject(p => p.activeSampleId !== null)
  const progress = useLearning(s => s.progress)
  const current = CURRENT[screen]
  const idx = STEPS.findIndex(s => s.id === current)

  return (
    <>
      <nav className="steps" aria-label="Recorrido">
        {STEPS.map((s, i) => {
          const available = s.screen && (!s.needs || hasSample)
          return (
            <button key={s.id} disabled={!available}
              className={`step${s.id === current ? ' is-current' : ''}${s.done && progress[s.done] ? ' is-done' : ''}`}
              onClick={() => available && goto(s.screen)}
              aria-current={s.id === current ? 'step' : undefined}
              title={available ? undefined : 'Próximamente'}>
              <i>{s.done && progress[s.done] ? '✓' : i + 1}</i>{s.label}
            </button>
          )
        })}
      </nav>
      {idx >= 0 && <span className="steps-compact">{idx + 1}/{STEPS.length} · {STEPS[idx].label}</span>}
    </>
  )
}
