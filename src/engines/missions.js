/**
 * missions.js — el recorrido del Modo Aprendizaje (puro).
 *
 * Cada misión es UNA instrucción, en la pantalla donde se hace, y se cumple
 * con una acción real (no con un botón «Siguiente»). Nada se bloquea: se
 * puede saltar cualquier misión o hacerlas en otro orden.
 *
 *   currentMission  → primera misión sin cumplir ni saltar
 *   justCompleted   → misión cumplida que el usuario aún no ha "cerrado"
 *                     (para el momento «Misión cumplida → Seguir / Quedarme»)
 *
 * Los textos usan vocabulario sencillo primero; el término técnico llega
 * después de la acción (lo dice el coach o el «¿Sabías que…?»).
 */

export const MISSIONS = [
  {
    id: 'find', step: 'Find', screens: ['source', 'cut'], done: p => p.findComplete,
    title: 'Escucha. ¿Hay algún momento que te guste?',
    sub: 'Elige un disco, dale a escuchar y, cuando oigas algo que te llame, pulsa «Aquí hay algo».',
    success: 'Has encontrado tu momento. Así empieza todo sample: con el oído.',
    fact: 'Crate digging («rebuscar en cajas») es como llaman los productores a buscar discos olvidados en tiendas de segunda mano para encontrar un sample.',
  },
  {
    id: 'loop', step: 'Cut', covers: ['learned:loop'], screens: ['cut'], done: p => p.loopComplete,
    title: 'Pulsa «Repetir».',
    sub: 'Tu fragmento sonará una y otra vez. Escucha si entra y termina bien; si no, mueve los tiradores mientras suena.',
    success: 'Eso que se repite es un loop.',
    fact: 'Mucho antes de los samplers ya se hacían loops pegando un trozo de cinta magnética en círculo.',
  },
  {
    id: 'cut', step: 'Cut', covers: ['learned:sample'], screens: ['cut'], done: p => p.cutComplete,
    title: 'Cuando te guste, quédatelo.',
    sub: 'Pulsa «Este es mi sample». Siempre podrás volver y cambiar el corte.',
    success: 'Ya tienes tu sample: un trozo de grabación que vas a usar como instrumento.',
  },
  {
    id: 'chop', step: 'Chop', covers: ['learned:chop'], screens: ['chop'], done: p => p.chopComplete,
    title: 'Trocea tu sample.',
    sub: 'Elige cómo cortar: te puedo sugerir cortes o puedes hacerlos tú. Cada trozo irá a un pad.',
    success: 'Cada trozo se llama chop (o slice).',
    fact: 'El E-mu SP-1200 (1987), un clásico del hip hop, tenía solo unos 10 segundos de memoria: había que trocear muy bien.',
  },
  {
    id: 'play', step: 'Play', screens: ['chop'], done: p => p.playComplete,
    title: ({ letters }) => `Toca los pads en orden: ${letters.slice(0, 4).join(' ')}.`,
    sub: 'Con el dedo, el ratón o las teclas 1 2 3 4. Así sonaba la grabación original.',
    success: 'Así sonaba el disco. Ahora viene lo divertido.',
  },
  {
    id: 'reorder', step: 'Flip', covers: ['learned:flip', 'hint:break-order'], screens: ['chop'], done: p => p.reorderComplete,
    title: 'Ahora rompe el orden.',
    sub: 'No hay respuesta correcta. Repite uno, sáltate otro, deja silencios. Por ejemplo:',
    examples: ({ letters }) => {
      const [a, b, c, d] = letters
      if (!d) return []
      return [`${a} ${c} ${b} ${c}`, `${c} ${c} ${a} ${d}`, `${a} ${d} ${a} ${b}`]
    },
    success: 'Eso es un flip: una frase que no existía así en la grabación.',
    fact: '«Flip» es como llaman los productores a darle la vuelta a un sample para que suene a algo nuevo.',
  },
  {
    id: 'grid', step: 'Grid', covers: ['learned:pattern'], screens: ['grid'], done: p => p.gridComplete,
    title: 'Escribe tu frase en la rejilla.',
    sub: 'Cada fila es un chop y cada columna, un paso del ritmo. Pulsa una celda para poner un golpe y dale a Play. Por ejemplo:',
    examples: ({ letters }) => {
      const [a, b, c, d] = letters
      if (!c) return []
      return d ? [`${a} ${c} ${c} ${b}`, `${a} ${b} ${a} ${d}`] : [`${a} ${c} ${c} ${b}`]
    },
    success: 'Has escrito tu primer pattern sin tocar en directo: una lista de qué chop suena y en qué momento.',
    fact: 'La Roland TR-808 (1980) se programaba así: paso a paso, con 16 botones, sin tocar en directo. Esa forma de escribir ritmos se hizo clásica.',
  },
  {
    id: 'pitch', step: 'Flip', covers: ['learned:pitch'], screens: ['chop'], done: p => p.pitchComplete,
    title: 'Cambia el pitch de un chop.',
    sub: 'Elige un pad y baja su pitch. Si tu pattern está sonando, oirás el cambio al instante.',
    success: '¿Notas que también cambia la duración? Más grave es más largo; más agudo, más corto: así funcionaban los samplers clásicos.',
    fact: 'Para que cupiera más música en tan poca memoria, muchos productores sampleaban discos a 45 rpm en vez de 33 y luego bajaban el pitch.',
  },
  {
    id: 'reverse', step: 'Flip', covers: ['learned:reverse'], screens: ['chop'], done: p => p.reverseComplete,
    title: 'Dale la vuelta a un chop.',
    sub: 'Activa «Reverse» en un pad y escucha cómo suena de atrás hacia delante.',
    success: 'Pitch, reverse, cambiar el orden: todo eso es transformar el sample.',
  },
  {
    id: 'drums', step: 'Drums', screens: ['drums'], done: p => p.drumsComplete,
    title: 'Vamos a darle ritmo.',
    sub: 'Tu pattern sonará de fondo. Graba batería encima con J (bombo), K (caja) y L (charles). Por ejemplo: bombo en el 1 y el 3, caja en el 2 y el 4.',
    success: 'Has añadido batería: ahora tu frase tiene ritmo.',
    fact: 'En el hip hop clásico la batería también se sampleaba: los productores troceaban «breaks», los momentos de un disco en que solo suena la batería.',
  },
  {
    id: 'beat', step: 'Beat', screens: ['beat'], done: p => p.beatComplete,
    title: 'Escucha tu primer beat.',
    sub: 'Dale al play. Si te gusta, expórtalo como WAV para llevártelo.',
    success: 'Este es tu primer beat. Lo has hecho tú, trozo a trozo.',
  },
  {
    id: 'resample', step: 'Beat', screens: ['beat'], done: p => p.resampleComplete, covers: ['learned:resample'],
    title: 'Resamplea tu beat.',
    sub: 'Pulsa «Resamplear»: tu beat entero se convierte en un sample nuevo que puedes volver a trocear. El original queda guardado.',
    success: 'Eso es resampling: tu propio beat convertido en material nuevo para seguir creando.',
    fact: 'Resamplear también servía para ahorrar memoria y pads: varias capas se convertían en un solo sonido que ocupaba un pad.',
  },
]

