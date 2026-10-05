/**
 * TempoControl — el BPM aparece aquí por primera vez, cuando hace falta
 * (para grabar con cuenta atrás y metrónomo). El detector puede fallar:
 * siempre se puede corregir con ±, ×2, ÷2 o tocando al ritmo (Tap).
 */
import { useState } from 'react'
import { Minus, Plus, Hand } from 'lucide-react'
import { useProject } from '../state/projectStore'
import { getActiveSample } from '../actions/sampleActions'
import { getBpm, setBpm, tap } from '../actions/patternActions'
import { doubleBpm, halveBpm, initialBpm } from '../engines/patternEngine'

function tempoNote(sample, bpm, edited) {
  const n = Math.round(bpm)
  if (edited) return `Tempo: ${n} BPM (golpes por minuto).`
  if (sample?.tempoHint) return `Este disco va a ${n} BPM: ${n} golpes por minuto.`
  if (sample?.analysis?.bpmConfidence >= 0.1) return `Este sample parece estar aproximadamente a ${n} BPM. El detector puede equivocarse: si no encaja, ajústalo a oído o con Tap.`
  return 'No sé a qué tempo va este sample. Pulsa Tap varias veces al ritmo que oyes.'
}

export default function TempoControl({ disabled = false }) {
  const projectBpm = useProject(p => p.bpm)
  const sample = useProject(p => p.samples.find(s => s.id === p.activeSampleId))
  const bpm = projectBpm ?? getBpm()
  const edited = projectBpm !== null && projectBpm !== initialBpm(sample)
  const [draft, setDraft] = useState(null)
  const [tapped, setTapped] = useState(false)

  return (
    <div className="tempo">
      <div className="tempo-row">
        <span className="insp-label">Tempo</span>
        <button className="btn btn-icon" onClick={() => setBpm(bpm - 1)} disabled={disabled} aria-label="Bajar tempo"><Minus size={16} /></button>
        <label className="tempo-value">
          <input type="number" inputMode="numeric" min="40" max="220" disabled={disabled}
            value={draft ?? Math.round(bpm)} aria-label="BPM"
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { const v = Number(draft); if (draft !== null && v >= 40 && v <= 220) setBpm(v); setDraft(null) }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          <small>BPM</small>
        </label>
        <button className="btn btn-icon" onClick={() => setBpm(bpm + 1)} disabled={disabled} aria-label="Subir tempo"><Plus size={16} /></button>
        <button className="btn" onClick={() => setBpm(halveBpm(bpm))} disabled={disabled} title="La mitad">÷2</button>
        <button className="btn" onClick={() => setBpm(doubleBpm(bpm))} disabled={disabled} title="El doble">×2</button>
        <button className={`btn${tapped ? ' is-on' : ''}`} disabled={disabled}
          onPointerDown={(e) => { e.preventDefault(); tap(); setTapped(true); setTimeout(() => setTapped(false), 90) }}
          onClick={(e) => { if (e.detail === 0) tap() }}>
          <Hand size={16} /> Tap
        </button>
      </div>
      <p className="tempo-note">{tempoNote(sample, bpm, edited)}</p>
    </div>
  )
}
