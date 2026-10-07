/**
 * GridLab — GRID: ordena tus chops en una rejilla, sin tocar en directo.
 * Cada fila es un chop, cada columna un paso del ritmo; una celda = un golpe.
 * Es el camino principal para escribir un pattern. Grabar en directo sigue
 * ahí como opción, y lo grabado se puede convertir aquí en rejilla editable.
 */
import { useMemo } from 'react'
import { Play, Square, CopyPlus, Trash2, Wand2, Circle, ArrowRight } from 'lucide-react'
import StepGrid from './StepGrid'
import TempoControl from './TempoControl'
import CoachLine from './CoachLine'
import MemoryMeter from './MemoryMeter'
import MissionHead from './MissionHead'
import { useProject } from '../state/projectStore'
import { useRecorder } from '../state/recorderStore'
import { useLearning } from '../state/learningStore'
import { currentMission } from '../engines/missions'
import { goto } from '../actions/sampleActions'
import { auditionPad } from '../actions/samplerActions'
import { setStep, setGridBars, setGridResolution, duplicateGrid, clearGrid, convertToGrid, toggleGridPlay } from '../actions/gridActions'
import { GRID_BARS, GRID_RESOLUTIONS, MAX_BARS, gridView } from '../engines/gridModel'
import { padLetter, visiblePadCount } from '../engines/sliceModel'
import { DEFAULT_KEYMAP, keyLabel } from '../engines/keyboardMap'
import { useSequencerPhase } from './hooks'

const RES_HINT = { '1/4': 'negras', '1/8': 'corcheas', '1/16': 'semicorcheas' }

