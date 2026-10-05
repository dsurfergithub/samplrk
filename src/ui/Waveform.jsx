/**
 * Waveform — onda reutilizable (CUT, CHOP y fases siguientes).
 *
 * Dos capas de canvas:
 *  · base: onda, región, chops coloreados, selección, marcas. Se redibuja
 *    solo cuando cambian los datos o la vista.
 *  · live: playheads y destellos de chops que suenan. Se pinta con rAF a
 *    partir de `getLive()` sin pasar por React.
 *
 * La interacción (arrastrar tiradores, bordes de chop, tocar segmentos,
 * cortar) se resuelve con pointer events: funciona igual con ratón y dedo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { peaksFor, columns } from '../engines/waveformPeaks'
import WaveOverview from './WaveOverview'
import { cssVar, setupCanvas, roundRect, hexA } from './theme'

const MIN_SPAN = 0.02

export default function Waveform({
  buffer, fit = null, className = '',
  region = null, dim = false,
  selection = null, selectable = false, onSelectionChange,
  slices = [], selectedSliceId = null, onSliceDown, onEdgeDrag,
  tool = 'select', onTapTime,
  markers = [], getLive = null, warn = false,
  label = 'Forma de onda',
}) {
  const wrapRef = useRef(null)
  const baseRef = useRef(null)
  const liveRef = useRef(null)
  const dragRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const duration = buffer?.duration ?? 0
  const [view, setView] = useState(() => fit ?? { t0: 0, t1: duration })
  const peaks = useMemo(() => buffer ? peaksFor(buffer) : null, [buffer])

  // la vista se reajusta cuando el padre pide otro encuadre
  useEffect(() => { setView(clampView(fit ?? { t0: 0, t1: duration }, duration)) }, [fit?.t0, fit?.t1, duration])

  useEffect(() => {
    const el = wrapRef.current
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sorted = useMemo(() => [...slices].sort((a, b) => a.start - b.start), [slices])
  // Ancho real: si el ResizeObserver aún no ha medido (justo tras montar), se mide
  // al momento. Sin esto, un arrastre muy rápido dividiría por cero (tiempo = Infinity).
  const width = () => size.w || baseRef.current?.getBoundingClientRect().width || 1
  const toX = (t) => (t - view.t0) / (view.t1 - view.t0) * width()
  const toT = (x) => Math.max(0, Math.min(duration, view.t0 + (x / width()) * (view.t1 - view.t0)))

  // ------------------------------------------------------------ capa base
  useEffect(() => {
    const cv = baseRef.current
    if (!cv || !peaks || size.w === 0) return
    const ctx = setupCanvas(cv, size)
    const { w, h } = size
    const mid = h / 2
    const C = palette()

    if (region) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 0, Math.max(0, toX(region.start)), h)
      ctx.fillRect(toX(region.end), 0, w - toX(region.end), h)
    }
    for (const s of sorted) {
      const x1 = toX(s.start), x2 = toX(s.end)
      if (x2 < 0 || x1 > w) continue
      ctx.fillStyle = hexA(s.color, s.id === selectedSliceId ? 0.2 : 0.08)
      ctx.fillRect(x1, 0, x2 - x1, h)
    }
    if (selection) {
      ctx.fillStyle = warn ? 'rgba(255, 75, 75, 0.16)' : C.selectSoft
      ctx.fillRect(toX(selection.start), 0, toX(selection.end) - toX(selection.start), h)
    }

    // onda: cada columna toma el color de su chop (o naranja = audio)
    const cols = columns(peaks, view.t0, view.t1, w)
    let si = 0
    ctx.globalAlpha = dim ? 0.45 : 1
    for (let x = 0; x < w; x++) {
      const t = toT(x + 0.5)
      while (si < sorted.length && sorted[si].end <= t) si++
      const s = sorted[si] && sorted[si].start <= t ? sorted[si] : null
      const out = region && (t < region.start || t > region.end)
      ctx.fillStyle = s ? s.color : out ? C.muted : C.sample
      const y1 = mid - cols[x * 2 + 1] * mid * 0.92
      const y2 = mid - cols[x * 2] * mid * 0.92
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1))
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, mid, w, 1)

    // bordes y letras de chop
    ctx.font = `700 12px ${C.mono}`
    sorted.forEach(s => {
      const x1 = toX(s.start), x2 = toX(s.end)
      if (x2 < 0 || x1 > w) return
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillRect(Math.round(x1), 0, 1, h)
      if (s.label && x2 - x1 > 18) {
        ctx.fillStyle = s.color
        roundRect(ctx, x1 + 4, 4, 18, 18, 4)
        ctx.fillStyle = '#111'
        ctx.fillText(s.label, x1 + 8, 17)
      }
      if (s.id === selectedSliceId) {
        ctx.strokeStyle = C.select; ctx.lineWidth = 2
        ctx.strokeRect(x1 + 1, 1, x2 - x1 - 2, h - 2)
      }
    })

    for (const m of markers) {
      const x = toX(m.t)
      if (x < 0 || x > w) continue
      ctx.fillStyle = m.kind === 'mark' ? C.sample : C.select
      ctx.fillRect(x - 1, 0, 2, h)
      ctx.beginPath(); ctx.moveTo(x - 7, 0); ctx.lineTo(x + 7, 0); ctx.lineTo(x, 10); ctx.fill()
    }

    if (selection) {
      for (const [t, name] of [[selection.start, 'INICIO'], [selection.end, 'FIN']]) {
        const x = toX(t)
        ctx.fillStyle = warn ? C.rec : C.select
        ctx.fillRect(x - 1, 0, 2, h)
        // pomo grande para arrastrar con el dedo
        ctx.beginPath(); ctx.arc(x, mid, 9, 0, Math.PI * 2); ctx.fill()
        ctx.font = `600 10px ${C.mono}`
        const tw = ctx.measureText(name).width + 10
        const tx = name === 'FIN' ? x - tw : x
        roundRect(ctx, tx, 2, tw, 18, 4)
        ctx.fillStyle = '#0b0c0e'
        ctx.fillText(name, tx + 5, 15)
        ctx.fillStyle = warn ? C.rec : C.select
      }
    }
  }, [peaks, size, view, sorted, selection, selectedSliceId, region, markers, dim, warn])

  // ------------------------------------------------------------ capa en vivo (rAF)
  useEffect(() => {
    const cv = liveRef.current
    if (!cv || size.w === 0 || !getLive) return
    const ctx = setupCanvas(cv, size)
    const C = palette()
    let raf, wasEmpty = true
    const tick = () => {
      const live = getLive()
      const empty = !live.heads.length && !live.active.size
      if (!(empty && wasEmpty)) {
        ctx.clearRect(0, 0, size.w, size.h)
        for (const s of sorted) {
          if (!live.active.has(s.id)) continue
          ctx.fillStyle = hexA(s.color, 0.3)
          ctx.fillRect(toX(s.start), 0, toX(s.end) - toX(s.start), size.h)
        }
        for (const hd of live.heads) {
          ctx.fillStyle = hd.color ?? C.active
          ctx.fillRect(toX(hd.t) - 1, 0, 2, size.h)
        }
      }
      wasEmpty = empty
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [size, view, sorted, getLive])

  // ------------------------------------------------------------ interacción
  const tolerance = (ev) => (ev.pointerType === 'touch' ? 24 : 10)
  const localX = (ev) => ev.clientX - baseRef.current.getBoundingClientRect().left

  function hitTest(x, tol) {
    if (selectable && selection) {
      const ds = Math.abs(x - toX(selection.start)), de = Math.abs(x - toX(selection.end))
      if (Math.min(ds, de) <= tol) return { mode: ds <= de ? 'sel-start' : 'sel-end' }
    }
    if (onEdgeDrag && tool !== 'cut') {
      let best = null
      for (const s of sorted) {
        for (const edge of ['start', 'end']) {
          const d = Math.abs(x - toX(s[edge]))
          // en un borde compartido gana el 'start' del chop de la derecha
          if (d <= tol && (!best || d < best.d - 0.5 || (Math.abs(d - best.d) <= 0.5 && edge === 'start'))) best = { d, id: s.id, edge }
        }
      }
      if (best) return { mode: 'edge', id: best.id, edge: best.edge }
    }
    return null
  }

  const onPointerDown = (ev) => {
    if (ev.button > 0) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const x = localX(ev), t = toT(x)
    const hit = hitTest(x, tolerance(ev))
    if (hit) { dragRef.current = { ...hit, x0: x }; return }
    if (tool === 'cut' && onTapTime) { dragRef.current = { mode: 'tap', x0: x }; return }
    const s = sorted.find(q => t >= q.start && t < q.end)
    if (s && onSliceDown) { onSliceDown(s.id, t); dragRef.current = null; return }
    if (selectable) { dragRef.current = { mode: 'new-sel', anchor: t, x0: x }; return }
    if (onTapTime) dragRef.current = { mode: 'tap', x0: x }
  }

  const onPointerMove = (ev) => {
    const d = dragRef.current
    const x = localX(ev)
    if (!d) {
      if (ev.pointerType === 'mouse') {
        const hit = hitTest(x, 10)
        ev.currentTarget.style.cursor = hit ? 'ew-resize' : tool === 'cut' ? 'crosshair' : 'pointer'
      }
      return
    }
    const t = Math.max(0, Math.min(duration, toT(x)))
    if (d.mode === 'sel-start') onSelectionChange?.({ start: Math.min(t, selection.end - 0.05), end: selection.end })
    else if (d.mode === 'sel-end') onSelectionChange?.({ start: selection.start, end: Math.max(t, selection.start + 0.05) })
    else if (d.mode === 'edge') onEdgeDrag(d.id, d.edge, t)
    else if (d.mode === 'new-sel' && Math.abs(x - d.x0) > 4) {
      onSelectionChange?.({ start: Math.min(d.anchor, t), end: Math.max(d.anchor, t) })
    }
  }

  const onPointerUp = (ev) => {
    const d = dragRef.current
    dragRef.current = null
    if (d?.mode === 'tap' && Math.abs(localX(ev) - d.x0) < 8) onTapTime(toT(localX(ev)))
  }

  // zoom con rueda / trackpad
  useEffect(() => {
    const el = baseRef.current
    if (!el) return
    const onWheel = (ev) => {
      ev.preventDefault()
      const span = view.t1 - view.t0
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || ev.shiftKey) {
        const delta = ((ev.deltaX || ev.deltaY) / 600) * span
        setView(v => clampView({ t0: v.t0 + delta, t1: v.t1 + delta }, duration))
      } else {
        zoomAround(toT(localX(ev)), ev.deltaY > 0 ? 1.25 : 0.8)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  function zoomAround(center, factor) {
    setView(v => {
      const span = v.t1 - v.t0
      const ns = Math.max(MIN_SPAN, Math.min(duration, span * factor))
      const t0 = center - (center - v.t0) * (ns / span)
      return clampView({ t0, t1: t0 + ns }, duration)
    })
  }
  const center = selection ? (selection.start + selection.end) / 2 : (view.t0 + view.t1) / 2
  const zoomed = view.t1 - view.t0 < duration * 0.98

  return (
    <div className={`wave ${className}`}>
      <div className="wave-stage" ref={wrapRef}>
        <canvas ref={baseRef} role="img" aria-label={label}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={() => { dragRef.current = null }} />
        <canvas ref={liveRef} className="wave-live" aria-hidden="true" />
        <div className="wave-zoom">
          <button className="btn btn-icon" onClick={() => zoomAround(center, 0.6)} aria-label="Acercar"><ZoomIn size={16} /></button>
          <button className="btn btn-icon" onClick={() => zoomAround(center, 1.6)} aria-label="Alejar"><ZoomOut size={16} /></button>
          <button className="btn btn-icon" onClick={() => setView(clampView(fit ?? { t0: 0, t1: duration }, duration))} aria-label="Encuadrar"><Maximize2 size={15} /></button>
        </div>
      </div>
      {zoomed && <WaveOverview peaks={peaks} duration={duration} view={view} onChange={v => setView(clampView(v, duration))} />}
    </div>
  )
}

// ---------------------------------------------------------------- utilidades

export function clampView(v, duration) {
  let span = Math.max(MIN_SPAN, Math.min(duration, v.t1 - v.t0))
  let t0 = Math.max(0, Math.min(duration - span, v.t0))
  return { t0, t1: t0 + span }
}

let pal = null
function palette() {
  if (!pal) {
    pal = {
      sample: cssVar('--sample'), select: cssVar('--select'), selectSoft: cssVar('--select-soft'),
      active: cssVar('--active'), rec: cssVar('--rec'), muted: '#4a4f57', mono: cssVar('--mono'),
    }
  }
  return pal
}
