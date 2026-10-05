/**
 * coachEngine.js — SAMPLRK COACH (puro y determinista, sin red).
 *
 * El coach no hace el trabajo: observa lo que el usuario acaba de hacer y,
 * como mucho, dice una frase. Regla de oro: la app ayuda DESPUÉS, no antes.
 *   acción → escucha → descubrimiento → explicación
 *
 * `react(event, ctx, seen)` recibe un evento de la app y devuelve un mensaje
 * { id, kind, text, term? } o null. Los mensajes de tipo 'learned' explican
 * un concepto la primera vez (se recuerdan en `seen`); los 'hint' son pistas
 * opcionales que siempre se pueden ignorar.
 */
import { padLetter } from './sliceModel'

const PHRASE_GAP = 1.6   // s sin tocar → la frase ha terminado
const MIN_PHRASE = 4

/** Última frase tocada: golpes seguidos sin pausas largas. */
export function lastPhrase(hits) {
  if (!hits.length) return []
  let i = hits.length - 1
  while (i > 0 && hits[i].t - hits[i - 1].t <= PHRASE_GAP) i--
  return hits.slice(i).map(h => h.pad)
}

/**
 * Clasifica una frase respecto al orden de la grabación original.
 *  'original' → A B C D… (como sonaba el disco)
 *  'flip'     → orden alterado, repeticiones o saltos: una frase nueva
 *  'stutter'  → el mismo pad repetido (también es un recurso, pero aparte)
 *  null       → frase demasiado corta para decir nada
 */
export function classifyPhrase(phrase, order) {
  if (phrase.length < MIN_PHRASE) return null
  if (phrase.every(p => p === phrase[0])) return 'stutter'
  const pos = phrase.map(p => order.indexOf(p))
  const inOrder = pos.every((v, k) => k === 0 || v === pos[k - 1] + 1)
  return inOrder ? 'original' : 'flip'
}

/**
 * FLIP (definición única en SAMPLRK): transformar el sample para que deje de
 * funcionar como en la grabación original. Cuenta como flip reordenar chops
 * (o repetirlos), cambiarles el pitch o darles la vuelta (reverse).
 * Devuelve el tipo de flip que produce el evento, o null.
 */
export function flipKind(event, ctx = {}) {
  if (event.type === 'pad:hit') {
    return classifyPhrase(lastPhrase(ctx.hits ?? []), ctx.order ?? []) === 'flip' ? 'reorder' : null
  }
  if (event.type === 'record:done') {
    if (event.kind === 'drums') return null
    return classifyPhrase(event.sequence ?? [], ctx.order ?? []) === 'flip' ? 'reorder' : null
  }
  if (event.type === 'pitch:changed' && event.semitones) return 'pitch'
  if (event.type === 'reverse:on') return 'reverse'
  return null
}

const ALSO_FLIP = 'Transformar así el sample también es hacer un flip.'