/**
 * Mensajes del coach que ya explica una misión. En Modo Aprendizaje no se
 * repiten (una sola voz por concepto); en Modo Libre el coach los dice él.
 */
export const COVERED_MESSAGES = new Set(MISSIONS.flatMap(m => m.covers ?? []))

/** Misiones futuras: se ven en la lista de progreso, todavía no se pueden hacer. */
export const UPCOMING = []

export const CHECKLIST_LABELS = {
  find: 'Encontrar un momento', loop: 'Crear un loop', cut: 'Cortar un sample',
  chop: 'Crear chops', play: 'Tocar los pads', reorder: 'Hacer un flip (cambiar el orden)',
  grid: 'Escribir un pattern en la rejilla', pitch: 'Cambiar el pitch', reverse: 'Usar reverse',
  drums: 'Añadir batería', beat: 'Escuchar tu primer beat', resample: 'Resamplear',
}

/**
 * Prácticas opcionales: no son misiones (nunca se piden ni bloquean nada),
 * pero cuentan como «lo has probado» en la lista. Grabar en directo es una
 * manera más de escribir un pattern, no el camino principal.
 */
export const OPTIONAL_PRACTICE = [
  { id: 'record', label: 'Grabar en directo', done: p => p.recordComplete },
]

export const isDone = (m, progress, skipped = []) => !!m.done(progress) || skipped.includes(m.id)

export function currentMissionIndex(progress, skipped = []) {
  const i = MISSIONS.findIndex(m => !isDone(m, progress, skipped))
  return i === -1 ? MISSIONS.length : i
}

export function currentMission(progress, skipped = []) {
  return MISSIONS[currentMissionIndex(progress, skipped)] ?? null
}

/**
 * La misión cumplida más reciente que aún no se ha cerrado con «Seguir» o
 * «Quedarme». Solo cuentan las anteriores a la misión actual (si alguien
 * cambia el pitch antes de tiempo, eso no interrumpe la misión en curso).
 */
export function justCompleted(progress, skipped = [], acked = []) {
  const cur = currentMissionIndex(progress, skipped)
  for (let i = cur - 1; i >= 0; i--) {
    const m = MISSIONS[i]
    if (m.done(progress) && !acked.includes(m.id) && !skipped.includes(m.id)) return m
  }
  return null
}

/** Ids de todas las misiones cumplidas (para cerrarlas de una vez). */
export function doneIds(progress) {
  return MISSIONS.filter(m => m.done(progress)).map(m => m.id)
}

/** Texto de la misión con datos del proyecto (letras de pads, etc.). */
export function resolve(field, ctx) {
  return typeof field === 'function' ? field(ctx) : field
}

/** Lista de progreso «Sampling Basics». Solo conceptos objetivos, nunca nota de calidad. */
export function checklist(progress, skipped = []) {
  return [
    ...MISSIONS.map(m => ({
      id: m.id, label: CHECKLIST_LABELS[m.id],
      done: !!m.done(progress), skipped: skipped.includes(m.id) && !m.done(progress),
    })),
    ...OPTIONAL_PRACTICE.map(o => ({ id: o.id, label: o.label, done: !!o.done(progress), optional: true })),
    ...UPCOMING.map(u => ({ id: u.id, label: u.label, done: false, upcoming: true })),
  ]
}