export default function GridLab() {
  const sample = useProject(p => p.samples.find(s => s.id === p.activeSampleId))
  const allSlices = useProject(p => p.slices)
  const pads = useProject(p => p.padBanks[0].pads)
  const patterns = useProject(p => p.patterns)
  const os = useProject(p => p.settings?.oldSchool)
  const mode = useProject(p => p.mode)
  useProject(p => p.bpm) // re-render al cambiar el tempo
  const { take, bars: draftBars, grid: draftGrid } = useRecorder(s => s)
  const phase = useSequencerPhase()
  const missionHere = useLearning(s => {
    const m = currentMission(s.progress, s.skipped)
    return mode === 'learning' && !s.exploring && !!m && m.screens.includes('grid')
  })

  const chops = take?.kind === 'chops' ? take : patterns.find(x => (x.kind ?? 'chops') === 'chops') ?? null
  const drums = take?.kind === 'drums' ? take : patterns.find(x => x.kind === 'drums') ?? null
  const drumHits = drums?.events.length ?? 0
  const view = useMemo(
    () => gridView(chops, { bars: draftBars, grid: draftGrid }, drumHits ? drums.bars : null),
    [chops, draftBars, draftGrid, drums, drumHits],
  )

  // una fila por chop; en Old School, solo los pads que caben en la máquina
  const rows = useMemo(() => {
    const byId = new Map(allSlices.filter(s => s.sampleId === sample?.id).map(s => [s.id, s]))
    const count = os?.enabled ? Math.min(visiblePadCount(pads), os.maxPads ?? 8) : visiblePadCount(pads)
    return pads.slice(0, count)
      .map((id, i) => ({ i, slice: id ? byId.get(id) : null }))
      .filter(r => r.slice)
      .map(r => ({ i: r.i, color: r.slice.color, letter: padLetter(r.i), keyHint: keyLabel(DEFAULT_KEYMAP[r.i]) }))
  }, [allSlices, pads, sample?.id, os])

  if (!sample) return null
  if (!rows.length) {
    return (
      <section>
        <MissionHead screen="grid" eyebrow={['Grid', 'Ordena']} title="Primero necesitas chops."
          sub="La rejilla coloca tus chops en el tiempo. Antes, trocea tu sample en pads." />
        <button className="btn btn-primary btn-big" onClick={() => goto('chop')}>Ir a Chop</button>
      </section>
    )
  }

  const busy = phase === 'countin' || phase === 'recording'
  const playing = phase === 'playing'
  const canPlay = view.hits > 0 || drumHits > 0
  const barsNow = view.bars
  const [a, b, c] = rows.map(r => r.letter)
  const example = c ? `${a} ${c} ${c} ${b}` : null

  return (
    <section className="gridlab">
      <MissionHead screen="grid" lock={busy} eyebrow={['Grid', 'Ordena']}
        title={busy ? 'Estás grabando en directo.' : 'Ordena tus chops, sin prisas.'}
        sub={busy
          ? 'Cuando termines, podrás convertir la toma en una rejilla para ajustarla celda a celda.'
          : 'Cada fila es un chop y cada columna, un paso del ritmo. Pulsa una celda para poner un golpe; vuelve a pulsarla para quitarlo.'} />
      <CoachLine />
      <MemoryMeter />

      <div className="grid-transport">
        <button className={`btn btn-big grid-play${playing ? ' is-live' : ''}`} onClick={toggleGridPlay}
          disabled={busy || !canPlay} aria-label={playing ? 'Parar' : 'Reproducir en bucle'}>
          {playing ? <Square size={20} /> : <Play size={20} />} <span className="grid-play-label">{playing ? 'Parar' : 'Play'}</span>
        </button>
        <div className="grid-tempo"><TempoControl disabled={busy} /></div>
      </div>

      <div className="grid-options">
        <div className="grid-opt">
          <span className="insp-label">Compases</span>
          <div className="segmented" role="radiogroup" aria-label="Compases del patrón">
            {GRID_BARS.map(n => (
              <button key={n} role="radio" aria-checked={barsNow === n} disabled={busy}
                className={`btn${barsNow === n ? ' is-on' : ''}`} onClick={() => setGridBars(n)}
                aria-label={`${n} ${n === 1 ? 'compás' : 'compases'}`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="grid-opt">
          <span className="insp-label">Resolución</span>
          <div className="segmented" role="radiogroup" aria-label="Resolución de la rejilla">
            {GRID_RESOLUTIONS.map(r => (
              <button key={r} role="radio" aria-checked={view.res === r} disabled={busy}
                className={`btn${view.res === r ? ' is-on' : ''}`} onClick={() => setGridResolution(r)}
                title={RES_HINT[r]}>{r}</button>
            ))}
          </div>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={duplicateGrid} disabled={busy || !view.hits || barsNow * 2 > MAX_BARS}
          title={barsNow * 2 > MAX_BARS ? `Ya tienes el máximo: ${MAX_BARS} compases` : 'Repite el patrón en los compases siguientes para variar la segunda mitad'}>
          <CopyPlus size={16} /> Duplicar
        </button>
        <button className="btn btn-ghost btn-danger" onClick={clearGrid} disabled={busy || !view.hits}>
          <Trash2 size={16} /> Limpiar
        </button>
      </div>

      {view.loose && !busy && (
        <div className="quantize-bar grid-convert" role="status">
          <p>
            <b>{view.looseCount > 0
              ? `${view.looseCount} ${view.looseCount === 1 ? 'golpe no cae' : 'golpes no caen'} justo en un paso.`
              : 'Esta toma tiene un ajuste aplicado.'}</b>{' '}
            Las celdas enseñan dónde quedarían. Pásalos a la rejilla para editarlos celda a celda (se puede deshacer).
          </p>
          <button className="btn btn-primary" onClick={() => convertToGrid()}><Wand2 size={16} /> Pasar a rejilla {view.res}</button>
        </div>
      )}

      <StepGrid rows={rows} res={view.res} steps={view.steps} cells={view.cells}
        disabled={busy} onSet={setStep} onAudition={auditionPad} />

      {!view.hits && !busy && (
        <p className="grid-hint">
          Pulsa una celda para empezar.
          {example && !missionHere && <> Por ejemplo, <b className="chip chip-seq">{example}</b>: un chop en cada paso.</>}
          {' '}Mientras suena puedes seguir cambiando celdas.
        </p>
      )}
      {drumHits > 0 && (
        <p className="grid-note">
          Tu batería suena de fondo con el mismo bucle. <button className="link-btn" onClick={() => goto('drums')}>Ir a Drums</button>
        </p>
      )}

      {view.hits > 0 && !busy && !missionHere && (
        <div className="next-bar">
          <p>¿Ya suena a algo tuyo? Añádele batería y escúchalo entero.</p>
          <button className="btn btn-primary" onClick={() => goto('drums')}>Batería <ArrowRight size={16} /></button>
        </div>
      )}

      <p className="grid-live">
        ¿Prefieres tocarlo? <button className="link-btn" onClick={() => goto('record')}><Circle size={11} fill="currentColor" /> Grabar en directo</button>
        {' '}y luego conviértelo aquí en una rejilla editable.
      </p>
    </section>
  )
}
