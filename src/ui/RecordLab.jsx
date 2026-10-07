/**
 * RecordLab — RECORD (chops) y DRUMS (batería): graba lo que tocas.
 * Cuenta atrás → tocas → la toma se repite en bucle → ¿te la quedas?
 * La otra pista suena de fondo mientras grabas. Después, opcional: oír cómo
 * queda ajustada al ritmo (quantize), sin perder la original.
 */
import { useEffect, useMemo, useState } from 'react'
import { Circle, Square, Play, Check, RotateCcw, X, Trash2, Timer, Music2, ArrowRight, LayoutGrid } from 'lucide-react'
import PadGrid from './PadGrid'
import DrumPads from './DrumPads'
import PatternLane from './PatternLane'
import TempoControl from './TempoControl'
import MixPanel from './MixPanel'
import CoachLine from './CoachLine'
import MemoryMeter from './MemoryMeter'
import MissionHead from './MissionHead'
import { useProject } from '../state/projectStore'
import { useUi } from '../state/uiStore'
import { useRecorder } from '../state/recorderStore'
import { getActiveBuffer, goto } from '../actions/sampleActions'
import {
  startRecording, stopPattern, togglePlay, keepTake, retryTake, discardTake, clearPattern,
  setQuantize, setMetronome, setCountIn, setBars, getBpm, lockedBars,
} from '../actions/patternActions'
import { editInGrid } from '../actions/gridActions'
import { ensureKit } from '../actions/drumActions'
import { setMetronomeVolume, getMetronomeVolume } from '../engines/metronomeEngine'
import { lengthBeats } from '../engines/patternEngine'
import { padLetter } from '../engines/sliceModel'
import { drumById, getDrumBuffer } from '../engines/drumKit'
import { useSequencerPhase, useActiveBuffer } from './hooks'
import { useLearning } from '../state/learningStore'
import { currentMission } from '../engines/missions'

const GRIDS = [
  ['off', 'Original', 'tu toma'],
  ['1/4', '1/4', 'negras'],
  ['1/8', '1/8', 'corcheas'],
  ['1/16', '1/16', 'semicorcheas'],
]

const COPY = {
  chops: {
    eyebrow: ['Record', 'Graba'], idle: 'Graba lo que tocas.',
    sub: 'Pulsa Grabar, espera la cuenta atrás y toca tus pads. Después se repetirá en bucle.',
  },
  drums: {
    eyebrow: ['Drums', 'Ritmo'], idle: 'Dale ritmo a tu frase.',
    sub: 'Tus chops suenan de fondo mientras grabas la batería. Cada toma se suma a lo que ya hay: primero el bombo, luego la caja…',
  },
}

