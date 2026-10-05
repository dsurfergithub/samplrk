/**
 * WaveOverview — mini mapa de toda la grabación cuando la onda está ampliada.
 * Arrastrar (o tocar) mueve la ventana visible. Pensado sobre todo para móvil,
 * donde no hay rueda del ratón.
 */
import { useEffect, useRef, useState } from 'react'
import { columns } from '../engines/waveformPeaks'
import { setupCanvas } from './theme'

export default function WaveOverview({ peaks, duration, view, onChange }) {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  const H = 28

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!w || !peaks) return
    const ctx = setupCanvas(ref.current, { w, h: H })
    const cols = columns(peaks, 0, duration, w)
    ctx.fillStyle = '#5b616b'
    for (let x = 0; x < w; x++) {
      const y1 = H / 2 - cols[x * 2 + 1] * H / 2
      const y2 = H / 2 - cols[x * 2] * H / 2
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1))
    }
  }, [w, peaks, duration])

  const moveTo = (ev) => {
    const rect = ref.current.getBoundingClientRect()
    const t = ((ev.clientX - rect.left) / rect.width) * duration
    const span = view.t1 - view.t0
    onChange({ t0: t - span / 2, t1: t + span / 2 })
  }

  return (
    <div className="wave-overview">
      <canvas
        ref={ref} aria-label="Mapa de la grabación: arrastra para moverte"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); moveTo(e) }}
        onPointerMove={(e) => { if (e.buttons) moveTo(e) }}
      />
      <div
        className="wave-overview-window"
        style={{ left: `${(view.t0 / duration) * 100}%`, width: `${((view.t1 - view.t0) / duration) * 100}%` }}
      />
    </div>
  )
}
