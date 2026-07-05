import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Play, Square, Scissors, Wand2, Repeat, AudioWaveform, RotateCcw,
  FlipHorizontal2, Gauge, ZoomIn, ZoomOut, Maximize2, Download,
} from 'lucide-react'
import { useStore, updateSample, updateSampleEdits, setState } from '../state/store'
import { editedMono, editedTransients, defaultEdits } from '../engines/sampleEngine'
import {
  analyze, generateLoops, createLoopFromSelection, autoSlice,
  previewSampleSelection, stopPreview, exportSampleWav,
} from '../app/actions'

export default function SampleEditor() {
  const sample = useStore(s => s.samples.find(x => x.id === s.activeSampleId) || s.samples[0])
  if (!sample) {
    return (
      <div className="empty">
        <b>No hay ningún sample abierto.</b><br />
        Importa un archivo o crea el beat de prueba en la pestaña Importar: aquí podrás recortarlo,
        trocearlo por golpes y convertirlo en loops.
      </div>
    )
  }
  return <Editor key={sample.id} sample={sample} />
}

function fmt(t) { return t.toFixed(3) + ' s' }

function Editor({ sample }) {
  const samples = useStore(s => s.samples)
  const canvasRef = useRef(null)
  const [sel, setSel] = useState(null)          // { a, b } en segundos (dominio editado)
  const [view, setView] = useState(null)        // { t0, t1 }
  const dragRef = useRef(null)

  const { data, sampleRate } = useMemo(() => editedMono(sample), [sample.id, sample.edits])
  const duration = data.length / sampleRate
  const transients = useMemo(() => editedTransients(sample), [sample.id, sample.edits, sample.analysis])
  const v = view ?? { t0: 0, t1: duration }
  const e = sample.edits

  // el recorte cambia la duración: mantener la vista dentro de rango
  useEffect(() => { setView(null); setSel(null) }, [duration])

  // ------------------------------------------------ dibujo
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const W = canvas.clientWidth, H = canvas.clientHeight
      if (W === 0) return
      canvas.width = W * dpr; canvas.height = H * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#12141f'
      ctx.fillRect(0, 0, W, H)
      const span = v.t1 - v.t0
      const toX = t => (t - v.t0) / span * W

      // rejilla de compases (si hay análisis y no está invertido)
      if (sample.analysis && !e.reversed) {
        const barSec = 240 / sample.analysis.bpm
        const beatSec = barSec / 4
        const fb = Math.max(0, (sample.analysis.firstBeat ?? 0) - e.trimStart) % beatSec
        if (beatSec / span * W > 7) {
          for (let t = fb, i = 0; t <= v.t1; t += beatSec, i++) {
            if (t < v.t0) continue
            const isBar = i % 4 === 0
            ctx.strokeStyle = isBar ? 'rgba(163,255,63,0.18)' : 'rgba(255,255,255,0.05)'
            ctx.beginPath(); ctx.moveTo(toX(t), 0); ctx.lineTo(toX(t), H); ctx.stroke()
          }
        }
      }

      // forma de onda min/max por píxel
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#4fd8ff')
      grad.addColorStop(0.5, '#a3ff3f')
      grad.addColorStop(1, '#4fd8ff')
      ctx.fillStyle = grad
      const mid = H / 2
      for (let x = 0; x < W; x++) {
        const i0 = Math.floor((v.t0 + (x / W) * span) * sampleRate)
        const i1 = Math.max(i0 + 1, Math.floor((v.t0 + ((x + 1) / W) * span) * sampleRate))
        let mn = 1, mx = -1
        for (let i = i0; i < Math.min(i1, data.length); i++) {
          const s = data[i]; if (s < mn) mn = s; if (s > mx) mx = s
        }
        if (mn > mx) continue
        const y1 = mid - mx * mid * 0.92
        const y2 = mid - mn * mid * 0.92
        ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1))
      }
      // línea central
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke()

      // transitorios
      ctx.strokeStyle = 'rgba(255,79,163,0.4)'
      for (const t of transients) {
        if (t < v.t0 || t > v.t1) continue
        ctx.beginPath(); ctx.moveTo(toX(t), H * 0.08); ctx.lineTo(toX(t), H * 0.92); ctx.stroke()
      }

      // slices
      ctx.strokeStyle = 'rgba(255,176,58,0.55)'
      for (const s of sample.slices) {
        if (s.start < v.t0 || s.start > v.t1) continue
        ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(toX(s.start), 0); ctx.lineTo(toX(s.start), H); ctx.stroke()
        ctx.setLineDash([])
      }

      // selección
      if (sel) {
        const x1 = toX(sel.a), x2 = toX(sel.b)
        ctx.fillStyle = 'rgba(163,255,63,0.14)'
        ctx.fillRect(x1, 0, x2 - x1, H)
        ctx.strokeStyle = 'rgba(163,255,63,0.8)'
        ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke()
      }
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [data, sampleRate, v.t0, v.t1, sel, transients, sample.slices, sample.analysis, e.reversed, e.trimStart])

  // ------------------------------------------------ interacción
  const timeAt = (clientX) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return v.t0 + frac * (v.t1 - v.t0)
  }

  const onPointerDown = (ev) => {
    ev.currentTarget.setPointerCapture(ev.pointerId)
    dragRef.current = timeAt(ev.clientX)
    setSel(null)
  }
  const onPointerMove = (ev) => {
    if (dragRef.current === null) return
    const t = timeAt(ev.clientX)
    setSel({ a: Math.min(dragRef.current, t), b: Math.max(dragRef.current, t) })
  }
  const onPointerUp = () => {
    dragRef.current = null
    setSel(s => (s && s.b - s.a < 0.004 ? null : s))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (ev) => {
      ev.preventDefault()
      const span = v.t1 - v.t0
      if (ev.shiftKey) {
        const delta = (ev.deltaY / 400) * span
        let t0 = v.t0 + delta, t1 = v.t1 + delta
        if (t0 < 0) { t1 -= t0; t0 = 0 }
        if (t1 > duration) { t0 -= t1 - duration; t1 = duration }
        setView({ t0: Math.max(0, t0), t1: Math.min(duration, t1) })
      } else {
        const factor = ev.deltaY > 0 ? 1.3 : 0.75
        const center = timeAt(ev.clientX)
        let newSpan = Math.max(0.01, Math.min(duration, span * factor))
        let t0 = center - (center - v.t0) * (newSpan / span)
        t0 = Math.max(0, Math.min(duration - newSpan, t0))
        setView({ t0, t1: t0 + newSpan })
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  })

  const zoom = (factor) => {
    const span = v.t1 - v.t0
    const center = sel ? (sel.a + sel.b) / 2 : (v.t0 + v.t1) / 2
    let newSpan = Math.max(0.01, Math.min(duration, span * factor))
    let t0 = Math.max(0, Math.min(duration - newSpan, center - newSpan / 2))
    setView({ t0, t1: t0 + newSpan })
  }

  // ------------------------------------------------ operaciones
  const trimToSelection = () => {
    if (!sel || e.reversed) return
    updateSampleEdits(sample.id, {
      trimStart: e.trimStart + sel.a,
      trimEnd: e.trimStart + sel.b,
    })
    setSel(null); setView(null)
  }

  const a = sample.analysis

  return (
    <div>
      <div className="editor-head">
        <h2>{sample.name}</h2>
        {samples.length > 1 && (
          <select
            className="btn" value={sample.id}
            onChange={ev => setState({ activeSampleId: ev.target.value })}
          >
            {samples.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <span className="badge">{duration.toFixed(2)} s</span>
        {a ? (
          <>
            <span className="badge accent">{a.bpm} BPM · {Math.round(a.bpmConfidence * 100)}%</span>
            <span className="badge accent">{a.key} {a.mode === 'minor' ? 'menor' : 'mayor'}</span>
            <span className="badge">{a.timeSignature}</span>
            <span className="badge pink">{a.transients.length} golpes</span>
          </>
        ) : (
          <button className="btn" onClick={() => analyze(sample.id)}><Gauge size={15} /> Analizar</button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => generateLoops(sample.id)} disabled={!a}>
            <Wand2 size={15} /> Generar loops
          </button>
        </div>
      </div>

      <div className="wave-wrap">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <div className="wave-hint">arrastra: seleccionar · rueda: zoom · shift+rueda: desplazar</div>
      </div>

      <div className="sel-info">
        {sel
          ? <>selección <b>{fmt(sel.a)}</b> → <b>{fmt(sel.b)}</b> ({fmt(sel.b - sel.a)})</>
          : 'sin selección — arrastra sobre la onda para seleccionar un tramo'}
      </div>

      <div className="toolbar">
        <button className="btn" onClick={() => previewSampleSelection(sample, sel)}>
          <Play size={15} /> {sel ? 'Selección' : 'Todo'}
        </button>
        <button className="btn btn-icon" onClick={stopPreview} title="Parar preescucha"><Square size={15} /></button>
        <div className="sep" />
        <button
          className="btn" onClick={trimToSelection} disabled={!sel || e.reversed}
          title={e.reversed ? 'Desactiva Reverse para recortar' : 'Recorte no destructivo'}
        >
          <Scissors size={15} /> Recortar
        </button>
        <button className="btn" onClick={() => { createLoopFromSelection(sample.id, sel.a, sel.b); setSel(null) }} disabled={!sel}>
          <Repeat size={15} /> Loop de selección
        </button>
        <button className="btn" onClick={() => autoSlice(sample.id)} disabled={!a}>
          <AudioWaveform size={15} /> Slices por golpes
        </button>
        <div className="sep" />
        <button
          className={`btn${e.normalize ? ' btn-primary' : ''}`}
          onClick={() => updateSampleEdits(sample.id, { normalize: !e.normalize })}
        >
          Normalizar
        </button>
        <button
          className={`btn${e.reversed ? ' btn-primary' : ''}`}
          onClick={() => updateSampleEdits(sample.id, { reversed: !e.reversed })}
        >
          <FlipHorizontal2 size={15} /> Reverse
        </button>
        <div className="sep" />
        <button
          className="btn" title="Deshacer todas las ediciones (el original está intacto)"
          onClick={() => { updateSample(sample.id, { edits: defaultEdits(), slices: [] }); setView(null); setSel(null) }}
        >
          <RotateCcw size={15} /> Restablecer
        </button>
        <button className="btn" onClick={() => exportSampleWav(sample)}><Download size={15} /> WAV</button>
      </div>

      <div className="toolbar">
        <div className="slider-box">
          Ganancia
          <input
            type="range" min="0" max="2" step="0.05" value={e.gain}
            onChange={ev => updateSampleEdits(sample.id, { gain: Number(ev.target.value) })}
          />
          <span className="val">{e.gain.toFixed(2)}×</span>
        </div>
        <div className="slider-box">
          Pitch
          <input
            type="range" min="-12" max="12" step="1" value={e.pitchSemitones}
            onChange={ev => updateSampleEdits(sample.id, { pitchSemitones: Number(ev.target.value) })}
          />
          <span className="val">{e.pitchSemitones > 0 ? '+' : ''}{e.pitchSemitones} st</span>
        </div>
        <div className="slider-box">
          Fade in
          <input
            type="range" min="0" max="1000" step="10" value={e.fadeInMs}
            onChange={ev => updateSampleEdits(sample.id, { fadeInMs: Number(ev.target.value) })}
          />
          <span className="val">{e.fadeInMs} ms</span>
        </div>
        <div className="slider-box">
          Fade out
          <input
            type="range" min="0" max="1000" step="10" value={e.fadeOutMs}
            onChange={ev => updateSampleEdits(sample.id, { fadeOutMs: Number(ev.target.value) })}
          />
          <span className="val">{e.fadeOutMs} ms</span>
        </div>
        <div className="sep" />
        <button className="btn btn-icon" onClick={() => zoom(0.6)} title="Acercar"><ZoomIn size={15} /></button>
        <button className="btn btn-icon" onClick={() => zoom(1.6)} title="Alejar"><ZoomOut size={15} /></button>
        <button className="btn btn-icon" onClick={() => setView(null)} title="Ver todo"><Maximize2 size={15} /></button>
      </div>

      {sample.slices.length > 0 && (
        <div className="sel-info">{sample.slices.length} slices · toca «Loop de selección» tras seleccionar un tramo para convertirlo en loop</div>
      )}
    </div>
  )
}
