/**
 * aiAssistant.js — ai_assistant
 * Motor de sugerencias basado en reglas sobre el estado del proyecto.
 * Filosofía: asistir, nunca sustituir. Cada sugerencia explica su motivo
 * y puede llevar una acción de un clic.
 */
import { keysCompatible, bpmCompatible } from './library'

/**
 * Calcula sugerencias contextuales.
 * `actions` inyecta callbacks de la app: { analyze, trimSilence, generateLoops,
 * gotoView, createLoopAt }.
 */
export function getSuggestions(state, actions) {
  const out = []
  const sample = state.samples.find(s => s.id === state.activeSampleId) || state.samples[0]

  if (state.samples.length === 0) {
    out.push({
      id: 'import',
      title: 'Importa o graba un sonido',
      reason: 'Todo en SAMPLRK nace de un Editable Sample. Sin audio no hay loops.',
      action: { label: 'Ir a Importar', run: () => actions.gotoView('import') },
    })
    return out
  }

  if (sample && !sample.analysis) {
    out.push({
      id: 'analyze',
      title: `Analiza «${sample.name}»`,
      reason: 'El análisis detecta BPM, tonalidad y golpes. Es la base para sugerir puntos de corte y loops que encajen al compás.',
      action: { label: 'Analizar ahora', run: () => actions.analyze(sample.id) },
    })
    return out
  }

  if (sample?.analysis) {
    const a = sample.analysis

    const startSilence = a.silences.find(s => s.start < 0.05 && s.end > 0.4)
    if (startSilence && sample.edits.trimStart < startSilence.end - 0.05) {
      out.push({
        id: 'trim-silence',
        title: 'Recorta el silencio inicial',
        reason: `Hay ${startSilence.end.toFixed(1)} s de silencio al principio. Si no lo recortas, los loops arrancarán tarde respecto al compás.`,
        action: { label: 'Recortar', run: () => actions.trimSilence(sample.id, startSilence.end) },
      })
    }

    if (a.bpmConfidence < 0.25) {
      out.push({
        id: 'bpm-low',
        title: `Revisa el BPM detectado (${a.bpm})`,
        reason: `La confianza de la detección es baja (${Math.round(a.bpmConfidence * 100)}%). Puede que el material tenga poco contenido rítmico; ajusta el BPM del proyecto a oído si algo suena desplazado.`,
      })
    }

    if (state.loops.length === 0) {
      out.push({
        id: 'gen-loops',
        title: 'Genera loops automáticos',
        reason: `Con BPM ${a.bpm} y tonalidad ${a.key} ${a.mode === 'minor' ? 'menor' : 'mayor'} detectados, puedo proponer cortes alineados al compás validados contra clics.`,
        action: { label: 'Generar loops', run: () => actions.generateLoops(sample.id) },
      })
    }

    if (a.transients.length > 8 && sample.slices.length === 0) {
      out.push({
        id: 'slices',
        title: 'Trocea el sample por golpes',
        reason: `He detectado ${a.transients.length} transitorios. Crear slices en cada golpe te da piezas listas para recombinar.`,
        action: { label: 'Crear slices', run: () => actions.autoSlice(sample.id) },
      })
    }
  }

  // compatibilidad entre loops
  const incompatiblePair = findIncompatiblePair(state.loops)
  if (incompatiblePair) {
    const [l1, l2] = incompatiblePair
    out.push({
      id: 'key-clash',
      title: `«${l1.name}» y «${l2.name}» pueden chocar`,
      reason: !keysCompatible(l1, l2)
        ? `Están en tonalidades no relacionadas (${l1.key} ${l1.mode} vs ${l2.key} ${l2.mode}). Si suenan a la vez pueden crear disonancias; usa el pitch de uno de ellos para acercarlos.`
        : `Sus BPM (${l1.bpm} vs ${l2.bpm}) obligan a un ajuste de velocidad superior al 33%, lo que degrada el timbre.`,
    })
  }

  if (state.loops.length >= 2 && state.scenes.length === 0) {
    out.push({
      id: 'first-scene',
      title: 'Guarda tu primera escena',
      reason: 'Activa 2–3 loops que suenen bien juntos y guárdalos como escena. Las escenas son los bloques con los que luego construirás la canción.',
      action: { label: 'Ir a Loops', run: () => actions.gotoView('loops') },
    })
  }

  if (state.scenes.length >= 2 && state.timeline.length === 0) {
    out.push({
      id: 'build-song',
      title: 'Construye la canción en la Timeline',
      reason: `Ya tienes ${state.scenes.length} escenas. Ordénalas como Intro → Verse → Drop → Outro y tendrás una estructura completa exportable a WAV.`,
      action: { label: 'Ir a Timeline', run: () => actions.gotoView('timeline') },
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'all-good',
      title: 'Todo en orden',
      reason: 'No veo nada que corregir ahora mismo. Sigue explorando: prueba a activar loops compatibles entre sí (los marco en cada tarjeta).',
    })
  }
  return out
}

function findIncompatiblePair(loops) {
  for (let i = 0; i < loops.length; i++) {
    for (let j = i + 1; j < loops.length; j++) {
      if (!keysCompatible(loops[i], loops[j]) || !bpmCompatible(loops[i], loops[j])) {
        return [loops[i], loops[j]]
      }
    }
  }
  return null
}
