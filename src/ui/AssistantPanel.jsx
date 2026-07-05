import { useMemo } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useStore } from '../state/store'
import { getSuggestions } from '../engines/aiAssistant'
import { analyze, trimSilence, generateLoops, autoSlice, gotoView } from '../app/actions'

const ACTIONS = { analyze, trimSilence, generateLoops, autoSlice, gotoView }

export default function AssistantPanel({ open, onClose }) {
  const state = useStore(s => s)
  const suggestions = useMemo(() => getSuggestions(state, ACTIONS), [state])

  return (
    <aside className={`assistant${open ? ' open' : ''}`}>
      <h3>
        <Sparkles size={15} /> ASISTENTE
        <button
          className="btn btn-icon" style={{ marginLeft: 'auto', display: open ? undefined : 'none' }}
          onClick={onClose} aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      </h3>
      <div className="tagline">Sugiere, explica el motivo y tú decides. Nunca toca nada sin ti.</div>
      {suggestions.map(sug => (
        <div key={sug.id} className="suggestion">
          <b>{sug.title}</b>
          <p><strong>Motivo:</strong> {sug.reason}</p>
          {sug.action && (
            <button className="btn btn-primary" onClick={sug.action.run}>{sug.action.label}</button>
          )}
        </div>
      ))}
    </aside>
  )
}
