/**
 * Pad — un pad físico. Suena en `pointerdown` (no en click) para que la
 * respuesta sea inmediata; el teclado (Enter/Espacio con foco) usa click.
 * El destello lo controla PadGrid directamente en el DOM, sin re-render.
 */
import { memo, useEffect, useRef } from 'react'
import { FlipHorizontal2 } from 'lucide-react'
import { peaksFor, columns } from '../engines/waveformPeaks'
import { formatSemitones } from '../engines/pitch'
import { setupCanvas, hexA } from './theme'

function MiniWave({ buffer, slice }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || !buffer) return
    const w = cv.clientWidth, h = cv.clientHeight
    if (!w) return
    const ctx = setupCanvas(cv, { w, h })
    const cols = columns(peaksFor(buffer), slice.start, slice.end, w)
    ctx.fillStyle = hexA(slice.color, 0.9)
    for (let x = 0; x < w; x++) {
      const c = slice.reversed ? w - 1 - x : x
      const y1 = h / 2 - cols[c * 2 + 1] * h / 2
      const y2 = h / 2 - cols[c * 2] * h / 2
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1))
    }
  }, [buffer, slice.start, slice.end, slice.color, slice.reversed])
  return <canvas ref={ref} className="pad-wave" aria-hidden="true" />
}

function Pad({ index, letter, keyHint, slice, buffer, selected, onHit, registerEl }) {
  if (!slice) {
    return (
      <div className="pad is-empty" ref={el => registerEl(index, el)} aria-label={`Pad ${letter} vacío`}>
        <span className="pad-letter">{letter}</span>
        <span className="pad-key">{keyHint}</span>
        <span className="pad-name">vacío</span>
      </div>
    )
  }
  const name = slice.name || `Chop ${letter}`  // nombre accesible; en pantalla solo si lo pones tú
  return (
    <button
      ref={el => registerEl(index, el)}
      className={`pad${selected ? ' is-selected' : ''}`}
      style={{ '--chop': slice.color }}
      aria-label={`Pad ${letter}: ${name}. Tecla ${keyHint}`}
      aria-pressed={selected}
      onPointerDown={(e) => {
        if (e.button > 0) return
        e.preventDefault() // evita foco/selección de texto y el retardo táctil
        onHit(index)
      }}
      onClick={(e) => { if (e.detail === 0) onHit(index) }} // teclado: Enter / Espacio
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="pad-letter">{letter}</span>
      <span className="pad-key">{keyHint}</span>
      <MiniWave buffer={buffer} slice={slice} />
      {slice.name && <span className="pad-name">{slice.name}</span>}
      <span className="pad-badges">
        {slice.pitch !== 0 && <span className="pad-badge">{formatSemitones(slice.pitch)}</span>}
        {slice.reversed && <span className="pad-badge" title="Reverse"><FlipHorizontal2 size={11} /></span>}
      </span>
    </button>
  )
}

export default memo(Pad)