export default function RecordLab({ track = 'chops' }) {
  const sample = useProject(p => p.samples.find(s => s.id === p.activeSampleId))
  const allSlices = useProject(p => p.slices)
  const pads = useProject(p => p.padBanks[0].pads)
  const patterns = useProject(p => p.patterns)
  useProject(p => p.bpm) // re-render al cambiar el tempo
  const selectedSliceId = useUi(s => s.selectedSliceId)
  const { take, bars, countIn, metronome } = useRecorder(s => s)
  const phase = useSequencerPhase()
  const buffer = useActiveBuffer()
  const slicesById = useMemo(() => new Map(allSlices.filter(s => s.sampleId === sample?.id).map(s => [s.id, s])), [allSlices, sample?.id])
  const [kitReady, setKitReady] = useState(!!getDrumBuffer('kick'))
  const mode = useProject(p => p.mode)
  const missionHere = useLearning(s => {
    const m = currentMission(s.progress, s.skipped)
    return mode === 'learning' && !s.exploring && !!m && m.screens.includes(track === 'drums' ? 'drums' : 'record')
  })

  useEffect(() => {
    if (track === 'drums' && !kitReady) ensureKit().then(() => setKitReady(!!getDrumBuffer('kick')))
  }, [track])

  if (!sample || !buffer) return null
  const copy = COPY[track]
  if (track === 'chops' && slicesById.size === 0) {
    return (
      <section>
        <MissionHead screen="record" eyebrow={copy.eyebrow} title="Primero necesitas chops."
          sub="Para grabar lo que tocas, antes trocea tu sample en pads." />
        <button className="btn btn-primary btn-big" onClick={() => goto('chop')}>Ir a Chop</button>
      </section>
    )
  }

  const saved = (kind) => patterns.find(x => (x.kind ?? 'chops') === kind) ?? null
  const patternOf = (kind) => (take?.kind === kind ? take : saved(kind))
  const pattern = patternOf(track)
  const busy = phase === 'countin' || phase === 'recording'
  const hasEvents = !!pattern?.events.length
  const showTake = take && take.kind === track && !busy
  const anyBeat = ['chops', 'drums'].some(k => patternOf(k)?.events.length)
  const locked = lockedBars(track)
  const len = Math.max(...['chops', 'drums'].map(k => patternOf(k)).filter(Boolean).map(lengthBeats), (locked ?? bars) * 4)

  const chopColor = (e) => slicesById.get(pads[e.padId])?.color
  const chopLabel = (e) => padLetter(e.padId)
  const drumColor = (e) => drumById(e.padId)?.color
  const drumLabel = (e) => drumById(e.padId)?.short ?? '?'
  const lanes = [
    { kind: 'chops', title: 'Chops', colorOf: chopColor, labelOf: chopLabel },
    { kind: 'drums', title: 'Batería', colorOf: drumColor, labelOf: drumLabel },
  ]
  // en RECORD la pista de batería solo se muestra si existe; en DRUMS se ven las dos
  const visibleLanes = lanes.filter(l => l.kind === track || patternOf(l.kind)?.events.length || track === 'drums')

  return (
    <section className="record">
      <MissionHead screen={track === 'drums' ? 'drums' : 'record'} lock={busy} eyebrow={copy.eyebrow}
        title={busy ? (phase === 'countin' ? 'Prepárate…' : 'Toca ahora.') : copy.idle}
        sub={busy ? 'Todo lo que toques se anota tal cual, sin corregir.' : copy.sub} />
      <CoachLine />
      <MemoryMeter />

      <TempoControl disabled={busy} />
      <div className="lanes">
        {visibleLanes.map(l => (
          <PatternLane key={l.kind} pattern={patternOf(l.kind)} len={len} colorOf={l.colorOf} labelOf={l.labelOf}
            bpm={getBpm()} title={visibleLanes.length > 1 ? l.title : null}
            active={l.kind === track} recording={busy && l.kind === track} showCount={l.kind === track} />
        ))}
      </div>

      <div className="rec-transport">
        {busy ? (
          <button className="btn btn-big btn-rec is-live" onClick={stopPattern}><Square size={18} /> Parar</button>
        ) : (
          <button className="btn btn-big btn-rec" onClick={() => startRecording(track)} disabled={track === 'drums' && !kitReady}>
            <Circle size={18} fill="currentColor" /> Grabar
          </button>
        )}
        <button className="btn btn-big" onClick={togglePlay} disabled={busy || !anyBeat} aria-label={phase === 'playing' ? 'Parar' : 'Reproducir'}>
          {phase === 'playing' ? <Square size={18} /> : <Play size={18} />} {phase === 'playing' ? 'Parar' : 'Escuchar'}
        </button>
        <span className="spacer" />
        <div className="bars-pick">
          <span className="insp-label">Compases</span>
          <div className="segmented" role="radiogroup" aria-label="Compases a grabar">
            {[1, 2, 4].map(n => {
              const on = (locked ?? bars) === n
              return (
                <button key={n} role="radio" aria-checked={on} aria-label={`${n} ${n === 1 ? 'compás' : 'compases'}`}
                  className={`btn${on ? ' is-on' : ''}`} disabled={busy || locked !== null} onClick={() => setBars(n)}
                  title={locked !== null ? 'Igual que tu otra pista' : undefined}>{n}</button>
              )
            })}
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

      {track === 'drums'
        ? <DrumPads ready={kitReady} />
        : <PadGrid pads={pads} slicesById={slicesById} buffer={buffer} selectedSliceId={selectedSliceId} />}

      {showTake && (
        <div className="take-bar">
          <p><b>¿Te la quedas?</b> Escúchala en bucle y decide.</p>
          <div className="row">
            <button className="btn btn-primary" onClick={keepTake}><Check size={16} /> Quedármela</button>
            {track === 'chops' && <button className="btn" onClick={editInGrid}><LayoutGrid size={16} /> Editar en la rejilla</button>}
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
                  className={`btn${pattern.quantize === id ? ' is-on' : ''}`} onClick={() => setQuantize(track, id)} title={hint}>
                  {label}
                </button>
              ))}
            </div>
            {!showTake && track === 'chops' && saved(track) && (
              <button className="btn" onClick={editInGrid}><LayoutGrid size={16} /> Editar en la rejilla</button>
            )}
            {!showTake && saved(track) && (
              <button className="btn btn-ghost btn-danger" onClick={() => clearPattern(track)}>
                <Trash2 size={16} /> {track === 'drums' ? 'Borrar batería' : 'Borrar pattern'}
              </button>
            )}
          </div>
        </div>
      )}

      {track === 'drums' && <MixPanel />}

      {track === 'drums' && anyBeat && !busy && !missionHere && (
        <div className="next-bar">
          <p>¿Suena a algo tuyo? Escúchalo entero y llévatelo.</p>
          <button className="btn btn-primary" onClick={() => goto('beat')}>Tu beat <ArrowRight size={16} /></button>
        </div>
      )}
    </section>
  )
}
