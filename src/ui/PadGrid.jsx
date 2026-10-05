/**
 * PadGrid — rejilla de 8 (o 16) pads.
 * Escucha al samplerEngine y enciende el pad que suena tocando el DOM
 * directamente: tocar rápido no provoca re-renders de React.
 */
import { useCallback, useEffect, useRef } from 'react'
import Pad from './Pad'
import { subscribeSampler } from '../engines/samplerEngine'
import { getCtx } from '../engines/audioEngine'
import { padLetter, visiblePadCount } from '../engines/sliceModel'
import { DEFAULT_KEYMAP, keyLabel } from '../engines/keyboardMap'
import { hitPad } from '../actions/samplerActions'
import { useProject } from '../state/projectStore'

export default function PadGrid({ pads, slicesById, buffer, selectedSliceId }) {
  const els = useRef([])
  const timers = useRef([])
  const os = useProject(p => p.settings?.oldSchool)
  // Old School: 8 pads, como en las máquinas de entonces
  const count = os?.enabled ? Math.min(visiblePadCount(pads), os.maxPads ?? 8) : visiblePadCount(pads)

  const registerEl = useCallback((i, el) => { els.current[i] = el }, [])
  const onHit = useCallback((i) => hitPad(i), [])

  useEffect(() => subscribeSampler((ev) => {
    if (typeof ev.padKey !== 'number') return
    const el = els.current[ev.padKey]
    if (!el) return
    if (ev.type !== 'start') return
    const ms = Math.max(80, (ev.endAt - ev.startAt) * 1000)
    // los golpes del pattern se programan por adelantado: el destello espera a que suenen
    const delay = Math.max(0, (ev.startAt - getCtx().currentTime) * 1000)
    const k = ev.padKey
    clearTimeout(timers.current[k])
    timers.current[k] = setTimeout(() => {
      el.style.setProperty('--hit-ms', `${ms}ms`)
      el.classList.remove('is-hit')
      void el.offsetWidth // reinicia la animación al re-disparar
      el.classList.add('is-hit')
      timers.current[k] = setTimeout(() => el.classList.remove('is-hit'), ms + 60)
    }, delay)
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
