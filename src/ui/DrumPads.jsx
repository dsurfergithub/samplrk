/**
 * DrumPads — los cuatro pads de batería, separados de los chops:
 * más bajos y anchos, con el nombre de la pieza en dos idiomas.
 * Suenan en pointerdown; el destello lo pinta el DOM, sin re-render.
 */
import { useEffect, useRef } from 'react'
import { DRUM_PADS } from '../engines/drumKit'
import { keyLabel } from '../engines/keyboardMap'
import { subscribeSampler } from '../engines/samplerEngine'
import { getCtx } from '../engines/audioEngine'
import { hitDrum } from '../actions/drumActions'

export default function DrumPads({ ready }) {
  const els = useRef({})
  const timers = useRef({})

  useEffect(() => subscribeSampler((ev) => {
    if (ev.type !== 'start' || typeof ev.padKey !== 'string' || !ev.padKey.startsWith('drum:')) return
    const id = ev.padKey.slice(5)
    const el = els.current[id]
    if (!el) return
    const ms = Math.max(90, Math.min(400, (ev.endAt - ev.startAt) * 1000))
    const delay = Math.max(0, (ev.startAt - getCtx().currentTime) * 1000)
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => {
      el.style.setProperty('--hit-ms', `${ms}ms`)
      el.classList.remove('is-hit')
      void el.offsetWidth
      el.classList.add('is-hit')
      timers.current[id] = setTimeout(() => el.classList.remove('is-hit'), ms + 60)
    }, delay)
  }), [])

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  return (
    <div className="drum-grid" role="group" aria-label="Batería">
      {DRUM_PADS.map(d => (
        <button key={d.id} ref={el => { els.current[d.id] = el }} disabled={!ready}
          className="pad drum-pad" style={{ '--chop': d.color }}
          aria-label={`${d.label} (${d.name}). Tecla ${keyLabel(d.key)}`}
          onPointerDown={(e) => { if (e.button > 0) return; e.preventDefault(); hitDrum(d.id) }}
          onClick={(e) => { if (e.detail === 0) hitDrum(d.id) }}
          onContextMenu={(e) => e.preventDefault()}>
          <span className="drum-name">{d.name}</span>
          <span className="drum-label">{d.label}</span>
          <span className="pad-key">{keyLabel(d.key)}</span>
        </button>
      ))}
    </div>
  )
}
