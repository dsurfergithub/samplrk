/**
 * Home — una sola decisión: empezar a aprender, o ir directo al sampler.
 * El botón desbloquea el audio (los navegadores exigen un gesto del usuario).
 */
import { ArrowRight, RotateCcw } from 'lucide-react'
import { startAudio, goto } from '../actions/sampleActions'
import { setMode } from '../actions/learningActions'
import { openProject, newProject } from '../actions/projectActions'
import { useUi } from '../state/uiStore'
import ProjectBrowser from './ProjectBrowser'

// la frase del momento clave: A C C B suena a "algo mío"
const DEMO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

async function begin(mode) {
  await startAudio()
  newProject(mode) // el proyecto anterior (si lo hay) queda en «Mis proyectos»
  setMode(mode)
  goto('source')
}

async function resume(id) {
  await startAudio()
  await openProject(id)
}

export default function Home() {
  const last = useUi(s => s.projects[0] ?? null)
  return (
    <section className="home">
      <div className="home-pads" aria-hidden="true">
        {DEMO.map((l, i) => <span key={l} className={`home-pad hp-${i}`}>{l}</span>)}
      </div>
      <h1 className="home-logo">SAMPL<b>RK</b></h1>
      <p className="home-tagline">Aprende a convertir cualquier sonido en música.</p>
      <p className="home-sub">Vamos a hacer tu primer beat. Sin teoría, sin cuentas, sin manual.</p>

      <div className="home-actions">
        {last && (
          <button className="btn btn-primary btn-big home-continue" onClick={() => resume(last.id)}>
            <RotateCcw size={18} /> <span>Continuar <small>{last.name}</small></span>
          </button>
        )}
        <button className={`btn btn-big${last ? '' : ' btn-primary'}`} onClick={() => begin('learning')}>
          {last ? 'Empezar uno nuevo' : 'Empezar'} <ArrowRight size={20} />
        </button>
        <button className="btn btn-ghost btn-big" onClick={() => begin('free')}>
          <span>¿Ya sabes samplear? <b>Modo libre</b></span>
        </button>
      </div>

      <ProjectBrowser />
      <p className="home-note">Sube el volumen. En iPhone, desactiva el modo silencio.</p>
      <a className="home-legacy" href="#/legacy">Versión anterior (v0.1)</a>
    </section>
  )
}
