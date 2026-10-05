/**
 * RecordLab — RECORD: graba lo que tocas.
 * Cuenta atrás → tocas → la toma se repite en bucle → ¿te la quedas?
 * Después, opcional: oír cómo queda ajustada al ritmo (quantize), sin perder la original.
 */
import { useMemo } from 'react'
import { Circle, Square, Play, Check, RotateCcw, X, Trash2, Timer, Music2 } from 'lucide-react'
import PadGrid from './PadGrid'
import PatternLane from './PatternLane'
import TempoControl from './TempoControl'
import CoachLine from './CoachLine'
import { useProject } from '../state/projectStore'
import { useUi } from '../state/uiStore'
import { useRecorder } from '../state/recorderStore'
import { getActiveBuffer, goto } from '../actions/sampleActions'
import {
  startRecording, stopPattern, togglePlay, keepTake, retryTake, discardTake, clearPattern,
  setQuantize, setMetronome, setCountIn, setBars, getBpm,
} from '../actions/patternActions'
import { setMetronomeVolume, getMetronomeVolume } from '../engines/metronomeEngine'
import { useSequencerPhase } from './hooks'

const GRIDS = [
  ['off', 'Original', 'tu toma'],
  ['1/4', '1/4', 'negras'],
  ['1/8', '1/8', 'corcheas'],
  ['1/16', '1/16', 'semicorcheas'],
]

export default function RecordLab() {
  const sample = useProject(p => p.samples.find(s => s.id === p.activeSampleId))
  const allSlices = useProject(p => p.slices)
  const pads = useProject(p => p.padBanks[0].pads)
  const saved = useProject(p => p.patterns[0] ?? null)
  useProject(p => p.bpm) // re-render al cambiar el tempo
  const selectedSliceId = useUi(s => s.selectedSliceId)
  const { take, bars, countIn, metronome } = useRecorder(s => s)
  const phase = useSequencerPhase()
  const buffer = useMemo(() => getActiveBuffer(), [sample?.id])
  const slicesById = useMemo(() => new Map(allSlices.filter(s => s.sampleId === sample?.id).map(s => [s.id, s])), [allSlices, sample?.id])

  if (!sample || !buffer) return null
  if (slicesById.size === 0) {
    return (
      <section>
        <header className="screen-head">
          <div className="eyebrow">Record <span>· Graba</span></div>
          <h2 className="screen-title">Primero necesitas chops.</h2>
          <p className="screen-sub">Para grabar lo que tocas, antes trocea tu sample en pads.</p>
        </header>
        <button className="btn btn-primary btn-big" onClick={() => goto('chop')}>Ir a Chop</button>
      </section>
    )
  }

  const pattern = take ?? saved
  const busy = phase === 'countin' || phase === 'recording'
  const hasEvents = !!pattern?.events.length
  const showTake = take && !busy

  return (
    <section className="record">
      <header className="screen-head">
        <div className="eyebrow">Record <span>· Graba</span></div>
        <h2 className="screen-title">{busy ? (phase === 'countin' ? 'Prepárate…' : 'Toca ahora.') : 'Graba lo que tocas.'}</h2>
        <p className="screen-sub">
          {busy ? 'Todo lo que toques se anota tal cual, sin corregir.'
            : 'Pulsa Grabar, espera la cuenta atrás y toca tus pads. Después se repetirá en bucle.'}
        </p>
      </header>
      <CoachLine />

      <TempoControl disabled={busy} />
      <PatternLane pattern={pattern} pads={pads} slicesById={slicesById} bpm={getBpm()} recording={busy} />

      <div className="rec-transport">
        {busy ? (
          <button className="btn btn-big btn-rec is-live" onClick={stopPattern}><Square size={18} /> Parar</button>
        ) : (
          <button className="btn btn-big btn-rec" onClick={startRecording}><Circle size={18} fill="currentColor" /> Grabar</button>
        )}
        <button className="btn btn-big" onClick={togglePlay} disabled={busy || !hasEvents} aria-label={phase === 'playing' ? 'Parar' : 'Reproducir'}>
          {phase === 'playing' ? <Square size={18} /> : <Play size={18} />} {phase === 'playing' ? 'Parar' : 'Escuchar'}
        </button>
        <span className="spacer" />
        <div className="bars-pick">
          <span className="insp-label">Compases</span>
          <div className="segmented" role="radiogroup" aria-label="Compases a grabar">
            {[1, 2, 4].map(n => (
              <button key={n} role="radio" aria-checked={bars === n} aria-label={`${n} ${n === 1 ? 'compás' : 'compases'}`}
                className={`btn${bars === n ? ' is-on' : ''}`} disabled={busy} onClick={() => setBars(n)}>{n}</button>
            ))}
          </div>
        </div>
        <button className={`btn${countIn ? ' is-on' : ''}`} aria-pressed={countIn} disabled={busy} onClick={() => setCountIn(!countIn)}>
          <Timer size={16} /> Cuenta atrás
        </button>
        <button className={`btn${metronome ? ' is-on' : ''}`} aria-pressed={metronome} onClick={() => setMetronome(!metronome)}>
          <Music2 size={16} /> Metrónomo
        </button>
        {metronome && (
          <input type="range" className="metro-vol" min="0" max="1" step="0.05" defaultValue={getMetronomeVolume()}
            onChange={e => setMetronomeVolume(Number(e.target.value))} aria-label="Volumen del metrónomo" />
        )}
      </div>

      <PadGrid pads={pads} slicesById={slicesById} buffer={buffer} selectedSliceId={selectedSliceId} />

      {showTake && (
        <div className="take-bar">
          <p><b>¿Te la quedas?</b> Escúchala en bucle y decide.</p>
          <div className="row">
            <button className="btn btn-primary" onClick={keepTake}><Check size={16} /> Quedármela</button>
            <button className="btn" onClick={retryTake}><RotateCcw size={16} /> Otra toma</button>
            <button className="btn btn-ghost" onClick={discardTake}><X size={16} /> Descartar</button>
          </div>
        </div>
      )}

      {hasEvents && !busy && (
        <div className="quantize-bar">
          <p>¿Quieres oír cómo queda <b>ligeramente ajustado al ritmo</b>? Tu toma original no se pierde.</p>
          <div className="row">
            <div className="segmented" role="radiogroup" aria-label="Ajuste al ritmo">
              {GRIDS.map(([id, label, hint]) => (
                <button key={id} role="radio" aria-checked={pattern.quantize === id}
                  className={`btn${pattern.quantize === id ? ' is-on' : ''}`} onClick={() => setQuantize(id)} title={hint}>
                  {label}
                </button>
              ))}
            </div>
            {!take && saved && (
              <button className="btn btn-ghost btn-danger" onClick={clearPattern}><Trash2 size={16} /> Borrar pattern</button>
            )}
          </div>
        </div>
      )}

    </section>
  )
}
