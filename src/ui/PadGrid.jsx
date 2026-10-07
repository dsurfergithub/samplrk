/**
 * PadGrid — rejilla de 8 (o 16) pads.
 * Enciende el pad que suena (usePadFlash) tocando el DOM directamente:
 * tocar rápido no provoca re-renders de React.
 */
import { useCallback, useRef } from 'react'
import Pad from './Pad'
import { usePadFlash } from './hooks'
import { padLetter, visiblePadCount } from '../engines/sliceModel'
import { DEFAULT_KEYMAP, keyLabel } from '../engines/keyboardMap'
import { hitPad } from '../actions/samplerActions'
import { useProject } from '../state/projectStore'

export default function PadGrid({ pads, slicesById, buffer, selectedSliceId }) {
  const els = useRef([])
  const os = useProject(p => p.settings?.oldSchool)
  // Old School: 8 pads, como en las máquinas de entonces
  const count = os?.enabled ? Math.min(visiblePadCount(pads), os.maxPads ?? 8) : visiblePadCount(pads)

  const registerEl = useCallback((i, el) => { els.current[i] = el }, [])
  const onHit = useCallback((i) => hitPad(i), [])

  usePadFlash(els)

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
