import { describe, it, expect } from 'vitest'
import { MISSIONS, currentMission, justCompleted, checklist, resolve, doneIds } from '../src/engines/missions.js'

const P = (keys = []) => Object.fromEntries(keys.map(k => [k, true]))

describe('misiones', () => {
  it('empieza por escuchar', () => {
    expect(currentMission(P()).id).toBe('find')
  })

  it('avanza con las acciones reales, en orden', () => {
    expect(currentMission(P(['findComplete'])).id).toBe('loop')
    expect(currentMission(P(['findComplete', 'loopComplete', 'cutComplete'])).id).toBe('chop')
  })

  it('saltar una misión no bloquea el resto', () => {
    expect(currentMission(P(['findComplete']), ['loop']).id).toBe('cut')
  })

  it('al terminar todas no hay misión actual', () => {
    const all = P(['findComplete', 'loopComplete', 'cutComplete', 'chopComplete', 'playComplete',
      'reorderComplete', 'recordComplete', 'pitchComplete', 'reverseComplete'])
    expect(currentMission(all)).toBeNull()
  })

  it('«misión cumplida» aparece una vez, hasta que se cierra', () => {
    const p = P(['findComplete'])
    expect(justCompleted(p).id).toBe('find')
    expect(justCompleted(p, [], ['find'])).toBeNull()
  })

  it('hacer algo antes de tiempo no interrumpe la misión actual', () => {
    const p = P(['findComplete', 'pitchComplete'])
    expect(currentMission(p).id).toBe('loop')
    expect(justCompleted(p, [], ['find'])).toBeNull()
    expect(doneIds(p)).toEqual(['find', 'pitch'])
  })

  it('una misión saltada no cuenta como cumplida', () => {
    expect(justCompleted(P(), ['find'])).toBeNull()
  })

  it('los textos se adaptan a los pads del proyecto', () => {
    const play = MISSIONS.find(m => m.id === 'play')
    expect(resolve(play.title, { letters: ['A', 'B', 'C', 'D', 'E'] })).toBe('Toca los pads en orden: A B C D.')
    const reorder = MISSIONS.find(m => m.id === 'reorder')
    expect(resolve(reorder.examples, { letters: ['A', 'B', 'C', 'D'] })).toEqual(['A C B C', 'C C A D', 'A D A B'])
    expect(resolve(reorder.examples, { letters: ['A', 'B'] })).toEqual([])
  })

  it('la lista de progreso solo mide conceptos, e incluye lo que viene', () => {
    const list = checklist(P(['findComplete']), ['loop'])
    expect(list[0]).toMatchObject({ id: 'find', done: true })
    expect(list[1]).toMatchObject({ id: 'loop', done: false, skipped: true })
    expect(list.find(x => x.id === 'drums').upcoming).toBe(true)
    for (const x of list) expect(Object.keys(x)).not.toContain('score')
  })
})

import { COVERED_MESSAGES } from '../src/engines/missions.js'

describe('una sola voz por concepto', () => {
  it('las misiones cubren las explicaciones del coach que repetirían', () => {
    for (const id of ['learned:flip', 'hint:break-order', 'learned:pitch', 'learned:pattern']) expect(COVERED_MESSAGES.has(id)).toBe(true)
    // pistas que ninguna misión da siguen siendo del coach
    for (const id of ['hint:groove', 'learned:quantize', 'hint:stutter']) expect(COVERED_MESSAGES.has(id)).toBe(false)
  })
})
