/**
 * CutLab — FIND + CUT + LOOP.
 * 1) Escuchar la grabación y pulsar «Aquí hay algo».
 * 2) Ajustar INICIO / FIN alrededor de ese momento, escucharlo, repetirlo.
 * 3) «Este es mi sample».
 * La inteligencia (golpes, empalme del loop) solo sugiere; nunca mueve nada sola.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, Repeat, Sparkles, ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react'
import Waveform from './Waveform'
import CoachLine from './CoachLine'
import MissionHead from './MissionHead'
import { useProject } from '../state/projectStore'
import { getActiveBuffer, previewAll, previewRange, stopPreview, confirmCut } from '../actions/sampleActions'
import { notify } from '../actions/learningActions'
import { previewPosition } from '../engines/audioEngine'
import { peaksFor } from '../engines/waveformPeaks'
import { startHint, loopHint } from '../engines/cutHints'
import { usePreviewing, liveState } from './hooks'

const NUDGE = 0.01

export default function CutLab() {
  const sample = useProject(p => p.samples.find(s => s.id === p.activeSampleId))
  const buffer = useMemo(() => getActiveBuffer(), [sample?.id])
  if (!sample || !buffer) return null
  return <Cutter key={sample.id} sample={sample} buffer={buffer} />
}

function Cutter({ sample, buffer }) {
  const dur = buffer.duration
  const hasCut = sample.edits.trimEnd !== null
  const [sel, setSel] = useState(hasCut ? { start: sample.edits.trimStart, end: sample.edits.trimEnd } : null)
  const [mark, setMark] = useState(null)
  const [fit, setFit] = useState(hasCut ? around(sample.edits.trimStart, sample.edits.trimEnd, dur) : null)
  const [looping, setLooping] = useState(false)
  const [showHit, setShowHit] = useState(false)
  const previewing = usePreviewing()

  // la primera vez que hay un fragmento elegido, has "encontrado" algo
  const hasSel = sel !== null
  useEffect(() => { if (hasSel) notify({ type: 'find:marked' }) }, [hasSel])

  // si la preescucha en bucle se para desde fuera, el botón se apaga
  useEffect(() => { if (!previewing) setLooping(false) }, [previewing])

  // al mover la selección con el bucle activo, se relanza (al soltar)
  const restart = useRef(null)
  useEffect(() => {
    if (!looping || !sel) return
    clearTimeout(restart.current)
    restart.current = setTimeout(() => previewRange(sel.start, sel.end, { loop: true }), 180)
    return () => clearTimeout(restart.current)
  }, [sel?.start, sel?.end, looping])

  const hint = sel ? startHint(sel.start, sample.analysis?.transients) : null
  const loopMsg = useMemo(
    () => (looping && sel ? loopHint(peaksFor(buffer).mono, buffer.sampleRate, sel.start, sel.end) : null),
    [looping, sel?.start, sel?.end, buffer],
  )

  const hereIsSomething = () => {
    const t = previewPosition() ?? 0
    stopPreview()
    setMark(t)
    setSel({ start: Math.max(0, t - 0.6), end: Math.min(dur, t + 3.4) })
    setFit(around(t - 4, t + 6, dur))
  }

  const toggleLoop = () => {
    if (looping) { stopPreview(); setLooping(false); return }
    previewRange(sel.start, sel.end, { loop: true })
    setLooping(true)
    notify({ type: 'loop:on' })
  }

  const nudge = (edge, dir) => setSel(s => edge === 'start'
    ? { ...s, start: clamp(s.start + dir * NUDGE, 0, s.end - 0.05) }
    : { ...s, end: clamp(s.end + dir * NUDGE, s.start + 0.05, dur) })

  const markers = []
  if (mark !== null) markers.push({ t: mark, kind: 'mark' })
  if (hint && showHit) markers.push({ t: hint.hit })

  // ------------------------------------------------------------ fase 1: escuchar
  if (!sel) {
    return (
      <section className="cut">
        <MissionHead screen="cut" eyebrow={['Find', 'Encuentra']} title="Escucha la grabación."
          sub="Cuando oigas algo que te guste —un acorde, un golpe, una frase— pulsa «Aquí hay algo»." />
        <CoachLine />
        <Waveform buffer={buffer} dim selectable onSelectionChange={setSel} getLive={liveState}
          className="wave-listen" label={`Grabación «${sample.name}». Arrastra para elegir un fragmento.`} />
        <div className="listen-actions">
          <button className="btn btn-big btn-play" onClick={() => (previewing ? stopPreview() : previewAll())}
            aria-label={previewing ? 'Parar' : 'Escuchar'}>
            {previewing ? <Square size={26} /> : <Play size={28} />}
          </button>
          <button className="btn btn-primary btn-big btn-here" onClick={hereIsSomething} disabled={!previewing}>
            <Sparkles size={20} /> Aquí hay algo
          </button>
        </div>
        <p className="fineprint center">
          También puedes arrastrar sobre la onda para elegir un trozo directamente,
          o <button className="link-btn" onClick={() => confirmCut(0, dur)}>usar la grabación entera</button>.
        </p>
      </section>
    )
  }

  // ------------------------------------------------------------ fase 2: cortar
  const len = sel.end - sel.start
  return (
    <section className="cut">
      <MissionHead screen="cut" eyebrow={['Cut', 'Corta']} title="Ajusta el inicio y el final."
        sub="Arrastra los tiradores azules. Escucha, mueve, vuelve a escuchar: tu oído decide." />
      <CoachLine />

      <Waveform buffer={buffer} fit={fit} selection={sel} selectable onSelectionChange={setSel}
        markers={markers} getLive={liveState} className="wave-cut"
        label={`Fragmento de ${len.toFixed(1)} segundos`} />

      <div className="cut-bar">
        <div className="nudge" role="group" aria-label="Mover inicio">
          <button className="btn btn-icon" onClick={() => nudge('start', -1)} aria-label="Inicio a la izquierda"><ChevronLeft size={18} /></button>
          <span>Inicio</span>
          <button className="btn btn-icon" onClick={() => nudge('start', 1)} aria-label="Inicio a la derecha"><ChevronRight size={18} /></button>
        </div>
        <span className="chip">{len.toFixed(2).replace('.', ',')} s</span>
        <div className="nudge" role="group" aria-label="Mover final">
          <button className="btn btn-icon" onClick={() => nudge('end', -1)} aria-label="Final a la izquierda"><ChevronLeft size={18} /></button>
          <span>Fin</span>
          <button className="btn btn-icon" onClick={() => nudge('end', 1)} aria-label="Final a la derecha"><ChevronRight size={18} /></button>
        </div>
      </div>

      {hint && (
        <div className="hint-card">
          <p>{hint.text}</p>
          <div className="row">
            <button className={`btn${showHit ? ' is-on' : ''}`} onClick={() => setShowHit(v => !v)}>Ver sugerencia</button>
            <button className="btn" onClick={() => { setSel(s => ({ ...s, start: hint.suggested })); setShowHit(false) }}>Ajustar ligeramente</button>
          </div>
        </div>
      )}
      {loopMsg && <div className="hint-card"><p>{loopMsg}</p></div>}

      <div className="cut-actions">
        <button className="btn" onClick={() => { setLooping(false); previewRange(sel.start, sel.end) }}><Play size={16} /> Escuchar</button>
        <button className={`btn${looping ? ' is-on' : ''}`} onClick={toggleLoop} aria-pressed={looping}><Repeat size={16} /> Repetir</button>
        <button className="btn btn-ghost" onClick={() => { stopPreview(); setSel(null); setMark(null); setFit(null) }}><RotateCcw size={16} /> Escuchar todo otra vez</button>
        <span className="spacer" />
        <button className="btn btn-primary btn-big" onClick={() => confirmCut(sel.start, sel.end)}><Check size={20} /> Este es mi sample</button>
      </div>
    </section>
  )
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function around(a, b, dur) {
  const pad = Math.max(0.5, (b - a) * 0.25)
  return { t0: clamp(a - pad, 0, dur), t1: clamp(b + pad, 0, dur) }
}
