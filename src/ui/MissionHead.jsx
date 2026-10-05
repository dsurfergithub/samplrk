/**
 * MissionHead — la cabecera de cada pantalla.
 *
 * Modo Aprendizaje: la cabecera ES la misión (una sola instrucción por
 * pantalla, sin ventanas modales). Al cumplirla aparece «Misión cumplida»
 * con [Seguir] y [Quedarme aquí y experimentar]. Siempre se puede saltar.
 * Modo Libre (o misión en otra pantalla): la cabecera normal de la pantalla.
 */
import { useMemo, useState } from 'react'
import { Check, ArrowRight, Lightbulb, SkipForward } from 'lucide-react'
import { useLearning } from '../state/learningStore'
import { useProject } from '../state/projectStore'
import { MISSIONS, currentMissionIndex, justCompleted, resolve } from '../engines/missions'
import { originalOrder, padLetter } from '../engines/sliceModel'
import { skipMission, continueMissions, stayAndExplore, goToCurrentMission } from '../actions/learningActions'

export function useMissionContext() {
  const pads = useProject(p => p.padBanks[0].pads)
  const slices = useProject(p => p.slices)
  const activeId = useProject(p => p.activeSampleId)
  return useMemo(() => {
    const own = slices.filter(s => s.sampleId === activeId)
    const letters = originalOrder(pads, own).map(padLetter)
    return { letters: letters.length ? letters : ['A', 'B', 'C', 'D'] }
  }, [pads, slices, activeId])
}

function Default({ eyebrow, title, sub }) {
  return (
    <>
      <div className="eyebrow">{eyebrow[0]} <span>· {eyebrow[1]}</span></div>
      <h2 className="screen-title">{title}</h2>
      {sub && <p className="screen-sub">{sub}</p>}
    </>
  )
}

export default function MissionHead({ screen, eyebrow, title, sub, lock = false }) {
  const mode = useProject(p => p.mode)
  const { progress, skipped, acked, exploring } = useLearning(s => s)
  const ctx = useMissionContext()
  const fallback = <Default eyebrow={eyebrow} title={title} sub={sub} />

  // en modo libre, o mientras algo está en marcha (grabando), manda la pantalla
  if (mode !== 'learning' || lock) return <header className="screen-head">{fallback}</header>

  const idx = currentMissionIndex(progress, skipped)
  const mission = MISSIONS[idx] ?? null
  const done = justCompleted(progress, skipped, acked)
  const total = MISSIONS.length

  if (done) return <Success key={done.id} done={done} hasNext={!!mission} />

  // ---------------------------------------------------------- misión en esta pantalla
  if (mission && !exploring && mission.screens.includes(screen)) {
    const examples = resolve(mission.examples, ctx) ?? []
    return (
      <header className="screen-head mission">
        <div className="eyebrow mission-eyebrow">
          Misión {idx + 1} de {total} <span>· {mission.step}</span>
          <span className="mission-dots" aria-hidden="true">
            {MISSIONS.map((m, i) => <i key={m.id} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''} />)}
          </span>
        </div>
        <h2 className="screen-title">{resolve(mission.title, ctx)}</h2>
        <p className="screen-sub">{resolve(mission.sub, ctx)}</p>
        {examples.length > 0 && (
          <div className="row mission-examples">
            {examples.map(e => <span key={e} className="chip chip-seq">{e}</span>)}
          </div>
        )}
        <button className="link-btn mission-skip" onClick={() => skipMission(mission.id)}>
          <SkipForward size={14} /> Ya sé hacer esto · Saltar
        </button>
      </header>
    )
  }

  // ---------------------------------------------------------- misión en otra pantalla (o explorando)
  return (
    <header className="screen-head">
      {fallback}
      {mission && (
        <button className="mission-pointer" onClick={goToCurrentMission}>
          <span>Misión {idx + 1}:</span> {resolve(mission.title, ctx)} <ArrowRight size={14} />
        </button>
      )}
    </header>
  )
}

function Success({ done, hasNext }) {
  const [fact, setFact] = useState(false)
  const n = MISSIONS.indexOf(done) + 1
  return (
    <header className="screen-head mission is-done" aria-live="polite">
      <div className="eyebrow mission-eyebrow"><Check size={14} /> Misión {n} cumplida <span>· {done.step}</span></div>
      <h2 className="screen-title">{done.success}</h2>
      {done.fact && (
        fact
          ? <p className="mission-fact"><Lightbulb size={15} /> {done.fact}</p>
          : <button className="link-btn" onClick={() => setFact(true)}><Lightbulb size={15} /> ¿Sabías que…?</button>
      )}
      <div className="row mission-actions">
        <button className="btn btn-primary" onClick={continueMissions}>
          {hasNext ? <>Seguir <ArrowRight size={16} /></> : <>¡Terminado! <Check size={16} /></>}
        </button>
        <button className="btn btn-ghost" onClick={stayAndExplore}>Quedarme aquí y experimentar</button>
      </div>
      {!hasNext && <p className="screen-sub">Has completado lo básico del sampling. Ahora el sampler es tuyo: cambia, vuelve a grabar, experimenta.</p>}
    </header>
  )
}