/** Mensajes por evento. `ctx` aporta lo necesario para personalizar el texto. */
export function react(event, ctx = {}, seen = new Set()) {
  const once = (id, msg) => (seen.has(id) ? null : { id, ...msg })

  switch (event.type) {
    case 'cut:confirmed':
      return once('learned:sample', {
        kind: 'learned', term: 'sample',
        text: 'Has creado un sample: un trozo de una grabación que ahora vas a usar como instrumento.',
      })

    case 'cut:long':
      return once('hint:long-cut', {
        kind: 'hint',
        text: 'Es un fragmento largo. Los samples cortos (2–6 segundos) son más fáciles de trocear.',
      })

    case 'loop:on':
      return once('learned:loop', {
        kind: 'learned', term: 'loop',
        text: 'Esto es un loop: un fragmento que se repite sin parar. Escucha si entra y termina bien, sin saltos.',
      })

    case 'chops:created':
      return once('learned:chop', {
        kind: 'learned', term: 'chop',
        text: `Cada pieza se llama chop (o slice). Tienes ${event.count}: tócalos con los pads o con el teclado.`,
      })

    case 'chops:many':
      return once('hint:few-pads', {
        kind: 'hint',
        text: 'No necesitas usar todos los pads. A veces tres chops bien elegidos bastan.',
      })

    case 'pad:hit': {
      const kind = classifyPhrase(lastPhrase(ctx.hits ?? []), ctx.order ?? [])
      if (kind === 'flip') {
        return once('learned:flip', {
          kind: 'learned', term: 'flip',
          text: 'Eso ya es un flip: has reorganizado partes del sample para crear una frase que no existía así en la grabación. Cambiar el pitch o darle la vuelta a un chop también son flips.',
        })
      }
      if (kind === 'original' && !seen.has('learned:flip')) {
        const third = ctx.order?.[2]
        const letter = third !== undefined ? padLetter(third) : 'otro pad'
        return once('hint:break-order', {
          kind: 'hint',
          text: `Así sonaba la grabación original. Ahora prueba a romper el orden: ¿qué ocurre si empiezas por ${letter}?`,
        })
      }
      if (kind === 'stutter') {
        return once('hint:stutter', {
          kind: 'hint',
          text: 'Repetir un mismo chop muy rápido es un recurso clásico. Prueba a dejar silencio entre dos golpes.',
        })
      }
      return null
    }

    case 'record:done':
      return once('learned:pattern', {
        kind: 'learned', term: 'pattern',
        text: `Has grabado tu primer pattern (${event.count} golpes). SAMPLRK no ha grabado audio: ha anotado qué pad tocaste y cuándo. Por eso, si cambias el pitch de un chop, la toma suena distinta al instante.`,
      })

    case 'midi:soft':
      return once('learned:velocity', {
        kind: 'learned', term: 'velocity',
        text: 'Tu controlador envía la fuerza de cada golpe: más suave, más bajo. Eso se llama velocity, y las tomas la recuerdan.',
      })

    case 'drum:choke':
      return once('learned:choke', {
        kind: 'learned', term: 'choke',
        text: '¿Has notado que el charles cerrado corta al abierto? Eso se llama choke: como en una batería de verdad, cerrar el charles apaga su sonido.',
      })

    case 'record:empty':
      return {
        id: 'hint:record-empty', kind: 'hint',
        text: 'No he oído ningún golpe. Cuando termine la cuenta atrás (4, 3, 2, 1), toca los pads.',
      }

    case 'quantize:on':
      return once('learned:quantize', {
        kind: 'learned', term: 'quantize',
        text: 'Esto se llama quantize: cada golpe se mueve al punto más cercano de la rejilla. Tu toma original sigue guardada: vuelve a «Original» para comparar.',
      })

    case 'quantize:off':
      return seen.has('learned:quantize') ? once('hint:groove', {
        kind: 'hint',
        text: 'El groove no siempre significa tocar exactamente sobre la rejilla. Esas pequeñas imperfecciones también son tu manera de tocar.',
      }) : null

    case 'pitch:changed': {
      const st = event.semitones
      if (!st) return null
      const dir = st < 0 ? 'bajado' : 'subido'
      const longer = st < 0 ? 'más largo y más grave' : 'más corto y más agudo'
      return once('learned:pitch', {
        kind: 'learned', term: 'pitch',
        text: `Has ${dir} el pitch ${Math.abs(st)} semitonos. ¿Notas que también cambia la duración? Suena ${longer}: así funcionaban los samplers clásicos. ${ALSO_FLIP}`,
      })
    }

    case 'reverse:on':
      return once('learned:reverse', {
        kind: 'learned', term: 'reverse',
        text: `Esto se llama reverse: el chop suena de atrás hacia delante. Funciona muy bien en platos y voces. ${ALSO_FLIP}`,
      })

    default:
      return null
  }
}
