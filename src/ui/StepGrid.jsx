/**
 * StepGrid — la rejilla de pasos del Grid Lab. Filas = chops (cada cabecera es
 * su pad, con el color del chop), columnas = pasos del ritmo.
 *
 *  · Clic en una celda = poner/quitar un golpe. Con el ratón, arrastrar pinta
 *    (o borra) varias celdas seguidas. En pantalla táctil, un toque; deslizar
 *    desplaza la rejilla sin tocar nada.
 *  · Teclado: flechas para moverse, Espacio/Enter para poner/quitar.
 *  · El playhead y los destellos se pintan con rAF sobre el DOM (sin re-render):
 *    al sonar un golpe se ilumina su celda y, por el sampler, su pad.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { position } from '../engines/sequencer'
import { cellKey, stepAtBeat, stepBeats, stepLabel, stepsPerBar, stepsPerBeat } from '../engines/gridModel'
import { usePadFlash } from './hooks'

const Row = memo(function Row({ ri, padIndex, letter, color, bits, steps, perBeat, perBar, tab }) {
  const cells = []
  for (let s = 0; s < steps; s++) {
    const on = bits[s] === '1'
    const beat = Math.floor(s / perBeat)
    const cls = `sg-cell${on ? ' is-on' : ''}${s % perBeat === 0 ? ' is-beat' : ''}${s % perBar === 0 ? ' is-bar' : ''}${beat % 2 ? ' is-alt' : ''}`
    cells.push(
      <button key={s} type="button" className={cls} data-row={ri} data-pad={padIndex} data-step={s}
        tabIndex={s === tab ? 0 : -1} aria-pressed={on}
        aria-label={`Pad ${letter}, compás ${Math.floor(s / perBar) + 1}, paso ${(s % perBar) + 1}`}>
        {on && letter}
      </button>,
    )
  }
  return <div className="sg-row" style={{ '--chop': color }}>{cells}</div>
})

const cellOf = (el) => el?.closest?.('.sg-cell') ?? null
let gestureSeq = 0 // cada arrastre es un solo paso de «deshacer»

export default function StepGrid({ rows, res, steps, cells, disabled, onSet, onAudition }) {
  const perBeat = stepsPerBeat(res)
  const perBar = stepsPerBar(res)
  const bodyRef = useRef(null)
  const scrollRef = useRef(null)
  const headRef = useRef(null)
  const padEls = useRef([])
  const drag = useRef(null)           // { on, last } mientras se pinta con el ratón
  const lastType = useRef('mouse')
  const [focus, setFocus] = useState({ row: 0, step: 0 })
  usePadFlash(padEls)

  // ---- punteros: el ratón actúa al pulsar (y pinta al arrastrar); el toque, al soltar (click)
  const apply = (c, on, first, key = null) => onSet(Number(c.dataset.pad), Number(c.dataset.step), on, { audition: first, key })

  const onPointerDown = (e) => {
    lastType.current = e.pointerType
    if (disabled || e.pointerType === 'touch' || e.button > 0) return
    const c = cellOf(e.target)
    if (!c) return
    e.preventDefault() // sin foco ni selección de texto al arrastrar
    const on = !c.classList.contains('is-on')
    drag.current = { on, last: c, key: `grid:paint:${++gestureSeq}` }
    apply(c, on, true, drag.current.key)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    if (e.buttons !== 1) { drag.current = null; return }
    const c = cellOf(e.target)
    if (!c || c === d.last) return
    d.last = c
    apply(c, d.on, false, d.key)
  }
  const onClick = (e) => {
    if (disabled) return
    const c = cellOf(e.target)
    if (!c) return
    if (e.detail !== 0 && lastType.current !== 'touch') return // ratón: ya actuó pointerdown
    apply(c, !c.classList.contains('is-on'), true)
  }
  useEffect(() => {
    const end = () => { drag.current = null }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
  }, [])

  // ---- teclado: una sola celda en el orden de tabulación; las flechas mueven el foco
  const onFocus = (e) => {
    const c = cellOf(e.target)
    if (c) setFocus({ row: Number(c.dataset.row), step: Number(c.dataset.step) })
  }
  const onKeyDown = (e) => {
    const c = cellOf(e.target)
    const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key]
    if (!c || !move) return
    e.preventDefault()
    const row = Number(c.dataset.row) + move[0]
    const step = Number(c.dataset.step) + move[1]
    bodyRef.current.querySelector(`.sg-cell[data-row="${row}"][data-step="${step}"]`)?.focus()
  }

  // ---- playhead y destellos (rAF, sin React)
  useEffect(() => {
    let raf
    let last = -1
    let lastVisible = false
    const stepB = stepBeats(res)
    const lenB = steps * stepB
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const head = headRef.current
      const body = bodyRef.current
      if (!head || !body) return
      const pos = position()
      if (pos.phase === 'idle' || pos.beat < 0 || !pos.lengthBeats) {
        if (last !== -1) { head.style.opacity = 0; last = -1 }
        return
      }
      const step = stepAtBeat(pos.loopBeat % lenB, res, lenB / 4)
      if (step === last) return
      const wrapped = step < last
      last = step
      head.style.opacity = 1
      head.style.transform = `translateX(${step * 100}%)`
      // la celda de cada golpe que suena ahora
      for (const row of body.querySelectorAll('.sg-row')) {
        const cell = row.children[step]
        if (cell?.classList.contains('is-on')) {
          cell.classList.remove('is-hit')
          void cell.offsetWidth // reinicia la animación
          cell.classList.add('is-hit')
        }
      }
      // si la rejilla es más ancha que la pantalla, pasa de página con el playhead
      // (solo si lo estabas siguiendo: no te quita el sitio si miras otra parte)
      const sc = scrollRef.current
      if (sc && sc.scrollWidth > sc.clientWidth + 2) {
        const cw = body.clientWidth / steps
        const x = step * cw
        const right = sc.scrollLeft + sc.clientWidth
        const visible = x >= sc.scrollLeft - 1 && x + cw <= right + 1
        const leftByRight = x + cw > right && x < right + cw * 1.5 // se ha salido justo por la derecha
        if (!visible && lastVisible && (leftByRight || wrapped)) {
          sc.scrollLeft = Math.max(0, x - cw * 2)
          lastVisible = true
        } else {
          lastVisible = visible
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [res, steps])

  const data = rows.map(r => ({
    ...r,
    bits: Array.from({ length: steps }, (_, s) => (cells.has(cellKey(r.i, s)) ? '1' : '0')).join(''),
  }))
  const focusRow = Math.min(focus.row, rows.length - 1)
  const focusStep = Math.min(focus.step, steps - 1)

  return (
    <div className={`sg${disabled ? ' is-disabled' : ''}`} style={{ '--steps': steps }}>
      <div className="sg-pads" role="group" aria-label="Chops">
        <div className="sg-corner" aria-hidden="true" />
        {rows.map(r => (
          <button key={r.i} type="button" className="sg-pad" style={{ '--chop': r.color }}
            ref={el => { padEls.current[r.i] = el }}
            aria-label={`Pad ${r.letter}: oír el chop. Tecla ${r.keyHint}`}
            onPointerDown={(e) => { if (e.button > 0) return; e.preventDefault(); onAudition(r.i) }}
            onClick={(e) => { if (e.detail === 0) onAudition(r.i) }}
            onContextMenu={(e) => e.preventDefault()}>
            <b>{r.letter}</b>
            <small>{r.keyHint}</small>
          </button>
        ))}
      </div>

      <div className="sg-scroll" ref={scrollRef}>
        <div className="sg-body" ref={bodyRef} role="group" aria-label="Rejilla de pasos"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onClick={onClick}
          onFocus={onFocus} onKeyDown={onKeyDown}>
          <div className="sg-ruler" aria-hidden="true">
            {Array.from({ length: steps }, (_, s) => (
              <span key={s} className={`${s % perBeat === 0 ? 'is-beat' : ''}${s % perBar === 0 ? ' is-bar' : ''}`}>{stepLabel(s, res)}</span>
            ))}
          </div>
          {data.map((r, ri) => (
            <Row key={r.i} ri={ri} padIndex={r.i} letter={r.letter} color={r.color} bits={r.bits}
              steps={steps} perBeat={perBeat} perBar={perBar} tab={ri === focusRow ? focusStep : -1} />
          ))}
          <i className="sg-head" ref={headRef} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
