/**
 * Home — una sola decisión: empezar a aprender, o ir directo al sampler.
 * El botón desbloquea el audio (los navegadores exigen un gesto del usuario).
 */
import { ArrowRight } from 'lucide-react'
import { startAudio, goto } from '../actions/sampleActions'
import { setCoachEnabled } from '../actions/learningActions'
import { commit } from '../state/projectStore'

// la frase del momento clave: A C C B suena a "algo mío"
const DEMO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

async function begin(mode) {
  await startAudio()
  setCoachEnabled(mode === 'learning')
  commit(p => ({ ...p, mode }), { undoable: false })
  goto('source')
}

export default function Home() {
  return (
    <section className="home">
      <div className="home-pads" aria-hidden="true">
        {DEMO.map((l, i) => <span key={l} className={`home-pad hp-${i}`}>{l}</span>)}
      </div>
      <h1 className="home-logo">SAMPL<b>RK</b></h1>
      <p className="home-tagline">Aprende a convertir cualquier sonido en música.</p>
      <p className="home-sub">Vamos a hacer tu primer beat. Sin teoría, sin cuentas, sin manual.</p>

      <div className="home-actions">
        <button className="btn btn-primary btn-big" onClick={() => begin('learning')}>
          Empezar <ArrowRight size={20} />
        </button>
        <button className="btn btn-ghost btn-big" onClick={() => begin('free')}>
          <span>¿Ya sabes samplear? <b>Modo libre</b></span>
        </button>
      </div>

      <p className="home-note">Sube el volumen. En iPhone, desactiva el modo silencio.</p>
      <a className="home-legacy" href="#/legacy">Versión anterior (v0.1)</a>
    </section>
  )
}
