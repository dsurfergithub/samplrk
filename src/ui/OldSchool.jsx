/**
 * OldSchool — modo Old School: límites que obligan a ser creativo.
 * Se activa por proyecto. Nada es destructivo: al desactivarlo, todo vuelve.
 */
import { Cpu, Disc3, Repeat2, ArrowRight } from 'lucide-react'
import { useProject } from '../state/projectStore'
import { OLD_SCHOOL_PRESETS, oldSchoolOf } from '../engines/oldSchool'
import { enableOldSchool, disableOldSchool, setOldSchool } from '../actions/oldSchoolActions'
import { goto } from '../actions/sampleActions'
import MemoryMeter from './MemoryMeter'

const kHz = (sr) => `${(sr / 1000).toFixed(sr % 1000 ? 1 : 0).replace('.', ',')} kHz`

function Choice({ label, value, options, onChange, format = (v) => v }) {
  return (
    <div className="os-choice">
      <span className="insp-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button key={o} role="radio" aria-checked={value === o} className={`btn${value === o ? ' is-on' : ''}`} onClick={() => onChange(o)}>{format(o)}</button>
        ))}
      </div>
    </div>
  )
}

export default function OldSchool() {
  const raw = useProject(p => p.settings?.oldSchool)
  const os = oldSchoolOf({ settings: { oldSchool: raw } })
  const hasSample = useProject(p => !!p.activeSampleId)

  return (
    <section className="oldschool">
      <header className="screen-head">
        <div className="eyebrow">Old School <span>· límites creativos</span></div>
        <h2 className="screen-title">Menos memoria, más ideas.</h2>
        <p className="screen-sub">Los primeros samplers tenían límites técnicos —poca memoria, 12 bits, pocos kHz— que acabaron formando parte de su sonido. Prueba a trabajar como entonces. Se aplica a este proyecto y se puede quitar cuando quieras.</p>
      </header>

      {os.enabled && <MemoryMeter showLink={false} />}

      <div className="os-presets">
        {OLD_SCHOOL_PRESETS.map(p => {
          const on = os.enabled && os.preset === p.id
          return (
            <article key={p.id} className={`os-card${on ? ' is-on' : ''}`}>
              <Cpu size={18} />
              <h3>{p.label}</h3>
              <p>{p.detail} · 8 pads · sin ayudas</p>
              <button className={`btn${on ? ' is-on' : ' btn-primary'}`} onClick={() => enableOldSchool(p.id)} aria-pressed={on}>
                {on ? 'Activo' : 'Usar'}
              </button>
            </article>
          )
        })}
      </div>

      {os.enabled && (
        <div className="os-custom">
          <Choice label="Memoria" value={os.memorySec} options={[5, 10, 20]} format={v => `${v} s`} onChange={v => setOldSchool({ memorySec: v, preset: null })} />
          <Choice label="Bits" value={os.bits} options={[8, 12, 16]} onChange={v => setOldSchool({ bits: v, preset: null })} />
          <Choice label="Muestreo" value={os.sampleRate} options={[11025, 26040, 40000, 44100]} format={kHz} onChange={v => setOldSchool({ sampleRate: v, preset: null })} />
          <div className="row">
            <button className={`btn${os.mono ? ' is-on' : ''}`} aria-pressed={os.mono} onClick={() => setOldSchool({ mono: !os.mono, preset: null })}>Mono</button>
            <button className={`btn${os.noHelpers ? ' is-on' : ''}`} aria-pressed={os.noHelpers} onClick={() => setOldSchool({ noHelpers: !os.noHelpers, preset: null })}>Sin ayudas automáticas</button>
            <span className="spacer" />
            <button className="btn btn-ghost btn-danger" onClick={disableOldSchool}>Desactivar Old School</button>
          </div>
        </div>
      )}

      <div className="os-explain">
        <article>
          <Disc3 size={18} />
          <h3>El truco de 33 / 45 rpm</h3>
          <p>Con poca memoria, muchos productores sampleaban los discos de 33 rpm <b>a 45</b>: el audio entra acelerado y ocupa un 35 % menos. Luego bajaban el pitch unos 5 semitonos para recuperar el tono… y sonaba más crujiente. Lo encontrarás en <b>Cut</b> con el modo activo.</p>
        </article>
        <article>
          <Cpu size={18} />
          <h3>12 bits y pocos kHz</h3>
          <p>Menos bits = más ruido y textura. Menos kHz = menos brillo y un brillo «roto» (aliasing) en los agudos. No es un efecto añadido: es lo que hacían aquellas máquinas.</p>
        </article>
        <article>
          <Repeat2 size={18} />
          <h3>Resampling</h3>
          <p>Cuando faltaban pads o memoria, se grababa el resultado como un sample nuevo y se seguía trabajando sobre él. Pruébalo en <b>Tu beat → Resamplear</b>.</p>
        </article>
      </div>

      <button className="btn btn-primary btn-big" onClick={() => goto(hasSample ? 'cut' : 'source')}>
        {hasSample ? 'Ir a cortar' : 'Elegir un disco'} <ArrowRight size={18} />
      </button>
    </section>
  )
}
