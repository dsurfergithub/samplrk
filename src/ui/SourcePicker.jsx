/**
 * SourcePicker — FIND: elegir qué escuchar. Primero los discos de práctica
 * (no hace falta buscar archivos), después el audio propio.
 */
import { useRef, useState } from 'react'
import { Play, Square, Upload, Disc3 } from 'lucide-react'
import { PRACTICE_SAMPLES } from '../engines/demo/practiceSamples'
import { ACCEPT_ATTR } from '../engines/audioImport'
import { openPractice, auditionPractice, importAudioFile, stopPreview, goto } from '../actions/sampleActions'
import { usePreviewing } from './hooks'
import MissionHead from './MissionHead'

export default function SourcePicker() {
  const fileRef = useRef(null)
  const [over, setOver] = useState(false)
  const [auditioning, setAuditioning] = useState(null)
  const previewing = usePreviewing()
  const playingId = previewing ? auditioning : null

  const audition = (id) => {
    if (playingId === id) { stopPreview(); return }
    setAuditioning(id)
    auditionPractice(id)
  }

  return (
    <section>
      <MissionHead screen="source" eyebrow={['Find', 'Encuentra']} title="Elige un disco para escuchar."
        sub="Grabaciones de práctica, libres para samplear. Escucha alguna y quédate con la que te diga algo." />

      <div className="crates">
        {PRACTICE_SAMPLES.map(s => (
          <article key={s.id} className="crate" style={{ '--crate': s.color }}>
            <div className="crate-label"><Disc3 size={14} /> {s.crate}</div>
            <h3 className="crate-title">{s.title}</h3>
            <p className="crate-blurb">{s.blurb}</p>
            {s.credit && <p className="crate-credit">{s.credit}</p>}
            <div className="row">
              <button className="btn btn-icon" onClick={() => audition(s.id)} aria-label={playingId === s.id ? `Parar ${s.title}` : `Escuchar ${s.title}`}>
                {playingId === s.id ? <Square size={16} /> : <Play size={16} />}
              </button>
              <button className="btn btn-primary" onClick={() => openPractice(s.id)}>Samplear este</button>
            </div>
          </article>
        ))}
      </div>

      <div
        className={`dropzone${over ? ' is-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); importAudioFile(e.dataTransfer.files[0]) }}
      >
        <div>
          <b>¿Tienes tu propio audio?</b>
          <p>WAV o MP3 (otros formatos si tu navegador los abre). Arrástralo aquí o elígelo.</p>
        </div>
        <button className="btn" onClick={() => fileRef.current.click()}><Upload size={16} /> Importar audio</button>
        <input ref={fileRef} type="file" hidden accept={ACCEPT_ATTR}
          onChange={e => { importAudioFile(e.target.files[0]); e.target.value = '' }} />
      </div>
      <button className="os-teaser" onClick={() => goto('oldschool')}>
        <span><b>Modo Old School</b> · samplea como en los 80: 10 segundos de memoria, 12 bits, 8 pads.</span>
        <span className="os-teaser-go">Probar →</span>
      </button>
      <p className="fineprint">Si vas a publicar música que usa grabaciones de otras personas, asegúrate de tener los derechos necesarios.</p>
    </section>
  )
}
