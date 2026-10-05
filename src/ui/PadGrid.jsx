/**
 * PadGrid — rejilla de 8 (o 16) pads.
 * Escucha al samplerEngine y enciende el pad que suena tocando el DOM
 * directamente: tocar rápido no provoca re-renders de React.
 */
import { useCallback, useEffect, useRef } from 'react'
import Pad from './Pad'
import { subscribeSampler } from '../engines/samplerEngine'
import { padLetter, visiblePadCount } from '../engines/sliceModel'
import { DEFAULT_KEYMAP, keyLabel } from '../engines/keyboardMap'
import { hitPad } from '../actions/samplerActions'

export default function PadGrid({ pads, slicesById, buffer, selectedSliceId }) {
  const els = useRef([])
  const timers = useRef([])
  const count = visiblePadCount(pads)

  const registerEl = useCallback((i, el) => { els.current[i] = el }, [])
  const onHit = useCallback((i) => hitPad(i), [])

  useEffect(() => subscribeSampler((ev) => {
    if (typeof ev.padKey !== 'number') return
    const el = els.current[ev.padKey]
    if (!el) return
    if (ev.type === 'start') {
      const ms = Math.max(80, (ev.endAt - ev.startAt) * 1000)
      el.style.setProperty('--hit-ms', `${ms}ms`)
      el.classList.remove('is-hit')
      void el.offsetWidth // reinicia la animación al re-disparar
      el.classList.add('is-hit')
      clearTimeout(timers.current[ev.padKey])
      timers.current[ev.padKey] = setTimeout(() => el.classList.remove('is-hit'), ms + 60)
    }
  }), [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return (
    <div className={`pad-grid${count === 16 ? ' is-16' : ''}`} role="group" aria-label="Pads">
      {pads.slice(0, count).map((id, i) => (
        <Pad
          key={i}
          index={i}
          letter={padLetter(i)}
          keyHint={keyLabel(DEFAULT_KEYMAP[i])}
          slice={id ? slicesById.get(id) : null}
          buffer={buffer}
          selected={!!id && id === selectedSliceId}
          onHit={onHit}
          registerEl={registerEl}
        />
      ))}
    </div>
  )
}
