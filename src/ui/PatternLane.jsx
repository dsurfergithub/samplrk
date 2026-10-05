/**
 * PatternLane — la toma como bloques de colores (no es un piano roll).
 * El color de cada bloque es el de su chop: sample → chop → secuencia.
 * Con quantize activo se ven dos filas: tu toma (antes) y la ajustada (después).
 * El playhead y la cuenta atrás se pintan con rAF, sin re-render.
 */
import { useEffect, useRef } from 'react'
import { lengthBeats, effectiveEvents, secondsPerBeat } from '../engines/patternEngine'
import { position } from '../engines/sequencer'
import { padLetter } from '../engines/sliceModel'

function Blocks({ events, len, pads, slicesById, bpm, ghost = false }) {
  const sorted = [...events].sort((a, b) => a.beat - b.beat)
  return sorted.map((e, i) => {
    const next = sorted[i + 1]?.beat ?? len
    const durBeats = Math.min(e.duration / secondsPerBeat(bpm), Math.max(0.05, next - e.beat))
    const slice = slicesById.get(pads[e.padId])
    return (
      <span key={e.id} className={`lane-block${ghost ? ' is-ghost' : ''}`}
        style={{ left: `${(e.beat / len) * 100}%`, width: `${(durBeats / len) * 100}%`, '--chop': slice?.color ?? '#666' }}>
        {padLetter(e.padId)}
      </span>
    )
  })
}

export default function PatternLane({ pattern, pads, slicesById, bpm, recording }) {
  const headRef = useRef(null)
  const countRef = useRef(null)
  const trackRef = useRef(null)
  const len = pattern ? lengthBeats(pattern) : 8
  const quantized = pattern && pattern.quantize !== 'off'

  useEffect(() => {
    let raf
    const tick = () => {
      const pos = position()
      const head = headRef.current, count = countRef.current, track = trackRef.current
      if (head && track) {
        const on = pos.phase !== 'idle' && pos.beat >= 0
        head.style.opacity = on ? 1 : 0
        if (on) head.style.transform = `translateX(${(pos.loopBeat / pos.lengthBeats) * track.clientWidth}px)`
      }
      if (count) {
        const n = pos.phase === 'countin' ? Math.ceil(-pos.beat) : 0
        count.textContent = n > 0 ? String(n) : ''
        count.style.opacity = n > 0 ? 1 : 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className={`lane${recording ? ' is-recording' : ''}`} style={{ '--beats': len, '--bars': len / 4 }}>
      <div className="lane-track" ref={trackRef}>
        {quantized && (
          <div className="lane-row">
            <Blocks events={pattern.events} len={len} pads={pads} slicesById={slicesById} bpm={bpm} ghost />
          </div>
        )}
        <div className="lane-row">
          {pattern?.events.length
            ? <Blocks events={effectiveEvents(pattern)} len={len} pads={pads} slicesById={slicesById} bpm={bpm} />
            : <span className="lane-empty">{recording ? 'Toca los pads…' : 'Aquí aparecerá lo que toques.'}</span>}
        </div>
        <i className="lane-head" ref={headRef} aria-hidden="true" />
      </div>
      <div className="lane-count" ref={countRef} aria-live="assertive" />
      {quantized && (
        <p className="lane-legend">
          <span><i className="is-ghost" /> Tu toma (arriba)</span>
          <span><i /> Ajustada a {pattern.quantize} (abajo, la que suena)</span>
        </p>
      )}
    </div>
  )
}
