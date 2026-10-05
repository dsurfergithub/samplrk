/**
 * BeatResult — BEAT: «Tu primer beat».
 * Escúchalo, mira lo que has usado (hechos, nunca una nota de calidad)
 * y llévatelo en WAV. Desde aquí se sigue editando o se empieza otro.
 */
import { useEffect, useState } from 'react'
import { Play, Square, Download, Pencil, Plus, Repeat2 } from 'lucide-react'
import MissionHead from './MissionHead'
import MixPanel from './MixPanel'
import CoachLine from './CoachLine'
import MemoryMeter from './MemoryMeter'
import { useProject } from '../state/projectStore'
import { useRecorder } from '../state/recorderStore'
import { beatSummary } from '../engines/beatPlan'
import { drumById } from '../engines/drumKit'
import { getBpm, togglePlay } from '../actions/patternActions'
import { exportBeatWav, resampleBeat } from '../actions/beatActions'
import { ensureKit } from '../actions/drumActions'
import { goto } from '../actions/sampleActions'
import { notify } from '../actions/learningActions'
import { useSequencerPhase } from './hooks'

const fmt = (n) => n.toFixed(1).replace('.', ',')
const GRID_NAME = { off: 'sin ajustar', '1/4': 'ajustado a 1/4', '1/8': 'ajustado a 1/8', '1/16': 'ajustado a 1/16' }

export default function BeatResult() {
  const project = useProject(p => p)
  const take = useRecorder(s => s.take)
  const phase = useSequencerPhase()
  const [loops, setLoops] = useState(1)
  useEffect(() => { ensureKit() }, [])
  // si ya está sonando (vienes de grabar), escucharlo un momento cuenta como escucharlo
  useEffect(() => {
    if (phase !== 'playing') return
    const t = setTimeout(() => notify({ type: 'beat:played' }), 1500)
    return () => clearTimeout(t)
  }, [phase])

  const bpm = getBpm(project)
  const s = beatSummary(project, bpm)
  const empty = !s.chopHits && !s.drumHits

  const play = () => togglePlay()

  return (
    <section className="beat">
      <MissionHead screen="beat" eyebrow={['Beat', 'Resultado']} title="Tu primer beat."
        sub="Escúchalo, llévatelo o sigue cambiándolo. No hay un beat correcto: este es el tuyo." />
      <CoachLine />
      <MemoryMeter />

      {empty ? (
        <div className="hint-card">
          <p>Todavía no hay beat: graba un pattern con tus chops (y, si quieres, batería encima).</p>
          <button className="btn btn-primary" onClick={() => goto('record')}>Ir a grabar</button>
        </div>
      ) : (
        <>
          {take && <p className="fineprint">Tienes una toma sin decidir: se oye aquí, pero no se exporta hasta que pulses «Quedármela».</p>}
          <div className="beat-hero">
            <button className={`btn btn-play beat-play${phase === 'playing' ? ' is-on' : ''}`} onClick={play}
              aria-label={phase === 'idle' ? 'Reproducir tu beat' : 'Parar'}>
              {phase === 'idle' ? <Play size={34} /> : <Square size={28} />}
            </button>
            <dl className="beat-stats">
              <div><dt>Duración</dt><dd>{fmt(s.seconds)} s <small>· {s.bars} {s.bars === 1 ? 'compás' : 'compases'}</small></dd></div>
              <div><dt>Tempo</dt><dd>{Math.round(bpm)} <small>BPM</small></dd></div>
              <div><dt>Chops usados</dt><dd>{s.chopsUsed} <small>de {s.chopsTotal}</small></dd></div>
              <div><dt>Transformaciones</dt><dd className="beat-list">
                {s.pitched > 0 && <span>{s.pitched} con pitch</span>}
                {s.reversed > 0 && <span>{s.reversed} en reverse</span>}
                <span>chops {GRID_NAME[s.quantize.chops]}</span>
                {!s.pitched && !s.reversed && <span>sin pitch ni reverse</span>}
              </dd></div>
              <div><dt>Batería</dt><dd className="beat-list">
                {s.drumHits
                  ? <><span>{s.drumHits} golpes</span><span>{s.drumsUsed.map(id => drumById(id)?.label.toLowerCase()).join(', ')}</span></>
                  : <span>sin batería</span>}
              </dd></div>
            </dl>
          </div>

          <div className="export-bar">
            <div className="segmented" role="radiogroup" aria-label="Vueltas a exportar">
              {[[1, '1 vuelta (loop)'], [4, '4 vueltas']].map(([n, label]) => (
                <button key={n} role="radio" aria-checked={loops === n} className={`btn${loops === n ? ' is-on' : ''}`} onClick={() => setLoops(n)}>{label}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-big" onClick={() => exportBeatWav(loops)}><Download size={18} /> Exportar WAV</button>
          </div>

          <div className="resample-bar">
            <p><b>Resamplear</b>: convierte este beat en un sample nuevo y vuelve a trocearlo. El original queda guardado.</p>
            <button className="btn btn-big" onClick={resampleBeat}><Repeat2 size={18} /> Resamplear</button>
          </div>

          <MixPanel />

          <div className="row beat-more">
            <button className="btn" onClick={() => goto('chop')}><Pencil size={16} /> Seguir editando</button>
            <button className="btn btn-ghost" onClick={() => goto('source')}><Plus size={16} /> Crear otro</button>
            <span className="fineprint beat-saved">Este beat queda guardado en «Mis proyectos».</span>
          </div>
        </>
      )}
    </section>
  )
}
